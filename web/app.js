const mockData = {
  airline: "DL",
  period: "2026-Q1",
  overview: {
    kpis: [
      ["Operating Revenue", "$15.8bn", "+5.4% vs prior", "positive"],
      ["Operating Margin", "11.6%", "+0.8pp vs prior", "positive"],
      ["Load Factor", "84.1%", "+1.2pp vs prior", "positive"],
      ["Fuel Cost / Gallon", "$2.41", "-6.9% vs prior", "positive"],
    ],
    pnl: [
      ["Passenger revenue", "$13.1bn", "+6.1%"],
      ["Other operating revenue", "$2.7bn", "+2.2%"],
      ["Operating expense", "$14.0bn", "+4.5%"],
      ["Operating profit", "$1.8bn", "+12.0%"],
    ],
    drivers: [
      ["Passengers", "47.8m", 82],
      ["Available seats", "56.8m", 89],
      ["Departures performed", "421k", 74],
      ["Aircraft hours", "1.18m", 68],
    ],
  },
  pnl: [
    ["Operating Revenue", 15800, 14990, 810, "5.4%"],
    ["Passenger Revenue", 13100, 12350, 750, "6.1%"],
    ["Freight Revenue", 420, 455, -35, "-7.7%"],
    ["Operating Expense", 13970, 13365, 605, "4.5%"],
    ["Flying Operations", 5120, 4930, 190, "3.9%"],
    ["Maintenance", 1880, 1765, 115, "6.5%"],
    ["Passenger Service", 2210, 2080, 130, "6.3%"],
    ["Operating Profit", 1830, 1625, 205, "12.6%"],
    ["Net Income", 1210, 1090, 120, "11.0%"],
  ],
  operations: [
    ["Passengers", "47.8m", "+5.8%", "positive"],
    ["Available Seats", "56.8m", "+4.2%", "positive"],
    ["Load Factor Proxy", "84.1%", "+1.2pp", "positive"],
    ["Departures Performed", "421k", "+3.9%", "positive"],
    ["Revenue / Passenger", "$274", "+0.3%", "positive"],
    ["Cost / Available Seat", "$246", "+0.3%", "negative"],
  ],
  fuel: [
    ["Fuel Cost", "$2.44bn", "-2.8%"],
    ["Fuel Consumption", "1.01bn gal", "+4.4%"],
    ["Fuel Cost / Gallon", "$2.41", "-6.9%"],
    ["Aircraft Operating Cost / Hour", "$11.8k", "+1.9%"],
  ],
  variance: [
    ["Operating Revenue", "+$810m", "Volume / capacity growth"],
    ["Fuel Cost", "-$70m", "Lower unit fuel price offset higher consumption"],
    ["Maintenance", "+$115m", "Higher flying activity and fleet maintenance"],
    ["Passenger Service", "+$130m", "Traffic growth and service activity"],
    ["Operating Profit", "+$205m", "Revenue growth ahead of operating cost growth"],
  ],
};

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

function kpiCard([label, value, delta, tone]) {
  return `<article class="kpi-card"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div><div class="delta ${tone}">${delta}</div></article>`;
}

function renderOverview() {
  dashboard.innerHTML = `
    <div class="notice">Demo figures only. The layout is ready for validated BTS analytical outputs.</div>
    <section class="kpi-grid">${mockData.overview.kpis.map(kpiCard).join("")}</section>
    <section class="two-col">
      <article class="panel">
        <h2>P&L Snapshot</h2>
        <p class="panel-subtitle">Quarterly financial performance</p>
        ${mockData.overview.pnl.map(([label, value, delta]) => `<div class="metric-row"><span>${label}</span><strong>${value}</strong><span class="delta ${delta.startsWith("-") ? "negative" : "positive"}">${delta}</span></div>`).join("")}
      </article>
      <article class="panel">
        <h2>Operating Drivers</h2>
        <p class="panel-subtitle">Relative activity indicators</p>
        ${mockData.overview.drivers.map(([label, value, width]) => `<div class="bar-row"><div class="bar-head"><span>${label}</span><strong>${value}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div></div>`).join("")}
      </article>
    </section>`;
}

function renderPnl() {
  dashboard.innerHTML = `<article class="panel"><h2>Quarterly P&L</h2><p class="panel-subtitle">USD millions, demo values</p><div class="table-wrap"><table><thead><tr><th>Metric</th><th>Current</th><th>Prior</th><th>Variance</th><th>Variance %</th></tr></thead><tbody>${mockData.pnl.map(([name, current, prior, variance, pct]) => `<tr><td>${name}</td><td>${current.toLocaleString()}</td><td>${prior.toLocaleString()}</td><td>${variance > 0 ? "+" : ""}${variance.toLocaleString()}</td><td class="delta ${variance >= 0 ? "positive" : "negative"}">${pct}</td></tr>`).join("")}</tbody></table></div></article>`;
}

function renderOperations() {
  dashboard.innerHTML = `<section class="kpi-grid">${mockData.operations.map(kpiCard).join("")}</section><article class="panel"><h2>Driver interpretation</h2><p class="panel-subtitle">The operating layer connects T-100 activity to P&L movements.</p><div class="metric-row"><span>Primary chain</span><strong>Capacity -> Traffic -> Revenue -> Cost</strong><span></span></div><div class="metric-row"><span>Stable entity key</span><strong>AirlineID</strong><span></span></div><div class="metric-row"><span>Stable airport keys</span><strong>OriginAirportID / DestAirportID</strong><span></span></div></article>`;
}

function renderFuel() {
  dashboard.innerHTML = `<section class="kpi-grid">${mockData.fuel.map(([label, value, delta]) => kpiCard([label, value, delta, delta.startsWith("-") ? "positive" : "neutral"])).join("")}</section><section class="two-col"><article class="panel"><h2>Fuel bridge</h2><p class="panel-subtitle">Price and consumption will be separated when real monthly P-12(a) data is loaded.</p><div class="metric-row"><span>Unit price</span><strong>Fuel cost / gallon</strong><span></span></div><div class="metric-row"><span>Volume</span><strong>Total gallons</strong><span></span></div><div class="metric-row"><span>Total cost</span><strong>Price x volume</strong><span></span></div></article><article class="panel"><h2>Fleet economics</h2><p class="panel-subtitle">P-5.2 and B-43 structure</p><div class="metric-row"><span>Aircraft cost</span><strong>Cost / air hour</strong><span></span></div><div class="metric-row"><span>Fleet dimension</span><strong>Aircraft type / model</strong><span></span></div><div class="metric-row"><span>Reference key</span><strong>Tail number</strong><span></span></div></article></section>`;
}

function renderVariance() {
  dashboard.innerHTML = `<article class="panel"><h2>Management Variance View</h2><p class="panel-subtitle">Current versus prior period with deterministic driver explanation</p>${mockData.variance.map(([metric, variance, driver]) => `<div class="metric-row"><span><strong>${metric}</strong><br><small>${driver}</small></span><strong>${variance}</strong><span></span></div>`).join("")}</article>`;
}

function renderControls() {
  dashboard.innerHTML = `<section class="status-grid"><article class="status-card"><strong>Financial reconciliation</strong><span>P-1.2 operating profit versus revenue less expense</span></article><article class="status-card"><strong>Schema validation</strong><span>Official field registry versus downloaded source columns</span></article><article class="status-card"><strong>Coverage gate</strong><span>Expected retention periods versus available periods</span></article><article class="status-card"><strong>Unit controls</strong><span>USD, USD thousands, gallons, hours and counts remain explicit</span></article><article class="status-card"><strong>Entity stability</strong><span>AirlineID and AirportID used instead of mutable display codes</span></article><article class="status-card"><strong>Publication gate</strong><span>Only validated compact outputs reach the public dashboard</span></article></section>`;
}

const renderers = { overview: renderOverview, pnl: renderPnl, operations: renderOperations, fuel: renderFuel, variance: renderVariance, controls: renderControls };

function activate(view) {
  document.querySelectorAll(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === view));
  title.textContent = titles[view];
  renderers[view]();
}

document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => activate(button.dataset.view)));
document.querySelector("#airline-select").addEventListener("change", event => { mockData.airline = event.target.value; activate(document.querySelector(".nav-item.active").dataset.view); });
document.querySelector("#period-select").addEventListener("change", event => { mockData.period = event.target.value; activate(document.querySelector(".nav-item.active").dataset.view); });

activate("overview");
