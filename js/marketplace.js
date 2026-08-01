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
  var TIMEFRAMES = ["1-2 hafta", "2-4 hafta", "1-2 ay", "2+ ay"];
  var profileCache = {};

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

  /* ── shared helpers (bids / reviews / profiles) ── */
  function starSvg(on) {
    return '<svg class="mkt-star' + (on ? " is-on" : "") + '" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">' +
      '<path fill="currentColor" d="M12 2.6l2.9 5.9 6.5 1-4.7 4.6 1.1 6.4L12 17.4l-5.8 3.1 1.1-6.4-4.7-4.6 6.5-1z"/></svg>';
  }
  function starsRow(rating) {
    var out = "", r = Math.round(Number(rating) || 0), i;
    for (i = 1; i <= 5; i++) out += starSvg(i <= r);
    return '<span class="mkt-stars">' + out + "</span>";
  }
  function verifiedPill() {
    return '<span class="mkt-verified" title="Verified provider">' +
      '<svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true">' +
      '<path fill="currentColor" d="M12 2a3 3 0 0 0-1 5.83V9H8v2h3v8.92A7 7 0 0 1 5.06 14H7l-3-4-3 4h2.03A9 9 0 0 0 12 22a9 9 0 0 0 8.97-8H23l-3-4-3 4h1.94A7 7 0 0 1 13 19.92V11h3V9h-3V7.83A3 3 0 0 0 12 2zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>' +
      '<path fill="currentColor" d="M9.2 11.4l1.9 1.9 3.7-3.7 1.1 1.1-4.8 4.8-3-3z" opacity="0"/></svg>Verified</span>';
  }
  function isVerified(p) {
    if (!p) return false;
    if (p.provider_verified === true) return true;
    return !!(p.current_plan && String(p.current_plan).toLowerCase() !== "free");
  }
  function avatarHtml(p, name) {
    if (p && p.avatar_url) return '<img class="mkt-avatar" src="' + esc(p.avatar_url) + '" alt="">';
    var init = (name || "P").trim().charAt(0).toUpperCase() || "P";
    return '<span class="mkt-avatar mkt-avatar-init">' + esc(init) + "</span>";
  }
  async function getMyProfile() {
    if (!currentUser || !ready()) return null;
    if (profileCache[currentUser.id]) return profileCache[currentUser.id];
    try {
      var res = await sb.from("profiles")
        .select("id,role,full_name,business_name,service_area,specialties,avatar_url,provider_verified,current_plan")
        .eq("id", currentUser.id).single();
      if (res.error || !res.data) return null;
      profileCache[currentUser.id] = res.data;
      return res.data;
    } catch (e) { return null; }
  }
  async function bidTokenCost(budget) {
    var b = Number(budget || 0), i, t, min, max;
    try {
      var res = await sb.from("bid_token_costs")
        .select("min_budget_tl,max_budget_tl,token_cost")
        .order("min_budget_tl", { ascending: true });
      if (!res.error && res.data && res.data.length) {
        for (i = 0; i < res.data.length; i++) {
          t = res.data[i];
          min = Number(t.min_budget_tl || 0);
          max = (t.max_budget_tl == null) ? Infinity : Number(t.max_budget_tl);
          if (b >= min && b <= max) return Math.max(1, Number(t.token_cost) || 1);
        }
      }
    } catch (e) {}
    if (b <= 5000) return 1;
    if (b <= 20000) return 2;
    if (b <= 75000) return 3;
    if (b <= 200000) return 5;
    return 8;
  }

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
    var l = null;
    try {
      var res = await sb.from("marketplace_listings")
        .select("id,owner_user_id,status,accepted_bid_id,title,description,category,location,boat_length_m,budget,currency,timeframe,created_at," +
                "listing_bids(id,bidder_user_id,status,company_name,bid_amount,currency,estimated_timeframe,proposal_message,created_at)")
        .eq("id", id).single();
      if (res.error || !res.data) throw (res.error || new Error("not found"));
      l = res.data;
    } catch (e) {
      showModal('<div class="mkt-detail"><h2>Listing unavailable</h2><p>We could not load this listing right now. Please try again.</p></div>');
      return;
    }
    var bids = (l.listing_bids || []).slice().sort(function (a, b) { return (a.bid_amount || 0) - (b.bid_amount || 0); });

    // Batch-fetch bidder profiles (verified badge, avatar, profile link).
    var profs = {};
    var bidderIds = [];
    bids.forEach(function (b) { if (b.bidder_user_id && bidderIds.indexOf(b.bidder_user_id) < 0) bidderIds.push(b.bidder_user_id); });
    if (bidderIds.length) {
      try {
        var pr = await sb.from("profiles")
          .select("id,business_name,full_name,avatar_url,provider_verified,current_plan")
          .in("id", bidderIds);
        if (!pr.error && pr.data) pr.data.forEach(function (p) { profs[p.id] = p; });
      } catch (e2) {}
    }

    var isOwner = !!(currentUser && currentUser.id === l.owner_user_id);
    var myBid = null;
    if (currentUser) {
      bids.forEach(function (b) { if (b.bidder_user_id === currentUser.id) myBid = b; });
    }
    var me = null;
    if (currentUser && !isOwner) me = await getMyProfile();
    var canBid = !!(currentUser && !isOwner && me && me.role === "provider" && l.status === "open-for-bids" && !myBid);
    var canAccept = !!(isOwner && l.status === "open-for-bids");

    var bidsHtml = bids.length
      ? bids.map(function (b) {
          var p = profs[b.bidder_user_id] || null;
          var name = b.company_name || (p && (p.business_name || p.full_name)) || "Marine pro";
          var accepted = (b.status === "accepted") || (l.accepted_bid_id && l.accepted_bid_id === b.id);
          var mine = !!(currentUser && b.bidder_user_id === currentUser.id);
          return '<div class="mkt-bid' + (accepted ? " is-accepted" : "") + '">' +
            '<div class="mkt-bid-top">' +
              '<span class="mkt-bid-who">' + avatarHtml(p, name) +
                (b.bidder_user_id
                  ? '<a href="#" class="mkt-bid-name" data-provider="' + esc(b.bidder_user_id) + '">' + esc(name) + "</a>"
                  : "<strong>" + esc(name) + "</strong>") +
                (isVerified(p) ? verifiedPill() : "") +
                (accepted ? '<span class="mkt-accepted-pill">Accepted</span>' : "") +
                (mine ? '<span class="mkt-mine-pill">Your bid</span>' : "") +
              "</span>" +
              "<span>" + esc(money(b.bid_amount, b.currency)) + "</span></div>" +
            (b.estimated_timeframe ? '<div class="mkt-bid-sub">' + esc(b.estimated_timeframe) + "</div>" : "") +
            (b.proposal_message ? '<div class="mkt-bid-msg">' + esc(b.proposal_message) + "</div>" : "") +
            (canAccept ? '<button class="btn mkt-accept-btn" data-accept="' + esc(b.id) + '">Accept bid</button>' : "") +
            "</div>";
        }).join("")
      : '<div class="mkt-empty">No bids yet — pros bid from the Nautico app.</div>';

    var bidFormHtml = "";
    if (canBid) {
      var tfOpts = TIMEFRAMES.map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + "</option>"; }).join("");
      bidFormHtml =
        '<h3>Place your bid</h3>' +
        '<form id="mkt-bid-form" class="mkt-form mkt-bid-form">' +
          '<div class="mkt-token-badge" id="mkt-token-badge">Checking token cost…</div>' +
          '<div class="mkt-form-row">' +
            '<label>Your offer (₺)<input name="bidAmount" class="mkt-in" type="number" step="1" min="1" placeholder="7500" required></label>' +
            '<label>Timeframe<select name="timeframeSel" class="mkt-in">' + tfOpts + "</select></label>" +
          "</div>" +
          '<label>Proposal<textarea name="proposal" class="mkt-in" rows="3" placeholder="What you&#39;ll do, materials, availability…"></textarea></label>' +
          '<div class="mkt-form-err" id="mkt-bid-err"></div>' +
          '<button type="submit" class="btn btn-primary btn-full">Submit bid</button>' +
        "</form>";
    } else if (myBid && l.status === "open-for-bids") {
      bidFormHtml = '<div class="mkt-token-badge">Your bid is in — the owner will review it here.</div>';
    }

    var reviewSecHtml = "";
    if (isOwner && l.status === "bid-accepted" && l.accepted_bid_id) {
      reviewSecHtml = '<div id="mkt-review-sec"></div>';
    }

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
        bidFormHtml + reviewSecHtml +
      "</div>"
    );

    var ov = document.getElementById("mkt-modal-ov");
    if (!ov) return;
    ov.querySelectorAll(".mkt-bid-name").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        openProviderProfile(a.getAttribute("data-provider"));
      });
    });
    if (canAccept) {
      ov.querySelectorAll("[data-accept]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var bid = null, bidId = btn.getAttribute("data-accept");
          bids.forEach(function (b) { if (String(b.id) === bidId) bid = b; });
          if (bid) acceptBid(l, bid, btn);
        });
      });
    }
    if (canBid) {
      fillTokenBadge(l);
      var bf = document.getElementById("mkt-bid-form");
      if (bf) bf.addEventListener("submit", function (ev) { submitBid(ev, l, me); });
    }
    if (reviewSecHtml) renderReviewSection(l, bids);
  }

  /* ── Provider bidding ── */
  async function fillTokenBadge(l) {
    var cost = await bidTokenCost(l.budget);
    var balTxt = "";
    try {
      var rpc = await sb.rpc("get_token_status", { p_user_id: currentUser.id });
      var d = rpc ? rpc.data : null;
      if (Array.isArray(d)) d = d[0];
      if (rpc && !rpc.error && d && d.balance != null) balTxt = " · balance " + d.balance;
    } catch (e) {}
    var el = document.getElementById("mkt-token-badge");
    if (el) el.textContent = "This bid costs " + cost + (cost === 1 ? " token" : " tokens") + balTxt;
  }

  async function submitBid(ev, l, me) {
    ev.preventDefault();
    var f = ev.target;
    var err = document.getElementById("mkt-bid-err");
    var btn = f.querySelector('button[type="submit"]');
    if (!ready() || !currentUser) { if (err) err.textContent = "Please log in again."; return; }
    var amount = Number(f.bidAmount.value);
    if (!amount || amount <= 0) { if (err) err.textContent = "Please enter your offer amount."; return; }
    btn.disabled = true; var prev = btn.textContent; btn.textContent = "Submitting…"; if (err) err.textContent = "";
    try {
      // Spend tokens first; fail-open if the RPC itself is unavailable.
      var cost = await bidTokenCost(l.budget);
      try {
        var rpc = await sb.rpc("spend_tokens_for_bid", { p_user_id: currentUser.id, p_listing_id: l.id, p_cost: cost });
        var d = rpc ? rpc.data : null;
        if (Array.isArray(d)) d = d[0];
        if (rpc && !rpc.error && d && d.success === false) {
          btn.disabled = false; btn.textContent = prev;
          if (err) err.innerHTML = 'Insufficient tokens. <a href="#" onclick="closeMktModal();navigate(&#39;pricing&#39;);return false">Get more tokens</a>';
          return;
        }
      } catch (eRpc) { /* RPC not deployed — proceed free */ }
      var row = {
        listing_id: l.id,
        bidder_user_id: currentUser.id,
        bidder_role: "provider",
        status: "submitted",
        company_name: (me && (me.business_name || me.full_name)) || "Marine pro",
        bid_amount: amount,
        estimated_timeframe: f.timeframeSel.value || TIMEFRAMES[0],
        proposal_message: (f.proposal.value || "").trim()
      };
      var res = await sb.from("listing_bids").insert(row);
      if (res.error) throw res.error;
      openDetail(l.id);
    } catch (e) {
      btn.disabled = false; btn.textContent = prev;
      if (err) err.textContent = (e && e.message) ? e.message : "Could not submit your bid. Try again.";
    }
  }

  /* ── Owner: accept a bid ── */
  async function acceptBid(l, bid, btn) {
    if (!ready() || !currentUser) return;
    if (btn) { btn.disabled = true; btn.textContent = "Accepting…"; }
    try {
      var r1 = await sb.from("listing_bids").update({ status: "accepted" }).eq("id", bid.id);
      if (r1.error) throw r1.error;
      var r2 = await sb.from("marketplace_listings")
        .update({ status: "bid-accepted", accepted_bid_id: bid.id }).eq("id", l.id);
      if (r2.error) throw r2.error;
      try {
        await sb.from("jobs").insert({
          listing_id: l.id,
          bid_id: bid.id,
          owner_user_id: currentUser.id,
          provider_user_id: bid.bidder_user_id,
          status: "in-progress",
          scheduled_at: new Date().toISOString()
        });
      } catch (eJob) { /* job insert is best-effort */ }
      openDetail(l.id);
      renderGrid();
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = "Accept bid"; }
      console.log("[nautico] accept bid:", e && e.message);
    }
  }

  /* ── Owner: leave a review ── */
  async function renderReviewSection(l, bids) {
    var sec = document.getElementById("mkt-review-sec");
    if (!sec) return;
    var acceptedBid = null;
    bids.forEach(function (b) { if (b.id === l.accepted_bid_id) acceptedBid = b; });
    if (!acceptedBid || !acceptedBid.bidder_user_id) return;
    var job = null;
    try {
      var jr = await sb.from("jobs").select("id,bid_id,provider_user_id,status")
        .eq("listing_id", l.id).eq("bid_id", l.accepted_bid_id).limit(1);
      if (!jr.error && jr.data && jr.data.length) job = jr.data[0];
    } catch (e) {}
    if (!job) return;
    try {
      var rr = await sb.from("reviews").select("id")
        .eq("job_id", job.id).eq("reviewer_user_id", currentUser.id).limit(1);
      if (!rr.error && rr.data && rr.data.length) {
        sec.innerHTML = '<div class="mkt-review-thanks">Thanks for your review!</div>';
        return;
      }
    } catch (e2) {}
    var starBtns = "", i;
    for (i = 1; i <= 5; i++) {
      starBtns += '<button type="button" class="mkt-star-pick" data-star="' + i + '" aria-label="' + i + ' stars">' + starSvg(false) + "</button>";
    }
    sec.innerHTML =
      "<h3>How did it go?</h3>" +
      '<form id="mkt-review-form" class="mkt-form mkt-review-form">' +
        '<div class="mkt-star-picker" id="mkt-star-picker">' + starBtns + "</div>" +
        '<label>Comment<textarea name="comment" class="mkt-in" rows="3" placeholder="How was the work and communication?"></textarea></label>' +
        '<div class="mkt-form-err" id="mkt-review-err"></div>' +
        '<button type="submit" class="btn btn-primary btn-full">Submit review</button>' +
      "</form>";
    var rating = 0;
    sec.querySelectorAll(".mkt-star-pick").forEach(function (b) {
      b.addEventListener("click", function () {
        rating = Number(b.getAttribute("data-star")) || 0;
        sec.querySelectorAll(".mkt-star-pick").forEach(function (x) {
          var v = Number(x.getAttribute("data-star")) || 0;
          x.querySelector(".mkt-star").classList.toggle("is-on", v <= rating);
        });
      });
    });
    document.getElementById("mkt-review-form").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var err = document.getElementById("mkt-review-err");
      if (!rating) { if (err) err.textContent = "Please pick a star rating."; return; }
      var btn = ev.target.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = "Submitting…"; if (err) err.textContent = "";
      try {
        var res = await sb.from("reviews").insert({
          job_id: job.id,
          reviewer_user_id: currentUser.id,
          reviewee_user_id: acceptedBid.bidder_user_id,
          direction: "owner_to_provider",
          rating: rating,
          comment: (ev.target.comment.value || "").trim(),
          photos: []
        });
        if (res.error) throw res.error;
        sec.innerHTML = '<div class="mkt-review-thanks">Thanks for your review!</div>';
      } catch (e) {
        btn.disabled = false; btn.textContent = "Submit review";
        if (err) err.textContent = (e && e.message) ? e.message : "Could not save your review. Try again.";
      }
    });
  }

  /* ── Provider profile + reviews (modal) ── */
  async function openProviderProfile(userId) {
    if (!ready() || !userId) return;
    showModal('<div class="mkt-detail"><div class="mkt-empty">Loading profile…</div></div>');
    var p = null, revs = [], totalBids = null, acceptedBids = null;
    try {
      var res = await sb.from("profiles")
        .select("id,role,full_name,business_name,service_area,specialties,avatar_url,provider_verified,current_plan")
        .eq("id", userId).single();
      if (!res.error && res.data) p = res.data;
    } catch (e) {}
    try {
      var rr = await sb.from("reviews")
        .select("id,rating,comment,created_at")
        .eq("reviewee_user_id", userId).eq("direction", "owner_to_provider")
        .order("created_at", { ascending: false }).limit(20);
      if (!rr.error && rr.data) revs = rr.data;
    } catch (e2) {}
    try {
      var tc = await sb.from("listing_bids").select("id", { count: "exact", head: true }).eq("bidder_user_id", userId);
      if (!tc.error && tc.count != null) totalBids = tc.count;
      var ac = await sb.from("listing_bids").select("id", { count: "exact", head: true })
        .eq("bidder_user_id", userId).eq("status", "accepted");
      if (!ac.error && ac.count != null) acceptedBids = ac.count;
    } catch (e3) {}
    if (!p) {
      showModal('<div class="mkt-detail"><h2>Profile unavailable</h2><p>We could not load this provider right now.</p></div>');
      return;
    }
    var name = p.business_name || p.full_name || "Marine pro";
    var avg = 0;
    if (revs.length) {
      revs.forEach(function (r) { avg += Number(r.rating) || 0; });
      avg = avg / revs.length;
    }
    var specs = p.specialties;
    if (Array.isArray(specs)) specs = specs.join(", ");
    var revsHtml = revs.length
      ? revs.map(function (r) {
          return '<div class="mkt-review-card">' +
            '<div class="mkt-review-top">' + starsRow(r.rating) +
              '<span class="mkt-review-date">' + esc(when(r.created_at)) + "</span></div>" +
            (r.comment ? '<div class="mkt-review-txt">' + esc(r.comment) + "</div>" : "") +
          "</div>";
        }).join("")
      : '<div class="mkt-empty">No reviews yet.</div>';
    showModal(
      '<div class="mkt-detail mkt-prof">' +
        '<div class="mkt-prof-head">' + avatarHtml(p, name) +
          '<div class="mkt-prof-id"><h2>' + esc(name) + (isVerified(p) ? " " + verifiedPill() : "") + "</h2>" +
            (p.service_area ? '<div class="mkt-loc">' + esc(p.service_area) + "</div>" : "") +
          "</div></div>" +
        (specs ? '<p class="mkt-prof-specs">' + esc(specs) + "</p>" : "") +
        '<div class="mkt-prof-stats">' +
          '<span class="mkt-prof-rating">' + starsRow(avg) +
            (revs.length ? " " + (Math.round(avg * 10) / 10) + " · " + revs.length + (revs.length === 1 ? " review" : " reviews") : " No ratings") +
          "</span>" +
          (totalBids != null ? '<span class="mkt-prof-bidstat">' + totalBids + (totalBids === 1 ? " bid" : " bids") +
            (acceptedBids != null ? " · " + acceptedBids + " won" : "") + "</span>" : "") +
        "</div>" +
        "<h3>Reviews</h3>" + revsHtml +
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

  /* ── injected styles (bids / reviews / profiles) ── */
  (function injectMktStyles() {
    if (document.getElementById("mkt-ext-styles")) return;
    var st = document.createElement("style");
    st.id = "mkt-ext-styles";
    st.textContent =
      ".mkt-bid-who{display:flex;align-items:center;gap:8px;min-width:0;}" +
      ".mkt-bid-name{color:inherit;font-weight:600;text-decoration:none;border-bottom:1px dotted rgba(255,255,255,.35);}" +
      ".mkt-bid-name:hover{border-bottom-color:currentColor;}" +
      ".mkt-avatar{width:28px;height:28px;border-radius:50%;object-fit:cover;flex:none;display:inline-flex;align-items:center;justify-content:center;}" +
      ".mkt-avatar-init{background:rgba(245,197,66,.14);border:1px solid rgba(245,197,66,.4);color:#f5c542;font-size:12px;font-weight:700;}" +
      ".mkt-verified{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;letter-spacing:.02em;color:#f5c542;border:1px solid rgba(245,197,66,.55);background:rgba(245,197,66,.08);flex:none;}" +
      ".mkt-accepted-pill{display:inline-flex;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;color:#4ade80;border:1px solid rgba(74,222,128,.5);background:rgba(74,222,128,.08);flex:none;}" +
      ".mkt-mine-pill{display:inline-flex;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;color:#8ab4ff;border:1px solid rgba(138,180,255,.45);background:rgba(138,180,255,.08);flex:none;}" +
      ".mkt-bid.is-accepted{border-color:rgba(245,197,66,.5);}" +
      ".mkt-accept-btn{margin-top:10px;padding:7px 14px;font-size:13px;font-weight:600;border-radius:8px;border:1px solid rgba(245,197,66,.6);background:rgba(245,197,66,.1);color:#f5c542;cursor:pointer;}" +
      ".mkt-accept-btn:hover{background:rgba(245,197,66,.2);}" +
      ".mkt-accept-btn:disabled{opacity:.55;cursor:default;}" +
      ".mkt-token-badge{display:inline-block;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:600;color:#f5c542;border:1px solid rgba(245,197,66,.4);background:rgba(245,197,66,.06);margin:6px 0 4px;}" +
      ".mkt-bid-form{margin-top:6px;}" +
      ".mkt-stars{display:inline-flex;gap:2px;vertical-align:middle;}" +
      ".mkt-star{color:rgba(255,255,255,.22);}" +
      ".mkt-star.is-on{color:#f5c542;}" +
      ".mkt-star-picker{display:flex;gap:6px;margin:4px 0 8px;}" +
      ".mkt-star-pick{background:none;border:none;padding:2px;cursor:pointer;line-height:0;}" +
      ".mkt-star-pick .mkt-star{width:22px;height:22px;}" +
      ".mkt-review-card{border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:12px 14px;margin-top:10px;background:rgba(255,255,255,.03);}" +
      ".mkt-review-top{display:flex;align-items:center;justify-content:space-between;gap:10px;}" +
      ".mkt-review-date{font-size:12px;opacity:.6;}" +
      ".mkt-review-txt{margin-top:6px;font-size:14px;line-height:1.5;opacity:.9;}" +
      ".mkt-review-thanks{margin-top:14px;padding:12px 14px;border-radius:12px;border:1px solid rgba(245,197,66,.4);background:rgba(245,197,66,.07);color:#f5c542;font-weight:600;}" +
      ".mkt-prof-head{display:flex;align-items:center;gap:14px;margin-bottom:6px;}" +
      ".mkt-prof-head .mkt-avatar{width:52px;height:52px;font-size:20px;}" +
      ".mkt-prof-id h2{margin:0 0 2px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}" +
      ".mkt-prof-specs{opacity:.8;}" +
      ".mkt-prof-stats{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:6px 0 4px;font-size:13px;}" +
      ".mkt-prof-rating{display:inline-flex;align-items:center;gap:6px;font-weight:600;}" +
      ".mkt-prof-bidstat{opacity:.7;}";
    document.head.appendChild(st);
  })();

  // expose
  window.loadMarketplace = loadMarketplace;
  window.openProviderProfile = openProviderProfile;
})();
