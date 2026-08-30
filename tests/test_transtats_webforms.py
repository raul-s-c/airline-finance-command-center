from __future__ import annotations

import pytest

from airline_finance_command_center.transtats_webforms import (
    TABLES,
    encode_table_id,
    parse_form,
    resolve_year,
    table_url,
)


def test_known_table_ids_encode_to_live_transtats_codes() -> None:
    assert encode_table_id(259) == "FIM"
    assert encode_table_id(295) == "FMI"
    assert encode_table_id(297) == "FMK"
    assert encode_table_id(294) == "FMH"
    assert encode_table_id(314) == "GEH"


def test_all_required_sources_have_table_ids() -> None:
    assert {"P-1.2", "P-5.2", "P-12(a)", "B-43", "T-100"}.issubset(TABLES)


def test_table_url_uses_official_transtats_form() -> None:
    assert table_url(TABLES["T-100"]).startswith("https://transtats.bts.gov/DL_SelectFields.aspx?")
    assert "gnoyr_VQ=FIM" in table_url(TABLES["T-100"])


def test_parse_form_extracts_hidden_fields_columns_and_years() -> None:
    html = """
    <input type="hidden" name="__VIEWSTATE" value="abc" />
    <input type="hidden" name="__EVENTVALIDATION" value="xyz" />
    <input type="checkbox" name="UNIQUE_CARRIER" />
    <input type="checkbox" name="PASSENGERS" />
    <input type="checkbox" name="chkAllVars" />
    <select><option value="2025">2025</option><option value="2026">2026</option></select>
    """
    hidden, fields, years = parse_form(html)
    assert hidden["__VIEWSTATE"] == "abc"
    assert fields == ("UNIQUE_CARRIER", "PASSENGERS")
    assert years == ("2025", "2026")


def test_resolve_year_supports_latest_previous_and_explicit() -> None:
    years = ("2024", "2025", "2026")
    assert resolve_year("latest", years) == "2026"
    assert resolve_year("prev", years) == "2025"
    assert resolve_year("2024", years) == "2024"
    with pytest.raises(ValueError):
        resolve_year("2023", years)
