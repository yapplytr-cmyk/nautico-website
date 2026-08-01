/* ═══════════════════════════════════════════
   NAUTICO WEBSITE — Get Tokens page
   Tokens power bids. Packs/plans come from Supabase
   (token_packs / membership_plans) with safe fallbacks.
   Purchases are in the iOS app today; web checkout later.
═══════════════════════════════════════════ */
(function () {
  var APP_URL = "https://apps.apple.com/tr/app/nautico/id6761394669";

  // Gold token coin with anchor emblem
  var TOKEN_SVG =
    '<svg viewBox="0 0 48 48" class="tk-coin" aria-hidden="true">' +
    '<circle cx="24" cy="25" r="21" fill="#b8860f"/>' +
    '<circle cx="24" cy="23" r="21" fill="#f5c542"/>' +
    '<circle cx="24" cy="23" r="16.5" fill="none" stroke="#d4a832" stroke-width="1.6"/>' +
    '<g fill="none" stroke="#8a6a1a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="24" cy="14.5" r="2.8"/><path d="M24 17.3v15"/><path d="M18 21.5h12"/>' +
    '<path d="M14.5 26.5c0 6 4.2 9.5 9.5 9.5s9.5-3.5 9.5-9.5"/><path d="M14.5 26.5l-2.6 2M33.5 26.5l2.6 2"/>' +
    "</g></svg>";
  var FALLBACK_PACKS = [
    { id: "pack-small", name: "Mini Pack", price_try: 349, tokens: 10 },
    { id: "pack-medium", name: "Value Pack", price_try: 749, tokens: 25 },
    { id: "pack-large", name: "Mega Pack", price_try: 1499, tokens: 60 }
  ];
  var FALLBACK_PLANS = [
    { id: "starter", name: "Starter", price_try: 499, tokens_per_month: 20 },
    { id: "pro", name: "Pro", price_try: 999, tokens_per_month: 50 },
    { id: "elite", name: "Elite", price_try: 1999, tokens_per_month: 120 }
  ];

  function esc(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function tl(v) {
    try { return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(v)); }
    catch (e) { return v + " ₺"; }
  }

  async function fetchRows(table, fallback) {
    try {
      if (!window.sb) return fallback;
      var res = await sb.from(table).select("*").eq("active", true).order("sort_order", { ascending: true });
      if (res.error || !res.data || !res.data.length) return fallback;
      return res.data;
    } catch (e) { return fallback; }
  }

  async function fetchBalance() {
    try {
      if (!window.sb || !window.currentUser && !currentUser) return null;
      var uid = (window.currentUser || currentUser).id;
      var res = await sb.rpc("get_token_status", { p_user_id: uid });
      var row = res && res.data ? (Array.isArray(res.data) ? res.data[0] : res.data) : null;
      return row && row.balance != null ? row.balance : null;
    } catch (e) { return null; }
  }

  function packCard(p, featured) {
    return (
      '<div class="tk-card' + (featured ? " tk-card--featured" : "") + '">' +
      (featured ? '<span class="tk-flag">Most popular</span>' : "") +
      TOKEN_SVG +
      '<div class="tk-tokens">' + esc(p.tokens || p.tokens_per_month) + '<span>tokens' + (p.tokens_per_month ? "/mo" : "") + "</span></div>" +
      '<div class="tk-name">' + esc(p.name) + "</div>" +
      '<div class="tk-price">' + tl(p.price_try) + (p.tokens_per_month ? '<span>/month</span>' : "") + "</div>" +
      '<a class="btn btn-primary tk-buy" href="' + APP_URL + '" target="_blank" rel="noopener">Buy in the app</a>' +
      "</div>"
    );
  }

  async function loadTokens() {
    var root = document.getElementById("tokens-root");
    if (!root) return;
    root.innerHTML = '<div class="mkt-empty">Loading…</div>';
    var results = await Promise.all([fetchRows("token_packs", FALLBACK_PACKS), fetchRows("membership_plans", FALLBACK_PLANS), fetchBalance()]);
    var packs = results[0], plans = results[1], balance = results[2];
    root.innerHTML =
      (balance != null
        ? '<div class="tk-balance">' + TOKEN_SVG + '<span>Your balance <strong>' + esc(balance) + " tokens</strong></span></div>"
        : "") +
      '<h2 class="tk-h">Token packs</h2>' +
      '<div class="tk-grid">' + packs.map(function (p, i) { return packCard(p, i === 1); }).join("") + "</div>" +
      '<h2 class="tk-h">Memberships <span class="tk-sub">monthly tokens + verified badge</span></h2>' +
      '<div class="tk-grid">' + plans.map(function (p, i) { return packCard(p, i === 1); }).join("") + "</div>" +
      '<p class="tk-note">Purchases are made in the Nautico iOS app for now — web checkout is coming. Tokens are spent when you bid on a job; posting jobs is free.</p>';
  }

  var css = document.createElement("style");
  css.textContent =
    ".tk-coin{width:52px;height:52px;margin:0 auto 10px;display:block;filter:drop-shadow(0 3px 8px rgba(245,197,66,.25))}" +
    ".tk-balance .tk-coin{width:26px;height:26px;margin:0;display:inline-block;vertical-align:middle}" +
    ".tk-balance{display:flex;align-items:center;gap:10px;justify-content:center}" +
    ".tk-h{font-size:1.15rem;margin:26px 0 14px;text-align:center}.tk-sub{font-size:.8rem;opacity:.6;font-weight:500}" +
    ".tk-grid{display:flex;gap:16px;justify-content:center;flex-wrap:wrap}" +
    ".tk-card{position:relative;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:26px 30px;text-align:center;min-width:180px}" +
    ".tk-card--featured{border-color:#f5c542;box-shadow:0 0 24px rgba(245,197,66,.12)}" +
    ".tk-flag{position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:#f5c542;color:#08131f;font-size:.66rem;font-weight:800;padding:3px 10px;border-radius:999px;letter-spacing:.04em;text-transform:uppercase}" +
    ".tk-tokens{font-size:2rem;font-weight:800}.tk-tokens span{display:block;font-size:.7rem;font-weight:600;opacity:.6;letter-spacing:.08em;text-transform:uppercase}" +
    ".tk-name{margin-top:6px;font-weight:700}.tk-price{margin:6px 0 14px;opacity:.85}.tk-price span{font-size:.75rem;opacity:.7}" +
    ".tk-balance{margin:4px auto 8px;text-align:center;background:rgba(245,197,66,.1);border:1px solid rgba(245,197,66,.4);border-radius:12px;padding:10px 16px;max-width:320px}" +
    ".tk-note{text-align:center;font-size:.82rem;opacity:.6;max-width:480px;margin:26px auto 0}";
  document.head.appendChild(css);

  window.loadTokens = loadTokens;
})();
