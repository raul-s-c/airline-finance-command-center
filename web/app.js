const titles = {
  overview: "Executive Overview",
  pnl: "P&L Performance",
  operations: "Operational Drivers",
  fuel: "Fuel & Fleet",
  variance: "Variance Analysis",
  controls: "Data Controls",
};

const dashboard = document.querySelector("#dashboard-view");
const title = document.querySelector("#view-title");
let actuals = null;
let bts = null;

function pctChange(current, prior) {
  if (prior === 0 || prior == null || current == null) return null;
  return ((current / prior) - 1) * 100;
}

function variance(current, prior) {
  return current - prior;
}

function fmtPct(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

function fmtPp(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}pp`;
}

function fmtUsdMillions(value, digits = 0) {
  if (value == null || Number.isNaN(value)) return "n/a";
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: digits })}m`;
}

function fmtUsdBillionsFromMillions(value) {
  if (value == null || Number.isNaN(value)) return "n/a";
  return `$${(value / 1000).toFixed(2)}bn`;
}

function fmtCompact(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return "n/a";
  const absolute = Math.abs(value);
  if (absolute >= 1e9) return `${(value / 1e9).toFixed(digits)}bn`;
  if (absolute >= 1e6) return `${(value / 1e6).toFixed(digits)}m`;
  if (absolute >= 1e3) return `${(value / 1e3).toFixed(digits)}k`;
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function toneForVariance(value, favorablePositive = true) {
  const favorable = favorablePositive ? value >= 0 : value <= 0;
  return favorable ? "positive" : "negative";
}

function kpiCard([label, value, delta, tone]) {
  return `<article class="kpi-card"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div><div class="delta ${tone}">${delta}</div></article>`;
}

function financialRow(key) {
  return actuals.financials_usd_millions[key];
}

function statisticRow(key) {
  return actuals.statistics[key];
}

function latestBts(section, nested = null) {
  if (!bts) return null;
  const value = nested ? bts[section]?.[nested] : bts[section];
  return Array.isArray(value) && value.length ? value[value.length - 1] : null;
}

function btsReady() {
  return Boolean(bts && bts.metadata && bts.metadata.status === "official_bts_transtats");
}

function sourceNotice() {
  const ir = `<a href="${actuals.source.url}" target="_blank" rel="noopener">Delta Investor Relations</a>`;
  if (!btsReady()) {
    return `<div class="notice">Management actuals: ${ir}. The official BTS TranStats layer is being refreshed; this view remains valid using Delta's published 2Q26 results.</div>`;
  }
  const latestFinancial = latestBts("p12_financials");
  const latestNetwork = latestBts("t100_network", "history");
  return `<div class="notice">Official dual-source model: ${ir} for current 2Q26 management actuals; U.S. DOT BTS TranStats for granular Form 41, fuel, network and fleet detail. Latest BTS financial period: ${latestFinancial?.period || "n/a"}; network period: ${latestNetwork?.period || "n/a"}.</div>`;
}

function renderOverview() {
  const revenue = financialRow("operating_revenue");
  const expense = financialRow("operating_expense");
  const operatingIncome = financialRow("operating_income");
  const netIncome = financialRow("net_income");
  const loadFactor = statisticRow("load_factor_pct");
  const fuelPrice = statisticRow("fuel_price_per_gallon");
  const rpm = statisticRow("rpm_millions");
  const asm = statisticRow("asm_millions");
  const operatingMargin = operatingIncome.current / revenue.current * 100;
  const priorOperatingMargin = operatingIncome.prior / revenue.prior * 100;

  const kpis = [
    ["Operating Revenue", fmtUsdBillionsFromMillions(revenue.current), `${fmtPct(pctChange(revenue.current, revenue.prior))} vs 2Q25`, "positive"],
    ["Operating Margin", `${operatingMargin.toFixed(1)}%`, `${fmtPp(operatingMargin - priorOperatingMargin)} vs 2Q25`, toneForVariance(operatingMargin - priorOperatingMargin)],
    ["Load Factor", `${loadFactor.current.toFixed(1)}%`, `${fmtPp(loadFactor.current - loadFactor.prior)} vs 2Q25`, toneForVariance(loadFactor.current - loadFactor.prior)],
    ["Fuel Cost / Gallon", `$${fuelPrice.current.toFixed(2)}`, `${fmtPct(pctChange(fuelPrice.current, fuelPrice.prior))} vs 2Q25`, toneForVariance(pctChange(fuelPrice.current, fuelPrice.prior), false)],
  ];

  const pnl = [
    ["Operating revenue", fmtUsdBillionsFromMillions(revenue.current), fmtPct(pctChange(revenue.current, revenue.prior))],
    ["Operating expense", fmtUsdBillionsFromMillions(expense.current), fmtPct(pctChange(expense.current, expense.prior))],
    ["Operating income", fmtUsdBillionsFromMillions(operatingIncome.current), fmtPct(pctChange(operatingIncome.current, operatingIncome.prior))],
    ["Net income", fmtUsdBillionsFromMillions(netIncome.current), fmtPct(pctChange(netIncome.current, netIncome.prior))],
  ];

  const drivers = [
    ["Revenue passenger miles", `${(rpm.current / 1000).toFixed(1)}bn`, 85],
    ["Available seat miles", `${(asm.current / 1000).toFixed(1)}bn`, 92],
    ["Load factor", `${loadFactor.current.toFixed(1)}%`, loadFactor.current],
    ["Passenger yield", `${statisticRow("passenger_yield_cents").current.toFixed(2)}c`, 78],
  ];

  let btsPanel = "";
  if (btsReady()) {
    const fin = latestBts("p12_financials");
    const net = latestBts("t100_network", "history");
    const fuel = latestBts("p12a_fuel");
    const fleet = bts.b43_fleet;
    btsPanel = `<article class="panel"><h2>BTS Operating Pulse</h2><p class="panel-subtitle">Latest available official TranStats periods</p>
      <div class="metric-row"><span>Form 41 operating revenue</span><strong>${fmtUsdBillionsFromMillions(fin?.operating_revenue_usd_m)}</strong><span>${fin?.period || "n/a"}</span></div>
      <div class="metric-row"><span>T-100 passengers</span><strong>${fmtCompact(net?.passengers)}</strong><span>${net?.period || "n/a"}</span></div>
      <div class="metric-row"><span>P-12(a) fuel gallons</span><strong>${fmtCompact(fuel?.fuel_gallons)}</strong><span>${fuel?.period || "n/a"}</span></div>
      <div class="metric-row"><span>Active aircraft</span><strong>${fleet?.active_aircraft_count?.toLocaleString() || "n/a"}</strong><span>B-43 ${fleet?.inventory_year || ""}</span></div>
    </article>`;
  }

  dashboard.innerHTML = `
    ${sourceNotice()}
    <section class="kpi-grid">${kpis.map(kpiCard).join("")}</section>
    <section class="two-col">
      <article class="panel">
        <h2>P&L Snapshot</h2>
        <p class="panel-subtitle">Delta 2Q26 GAAP management actuals</p>
        ${pnl.map(([label, value, delta]) => `<div class="metric-row"><span>${label}</span><strong>${value}</strong><span class="delta ${delta.startsWith("-") ? "negative" : "positive"}">${delta}</span></div>`).join("")}
      </article>
      <article class="panel">
        <h2>Operating Drivers</h2>
        <p class="panel-subtitle">Delta 2Q26 statistical summary</p>
        ${drivers.map(([label, value, width]) => `<div class="bar-row"><div class="bar-head"><span>${label}</span><strong>${value}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${Math.min(width, 100)}%"></div></div></div>`).join("")}
      </article>
    </section>
    ${btsPanel ? `<section class="two-col">${btsPanel}<article class="panel"><h2>Source Strategy</h2><p class="panel-subtitle">Freshness and granularity are deliberately separated</p><div class="metric-row"><span>Current management result</span><strong>Delta IR</strong><span>2Q26</span></div><div class="metric-row"><span>Financial detail</span><strong>BTS P-1.2</strong><span>8 quarters</span></div><div class="metric-row"><span>Network detail</span><strong>BTS T-100</strong><span>24 months</span></div><div class="metric-row"><span>Fleet detail</span><strong>BTS B-43</strong><span>Tail level</span></div></article></section>` : ""}`;
}

function renderPnl() {
  const rows = [
    ["Operating Revenue", financialRow("operating_revenue")],
    ["Operating Expense", financialRow("operating_expense")],
    ["Operating Income", financialRow("operating_income")],
    ["Pre-tax Income", financialRow("pretax_income")],
    ["Net Income", financialRow("net_income")],
    ["Fuel Expense", financialRow("fuel_expense")],
    ["Operating Cash Flow", financialRow("operating_cash_flow")],
    ["Capital Expenditures", financialRow("capital_expenditures")],
  ];

  const irTable = `<article class="panel"><h2>Current Management P&L</h2><p class="panel-subtitle">USD millions, Delta GAAP actuals</p><div class="table-wrap"><table><thead><tr><th>Metric</th><th>2Q26</th><th>2Q25</th><th>Variance</th><th>Variance %</th></tr></thead><tbody>${rows.map(([name, item]) => {
    const v = variance(item.current, item.prior);
    const p = pctChange(item.current, item.prior);
    return `<tr><td>${name}</td><td>${item.current.toLocaleString()}</td><td>${item.prior.toLocaleString()}</td><td>${v > 0 ? "+" : ""}${v.toLocaleString()}</td><td class="delta ${toneForVariance(v, !name.includes("Expense") && !name.includes("Expenditures"))}">${fmtPct(p)}</td></tr>`;
  }).join("")}</tbody></table></div></article>`;

  let btsTable = "";
  if (btsReady()) {
    btsTable = `<article class="panel"><h2>BTS Form 41 History</h2><p class="panel-subtitle">P-1.2, Delta Airline ID 19790, regional reporting entities consolidated</p><div class="table-wrap"><table><thead><tr><th>Period</th><th>Revenue $m</th><th>Expense $m</th><th>Operating Profit $m</th><th>Margin</th><th>Passenger Revenue $m</th></tr></thead><tbody>${bts.p12_financials.slice().reverse().map(item => `<tr><td>${item.period}</td><td>${item.operating_revenue_usd_m.toLocaleString(undefined, {maximumFractionDigits:0})}</td><td>${item.operating_expense_usd_m.toLocaleString(undefined, {maximumFractionDigits:0})}</td><td>${item.operating_profit_loss_usd_m.toLocaleString(undefined, {maximumFractionDigits:0})}</td><td>${item.operating_margin == null ? "n/a" : `${(item.operating_margin * 100).toFixed(1)}%`}</td><td>${item.passenger_revenue_usd_m.toLocaleString(undefined, {maximumFractionDigits:0})}</td></tr>`).join("")}</tbody></table></div></article>`;
  }

  dashboard.innerHTML = `${sourceNotice()}${irTable}${btsTable}`;
}

function renderOperations() {
  const rpm = statisticRow("rpm_millions");
  const asm = statisticRow("asm_millions");
  const lf = statisticRow("load_factor_pct");
  const yieldMetric = statisticRow("passenger_yield_cents");
  const prasm = statisticRow("passenger_prasm_cents");
  const trasm = statisticRow("trasm_cents");
  const casm = statisticRow("casm_cents");

  const cards = [
    ["Revenue Passenger Miles", `${(rpm.current / 1000).toFixed(1)}bn`, `${fmtPct(pctChange(rpm.current, rpm.prior))} vs 2Q25`, toneForVariance(variance(rpm.current, rpm.prior))],
    ["Available Seat Miles", `${(asm.current / 1000).toFixed(1)}bn`, `${fmtPct(pctChange(asm.current, asm.prior))} vs 2Q25`, "neutral"],
    ["Passenger Load Factor", `${lf.current.toFixed(1)}%`, `${fmtPp(lf.current - lf.prior)} vs 2Q25`, toneForVariance(lf.current - lf.prior)],
    ["Passenger Yield", `${yieldMetric.current.toFixed(2)}c`, `${fmtPct(pctChange(yieldMetric.current, yieldMetric.prior))} vs 2Q25`, "positive"],
    ["TRASM", `${trasm.current.toFixed(2)}c`, `${fmtPct(pctChange(trasm.current, trasm.prior))} vs 2Q25`, "positive"],
    ["CASM", `${casm.current.toFixed(2)}c`, `${fmtPct(pctChange(casm.current, casm.prior))} vs 2Q25`, "negative"],
  ];

  let network = "";
  if (btsReady()) {
    const latest = latestBts("t100_network", "history");
    const routes = bts.t100_network.top_directional_routes || [];
    const aircraft = bts.t100_network.aircraft_type_mix || [];
    network = `<section class="two-col"><article class="panel"><h2>BTS T-100 Network</h2><p class="panel-subtitle">Latest month ${latest?.period || "n/a"}; domestic + international segment data</p><div class="metric-row"><span>Passengers</span><strong>${fmtCompact(latest?.passengers)}</strong><span></span></div><div class="metric-row"><span>Available seats</span><strong>${fmtCompact(latest?.available_seats)}</strong><span></span></div><div class="metric-row"><span>Departures performed</span><strong>${fmtCompact(latest?.departures_performed)}</strong><span></span></div><div class="metric-row"><span>Distance-weighted load factor</span><strong>${latest?.load_factor == null ? "n/a" : `${(latest.load_factor * 100).toFixed(1)}%`}</strong><span></span></div></article><article class="panel"><h2>Aircraft Type Activity</h2><p class="panel-subtitle">Top T-100 aircraft types by passengers in the retained source window</p>${aircraft.slice(0, 7).map(item => `<div class="metric-row"><span>Type ${item.aircraft_type}</span><strong>${fmtCompact(item.passengers)}</strong><span>${fmtCompact(item.departures_performed)} deps</span></div>`).join("")}</article></section><article class="panel"><h2>Top Directional Routes</h2><p class="panel-subtitle">T-100 passenger segments, retained source window</p><div class="table-wrap"><table><thead><tr><th>Route</th><th>Passengers</th><th>Seats</th><th>Departures</th><th>Scope</th></tr></thead><tbody>${routes.slice(0, 15).map(item => `<tr><td>${item.origin} - ${item.destination}</td><td>${Math.round(item.passengers).toLocaleString()}</td><td>${Math.round(item.available_seats).toLocaleString()}</td><td>${Math.round(item.departures_performed).toLocaleString()}</td><td>${item.scope}</td></tr>`).join("")}</tbody></table></div></article>`;
  }

  dashboard.innerHTML = `${sourceNotice()}<section class="kpi-grid">${cards.map(kpiCard).join("")}</section><article class="panel"><h2>Management Driver Interpretation</h2><p class="panel-subtitle">Current Delta result: capacity -> traffic -> yield -> revenue -> cost</p><div class="metric-row"><span>Capacity growth</span><strong>${fmtPct(pctChange(asm.current, asm.prior))}</strong><span>ASM</span></div><div class="metric-row"><span>Traffic growth</span><strong>${fmtPct(pctChange(rpm.current, rpm.prior))}</strong><span>RPM</span></div><div class="metric-row"><span>Yield movement</span><strong>${fmtPct(pctChange(yieldMetric.current, yieldMetric.prior))}</strong><span>Passenger mile yield</span></div><div class="metric-row"><span>Passenger PRASM</span><strong>${prasm.current.toFixed(2)}c</strong><span>${fmtPct(pctChange(prasm.current, prasm.prior))}</span></div></article>${network}`;
}

function renderFuel() {
  const fuelExpense = financialRow("fuel_expense");
  const gallons = statisticRow("fuel_gallons_millions");
  const price = statisticRow("fuel_price_per_gallon");
  const casm = statisticRow("casm_cents");

  const cards = [
    ["Fuel Expense", fmtUsdBillionsFromMillions(fuelExpense.current), `${fmtPct(pctChange(fuelExpense.current, fuelExpense.prior))} vs 2Q25`, "negative"],
    ["Fuel Consumption", `${(gallons.current / 1000).toFixed(3)}bn gal`, `${fmtPct(pctChange(gallons.current, gallons.prior))} vs 2Q25`, "neutral"],
    ["Fuel Price / Gallon", `$${price.current.toFixed(2)}`, `${fmtPct(pctChange(price.current, price.prior))} vs 2Q25`, "negative"],
    ["CASM", `${casm.current.toFixed(2)}c`, `${fmtPct(pctChange(casm.current, casm.prior))} vs 2Q25`, "negative"],
  ];

  const volumeEffectApprox = (gallons.current - gallons.prior) * price.prior;
  const priceEffectApprox = gallons.current * (price.current - price.prior);

  let btsDetail = "";
  if (btsReady()) {
    const fuel = latestBts("p12a_fuel");
    const fleet = bts.b43_fleet;
    const models = fleet?.model_mix || [];
    const p52 = bts.p52_aircraft_economics?.latest_aircraft_type_economics || [];
    btsDetail = `<section class="two-col"><article class="panel"><h2>BTS Monthly Fuel</h2><p class="panel-subtitle">P-12(a), latest month ${fuel?.period || "n/a"}</p><div class="metric-row"><span>Total gallons</span><strong>${fmtCompact(fuel?.fuel_gallons)}</strong><span></span></div><div class="metric-row"><span>Fuel cost</span><strong>${fuel?.fuel_cost_usd == null ? "n/a" : `$${(fuel.fuel_cost_usd / 1e9).toFixed(2)}bn`}</strong><span></span></div><div class="metric-row"><span>Cost / gallon</span><strong>${fuel?.fuel_cost_per_gallon_usd == null ? "n/a" : `$${fuel.fuel_cost_per_gallon_usd.toFixed(2)}`}</strong><span></span></div><div class="metric-row"><span>Domestic / international gallons</span><strong>${fmtCompact(fuel?.domestic_fuel_gallons)} / ${fmtCompact(fuel?.international_fuel_gallons)}</strong><span></span></div></article><article class="panel"><h2>BTS Fleet Inventory</h2><p class="panel-subtitle">B-43 ${fleet?.inventory_year || ""}, operating aircraft only</p><div class="metric-row"><span>Active aircraft</span><strong>${fleet?.active_aircraft_count?.toLocaleString() || "n/a"}</strong><span></span></div><div class="metric-row"><span>Average aircraft age</span><strong>${fleet?.average_age_years == null ? "n/a" : `${fleet.average_age_years.toFixed(1)} yrs`}</strong><span></span></div>${models.slice(0, 5).map(item => `<div class="metric-row"><span>${item.manufacturer} ${item.model}</span><strong>${item.aircraft_count}</strong><span>${item.seats.toLocaleString()} seats</span></div>`).join("")}</article></section>${p52.length ? `<article class="panel"><h2>P-5.2 Aircraft Economics</h2><p class="panel-subtitle">Top aircraft types in the latest reported quarter; source units retained for traceability</p><div class="table-wrap"><table><thead><tr><th>Aircraft Type</th><th>Air Hours</th><th>Operating Expense</th><th>Fuel Expense</th><th>Direct Maintenance</th></tr></thead><tbody>${p52.slice(0, 12).map(item => `<tr><td>${item.aircraft_type}</td><td>${Math.round(item.air_hours || 0).toLocaleString()}</td><td>${Math.round(item.aircraft_operating_expense_source || 0).toLocaleString()}</td><td>${Math.round(item.fuel_expense_source || 0).toLocaleString()}</td><td>${Math.round(item.direct_maintenance_expense_source || 0).toLocaleString()}</td></tr>`).join("")}</tbody></table></div></article>` : ""}`;
  }

  dashboard.innerHTML = `${sourceNotice()}<section class="kpi-grid">${cards.map(kpiCard).join("")}</section><section class="two-col"><article class="panel"><h2>2Q26 Fuel Bridge</h2><p class="panel-subtitle">Approximate price-volume decomposition using Delta's published quarterly statistics</p><div class="metric-row"><span>Reported fuel expense change</span><strong>${fmtUsdMillions(variance(fuelExpense.current, fuelExpense.prior))}</strong><span>${fmtPct(pctChange(fuelExpense.current, fuelExpense.prior))}</span></div><div class="metric-row"><span>Approx. volume effect</span><strong>${fmtUsdMillions(volumeEffectApprox)}</strong><span>Gallons +${(gallons.current - gallons.prior).toFixed(0)}m</span></div><div class="metric-row"><span>Approx. price effect</span><strong>${fmtUsdMillions(priceEffectApprox)}</strong><span>$${(price.current - price.prior).toFixed(2)}/gal</span></div></article><article class="panel"><h2>Unit Cost</h2><p class="panel-subtitle">Current management metric</p><div class="metric-row"><span>CASM</span><strong>${casm.current.toFixed(2)}c</strong><span>${fmtPct(pctChange(casm.current, casm.prior))}</span></div><div class="metric-row"><span>Fuel price</span><strong>$${price.current.toFixed(2)}</strong><span>/ gallon</span></div></article></section>${btsDetail}`;
}

function renderVariance() {
  const revenue = financialRow("operating_revenue");
  const expense = financialRow("operating_expense");
  const opIncome = financialRow("operating_income");
  const netIncome = financialRow("net_income");
  const fuelExpense = financialRow("fuel_expense");
  const rpm = statisticRow("rpm_millions");
  const asm = statisticRow("asm_millions");
  const yieldMetric = statisticRow("passenger_yield_cents");
  const price = statisticRow("fuel_price_per_gallon");
  const gallons = statisticRow("fuel_gallons_millions");

  const items = [
    ["Operating Revenue", fmtUsdMillions(variance(revenue.current, revenue.prior)), `Revenue increased ${fmtPct(pctChange(revenue.current, revenue.prior))}; yield rose ${fmtPct(pctChange(yieldMetric.current, yieldMetric.prior))} while ASM increased ${fmtPct(pctChange(asm.current, asm.prior))}.`],
    ["Operating Expense", fmtUsdMillions(variance(expense.current, expense.prior)), `Expense increased ${fmtPct(pctChange(expense.current, expense.prior))}, faster than revenue.`],
    ["Fuel Expense", fmtUsdMillions(variance(fuelExpense.current, fuelExpense.prior)), `Average fuel price rose ${fmtPct(pctChange(price.current, price.prior))}; gallons consumed increased ${fmtPct(pctChange(gallons.current, gallons.prior))}.`],
    ["Operating Income", fmtUsdMillions(variance(opIncome.current, opIncome.prior)), `Revenue growth was more than offset by operating expense growth, reducing operating income ${fmtPct(pctChange(opIncome.current, opIncome.prior))}.`],
    ["Net Income", fmtUsdMillions(variance(netIncome.current, netIncome.prior)), `Net income declined ${Math.abs(pctChange(netIncome.current, netIncome.prior)).toFixed(1)}% year over year.`],
    ["Traffic", `${fmtPct(pctChange(rpm.current, rpm.prior))} RPM`, `Traffic was broadly flat while unit revenue improved materially.`],
  ];

  let btsEvidence = "";
  if (btsReady()) {
    const fuelHistory = bts.p12a_fuel || [];
    const last = fuelHistory.at(-1);
    const prior = fuelHistory.length > 12 ? fuelHistory.at(-13) : null;
    if (last && prior) {
      btsEvidence = `<article class="panel"><h2>BTS Evidence Layer</h2><p class="panel-subtitle">Same-month P-12(a) evidence from official monthly fuel filings</p><div class="metric-row"><span>Fuel gallons</span><strong>${fmtCompact(last.fuel_gallons)}</strong><span>${fmtPct(pctChange(last.fuel_gallons, prior.fuel_gallons))} YoY</span></div><div class="metric-row"><span>Fuel cost / gallon</span><strong>$${last.fuel_cost_per_gallon_usd.toFixed(2)}</strong><span>${fmtPct(pctChange(last.fuel_cost_per_gallon_usd, prior.fuel_cost_per_gallon_usd))} YoY</span></div></article>`;
    }
  }

  dashboard.innerHTML = `${sourceNotice()}<article class="panel"><h2>Management Variance View</h2><p class="panel-subtitle">2Q26 versus 2Q25, explanations restricted to published financial and statistical evidence</p>${items.map(([metric, value, detail]) => `<div class="metric-row"><span><strong>${metric}</strong><br><small>${detail}</small></span><strong>${value}</strong><span></span></div>`).join("")}</article>${btsEvidence}`;
}

function renderControls() {
  const btsCards = btsReady()
    ? `<article class="status-card"><strong>BTS live ingestion</strong><span>Official TranStats WebForms replay validated for P-1.2, P-5.2, P-12(a), B-43, T-100 and T-100-I.</span></article><article class="status-card"><strong>Rolling retention</strong><span>${bts.p12_financials.length} financial quarters and ${bts.t100_network.history.length} network months currently published.</span></article><article class="status-card"><strong>Stable entity keys</strong><span>Delta Airline ID ${bts.metadata.airline_id}; Airport IDs retained in raw transformation logic.</span></article><article class="status-card"><strong>Last BTS build</strong><span>${new Date(bts.metadata.generated_at_utc).toLocaleString()}</span></article>`
    : `<article class="status-card"><strong>BTS refresh</strong><span>The live TranStats layer is temporarily unavailable; Delta IR remains the published management source.</span></article>`;

  dashboard.innerHTML = `${sourceNotice()}<section class="status-grid"><article class="status-card"><strong>Management source</strong><span>Official Delta Investor Relations release dated ${actuals.source.published}.</span></article><article class="status-card"><strong>Financial reconciliation</strong><span>P-1.2 operating profit is checked against revenue less expense after regional consolidation.</span></article><article class="status-card"><strong>Schema validation</strong><span>Live TranStats columns are discovered from the official download form before ingestion.</span></article><article class="status-card"><strong>Unit controls</strong><span>USD, USD thousands, gallons, hours, miles and counts remain explicit through transformation.</span></article>${btsCards}<article class="status-card"><strong>Publication gate</strong><span>Only compact validated Delta outputs are published; raw ZIP files remain outside GitHub.</span></article></section>`;
}

const renderers = {
  overview: renderOverview,
  pnl: renderPnl,
  operations: renderOperations,
  fuel: renderFuel,
  variance: renderVariance,
  controls: renderControls,
};

function activate(view) {
  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  title.textContent = titles[view];
  renderers[view]();
}

async function loadData() {
  const actualResponse = await fetch("data/actuals.json", { cache: "no-store" });
  if (!actualResponse.ok) throw new Error(`Could not load actuals: ${actualResponse.status}`);
  actuals = await actualResponse.json();

  try {
    const btsResponse = await fetch("data/bts_summary.json", { cache: "no-store" });
    if (btsResponse.ok) bts = await btsResponse.json();
  } catch (error) {
    console.warn("BTS layer unavailable", error);
  }

  activate("overview");
}

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => activate(button.dataset.view));
});

dashboard.innerHTML = `<div class="notice">Loading validated airline data...</div>`;
loadData().catch(error => {
  console.error(error);
  dashboard.innerHTML = `<div class="notice">The validated data layer could not be loaded. Please refresh the page.</div>`;
});
