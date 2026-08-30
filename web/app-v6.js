// Comparison consistency contract.
// All filter-aware financial comparisons use the same BTS quarterly P&L base.
// Delta Investor Relations remains a separate freshness/reference source and
// never changes the values behind the Compare selector or management risk score.

function financialBasis(fin) {
  const c = fin?.current || null;
  const p = fin?.prior || null;
  const raw = fin?.raw || null;
  const quarter = parseQuarter(raw?.period);
  const q1Identity = state.compare === "ytd" && quarter?.q === 1;

  return {
    source: q1Identity
      ? "BTS recalculated YTD (Q1 equals quarterly YoY)"
      : state.compare === "ytd"
        ? "BTS recalculated YTD"
        : "BTS consolidated quarterly P&L",
    currentLabel: c?.period || "n/a",
    priorLabel: p?.period || "n/a",
    revenueCurrent: n(c?.operating_revenue_usd_m),
    revenuePrior: n(p?.operating_revenue_usd_m),
    expenseCurrent: n(c?.operating_expense_usd_m),
    expensePrior: n(p?.operating_expense_usd_m),
    profitCurrent: n(c?.operating_profit_loss_usd_m),
    profitPrior: n(p?.operating_profit_loss_usd_m),
    marginCurrent: 100 * n(c?.operating_margin),
    marginPrior: 100 * n(p?.operating_margin),
  };
}

function financialComparisonContractText(fin) {
  const rawQuarter = parseQuarter(fin?.raw?.period);
  if (rawQuarter?.q === 1 && (state.compare === "yoy" || state.compare === "ytd")) {
    return "Q1 consistency rule: quarterly YoY and YTD vs prior YTD are mathematically identical because YTD contains only Q1.";
  }
  return state.compare === "ytd"
    ? "YTD is recalculated by summing every available quarter from Q1 through the selected quarter in both years."
    : "Quarterly comparison uses the selected quarter and its exact comparator; it is not mixed with Delta IR periods.";
}

// Add a visible comparison-contract note after each financial render.
const __afccRenderV5 = render;
render = function renderWithComparisonContract() {
  __afccRenderV5();
  if (!["overview", "financials"].includes(state.view)) return;
  const fin = financialContext();
  const message = financialComparisonContractText(fin);
  const host = document.querySelector("#dashboard-view");
  if (!host || !message) return;
  const note = document.createElement("div");
  note.className = "notice comparison-contract-note";
  note.textContent = message;
  host.prepend(note);
};
