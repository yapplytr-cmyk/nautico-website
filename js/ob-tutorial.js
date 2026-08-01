/* ═══════════════════════════════════════════════════════════════
   NAUTICO — Post-signup Onboarding Tutorial
   Direct port of Yapply's onboardingTutorial.js (3-slide overlay,
   swipe + dots + Continue/Get Started), reskinned marine with the
   dolphin mascot on top of the card.
   Classic script. Exposes window.NauticoObTutorial.show(locale, role).
   Shown once after account creation (localStorage flag), never again.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var SEEN_KEY = "nautico-onboarding-tutorial-seen";
  var PENDING_KEY = "nautico_show_tutorial";
  var STROKE = "currentColor";

  /* Slide 1 icon: camera + form (Create Listing) — Yapply iconCreateListing */
  function iconCreateListing() {
    return '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="8" y="8" width="30" height="40" rx="4" stroke="' + STROKE + '" stroke-width="1.8"/>' +
      '<path d="M14 18h18" stroke="' + STROKE + '" stroke-width="1.8" stroke-linecap="round"/>' +
      '<path d="M14 24h14" stroke="' + STROKE + '" stroke-width="1.8" stroke-linecap="round" opacity="0.5"/>' +
      '<path d="M14 30h10" stroke="' + STROKE + '" stroke-width="1.8" stroke-linecap="round" opacity="0.3"/>' +
      '<rect x="32" y="24" width="24" height="18" rx="3" stroke="' + STROKE + '" stroke-width="1.8"/>' +
      '<circle cx="44" cy="34" r="5" stroke="' + STROKE + '" stroke-width="1.5"/>' +
      '<circle cx="44" cy="34" r="2" stroke="' + STROKE + '" stroke-width="1" opacity="0.4"/>' +
      '<path d="M40 24l2-4h4l2 4" stroke="' + STROKE + '" stroke-width="1.5" stroke-linejoin="round"/>' +
      "</svg>";
  }

  /* Slide 2 icon: bid cards — Yapply iconReceiveBids */
  function iconReceiveBids() {
    return '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="6" y="10" width="24" height="30" rx="4" stroke="' + STROKE + '" stroke-width="1.8"/>' +
      '<path d="M12 18h12" stroke="' + STROKE + '" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>' +
      '<path d="M12 23h8" stroke="' + STROKE + '" stroke-width="1.5" stroke-linecap="round" opacity="0.3"/>' +
      '<rect x="34" y="14" width="24" height="30" rx="4" stroke="' + STROKE + '" stroke-width="1.8"/>' +
      '<path d="M40 22h12" stroke="' + STROKE + '" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>' +
      '<path d="M40 27h8" stroke="' + STROKE + '" stroke-width="1.5" stroke-linecap="round" opacity="0.3"/>' +
      '<path d="M30 25l4 0" stroke="' + STROKE + '" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M32 22l3 3-3 3" stroke="' + STROKE + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>' +
      '<rect x="16" y="44" width="32" height="12" rx="3" stroke="' + STROKE + '" stroke-width="1.8"/>' +
      '<text x="32" y="53.5" text-anchor="middle" fill="' + STROKE + '" font-size="7" font-weight="600" font-family="system-ui">₺₺₺</text>' +
      "</svg>";
  }

  /* Slide 3 icon: profile + star + checkmark — Yapply iconChooseComplete */
  function iconChooseComplete() {
    return '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="24" cy="20" r="10" stroke="' + STROKE + '" stroke-width="1.8"/>' +
      '<path d="M10 46c0-8 6-14 14-14s14 6 14 14" stroke="' + STROKE + '" stroke-width="1.8" stroke-linecap="round"/>' +
      '<polygon points="48,8 50,14 56,14 51,18 53,24 48,20 43,24 45,18 40,14 46,14" stroke="' + STROKE + '" stroke-width="1.5" fill="none"/>' +
      '<circle cx="48" cy="46" r="10" stroke="' + STROKE + '" stroke-width="1.8"/>' +
      '<path d="M43 46l3 3 7-7" stroke="' + STROKE + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</svg>";
  }

  /* ── CSS — Yapply ob-tutorial block, marine palette ── */
  function ensureStyles() {
    if (document.getElementById("nautico-ob-tutorial-styles")) return;
    var s = document.createElement("style");
    s.id = "nautico-ob-tutorial-styles";
    s.textContent =
      ".ob-tutorial{position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;" +
        "background:rgba(2,12,22,0.6);opacity:0;transition:opacity .3s ease;padding:1.25rem;" +
        "-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}" +
      ".ob-tutorial--visible{opacity:1}" +
      ".ob-tutorial__card{background:var(--bg-card,#112A42);border:1px solid var(--border-color,rgba(255,255,255,.12));" +
        "border-radius:24px;max-width:380px;width:100%;padding:1.5rem 1.5rem 1.5rem;text-align:center;position:relative;overflow:hidden}" +
      ".ob-tutorial__mascot{width:76px;height:auto;margin:0 auto .25rem;display:block;" +
        "animation:obMascotBob 2.8s ease-in-out infinite}" +
      "@keyframes obMascotBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}" +
      ".ob-tutorial__slides{position:relative;min-height:250px;touch-action:pan-y}" +
      ".ob-tutorial__slide{display:none;flex-direction:column;align-items:center;gap:1rem;padding:0 .5rem}" +
      ".ob-tutorial__slide--active{display:flex;animation:obSlideIn .35s cubic-bezier(.22,1,.36,1) both}" +
      "@keyframes obSlideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}" +
      ".ob-tutorial__icon{width:80px;height:80px;color:var(--sea-blue,#1B6FA8);margin-bottom:.5rem}" +
      ".ob-tutorial__icon svg{width:100%;height:100%;display:block}" +
      ".ob-tutorial__title{font-size:1.25rem;font-weight:700;color:var(--text-primary,#E2EEF8);margin:0;letter-spacing:-.01em}" +
      ".ob-tutorial__desc{font-size:.88rem;color:var(--text-secondary,#8BBAD6);margin:0;line-height:1.55;max-width:300px}" +
      ".ob-tutorial__dots{display:flex;justify-content:center;gap:8px;margin:1.25rem 0 1rem}" +
      ".ob-tutorial__dot{width:8px;height:8px;border-radius:50%;background:var(--border-color,rgba(255,255,255,.15));" +
        "transition:background 250ms,transform 250ms}" +
      ".ob-tutorial__dot--active{background:var(--sea-blue,#1B6FA8);transform:scale(1.3)}" +
      ".ob-tutorial__btn{display:block;width:100%;padding:.8rem 1.5rem;font-family:inherit;font-size:.92rem;font-weight:600;" +
        "border-radius:14px;border:none;background:var(--grad-primary,linear-gradient(135deg,#1B6FA8,#2A8DC8));color:#fff;" +
        "cursor:pointer;transition:transform 120ms ease;-webkit-tap-highlight-color:transparent}" +
      ".ob-tutorial__btn:active{transform:scale(.97)}";
    document.head.appendChild(s);
  }

  /**
   * Show the 3-slide onboarding tutorial. Same behavior as Yapply:
   * shown once, swipe or Continue through, "Get Started" on last slide.
   */
  function show(locale, role, onComplete) {
    if (document.querySelector(".ob-tutorial")) return;
    var isTr = locale === "tr";

    try {
      if (localStorage.getItem(SEEN_KEY) === "1") {
        if (typeof onComplete === "function") onComplete();
        return;
      }
    } catch (_) {}

    ensureStyles();

    var isProvider = role === "provider";

    /* Providers PLACE bids and win work — they do NOT receive bids. */
    var providerSlides = [
      { icon: iconReceiveBids(),
        title: isTr ? "Açık İlanları Keşfedin" : "Browse Open Jobs",
        desc: isTr
          ? "Keşfet sekmesindeki tekne sahiplerinin iş ilanlarını inceleyin ve size uygun işleri bulun."
          : "Explore boat owners' job listings in the Discover tab and find work that fits you." },
      { icon: iconCreateListing(),
        title: isTr ? "Teklifinizi Verin" : "Place Your Bids",
        desc: isTr
          ? "Fiyatınızı ve tamamlanma sürenizi belirterek rekabetçi teklifler gönderin."
          : "Send competitive bids with your price and completion time to win the job." },
      { icon: iconChooseComplete(),
        title: isTr ? "İtibarınızı Oluşturun" : "Build Your Reputation",
        desc: isTr
          ? "İşleri tamamlayın, yorumlar toplayın ve daha fazla iş kazanmak için profilinizi büyütün."
          : "Complete jobs, collect reviews, and grow your profile to win more work." },
    ];

    var ownerSlides = [
      { icon: iconCreateListing(),
        title: isTr ? "İlanınızı Oluşturun" : "Create Your Listing",
        desc: isTr
          ? "İş ilanı oluşturun, detayları ekleyin ve sorunun fotoğraflarını yükleyin."
          : "Create a job listing, add details, and upload photos of the issue." },
      { icon: iconReceiveBids(),
        title: isTr ? "Teklifleri Alın" : "Receive Bids",
        desc: isTr
          ? "Deniz ustaları ilanınızı görecek ve size rekabetçi teklifler gönderecek."
          : "Marine pros will see your listing and send you competitive bids." },
      { icon: iconChooseComplete(),
        title: isTr ? "En Uygun Teklifi Seçin" : "Choose the Best",
        desc: isTr
          ? "Profilleri inceleyin, yorumları okuyun ve en iyi seçeneği belirleyin."
          : "Review profiles, read reviews, and choose the best option." },
    ];

    var slides = isProvider ? providerSlides : ownerSlides;

    /* Dolphin mascot on top of the card (marine reskin of the bird) */
    var mascot = "";
    try {
      if (window.NauticoDolphin && typeof window.NauticoDolphin.getPose === "function") {
        mascot = '<div class="ob-tutorial__mascot">' + window.NauticoDolphin.getPose("success") + "</div>";
      }
    } catch (_) {}

    var overlay = document.createElement("div");
    overlay.className = "ob-tutorial";
    overlay.innerHTML =
      '<div class="ob-tutorial__card">' +
        mascot +
        '<div class="ob-tutorial__slides" data-ob-slides>' +
        slides.map(function (s, i) {
          return '<div class="ob-tutorial__slide ' + (i === 0 ? "ob-tutorial__slide--active" : "") + '" data-ob-slide="' + i + '">' +
            '<div class="ob-tutorial__icon">' + s.icon + "</div>" +
            '<h2 class="ob-tutorial__title">' + s.title + "</h2>" +
            '<p class="ob-tutorial__desc">' + s.desc + "</p>" +
            "</div>";
        }).join("") +
        "</div>" +
        '<div class="ob-tutorial__dots" data-ob-dots>' +
        slides.map(function (_, i) {
          return '<span class="ob-tutorial__dot ' + (i === 0 ? "ob-tutorial__dot--active" : "") + '" data-ob-dot="' + i + '"></span>';
        }).join("") +
        "</div>" +
        '<button class="ob-tutorial__btn" type="button" data-ob-next>' + (isTr ? "Devam Et" : "Continue") + "</button>" +
      "</div>";

    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add("ob-tutorial--visible"); });

    var current = 0;
    var totalSlides = slides.length;
    var btn = overlay.querySelector("[data-ob-next]");
    var slidesContainer = overlay.querySelector("[data-ob-slides]");
    var _touchStartX = 0;

    if (slidesContainer) {
      slidesContainer.addEventListener("touchstart", function (e) {
        _touchStartX = e.touches[0].clientX;
      }, { passive: true });
      slidesContainer.addEventListener("touchend", function (e) {
        var dx = e.changedTouches[0].clientX - _touchStartX;
        if (Math.abs(dx) > 50) {
          if (dx < 0 && current < totalSlides - 1) goTo(current + 1);
          else if (dx > 0 && current > 0) goTo(current - 1);
        }
      }, { passive: true });
    }

    function goTo(idx) {
      current = idx;
      overlay.querySelectorAll("[data-ob-slide]").forEach(function (s, i) {
        s.classList.toggle("ob-tutorial__slide--active", i === idx);
      });
      overlay.querySelectorAll("[data-ob-dot]").forEach(function (d, i) {
        d.classList.toggle("ob-tutorial__dot--active", i === idx);
      });
      btn.textContent = current === totalSlides - 1
        ? (isTr ? "Başla" : "Get Started")
        : (isTr ? "Devam Et" : "Continue");
    }

    if (btn) {
      btn.addEventListener("click", function () {
        try {
          if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Haptics) {
            Capacitor.Plugins.Haptics.impact({ style: "LIGHT" });
          }
        } catch (_) {}
        if (current < totalSlides - 1) {
          goTo(current + 1);
        } else {
          try { localStorage.setItem(SEEN_KEY, "1"); } catch (_) {}
          try { localStorage.removeItem(PENDING_KEY); } catch (_) {}
          overlay.classList.remove("ob-tutorial--visible");
          setTimeout(function () {
            overlay.remove();
            if (typeof onComplete === "function") onComplete();
          }, 300);
        }
      });
    }
  }

  /* Auto-show after signup: the signup wizard sets nautico_show_tutorial=1
     (+ role) right before handing over to the app. Fire once the app UI
     has settled. */
  function maybeAutoShow() {
    var pending = null;
    try { pending = localStorage.getItem(PENDING_KEY); } catch (_) {}
    if (!pending) return;
    var role = "owner";
    try { role = localStorage.getItem("nautico_tutorial_role") || "owner"; } catch (_) {}
    var locale = "en";
    try { locale = localStorage.getItem("nautico-language") || "en"; } catch (_) {}
    setTimeout(function () { show(locale, role); }, 900);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", maybeAutoShow);
  } else {
    maybeAutoShow();
  }

  window.NauticoObTutorial = { show: show };
})();
