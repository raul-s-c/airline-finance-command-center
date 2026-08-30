from __future__ import annotations

import csv
import zipfile
from pathlib import Path

from airline_finance_command_center.transtats_csv import (
    carrier_code,
    integer,
    is_delta,
    iter_zip_rows,
    normalize_column,
    number,
)


def make_zip(path: Path) -> None:
    data = (
        'YEAR,UNIQUE_CARRIER,OP_REVENUES,ORIGIN_CITY_NAME\n'
        '2026,DL,"1,250.5","Atlanta, GA"\n'
        '2026,AA,900.0,"Dallas/Fort Worth, TX"\n'
    )
    with zipfile.ZipFile(path, 'w') as archive:
        archive.writestr('Documentation.csv', 'field,description\n')
        archive.writestr('data.csv', data)


def test_normalize_column_matches_transtats_headers() -> None:
    assert normalize_column('OP_REVENUES') == 'op_revenues'
    assert normalize_column(' Origin City Name ') == 'origin_city_name'


def test_zip_reader_streams_normalized_rows(tmp_path: Path) -> None:
    path = tmp_path / 'sample.zip'
    make_zip(path)
    rows = list(iter_zip_rows(path))
    assert rows[0]['year'] == '2026'
    assert rows[0]['unique_carrier'] == 'DL'
    assert rows[0]['origin_city_name'] == 'Atlanta, GA'
    assert is_delta(rows[0]) is True
    assert is_delta(rows[1]) is False


def test_numeric_helpers_handle_transtats_strings() -> None:
    assert number('1,250.5') == 1250.5
    assert integer('12.0') == 12
    assert number('') == 0.0


def test_carrier_code_prefers_unique_carrier() -> None:
    assert carrier_code({'unique_carrier': 'dl', 'carrier': 'xx'}) == 'DL'
