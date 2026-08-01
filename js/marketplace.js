/* ═══════════════════════════════════════════
   NAUTICO WEBSITE — Marketplace
   Mirrors the app + yapplytr.com: browse open marine jobs,
   view a listing + its bids, and (when logged in) post a job.
   Uses the shared `sb` Supabase client from app.js.
═══════════════════════════════════════════ */
(function () {
  var CATEGORIES = [
    { id: "", en: "All" },
    { id: "wash_detail", en: "Wash & Detailing" },
    { id: "antifoul", en: "Antifouling" },
    { id: "mechanical", en: "Mechanical" },
    { id: "electrical", en: "Electrical" },
    { id: "upholstery", en: "Upholstery" },
    { id: "winterization", en: "Winterization" },
    { id: "captain_delivery", en: "Captain & Delivery" },
    { id: "other", en: "Other" }
  ];
  var CAT_LABEL = {};
  CATEGORIES.forEach(function (c) { if (c.id) CAT_LABEL[c.id] = c.en; });

  var state = { category: "", listings: [], loaded: false };

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function money(v, cur) {
    if (v == null || v === "") return "Open budget";
    try { return new Intl.NumberFormat("tr-TR", { style: "currency", currency: cur || "TRY", maximumFractionDigits: 0 }).format(Number(v)); }
    catch (e) { return (v || "") + " " + (cur || "TRY"); }
  }
  function lenM(v) { return (v == null || v === "") ? "—" : Number(v) + " m"; }
  function when(v) {
    if (!v) return "";
    try { return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(v)); }
    catch (e) { return ""; }
  }
  function ready() { if (!window.sb && typeof initSupabase === "function") initSupabase(); return !!window.sb; }

  function root() { return document.getElementById("marketplace-root"); }

  async function fetchListings() {
    if (!ready()) return [];
    var q = sb.from("marketplace_listings")
      .select("id,status,title,description,category,location,boat_length_m,budget,currency,timeframe,created_at,listing_bids(id)")
      .eq("status", "open-for-bids")
      .order("created_at", { ascending: false })
      .limit(60);
    if (state.category) q = q.eq("category", state.category);
    var res = await q;
    if (res.error) { console.log("[nautico] listings:", res.error.message); return []; }
    return res.data || [];
  }

  function card(l) {
    var bids = (l.listing_bids || []).length;
    return (
      '<button class="mkt-card" data-id="' + esc(l.id) + '">' +
        '<div class="mkt-card-top">' +
          '<span class="mkt-badge">' + esc(CAT_LABEL[l.category] || "Service") + "</span>" +
          '<span class="mkt-bids">' + bids + (bids === 1 ? " bid" : " bids") + "</span>" +
        "</div>" +
        '<div class="mkt-title">' + esc(l.title || "Marine job") + "</div>" +
        (l.location ? '<div class="mkt-loc">' + esc(l.location) + "</div>" : "") +
        '<div class="mkt-facts">' +
          '<div><span>Length</span><strong>' + esc(lenM(l.boat_length_m)) + "</strong></div>" +
          '<div><span>Budget</span><strong>' + esc(money(l.budget, l.currency)) + "</strong></div>" +
          '<div><span>When</span><strong>' + esc(l.timeframe || when(l.created_at) || "—") + "</strong></div>" +
        "</div>" +
      "</button>"
    );
  }

  function shell() {
    var chips = CATEGORIES.map(function (c) {
      return '<button class="mkt-chip' + (c.id === state.category ? " is-active" : "") + '" data-cat="' + c.id + '">' + esc(c.en) + "</button>";
    }).join("");
    return (
      '<div class="mkt-head">' +
        "<h1>Marine Services Marketplace</h1>" +
        "<p>Post a job on your vessel — local marine pros bid. Accept the best offer and track the work to completion.</p>" +
        '<div class="mkt-actions">' +
          '<button class="btn btn-primary" id="mkt-post-btn">Post a job</button>' +
          '<a class="btn btn-outline" href="https://apps.apple.com/tr/app/nautico/id6761394669" target="_blank">Get the app to bid</a>' +
        "</div>" +
      "</div>" +
      '<div class="mkt-chips">' + chips + "</div>" +
      '<div class="mkt-grid" id="mkt-grid"></div>'
    );
  }

  async function renderGrid() {
    var grid = document.getElementById("mkt-grid");
    if (!grid) return;
    grid.innerHTML = '<div class="mkt-empty">Loading listings…</div>';
    state.listings = await fetchListings();
    if (!state.listings.length) {
      grid.innerHTML = '<div class="mkt-empty">No open jobs in this category yet. Be the first to post one.</div>';
      return;
    }
    grid.innerHTML = state.listings.map(card).join("");
    grid.querySelectorAll(".mkt-card").forEach(function (el) {
      el.addEventListener("click", function () { openDetail(el.getAttribute("data-id")); });
    });
  }

  async function loadMarketplace() {
    var r = root();
    if (!r) return;
    if (!r.getAttribute("data-init")) {
      r.setAttribute("data-init", "1");
      r.innerHTML = shell();
      r.querySelector("#mkt-post-btn").addEventListener("click", openCreate);
      r.querySelectorAll(".mkt-chip").forEach(function (ch) {
        ch.addEventListener("click", function () {
          state.category = ch.getAttribute("data-cat");
          r.querySelectorAll(".mkt-chip").forEach(function (x) { x.classList.remove("is-active"); });
          ch.classList.add("is-active");
          renderGrid();
        });
      });
    }
    renderGrid();
  }

  /* ── Listing detail (modal) ── */
  async function openDetail(id) {
    if (!ready()) return;
    var res = await sb.from("marketplace_listings")
      .select("id,status,title,description,category,location,boat_length_m,budget,currency,timeframe,created_at," +
              "listing_bids(id,company_name,bid_amount,currency,estimated_timeframe,proposal_message,created_at)")
      .eq("id", id).single();
    if (res.error || !res.data) return;
    var l = res.data;
    var bids = (l.listing_bids || []).slice().sort(function (a, b) { return (a.bid_amount || 0) - (b.bid_amount || 0); });
    var bidsHtml = bids.length
      ? bids.map(function (b) {
          return '<div class="mkt-bid"><div class="mkt-bid-top"><strong>' + esc(b.company_name || "Marine pro") + "</strong>" +
            "<span>" + esc(money(b.bid_amount, b.currency)) + "</span></div>" +
            (b.estimated_timeframe ? '<div class="mkt-bid-sub">' + esc(b.estimated_timeframe) + "</div>" : "") +
            (b.proposal_message ? '<div class="mkt-bid-msg">' + esc(b.proposal_message) + "</div>" : "") + "</div>";
        }).join("")
      : '<div class="mkt-empty">No bids yet — pros bid from the Nautico app.</div>';

    showModal(
      '<div class="mkt-detail">' +
        '<span class="mkt-badge">' + esc(CAT_LABEL[l.category] || "Service") + "</span>" +
        "<h2>" + esc(l.title || "Marine job") + "</h2>" +
        (l.location ? '<div class="mkt-loc">' + esc(l.location) + "</div>" : "") +
        (l.description ? "<p>" + esc(l.description) + "</p>" : "") +
        '<div class="mkt-facts wide">' +
          '<div><span>Length</span><strong>' + esc(lenM(l.boat_length_m)) + "</strong></div>" +
          '<div><span>Budget</span><strong>' + esc(money(l.budget, l.currency)) + "</strong></div>" +
          '<div><span>Timeframe</span><strong>' + esc(l.timeframe || "—") + "</strong></div>" +
        "</div>" +
        "<h3>Bids (" + bids.length + ")</h3>" + bidsHtml +
      "</div>"
    );
  }

  /* ── Post a job (owner) ── */
  function openCreate() {
    if (!currentUser) {
      showModal('<div class="mkt-detail"><h2>Log in to post a job</h2>' +
        '<p>You need a Nautico account to post a listing.</p>' +
        '<button class="btn btn-primary" onclick="closeMktModal();navigate(\'login\')">Go to login</button></div>');
      return;
    }
    var opts = CATEGORIES.filter(function (c) { return c.id; })
      .map(function (c) { return '<option value="' + c.id + '">' + esc(c.en) + "</option>"; }).join("");
    showModal(
      '<div class="mkt-detail"><h2>Post a job</h2>' +
      '<form id="mkt-create-form" class="mkt-form">' +
        '<label>Service<select name="category" class="mkt-in">' + opts + "</select></label>" +
        '<label>Title<input name="title" class="mkt-in" maxlength="90" placeholder="Hull wash & polish before season" required></label>' +
        '<label>Details<textarea name="description" class="mkt-in" rows="3" placeholder="What needs doing, condition, access, timing…"></textarea></label>' +
        '<div class="mkt-form-row">' +
          '<label>Boat length (m)<input name="boatLengthM" class="mkt-in" type="number" step="0.1" min="0" placeholder="12.5"></label>' +
          '<label>Budget (₺)<input name="budget" class="mkt-in" type="number" step="1" min="0" placeholder="5000"></label>' +
        "</div>" +
        '<div class="mkt-form-row">' +
          '<label>Location / marina<input name="location" class="mkt-in" maxlength="90" placeholder="Bodrum Marina"></label>' +
          '<label>Timeframe<input name="timeframe" class="mkt-in" maxlength="60" placeholder="This month"></label>' +
        "</div>" +
        '<div class="mkt-form-err" id="mkt-create-err"></div>' +
        '<button type="submit" class="btn btn-primary btn-full">Post job — get bids</button>' +
      "</form></div>"
    );
    document.getElementById("mkt-create-form").addEventListener("submit", submitCreate);
  }

  async function submitCreate(ev) {
    ev.preventDefault();
    var f = ev.target;
    var err = document.getElementById("mkt-create-err");
    var btn = f.querySelector('button[type="submit"]');
    var title = (f.title.value || "").trim();
    if (title.length < 4) { err.textContent = "Please add a short title."; return; }
    if (!ready() || !currentUser) { err.textContent = "Please log in again."; return; }
    btn.disabled = true; var prev = btn.textContent; btn.textContent = "Posting…"; err.textContent = "";
    var row = {
      owner_user_id: currentUser.id,
      owner_email: currentUser.email || "",
      owner_role: "owner",
      status: "open-for-bids",
      title: title,
      description: (f.description.value || "").trim(),
      category: f.category.value || "other",
      location: (f.location.value || "").trim(),
      boat_length_m: f.boatLengthM.value ? Number(f.boatLengthM.value) : null,
      budget: f.budget.value ? Number(f.budget.value) : null,
      currency: "TRY",
      timeframe: (f.timeframe.value || "").trim()
    };
    try {
      var res = await sb.from("marketplace_listings").insert(row).select().single();
      if (res.error) throw res.error;
      closeMktModal();
      state.category = "";
      var chips = document.querySelectorAll(".mkt-chip");
      chips.forEach(function (x, i) { x.classList.toggle("is-active", i === 0); });
      renderGrid();
    } catch (e) {
      btn.disabled = false; btn.textContent = prev;
      err.textContent = (e && e.message) ? e.message : "Could not post. Try again.";
    }
  }

  /* ── tiny modal ── */
  function showModal(inner) {
    closeMktModal();
    var ov = document.createElement("div");
    ov.className = "mkt-modal-ov";
    ov.id = "mkt-modal-ov";
    ov.innerHTML = '<div class="mkt-modal"><button class="mkt-modal-x" aria-label="Close">&times;</button>' + inner + "</div>";
    document.body.appendChild(ov);
    ov.addEventListener("click", function (e) { if (e.target === ov) closeMktModal(); });
    ov.querySelector(".mkt-modal-x").addEventListener("click", closeMktModal);
  }
  window.closeMktModal = function () { var el = document.getElementById("mkt-modal-ov"); if (el) el.remove(); };

  // expose
  window.loadMarketplace = loadMarketplace;
})();
