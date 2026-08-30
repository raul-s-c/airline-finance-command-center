const PAGE_META = {
  overview: {
    title: "Executive Overview",
    subtitle: "A decision-oriented view of financial performance, operating drivers and current risks.",
  },
  financials: {
    title: "Financial Performance",
    subtitle: "Eight quarters of Form 41 history, reconciled with the latest Delta management result.",
  },
  network: {
    title: "Network Explorer",
    subtitle: "Explore traffic, capacity, load factor, routes and airports across the retained T-100 window.",
  },
  fuel: {
    title: "Fuel Economics",
    subtitle: "Separate price and consumption effects using monthly P-12(a) fuel data.",
  },
  fleet: {
    title: "Fleet Explorer",
    subtitle: "Inspect active aircraft, fleet age, models and aircraft-type economics from B-43 and P-5.2.",
  },
  variance: {
    title: "Variance Lab",
    subtitle: "Choose a metric and period, then inspect the movement and its evidence-based explanation.",
  },
  journey: {
    title: "How the Data Works",
    subtitle: "A non-technical explanation of the refresh process, retention, controls and public data footprint.",
  },
};

const COLORS = {
  blue: "#0071e3",
  blueSoft: "rgba(0,113,227,.14)",
  dark: "#1d1d1f",
  muted: "#8e8e93",
  green: "#248a3d",
  red: "#d70015",
  amber: "#b45f06",
  line: "rgba(29,29,31,.10)",
  fill: "rgba(0,113,227,.09)",
};

const state = {
  view: "overview",
  range: 12,
  scope: "all",
  compare: "yoy",
  focus: "operating_margin",
  financialPeriod: null,
  networkPeriod: null,
  fuelPeriod: null,
  selectedRoute: null,
  selectedAircraftType: null,
  selectedFleetTail: null,
  fleetQuery: "",
  varianceDataset: "financial",
  varianceMetric: "operating_revenue_usd_m",
  variancePeriod: null,
  flowStep: 0,
};

let actuals = null;
let bts = null;
let charts = [];
let currentInsight = "";

const dashboard = document.querySelector("#dashboard-view");
const titleEl = document.querySelector("#view-title");
const subtitleEl = document.querySelector("#view-subtitle");
const freshnessEl = document.querySelector("#freshness-badge");
const footerRefreshEl = document.querySelector("#footer-refresh");
const sidebar = document.querySelector("#sidebar");

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pctChange(current, prior) {
  if (!Number.isFinite(current) || !Number.isFinite(prior) || prior === 0) return null;
  return ((current / prior) - 1) * 100;
}

function variance(current, prior) {
  if (!Number.isFinite(current) || !Number.isFinite(prior)) return null;
  return current - prior;
}

function fmtPct(value, digits = 1, sign = true) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  const prefix = sign && value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}%`;
}

function fmtPp(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}pp`;
}

function fmtUsdM(value, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: digits })}m`;
}

function fmtUsdBnFromM(value, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  const sign = value < 0 ? "-" : "";
  return `${sign}$${(Math.abs(value) / 1000).toFixed(digits)}bn`;
}

function fmtUsd(value, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function fmtCompact(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(digits)}tn`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(digits)}bn`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(digits)}m`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(digits)}k`;
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function fmtInteger(value) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return Math.round(value).toLocaleString();
}

function toneClass(value, favorablePositive = true) {
  if (value == null || !Number.isFinite(value) || Math.abs(value) < 1e-12) return "neutral";
  const favorable = favorablePositive ? value > 0 : value < 0;
  return favorable ? "positive" : "negative";
}

function arrowWord(value) {
  if (value == null || !Number.isFinite(value) || Math.abs(value) < .05) return "was broadly flat";
  return value > 0 ? "increased" : "decreased";
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function sum(items, key) {
  return items.reduce((acc, item) => acc + num(item[key]), 0);
}

function destroyCharts() {
  charts.forEach((chart) => {
    try { chart.destroy(); } catch (_) { }
  });
  charts = [];
}

function chartAvailable() {
  return typeof window.Chart !== "undefined";
}

function chartDefaults() {
  if (!chartAvailable()) return;
  Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif';
  Chart.defaults.color = "#6e6e73";
  Chart.defaults.borderColor = COLORS.line;
  Chart.defaults.animation.duration = 400;
}

function makeChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  if (!chartAvailable()) {
    canvas.parentElement.innerHTML = '<div class="chart-empty">Interactive chart library could not be loaded. Tables and commentary remain available.</div>';
    return null;
  }
  const chart = new Chart(canvas, config);
  charts.push(chart);
  return chart;
}

function commonChartOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(29,29,31,.94)",
        padding: 10,
        titleFont: { weight: "600" },
        bodyFont: { size: 11 },
        cornerRadius: 10,
      },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkip: true, font: { size: 9 } } },
      y: { grid: { color: "rgba(29,29,31,.06)" }, border: { display: false }, ticks: { font: { size: 9 } } },
    },
    ...extra,
  };
}

function getHashState() {
  const raw = location.hash.replace(/^#/, "");
  if (!raw) return;
  const params = new URLSearchParams(raw);
  const view = params.get("view");
  if (view && PAGE_META[view]) state.view = view;
  const range = Number(params.get("range"));
  if ([6, 12, 24].includes(range)) state.range = range;
  const scope = params.get("scope");
  if (["all", "domestic", "international"].includes(scope)) state.scope = scope;
  const compare = params.get("compare");
  if (["yoy", "prior"].includes(compare)) state.compare = compare;
  const focus = params.get("focus");
  if (focus) state.focus = focus;
}

function syncHash() {
  const params = new URLSearchParams();
  params.set("view", state.view);
  params.set("range", String(state.range));
  params.set("scope", state.scope);
  params.set("compare", state.compare);
  params.set("focus", state.focus);
  const next = `#${params.toString()}`;
  if (location.hash !== next) history.replaceState(null, "", next);
}

function setView(view) {
  if (!PAGE_META[view]) return;
  state.view = view;
  syncHash();
  render();
  sidebar.classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function btsReady() {
  return Boolean(bts?.metadata?.status === "official_bts_transtats");
}

function retained(items, count = state.range) {
  if (!Array.isArray(items)) return [];
  return items.slice(-Math.min(count, items.length));
}

function compareIndex(index, cadence) {
  const offset = state.compare === "prior" ? 1 : cadence === "monthly" ? 12 : 4;
  return Math.max(0, index - offset);
}

function compareLabel(cadence) {
  if (state.compare === "prior") return cadence === "monthly" ? "prior month" : "prior quarter";
  return "year ago";
}

function getFinancialSelection() {
  const data = btsReady() ? bts.p12_financials || [] : [];
  if (!data.length) return { data, current: null, prior: null, currentIndex: -1 };
  const requested = state.financialPeriod;
  let idx = requested ? data.findIndex((d) => d.period === requested) : data.length - 1;
  if (idx < 0) idx = data.length - 1;
  const priorIdx = compareIndex(idx, "quarterly");
  return { data, current: data[idx], prior: data[priorIdx], currentIndex: idx, priorIndex: priorIdx };
}

function getFuelSelection() {
  const data = btsReady() ? bts.p12a_fuel || [] : [];
  if (!data.length) return { data, current: null, prior: null, currentIndex: -1 };
  const requested = state.fuelPeriod;
  let idx = requested ? data.findIndex((d) => d.period === requested) : data.length - 1;
  if (idx < 0) idx = data.length - 1;
  const priorIdx = compareIndex(idx, "monthly");
  return { data, current: data[idx], prior: data[priorIdx], currentIndex: idx, priorIndex: priorIdx };
}

function networkRowForScope(row) {
  if (!row) return null;
  if (state.scope === "all") return { ...row };
  const scoped = row.scope?.[state.scope] || {};
  const asm = num(scoped.asm);
  const rpm = num(scoped.rpm);
  const seats = num(scoped.available_seats);
  const passengers = num(scoped.passengers);
  return {
    period: row.period,
    ...scoped,
    load_factor: asm ? rpm / asm : null,
    seat_load_factor: seats ? passengers / seats : null,
  };
}

function getNetworkSelection() {
  const all = btsReady() ? bts.t100_network?.history || [] : [];
  const data = retained(all, state.range).map(networkRowForScope);
  if (!data.length) return { data, current: null, prior: null, currentIndex: -1 };
  const requested = state.networkPeriod;
  let idx = requested ? data.findIndex((d) => d.period === requested) : data.length - 1;
  if (idx < 0) idx = data.length - 1;
  const priorIdx = compareIndex(idx, "monthly");
  return { data, current: data[idx], prior: data[priorIdx], currentIndex: idx, priorIndex: priorIdx };
}

function selectedRoutes() {
  if (!btsReady()) return [];
  const baseRoutes = bts.t100_network?.top_directional_routes || [];
  const historyMap = bts.t100_network?.route_history || null;
  const routes = baseRoutes
    .filter((route) => state.scope === "all" || route.scope === state.scope)
    .map((route) => {
      if (!historyMap) return { ...route };
      const key = `${route.origin}-${route.destination}|${route.scope}`;
      const rows = retained(historyMap[key] || [], state.range);
      if (!rows.length) return { ...route };
      const aggregated = {
        passengers: sum(rows, "passengers"),
        available_seats: sum(rows, "available_seats"),
        departures_performed: sum(rows, "departures_performed"),
        air_time_minutes: sum(rows, "air_time_minutes"),
        rpm: sum(rows, "rpm"),
        asm: sum(rows, "asm"),
      };
      return { ...route, ...aggregated, load_factor: ratio(aggregated.rpm, aggregated.asm) };
    });
  return routes.sort((a, b) => num(b.passengers) - num(a.passengers));
}

function selectedAircraftMix() {
  if (!btsReady()) return [];
  const base = bts.t100_network?.aircraft_type_mix || [];
  const historyMap = bts.t100_network?.aircraft_type_history || null;
  return base.map((item) => {
    if (!historyMap) return { ...item };
    const rows = retained(historyMap[String(item.aircraft_type)] || [], state.range);
    if (!rows.length) return { ...item };
    return {
      ...item,
      passengers: sum(rows, "passengers"),
      available_seats: sum(rows, "available_seats"),
      departures_performed: sum(rows, "departures_performed"),
      air_time_minutes: sum(rows, "air_time_minutes"),
      rpm: sum(rows, "rpm"),
      asm: sum(rows, "asm"),
    };
  }).sort((a, b) => num(b.passengers) - num(a.passengers));
}

function financialCommentary(current, prior) {
  if (!current || !prior) return { headline: "No comparable period", body: "The selected period does not have enough retained history for this comparison.", bullets: [] };
  const revenueChange = pctChange(current.operating_revenue_usd_m, prior.operating_revenue_usd_m);
  const opexChange = pctChange(current.operating_expense_usd_m, prior.operating_expense_usd_m);
  const marginDelta = (num(current.operating_margin) - num(prior.operating_margin)) * 100;
  const components = [
    ["Flying operations", num(current.flying_operations_expense_usd_m) - num(prior.flying_operations_expense_usd_m)],
    ["Maintenance", num(current.maintenance_expense_usd_m) - num(prior.maintenance_expense_usd_m)],
    ["Passenger service", num(current.passenger_service_expense_usd_m) - num(prior.passenger_service_expense_usd_m)],
    ["Depreciation and amortization", num(current.depreciation_amortization_usd_m) - num(prior.depreciation_amortization_usd_m)],
  ].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const biggest = components[0];
  const headline = marginDelta >= 0 ? "Margin expanded in the selected comparison" : "Margin compressed in the selected comparison";
  const body = `Operating revenue ${arrowWord(revenueChange)} ${fmtPct(Math.abs(revenueChange), 1, false)}, while operating expense ${arrowWord(opexChange)} ${fmtPct(Math.abs(opexChange), 1, false)}. Operating margin moved ${fmtPp(marginDelta)}.`;
  const bullets = [
    `${biggest[0]} was the largest tracked operating-cost movement at ${fmtUsdM(biggest[1])}.`,
    `Passenger revenue changed ${fmtPct(pctChange(current.passenger_revenue_usd_m, prior.passenger_revenue_usd_m))}.`,
    `The comparison is ${current.period} versus ${prior.period}.`,
  ];
  return { headline, body, bullets };
}

function networkCommentary(current, prior) {
  if (!current || !prior) return { headline: "No comparable network period", body: "Select another period or comparison mode.", bullets: [] };
  const pax = pctChange(num(current.passengers), num(prior.passengers));
  const capacity = pctChange(num(current.asm), num(prior.asm));
  const rpm = pctChange(num(current.rpm), num(prior.rpm));
  const lfDelta = (num(current.load_factor) - num(prior.load_factor)) * 100;
  const demandVsCapacity = (pax ?? 0) - (capacity ?? 0);
  const headline = demandVsCapacity >= 0 ? "Demand kept pace with or outgrew capacity" : "Capacity grew faster than passenger demand";
  const body = `Passengers ${arrowWord(pax)} ${fmtPct(Math.abs(pax), 1, false)} and ASM ${arrowWord(capacity)} ${fmtPct(Math.abs(capacity), 1, false)}. Distance-weighted load factor moved ${fmtPp(lfDelta)}.`;
  const bullets = [
    `RPM changed ${fmtPct(rpm)}, providing the distance-weighted traffic view.`,
    `${state.scope === "all" ? "Domestic and international activity are combined." : `The view is filtered to ${state.scope} flying.`}`,
    `Current period is ${current.period}; comparator is ${prior.period}.`,
  ];
  return { headline, body, bullets };
}

function fuelCommentary(current, prior) {
  if (!current || !prior) return { headline: "No comparable fuel period", body: "Select another period or comparison mode.", bullets: [] };
  const costChange = pctChange(num(current.fuel_cost_usd), num(prior.fuel_cost_usd));
  const gallonsChange = pctChange(num(current.fuel_gallons), num(prior.fuel_gallons));
  const priceChange = pctChange(num(current.fuel_cost_per_gallon_usd), num(prior.fuel_cost_per_gallon_usd));
  const volumeEffect = (num(current.fuel_gallons) - num(prior.fuel_gallons)) * num(prior.fuel_cost_per_gallon_usd);
  const priceEffect = (num(current.fuel_cost_per_gallon_usd) - num(prior.fuel_cost_per_gallon_usd)) * num(current.fuel_gallons);
  const priceDominant = Math.abs(priceEffect) >= Math.abs(volumeEffect);
  const headline = priceDominant ? "Fuel price is the larger modeled cost driver" : "Fuel consumption is the larger modeled cost driver";
  const body = `Total fuel cost ${arrowWord(costChange)} ${fmtPct(Math.abs(costChange), 1, false)}. Unit fuel cost ${arrowWord(priceChange)} ${fmtPct(Math.abs(priceChange), 1, false)}, while gallons ${arrowWord(gallonsChange)} ${fmtPct(Math.abs(gallonsChange), 1, false)}.`;
  const bullets = [
    `Approximate price effect: ${fmtUsdM(priceEffect / 1e6, 0)}.`,
    `Approximate volume effect: ${fmtUsdM(volumeEffect / 1e6, 0)}.`,
    `The bridge is deterministic and uses reported total gallons and reported average cost per gallon.`,
  ];
  return { headline, body, bullets };
}

function fleetCommentary() {
  if (!btsReady()) return { headline: "Fleet data unavailable", body: "B-43 has not loaded.", bullets: [] };
  const fleet = bts.b43_fleet;
  const models = fleet.model_mix || [];
  const top = models[0];
  const older = (fleet.aircraft || []).filter((a) => a.manufacture_year && fleet.inventory_year - a.manufacture_year >= 20).length;
  const olderShare = fleet.active_aircraft_count ? older / fleet.active_aircraft_count * 100 : 0;
  return {
    headline: `${fmtInteger(fleet.active_aircraft_count)} active aircraft create a highly diversified fleet`,
    body: `Average fleet age is ${num(fleet.average_age_years).toFixed(1)} years. The largest model family in B-43 is ${top ? `${cleanManufacturer(top.manufacturer)} ${top.model}` : "not available"}.`,
    bullets: [
      `${older} aircraft are at least 20 years old, representing ${olderShare.toFixed(1)}% of the active inventory.`,
      `The model mix contains ${models.length} distinct manufacturer-model combinations.`,
      `B-43 is an annual inventory snapshot, so fleet status is intentionally not treated as monthly data.`,
    ],
  };
}

function cleanManufacturer(value) {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("boeing")) return "Boeing";
  if (raw.includes("airbus")) return "Airbus";
  if (raw.includes("bombard")) return "Bombardier";
  if (raw.includes("embraer")) return "Embraer";
  if (!value) return "Unknown";
  return String(value).replace(/company/ig, "").replace(/industries/ig, "").trim();
}

function metricComment(metric, current, prior, favorablePositive = true) {
  const delta = num(current) - num(prior);
  const pct = pctChange(num(current), num(prior));
  const direction = delta >= 0 ? "up" : "down";
  const favorability = toneClass(delta, favorablePositive) === "positive" ? "favorable" : "unfavorable";
  return `${metric} is ${direction} ${fmtPct(Math.abs(pct), 1, false)} versus the comparator. On its own this is ${favorability}; use the driver view to judge whether the movement is structural or timing-related.`;
}

function kpiCard(label, value, delta, tone = "neutral", note = "", focus = null) {
  return `<article class="kpi-card ${focus ? "clickable" : ""}" ${focus ? `data-focus="${esc(focus)}"` : ""}>
    <div class="kpi-label">${esc(label)}</div>
    <div class="kpi-value">${value}</div>
    <div class="delta ${tone}">${delta}</div>
    ${note ? `<div class="kpi-note">${esc(note)}</div>` : ""}
  </article>`;
}

function insightCard(insight, sourceLabel = "Dynamic management commentary") {
  currentInsight = `${insight.headline}\n\n${insight.body}${insight.bullets?.length ? `\n\n${insight.bullets.join("\n")}` : ""}`;
  return `<article class="insight-card">
    <div class="insight-kicker">${esc(sourceLabel)}</div>
    <h2>${esc(insight.headline)}</h2>
    <p>${esc(insight.body)}</p>
    ${insight.bullets?.length ? `<ul class="insight-list">${insight.bullets.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : ""}
  </article>`;
}

function dualSourceNotice() {
  if (!actuals) return "";
  const irLink = `<a href="${esc(actuals.source.url)}" target="_blank" rel="noopener">Delta Investor Relations</a>`;
  if (!btsReady()) return `<div class="notice">Latest management result from ${irLink}. The BTS analytical layer is not currently available.</div>`;
  const finLatest = bts.p12_financials?.at(-1)?.period || "n/a";
  const netLatest = bts.t100_network?.history?.at(-1)?.period || "n/a";
  return `<div class="notice">Two official lenses are used deliberately: ${irLink} for the latest published management result, and U.S. DOT BTS TranStats for detailed historical finance, fuel, network and fleet analysis. Latest BTS finance: ${esc(finLatest)}. Latest BTS network: ${esc(netLatest)}.</div>`;
}

function renderOverview() {
  if (!actuals) return;
  const rev = actuals.financials_usd_millions.operating_revenue;
  const opIncome = actuals.financials_usd_millions.operating_income;
  const netIncome = actuals.financials_usd_millions.net_income;
  const margin = rev.current ? opIncome.current / rev.current * 100 : 0;
  const priorMargin = rev.prior ? opIncome.prior / rev.prior * 100 : 0;
  const marginDelta = margin - priorMargin;
  const network = getNetworkSelection();
  const fuel = getFuelSelection();
  const insight = btsReady() ? networkCommentary(network.current, network.prior) : {
    headline: "Revenue is higher, but cost growth is compressing margin",
    body: `Delta reported ${fmtPct(pctChange(rev.current, rev.prior))} operating revenue growth while operating income changed ${fmtPct(pctChange(opIncome.current, opIncome.prior))}.`,
    bullets: [],
  };

  const heroMap = {
    operating_margin: ["Latest published operating margin", `${margin.toFixed(1)}%`, fmtPp(marginDelta), toneClass(marginDelta), "Delta IR 2Q26 versus 2Q25"],
    revenue: ["Latest published operating revenue", fmtUsdBnFromM(rev.current), fmtPct(pctChange(rev.current, rev.prior)), toneClass(rev.current-rev.prior), "Delta IR 2Q26 versus 2Q25"],
    passengers: ["Latest BTS monthly passengers", fmtCompact(network.current?.passengers), fmtPct(pctChange(num(network.current?.passengers),num(network.prior?.passengers))), toneClass(num(network.current?.passengers)-num(network.prior?.passengers)), `${network.current?.period || "n/a"} versus ${network.prior?.period || "n/a"}`],
    load_factor: ["Latest BTS load factor", `${(num(network.current?.load_factor)*100).toFixed(1)}%`, fmtPp((num(network.current?.load_factor)-num(network.prior?.load_factor))*100), toneClass(num(network.current?.load_factor)-num(network.prior?.load_factor)), `${network.current?.period || "n/a"} versus ${network.prior?.period || "n/a"}`],
    fuel_price: ["Latest BTS fuel cost per gallon", fmtUsd(num(fuel.current?.fuel_cost_per_gallon_usd)), fmtPct(pctChange(num(fuel.current?.fuel_cost_per_gallon_usd),num(fuel.prior?.fuel_cost_per_gallon_usd))), toneClass(num(fuel.current?.fuel_cost_per_gallon_usd)-num(fuel.prior?.fuel_cost_per_gallon_usd),false), `${fuel.current?.period || "n/a"} versus ${fuel.prior?.period || "n/a"}`],
  };
  const hero = heroMap[state.focus] || heroMap.operating_margin;

  dashboard.innerHTML = `
    <section class="hero-grid">
      <article class="hero-card">
        <div class="hero-label">${esc(hero[0])}</div>
        <div class="hero-value">${hero[1]}</div>
        <div class="hero-delta ${hero[3]}">${hero[2]}</div>
        <p class="hero-copy">${esc(hero[4])}. The focus selector changes this headline without changing the underlying source logic: current management actuals come from Delta IR and granular analytical history comes from BTS.</p>
      </article>
      ${insightCard(insight)}
    </section>

    <section class="kpi-grid">
      ${kpiCard("Operating revenue", fmtUsdBnFromM(rev.current), `${fmtPct(pctChange(rev.current, rev.prior))} vs 2Q25`, toneClass(rev.current - rev.prior), "Delta IR", "revenue")}
      ${kpiCard("Net income", fmtUsdBnFromM(netIncome.current), `${fmtPct(pctChange(netIncome.current, netIncome.prior))} vs 2Q25`, toneClass(netIncome.current - netIncome.prior), "Delta IR")}
      ${kpiCard("Passengers", fmtCompact(network.current?.passengers), `${fmtPct(pctChange(num(network.current?.passengers), num(network.prior?.passengers)))} vs ${compareLabel("monthly")}`, toneClass(num(network.current?.passengers) - num(network.prior?.passengers)), network.current?.period || "BTS", "passengers")}
      ${kpiCard("Fuel cost / gallon", fmtUsd(num(fuel.current?.fuel_cost_per_gallon_usd)), `${fmtPct(pctChange(num(fuel.current?.fuel_cost_per_gallon_usd), num(fuel.prior?.fuel_cost_per_gallon_usd)))} vs ${compareLabel("monthly")}`, toneClass(num(fuel.current?.fuel_cost_per_gallon_usd) - num(fuel.prior?.fuel_cost_per_gallon_usd), false), fuel.current?.period || "BTS", "fuel_price")}
    </section>

    <section class="two-col">
      <article class="panel">
        <div class="panel-header"><div><h2>Financial trend</h2><p class="panel-subtitle">BTS Form 41 operating revenue and margin</p></div><span class="data-pill live">8 quarters</span></div>
        <div class="chart-shell"><canvas id="overview-financial-chart"></canvas></div>
      </article>
      <article class="panel">
        <div class="panel-header"><div><h2>Traffic and capacity</h2><p class="panel-subtitle">T-100 passengers and available seats, ${esc(state.scope)} network</p></div><span class="data-pill live">${state.range} months</span></div>
        <div class="chart-shell"><canvas id="overview-network-chart"></canvas></div>
      </article>
    </section>
    ${dualSourceNotice()}
  `;

  if (btsReady()) {
    const fin = bts.p12_financials || [];
    makeChart("overview-financial-chart", {
      type: "bar",
      data: {
        labels: fin.map((d) => d.period),
        datasets: [
          { label: "Revenue $m", data: fin.map((d) => d.operating_revenue_usd_m), backgroundColor: COLORS.blueSoft, borderColor: COLORS.blue, borderWidth: 1, borderRadius: 7, yAxisID: "y" },
          { type: "line", label: "Margin %", data: fin.map((d) => num(d.operating_margin) * 100), borderColor: COLORS.dark, pointRadius: 2, tension: .35, yAxisID: "y1" },
        ],
      },
      options: commonChartOptions({
        plugins: { legend: { display: true, labels: { boxWidth: 8, usePointStyle: true, font: { size: 9 } } } },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 9 } } },
          y: { position: "left", grid: { color: "rgba(29,29,31,.05)" }, border: { display: false }, ticks: { callback: (v) => `$${(v/1000).toFixed(0)}bn`, font: { size: 9 } } },
          y1: { position: "right", grid: { display: false }, border: { display: false }, ticks: { callback: (v) => `${v}%`, font: { size: 9 } } },
        },
      }),
    });

    makeChart("overview-network-chart", {
      type: "line",
      data: {
        labels: network.data.map((d) => d.period),
        datasets: [
          { label: "Passengers", data: network.data.map((d) => d.passengers), borderColor: COLORS.blue, backgroundColor: COLORS.fill, fill: true, tension: .35, pointRadius: 1, yAxisID: "y" },
          { label: "Seats", data: network.data.map((d) => d.available_seats), borderColor: COLORS.muted, borderDash: [4,4], tension: .35, pointRadius: 0, yAxisID: "y" },
        ],
      },
      options: commonChartOptions({ plugins: { legend: { display: true, labels: { boxWidth: 8, usePointStyle: true, font: { size: 9 } } } } }),
    });
  }
}

function financialPeriodOptions(data, selected) {
  return data.slice().reverse().map((item) => `<option value="${esc(item.period)}" ${item.period === selected ? "selected" : ""}>${esc(item.period)}</option>`).join("");
}

function renderFinancials() {
  if (!btsReady()) return renderUnavailable("The BTS Form 41 layer is not available.");
  const sel = getFinancialSelection();
  if (!state.financialPeriod) state.financialPeriod = sel.current?.period || null;
  const current = sel.current;
  const prior = sel.prior;
  const insight = financialCommentary(current, prior);
  const marginDelta = (num(current?.operating_margin) - num(prior?.operating_margin)) * 100;
  const revenueDelta = num(current?.operating_revenue_usd_m) - num(prior?.operating_revenue_usd_m);
  const opexDelta = num(current?.operating_expense_usd_m) - num(prior?.operating_expense_usd_m);
  const profitDelta = num(current?.operating_profit_loss_usd_m) - num(prior?.operating_profit_loss_usd_m);

  const commentRows = [
    ["Operating revenue", "operating_revenue_usd_m", true],
    ["Operating expense", "operating_expense_usd_m", false],
    ["Operating profit", "operating_profit_loss_usd_m", true],
    ["Passenger revenue", "passenger_revenue_usd_m", true],
    ["Flying operations", "flying_operations_expense_usd_m", false],
    ["Maintenance", "maintenance_expense_usd_m", false],
    ["Passenger service", "passenger_service_expense_usd_m", false],
  ];

  dashboard.innerHTML = `
    <section class="filter-context panel">
      <div class="panel-header">
        <div><h2>Selected quarter</h2><p class="panel-subtitle">Change the quarter to recalculate every card, variance and comment below.</p></div>
        <select class="table-search" id="financial-period-select">${financialPeriodOptions(sel.data, current?.period)}</select>
      </div>
    </section>
    <section class="kpi-grid">
      ${kpiCard("Operating revenue", fmtUsdBnFromM(current?.operating_revenue_usd_m), `${fmtUsdM(revenueDelta)} vs ${prior?.period}`, toneClass(revenueDelta), current?.period)}
      ${kpiCard("Operating expense", fmtUsdBnFromM(current?.operating_expense_usd_m), `${fmtUsdM(opexDelta)} vs ${prior?.period}`, toneClass(opexDelta, false), current?.period)}
      ${kpiCard("Operating profit", fmtUsdBnFromM(current?.operating_profit_loss_usd_m), `${fmtUsdM(profitDelta)} vs ${prior?.period}`, toneClass(profitDelta), current?.period)}
      ${kpiCard("Operating margin", `${(num(current?.operating_margin) * 100).toFixed(1)}%`, `${fmtPp(marginDelta)} vs ${prior?.period}`, toneClass(marginDelta), current?.period)}
    </section>
    <section class="two-col">
      <article class="panel">
        <div class="panel-header"><div><h2>Eight-quarter performance</h2><p class="panel-subtitle">Revenue, operating expense and operating margin</p></div><span class="data-pill live">BTS P-1.2</span></div>
        <div class="chart-shell tall"><canvas id="financial-trend-chart"></canvas></div>
      </article>
      ${insightCard(insight)}
    </section>
    <article class="panel flush">
      <div class="panel-header" style="padding:20px 20px 0"><div><h2>Variance table with dynamic commentary</h2><p class="panel-subtitle">Comments are recalculated from the selected quarter and comparison mode.</p></div></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Metric</th><th>${esc(current?.period)}</th><th>${esc(prior?.period)}</th><th>Variance</th><th>Variance %</th><th style="text-align:left;min-width:320px">Comment</th></tr></thead>
          <tbody>${commentRows.map(([label, key, favorable]) => {
            const c = num(current?.[key]);
            const p = num(prior?.[key]);
            const v = c - p;
            return `<tr><td>${esc(label)}</td><td>${fmtUsdM(c)}</td><td>${fmtUsdM(p)}</td><td class="${toneClass(v, favorable)}">${fmtUsdM(v)}</td><td class="${toneClass(v, favorable)}">${fmtPct(pctChange(c,p))}</td><td style="text-align:left;white-space:normal;min-width:320px;color:#6e6e73;line-height:1.45">${esc(metricComment(label, c, p, favorable))}</td></tr>`;
          }).join("")}</tbody>
        </table>
      </div>
    </article>
    ${dualSourceNotice()}
  `;

  const fin = sel.data;
  makeChart("financial-trend-chart", {
    type: "bar",
    data: {
      labels: fin.map((d) => d.period),
      datasets: [
        { label: "Revenue", data: fin.map((d) => d.operating_revenue_usd_m), backgroundColor: "rgba(0,113,227,.20)", borderColor: COLORS.blue, borderWidth: 1, borderRadius: 7, yAxisID: "y" },
        { label: "Expense", data: fin.map((d) => d.operating_expense_usd_m), backgroundColor: "rgba(110,110,115,.15)", borderColor: COLORS.muted, borderWidth: 1, borderRadius: 7, yAxisID: "y" },
        { type: "line", label: "Operating margin", data: fin.map((d) => num(d.operating_margin) * 100), borderColor: COLORS.dark, backgroundColor: COLORS.dark, pointRadius: 3, tension: .35, yAxisID: "y1" },
      ],
    },
    options: commonChartOptions({
      plugins: { legend: { display: true, labels: { boxWidth: 8, usePointStyle: true, font: { size: 9 } } } },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 9 } } },
        y: { grid: { color: "rgba(29,29,31,.05)" }, border: { display: false }, ticks: { callback: (v) => `$${(v/1000).toFixed(0)}bn`, font: { size: 9 } } },
        y1: { position: "right", grid: { display: false }, border: { display: false }, ticks: { callback: (v) => `${v}%`, font: { size: 9 } } },
      },
    }),
  });

  document.getElementById("financial-period-select")?.addEventListener("change", (event) => {
    state.financialPeriod = event.target.value;
    render();
  });
}

function routeLabel(route) {
  return `${route.origin || "?"} to ${route.destination || "?"}`;
}

function routeInsight(route, routes) {
  if (!route) return { headline: "Select a route to inspect it", body: "Click a bar or route row to recalculate the detail panel.", bullets: [] };
  const totalPassengers = sum(routes, "passengers");
  const share = totalPassengers ? num(route.passengers) / totalPassengers * 100 : 0;
  const lf = ratio(num(route.rpm), num(route.asm));
  const paxPerDeparture = ratio(num(route.passengers), num(route.departures_performed));
  return {
    headline: `${routeLabel(route)} carries ${share.toFixed(1)}% of passengers in the displayed top-route set`,
    body: `The route recorded ${fmtCompact(num(route.passengers))} passengers and ${fmtInteger(num(route.departures_performed))} performed departures in the retained network window.`,
    bullets: [
      `Distance-weighted load factor: ${lf == null ? "n/a" : `${(lf * 100).toFixed(1)}%`}.`,
      `Average passengers per performed departure: ${paxPerDeparture == null ? "n/a" : paxPerDeparture.toFixed(1)}.`,
      `Scope: ${route.scope || "all"}. Route totals are aggregated only over the retained source window.`,
    ],
  };
}

function renderNetwork() {
  if (!btsReady()) return renderUnavailable("The BTS T-100 layer is not available.");
  const sel = getNetworkSelection();
  if (!state.networkPeriod) state.networkPeriod = sel.current?.period || null;
  const insight = networkCommentary(sel.current, sel.prior);
  const routes = selectedRoutes();
  const selectedRoute = routes.find((r) => routeLabel(r) === state.selectedRoute) || routes[0] || null;
  if (selectedRoute && !state.selectedRoute) state.selectedRoute = routeLabel(selectedRoute);
  const routeComment = routeInsight(selectedRoute, routes.slice(0, 15));
  const lfDelta = (num(sel.current?.load_factor) - num(sel.prior?.load_factor)) * 100;
  const aircraftMix = selectedAircraftMix();
  const airports = (bts.t100_network?.top_airports || []).slice(0, 10);

  dashboard.innerHTML = `
    <section class="kpi-grid">
      ${kpiCard("Passengers", fmtCompact(sel.current?.passengers), `${fmtPct(pctChange(num(sel.current?.passengers), num(sel.prior?.passengers)))} vs ${sel.prior?.period}`, toneClass(num(sel.current?.passengers)-num(sel.prior?.passengers)), sel.current?.period)}
      ${kpiCard("Available seats", fmtCompact(sel.current?.available_seats), `${fmtPct(pctChange(num(sel.current?.available_seats), num(sel.prior?.available_seats)))} vs ${sel.prior?.period}`, "neutral", state.scope)}
      ${kpiCard("Load factor", `${(num(sel.current?.load_factor)*100).toFixed(1)}%`, `${fmtPp(lfDelta)} vs ${sel.prior?.period}`, toneClass(lfDelta), "distance weighted")}
      ${kpiCard("Departures", fmtCompact(sel.current?.departures_performed), `${fmtPct(pctChange(num(sel.current?.departures_performed), num(sel.prior?.departures_performed)))} vs ${sel.prior?.period}`, toneClass(num(sel.current?.departures_performed)-num(sel.prior?.departures_performed)), "performed")}
    </section>
    <section class="two-col">
      <article class="panel">
        <div class="panel-header"><div><h2>Traffic, capacity and load factor</h2><p class="panel-subtitle">${state.range} retained months, ${esc(state.scope)} network</p></div><span class="data-pill live">T-100</span></div>
        <div class="chart-shell tall"><canvas id="network-trend-chart"></canvas></div>
      </article>
      ${insightCard(insight)}
    </section>
    <section class="two-col">
      <article class="panel">
        <div class="panel-header"><div><h2>Top directional routes</h2><p class="panel-subtitle">Click a bar to inspect a route</p></div><span class="data-pill">Top ${Math.min(routes.length, 12)}</span></div>
        <div class="chart-shell tall"><canvas id="route-chart"></canvas></div>
      </article>
      ${insightCard(routeComment, "Selected route commentary")}
    </section>
    <section class="two-col">
      <article class="panel"><div class="panel-header"><div><h2>Aircraft type activity</h2><p class="panel-subtitle">Passenger activity by T-100 aircraft type over the selected history window</p></div></div><div class="chart-shell"><canvas id="network-aircraft-chart"></canvas></div></article>
      <article class="panel"><div class="panel-header"><div><h2>Largest airports</h2><p class="panel-subtitle">Passenger segment ends across the retained BTS network window</p></div></div>${airports.map((airport,index)=>`<div class="metric-row"><span>${index+1}. ${esc(airport.airport)}</span><strong>${fmtCompact(num(airport.passengers_segment_ends))}</strong><span>segment ends</span></div>`).join("")}</article>
    </section>
    <article class="panel flush">
      <div class="panel-header" style="padding:20px 20px 0"><div><h2>Route explorer</h2><p class="panel-subtitle">Sorted by passengers across the active history filter.</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Route</th><th>Scope</th><th>Passengers</th><th>Seats</th><th>Load factor</th><th>Departures</th></tr></thead><tbody>${routes.slice(0, 30).map((route) => {
        const label = routeLabel(route);
        const lf = ratio(num(route.rpm), num(route.asm));
        return `<tr class="selectable ${label === state.selectedRoute ? "selected" : ""}" data-route="${esc(label)}"><td>${esc(label)}</td><td>${esc(route.scope)}</td><td>${fmtInteger(num(route.passengers))}</td><td>${fmtInteger(num(route.available_seats))}</td><td>${lf == null ? "n/a" : `${(lf*100).toFixed(1)}%`}</td><td>${fmtInteger(num(route.departures_performed))}</td></tr>`;
      }).join("")}</tbody></table></div>
    </article>
  `;

  makeChart("network-trend-chart", {
    type: "line",
    data: {
      labels: sel.data.map((d) => d.period),
      datasets: [
        { label: "Passengers", data: sel.data.map((d) => d.passengers), borderColor: COLORS.blue, backgroundColor: COLORS.fill, fill: true, tension: .35, pointRadius: 1, yAxisID: "y" },
        { label: "ASM", data: sel.data.map((d) => d.asm), borderColor: COLORS.muted, borderDash: [5,4], tension: .35, pointRadius: 0, yAxisID: "y1" },
        { label: "Load factor", data: sel.data.map((d) => num(d.load_factor)*100), borderColor: COLORS.dark, tension: .35, pointRadius: 1, yAxisID: "y2" },
      ],
    },
    options: commonChartOptions({
      plugins: { legend: { display: true, labels: { boxWidth: 8, usePointStyle: true, font: { size: 9 } } } },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 8 } },
        y: { position: "left", grid: { color: "rgba(29,29,31,.05)" }, border: { display: false }, ticks: { callback: (v) => fmtCompact(v,0), font:{size:9} } },
        y1: { display: false },
        y2: { position: "right", min: 0, max: 100, grid: { display: false }, border: { display: false }, ticks: { callback: (v) => `${v}%`, font:{size:9} } },
      },
    }),
  });

  const topRoutes = routes.slice(0, 12);
  makeChart("route-chart", {
    type: "bar",
    data: { labels: topRoutes.map((r) => `${r.origin}-${r.destination}`), datasets: [{ data: topRoutes.map((r) => r.passengers), backgroundColor: topRoutes.map((r) => routeLabel(r) === state.selectedRoute ? COLORS.blue : "rgba(0,113,227,.18)"), borderRadius: 7 }] },
    options: commonChartOptions({
      indexAxis: "y",
      onClick: (_, elements) => {
        if (!elements.length) return;
        const route = topRoutes[elements[0].index];
        state.selectedRoute = routeLabel(route);
        render();
      },
      scales: {
        x: { grid: { color: "rgba(29,29,31,.05)" }, border: { display: false }, ticks: { callback: (v) => fmtCompact(v,0), font:{size:9} } },
        y: { grid: { display: false }, border: { display: false }, ticks: { font:{size:9} } },
      },
    }),
  });

  makeChart("network-aircraft-chart", {
    type: "bar",
    data: { labels: aircraftMix.slice(0,10).map((d)=>String(d.aircraft_type)), datasets: [{ data: aircraftMix.slice(0,10).map((d)=>d.passengers), backgroundColor: "rgba(0,113,227,.18)", borderColor: COLORS.blue, borderWidth: 1, borderRadius: 7 }] },
    options: commonChartOptions({ scales: { x:{grid:{display:false},border:{display:false},ticks:{font:{size:9}}}, y:{grid:{color:"rgba(29,29,31,.05)"},border:{display:false},ticks:{callback:(v)=>fmtCompact(v,0),font:{size:9}}} } }),
  });

  document.querySelectorAll("[data-route]").forEach((row) => row.addEventListener("click", () => {
    state.selectedRoute = row.dataset.route;
    render();
  }));
}

function renderFuel() {
  if (!btsReady()) return renderUnavailable("The BTS P-12(a) fuel layer is not available.");
  const sel = getFuelSelection();
  if (!state.fuelPeriod) state.fuelPeriod = sel.current?.period || null;
  const current = sel.current;
  const prior = sel.prior;
  const insight = fuelCommentary(current, prior);
  const costVar = num(current?.fuel_cost_usd) - num(prior?.fuel_cost_usd);
  const gallonVar = num(current?.fuel_gallons) - num(prior?.fuel_gallons);
  const priceVar = num(current?.fuel_cost_per_gallon_usd) - num(prior?.fuel_cost_per_gallon_usd);
  const volumeEffect = gallonVar * num(prior?.fuel_cost_per_gallon_usd);
  const priceEffect = priceVar * num(current?.fuel_gallons);
  const history = retained(sel.data, state.range);
  const intlShare = ratio(num(current?.international_fuel_gallons),num(current?.fuel_gallons));

  dashboard.innerHTML = `
    <section class="filter-context panel">
      <div class="panel-header"><div><h2>Selected month</h2><p class="panel-subtitle">All commentary and the price-volume bridge recalculate with this selection.</p></div><select class="table-search" id="fuel-period-select">${sel.data.slice().reverse().map((item) => `<option value="${esc(item.period)}" ${item.period === current?.period ? "selected" : ""}>${esc(item.period)}</option>`).join("")}</select></div>
    </section>
    <section class="kpi-grid">
      ${kpiCard("Fuel cost", fmtUsdBnFromM(num(current?.fuel_cost_usd)/1e6), `${fmtUsdM(costVar/1e6)} vs ${prior?.period}`, toneClass(costVar,false), current?.period)}
      ${kpiCard("Gallons", fmtCompact(current?.fuel_gallons), `${fmtPct(pctChange(num(current?.fuel_gallons),num(prior?.fuel_gallons)))} vs ${prior?.period}`, "neutral", "reported")}
      ${kpiCard("Cost / gallon", fmtUsd(num(current?.fuel_cost_per_gallon_usd)), `${priceVar >= 0 ? "+" : "-"}${fmtUsd(Math.abs(priceVar))} vs ${prior?.period}`, toneClass(priceVar,false), "calculated")}
      ${kpiCard("International gallons", fmtCompact(current?.international_fuel_gallons), intlShare == null ? "n/a" : `${(intlShare*100).toFixed(1)}% of total`, "neutral", "network mix")}
    </section>
    <section class="two-col">
      <article class="panel"><div class="panel-header"><div><h2>Monthly fuel trend</h2><p class="panel-subtitle">Fuel cost, gallons and calculated unit cost</p></div><span class="data-pill live">P-12(a)</span></div><div class="chart-shell tall"><canvas id="fuel-trend-chart"></canvas></div></article>
      ${insightCard(insight)}
    </section>
    <section class="equal-col">
      <article class="panel"><div class="panel-header"><div><h2>Price-volume bridge</h2><p class="panel-subtitle">Approximate decomposition versus ${esc(prior?.period)}</p></div></div>
        <div class="metric-row"><span>Reported cost variance</span><strong class="${toneClass(costVar,false)}">${fmtUsdM(costVar/1e6)}</strong><span>${fmtPct(pctChange(num(current?.fuel_cost_usd),num(prior?.fuel_cost_usd)))}</span></div>
        <div class="metric-row"><span>Approx. price effect</span><strong class="${toneClass(priceEffect,false)}">${fmtUsdM(priceEffect/1e6)}</strong><span>unit price</span></div>
        <div class="metric-row"><span>Approx. volume effect</span><strong class="${toneClass(volumeEffect,false)}">${fmtUsdM(volumeEffect/1e6)}</strong><span>gallons</span></div>
        <div class="comment-cell" style="margin-top:14px"><div class="comment-title">Interpretation</div><div class="comment-body">${esc(Math.abs(priceEffect) >= Math.abs(volumeEffect) ? "The price movement explains more of the modeled fuel-cost variance than the volume movement." : "The volume movement explains more of the modeled fuel-cost variance than the price movement.")}</div></div>
      </article>
      <article class="panel"><div class="panel-header"><div><h2>Domestic vs international</h2><p class="panel-subtitle">Fuel gallons by operating region</p></div></div><div class="chart-shell short"><canvas id="fuel-mix-chart"></canvas></div></article>
    </section>
  `;

  makeChart("fuel-trend-chart", {
    type: "bar",
    data: {
      labels: history.map((d) => d.period),
      datasets: [
        { label: "Fuel cost $m", data: history.map((d) => num(d.fuel_cost_usd)/1e6), backgroundColor: "rgba(0,113,227,.20)", borderColor: COLORS.blue, borderWidth:1, borderRadius:6, yAxisID:"y" },
        { type:"line", label:"$/gallon", data: history.map((d) => d.fuel_cost_per_gallon_usd), borderColor: COLORS.dark, pointRadius:2, tension:.35, yAxisID:"y1" },
      ],
    },
    options: commonChartOptions({
      plugins: { legend: { display:true, labels:{boxWidth:8,usePointStyle:true,font:{size:9}} } },
      scales:{
        x:{grid:{display:false},border:{display:false},ticks:{font:{size:9},maxTicksLimit:8}},
        y:{grid:{color:"rgba(29,29,31,.05)"},border:{display:false},ticks:{callback:(v)=>`$${v}m`,font:{size:9}}},
        y1:{position:"right",grid:{display:false},border:{display:false},ticks:{callback:(v)=>`$${v}`,font:{size:9}}},
      },
    }),
  });

  makeChart("fuel-mix-chart", {
    type: "doughnut",
    data: {
      labels: ["Domestic", "International"],
      datasets: [{ data: [num(current?.domestic_fuel_gallons), num(current?.international_fuel_gallons)], backgroundColor: [COLORS.blue, "#a7c8ef"], borderWidth: 0, hoverOffset: 4 }],
    },
    options: { responsive:true, maintainAspectRatio:false, cutout:"72%", plugins:{legend:{position:"bottom",labels:{boxWidth:8,usePointStyle:true,font:{size:9}}},tooltip:{backgroundColor:"rgba(29,29,31,.94)",cornerRadius:10}} },
  });

  document.getElementById("fuel-period-select")?.addEventListener("change", (event) => {
    state.fuelPeriod = event.target.value;
    render();
  });
}

function fleetManufacturerMix() {
  if (!btsReady()) return [];
  const buckets = {};
  for (const item of bts.b43_fleet.model_mix || []) {
    const manufacturer = cleanManufacturer(item.manufacturer);
    buckets[manufacturer] = (buckets[manufacturer] || 0) + num(item.aircraft_count);
  }
  return Object.entries(buckets).map(([manufacturer, count]) => ({ manufacturer, count })).sort((a,b)=>b.count-a.count);
}

function aircraftTypeEconomics(type) {
  const rows = btsReady() ? bts.p52_aircraft_economics?.latest_aircraft_type_economics || [] : [];
  return rows.find((r) => String(r.aircraft_type) === String(type)) || null;
}

function renderFleet() {
  if (!btsReady()) return renderUnavailable("The BTS B-43 fleet layer is not available.");
  const fleet = bts.b43_fleet;
  const insight = fleetCommentary();
  const manufacturerMix = fleetManufacturerMix();
  const aircraft = fleet.aircraft || [];
  const query = state.fleetQuery.trim().toLowerCase();
  const filtered = query ? aircraft.filter((a) => [a.tail_number,a.model,a.manufacturer,a.aircraft_type].some((v)=>String(v||"").toLowerCase().includes(query))) : aircraft;
  const selected = filtered.find((a) => a.tail_number === state.selectedFleetTail) || filtered[0] || null;
  if (selected && !state.selectedFleetTail) state.selectedFleetTail = selected.tail_number;
  const economics = selected ? aircraftTypeEconomics(selected.aircraft_type) : null;
  const topModel = fleet.model_mix?.[0];
  const ages = aircraft.filter((a)=>a.manufacture_year).map((a)=>fleet.inventory_year - a.manufacture_year);
  const ageBins = [0,0,0,0,0];
  ages.forEach((age)=>{ if(age<5)ageBins[0]++; else if(age<10)ageBins[1]++; else if(age<15)ageBins[2]++; else if(age<20)ageBins[3]++; else ageBins[4]++; });

  dashboard.innerHTML = `
    <section class="kpi-grid">
      ${kpiCard("Active aircraft", fmtInteger(fleet.active_aircraft_count), `B-43 ${fleet.inventory_year}`, "neutral", "tail-level inventory")}
      ${kpiCard("Average age", `${num(fleet.average_age_years).toFixed(1)} yrs`, `${ages.filter((a)=>a>=20).length} aircraft at 20+ years`, "neutral", "active aircraft")}
      ${kpiCard("Largest model family", topModel ? `${esc(cleanManufacturer(topModel.manufacturer))} ${esc(topModel.model)}` : "n/a", topModel ? `${fmtInteger(topModel.aircraft_count)} aircraft` : "", "neutral", "B-43")}
      ${kpiCard("Distinct models", fmtInteger((fleet.model_mix||[]).length), `${fmtInteger(manufacturerMix.length)} manufacturers`, "neutral", "manufacturer-model pairs")}
    </section>
    <section class="two-col">
      <article class="panel"><div class="panel-header"><div><h2>Fleet composition</h2><p class="panel-subtitle">Active aircraft by manufacturer</p></div><span class="data-pill live">B-43</span></div><div class="chart-shell"><canvas id="fleet-manufacturer-chart"></canvas></div></article>
      ${insightCard(insight)}
    </section>
    <section class="equal-col">
      <article class="panel"><div class="panel-header"><div><h2>Fleet age profile</h2><p class="panel-subtitle">Age buckets based on manufacture year</p></div></div><div class="chart-shell short"><canvas id="fleet-age-chart"></canvas></div></article>
      <article class="panel fleet-detail">
        <div><div class="hero-label">Selected aircraft</div><div class="detail-title">${esc(selected?.tail_number || "No match")}</div><div class="detail-subtitle">${selected ? `${esc(cleanManufacturer(selected.manufacturer))} ${esc(selected.model)} · aircraft type ${esc(selected.aircraft_type)}` : "Adjust the search below"}</div></div>
        ${selected ? `<div class="detail-grid"><div class="detail-metric"><span>Manufacture year</span><strong>${selected.manufacture_year || "n/a"}</strong></div><div class="detail-metric"><span>Seats</span><strong>${fmtInteger(selected.number_of_seats)}</strong></div><div class="detail-metric"><span>Payload lb</span><strong>${fmtInteger(selected.capacity_in_pounds)}</strong></div><div class="detail-metric"><span>Aircraft operating cost</span><strong>${economics ? fmtUsdM(num(economics.aircraft_operating_expense_source)/1000,0) : "n/a"}</strong></div><div class="detail-metric"><span>Air hours</span><strong>${economics ? fmtCompact(num(economics.air_hours)) : "n/a"}</strong></div><div class="detail-metric"><span>Cost / air hour</span><strong>${economics && num(economics.air_hours) ? fmtUsd(num(economics.aircraft_operating_expense_source)/num(economics.air_hours),0) : "n/a"}</strong></div></div>` : ""}
      </article>
    </section>
    <article class="panel flush">
      <div class="panel-header" style="padding:20px 20px 0"><div><h2>Aircraft inventory</h2><p class="panel-subtitle">Search by tail, model, manufacturer or aircraft type. Click a row for detail.</p></div><input class="table-search" id="fleet-search" type="search" value="${esc(state.fleetQuery)}" placeholder="Search fleet"></div>
      <div class="table-wrap" style="max-height:420px"><table><thead><tr><th>Tail</th><th>Manufacturer</th><th>Model</th><th>Year</th><th>Seats</th><th>Aircraft type</th></tr></thead><tbody>${filtered.slice(0,150).map((a)=>`<tr class="selectable ${a.tail_number===state.selectedFleetTail?"selected":""}" data-tail="${esc(a.tail_number)}"><td>${esc(a.tail_number)}</td><td>${esc(cleanManufacturer(a.manufacturer))}</td><td>${esc(a.model)}</td><td>${a.manufacture_year || "n/a"}</td><td>${fmtInteger(a.number_of_seats)}</td><td>${esc(a.aircraft_type)}</td></tr>`).join("")}</tbody></table></div>
    </article>
  `;

  makeChart("fleet-manufacturer-chart", {
    type:"doughnut",
    data:{labels:manufacturerMix.map((d)=>d.manufacturer),datasets:[{data:manufacturerMix.map((d)=>d.count),backgroundColor:[COLORS.blue,"#5aa5ef","#8fc1f2","#b8d8f6","#d5e8fa","#8e8e93"],borderWidth:0,hoverOffset:5}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:"68%",plugins:{legend:{position:"bottom",labels:{boxWidth:8,usePointStyle:true,font:{size:9}}},tooltip:{backgroundColor:"rgba(29,29,31,.94)",cornerRadius:10}}},
  });
  makeChart("fleet-age-chart", {
    type:"bar",
    data:{labels:["<5","5-9","10-14","15-19","20+"],datasets:[{data:ageBins,backgroundColor:["rgba(0,113,227,.18)","rgba(0,113,227,.24)","rgba(0,113,227,.32)","rgba(180,95,6,.26)","rgba(215,0,21,.22)"],borderRadius:7}]},
    options:commonChartOptions(),
  });

  document.getElementById("fleet-search")?.addEventListener("input", (event)=>{
    state.fleetQuery = event.target.value;
    clearTimeout(window.__fleetSearchTimer);
    window.__fleetSearchTimer = setTimeout(render, 180);
  });
  document.querySelectorAll("[data-tail]").forEach((row)=>row.addEventListener("click",()=>{
    state.selectedFleetTail = row.dataset.tail;
    render();
  }));
}

const VARIANCE_DEFS = {
  financial: {
    cadence: "quarterly",
    label: "Financials",
    data: () => bts?.p12_financials || [],
    metrics: {
      operating_revenue_usd_m: ["Operating revenue", "usd_m", true],
      operating_expense_usd_m: ["Operating expense", "usd_m", false],
      operating_profit_loss_usd_m: ["Operating profit", "usd_m", true],
      passenger_revenue_usd_m: ["Passenger revenue", "usd_m", true],
      maintenance_expense_usd_m: ["Maintenance expense", "usd_m", false],
    },
  },
  network: {
    cadence: "monthly",
    label: "Network",
    data: () => (bts?.t100_network?.history || []).map(networkRowForScope),
    metrics: {
      passengers: ["Passengers", "compact", true],
      asm: ["Available seat miles", "compact", true],
      rpm: ["Revenue passenger miles", "compact", true],
      departures_performed: ["Departures", "compact", true],
      load_factor: ["Load factor", "ratio", true],
    },
  },
  fuel: {
    cadence: "monthly",
    label: "Fuel",
    data: () => bts?.p12a_fuel || [],
    metrics: {
      fuel_cost_usd: ["Fuel cost", "usd", false],
      fuel_gallons: ["Fuel gallons", "compact", false],
      fuel_cost_per_gallon_usd: ["Fuel cost per gallon", "usd_unit", false],
      domestic_fuel_gallons: ["Domestic fuel gallons", "compact", false],
      international_fuel_gallons: ["International fuel gallons", "compact", false],
    },
  },
};

function varianceFormat(value, type) {
  if (type === "usd_m") return fmtUsdM(value);
  if (type === "usd") return fmtUsdM(value/1e6);
  if (type === "usd_unit") return fmtUsd(value);
  if (type === "ratio") return `${(num(value)*100).toFixed(1)}%`;
  return fmtCompact(value);
}

function renderVariance() {
  if (!btsReady()) return renderUnavailable("The BTS analytical layer is not available.");
  const def = VARIANCE_DEFS[state.varianceDataset] || VARIANCE_DEFS.financial;
  const data = def.data();
  if (!data.length) return renderUnavailable("No data exists for this variance dataset.");
  if (!def.metrics[state.varianceMetric]) state.varianceMetric = Object.keys(def.metrics)[0];
  if (!state.variancePeriod || !data.some((d)=>d.period===state.variancePeriod)) state.variancePeriod = data.at(-1).period;
  const idx = data.findIndex((d)=>d.period===state.variancePeriod);
  const priorIdx = compareIndex(idx, def.cadence);
  const current = data[idx];
  const prior = data[priorIdx];
  const [metricLabel, formatType, favorable] = def.metrics[state.varianceMetric];
  const currentValue = num(current[state.varianceMetric]);
  const priorValue = num(prior[state.varianceMetric]);
  const delta = currentValue - priorValue;
  const pct = pctChange(currentValue, priorValue);

  let commentary;
  if (state.varianceDataset === "financial") commentary = financialCommentary(current, prior);
  else if (state.varianceDataset === "network") commentary = networkCommentary(current, prior);
  else commentary = fuelCommentary(current, prior);

  const metricRows = Object.entries(def.metrics).map(([key,[label,type,fav]])=>{
    const c=num(current[key]), p=num(prior[key]), v=c-p;
    return {key,label,type,fav,current:c,prior:p,variance:v,pct:pctChange(c,p)};
  }).sort((a,b)=>Math.abs(b.pct||0)-Math.abs(a.pct||0));

  dashboard.innerHTML = `
    <section class="panel">
      <div class="panel-header"><div><h2>Build a variance</h2><p class="panel-subtitle">Choose dataset, metric and period. The commentary is regenerated from the filtered evidence.</p></div></div>
      <div class="filter-rail" style="position:static;margin:0;padding:0;background:transparent;border:0;box-shadow:none;backdrop-filter:none">
        <div class="filter-control"><label>Dataset</label><select id="variance-dataset-select">${Object.entries(VARIANCE_DEFS).map(([key,item])=>`<option value="${key}" ${key===state.varianceDataset?"selected":""}>${item.label}</option>`).join("")}</select></div>
        <div class="filter-control filter-control-wide"><label>Metric</label><select id="variance-metric-select">${Object.entries(def.metrics).map(([key,item])=>`<option value="${key}" ${key===state.varianceMetric?"selected":""}>${item[0]}</option>`).join("")}</select></div>
        <div class="filter-control"><label>Period</label><select id="variance-period-select">${data.slice().reverse().map((d)=>`<option value="${d.period}" ${d.period===state.variancePeriod?"selected":""}>${d.period}</option>`).join("")}</select></div>
      </div>
    </section>
    <section class="hero-grid">
      <article class="hero-card"><div class="hero-label">${esc(metricLabel)} variance</div><div class="hero-value">${varianceFormat(delta,formatType)}</div><div class="hero-delta ${toneClass(delta,favorable)}">${fmtPct(pct)} vs ${esc(prior.period)}</div><p class="hero-copy">Current ${esc(current.period)}: ${varianceFormat(currentValue,formatType)}. Comparator ${esc(prior.period)}: ${varianceFormat(priorValue,formatType)}.</p></article>
      ${insightCard(commentary, "Filter-aware variance commentary")}
    </section>
    <section class="two-col">
      <article class="panel"><div class="panel-header"><div><h2>Current vs comparator</h2><p class="panel-subtitle">Selected metric only</p></div></div><div class="chart-shell"><canvas id="variance-main-chart"></canvas></div></article>
      <article class="panel"><div class="panel-header"><div><h2>Largest relative movements</h2><p class="panel-subtitle">All metrics in the selected dataset</p></div></div>${metricRows.map((r)=>`<div class="metric-row"><span>${esc(r.label)}</span><strong class="${toneClass(r.variance,r.fav)}">${fmtPct(r.pct)}</strong><span>${varianceFormat(r.variance,r.type)}</span></div>`).join("")}</article>
    </section>
    <article class="panel flush"><div class="panel-header" style="padding:20px 20px 0"><div><h2>Comment cells</h2><p class="panel-subtitle">A Power BI-style variance table where the explanation follows the active filter context.</p></div></div><div class="table-wrap"><table><thead><tr><th>Metric</th><th>Current</th><th>Comparator</th><th>Variance</th><th>Variance %</th><th style="text-align:left;min-width:340px">Dynamic comment</th></tr></thead><tbody>${metricRows.map((r)=>`<tr><td>${esc(r.label)}</td><td>${varianceFormat(r.current,r.type)}</td><td>${varianceFormat(r.prior,r.type)}</td><td class="${toneClass(r.variance,r.fav)}">${varianceFormat(r.variance,r.type)}</td><td class="${toneClass(r.variance,r.fav)}">${fmtPct(r.pct)}</td><td style="text-align:left;white-space:normal;min-width:340px;color:#6e6e73;line-height:1.45">${esc(metricComment(r.label,r.current,r.prior,r.fav))}</td></tr>`).join("")}</tbody></table></div></article>
  `;

  makeChart("variance-main-chart", {
    type:"bar",
    data:{labels:[prior.period,current.period],datasets:[{data:[priorValue,currentValue],backgroundColor:["rgba(142,142,147,.22)",COLORS.blueSoft],borderColor:[COLORS.muted,COLORS.blue],borderWidth:1,borderRadius:9}]},
    options:commonChartOptions(),
  });

  document.getElementById("variance-dataset-select")?.addEventListener("change",(e)=>{state.varianceDataset=e.target.value;state.varianceMetric=Object.keys(VARIANCE_DEFS[state.varianceDataset].metrics)[0];state.variancePeriod=null;render();});
  document.getElementById("variance-metric-select")?.addEventListener("change",(e)=>{state.varianceMetric=e.target.value;render();});
  document.getElementById("variance-period-select")?.addEventListener("change",(e)=>{state.variancePeriod=e.target.value;render();});
}

const FLOW_STEPS = [
  ["Collect", "The project asks official public sources for the newest available airline records. No customer systems, logins or private airline data are involved."],
  ["Filter", "The raw government files are large. The pipeline keeps Delta records and the periods needed for analysis, rather than publishing the full source extracts."],
  ["Check", "Automated tests check schemas, carrier identity, period coverage and basic financial consistency before anything reaches the public dashboard."],
  ["Model", "Finance and operating fields are converted into a compact analytical layer: P&L, fuel, traffic, routes, fleet and unit metrics."],
  ["Publish", "Only compact analytical JSON is committed to the public repository. GitHub Pages then serves the dashboard you are viewing."],
];

function renderJourney() {
  const generated = bts?.metadata?.generated_at_utc ? new Date(bts.metadata.generated_at_utc) : null;
  const finPeriods = bts?.p12_financials?.length || 0;
  const netPeriods = bts?.t100_network?.history?.length || 0;
  const aircraft = bts?.b43_fleet?.active_aircraft_count || 0;
  const step = FLOW_STEPS[state.flowStep] || FLOW_STEPS[0];
  currentInsight = "The project turns large official airline datasets into a small, auditable public analytical layer. Raw source downloads are temporary; only compact aggregates are retained in GitHub.";

  dashboard.innerHTML = `
    <section class="journey-hero">
      <h2>From government data to a CFO-ready story.</h2>
      <p>This project is designed so a non-technical visitor can understand where every number comes from. It collects public airline data, keeps a small rolling history, validates it, turns it into finance-friendly metrics and publishes only the compact result.</p>
    </section>

    <section class="flow-diagram">
      <div class="panel-header"><div><h2>The information flow</h2><p class="panel-subtitle">Click any step for a plain-English explanation.</p></div><span class="data-pill live">Automated</span></div>
      <div class="flow-track">${FLOW_STEPS.map(([label,body],index)=>`<article class="flow-step ${index===state.flowStep?"active":""}" data-flow-step="${index}"><div class="flow-number">0${index+1}</div><h3>${esc(label)}</h3><p>${esc(body.split(".")[0])}.</p></article>`).join("")}</div>
      <div class="flow-explainer"><strong>${esc(step[0])}</strong><span>${esc(step[1])}</span></div>
    </section>

    <section class="residency-grid">
      <article class="residency-card"><div class="hero-label">Raw source residency</div><div class="big-number">Temporary</div><p>BTS ZIP and CSV files are downloaded into the temporary GitHub Actions runner workspace. They are not committed to the public repository.</p></article>
      <article class="residency-card"><div class="hero-label">Published retention</div><div class="big-number">8Q / 24M</div><p>The compact layer retains eight finance quarters and twenty-four operating months. This keeps the public project small while preserving useful trend history.</p></article>
      <article class="residency-card"><div class="hero-label">Personal data</div><div class="big-number">None</div><p>The sources describe an airline, routes, aircraft and public financial filings. The dashboard does not ingest personal, employee or customer-level information.</p></article>
    </section>

    <section class="two-col">
      <article class="panel">
        <div class="panel-header"><div><h2>What is actually stored?</h2><p class="panel-subtitle">The public repository contains analytical outputs, not giant raw extracts.</p></div></div>
        <div class="metric-row"><span>Form 41 finance history</span><strong>${finPeriods} quarters</strong><span>P-1.2</span></div>
        <div class="metric-row"><span>Network history</span><strong>${netPeriods} months</strong><span>T-100</span></div>
        <div class="metric-row"><span>Active fleet snapshot</span><strong>${fmtInteger(aircraft)} aircraft</strong><span>B-43</span></div>
        <div class="metric-row"><span>Latest management result</span><strong>${esc(actuals?.period || "n/a")}</strong><span>Delta IR</span></div>
        <div class="metric-row"><span>Automated refresh</span><strong>Monthly</strong><span>GitHub Actions</span></div>
      </article>
      <article class="panel">
        <div class="panel-header"><div><h2>Why two official sources?</h2><p class="panel-subtitle">Freshness and analytical depth are different jobs.</p></div></div>
        <div class="comment-cell"><div class="comment-title">Delta Investor Relations</div><div class="comment-body">Used for the newest quarterly management result and the statistical summary management discusses publicly.</div></div>
        <div class="comment-cell" style="margin-top:10px"><div class="comment-title">U.S. DOT BTS TranStats</div><div class="comment-body">Used for granular history: regulatory P&L, monthly fuel, domestic and international traffic, routes, aircraft types and fleet inventory.</div></div>
        <div class="comment-cell" style="margin-top:10px"><div class="comment-title">The rule</div><div class="comment-body">A slower regulatory release never replaces a fresher official actual just for consistency. Instead, the sources are labelled and used for the analytical job each one does best.</div></div>
      </article>
    </section>

    <section class="three-col">
      <article class="panel"><h2>Data quality gate</h2><p class="panel-subtitle">Before publication</p><div class="metric-row"><span>Unit tests</span><strong>53+</strong><span>automated</span></div><div class="metric-row"><span>Carrier key</span><strong>19790</strong><span>Delta</span></div><div class="metric-row"><span>Schema handling</span><strong>Header driven</strong><span>resilient</span></div></article>
      <article class="panel"><h2>Refresh design</h2><p class="panel-subtitle">Built for a free public portfolio</p><div class="metric-row"><span>Schedule</span><strong>Monthly</strong><span>day 5</span></div><div class="metric-row"><span>Raw storage</span><strong>0 files</strong><span>committed</span></div><div class="metric-row"><span>Output</span><strong>JSON</strong><span>compact</span></div></article>
      <article class="panel"><h2>Last analytical build</h2><p class="panel-subtitle">Metadata from the BTS layer</p><div class="metric-row"><span>Generated</span><strong>${generated ? generated.toLocaleDateString() : "n/a"}</strong><span>UTC</span></div><div class="metric-row"><span>Source</span><strong>TranStats</strong><span>U.S. DOT</span></div><div class="metric-row"><span>Published site</span><strong>GitHub Pages</strong><span>public</span></div></article>
    </section>

    <div class="notice">Data residency here describes where project data lives in this architecture. GitHub may execute hosted runners and serve Pages from infrastructure in different physical regions; this portfolio does not make a legal cloud-region residency claim.</div>
  `;

  document.querySelectorAll("[data-flow-step]").forEach((el)=>el.addEventListener("click",()=>{state.flowStep=Number(el.dataset.flowStep);render();}));
}

function renderUnavailable(message) {
  dashboard.innerHTML = `<div class="error-state"><strong>Data layer unavailable</strong><p>${esc(message)}</p></div>`;
  currentInsight = message;
}

function render() {
  destroyCharts();
  const meta = PAGE_META[state.view] || PAGE_META.overview;
  titleEl.textContent = meta.title;
  subtitleEl.textContent = meta.subtitle;
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === state.view));
  syncHash();

  if (state.view === "overview") renderOverview();
  else if (state.view === "financials") renderFinancials();
  else if (state.view === "network") renderNetwork();
  else if (state.view === "fuel") renderFuel();
  else if (state.view === "fleet") renderFleet();
  else if (state.view === "variance") renderVariance();
  else if (state.view === "journey") renderJourney();

  document.querySelectorAll("[data-focus]").forEach((card)=>card.addEventListener("click",()=>{
    state.focus=card.dataset.focus;
    document.getElementById("focus-select").value=state.focus;
    syncHash();
    render();
  }));
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=>toast.classList.remove("show"),1800);
}

async function copyInsight() {
  if (!currentInsight) return;
  try {
    await navigator.clipboard.writeText(currentInsight);
    showToast("Insight copied");
  } catch (_) {
    showToast("Clipboard permission unavailable");
  }
}

function wireShell() {
  document.querySelectorAll(".nav-item").forEach((button)=>button.addEventListener("click",()=>setView(button.dataset.view)));
  document.getElementById("mobile-nav-button")?.addEventListener("click",()=>sidebar.classList.toggle("open"));
  document.getElementById("copy-insight-button")?.addEventListener("click",copyInsight);
  document.getElementById("reset-filters-button")?.addEventListener("click",()=>{
    Object.assign(state,{range:12,scope:"all",compare:"yoy",focus:"operating_margin",financialPeriod:null,networkPeriod:null,fuelPeriod:null,selectedRoute:null,selectedAircraftType:null,selectedFleetTail:null,fleetQuery:"",varianceDataset:"financial",varianceMetric:"operating_revenue_usd_m",variancePeriod:null});
    syncControls();
    render();
  });

  const rangeSelect=document.getElementById("range-select");
  const scopeSelect=document.getElementById("scope-select");
  const compareSelect=document.getElementById("compare-select");
  const focusSelect=document.getElementById("focus-select");
  rangeSelect.addEventListener("change",()=>{state.range=Number(rangeSelect.value);state.networkPeriod=null;state.selectedRoute=null;render();});
  scopeSelect.addEventListener("change",()=>{state.scope=scopeSelect.value;state.selectedRoute=null;state.networkPeriod=null;render();});
  compareSelect.addEventListener("change",()=>{state.compare=compareSelect.value;render();});
  focusSelect.addEventListener("change",()=>{state.focus=focusSelect.value;syncHash();render();});

  document.querySelectorAll("[data-shortcut]").forEach((button)=>button.addEventListener("click",()=>{
    const shortcut=button.dataset.shortcut;
    if(shortcut==="margin"){state.view="variance";state.varianceDataset="financial";state.varianceMetric="operating_profit_loss_usd_m";}
    if(shortcut==="network") state.view="network";
    if(shortcut==="fuel") state.view="fuel";
    if(shortcut==="fleet") state.view="fleet";
    syncHash();render();window.scrollTo({top:0,behavior:"smooth"});
  }));
  window.addEventListener("hashchange",()=>{getHashState();syncControls();render();});
}

function syncControls() {
  document.getElementById("range-select").value=String(state.range);
  document.getElementById("scope-select").value=state.scope;
  document.getElementById("compare-select").value=state.compare;
  const focus=document.getElementById("focus-select");
  if([...focus.options].some((o)=>o.value===state.focus)) focus.value=state.focus;
}

function setFreshness() {
  if (btsReady()) {
    const generated = new Date(bts.metadata.generated_at_utc);
    freshnessEl.textContent = `BTS refreshed ${generated.toLocaleDateString()}`;
    freshnessEl.classList.add("ready");
    footerRefreshEl.textContent = `Analytical layer generated ${generated.toLocaleString()}`;
  } else {
    freshnessEl.textContent = "Delta IR loaded";
    footerRefreshEl.textContent = "BTS layer unavailable";
  }
}

async function loadData() {
  getHashState();
  syncControls();
  try {
    const [actualsResponse, btsResponse] = await Promise.all([
      fetch("data/actuals.json", { cache: "no-store" }),
      fetch("data/bts_summary.json", { cache: "no-store" }).catch(()=>null),
    ]);
    if (!actualsResponse.ok) throw new Error(`actuals.json returned ${actualsResponse.status}`);
    actuals = await actualsResponse.json();
    if (btsResponse?.ok) bts = await btsResponse.json();
    chartDefaults();
    setFreshness();
    render();
  } catch (error) {
    dashboard.innerHTML = `<div class="error-state"><strong>Unable to load dashboard data</strong><p>${esc(error.message)}</p></div>`;
    freshnessEl.textContent = "Data load failed";
  }
}

wireShell();
loadData();
