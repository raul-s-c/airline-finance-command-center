from __future__ import annotations

import argparse
import http.cookiejar
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import HTTPCookieProcessor, Request, build_opener


DL_FORM = "https://transtats.bts.gov/DL_SelectFields.aspx"
DB_SHORT_NAME_QUERY = "QO_fu146_anzr=Nv4%20Pn44vr45"
USER_AGENT = "Mozilla/5.0 airline-finance-command-center/0.2"

_VQ_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"


@dataclass(frozen=True)
class TranStatsTable:
    code: str
    table_id: int
    cadence: str
    description: str


@dataclass(frozen=True)
class TranStatsFormMetadata:
    table_code: str
    years: tuple[str, ...]
    field_names: tuple[str, ...]


TABLES: dict[str, TranStatsTable] = {
    "P-1.2": TranStatsTable("P-1.2", 295, "quarterly", "Profit and loss statement"),
    "P-5.2": TranStatsTable("P-5.2", 297, "quarterly", "Aircraft operating expenses"),
    "P-12(a)": TranStatsTable("P-12(a)", 294, "monthly", "Fuel cost and consumption"),
    "B-43": TranStatsTable("B-43", 314, "annual", "Aircraft inventory"),
    "T-100": TranStatsTable("T-100", 259, "monthly", "Domestic segment, U.S. carriers"),
    "T-100-I": TranStatsTable("T-100-I", 261, "monthly", "International segment, all carriers"),
}


def encode_table_id(table_id: int) -> str:
    value = str(table_id)
    return "".join(
        _VQ_ALPHABET[(_VQ_ALPHABET.index(char) + 13) % len(_VQ_ALPHABET)]
        if char in _VQ_ALPHABET
        else char
        for char in value
    ).upper()


def table_url(table: TranStatsTable) -> str:
    return f"{DL_FORM}?gnoyr_VQ={encode_table_id(table.table_id)}&{DB_SHORT_NAME_QUERY}"


def parse_form(html: str) -> tuple[dict[str, str], tuple[str, ...], tuple[str, ...]]:
    hidden = dict(
        re.findall(
            r'<input[^>]+type="hidden"[^>]+name="([^"]+)"[^>]*value="([^"]*)"',
            html,
            flags=re.IGNORECASE,
        )
    )
    if "__VIEWSTATE" not in hidden:
        hidden.update(
            dict(
                re.findall(
                    r'<input[^>]+name="([^"]+)"[^>]+type="hidden"[^>]*value="([^"]*)"',
                    html,
                    flags=re.IGNORECASE,
                )
            )
        )

    checkboxes = tuple(
        name
        for name in re.findall(
            r'<input[^>]+type="checkbox"[^>]+name="([^"]+)"',
            html,
            flags=re.IGNORECASE,
        )
        if not name.lower().startswith("chk")
    )
    years = tuple(sorted(set(re.findall(r'<option[^>]+value="(\d{4})"', html))))

    if not hidden.get("__VIEWSTATE"):
        raise RuntimeError("TranStats form does not contain __VIEWSTATE")
    if not checkboxes:
        raise RuntimeError("TranStats form does not expose selectable data fields")
    if not years:
        raise RuntimeError("TranStats form does not expose reporting years")
    return hidden, checkboxes, years


def _open_form(table_code: str, timeout: int = 600):
    if table_code not in TABLES:
        raise KeyError(f"Unknown TranStats table: {table_code}")
    table = TABLES[table_code]
    url = table_url(table)
    opener = build_opener(HTTPCookieProcessor(http.cookiejar.CookieJar()))
    response = opener.open(Request(url, headers={"User-Agent": USER_AGENT}), timeout=timeout)
    html = response.read().decode("utf-8", "replace")
    hidden, fields, years = parse_form(html)
    return opener, url, hidden, fields, years


def get_form_metadata(table_code: str, timeout: int = 600) -> TranStatsFormMetadata:
    _, _, _, fields, years = _open_form(table_code, timeout=timeout)
    return TranStatsFormMetadata(table_code=table_code, years=years, field_names=fields)


def available_years(table_code: str, timeout: int = 600) -> tuple[str, ...]:
    return get_form_metadata(table_code, timeout=timeout).years


def resolve_year(requested: str | int | None, years: tuple[str, ...]) -> str:
    latest = max(years)
    if requested is None or str(requested).lower() == "latest":
        return latest
    if str(requested).lower() == "prev":
        candidate = str(int(latest) - 1)
    else:
        candidate = str(requested)
    if candidate not in years:
        raise ValueError(f"Year {candidate} is not available; offered range is {min(years)}-{max(years)}")
    return candidate


def download_table(
    table_code: str,
    *,
    year: str | int | None = "latest",
    period: str | int | None = None,
    timeout: int = 600,
) -> tuple[str, bytes]:
    opener, url, hidden, fields, years = _open_form(table_code, timeout=timeout)
    selected_year = resolve_year(year, years)

    form = dict(hidden)
    form.update(
        {
            "btnDownload": "Download",
            "chkDownloadZip": "on",
            "cboGeography": "All",
            "cboYear": selected_year,
            "cboPeriod": str(period) if period is not None else "All",
        }
    )
    for field in fields:
        form[field] = "on"

    post = Request(
        url,
        data=urlencode(form).encode("utf-8"),
        headers={"User-Agent": USER_AGENT, "Referer": url},
    )
    result = opener.open(post, timeout=timeout)
    payload = result.read()
    if not payload.startswith(b"PK"):
        message = re.search(rb"alert\('([^']*)'\)", payload)
        detail = message.group(1).decode("utf-8", "replace") if message else "unexpected HTML response"
        raise RuntimeError(f"TranStats download failed for {table_code}: {detail}")

    disposition = result.headers.get("Content-Disposition", "")
    match = re.search(r"filename=\"?([^\";]+)", disposition, flags=re.IGNORECASE)
    filename = match.group(1).strip() if match else f"{table_code.replace('/', '_')}_{selected_year}.zip"
    return filename, payload


def download_to_path(
    table_code: str,
    output_dir: str | Path,
    *,
    year: str | int | None = "latest",
    period: str | int | None = None,
    timeout: int = 600,
    overwrite: bool = False,
) -> Path:
    filename, payload = download_table(table_code, year=year, period=period, timeout=timeout)
    output = Path(output_dir) / filename
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists() and not overwrite:
        return output
    output.write_bytes(payload)
    return output


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="afcc-transtats", description="Download official TranStats table extracts.")
    parser.add_argument("--table", choices=sorted(TABLES), required=True)
    parser.add_argument("--year", default="latest")
    parser.add_argument("--period")
    parser.add_argument("--output-dir", default="data/raw/transtats")
    parser.add_argument("--timeout", type=int, default=600)
    parser.add_argument("--overwrite", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    path = download_to_path(
        args.table,
        args.output_dir,
        year=args.year,
        period=args.period,
        timeout=args.timeout,
        overwrite=args.overwrite,
    )
    print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
