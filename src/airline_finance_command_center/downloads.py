from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from urllib.request import Request, urlopen


@dataclass(frozen=True)
class BTSDownload:
    product: str
    url: str
    filename: str
    description: str


LATEST_DOWNLOADS: tuple[BTSDownload, ...] = (
    BTSDownload(
        product="DB10",
        url=(
            "https://www.bts.gov/sites/bts.dot.gov/files/docs/airline-data/DB10/"
            "DB10.202404.202603.REL01.15JUN2026.zip"
        ),
        filename="DB10.202404.202603.REL01.15JUN2026.zip",
        description=(
            "Form 41 financial collection. Used as the raw source for P-1.2, "
            "P-5.2, P-12(a) and related financial schedules."
        ),
    ),
    BTSDownload(
        product="DB20",
        url=(
            "https://www.bts.gov/sites/bts.dot.gov/files/docs/airline-data/DB20/"
            "DB20.202505.202604.REL01.07JUL2026.zip"
        ),
        filename="DB20.202505.202604.REL01.07JUL2026.zip",
        description=(
            "Monthly U.S. air carrier traffic and capacity product derived from T-100."
        ),
    ),
)


TRANSTATS_TABLES: dict[str, str] = {
    "P-1.2": "https://www.transtats.bts.gov/DL_SelectFields.aspx?QO_fu146_anzr=Nv4+Pn44vr4+Sv0n0pvny&gnoyr_VQ=FMI",
    "P-5.2": "https://www.transtats.bts.gov/DL_SelectFields.aspx?QO_fu146_anzr=Nv4+Pn44vr4+Sv0n0pvny&gnoyr_VQ=FMK",
    "P-12(a)": "https://www.transtats.bts.gov/DL_SelectFields.aspx?QO_fu146_anzr=&gnoyr_VQ=FMH",
    "B-43": "https://www.transtats.bts.gov/DL_SelectFields.aspx?QO_fu146_anzr=Nv4+Pn44vr4+Sv0n0pvny&gnoyr_VQ=GEH",
    "T-100": "https://www.transtats.bts.gov/DL_SelectFields.aspx?QO_fu146_anzr=Nv4&gnoyr_VQ=FIM",
}


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
    output_path = Path(output_dir) / item.filename
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if output_path.exists() and not overwrite:
        return output_path

    request = Request(
        item.url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 airline-finance-command-center/0.1 "
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
