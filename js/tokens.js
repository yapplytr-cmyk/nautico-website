/* ═══════════════════════════════════════════
   NAUTICO WEBSITE — Get Tokens page
   Tokens power bids. Packs/plans come from Supabase
   (token_packs / membership_plans) with safe fallbacks.
   Web checkout via Stripe (/api/billing/*); the iOS app
   remains available as a fallback purchase path.
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

  function getUser() {
    try {
      if (window.currentUser) return window.currentUser;
      if (typeof currentUser !== "undefined" && currentUser) return currentUser;
    } catch (e) {}
    return null;
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
      var user = getUser();
      if (!window.sb || !user) return null;
      var res = await sb.rpc("get_token_status", { p_user_id: user.id });
      var row = res && res.data ? (Array.isArray(res.data) ? res.data[0] : res.data) : null;
      return row && row.balance != null ? row.balance : null;
    } catch (e) { return null; }
  }

  function priceOf(p) { return p.price != null ? p.price : p.price_try; }
  function packCard(p, featured, kind) {
    return (
      '<div class="tk-card' + (featured ? " tk-card--featured" : "") + '">' +
      (featured ? '<span class="tk-flag">Most popular</span>' : "") +
      TOKEN_SVG +
      '<div class="tk-tokens">' + esc(p.tokens || p.tokens_per_month) + '<span>tokens' + (p.tokens_per_month ? "/mo" : "") + "</span></div>" +
      '<div class="tk-name">' + esc(p.name) + "</div>" +
      '<div class="tk-price">' + tl(priceOf(p)) + (p.tokens_per_month ? '<span>/ay</span>' : "") + "</div>" +
      '<button type="button" class="btn btn-primary tk-buy" data-buy-kind="' + kind + '" data-buy-id="' + esc(p.id) + '">Buy with card</button>' +
      '<a class="tk-app-link" href="' + APP_URL + '" target="_blank" rel="noopener">or buy in the app</a>' +
      "</div>"
    );
  }

  // ── Stripe web checkout ──
  async function startCheckout(kind, id, btn) {
    var user = getUser();
    if (!user) {
      if (typeof navigate === "function") navigate("login");
      else location.hash = "#login";
      return;
    }
    var oldLabel = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "Redirecting…"; }
    try {
      var body = { userId: user.id, userEmail: user.email || "", embedded: false };
      if (kind === "plan") body.planId = id; else body.packId = id;
      var res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      var data = await res.json();
      if (data && data.ok && data.url) {
        location.href = data.url;
        return;
      }
      throw new Error((data && data.message) || "Checkout unavailable");
    } catch (e) {
      // Card checkout not available (config error, network, etc.) —
      // fall back to the existing App Store purchase path.
      window.open(APP_URL, "_blank", "noopener");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = oldLabel || "Buy with card"; }
    }
  }

  // ── Post-checkout return (?session_id=...) → confirm + success banner ──
  async function maybeShowReturnBanner(root) {
    var params;
    try { params = new URLSearchParams(location.search); } catch (e) { return; }
    var sessionId = params.get("session_id");
    var checkout = params.get("checkout");
    if (!sessionId && checkout !== "cancel") return;

    // Clean the query string so refreshes don't re-trigger the check.
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {}

    if (!sessionId) return; // canceled — nothing to confirm

    var banner = document.createElement("div");
    banner.className = "tk-success";
    banner.innerHTML = TOKEN_SVG + "<span>Confirming your purchase…</span>";
    root.insertBefore(banner, root.firstChild);

    try {
      var res = await fetch("/api/billing/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId })
      });
      var data = await res.json();
      if (data && data.ok && data.paid) {
        var balance = await fetchBalance();
        banner.innerHTML =
          TOKEN_SVG +
          "<span><strong>Payment successful!</strong> Your tokens are on the way." +
          (balance != null ? " Balance: <strong>" + esc(balance) + " tokens</strong>." : "") +
          "</span>";
      } else {
        banner.innerHTML = TOKEN_SVG + "<span>Payment not completed" + (data && data.status ? " (" + esc(data.status) + ")" : "") + ". You have not been charged.</span>";
        banner.classList.add("tk-success--warn");
      }
    } catch (e) {
      banner.innerHTML = TOKEN_SVG + "<span>We could not confirm the payment yet — your tokens will appear shortly.</span>";
      banner.classList.add("tk-success--warn");
    }
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
      '<div class="tk-grid">' + packs.map(function (p, i) { return packCard(p, i === 1, "pack"); }).join("") + "</div>" +
      '<h2 class="tk-h">Memberships <span class="tk-sub">monthly tokens + verified badge</span></h2>' +
      '<div class="tk-grid">' + plans.map(function (p, i) { return packCard(p, i === 1, "plan"); }).join("") + "</div>" +
      '<p class="tk-note">Pay securely by card, or buy in the Nautico iOS app. Tokens are spent when you bid on a job; posting jobs is free.</p>';

    if (!root.dataset.tkBound) {
      root.dataset.tkBound = "1";
      root.addEventListener("click", function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest("[data-buy-kind]") : null;
        if (!btn) return;
        ev.preventDefault();
        startCheckout(btn.getAttribute("data-buy-kind"), btn.getAttribute("data-buy-id"), btn);
      });
    }

    maybeShowReturnBanner(root);
  }

  var css = document.createElement("style");
  css.textContent =
    ".tk-coin{width:52px;height:52px;margin:0 auto 10px;display:block;filter:drop-shadow(0 3px 8px rgba(245,197,66,.25))}" +
    ".tk-balance .tk-coin,.tk-success .tk-coin{width:26px;height:26px;margin:0;display:inline-block;vertical-align:middle}" +
    ".tk-balance{display:flex;align-items:center;gap:10px;justify-content:center}" +
    ".tk-h{font-size:1.15rem;margin:26px 0 14px;text-align:center}.tk-sub{font-size:.8rem;opacity:.6;font-weight:500}" +
    ".tk-grid{display:flex;gap:16px;justify-content:center;flex-wrap:wrap}" +
    ".tk-card{position:relative;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:26px 30px;text-align:center;min-width:180px}" +
    ".tk-card--featured{border-color:#f5c542;box-shadow:0 0 24px rgba(245,197,66,.12)}" +
    ".tk-flag{position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:#f5c542;color:#08131f;font-size:.66rem;font-weight:800;padding:3px 10px;border-radius:999px;letter-spacing:.04em;text-transform:uppercase}" +
    ".tk-tokens{font-size:2rem;font-weight:800}.tk-tokens span{display:block;font-size:.7rem;font-weight:600;opacity:.6;letter-spacing:.08em;text-transform:uppercase}" +
    ".tk-name{margin-top:6px;font-weight:700}.tk-price{margin:6px 0 14px;opacity:.85}.tk-price span{font-size:.75rem;opacity:.7}" +
    ".tk-buy{width:100%;cursor:pointer}" +
    ".tk-app-link{display:block;margin-top:8px;font-size:.72rem;opacity:.55;text-decoration:underline}" +
    ".tk-app-link:hover{opacity:.85}" +
    ".tk-balance{margin:4px auto 8px;text-align:center;background:rgba(245,197,66,.1);border:1px solid rgba(245,197,66,.4);border-radius:12px;padding:10px 16px;max-width:320px}" +
    ".tk-success{display:flex;align-items:center;gap:10px;justify-content:center;margin:4px auto 16px;text-align:center;background:rgba(66,245,131,.1);border:1px solid rgba(66,245,131,.45);border-radius:12px;padding:12px 16px;max-width:480px}" +
    ".tk-success--warn{background:rgba(245,197,66,.1);border-color:rgba(245,197,66,.45)}" +
    ".tk-note{text-align:center;font-size:.82rem;opacity:.6;max-width:480px;margin:26px auto 0}";
  document.head.appendChild(css);

  window.loadTokens = loadTokens;
})();
