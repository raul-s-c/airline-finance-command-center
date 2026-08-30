from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pytest

from airline_finance_command_center import downloads


class FakeResponse(BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        self.close()
        return False


def test_latest_downloads_are_official_bts_zip_urls() -> None:
    products = {item.product: item for item in downloads.LATEST_DOWNLOADS}

    assert set(products) == {"DB10", "DB20"}
    assert all(item.url.startswith("https://www.bts.gov/") for item in products.values())
    assert all(item.filename.endswith(".zip") for item in products.values())


def test_download_file_writes_zip(monkeypatch, tmp_path: Path) -> None:
    item = downloads.get_download("DB10")

    def fake_urlopen(request, timeout):
        assert request.full_url == item.url
        assert timeout == 30
        return FakeResponse(b"PK\x03\x04fake-zip")

    monkeypatch.setattr(downloads, "urlopen", fake_urlopen)
    path = downloads.download_file(item, tmp_path, timeout=30)

    assert path == tmp_path / item.filename
    assert path.read_bytes().startswith(b"PK")


def test_download_rejects_non_zip(monkeypatch, tmp_path: Path) -> None:
    item = downloads.get_download("DB20")
    monkeypatch.setattr(
        downloads,
        "urlopen",
        lambda request, timeout: FakeResponse(b"<html>error</html>"),
    )

    with pytest.raises(ValueError, match="Expected ZIP payload"):
        downloads.download_file(item, tmp_path)


def test_existing_file_is_reused_without_network(monkeypatch, tmp_path: Path) -> None:
    item = downloads.get_download("DB10")
    path = tmp_path / item.filename
    path.write_bytes(b"PKexisting")

    monkeypatch.setattr(
        downloads,
        "urlopen",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("network called")),
    )

    assert downloads.download_file(item, tmp_path) == path


def test_all_transtats_source_pages_are_registered() -> None:
    assert set(downloads.TRANSTATS_TABLES) == {
        "P-1.2",
        "P-5.2",
        "P-12(a)",
        "B-43",
        "T-100",
    }
