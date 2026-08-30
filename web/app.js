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
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}pp`;
}

function fmtUsdMillions(value) {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString()}m`;
}

function fmtUsdBillionsFromMillions(value) {
  return `$${(value / 1000).toFixed(2)}bn`;
}

function toneForVariance(value, favorablePositive = true) {
  const favorable = favorablePositive ? value >= 0 : value <= 0;
  return favorable ? "positive" : "negative";
}

function kpiCard([label, value, delta, tone]) {
  return `<article class="kpi-card"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div><div class="delta ${tone}">${delta}</div></article>`;
}

function sourceNotice() {
  return `<div class="notice">Official Delta actuals. Source: <a href="${actuals.source.url}" target="_blank" rel="noopener">Delta Air Lines Investor Relations, June Quarter 2026 results</a>. BTS remains the target pipeline source; automated BTS file retrieval is currently blocked by HTTP 403.</div>`;
}

function financialRow(key) {
  return actuals.financials_usd_millions[key];
}

function statisticRow(key) {
  return actuals.statistics[key];
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

  dashboard.innerHTML = `
    ${sourceNotice()}
    <section class="kpi-grid">${kpis.map(kpiCard).join("")}</section>
    <section class="two-col">
      <article class="panel">
        <h2>P&L Snapshot</h2>
        <p class="panel-subtitle">GAAP, USD millions unless shown otherwise</p>
        ${pnl.map(([label, value, delta]) => `<div class="metric-row"><span>${label}</span><strong>${value}</strong><span class="delta ${delta.startsWith("-") ? "negative" : "positive"}">${delta}</span></div>`).join("")}
      </article>
      <article class="panel">
        <h2>Operating Drivers</h2>
        <p class="panel-subtitle">Delta statistical summary, 2Q26</p>
        ${drivers.map(([label, value, width]) => `<div class="bar-row"><div class="bar-head"><span>${label}</span><strong>${value}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${Math.min(width, 100)}%"></div></div></div>`).join("")}
      </article>
    </section>`;
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

  dashboard.innerHTML = `${sourceNotice()}<article class="panel"><h2>Quarterly P&L and Cash Metrics</h2><p class="panel-subtitle">USD millions, GAAP actuals</p><div class="table-wrap"><table><thead><tr><th>Metric</th><th>2Q26</th><th>2Q25</th><th>Variance</th><th>Variance %</th></tr></thead><tbody>${rows.map(([name, item]) => {
    const v = variance(item.current, item.prior);
    const p = pctChange(item.current, item.prior);
    return `<tr><td>${name}</td><td>${item.current.toLocaleString()}</td><td>${item.prior.toLocaleString()}</td><td>${v > 0 ? "+" : ""}${v.toLocaleString()}</td><td class="delta ${toneForVariance(v, !name.includes("Expense") && !name.includes("Expenditures"))}">${fmtPct(p)}</td></tr>`;
  }).join("")}</tbody></table></div></article>`;
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
    ["Passenger PRASM", `${prasm.current.toFixed(2)}c`, `${fmtPct(pctChange(prasm.current, prasm.prior))} vs 2Q25`, "positive"],
    ["TRASM", `${trasm.current.toFixed(2)}c`, `${fmtPct(pctChange(trasm.current, trasm.prior))} vs 2Q25`, "positive"],
    ["CASM", `${casm.current.toFixed(2)}c`, `${fmtPct(pctChange(casm.current, casm.prior))} vs 2Q25`, "negative"],
  ];

  dashboard.innerHTML = `${sourceNotice()}<section class="kpi-grid">${cards.map(kpiCard).join("")}</section><article class="panel"><h2>Driver interpretation</h2><p class="panel-subtitle">2Q26 revenue growth was achieved on approximately 1% higher RPM and ASM, while yield and unit revenue increased materially.</p><div class="metric-row"><span>Capacity growth</span><strong>${fmtPct(pctChange(asm.current, asm.prior))}</strong><span>ASM</span></div><div class="metric-row"><span>Traffic growth</span><strong>${fmtPct(pctChange(rpm.current, rpm.prior))}</strong><span>RPM</span></div><div class="metric-row"><span>Yield movement</span><strong>${fmtPct(pctChange(yieldMetric.current, yieldMetric.prior))}</strong><span>Passenger mile yield</span></div></article>`;
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

  dashboard.innerHTML = `${sourceNotice()}<section class="kpi-grid">${cards.map(kpiCard).join("")}</section><section class="two-col"><article class="panel"><h2>Fuel bridge</h2><p class="panel-subtitle">Approximate price-volume decomposition using reported gallons and average price.</p><div class="metric-row"><span>Reported fuel expense change</span><strong>${fmtUsdMillions(variance(fuelExpense.current, fuelExpense.prior))}</strong><span>${fmtPct(pctChange(fuelExpense.current, fuelExpense.prior))}</span></div><div class="metric-row"><span>Approx. volume effect</span><strong>${fmtUsdMillions(volumeEffectApprox)}</strong><span>Gallons +${(gallons.current - gallons.prior).toFixed(0)}m</span></div><div class="metric-row"><span>Approx. price effect</span><strong>${fmtUsdMillions(priceEffectApprox)}</strong><span>$${(price.current - price.prior).toFixed(2)}/gal</span></div></article><article class="panel"><h2>Fleet economics status</h2><p class="panel-subtitle">Fuel and system unit metrics are real. Aircraft-type economics remain pending BTS P-5.2/B-43 file access.</p><div class="metric-row"><span>Current coverage</span><strong>System level</strong><span>Delta IR</span></div><div class="metric-row"><span>Next granularity</span><strong>Aircraft type / model</strong><span>BTS P-5.2 + B-43</span></div></article></section>`;
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

  dashboard.innerHTML = `${sourceNotice()}<article class="panel"><h2>Management Variance View</h2><p class="panel-subtitle">2Q26 versus 2Q25, explanations restricted to published financial and statistical evidence</p>${items.map(([metric, value, detail]) => `<div class="metric-row"><span><strong>${metric}</strong><br><small>${detail}</small></span><strong>${value}</strong><span></span></div>`).join("")}</article>`;
}

function renderControls() {
  dashboard.innerHTML = `${sourceNotice()}<section class="status-grid"><article class="status-card"><strong>Source provenance</strong><span>Official Delta Investor Relations release dated ${actuals.source.published}</span></article><article class="status-card"><strong>Financial reconciliation</strong><span>Operating revenue less operating expense equals reported operating income: ${financialRow("operating_revenue").current - financialRow("operating_expense").current === financialRow("operating_income").current ? "PASS" : "CHECK"}</span></article><article class="status-card"><strong>Period consistency</strong><span>2Q26 compared with 2Q25 for all published metrics</span></article><article class="status-card"><strong>Unit controls</strong><span>USD millions, cents, percentages, RPM/ASM millions and fuel gallons remain explicit</span></article><article class="status-card"><strong>BTS ingestion</strong><span>Pending: BTS currently returns HTTP 403 to automated file requests from the execution environments tested</span></article><article class="status-card"><strong>Publication gate</strong><span>No demo figures are used in the current dashboard</span></article></section>`;
}

const renderers = { overview: renderOverview, pnl: renderPnl, operations: renderOperations, fuel: renderFuel, variance: renderVariance, controls: renderControls };

function activate(view) {
  document.querySelectorAll(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === view));
  title.textContent = titles[view];
  if (actuals) renderers[view]();
}

document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => activate(button.dataset.view)));

async function loadActuals() {
  try {
    const response = await fetch("data/actuals.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    actuals = await response.json();
    activate("overview");
  } catch (error) {
    dashboard.innerHTML = `<div class="notice">Unable to load official actuals: ${error.message}</div>`;
  }
}

loadActuals();
