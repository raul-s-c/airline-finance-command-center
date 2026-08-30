from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
from urllib.request import Request, urlopen

from airline_finance_command_center.transtats_webforms import TABLES, download_to_path


@dataclass(frozen=True)
class BTSDownload:
    product: str
    url: str
    filename: str
    description: str


# Historical bulk products are kept as source metadata only. bts.gov currently
# returns HTTP 403 to unattended server downloads, so production automation uses
# the live TranStats WebForms downloader below instead.
LATEST_DOWNLOADS: tuple[BTSDownload, ...] = (
    BTSDownload(
        product="DB10",
        url=(
            "https://www.bts.gov/sites/bts.dot.gov/files/docs/airline-data/DB10/"
            "DB10.202404.202603.REL01.15JUN2026.zip"
        ),
        filename="DB10.202404.202603.REL01.15JUN2026.zip",
        description=(
            "Form 41 financial collection. Historical bulk-file reference for "
            "P-1.2, P-5.2 and P-12(a)."
        ),
    ),
    BTSDownload(
        product="DB20",
        url=(
            "https://www.bts.gov/sites/bts.dot.gov/files/docs/airline-data/DB20/"
            "DB20.202505.202604.REL01.07JUL2026.zip"
        ),
        filename="DB20.202505.202604.REL01.07JUL2026.zip",
        description="Historical bulk-file reference derived from T-100.",
    ),
)


TRANSTATS_TABLES: dict[str, str] = {
    "P-1.2": "https://www.transtats.bts.gov/DL_SelectFields.aspx?QO_fu146_anzr=Nv4+Pn44vr4+Sv0n0pvny&gnoyr_VQ=FMI",
    "P-5.2": "https://www.transtats.bts.gov/DL_SelectFields.aspx?QO_fu146_anzr=Nv4+Pn44vr4+Sv0n0pvny&gnoyr_VQ=FMK",
    "P-12(a)": "https://www.transtats.bts.gov/DL_SelectFields.aspx?QO_fu146_anzr=&gnoyr_VQ=FMH",
    "B-43": "https://www.transtats.bts.gov/DL_SelectFields.aspx?QO_fu146_anzr=Nv4+Pn44vr4+Sv0n0pvny&gnoyr_VQ=GEH",
    "T-100": "https://www.transtats.bts.gov/DL_SelectFields.aspx?QO_fu146_anzr=Nv4&gnoyr_VQ=FIM",
}

PRODUCTION_TABLES = ("P-1.2", "P-5.2", "P-12(a)", "B-43", "T-100", "T-100-I")


def get_download(product: str) -> BTSDownload:
    normalized = product.strip().upper()
    for item in LATEST_DOWNLOADS:
        if item.product == normalized:
            return item
    raise KeyError(f"Unknown BTS download product: {product}")


def download_file(
    item: BTSDownload,
    output_dir: str | Path = "data/raw",
    *,
    timeout: int = 120,
    overwrite: bool = False,
) -> Path:
    """Download a legacy BTS bulk product.

    This remains available for manual/local diagnostics. Production workflows
    intentionally use TranStats because bts.gov bulk-file hosting rejects
    unattended GitHub Actions traffic with HTTP 403.
    """
    output_path = Path(output_dir) / item.filename
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if output_path.exists() and not overwrite:
        return output_path

    request = Request(
        item.url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 airline-finance-command-center/0.2 "
                "(+https://github.com/raul-s-c/airline-finance-command-center)"
            )
        },
    )

    with urlopen(request, timeout=timeout) as response:
        payload = response.read()

    if not payload.startswith(b"PK"):
        raise ValueError(f"Expected ZIP payload for {item.product}, received non-ZIP content")

    output_path.write_bytes(payload)
    return output_path


def download_latest_bts_products(
    output_dir: str | Path = "data/raw",
    *,
    timeout: int = 120,
    overwrite: bool = False,
) -> tuple[Path, ...]:
    return tuple(
        download_file(
            item,
            output_dir,
            timeout=timeout,
            overwrite=overwrite,
        )
        for item in LATEST_DOWNLOADS
    )


def download_transtats_tables(
    table_codes: tuple[str, ...] = PRODUCTION_TABLES,
    output_dir: str | Path = "data/raw/transtats",
    *,
    year: str | int = "latest",
    timeout: int = 900,
    overwrite: bool = False,
) -> tuple[Path, ...]:
    paths: list[Path] = []
    root = Path(output_dir)
    for table_code in table_codes:
        if table_code not in TABLES:
            raise KeyError(f"Unknown TranStats table: {table_code}")
        table_dir = root / table_code.replace("/", "_").replace("(", "_").replace(")", "_")
        paths.append(
            download_to_path(
                table_code,
                table_dir,
                year=year,
                timeout=timeout,
                overwrite=overwrite,
            )
        )
    return tuple(paths)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="afcc-download",
        description=(
            "Download official airline datasets. TranStats is the production "
            "source; DB10/DB20 are retained only as legacy bulk references."
        ),
    )
    parser.add_argument(
        "--table",
        choices=list(PRODUCTION_TABLES) + ["all"],
        default="all",
        help="TranStats table to download.",
    )
    parser.add_argument("--year", default="latest")
    parser.add_argument("--output-dir", default="data/raw/transtats")
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--timeout", type=int, default=900)
    parser.add_argument(
        "--legacy-product",
        choices=[item.product for item in LATEST_DOWNLOADS],
        help="Explicitly request an old DB10/DB20 bulk ZIP instead of TranStats.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    if args.legacy_product:
        item = get_download(args.legacy_product)
        path = download_file(
            item,
            args.output_dir,
            timeout=args.timeout,
            overwrite=args.overwrite,
        )
        print(f"{item.product}: {path}")
        return 0

    tables = PRODUCTION_TABLES if args.table == "all" else (args.table,)
    paths = download_transtats_tables(
        tables,
        args.output_dir,
        year=args.year,
        timeout=args.timeout,
        overwrite=args.overwrite,
    )
    for table, path in zip(tables, paths, strict=True):
        print(f"{table}: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
