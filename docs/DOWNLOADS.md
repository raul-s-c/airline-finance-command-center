# Official BTS / TranStats Downloads

## Production decision

The project uses the official TranStats download form as the production source for granular airline data.

Direct DB10 and DB20 bulk ZIP URLs hosted on `bts.gov` are useful references, but the hosting layer currently returns HTTP 403 to unattended GitHub Actions traffic. The project therefore does not depend on those URLs for production refreshes.

TranStats is also an official U.S. DOT Bureau of Transportation Statistics service and exposes the same underlying reporting schedules through `DL_SelectFields.aspx`.

## Automated method

`src/airline_finance_command_center/transtats_webforms.py` reproduces the normal TranStats download flow without scraping displayed results:

1. GET the official table download page.
2. Preserve the session cookies.
3. Read ASP.NET hidden fields such as `__VIEWSTATE` and `__EVENTVALIDATION`.
4. Discover the currently available reporting years and source columns.
5. POST the requested year/period and selected fields back to the official form.
6. Validate that the returned payload is a ZIP before storing it.

This method was live-tested from GitHub Actions on 30 August 2026 for all core project tables.

## Production tables

| Project source | TranStats table | Granularity | Live status |
|---|---|---|---|
| P-1.2 | Schedule P-1.2 | Carrier, region/entity, quarter | Validated |
| P-5.2 | Schedule P-5.2 | Carrier, region/entity, aircraft type, quarter | Validated |
| P-12(a) | Schedule P-12(a) | Carrier, month | Validated |
| B-43 | Schedule B-43 | Tail number / aircraft | Validated |
| T-100 | Domestic Segment, U.S. carriers | Route, aircraft type, month | Validated |
| T-100-I | International Segment, all carriers | Route, aircraft type, month | Validated |

Delta's stable BTS identifier is Airline ID `19790`; `DL` remains the display/carrier code.

## Download commands

Download one current table:

```bash
afcc-download --table P-1.2 --year latest
afcc-download --table P-5.2 --year latest
afcc-download --table 'P-12(a)' --year latest
afcc-download --table B-43 --year latest
afcc-download --table T-100 --year latest
afcc-download --table T-100-I --year latest
```

Download all production tables:

```bash
afcc-download --table all --year latest
```

The lower-level command is also exposed directly:

```bash
afcc-transtats --table T-100 --year 2026
```

Build the complete compact Delta analytical layer with rolling retention:

```bash
afcc-build-bts --output web/data/bts_summary.json
```

## Rolling data retained by the published layer

The web application does not publish the raw TranStats ZIP files.

The pipeline downloads enough recent years to derive:

- 8 quarterly P-1.2 financial periods.
- 8 quarterly P-5.2 aircraft-economics periods.
- 24 monthly P-12(a) fuel periods.
- 24 monthly domestic and international T-100 operational periods.
- Latest B-43 aircraft inventory.

Only compact Delta outputs are stored in `web/data/bts_summary.json`.

## Source-specific aggregation rules

### P-1.2

Delta reports separate regional/entity records (for example D, L, A and P). These records are additive for the carrier-level quarterly view and are summed for Airline ID 19790.

### P-5.2

Records are split by region/entity and aircraft type. Aircraft type `999` aggregate/blank records are excluded from aircraft-type economics to avoid double counting; detailed types are aggregated across regions.

### P-12(a)

Monthly fuel gallons and costs are summed for Delta. Domestic and international fields are retained separately alongside the total.

### T-100

Domestic and international segment tables are both ingested. The compact layer derives passengers, seats, departures, air time, RPM, ASM, load factor, route rankings, airport activity and aircraft-type mix.

### B-43

Only operating aircraft are included in active-fleet metrics. Tail number, manufacturer, model, manufacture year, seats and payload capacity remain traceable.

## Automation

`.github/workflows/refresh-bts.yml` runs monthly and can also be triggered manually. It:

1. Runs the project test suite.
2. Downloads the official TranStats source files.
3. Builds the compact Delta BTS JSON.
4. Validates that financial, fuel, network and fleet outputs are non-empty.
5. Commits the compact output only when it changes.
6. Deploys the updated site to GitHub Pages.

Raw source ZIPs remain outside Git.

## Legacy DB10 / DB20 references

The old DB10 and DB20 URLs remain in the code only for source metadata and manual diagnostics. They are no longer the production ingestion method because unattended downloads currently receive HTTP 403.
