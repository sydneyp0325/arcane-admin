// =====================================================================
// Arcane HQ — standalone platform/business console (admin.arcaneleadsolutions.com)
// Own login. Same Supabase project as the agent app; reads across all tenants.
// Access gated to agents.is_platform_admin (RLS on platform_* RPCs + client check).
// =====================================================================
const cfg = window.APP_CONFIG;
const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
const $ = (s) => document.querySelector(s);

// ---- helpers ----
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString();
const money2 = (n) => "$" + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const initials = (s) => String(s || "").trim().split(/\s+/).slice(0, 2).map((x) => x[0] || "").join("").toUpperCase() || "?";
const skelTable = () => `<div class="coming" style="padding:48px"><span class="muted2">Loading…</span></div>`;
function toast(msg) {
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = "position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:var(--card-2,#141a24);color:var(--tx,#f2f1ec);border:1px solid var(--line,#232c3a);padding:10px 16px;border-radius:10px;font-size:13px;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.4);opacity:0;transition:opacity .18s";
  document.body.appendChild(t);
  requestAnimationFrame(() => (t.style.opacity = "1"));
  setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 250); }, 2200);
}

let ME = null;

// ---- boot / auth ----
async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return showLogin();
  await loadMe();
}
async function loadMe() {
  const { data: { user } } = await sb.auth.getUser();
  ME = null;
  try { ME = (await sb.from("agents").select("id,full_name,email,is_platform_admin,tenant_id").eq("user_id", user.id).maybeSingle()).data; } catch { }
  if (!ME || !ME.is_platform_admin) return showDenied();
  renderApp();
}

function shell(inner) {
  return `<div class="hq-auth"><div class="hq-card">
    <div class="hq-logo"><i class="ti ti-building-skyscraper"></i> ARCANE <span>HQ</span></div>
    ${inner}
  </div></div>`;
}
function showLogin() {
  $("#root").innerHTML = shell(`
    <div class="hq-sub">Platform console — sign in</div>
    <div class="field"><label>Email</label><input class="in" id="lg-email" type="email" autocomplete="username" placeholder="you@arcaneleadsolutions.com"></div>
    <div class="field"><label>Password</label><input class="in" id="lg-pass" type="password" autocomplete="current-password" placeholder="••••••••"></div>
    <div id="lg-err" style="color:var(--red);font-size:12px;min-height:16px"></div>
    <button class="btn-gold btn-block" id="lg-go">Sign in</button>`);
  const go = () => doSignIn();
  $("#lg-go").addEventListener("click", go);
  $("#lg-pass").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  $("#lg-email").focus();
}
async function doSignIn() {
  const email = $("#lg-email").value.trim(), password = $("#lg-pass").value;
  const btn = $("#lg-go"), err = $("#lg-err");
  if (!email || !password) { err.textContent = "Enter your email and password."; return; }
  btn.disabled = true; btn.textContent = "Signing in…"; err.textContent = "";
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { btn.disabled = false; btn.textContent = "Sign in"; err.textContent = error.message; return; }
  await loadMe();
}
function showDenied() {
  $("#root").innerHTML = shell(`
    <div class="hq-sub">Not authorized</div>
    <p class="muted2" style="line-height:1.5">This is the Arcane platform console. Your account isn't a platform admin, so there's nothing here for you — head to the agent portal instead.</p>
    <a class="btn-gold btn-block" href="https://app.arcaneleadsolutions.com" style="text-decoration:none;justify-content:center;display:inline-flex">Go to the agent portal</a>
    <button class="btn-ghost btn-block" id="dn-out" style="margin-top:8px">Sign out</button>`);
  $("#dn-out").addEventListener("click", signOut);
}
async function signOut() { await sb.auth.signOut(); location.reload(); }

function renderApp() {
  $("#root").innerHTML = `
    <div class="hq">
      <header class="hq-top">
        <div class="hq-brand"><i class="ti ti-building-skyscraper"></i> ARCANE <span>HQ</span></div>
        <div class="hq-topright">
          <span class="hq-avatar">${esc(initials(ME.full_name || ME.email))}</span>
          <span class="hq-who">${esc((ME.full_name || ME.email || "").split(" ")[0])}</span>
          <button class="btn-ghost sm" id="hq-signout"><i class="ti ti-logout"></i> Sign out</button>
        </div>
      </header>
      <main class="hq-main"><div id="content">${skelTable()}</div></main>
    </div>`;
  $("#hq-signout").addEventListener("click", signOut);
  loadBusiness();
}

// ---------------------------------------------------------------- business console
const BIZ_TABS = [["overview", "Overview", "ti-chart-bar"], ["tenants", "Tenants", "ti-building-community"], ["leads", "Leads", "ti-users"], ["sales", "Sales", "ti-coin"], ["calls", "Calls", "ti-phone"], ["activity", "Activity", "ti-history"]];
const BIZ_TYPE = { in_house: "In House", imo: "IMO", agency: "Agency" };
let BIZ_TAB = "overview", BIZ_TENANTS = [];
function loadBusiness() {
  const c = $("#content");
  c.innerHTML = `<div class="pf-hero"><div class="pf-hero-ic"><i class="ti ti-building-skyscraper"></i></div><div><div class="pf-hero-t">Business</div><div class="pf-hero-s">Arcane platform — revenue, tenants, leads &amp; sales across everything.</div></div></div>
    <div class="pf-tabs">${BIZ_TABS.map(([id, lab, ic]) => `<span class="pf-tab ${BIZ_TAB === id ? "on" : ""}" data-biz="${id}"><i class="ti ${ic}"></i> ${lab}</span>`).join("")}</div>
    <div id="biz-body">${skelTable()}</div>`;
  c.querySelectorAll("[data-biz]").forEach((t) => t.addEventListener("click", () => { BIZ_TAB = t.dataset.biz; loadBusiness(); }));
  ({ overview: bizOverview, tenants: bizTenants, leads: bizLeads, sales: bizSales, calls: bizCalls, activity: bizActivity })[BIZ_TAB]();
}
async function bizOverview() {
  const b = $("#biz-body");
  let t = null;
  try { t = (await sb.rpc("platform_totals")).data?.[0]; } catch { b.innerHTML = `<div class="coming"><b>Platform admins only</b></div>`; return; }
  if (!t) { b.innerHTML = `<div class="coming"><div class="muted2">No data yet.</div></div>`; return; }
  const cards = [
    ["ic-purple", "ti-coin", "Arcane revenue", money2(t.arcane_revenue)],
    ["ic-blue", "ti-building-community", "Tenants", t.tenants],
    ["ic-green", "ti-users", "Agents", `${t.active_agents}/${t.agents}`],
    ["ic-amber", "ti-user-plus", "Leads", (+t.leads).toLocaleString()],
    ["ic-green", "ti-file-check", "Deals", t.deals],
    ["ic-purple", "ti-coin", "Total AP", money(t.ap)],
    ["ic-amber", "ti-wallet", "Wallet float", money(t.wallet_float)],
  ].map(([ic, icon, k, v]) => `<div class="stat"><span class="ic ${ic}"><i class="ti ${icon}"></i></span><div><div class="lab">${k}</div><div class="val num">${v}</div></div></div>`).join("");
  b.innerHTML = `<div class="stat-grid">${cards}</div><div class="muted2" style="margin-top:2px">Arcane revenue = In-House margin + Σ(IMO/self-gen × share) + Σ(buy-Arcane cuts). Dialer-subscription revenue reads $0 until that plan ships.</div>`;
}
async function bizTenants() {
  const b = $("#biz-body");
  try { BIZ_TENANTS = (await sb.rpc("platform_tenants")).data || []; } catch { b.innerHTML = `<div class="coming"><b>Platform admins only</b></div>`; return; }
  const shareOf = (r) => r.tenant_type === "in_house" ? "100%" : (r.tenant_type === "agency" && r.lead_mode === "buy_arcane") ? `${r.lead_markup_pct ?? 0}% mk` : `${r.revenue_share_pct ?? 0}%`;
  const rows = BIZ_TENANTS.map((r) => `<tr>
      <td><b>${esc(r.name || r.slug)}</b><div class="muted2">${esc(r.slug)}</div></td>
      <td><span class="pill ${r.tenant_type === "in_house" ? "gold" : r.tenant_type === "imo" ? "blue" : "grey"}">${BIZ_TYPE[r.tenant_type] || r.tenant_type}</span></td>
      <td>${r.tenant_type === "agency" ? (r.lead_mode === "buy_arcane" ? "Buys Arcane" : "Self-gen") : "—"}</td>
      <td style="text-align:right">${shareOf(r)}</td>
      <td style="text-align:right">${r.agents}</td>
      <td style="text-align:right">${(+r.leads).toLocaleString()}</td>
      <td style="text-align:right">${money(r.ap)}</td>
      <td style="text-align:right">${money2(r.gross_revenue)}</td>
      <td style="text-align:right;color:var(--gold);font-weight:600">${money2(r.arcane_cut)}</td>
      <td style="text-align:right;white-space:nowrap"><button class="btn-ghost sm" data-imp="${r.tenant_id}" data-imp-name="${esc(r.name || r.slug)}" title="Log in as an agent in this tenant"><i class="ti ti-user-shield"></i></button> <button class="btn-ghost sm" data-cfg="${r.tenant_id}" title="Config"><i class="ti ti-adjustments"></i></button></td>
    </tr>`).join("");
  b.innerHTML = `<div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="btn-gold" id="biz-new"><i class="ti ti-plus"></i> New tenant</button></div>
    <div class="panel"><table class="data-tbl"><thead><tr><th>Tenant</th><th>Type</th><th>Lead mode</th><th style="text-align:right">Take</th><th style="text-align:right">Agents</th><th style="text-align:right">Leads</th><th style="text-align:right">AP</th><th style="text-align:right">Gross rev</th><th style="text-align:right">Arcane cut</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  b.querySelectorAll("[data-cfg]").forEach((x) => x.addEventListener("click", () => openTenantConfig(BIZ_TENANTS.find((t) => t.tenant_id === x.dataset.cfg))));
  b.querySelectorAll("[data-imp]").forEach((x) => x.addEventListener("click", () => openImpersonatePicker(x.dataset.imp, x.dataset.impName)));
  $("#biz-new")?.addEventListener("click", openNewTenant);
}
// Log in as any agent in a tenant (platform admins only) to help them.
async function openImpersonatePicker(tenantId, tenantName) {
  const m = document.createElement("div"); m.className = "modal-bg";
  m.innerHTML = `<div class="modal" style="width:440px;max-height:80vh;display:flex;flex-direction:column"><div class="modal-h"><span><i class="ti ti-user-shield" style="color:var(--gold)"></i> Log in as — ${esc(tenantName || "tenant")}</span><i class="ti ti-x" id="ip-x" style="cursor:pointer;color:var(--tx3)"></i></div>
    <div class="modal-b" style="overflow:auto"><div class="muted2" style="margin-bottom:8px">Pick an agent to open their portal and act on their behalf. This is logged.</div><div id="ip-list"><div class="muted2">Loading agents…</div></div></div></div>`;
  document.body.appendChild(m);
  const close = () => m.remove();
  m.addEventListener("click", (e) => { if (e.target === m) close(); });
  $("#ip-x").addEventListener("click", close);
  let agents = [];
  try { agents = (await sb.rpc("platform_agents", { p_tenant: tenantId })).data || []; }
  catch (e) { $("#ip-list").innerHTML = `<div class="muted2" style="color:var(--red)">${esc(e.message || "Couldn't load agents")}</div>`; return; }
  if (!agents.length) { $("#ip-list").innerHTML = `<div class="muted2">No agents in this tenant yet.</div>`; return; }
  $("#ip-list").innerHTML = agents.map((a) => `<div class="ip-row" style="display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:1px solid var(--line)">
      <div style="flex:1;min-width:0"><div style="font-weight:600">${esc(a.full_name || a.email)} ${a.access_level === "admin" ? '<span class="pill gold" style="margin-left:4px">Admin</span>' : ""}</div><div class="muted2">${esc(a.email || "")}</div></div>
      ${a.has_login ? `<button class="btn-gold sm" data-login="${a.agent_id}" data-name="${esc(a.full_name || a.email || "agent")}"><i class="ti ti-login-2"></i> Log in as</button>` : `<span class="muted2" title="Agent hasn't created a login yet">No login</span>`}
    </div>`).join("");
  $("#ip-list").querySelectorAll("[data-login]").forEach((btn) => btn.addEventListener("click", async () => {
    btn.disabled = true; btn.innerHTML = `<i class="ti ti-loader"></i> Opening…`;
    const { data, error } = await sb.functions.invoke("admin-impersonate", { body: { agent_id: btn.dataset.login } });
    if (error || data?.error) { btn.disabled = false; btn.innerHTML = `<i class="ti ti-login-2"></i> Log in as`; toast((data?.error || error?.message) || "Couldn't start session"); return; }
    const url = `https://app.arcaneleadsolutions.com/?impersonate=${encodeURIComponent(data.token_hash)}&as=${encodeURIComponent(data.name || btn.dataset.name)}`;
    window.open(url, "_blank"); close();
  }));
}
function openTenantConfig(r) {
  if (!r) return;
  const m = document.createElement("div"); m.className = "modal-bg";
  m.innerHTML = `<div class="modal" style="width:460px"><div class="modal-h"><span><i class="ti ti-adjustments" style="color:var(--gold)"></i> ${esc(r.name || r.slug)} — config</span><i class="ti ti-x" id="tc-x" style="cursor:pointer;color:var(--tx3)"></i></div>
    <div class="modal-b">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="field"><label>Tenant type</label><select class="in" id="tc-type">${Object.entries(BIZ_TYPE).map(([v, l]) => `<option value="${v}" ${r.tenant_type === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="field"><label>Lead mode</label><select class="in" id="tc-mode"><option value="internal" ${r.lead_mode === "internal" ? "selected" : ""}>Self-gen / internal</option><option value="buy_arcane" ${r.lead_mode === "buy_arcane" ? "selected" : ""}>Buys Arcane leads</option></select></div>
        <div class="field"><label>Revenue share %<div class="muted2" style="font-weight:400">IMO / self-gen</div></label><input class="in" id="tc-rev" type="number" step="0.1" value="${r.revenue_share_pct ?? ""}"></div>
        <div class="field"><label>Lead markup %<div class="muted2" style="font-weight:400">buy-Arcane</div></label><input class="in" id="tc-mk" type="number" step="0.1" value="${r.lead_markup_pct ?? ""}"></div>
        <div class="field"><label>Dialer share %<div class="muted2" style="font-weight:400">buy-Arcane</div></label><input class="in" id="tc-dl" type="number" step="0.1" value="${r.dialer_share_pct ?? ""}"></div>
      </div>
      <div id="tc-err" style="color:var(--red);font-size:12px;min-height:14px"></div>
      <div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn-ghost" id="tc-cancel">Cancel</button><button class="btn-gold" id="tc-save"><i class="ti ti-check"></i> Save</button></div>
    </div></div>`;
  document.body.appendChild(m);
  const close = () => m.remove();
  m.addEventListener("click", (e) => { if (e.target === m) close(); });
  $("#tc-x").addEventListener("click", close); $("#tc-cancel").addEventListener("click", close);
  $("#tc-save").addEventListener("click", async () => {
    const btn = $("#tc-save"); btn.disabled = true; btn.textContent = "Saving…";
    const num = (id) => { const v = parseFloat($(id).value); return Number.isFinite(v) ? v : null; };
    const { error } = await sb.rpc("set_tenant_config", { p_tenant: r.tenant_id, p_type: $("#tc-type").value, p_lead_mode: $("#tc-mode").value, p_revenue_share: num("#tc-rev"), p_dialer_share: num("#tc-dl"), p_markup: num("#tc-mk") });
    if (error) { btn.disabled = false; btn.textContent = "Save"; $("#tc-err").textContent = error.message; return; }
    close(); toast("Tenant config saved"); bizTenants();
  });
}
function openNewTenant() {
  const m = document.createElement("div"); m.className = "modal-bg";
  m.innerHTML = `<div class="modal" style="width:420px"><div class="modal-h"><span><i class="ti ti-building-plus" style="color:var(--gold)"></i> New tenant</span><i class="ti ti-x" id="nt-x" style="cursor:pointer;color:var(--tx3)"></i></div>
    <div class="modal-b">
      <div class="field"><label>Agency name *</label><input class="in" id="nt-name" placeholder="e.g. Summit Insurance"></div>
      <div class="field"><label>Slug *<div class="muted2" style="font-weight:400">used in the invite link · lowercase, no spaces</div></label><input class="in" id="nt-slug" placeholder="summit"></div>
      <div class="field"><label>Admin email<div class="muted2" style="font-weight:400">becomes the agency admin on signup</div></label><input class="in" id="nt-email" type="email" placeholder="owner@agency.com"></div>
      <div id="nt-err" style="color:var(--red);font-size:12px;min-height:14px"></div>
      <div class="muted2" style="font-size:11px;margin-bottom:8px">Created as an <b>Agency</b> — set its type/take in the config after.</div>
      <div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn-ghost" id="nt-cancel">Cancel</button><button class="btn-gold" id="nt-go"><i class="ti ti-check"></i> Create</button></div>
    </div></div>`;
  document.body.appendChild(m);
  const close = () => m.remove();
  m.addEventListener("click", (e) => { if (e.target === m) close(); });
  $("#nt-x").addEventListener("click", close); $("#nt-cancel").addEventListener("click", close);
  $("#nt-go").addEventListener("click", async () => {
    const name = $("#nt-name").value.trim(), slug = $("#nt-slug").value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!name || !slug) { $("#nt-err").textContent = "Name and slug are required."; return; }
    const btn = $("#nt-go"); btn.disabled = true; btn.textContent = "Creating…";
    const { error } = await sb.rpc("create_tenant", { p_slug: slug, p_name: name, p_brand_name: name, p_admin_email: $("#nt-email").value.trim() || null });
    if (error) { btn.disabled = false; btn.textContent = "Create"; $("#nt-err").textContent = error.message; return; }
    close(); toast("Tenant created"); bizTenants();
  });
}
async function bizLeads() {
  const b = $("#biz-body");
  let rows = [];
  try { rows = (await sb.rpc("platform_leads_by_source")).data || []; } catch { b.innerHTML = `<div class="coming"><b>Platform admins only</b></div>`; return; }
  if (!rows.length) { b.innerHTML = `<div class="coming"><div class="badge"><i class="ti ti-users"></i></div><b>No leads yet</b></div>`; return; }
  b.innerHTML = `<div class="panel"><table class="data-tbl"><thead><tr><th>Tenant</th><th>Source</th><th style="text-align:right">Leads</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.tenant || "—")}</td><td>${esc(r.source)}</td><td style="text-align:right">${(+r.leads).toLocaleString()}</td></tr>`).join("")}</tbody></table></div>`;
}
async function bizSales() {
  const b = $("#biz-body");
  let rows = [];
  try { rows = (await sb.rpc("platform_sales")).data || []; } catch { b.innerHTML = `<div class="coming"><b>Platform admins only</b></div>`; return; }
  if (!rows.length) { b.innerHTML = `<div class="coming"><div class="badge"><i class="ti ti-coin"></i></div><b>No sales yet</b></div>`; return; }
  b.innerHTML = `<div class="panel"><table class="data-tbl"><thead><tr><th>Tenant</th><th>Carrier</th><th style="text-align:right">Deals</th><th style="text-align:right">AP</th><th style="text-align:right">Call deals</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.tenant || "—")}</td><td>${esc(r.carrier)}</td><td style="text-align:right">${r.deals}</td><td style="text-align:right">${money(r.ap)}</td><td style="text-align:right">${r.call_deals}</td></tr>`).join("")}</tbody></table></div>`;
}
// Platform-wide inbound call log across every tenant.
const CALL_PILL = { received: "grey", routed: "yellow", connected: "green", completed: "blue", missed: "red", no_agent: "red", failed: "red" };
async function bizCalls() {
  const b = $("#biz-body");
  let rows = [];
  try { rows = (await sb.rpc("platform_call_log")).data || []; }
  catch { b.innerHTML = `<div class="coming"><b>Platform admins only</b></div>`; return; }
  if (!rows.length) { b.innerHTML = `<div class="coming"><div class="badge"><i class="ti ti-phone"></i></div><b>No calls yet</b></div>`; return; }
  const fmt = (t) => { try { return new Date(t).toLocaleString(); } catch { return t; } };
  const dur = (s) => { s = +s || 0; return s ? Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") : "—"; };
  const connN = rows.filter(r => r.connected || r.status === "connected" || r.status === "completed").length;
  const spend = rows.reduce((s, r) => s + (r.billable ? +r.price || 0 : 0), 0);
  const body = rows.map(r => `<tr>
    <td>${esc(fmt(r.started_at))}</td>
    <td><span class="pill grey">${esc(r.tenant || "—")}</span></td>
    <td>${r.agent_name ? esc(r.agent_name) : '<span class="muted2">— no agent</span>'}</td>
    <td>${esc(r.caller_number || "—")}${r.caller_state ? ` · ${esc(r.caller_state)}` : ""}</td>
    <td><span class="pill ${CALL_PILL[r.status] || "grey"}">${esc(r.status)}</span></td>
    <td style="text-align:right">${dur(r.talk_sec)}</td>
    <td style="text-align:right">${r.billable ? money(r.price) : '<span class="muted2">—</span>'}</td>
    <td style="text-align:right">${r.deal_id ? '<span class="pill green">Sold</span>' : "—"}</td>
  </tr>`).join("");
  b.innerHTML = `<div class="muted2" style="margin-bottom:8px">Every inbound call across all tenants (last 500). ${rows.length} calls · ${connN} connected · ${money(spend)} billed.</div>
    <div class="panel"><table class="data-tbl"><thead><tr><th>When</th><th>Tenant</th><th>Agent</th><th>Caller</th><th>Status</th><th style="text-align:right">Talk</th><th style="text-align:right">Billable</th><th style="text-align:right">Deal</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

// Impersonation audit trail — who logged in as whom, when.
async function bizActivity() {
  const b = $("#biz-body");
  let rows = [];
  try { rows = (await sb.from("impersonation_log").select("created_at, admin_email, target_email, tenants(slug,name)").order("created_at", { ascending: false }).limit(200)).data || []; }
  catch { b.innerHTML = `<div class="coming"><b>Platform admins only</b></div>`; return; }
  if (!rows.length) { b.innerHTML = `<div class="coming"><div class="badge"><i class="ti ti-history"></i></div><b>No support sessions yet</b><div>When you log in as an agent, it's recorded here.</div></div>`; return; }
  const fmt = (t) => { try { return new Date(t).toLocaleString(); } catch { return t; } };
  b.innerHTML = `<div class="muted2" style="margin-bottom:8px">Every "Log in as" session, most recent first (last 200).</div>
    <div class="panel"><table class="data-tbl"><thead><tr><th>When</th><th>Platform admin</th><th>Logged in as</th><th>Tenant</th></tr></thead><tbody>${rows.map((r) => `<tr>
      <td>${esc(fmt(r.created_at))}</td>
      <td>${esc(r.admin_email || "—")}</td>
      <td><i class="ti ti-user-shield" style="color:var(--gold);margin-right:5px"></i>${esc(r.target_email || "—")}</td>
      <td>${esc(r.tenants?.name || r.tenants?.slug || "—")}</td>
    </tr>`).join("")}</tbody></table></div>`;
}

boot();
