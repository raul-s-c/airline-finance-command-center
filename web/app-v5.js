// Interaction and QA layer for dashboard v4.
// Keeps consolidated financial statements separate from network scope while
// making comparison, focus and route cross-filtering behave like a BI model.

function financialBasis(fin) {
  const ir = state.compare === "yoy" ? latestIR() : null;
  if (ir && actuals) {
    const f = actuals.financials_usd_millions;
    return {
      source: "Delta IR latest quarter",
      currentLabel: actuals.period,
      priorLabel: actuals.comparison_period,
      revenueCurrent: n(f.operating_revenue.current),
      revenuePrior: n(f.operating_revenue.prior),
      expenseCurrent: n(f.operating_expense.current),
      expensePrior: n(f.operating_expense.prior),
      profitCurrent: n(f.operating_income.current),
      profitPrior: n(f.operating_income.prior),
      marginCurrent: ir.margin,
      marginPrior: ir.margin - ir.marginD,
    };
  }
  const c = fin.current, p = fin.prior;
  return {
    source: state.compare === "ytd" ? "BTS recalculated YTD" : "BTS consolidated P&L",
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

function controlAssessment(fin, net, fuel) {
  const fb = financialBasis(fin);
  let risk = 0;
  const reasons = [], positives = [];
  const marginD = fb.marginCurrent - fb.marginPrior;
  const revG = pctChange(fb.revenueCurrent, fb.revenuePrior);
  const opexG = pctChange(fb.expenseCurrent, fb.expensePrior);
  const profitG = pctChange(fb.profitCurrent, fb.profitPrior);
  const paxG = pctChange(n(net?.current?.passengers), n(net?.prior?.passengers));
  const asmG = pctChange(n(net?.current?.asm), n(net?.prior?.asm));
  const lfD = (n(net?.current?.load_factor) - n(net?.prior?.load_factor)) * 100;
  const fuelPG = pctChange(n(fuel?.current?.fuel_cost_per_gallon_usd), n(fuel?.prior?.fuel_cost_per_gallon_usd));

  if (marginD <= -4) { risk += 3; reasons.push(`Operating margin compressed ${Math.abs(marginD).toFixed(1)}pp.`); }
  else if (marginD <= -2) { risk += 2; reasons.push(`Operating margin compressed ${Math.abs(marginD).toFixed(1)}pp.`); }
  else if (marginD < -.5) { risk += 1; reasons.push(`Operating margin is modestly lower by ${Math.abs(marginD).toFixed(1)}pp.`); }
  else positives.push(`Operating margin is stable or improving (${fmtPp(marginD)}).`);

  const costGap = (opexG ?? 0) - (revG ?? 0);
  if (costGap > 5) { risk += 2; reasons.push(`Operating expense is growing ${costGap.toFixed(1)}pp faster than revenue.`); }
  else if (costGap > 2) { risk += 1; reasons.push(`Costs are growing faster than revenue by ${costGap.toFixed(1)}pp.`); }
  else positives.push("Revenue and operating-cost growth are reasonably aligned.");

  if (profitG != null && profitG < -20) { risk += 2; reasons.push(`Operating profit is down ${Math.abs(profitG).toFixed(1)}%.`); }
  else if (profitG != null && profitG < 0) { risk += 1; reasons.push(`Operating profit is down ${Math.abs(profitG).toFixed(1)}%.`); }
  else positives.push("Operating profit is not deteriorating in the selected comparison.");

  const demandGap = (paxG ?? 0) - (asmG ?? 0);
  if (demandGap < -3) { risk += 1; reasons.push(`${state.scope} passenger growth is trailing capacity by ${Math.abs(demandGap).toFixed(1)}pp.`); }
  else positives.push(`${state.scope} demand is broadly keeping pace with capacity.`);
  if (lfD < -2) { risk += 1; reasons.push(`${state.scope} load factor is down ${Math.abs(lfD).toFixed(1)}pp.`); }
  else positives.push(`${state.scope} load factor is broadly stable (${fmtPp(lfD)}).`);
  if (fuelPG != null && fuelPG > 20) { risk += 1; reasons.push(`Fuel price is up ${fuelPG.toFixed(1)}%, a major external cost pressure.`); }
  else if (fuelPG != null && fuelPG < -10) positives.push(`Fuel price is providing a tailwind (${fmtPct(fuelPG)}).`);

  let status, label, tone, plain;
  if (risk >= 7) { status="critical"; label="Critical"; tone="critical"; plain="Multiple core indicators are deteriorating at the same time. Management action would need to be immediate rather than incremental."; }
  else if (risk >= 4) { status="pressure"; label="Under pressure"; tone="pressure"; plain="This is not a demand-collapse scenario, but cost and margin pressure are too large to call the situation fully controlled. The key question is how quickly cost growth normalizes."; }
  else if (risk >= 2) { status="watch"; label="Watch"; tone="watch"; plain="Performance is still broadly controllable, but there are enough adverse signals that management should be watching the next periods closely."; }
  else { status="control"; label="In control"; tone="control"; plain="The main financial and operating signals are broadly aligned. There is no evidence of a compounding deterioration in the current data."; }
  return { risk,status,label,tone,plain,reasons:reasons.slice(0,4),positives:positives.slice(0,3),metrics:{marginD,revG,opexG,profitG,paxG,asmG,lfD,fuelPG}, financialBasis: fb };
}

function focusInsight(fin, net, fuel) {
  const fb = financialBasis(fin);
  if (state.focus === "revenue") {
    return { label:"Revenue focus", value:fmtUsdBn(fb.revenueCurrent), delta:fmtPct(pctChange(fb.revenueCurrent,fb.revenuePrior)), text:`${fb.source}. Revenue is compared with ${fb.priorLabel}; the Network filter is not applied because the P&L source is airline-consolidated.` };
  }
  if (state.focus === "passengers") {
    return { label:"Passenger focus", value:fmtCompact(n(net.current?.passengers)), delta:fmtPct(pctChange(n(net.current?.passengers),n(net.prior?.passengers))), text:`${state.scope} network, ${net.current?.period || "n/a"} versus ${net.prior?.period || "n/a"}. This metric responds to Network, History and Compare.` };
  }
  if (state.focus === "load_factor") {
    return { label:"Load factor focus", value:`${(100*n(net.current?.load_factor)).toFixed(1)}%`, delta:fmtPp((n(net.current?.load_factor)-n(net.prior?.load_factor))*100), text:`Distance-weighted seat utilization for ${state.scope}. It responds to Network and Compare.` };
  }
  if (state.focus === "fuel_price") {
    return { label:"Fuel price focus", value:fmtUsd(n(fuel.current?.fuel_cost_per_gallon_usd)), delta:fmtPct(pctChange(n(fuel.current?.fuel_cost_per_gallon_usd),n(fuel.prior?.fuel_cost_per_gallon_usd))), text:`Average fuel cost per gallon for ${state.scope}. The Network scope maps to the corresponding P-12(a) regional fuel split.` };
  }
  return { label:"Operating margin focus", value:`${fb.marginCurrent.toFixed(1)}%`, delta:fmtPp(fb.marginCurrent-fb.marginPrior), text:`${fb.source}. Margin is consolidated at airline level, so Domestic / International does not alter this financial KPI.` };
}

function renderOverview() {
  const fin=financialContext(), net=networkContext(), fuel=fuelContext(), control=controlAssessment(fin,net,fuel), fb=control.financialBasis;
  const focus=focusInsight(fin,net,fuel), stateClass=`control-${control.tone}`;
  dashboard.innerHTML=`
  <section class="control-hero ${stateClass}">
    <div><div class="control-eyebrow">Management control view</div><div class="control-status">${esc(control.label)}</div><p>${esc(control.plain)}</p><div class="control-score">Risk score ${control.risk}/10 <span>${esc(compareModeLabel())}; financial signals are consolidated, operating signals use ${esc(state.scope)} network</span></div></div>
    <div class="control-signals"><h3>Why this status</h3>${control.reasons.length?control.reasons.map(x=>`<div class="signal bad">${esc(x)}</div>`).join(""):"<div class='signal good'>No material adverse signals cross the current thresholds.</div>"}${control.positives.map(x=>`<div class="signal good">${esc(x)}</div>`).join("")}</div>
  </section>
  <section class="focus-lens"><div><span>${esc(focus.label)}</span><strong>${focus.value}</strong><em>${focus.delta}</em></div><p>${esc(focus.text)}</p></section>
  <section class="kpi-grid">
    ${kpiCard("operating_margin",`${fb.marginCurrent.toFixed(1)}%`,`${fmtPp(fb.marginCurrent-fb.marginPrior)} vs ${fb.priorLabel}`,fb.source,deltaTone(fb.marginCurrent-fb.marginPrior))}
    ${kpiCard("operating_revenue",fmtUsdBn(fb.revenueCurrent),`${fmtPct(pctChange(fb.revenueCurrent,fb.revenuePrior))} vs ${fb.priorLabel}`,fb.source,deltaTone(fb.revenueCurrent-fb.revenuePrior))}
    ${kpiCard("load_factor",`${(100*n(net.current?.load_factor)).toFixed(1)}%`,fmtPp((n(net.current?.load_factor)-n(net.prior?.load_factor))*100),`${state.scope} · ${net.current?.period||"n/a"}`,deltaTone(n(net.current?.load_factor)-n(net.prior?.load_factor)))}
    ${kpiCard("fuel_price",fmtUsd(n(fuel.current?.fuel_cost_per_gallon_usd)),fmtPct(pctChange(n(fuel.current?.fuel_cost_per_gallon_usd),n(fuel.prior?.fuel_cost_per_gallon_usd))),`${state.scope} · ${fuel.current?.period||"n/a"}`,deltaTone(n(fuel.current?.fuel_cost_per_gallon_usd)-n(fuel.prior?.fuel_cost_per_gallon_usd),false))}
  </section>
  <section class="three-col control-detail-grid">
    <article class="panel filter-consolidated"><div class="panel-header"><div><h2>Cost conversion</h2><p class="panel-subtitle">Consolidated airline P&L; Network scope does not apply</p></div><span class="context-chip">Consolidated</span></div><div class="big-signal ${(control.metrics.opexG??0)>(control.metrics.revG??0)?"negative":"positive"}">${fmtPct(control.metrics.opexG)}</div><p class="explain-copy">Operating expense growth versus ${fmtPct(control.metrics.revG)} revenue growth. The gap is ${((control.metrics.opexG??0)-(control.metrics.revG??0)).toFixed(1)}pp. Comparison: ${esc(compareModeLabel())}.</p></article>
    <article class="panel"><div class="panel-header"><div><h2>Demand versus capacity</h2><p class="panel-subtitle">Filtered to ${esc(state.scope)}</p></div><span class="context-chip active-scope">${esc(state.scope)}</span></div><div class="big-signal">${fmtPct(control.metrics.paxG)}</div><p class="explain-copy">Passengers versus ${fmtPct(control.metrics.asmG)} ASM. ${esc(networkCommentary(net.current,net.prior).headline)}.</p></article>
    <article class="panel"><div class="panel-header"><div><h2>External pressure</h2><p class="panel-subtitle">Fuel cost per gallon, filtered to ${esc(state.scope)}</p></div><span class="context-chip active-scope">${esc(state.scope)}</span></div><div class="big-signal ${deltaTone((fuel.current?.fuel_cost_per_gallon_usd||0)-(fuel.prior?.fuel_cost_per_gallon_usd||0),false)}">${fmtPct(control.metrics.fuelPG)}</div><p class="explain-copy">Fuel price is largely external. The dashboard separates it from volume so management is not blamed for a commodity-price shock.</p></article>
  </section>
  <section class="two-col"><article class="panel filter-consolidated"><div class="panel-header"><div><h2>Financial direction</h2><p class="panel-subtitle">Quarterly consolidated revenue and operating margin. Network scope does not apply to this chart.</p></div>${sourceChip("finance")}</div><div class="chart-shell"><canvas id="overview-fin"></canvas></div></article>${insightCard(financialCommentary(fin.current,fin.prior),"Financial diagnosis")}</section>
  <section class="two-col"><article class="panel"><div class="panel-header"><div><h2>Network direction</h2><p class="panel-subtitle">${esc(state.scope)} passengers and capacity</p></div>${sourceChip("network")}</div><div class="chart-shell"><canvas id="overview-net"></canvas></div></article>${insightCard(networkCommentary(net.current,net.prior),"Operating diagnosis")}</section>`;
  const f=bts?.p12_financials||[];
  makeChart("overview-fin",{type:"bar",data:{labels:f.map(x=>x.period),datasets:[{label:"Revenue $m",data:f.map(x=>x.operating_revenue_usd_m),backgroundColor:COLORS.blueSoft,borderRadius:7,yAxisID:"y"},{type:"line",label:"Margin %",data:f.map(x=>100*n(x.operating_margin)),borderColor:COLORS.dark,pointRadius:2,tension:.35,yAxisID:"y1"}]},options:commonChartOptions({plugins:{legend:{display:true,labels:{boxWidth:8,usePointStyle:true,font:{size:9}}}},scales:{x:{grid:{display:false}},y:{grid:{color:COLORS.line},ticks:{callback:v=>`$${(v/1000).toFixed(0)}bn`}},y1:{position:"right",grid:{display:false},ticks:{callback:v=>`${v}%`}}}})});
  makeChart("overview-net",{type:"line",data:{labels:net.visible.map(x=>x.period),datasets:[{label:"Passengers",data:net.visible.map(x=>x.passengers),borderColor:COLORS.blue,backgroundColor:COLORS.fill,fill:true,tension:.35,pointRadius:1},{label:"ASM",data:net.visible.map(x=>x.asm),borderColor:COLORS.muted,borderDash:[4,4],tension:.35,pointRadius:0,yAxisID:"y1"}]},options:commonChartOptions({plugins:{legend:{display:true,labels:{boxWidth:8,usePointStyle:true,font:{size:9}}}},scales:{x:{grid:{display:false}},y:{grid:{color:COLORS.line}},y1:{position:"right",grid:{display:false}}}})});
}

function routeContext(route) {
  if (!route) return networkContext();
  const rows=(bts?.t100_network?.route_history?.[routeKey(route)]||[]).slice();
  const visible=rows.slice(-Math.min(state.range,rows.length));
  if(!rows.length)return{full:rows,visible,current:null,prior:null,raw:null};
  let raw=state.networkPeriod?periodByExact(rows,state.networkPeriod):rows.at(-1);if(!raw)raw=rows.at(-1);
  const idx=rows.findIndex(x=>x.period===raw.period);let current=raw,prior=null;
  if(state.compare==="prior")prior=previousRow(rows,idx);
  else if(state.compare==="ytd"){current=aggregateMonthlyYTD(rows,raw);const p=parseMonth(raw.period);const match=p?periodByExact(rows,`${p.year-1}-${String(p.month).padStart(2,"0")}`):null;prior=match?aggregateMonthlyYTD(rows,match):null;}
  else prior=monthLastYear(rows,raw);
  return{full:rows,visible,current,prior,raw};
}

function renderNetwork() {
  const totalCtx=networkContext(); if(!totalCtx.current||!totalCtx.prior)return renderUnavailable("No valid network comparison is available.");
  const routes=selectedRoutes(), shown=routes.slice(0,12), selected=routes.find(r=>routeKey(r)===state.selectedRouteKey)||null;
  const ctx=selected?routeContext(selected):totalCtx;
  const lfD=(n(ctx.current?.load_factor)-n(ctx.prior?.load_factor))*100;
  const noIntl=state.scope==="international"&&routes.length===0;
  const contextLabel=selected?`${selected.origin}-${selected.destination}`:state.scope;
  dashboard.innerHTML=`${noIntl?`<div class="notice warning-banner"><strong>International route ranking is not available in the currently published compact file.</strong> International totals still come from T-100-I. The next BTS refresh publishes separate Domestic and International route rankings.</div>`:""}
  ${selected?`<div class="route-filter-banner"><span>Cross-filter active: <strong>${esc(selected.origin)}-${esc(selected.destination)}</strong></span><button id="clear-route-filter">Clear route filter</button></div>`:""}
  <section class="filter-context panel"><div class="panel-header"><div><h2>Selected network month</h2><p class="panel-subtitle">${selected?`KPIs, trend and comments are cross-filtered to ${esc(selected.origin)}-${esc(selected.destination)}.`:`Scope and comparison mode recalculate every network KPI and comment.`}</p></div><select class="table-search" id="network-period-select">${ctx.full.slice().reverse().map(x=>`<option value="${x.period}" ${x.period===ctx.raw?.period?"selected":""}>${x.period}</option>`).join("")}</select></div></section>
  <section class="kpi-grid">${kpiCard("passengers",fmtCompact(n(ctx.current?.passengers)),fmtPct(pctChange(n(ctx.current?.passengers),n(ctx.prior?.passengers))),`${contextLabel} · ${ctx.current?.period||"n/a"}`,deltaTone(n(ctx.current?.passengers)-n(ctx.prior?.passengers)))}${kpiCard("asm",fmtCompact(n(ctx.current?.asm)),fmtPct(pctChange(n(ctx.current?.asm),n(ctx.prior?.asm))),`${contextLabel} capacity`,"neutral")}${kpiCard("load_factor",`${(100*n(ctx.current?.load_factor)).toFixed(1)}%`,fmtPp(lfD),contextLabel,deltaTone(lfD))}${kpiCard("departures",fmtCompact(n(ctx.current?.departures_performed)),fmtPct(pctChange(n(ctx.current?.departures_performed),n(ctx.prior?.departures_performed))),contextLabel,"neutral")}</section>
  <section class="two-col"><article class="panel"><div class="panel-header"><div><h2>Traffic and capacity</h2><p class="panel-subtitle">${selected?`Selected route ${esc(selected.origin)}-${esc(selected.destination)}`:`Passengers and available seats for ${esc(state.scope)}`}</p></div>${sourceChip("network")}</div><div class="chart-shell"><canvas id="network-trend"></canvas></div></article>${insightCard(networkCommentary(ctx.current,ctx.prior),selected?"Selected-route diagnosis":"Network diagnosis")}</section>
  <section class="two-col"><article class="panel"><div class="panel-header"><div><h2>Top directional routes</h2><p class="panel-subtitle">Click a bar or row to cross-filter the KPIs, trend and diagnosis above</p></div><span class="data-pill">Top ${shown.length}</span></div>${shown.length?`<div class="chart-shell route-chart"><canvas id="route-chart"></canvas></div>`:`<div class="empty-panel">No ranked routes are available for this scope yet.</div>`}</article>${insightCard(routeInsight(selected),"Selected route")}</section>
  ${shown.length?`<article class="panel flush"><div class="table-wrap"><table><thead><tr><th>Route</th><th>Scope</th><th>Passengers</th><th>Departures</th><th>Load factor</th></tr></thead><tbody>${shown.map(r=>`<tr class="selectable ${routeKey(r)===state.selectedRouteKey?"selected":""}" data-route-key="${esc(routeKey(r))}"><td>${esc(r.origin)}-${esc(r.destination)}</td><td>${esc(r.scope)}</td><td>${fmtCompact(n(r.passengers))}</td><td>${fmtInt(n(r.departures_performed))}</td><td>${r.load_factor==null?"n/a":`${(100*r.load_factor).toFixed(1)}%`}</td></tr>`).join("")}</tbody></table></div></article>`:""}`;
  makeChart("network-trend",{type:"line",data:{labels:ctx.visible.map(x=>x.period),datasets:[{label:"Passengers",data:ctx.visible.map(x=>x.passengers),borderColor:COLORS.blue,backgroundColor:COLORS.fill,fill:true,tension:.35,pointRadius:1},{label:"Seats",data:ctx.visible.map(x=>x.available_seats),borderColor:COLORS.muted,borderDash:[4,4],tension:.35,pointRadius:0}]},options:commonChartOptions({plugins:{legend:{display:true,labels:{boxWidth:8,usePointStyle:true,font:{size:9}}}}})});
  if(shown.length){makeChart("route-chart",{type:"bar",data:{labels:shown.map(r=>`${r.origin}-${r.destination}`),datasets:[{data:shown.map(r=>r.passengers),backgroundColor:shown.map(r=>routeKey(r)===state.selectedRouteKey?COLORS.blue:"rgba(0,113,227,.20)"),borderRadius:8}]},options:{...commonChartOptions(),indexAxis:"y",interaction:{mode:"nearest",intersect:true},onClick:(evt,elements)=>{if(!elements?.length)return;const r=shown[elements[0].index];if(r){state.selectedRouteKey=routeKey(r);state.networkPeriod=null;render();}}}});}
  document.getElementById("network-period-select")?.addEventListener("change",e=>{state.networkPeriod=e.target.value;render();});
  document.getElementById("clear-route-filter")?.addEventListener("click",()=>{state.selectedRouteKey=null;state.networkPeriod=null;render();});
  document.querySelectorAll("[data-route-key]").forEach(row=>row.addEventListener("click",()=>{state.selectedRouteKey=row.dataset.routeKey;state.networkPeriod=null;render();}));
}

const FILTER_RULES={
  overview:{range:"partial: network and fuel history",scope:"partial: network, fuel and operating diagnosis; consolidated P&L is unchanged",compare:"applies to financial, network and fuel diagnosis",focus:"applies to the Focus lens"},
  financials:{range:"not used on quarterly financials",scope:"not applicable: financial statements are consolidated",compare:"applies",focus:"not used on this page"},
  network:{range:"applies",scope:"applies",compare:"applies",focus:"not used on this page"},
  fuel:{range:"applies",scope:"applies through regional fuel fields",compare:"applies",focus:"not used on this page"},
  fleet:{range:"not applicable: annual inventory snapshot",scope:"not applicable",compare:"not applicable",focus:"not used on this page"},
  variance:{range:"depends on selected dataset",scope:"applies to Network and Fuel datasets, not Financial",compare:"applies",focus:"not used on this page"},
  glossary:{range:"not applicable",scope:"not applicable",compare:"not applicable",focus:"not applicable"},
  journey:{range:"not applicable",scope:"not applicable",compare:"not applicable",focus:"not applicable"}
};
function applyFilterAudit(){
  const keys=[["range-select","range"],["scope-select","scope"],["compare-select","compare"],["focus-select","focus"]],rules=FILTER_RULES[state.view]||{};
  keys.forEach(([id,key])=>{const el=document.getElementById(id),wrap=el?.closest(".filter-control");if(!wrap)return;const note=rules[key]||"";wrap.dataset.filterAudit=note;wrap.classList.toggle("filter-not-applicable",note.startsWith("not "));wrap.classList.toggle("filter-partial",note.startsWith("partial"));wrap.title=note;});
}

let tooltipPortal=null;
function ensureTooltipPortal(){if(!tooltipPortal){tooltipPortal=document.createElement("div");tooltipPortal.className="tooltip-portal";document.body.appendChild(tooltipPortal);}return tooltipPortal;}
function showPortalTooltip(target){const text=target?.dataset?.tooltip;if(!text)return;const tip=ensureTooltipPortal(),r=target.getBoundingClientRect();tip.textContent=text;tip.classList.add("show");const w=Math.min(360,window.innerWidth-24);tip.style.maxWidth=`${w}px`;requestAnimationFrame(()=>{const tr=tip.getBoundingClientRect();let left=r.left+r.width/2-tr.width/2;left=Math.max(12,Math.min(left,window.innerWidth-tr.width-12));let top=r.top-tr.height-10;if(top<8)top=r.bottom+10;tip.style.left=`${left}px`;tip.style.top=`${top}px`;});}
function hidePortalTooltip(){tooltipPortal?.classList.remove("show");}
document.addEventListener("mouseover",e=>{const t=e.target.closest?.("[data-tooltip]");if(t)showPortalTooltip(t);});
document.addEventListener("mouseout",e=>{if(e.target.closest?.("[data-tooltip]"))hidePortalTooltip();});
document.addEventListener("focusin",e=>{const t=e.target.closest?.("[data-tooltip]");if(t)showPortalTooltip(t);});
document.addEventListener("focusout",e=>{if(e.target.closest?.("[data-tooltip]"))hidePortalTooltip();});

const __renderV4=render;
render=function(){__renderV4();applyFilterAudit();};
requestAnimationFrame(applyFilterAudit);
