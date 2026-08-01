/**
 * Nautico Onboarding Wizard -- one-for-one port of Yapply's step-by-step
 * account creation flow, retinted for the Nautico marine app.
 *
 * Classic script (NO import/export). Loaded via a plain <script> tag and
 * relies on the global `supabaseClient` (supabase-js v2, already initialized).
 *
 * Exposes: window.NauticoWizard = { start: function () {} }
 *   start() renders the wizard into a full-screen host div (#nautico-wizard,
 *   z-index 6100) appended to <body>.
 *
 * Steps: 1) Language  2) Theme  3) Role  4) Provider type (providers only)
 *        5) Account form (one-field-at-a-time pager)  6) OTP verify  7) Success
 */
(function () {
  "use strict";

  /* -------------------------------------------------------------
     Inline SVG icons (recolor via currentColor). NO emoji anywhere.
     ------------------------------------------------------------- */

  // Marine gull mark -- replaces every Yapply construction-bird SVG.
  var GULL_SVG =
    '<svg viewBox="0 0 120 60" aria-hidden="true"><path d="M8 34C28 12 44 16 60 34C76 16 92 12 112 34C90 28 76 30 60 44C44 30 30 28 8 34Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/></svg>';

  // Anchor -- Boat Owner role.
  var ANCHOR_SVG =
    '<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="9" r="4"/><path d="M24 13v27"/><path d="M15 21h18"/><path d="M8 28c0 9 7 14 16 14s16-5 16-14"/><path d="M8 28l-4 3M40 28l4 3"/></svg>';

  // Wrench / tools -- Service Provider role.
  var WRENCH_SVG =
    '<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M33 10a8 8 0 0 0-10 10L9 34a4.5 4.5 0 0 0 6.4 6.4L29 26a8 8 0 0 0 10-10l-6 6-4-1-1-4z"/></svg>';

  // Single person -- Independent.
  var PERSON_SVG =
    '<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="16" r="7"/><path d="M11 40c0-7.5 5.8-13 13-13s13 5.5 13 13"/></svg>';

  // Building -- Company.
  var BUILDING_SVG =
    '<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="12" y="7" width="24" height="35" rx="2"/><path d="M18 15h4M26 15h4M18 23h4M26 23h4M18 31h4M26 31h4M20 42v-5h8v5"/></svg>';

  // Camera -- selfie verification.
  var CAMERA_SVG =
    '<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="14" width="38" height="27" rx="4"/><path d="M17 14l3-5h8l3 5"/><circle cx="24" cy="27" r="7"/></svg>';

  // Globe -- language.
  var GLOBE_SVG =
    '<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="18"/><path d="M6 24h36"/><path d="M24 6c6 6 6 30 0 36M24 6c-6 6-6 30 0 36"/><path d="M10 14c8.5 4.5 19.5 4.5 28 0M10 34c8.5-4.5 19.5-4.5 28 0"/></svg>';

  // Sun -- Light mode.
  var SUN_SVG =
    '<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="8"/><path d="M24 4v6M24 38v6M4 24h6M38 24h6M10.3 10.3l4.2 4.2M33.5 33.5l4.2 4.2M37.7 10.3l-4.2 4.2M14.5 33.5l-4.2 4.2"/></svg>';

  // Moon -- Dark mode.
  var MOON_SVG =
    '<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M31 6a18 18 0 1 0 11 30A14.5 14.5 0 0 1 31 6z"/></svg>';

  // Success -- gull inside a ring with a checkmark.
  var SUCCESS_SVG =
    '<svg viewBox="0 0 120 120" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="60" cy="60" r="52"/>' +
    '<path d="M28 52C42 40 52 43 60 52C68 43 78 40 92 52C78 48 68 49 60 58C52 49 42 48 28 52Z" fill="currentColor" stroke="none"/>' +
    '<path d="M42 74l12 12 26-30" stroke-width="5"/>' +
    "</svg>";

  // Envelope -- email verification.
  var ENVELOPE_SVG =
    '<svg viewBox="0 0 120 120" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="60" cy="60" r="52"/>' +
    '<rect x="34" y="44" width="52" height="34" rx="4"/>' +
    '<path d="M34 48l26 18 26-18"/>' +
    "</svg>";

  /* -------------------------------------------------------------
     Nautico Dolphin Mascot -- classic leaping-arc dolphin, flat
     two-tone + belly panel, tiny dot eye. Prop layouts mirror
     Yapply's wizard bird. Fin + tail carry idle animations.
     ------------------------------------------------------------- */

  var DPH = {
    body: "#5b9ec9",
    dk: "#39759e",
    belly: "#a8cfe8",
    eye: "#121317",
    penBody: "#f2d17f",
    paper: "#eef4f5",
    paperLn: "#c8d8da",
    phone: "#34495e",
    phoneSc: "#5dade2",
    money: "#2ecc71",
    moneyDk: "#27ae60",
    coin: "#f5c542",
    coinDk: "#d4a832",
    camera: "#5d6d7e",
    cameraDk: "#4a5568",
    cameraL: "#85929e",
    envelope: "#f0e6d3",
    envFlap: "#e0d0b8",
    heart: "#e74c3c",
    check: "#2ecc9a",
    cloud: "#e8edf0",
    cloudDk: "#ced6db",
    tool: "#5d6d7e",
  };

  var DPH_VB = "0 0 100 80";

  // Classic arcing dolphin, nose up-right. opts: tilt, finAngle, lookDir
  function dolphinBody(opts) {
    opts = opts || {};
    var tilt = opts.tilt || 0;
    var finAngle = opts.finAngle === undefined ? 24 : opts.finAngle;
    var lookDir = opts.lookDir || 0;
    var ex = lookDir * 1.2;
    var open = tilt ? '<g class="dph-body" transform="rotate(' + tilt + ',45,42)">' : '<g class="dph-body">';
    return (
      open +
      /* notched tail flukes (animated sway) */
      '<g class="dph-tail"><path d="M12,57 C7,60 3,65 2,70 C6,67 10,66 14,64 C13,68 14,72 17,75 C18,70 20,66 22,63 Z" fill="' + DPH.dk + '" /></g>' +
      /* dorsal fin */
      '<path d="M46,16 C48,6 56,3 62,5 C56,8 52,12 51,17 Z" fill="' + DPH.dk + '" />' +
      /* body: leaping arc -> melon -> bottlenose -> chest -> belly */
      '<path d="M10,58 C14,34 34,14 58,14 C66,14 72,18 74,23 C79,24 84,27 85,30 C83,32.5 78,33.5 72,33 C68,40 62,47 54,52 C40,60 22,62 10,58 Z" fill="' + DPH.body + '" />' +
      /* belly panel */
      '<path d="M14,56 C26,60 42,58 53,51 C58,47.5 63,42 66,37 C64,45 57,52 48,56 C36,60.5 22,60 14,56 Z" fill="' + DPH.belly + '" opacity="0.9" />' +
      /* mouth crease */
      '<path d="M72,29 Q77,31 83,30" stroke="' + DPH.dk + '" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.55" />' +
      /* eye */
      '<circle cx="' + (66 + ex) + '" cy="24" r="1.7" fill="' + DPH.eye + '" />' +
      /* pectoral fin (animated wave) */
      '<g class="dph-fin"><ellipse cx="48" cy="40" rx="8" ry="3.6" fill="' + DPH.dk + '" transform="rotate(' + finAngle + ' 48 40)" /></g>' +
      "</g>"
    );
  }

  function dphSvg(inner, vb) {
    return '<svg viewBox="' + (vb || DPH_VB) + '" fill="none" xmlns="http://www.w3.org/2000/svg" class="onboarding-dolphin-svg">' + inner + "</svg>";
  }

  /* -- Poses: prop layouts mirroring wizardBird.js -- */

  function dolphinWriting() {
    return dphSvg(
      '<rect x="60" y="46" width="30" height="23" rx="2" fill="' + DPH.paper + '" stroke="' + DPH.paperLn + '" stroke-width="0.7" transform="rotate(-4,75,57)" />' +
      '<line x1="65" y1="53" x2="86" y2="52" stroke="' + DPH.paperLn + '" stroke-width="0.7" />' +
      '<line x1="65" y1="58" x2="83" y2="57" stroke="' + DPH.paperLn + '" stroke-width="0.7" />' +
      '<rect x="58" y="47" width="20" height="3" rx="1.5" fill="' + DPH.penBody + '" transform="rotate(-22 58 47)" />' +
      dolphinBody({ tilt: 4, lookDir: 1 })
    );
  }

  function dolphinThinking() {
    return dphSvg(
      '<circle cx="82" cy="9" r="6" fill="' + DPH.cloud + '" />' +
      '<circle cx="89" cy="7" r="5" fill="' + DPH.cloud + '" />' +
      '<circle cx="85" cy="4" r="5" fill="' + DPH.cloud + '" />' +
      '<ellipse cx="85" cy="11" rx="9" ry="4" fill="' + DPH.cloud + '" />' +
      '<circle cx="77" cy="16" r="2.5" fill="' + DPH.cloudDk + '" opacity="0.5" />' +
      '<text x="85" y="11" font-size="9" fill="' + DPH.dk + '" font-weight="bold" text-anchor="middle" opacity="0.5">?</text>' +
      dolphinBody({ tilt: -3, lookDir: 1, finAngle: 14 })
    );
  }

  function dolphinFocused() {
    return dphSvg(
      '<rect x="60" y="44" width="30" height="22" rx="2" fill="' + DPH.paper + '" stroke="' + DPH.paperLn + '" stroke-width="0.7" />' +
      '<line x1="64" y1="51" x2="86" y2="51" stroke="' + DPH.paperLn + '" stroke-width="0.6" />' +
      '<line x1="64" y1="56" x2="84" y2="56" stroke="' + DPH.paperLn + '" stroke-width="0.6" />' +
      '<line x1="64" y1="61" x2="80" y2="61" stroke="' + DPH.paperLn + '" stroke-width="0.6" />' +
      dolphinBody({ tilt: 4, lookDir: 1 })
    );
  }

  function dolphinPhone() {
    return dphSvg(
      dolphinBody({ tilt: -2, lookDir: 1 }) +
      '<rect x="66" y="40" width="14" height="24" rx="2.5" fill="' + DPH.phone + '" />' +
      '<rect x="68" y="43" width="10" height="17" rx="1" fill="' + DPH.phoneSc + '" />' +
      '<line x1="70" y1="47" x2="76" y2="47" stroke="#fff" stroke-width="0.6" opacity="0.4" />' +
      '<line x1="70" y1="50" x2="75" y2="50" stroke="#fff" stroke-width="0.6" opacity="0.3" />' +
      '<ellipse cx="64" cy="50" rx="8" ry="3.8" fill="' + DPH.dk + '" transform="rotate(-10,64,50)" />'
    );
  }

  function dolphinMoney() {
    return dphSvg(
      '<rect x="6" y="6" width="32" height="19" rx="3" fill="' + DPH.money + '" />' +
      '<rect x="9" y="9" width="26" height="13" rx="1.5" fill="none" stroke="' + DPH.moneyDk + '" stroke-width="0.8" />' +
      '<text x="22" y="19" font-size="11" fill="' + DPH.moneyDk + '" font-weight="bold" text-anchor="middle">₺</text>' +
      '<ellipse cx="76" cy="60" rx="8" ry="6.5" fill="' + DPH.coinDk + '" />' +
      '<ellipse cx="76" cy="58" rx="8" ry="6.5" fill="' + DPH.coin + '" />' +
      '<text x="76" y="61" font-size="6" fill="' + DPH.coinDk + '" font-weight="bold" text-anchor="middle">₺</text>' +
      '<ellipse cx="86" cy="64" rx="7" ry="5.5" fill="' + DPH.coinDk + '" opacity="0.8" />' +
      '<ellipse cx="86" cy="62" rx="7" ry="5.5" fill="' + DPH.coin + '" opacity="0.9" />' +
      dolphinBody({ finAngle: 30 })
    );
  }

  function dolphinCamera() {
    return dphSvg(
      dolphinBody({ tilt: 2, lookDir: 1 }) +
      '<rect x="66" y="28" width="22" height="15" rx="3" fill="' + DPH.camera + '" />' +
      '<circle cx="77" cy="35" r="5" fill="' + DPH.cameraDk + '" />' +
      '<circle cx="77" cy="35" r="3.5" fill="' + DPH.cameraL + '" />' +
      '<circle cx="77" cy="35" r="2" fill="' + DPH.eye + '" />' +
      '<ellipse cx="65" cy="40" rx="8" ry="3.8" fill="' + DPH.dk + '" transform="rotate(6,65,40)" />'
    );
  }

  function dolphinTools() {
    return dphSvg(
      dolphinBody({ tilt: 3, lookDir: 1 }) +
      '<g transform="translate(64,40) scale(0.72)">' +
      '<path d="M33 10a8 8 0 0 0-10 10L9 34a4.5 4.5 0 0 0 6.4 6.4L29 26a8 8 0 0 0 10-10l-6 6-4-1-1-4z" fill="' + DPH.tool + '" />' +
      "</g>" +
      '<ellipse cx="63" cy="52" rx="8" ry="3.8" fill="' + DPH.dk + '" transform="rotate(-10,63,52)" />'
    );
  }

  function dolphinEnvelope() {
    return dphSvg(
      dolphinBody({ tilt: 3, lookDir: 1 }) +
      '<g transform="translate(60,44) rotate(-5)">' +
      '<rect x="0" y="0" width="27" height="18" rx="2" fill="' + DPH.envelope + '" />' +
      '<path d="M0,0 L13.5,10 L27,0" fill="' + DPH.envFlap + '" />' +
      "</g>" +
      '<ellipse cx="60" cy="56" rx="8" ry="3.8" fill="' + DPH.dk + '" transform="rotate(-10,60,56)" />'
    );
  }

  function dolphinSuccessSvg() {
    return dphSvg(
      dolphinBody({ finAngle: -20 }) +
      '<path d="M80,42 L82,37 L84,42 L89,44 L84,46 L82,51 L80,46 L75,44 Z" fill="' + DPH.penBody + '" opacity="0.4" />' +
      '<path d="M12,16 L13,13 L14,16 L17,17 L14,18 L13,21 L12,18 L9,17 Z" fill="' + DPH.penBody + '" opacity="0.3" />' +
      '<path d="M86,10 L89,14 L96,4" stroke="' + DPH.check + '" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6" />'
    );
  }

  // Leaping with the envelope -- submit animation + email verify hero.
  function dolphinLeapingSvg() {
    return dphSvg(
      dolphinBody({ tilt: -6 }) +
      '<path d="M22,76 Q32,68 42,76" stroke="' + DPH.belly + '" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.55" />' +
      '<path d="M14,80 Q26,73 38,80" stroke="' + DPH.belly + '" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.35" />' +
      '<circle cx="34" cy="66" r="2" fill="' + DPH.belly + '" opacity="0.5" />' +
      '<g transform="translate(58,52)">' +
      '<rect x="0" y="0" width="24" height="16" rx="2" fill="' + DPH.envelope + '" />' +
      '<path d="M0,0 L12,9 L24,0" fill="' + DPH.envFlap + '" />' +
      '<path d="M10,6 C10,4.6 12,3.9 12,5.4 C12,3.9 14,4.6 14,6 L12,8.6 Z" fill="' + DPH.heart + '" />' +
      "</g>",
      "0 0 105 82"
    );
  }

  // field-name -> pose (mirrors Yapply's BIRD_POSES step map)
  var DOLPHIN_POSES = {
    fullName: dolphinWriting,
    companyName: dolphinWriting,
    businessName: dolphinWriting,
    businessWebsite: dolphinWriting,
    businessDescription: dolphinWriting,
    email: dolphinEnvelope,
    password: dolphinFocused,
    confirmPassword: dolphinFocused,
    phoneNumber: dolphinPhone,
    preferredRegion: dolphinThinking,
    serviceArea: dolphinThinking,
    yearsExperience: dolphinFocused,
    specialties: dolphinTools,
    selfie: dolphinCamera,
    individualPortfolioLink: dolphinFocused,
  };

  function getDolphinSvg(key) {
    var fn = DOLPHIN_POSES[key] || dolphinWriting;
    return fn();
  }

  /* -- Haptics + WebAudio detent tick (ported from Yapply's bidDial) -- */
  function haptic(kind) {
    try {
      if (
        window.Capacitor &&
        window.Capacitor.Plugins &&
        window.Capacitor.Plugins.Haptics &&
        window.Capacitor.Plugins.Haptics.impact
      ) {
        if (kind === "success" && window.Capacitor.Plugins.Haptics.notification) {
          window.Capacitor.Plugins.Haptics.notification({ type: "SUCCESS" });
        } else {
          window.Capacitor.Plugins.Haptics.impact({ style: kind === "medium" ? "MEDIUM" : "LIGHT" });
        }
      } else if (navigator.vibrate) {
        navigator.vibrate(kind === "medium" ? 14 : 6);
      }
    } catch (_) {}
  }

  // Fuller WebAudio "tick": bright click over a short low body — a satisfying
  // detent, no audio asset needed. Same recipe as Yapply's dial.
  var _ac = null;
  function tickSound() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      _ac = _ac || new AC();
      if (_ac.state === "suspended") _ac.resume();
      var t = _ac.currentTime;
      var out = _ac.createGain();
      out.gain.value = 0.9;
      out.connect(_ac.destination);
      var o1 = _ac.createOscillator();
      var g1 = _ac.createGain();
      o1.type = "square";
      o1.frequency.setValueAtTime(1250, t);
      g1.gain.setValueAtTime(0.0001, t);
      g1.gain.exponentialRampToValueAtTime(0.09, t + 0.004);
      g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
      o1.connect(g1); g1.connect(out);
      o1.start(t); o1.stop(t + 0.05);
      var o2 = _ac.createOscillator();
      var g2 = _ac.createGain();
      o2.type = "triangle";
      o2.frequency.setValueAtTime(320, t);
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(0.07, t + 0.006);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      o2.connect(g2); g2.connect(out);
      o2.start(t); o2.stop(t + 0.065);
    } catch (_) {}
  }

  // Detent = light haptic + click, fired on every wheel notch.
  function detent() {
    haptic("light");
    tickSound();
  }

  /* -------------------------------------------------------------
     Markup builder (bilingual EN/TR via isTr).
     ------------------------------------------------------------- */
  /* -- Selectable data: regions / experience / specialty categories --
     Stored as stable values so professionals can be categorized later. */
  var NAUTICO_REGIONS = [
    "İstanbul", "Bodrum", "Marmaris", "Fethiye", "Göcek", "Antalya",
    "Kaş", "Çeşme", "İzmir", "Kuşadası", "Didim", "Ayvalık", "Mersin",
  ];

  var NAUTICO_SPECIALTIES = [
    { v: "engine-mechanical", tr: "Motor & Mekanik", en: "Engine & Mechanical" },
    { v: "electrical-electronics", tr: "Elektrik & Elektronik", en: "Electrical & Electronics" },
    { v: "paint-gelcoat", tr: "Boya & Gelcoat", en: "Paint & Gelcoat" },
    { v: "fiberglass-composite", tr: "Fiberglas & Kompozit", en: "Fiberglass & Composite" },
    { v: "woodwork", tr: "Ahşap İşleri", en: "Woodwork" },
    { v: "sails-rigging", tr: "Yelken & Arma", en: "Sails & Rigging" },
    { v: "cleaning", tr: "Tekne Temizliği", en: "Boat Cleaning" },
    { v: "winterization-storage", tr: "Kışlama & Depolama", en: "Winterization & Storage" },
    { v: "hvac-refrigeration", tr: "Klima & Soğutma", en: "HVAC & Refrigeration" },
    { v: "plumbing-water", tr: "Su Sistemleri & Tesisat", en: "Plumbing & Water Systems" },
    { v: "navigation-equipment", tr: "Navigasyon & Ekipman", en: "Navigation & Equipment" },
    { v: "captain-transfer", tr: "Kaptanlık & Transfer", en: "Captain & Transfer" },
    { v: "marina-services", tr: "Marina Hizmetleri", en: "Marina Services" },
    { v: "insurance-survey", tr: "Sigorta & Ekspertiz", en: "Insurance & Survey" },
    { v: "other", tr: "Diğer", en: "Other" },
  ];

  var NAUTICO_EXPERIENCE = ["0-1", "1-3", "3-5", "5-10", "10-20", "20+"];

  // iOS-style liquid scroll-wheel selector. multi=true adds an "+ Add"
  // button collecting picks as removable tags below the wheel.
  function buildWheel(key, items, isTr, multi) {
    var rows = items.map(function (item) {
      var value = typeof item === "string" ? item : item.v;
      var label = typeof item === "string" ? item : isTr ? item.tr : item.en;
      return '<div class="nw-wheel-item" data-wheel-value="' + value + '">' + label + "</div>";
    }).join("");
    return (
      '<div class="nw-wheel-wrap" data-onboarding-wheel="' + key + '"' + (multi ? ' data-wheel-multi="1"' : "") + ">" +
      '<div class="nw-wheel-hl"></div>' +
      '<div class="nw-wheel">' + rows + "</div>" +
      "</div>" +
      (multi
        ? '<div class="nw-wheel-actions"><button type="button" class="onboarding-chip nw-wheel-add" data-wheel-add="' + key + '">' + (isTr ? "+ Ekle" : "+ Add") + "</button></div>" +
          '<div class="nw-tags" data-wheel-tags="' + key + '"></div>'
        : "") +
      '<input type="hidden" name="' + key + '" data-onboarding-chips-input="' + key + '" />'
    );
  }

  function buildMarkup(isTr, activeLang) {
    var pwPlaceholder = "********";
    var trActive = activeLang === "tr" ? " onboarding-theme-btn--active" : "";
    var enActive = activeLang === "en" ? " onboarding-theme-btn--active" : "";

    var otp = "";
    for (var i = 0; i < 6; i++) {
      otp +=
        '<input type="text" inputmode="numeric" maxlength="1" class="onboarding-otp-digit" data-otp-digit="' +
        i +
        '"' +
        (i === 0 ? ' autocomplete="one-time-code"' : "") +
        " />";
    }

    return (
      '<div class="onboarding-wizard" data-onboarding-wizard>' +
      // -- Step 1: Language --
      '<div class="onboarding-step onboarding-step--active" data-onboarding-step="1">' +
      '<div class="onboarding-step__content">' +
      '<div class="onboarding-lead-icon">' + GLOBE_SVG + "</div>" +
      '<h2 class="onboarding-step__title">Dil Seçin / Choose Language</h2>' +
      '<p class="onboarding-step__desc">Uygulamayı hangi dilde kullanmak istersiniz? / Which language would you like to use?</p>' +
      '<div class="onboarding-theme-buttons">' +
      '<button class="onboarding-theme-btn' + trActive + '" type="button" data-onboarding-lang="tr"><span>Türkçe</span></button>' +
      '<button class="onboarding-theme-btn' + enActive + '" type="button" data-onboarding-lang="en"><span>English</span></button>' +
      "</div>" +
      '<button class="button button--primary onboarding-next-btn" type="button" data-onboarding-next="2">Devam Et / Continue</button>' +
      "</div></div>" +
      // -- Step 2: Theme --
      '<div class="onboarding-step" data-onboarding-step="2" hidden>' +
      '<div class="onboarding-step__content">' +
      '<div class="onboarding-theme-preview" data-onboarding-theme-preview>' +
      '<svg viewBox="0 0 80 80" class="onboarding-theme-icon"><circle cx="40" cy="40" r="36" fill="none" stroke="var(--accent)" stroke-width="2.5"/><path d="M40 4A36 36 0 0 1 40 76z" fill="var(--accent)" opacity="0.2"/><circle cx="40" cy="40" r="14" fill="var(--accent)"/></svg>' +
      "</div>" +
      '<h2 class="onboarding-step__title" data-onboarding-theme-title>' + (isTr ? "Temayı Seçin" : "Choose Your Theme") + "</h2>" +
      '<p class="onboarding-step__desc" data-onboarding-theme-desc>' + (isTr ? "Uygulamayı açık veya koyu modda kullanmak ister misiniz?" : "Would you like to use the app in Light or Dark mode?") + "</p>" +
      '<div class="onboarding-theme-buttons">' +
      '<button class="onboarding-theme-btn" type="button" data-onboarding-theme="light"><span class="onboarding-theme-btn__icon">' + SUN_SVG + "</span><span data-onboarding-theme-light-label>" + (isTr ? "Açık Mod" : "Light Mode") + "</span></button>" +
      '<button class="onboarding-theme-btn onboarding-theme-btn--active" type="button" data-onboarding-theme="dark"><span class="onboarding-theme-btn__icon">' + MOON_SVG + "</span><span data-onboarding-theme-dark-label>" + (isTr ? "Koyu Mod" : "Dark Mode") + "</span></button>" +
      "</div>" +
      '<p class="onboarding-feedback" data-onboarding-feedback hidden></p>' +
      '<button class="button button--primary onboarding-next-btn" type="button" data-onboarding-next="3" data-onboarding-theme-continue>' + (isTr ? "Devam Et" : "Continue") + "</button>" +
      "</div></div>" +
      // -- Step 3: Role --
      '<div class="onboarding-step" data-onboarding-step="3" hidden>' +
      '<div class="onboarding-step__content">' +
      '<h2 class="onboarding-step__title">' + (isTr ? "Siz Kimsiniz?" : "Who Are You?") + "</h2>" +
      '<p class="onboarding-step__desc">' + (isTr ? "Tekne sahibi misiniz yoksa hizmet sağlayıcı mı?" : "Are you a boat owner or a service provider?") + "</p>" +
      '<div class="onboarding-role-cards">' +
      '<button class="onboarding-role-card" type="button" data-onboarding-role="owner">' +
      '<div class="onboarding-role-card__bird" data-onboarding-bird="owner">' + ANCHOR_SVG + "</div>" +
      '<span class="onboarding-role-card__label">' + (isTr ? "Tekne Sahibi" : "Boat Owner") + "</span>" +
      '<span class="onboarding-role-card__desc">' + (isTr ? "Tekneniz için hizmet bulun" : "Find services for your boat") + "</span>" +
      "</button>" +
      '<button class="onboarding-role-card" type="button" data-onboarding-role="provider">' +
      '<div class="onboarding-role-card__bird" data-onboarding-bird="provider">' + WRENCH_SVG + "</div>" +
      '<span class="onboarding-role-card__label">' + (isTr ? "Hizmet Sağlayıcı" : "Service Provider") + "</span>" +
      '<span class="onboarding-role-card__desc">' + (isTr ? "İş bulun ve hizmet sunun" : "Find work and offer services") + "</span>" +
      "</button>" +
      "</div></div></div>" +
      // -- Step 4: Provider type --
      '<div class="onboarding-step" data-onboarding-step="4" hidden>' +
      '<div class="onboarding-step__content">' +
      '<h2 class="onboarding-step__title" data-onboarding-devtype-title>' + (isTr ? "Hesap Türü" : "Account Type") + "</h2>" +
      '<p class="onboarding-step__desc" data-onboarding-devtype-desc>' + (isTr ? "Bireysel mi yoksa şirket olarak mı kayıt oluyorsunuz?" : "Are you registering as an independent or a company?") + "</p>" +
      '<div class="onboarding-role-cards">' +
      '<button class="onboarding-role-card" type="button" data-onboarding-devtype="individual">' +
      '<div class="onboarding-role-card__bird">' + PERSON_SVG + "</div>" +
      '<span class="onboarding-role-card__label">' + (isTr ? "Bireysel" : "Independent") + "</span>" +
      '<span class="onboarding-role-card__desc">' + (isTr ? "Kendi adınıza hizmet verin" : "Work under your own name") + "</span>" +
      "</button>" +
      '<button class="onboarding-role-card" type="button" data-onboarding-devtype="business">' +
      '<div class="onboarding-role-card__bird">' + BUILDING_SVG + "</div>" +
      '<span class="onboarding-role-card__label">' + (isTr ? "Şirket" : "Company") + "</span>" +
      '<span class="onboarding-role-card__desc">' + (isTr ? "Şirketiniz adına kayıt olun" : "Register as a company") + "</span>" +
      "</button>" +
      "</div></div></div>" +
      // -- Step 5: Account form --
      '<div class="onboarding-step" data-onboarding-step="5" hidden>' +
      '<div class="onboarding-step__content">' +
      '<div class="onboarding-mascot" data-onboarding-mascot aria-hidden="true"></div>' +
      '<h2 class="onboarding-step__title">' + (isTr ? "Hesap Bilgileri" : "Account Details") + "</h2>" +
      '<p class="onboarding-step__desc" data-onboarding-form-desc></p>' +
      '<form class="onboarding-form" data-onboarding-form novalidate>' +
      '<input type="hidden" name="accountRole" value="owner" data-onboarding-role-input />' +
      '<input type="hidden" name="developerType" value="" data-onboarding-devtype-input />' +
      '<div class="onboarding-form-error" data-onboarding-error hidden><p data-onboarding-error-text></p></div>' +
      // Shared fields -- no username: people are shown by personal/company name
      '<label class="onboarding-field"><span>' + (isTr ? "Ad Soyad" : "Full Name") + '</span><input type="text" name="fullName" placeholder="' + (isTr ? "Adınız Soyadınız" : "Your full name") + '" autocomplete="name" required /></label>' +
      '<label class="onboarding-field"><span>' + (isTr ? "E-posta" : "Email") + '</span><input type="email" name="email" placeholder="' + (isTr ? "ornek@mail.com" : "you@email.com") + '" autocomplete="email" required /></label>' +
      '<label class="onboarding-field"><span>' + (isTr ? "Şifre" : "Password") + '</span><input type="password" name="password" placeholder="' + pwPlaceholder + '" autocomplete="new-password" minlength="8" required /></label>' +
      '<label class="onboarding-field"><span>' + (isTr ? "Şifre Tekrar" : "Confirm Password") + '</span><input type="password" name="confirmPassword" placeholder="' + pwPlaceholder + '" autocomplete="new-password" minlength="8" required /></label>' +
      '<label class="onboarding-field"><span>' + (isTr ? "Telefon" : "Phone") + '</span><input type="tel" name="phoneNumber" placeholder="+90 5XX XXX XX XX" autocomplete="tel" required /></label>' +
      // Owner-specific fields
      '<div class="onboarding-role-fields" data-onboarding-role-fields="owner">' +
      '<label class="onboarding-field"><span>' + (isTr ? "Şehir" : "City") + '</span><input type="text" name="preferredRegion" placeholder="' + (isTr ? "İstanbul, Bodrum..." : "Istanbul, Bodrum...") + '" /></label>' +
      "</div>" +
      // Provider shared fields
      '<div class="onboarding-role-fields" data-onboarding-role-fields="provider" hidden>' +
      '<label class="onboarding-field"><span>' + (isTr ? "Firma / Profesyonel Adı" : "Company / Professional Name") + '</span><input type="text" name="companyName" placeholder="' + (isTr ? "Firma veya profesyonel adınız" : "Your company or professional name") + '" /></label>' +
      // Service area -- iOS-style wheel, not typeable
      '<div class="onboarding-field onboarding-field--center" data-onboarding-chip-field="serviceArea"><span>' + (isTr ? "Hizmet Bölgesi" : "Service Area") + "</span>" +
      '<p class="onboarding-chip-hint">' + (isTr ? "Kaydırın ve bölge ekleyin" : "Scroll and add your regions") + "</p>" +
      buildWheel("serviceArea", NAUTICO_REGIONS, isTr, true) + "</div>" +
      // Experience -- iOS-style wheel, single pick
      '<div class="onboarding-field onboarding-field--center"><span>' + (isTr ? "Deneyim (Yıl)" : "Years of Experience") + "</span>" +
      buildWheel("yearsExperience", NAUTICO_EXPERIENCE.map(function (y) { return { v: y, tr: y + " yıl", en: y + " years" }; }), isTr, false) + "</div>" +
      // Specialty -- iOS-style wheel with multi-add (stable category keys)
      '<div class="onboarding-field onboarding-field--center" data-onboarding-chip-field="specialties"><span>' + (isTr ? "Uzmanlık Alanı" : "Specialty") + "</span>" +
      '<p class="onboarding-chip-hint">' + (isTr ? "Kaydırın ve kategori ekleyin" : "Scroll and add your categories") + "</p>" +
      buildWheel("specialties", NAUTICO_SPECIALTIES, isTr, true) + "</div>" +
      // Selfie (required for providers)
      '<div class="onboarding-field" data-onboarding-selfie-section>' +
      '<span data-onboarding-selfie-title>' + (isTr ? "Selfie Doğrulama (Zorunlu)" : "Selfie Verification (Required)") + "</span>" +
      '<p class="onboarding-selfie-note">' + (isTr ? "Bu görsel profil resminiz olarak kullanılacaktır." : "This image will be used as your profile picture.") + "</p>" +
      // Business accounts may choose selfie OR company logo
      '<div class="onboarding-selfie-mode" data-onboarding-avatar-mode hidden>' +
      '<button type="button" class="onboarding-chip onboarding-chip--active" data-onboarding-avatar-choice="selfie">' + (isTr ? "Selfie Çek" : "Take Selfie") + "</button>" +
      '<button type="button" class="onboarding-chip" data-onboarding-avatar-choice="logo">' + (isTr ? "İşletme Logosu Yükle" : "Upload Business Logo") + "</button>" +
      "</div>" +
      '<div class="onboarding-selfie-icon">' + CAMERA_SVG + "</div>" +
      "<div data-onboarding-selfie-camera-ui>" +
      '<p class="onboarding-selfie-hint">' + (isTr ? "Doğrulama için şimdi ön kameradan bir selfie çekin" : "Take a live selfie with the front camera now to verify") + "</p>" +
      '<video data-onboarding-selfie-video autoplay playsinline muted class="onboarding-selfie-video"></video>' +
      '<canvas data-onboarding-selfie-canvas style="display:none"></canvas>' +
      '<div class="onboarding-selfie-actions">' +
      '<button type="button" class="button button--secondary onboarding-selfie-btn" data-onboarding-selfie-start>' + (isTr ? "Kamerayı Aç" : "Open Camera") + "</button>" +
      '<button type="button" class="button button--primary onboarding-selfie-btn" data-onboarding-selfie-capture style="display:none">' + (isTr ? "Fotoğraf Çek" : "Take Photo") + "</button>" +
      '<button type="button" class="button button--secondary onboarding-selfie-btn" data-onboarding-selfie-retake style="display:none">' + (isTr ? "Tekrar Çek" : "Retake") + "</button>" +
      "</div></div>" +
      '<div data-onboarding-selfie-upload-ui style="display:none">' +
      '<p class="onboarding-selfie-hint">' + (isTr ? "Kamera açılamıyorsa bir selfie yükleyin" : "If the camera will not open, upload a selfie") + "</p>" +
      '<input type="file" accept="image/*" capture="user" data-onboarding-selfie-file class="onboarding-selfie-file" />' +
      "</div>" +
      '<div data-onboarding-logo-ui style="display:none">' +
      '<p class="onboarding-selfie-hint">' + (isTr ? "İşletme logonuzu yükleyin (kare önerilir)" : "Upload your business logo (square recommended)") + "</p>" +
      '<input type="file" accept="image/*" data-onboarding-logo-file class="onboarding-selfie-file" />' +
      "</div>" +
      '<img data-onboarding-selfie-preview class="onboarding-selfie-preview" alt="" />' +
      '<img data-onboarding-logo-preview class="onboarding-selfie-preview onboarding-logo-preview" alt="" />' +
      '<input type="hidden" name="selfieData" data-onboarding-selfie-data />' +
      "</div>" +
      // Business extra fields
      "<div data-onboarding-business-fields hidden>" +
      '<label class="onboarding-field"><span>' + (isTr ? "İşletme Adı" : "Business Name") + '</span><input type="text" name="businessName" placeholder="' + (isTr ? "Şirket adınız" : "Your business name") + '" /></label>' +
      '<label class="onboarding-field"><span>' + (isTr ? "İşletme Web Sitesi" : "Business Website") + '</span><input type="url" name="businessWebsite" placeholder="https://example.com" /></label>' +
      '<label class="onboarding-field"><span>' + (isTr ? "İşletme Açıklaması" : "Business Description") + '</span><textarea name="businessDescription" rows="3" placeholder="' + (isTr ? "Şirketiniz hakkında kısa bilgi..." : "Brief description of your business...") + '"></textarea></label>' +
      "</div>" +
      // Individual extra fields
      "<div data-onboarding-individual-fields hidden>" +
      '<label class="onboarding-field"><span>' + (isTr ? "Portföy Linki (İsteğe Bağlı)" : "Portfolio Link (Optional)") + '</span><input type="url" name="individualPortfolioLink" placeholder="https://portfolio.com" /></label>' +
      "</div>" +
      "</div>" +
      '<button class="button button--primary onboarding-submit-btn" type="submit">' + (isTr ? "Hesap Oluştur" : "Create Account") + "</button>" +
      "</form></div></div>" +
      // -- Step 6: OTP verify --
      '<div class="onboarding-step" data-onboarding-step="6" hidden>' +
      '<div class="onboarding-step__content">' +
      '<div class="onboarding-email-bird onboarding-mascot--float">' + dolphinEnvelope() + "</div>" +
      '<h2 class="onboarding-step__title">' + (isTr ? "E-postanızı Doğrulayın" : "Verify Your Email") + "</h2>" +
      '<p class="onboarding-step__desc" data-onboarding-verify-desc>' + (isTr ? "Doğrulama kodunu e-postanıza gönderdik." : "We sent a verification code to your email.") + "</p>" +
      '<p class="onboarding-verify-email-display" data-onboarding-verify-email></p>' +
      '<div class="onboarding-form-error" data-onboarding-otp-error hidden><p data-onboarding-otp-error-text></p></div>' +
      '<div class="onboarding-otp-inputs" data-onboarding-otp-container>' + otp + "</div>" +
      '<button class="button button--primary onboarding-verify-btn" type="button" data-onboarding-verify-btn disabled>' + (isTr ? "Doğrula" : "Verify") + "</button>" +
      '<p class="onboarding-resend-line">' + (isTr ? "Kod gelmedi mi?" : "Didn't receive the code?") + ' <button type="button" class="onboarding-resend-btn" data-onboarding-resend-btn>' + (isTr ? "Tekrar Gönder" : "Resend") + "</button></p>" +
      "</div></div>" +
      // -- Step 7: Success --
      '<div class="onboarding-step" data-onboarding-step="7" hidden>' +
      '<div class="onboarding-step__content onboarding-success">' +
      '<div class="onboarding-success__bird" data-onboarding-success-bird></div>' +
      '<h2 class="onboarding-step__title" data-onboarding-success-title></h2>' +
      '<p class="onboarding-step__desc" data-onboarding-success-desc></p>' +
      '<button class="button button--primary onboarding-next-btn" type="button" data-onboarding-go>' + (isTr ? "Başlayalım" : "Let's Go") + "</button>" +
      "</div></div>" +
      // -- Progress dots --
      '<div class="onboarding-dots">' +
      '<span class="onboarding-dot onboarding-dot--active" data-onboarding-dot="1"></span>' +
      '<span class="onboarding-dot" data-onboarding-dot="2"></span>' +
      '<span class="onboarding-dot" data-onboarding-dot="3"></span>' +
      '<span class="onboarding-dot" data-onboarding-dot="4"></span>' +
      '<span class="onboarding-dot" data-onboarding-dot="5"></span>' +
      '<span class="onboarding-dot" data-onboarding-dot="6"></span>' +
      '<span class="onboarding-dot" data-onboarding-dot="7"></span>' +
      "</div>" +
      "</div>"
    );
  }

  /* -------------------------------------------------------------
     Wire up all behaviour on a freshly mounted host.
     ------------------------------------------------------------- */
  function wire(host, locale) {
    var wizard = host.querySelector("[data-onboarding-wizard]");
    if (!wizard) return;

    var isTr = locale === "tr";
    var currentStep = 1;
    var selectedRole = "owner";
    var selectedDevType = "";
    var selfieStream = null;
    var selfieDataUrl = "";
    var logoDataUrl = "";
    var avatarMode = "selfie"; // "selfie" | "logo" (logo only for business accounts)
    var pendingEmail = "";
    var finishUser = null;

    // Camera is the primary selfie path; upload UI only appears if it fails.
    var selfieCameraUI = wizard.querySelector("[data-onboarding-selfie-camera-ui]");
    var selfieUploadUI = wizard.querySelector("[data-onboarding-selfie-upload-ui]");
    if (selfieCameraUI) selfieCameraUI.style.display = "";
    if (selfieUploadUI) selfieUploadUI.style.display = "none";

    /* --- One-field-at-a-time pager (step 5) --- */
    var _pagerIndex = 0;
    var _pagerGroups = [];

    function _collectPagerGroups() {
      var form = wizard.querySelector("[data-onboarding-form]");
      if (!form) return [];
      var groups = [];
      var isVisible = function (el) {
        for (var n = el; n && n !== form; n = n.parentElement) {
          if (n.hidden) return false;
        }
        return true;
      };
      var fields = Array.prototype.slice.call(form.querySelectorAll(".onboarding-field"));
      var skip = [];
      var inSkip = function (f) { return skip.indexOf(f) !== -1; };
      fields.forEach(function (field) {
        if (!isVisible(field) || inSkip(field)) return;
        var input = field.querySelector("input, textarea, select");
        var name = (input && input.getAttribute("name")) || "";
        if (input && input.disabled) return;
        if (name === "password") {
          var confirm = null;
          fields.forEach(function (f) {
            if (!confirm && f.querySelector('[name="confirmPassword"]')) confirm = f;
          });
          if (confirm && isVisible(confirm)) {
            skip.push(confirm);
            groups.push([field, confirm]);
            return;
          }
        }
        if (name === "confirmPassword" && inSkip(field)) return;
        groups.push([field]);
      });
      return groups;
    }

    function _renderPagerControls(form) {
      var bar = form.querySelector("[data-onboarding-pager]");
      if (!bar) {
        bar = document.createElement("div");
        bar.setAttribute("data-onboarding-pager", "");
        bar.className = "onboarding-pager";
        bar.innerHTML =
          '<div class="yapply-step-progress"><div class="yapply-step-progress__fill" data-onboarding-pager-fill style="width:0%"></div></div>' +
          '<div data-onboarding-pager-progress class="onboarding-pager__count"></div>' +
          '<div class="onboarding-pager__buttons">' +
          '<button type="button" class="button button--secondary" data-onboarding-pager-back>' + (isTr ? "Geri" : "Back") + "</button>" +
          '<button type="button" class="button button--primary" data-onboarding-pager-next>' + (isTr ? "Devam Et" : "Continue") + "</button>" +
          "</div>";
        var submitBtn = form.querySelector(".onboarding-submit-btn");
        form.insertBefore(bar, submitBtn);
        bar.querySelector("[data-onboarding-pager-back]").addEventListener("click", function () {
          if (_pagerIndex > 0) {
            _pagerIndex -= 1;
            haptic();
            _showPagerGroup();
          }
        });
        bar.querySelector("[data-onboarding-pager-next]").addEventListener("click", function () {
          var group = _pagerGroups[_pagerIndex] || [];
          var showPagerError = function (msg) {
            var errBox = wizard.querySelector("[data-onboarding-error]");
            var errTxt = wizard.querySelector("[data-onboarding-error-text]");
            if (errBox && errTxt) {
              errTxt.textContent = msg;
              errBox.hidden = false;
            }
          };
          for (var g = 0; g < group.length; g++) {
            var inputs = group[g].querySelectorAll("input, textarea, select");
            for (var k = 0; k < inputs.length; k++) {
              var input = inputs[k];
              if (input.willValidate && !input.checkValidity()) {
                input.reportValidity();
                return;
              }
            }
          }
          // Wheel groups (service area / experience / specialties): require a value.
          for (var c = 0; c < group.length; c++) {
            var wheelInput = group[c].querySelector("[data-onboarding-chips-input]");
            if (wheelInput && !wheelInput.disabled && !wheelInput.value) {
              showPagerError(isTr ? "Devam etmek için en az bir seçim yapın." : "Please select at least one option to continue.");
              return;
            }
          }
          var onSelfieStep = group.some(function (f) {
            return f.hasAttribute("data-onboarding-selfie-section") || f.querySelector("[data-onboarding-selfie-section]");
          });
          var hasAvatar = avatarMode === "logo" ? !!logoDataUrl : !!selfieDataUrl;
          if (onSelfieStep && selectedRole === "provider" && !hasAvatar) {
            showPagerError(
              selectedDevType === "business"
                ? isTr ? "Devam etmek için bir selfie çekin veya işletme logonuzu yükleyin." : "Please take a selfie or upload your business logo to continue."
                : isTr ? "Devam etmek için bir selfie çekin (doğrulama gerekli)." : "Please take a selfie to continue (verification required)."
            );
            return;
          }
          var hasPw = group.some(function (f) { return f.querySelector('[name="password"]'); });
          if (hasPw) {
            var pw = wizard.querySelector('[data-onboarding-form] [name="password"]');
            var cpw = wizard.querySelector('[data-onboarding-form] [name="confirmPassword"]');
            if (pw && cpw && pw.value !== cpw.value) {
              cpw.setCustomValidity(isTr ? "Şifreler eşleşmiyor" : "Passwords do not match");
              cpw.reportValidity();
              cpw.setCustomValidity("");
              return;
            }
          }
          if (_pagerIndex < _pagerGroups.length - 1) {
            haptic();
            var formEl = wizard.querySelector("[data-onboarding-form]");
            _playStepCheck(formEl, function () {
              _pagerIndex += 1;
              _showPagerGroup(true);
            });
          }
        });
      }
      return bar;
    }

    function _playStepCheck(hostEl, done) {
      try {
        var overlay = document.createElement("div");
        overlay.className = "yapply-step-check";
        overlay.innerHTML =
          '<div class="yapply-step-check__badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5 10-11"/></svg></div>';
        document.body.appendChild(overlay);
        setTimeout(function () { overlay.classList.add("yapply-step-check--leaving"); }, 340);
        setTimeout(function () {
          overlay.remove();
          if (typeof done === "function") done();
        }, 560);
      } catch (_) {
        if (typeof done === "function") done();
      }
    }

    function _playDolphinLeap(done) {
      try {
        var overlay = document.createElement("div");
        overlay.className = "nautico-leap";
        overlay.innerHTML = '<div class="nautico-leap__dolphin">' + dolphinLeapingSvg() + "</div>";
        document.body.appendChild(overlay);
        setTimeout(function () {
          overlay.remove();
          if (typeof done === "function") done();
        }, 980);
      } catch (_) {
        if (typeof done === "function") done();
      }
    }

    // Swap the dolphin's pose to match the field on screen (Yapply bird port).
    function _updateMascot(group) {
      var mascot = wizard.querySelector("[data-onboarding-mascot]");
      if (!mascot) return;
      var key = "";
      var g0 = group && group[0];
      if (g0) {
        if (g0.hasAttribute("data-onboarding-selfie-section") || g0.querySelector("[data-onboarding-selfie-section]")) {
          key = "selfie";
        } else {
          var inp = g0.querySelector("input, textarea, select");
          key = (inp && inp.getAttribute("name")) || "";
        }
      }
      if (mascot.dataset.pose === key) return;
      mascot.dataset.pose = key;
      mascot.innerHTML = getDolphinSvg(key);
    }

    function _showPagerGroup(animated) {
      var form = wizard.querySelector("[data-onboarding-form]");
      if (!form || _pagerGroups.length === 0) return;
      var bar = _renderPagerControls(form);
      var submitBtn = form.querySelector(".onboarding-submit-btn");
      var errorBox = form.querySelector("[data-onboarding-error]");

      var allFields = form.querySelectorAll(".onboarding-field");
      Array.prototype.forEach.call(allFields, function (f) { f.style.display = "none"; });
      var group = _pagerGroups[_pagerIndex] || [];
      _updateMascot(group);
      group.forEach(function (f) {
        f.style.display = "";
        if (animated) {
          f.classList.remove("yapply-step-anim-in");
          void f.offsetWidth;
          f.classList.add("yapply-step-anim-in");
        }
        f.querySelectorAll("[data-onboarding-wheel]").forEach(function (w) {
          if (w._refreshWheel) w._refreshWheel();
        });
      });

      var isLast = _pagerIndex >= _pagerGroups.length - 1;
      var backBtn = bar.querySelector("[data-onboarding-pager-back]");
      var nextBtn = bar.querySelector("[data-onboarding-pager-next]");
      if (backBtn) backBtn.style.visibility = _pagerIndex === 0 ? "hidden" : "visible";
      if (nextBtn) nextBtn.style.display = isLast ? "none" : "";
      if (submitBtn) submitBtn.style.display = isLast ? "" : "none";
      if (errorBox && !isLast) errorBox.hidden = true;

      var progress = bar.querySelector("[data-onboarding-pager-progress]");
      if (progress) progress.textContent = (_pagerIndex + 1) + " / " + _pagerGroups.length;
      var fill = bar.querySelector("[data-onboarding-pager-fill]");
      if (fill) fill.style.width = Math.round(((_pagerIndex + 1) / _pagerGroups.length) * 100) + "%";

      var firstInput = group[0] && group[0].querySelector("input, textarea, select");
      if (firstInput && firstInput.type !== "file") {
        setTimeout(function () {
          try { firstInput.focus({ preventScroll: true }); } catch (_) {}
        }, 250);
      }
    }

    function _startFieldPager() {
      _pagerGroups = _collectPagerGroups();
      _pagerIndex = 0;
      if (_pagerGroups.length > 0) _showPagerGroup();
    }

    /* --- Step navigation --- */
    function goToStep(step) {
      wizard.querySelectorAll("[data-onboarding-step]").forEach(function (el) {
        el.hidden = true;
        el.classList.remove("onboarding-step--active");
      });
      var target = wizard.querySelector('[data-onboarding-step="' + step + '"]');
      if (target) {
        target.hidden = false;
        requestAnimationFrame(function () {
          target.classList.add("onboarding-step--active");
        });
      }
      wizard.querySelectorAll("[data-onboarding-dot]").forEach(function (dot) {
        var dotStep = parseInt(dot.getAttribute("data-onboarding-dot"), 10);
        dot.classList.toggle("onboarding-dot--active", dotStep === step);
        dot.classList.toggle("onboarding-dot--done", dotStep < step);
      });
      currentStep = step;
      if (step === 5) {
        setTimeout(function () { _startFieldPager(); }, 60);
      }
    }

    /* --- Success step --- */
    function showSuccessStep() {
      var successBird = wizard.querySelector("[data-onboarding-success-bird]");
      var successTitle = wizard.querySelector("[data-onboarding-success-title]");
      var successDesc = wizard.querySelector("[data-onboarding-success-desc]");
      var goBtn = wizard.querySelector("[data-onboarding-go]");

      if (successBird) {
        successBird.innerHTML = dolphinSuccessSvg();
        successBird.classList.add("onboarding-mascot--float");
      }
      if (successTitle) successTitle.textContent = isTr ? "Hoş geldiniz!" : "Welcome aboard!";
      if (successDesc) {
        successDesc.textContent =
          selectedRole === "provider"
            ? isTr ? "İlk işinizi bulun ve teklif verin" : "Find your first job and place a bid"
            : isTr ? "Tekneniz için ilk hizmet talebinizi oluşturun" : "Create your first service request for your boat";
      }
      if (goBtn && !goBtn.dataset.bound) {
        goBtn.dataset.bound = "1";
        goBtn.addEventListener("click", function () {
          haptic();
          try { localStorage.removeItem("nautico_guest_mode"); } catch (_) {}
          try {
            if (typeof window.loadApp === "function") window.loadApp(finishUser);
          } catch (_) {}
          var h = document.getElementById("nautico-wizard");
          if (h) h.remove();
        });
      }
      goToStep(7);
    }

    /* --- Auth: finalize once a session exists --- */
    function afterAuth(session) {
      finishUser = (session && session.user) || null;
      var userId = finishUser && finishUser.id;
      var chain = Promise.resolve();
      var avatarData = avatarMode === "logo" && logoDataUrl ? logoDataUrl : selfieDataUrl;
      if (selectedRole === "provider" && avatarData && userId) {
        chain = uploadSelfie(userId, avatarData).catch(function (err) {
          if (window.console) console.warn("[nautico] avatar upload failed:", err && err.message);
        });
      }
      return chain.then(function () { showSuccessStep(); });
    }

    async function uploadSelfie(userId, dataUrl) {
      if (!userId || !dataUrl || dataUrl.indexOf("data:") !== 0) return;
      if (typeof supabaseClient === "undefined" || !supabaseClient) return;
      var parts = dataUrl.split(",");
      var bin = atob(parts[1]);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var mime = dataUrl.slice(5, dataUrl.indexOf(";")) || "image/jpeg";
      var ext = mime.indexOf("png") !== -1 ? "png" : "jpg";
      var blob = new Blob([bytes], { type: mime });
      var path = userId + "/avatar-" + Date.now() + "." + ext;
      var up = await supabaseClient.storage
        .from("nautico-media")
        .upload(path, blob, { contentType: mime, upsert: true });
      if (up && up.error) throw up.error;
      var pub = supabaseClient.storage.from("nautico-media").getPublicUrl(path);
      var url = pub && pub.data && pub.data.publicUrl;
      if (url) {
        await supabaseClient.from("profiles").update({ avatar_url: url }).eq("id", userId);
      }
      return url;
    }

    async function resolveSession(res) {
      var session = (res && res.data && res.data.session) || null;
      if (!session) {
        try {
          var got = await supabaseClient.auth.getSession();
          session = got && got.data && got.data.session;
        } catch (_) {}
      }
      return session || null;
    }

    /* --- Step 1: Language selection (rebuild in chosen language) --- */
    wizard.querySelectorAll("[data-onboarding-lang]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var lang = btn.getAttribute("data-onboarding-lang");
        try { localStorage.setItem("nautico-language", lang); } catch (_) {}
        document.documentElement.lang = lang;
        haptic();
        // Rebuild the whole wizard in the new language, back on step 1.
        host.innerHTML = buildMarkup(lang === "tr", lang);
        wire(host, lang);
      });
    });

    // Step 1 -> 2
    var nextToTheme = wizard.querySelector('[data-onboarding-next="2"]');
    if (nextToTheme) {
      nextToTheme.addEventListener("click", function () {
        haptic();
        goToStep(2);
      });
    }

    /* --- Step 2: Theme selection --- */
    wizard.querySelectorAll("[data-onboarding-theme]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var theme = btn.getAttribute("data-onboarding-theme"); // "light" | "dark"
        document.documentElement.setAttribute("data-theme", theme);
        try { localStorage.setItem("nautico-theme", theme); } catch (_) {}
        haptic();
        wizard.querySelectorAll("[data-onboarding-theme]").forEach(function (b) {
          b.classList.toggle("onboarding-theme-btn--active", b === btn);
        });
        var preview = wizard.querySelector("[data-onboarding-theme-preview]");
        if (preview) {
          preview.classList.remove("onboarding-theme-spin");
          void preview.offsetWidth;
          preview.classList.add("onboarding-theme-spin");
        }
      });
    });

    // Step 2 -> 3
    var nextTo3 = wizard.querySelector('[data-onboarding-next="3"]');
    if (nextTo3) {
      nextTo3.addEventListener("click", function () {
        var feedback = wizard.querySelector("[data-onboarding-feedback]");
        if (feedback) {
          feedback.textContent = isTr ? "Harika seçim" : "Good choice";
          feedback.hidden = false;
          feedback.classList.add("onboarding-feedback--show");
        }
        haptic();
        setTimeout(function () { goToStep(3); }, 800);
      });
    }

    /* --- Step 3: Role selection --- */
    wizard.querySelectorAll("[data-onboarding-role]").forEach(function (card) {
      card.addEventListener("click", function () {
        selectedRole = card.getAttribute("data-onboarding-role"); // owner | provider
        haptic();
        wizard.querySelectorAll("[data-onboarding-role]").forEach(function (c) {
          c.classList.toggle("onboarding-role-card--selected", c === card);
        });
        var bird = card.querySelector("[data-onboarding-bird]");
        if (bird) {
          bird.classList.add("onboarding-bird--bounce");
          bird.addEventListener("animationend", function () {
            bird.classList.remove("onboarding-bird--bounce");
          }, { once: true });
        }
        var roleInput = wizard.querySelector("[data-onboarding-role-input]");
        if (roleInput) roleInput.value = selectedRole;
        wizard.querySelectorAll("[data-onboarding-role-fields]").forEach(function (group) {
          var isMatch = group.getAttribute("data-onboarding-role-fields") === selectedRole;
          group.hidden = !isMatch;
          group.querySelectorAll("input, select, textarea").forEach(function (f) {
            f.disabled = !isMatch;
          });
        });
        var desc = wizard.querySelector("[data-onboarding-form-desc]");
        if (desc) {
          desc.textContent =
            selectedRole === "provider"
              ? isTr ? "Hizmet bilgilerinizi girin" : "Enter your service details"
              : isTr ? "Kişisel bilgilerinizi girin" : "Enter your personal details";
        }
        setTimeout(function () { goToStep(selectedRole === "provider" ? 4 : 5); }, 500);
      });
    });

    /* --- Step 4: Provider type selection --- */
    wizard.querySelectorAll("[data-onboarding-devtype]").forEach(function (card) {
      card.addEventListener("click", function () {
        selectedDevType = card.getAttribute("data-onboarding-devtype"); // individual | business
        haptic();
        wizard.querySelectorAll("[data-onboarding-devtype]").forEach(function (c) {
          c.classList.toggle("onboarding-role-card--selected", c === card);
        });
        var devTypeInput = wizard.querySelector("[data-onboarding-devtype-input]");
        if (devTypeInput) devTypeInput.value = selectedDevType;
        var businessFields = wizard.querySelector("[data-onboarding-business-fields]");
        var individualFields = wizard.querySelector("[data-onboarding-individual-fields]");
        if (businessFields) {
          businessFields.hidden = selectedDevType !== "business";
          businessFields.querySelectorAll("input, textarea").forEach(function (f) {
            f.disabled = selectedDevType !== "business";
          });
        }
        if (individualFields) {
          individualFields.hidden = selectedDevType !== "individual";
          individualFields.querySelectorAll("input, textarea").forEach(function (f) {
            f.disabled = selectedDevType !== "individual";
          });
        }
        // Business accounts may swap the selfie for a company logo.
        var avatarModeBar = wizard.querySelector("[data-onboarding-avatar-mode]");
        if (avatarModeBar) avatarModeBar.hidden = selectedDevType !== "business";
        var selfieTitle = wizard.querySelector("[data-onboarding-selfie-title]");
        if (selfieTitle) {
          selfieTitle.textContent =
            selectedDevType === "business"
              ? isTr ? "Selfie veya İşletme Logosu (Zorunlu)" : "Selfie or Business Logo (Required)"
              : isTr ? "Selfie Doğrulama (Zorunlu)" : "Selfie Verification (Required)";
        }
        if (selectedDevType !== "business" && avatarMode === "logo") {
          var selfieChoiceBtn = wizard.querySelector('[data-onboarding-avatar-choice="selfie"]');
          if (selfieChoiceBtn) selfieChoiceBtn.click();
        }
        var desc = wizard.querySelector("[data-onboarding-form-desc]");
        if (desc) {
          desc.textContent =
            selectedDevType === "business"
              ? isTr ? "İşletme bilgilerinizi girin" : "Enter your business details"
              : isTr ? "Kişisel bilgilerinizi girin" : "Enter your personal details";
        }
        setTimeout(function () { goToStep(5); }, 500);
      });
    });

    /* --- Step 5: Form submission --- */
    var form = wizard.querySelector("[data-onboarding-form]");
    if (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        var errorEl = wizard.querySelector("[data-onboarding-error]");
        var errorText = wizard.querySelector("[data-onboarding-error-text]");
        if (errorEl) errorEl.hidden = true;

        var pw = form.querySelector('[name="password"]');
        var cpw = form.querySelector('[name="confirmPassword"]');
        if (pw && cpw && pw.value !== cpw.value) {
          if (errorEl && errorText) {
            errorText.textContent = isTr ? "Şifreler eşleşmiyor" : "Passwords do not match";
            errorEl.hidden = false;
          }
          return;
        }
        var avatarData = avatarMode === "logo" && logoDataUrl ? logoDataUrl : selfieDataUrl;
        if (selectedRole === "provider" && !avatarData) {
          if (errorEl && errorText) {
            errorText.textContent =
              selectedDevType === "business"
                ? isTr ? "Bir selfie çekin veya işletme logonuzu yükleyin." : "Please take a selfie or upload your business logo."
                : isTr ? "Doğrulama için bir selfie gerekli." : "A verification selfie is required.";
            errorEl.hidden = false;
          }
          return;
        }

        var submitBtn = form.querySelector(".onboarding-submit-btn");
        var _origLabel = (submitBtn && submitBtn.textContent) || "";
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.dataset.loading = "true";
          submitBtn.setAttribute("aria-busy", "true");
          submitBtn.textContent = "";
        }

        try {
          if (typeof supabaseClient === "undefined" || !supabaseClient) {
            throw new Error(isTr ? "Kimlik doğrulama kullanılamıyor" : "Auth unavailable");
          }
          var fd = new FormData(form);
          var email = (fd.get("email") || "").toString().trim();
          var password = (fd.get("password") || "").toString();

          // No user-facing username -- people are shown by their personal /
          // company name. A slug is still generated for backend compatibility.
          var userSlug = (email.split("@")[0] || "user").toLowerCase().replace(/[^a-z0-9]+/g, "") || "user";
          var meta = {
            full_name: (fd.get("fullName") || "").toString(),
            role: selectedRole,
            phone_number: (fd.get("phoneNumber") || "").toString(),
            username: userSlug + Math.floor(1000 + Math.random() * 9000),
          };
          if (selectedRole === "provider") {
            meta.business_name = (fd.get("businessName") || fd.get("companyName") || "").toString();
            meta.company_name = (fd.get("companyName") || "").toString();
            meta.service_area = (fd.get("serviceArea") || "").toString();
            meta.specialties = (fd.get("specialties") || "").toString();
            meta.years_experience = (fd.get("yearsExperience") || "").toString();
            meta.provider_type = selectedDevType || "";
            meta.avatar_kind = avatarMode === "logo" && logoDataUrl ? "logo" : "selfie";
          }

          var res = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: { data: meta },
          });
          if (res && res.error) throw res.error;

          var session = await resolveSession(res);

          if (!session) {
            // Email confirmation is on -- dolphin leaps off with the mail,
            // then we land on the OTP/verify step.
            pendingEmail = email;
            var emailDisplay = wizard.querySelector("[data-onboarding-verify-email]");
            if (emailDisplay) emailDisplay.textContent = pendingEmail;
            _playDolphinLeap(function () {
              goToStep(6);
              setTimeout(function () {
                var firstOtp = wizard.querySelector('[data-otp-digit="0"]');
                if (firstOtp) firstOtp.focus();
              }, 400);
            });
            return;
          }

          _playDolphinLeap();
          await afterAuth(session);
        } catch (err) {
          if (errorEl && errorText) {
            errorText.textContent = (err && err.message) || (isTr ? "Bir hata oluştu" : "An error occurred");
            errorEl.hidden = false;
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.removeAttribute("data-loading");
            submitBtn.removeAttribute("aria-busy");
            submitBtn.textContent = _origLabel || (isTr ? "Hesap Oluştur" : "Create Account");
          }
        }
      });
    }

    /* --- Step 6: OTP digit inputs --- */
    var verifyBtn = wizard.querySelector("[data-onboarding-verify-btn]");
    var otpDigits = wizard.querySelectorAll(".onboarding-otp-digit");

    function getOtpValue() {
      return Array.prototype.map.call(otpDigits, function (d) { return d.value; }).join("");
    }
    function updateVerifyBtnState() {
      var code = getOtpValue();
      if (verifyBtn) verifyBtn.disabled = code.length < otpDigits.length;
    }

    Array.prototype.forEach.call(otpDigits, function (digit, idx) {
      digit.addEventListener("input", function (e) {
        var val = e.target.value.replace(/[^0-9]/g, "");
        e.target.value = val.slice(0, 1);
        if (val && idx < otpDigits.length - 1) otpDigits[idx + 1].focus();
        updateVerifyBtnState();
        e.target.classList.toggle("onboarding-otp-digit--filled", !!val);
      });
      digit.addEventListener("keydown", function (e) {
        if (e.key === "Backspace" && !e.target.value && idx > 0) {
          otpDigits[idx - 1].focus();
          otpDigits[idx - 1].value = "";
          otpDigits[idx - 1].classList.remove("onboarding-otp-digit--filled");
          updateVerifyBtnState();
        }
        if (e.key === "Enter") {
          var code = getOtpValue();
          if (code.length === otpDigits.length && verifyBtn) verifyBtn.click();
        }
      });
      digit.addEventListener("paste", function (e) {
        e.preventDefault();
        var pasted = ((e.clipboardData && e.clipboardData.getData("text")) || "").replace(/[^0-9]/g, "").slice(0, otpDigits.length);
        pasted.split("").forEach(function (ch, i) {
          if (otpDigits[i]) {
            otpDigits[i].value = ch;
            otpDigits[i].classList.toggle("onboarding-otp-digit--filled", !!ch);
          }
        });
        var focusIdx = Math.min(pasted.length, otpDigits.length - 1);
        if (pasted.length > 0 && otpDigits[focusIdx]) otpDigits[focusIdx].focus();
        updateVerifyBtnState();
      });
    });

    if (verifyBtn) {
      verifyBtn.addEventListener("click", async function () {
        var code = getOtpValue();
        if (code.length < otpDigits.length) return;
        var otpError = wizard.querySelector("[data-onboarding-otp-error]");
        var otpErrorText = wizard.querySelector("[data-onboarding-otp-error-text]");
        if (otpError) otpError.hidden = true;

        verifyBtn.disabled = true;
        verifyBtn.dataset.loading = "true";
        verifyBtn.setAttribute("aria-busy", "true");
        var _vLabel = verifyBtn.textContent;
        verifyBtn.textContent = "";

        try {
          if (typeof supabaseClient === "undefined" || !supabaseClient) {
            throw new Error(isTr ? "Kimlik doğrulama kullanılamıyor" : "Auth unavailable");
          }
          var res = await supabaseClient.auth.verifyOtp({
            email: pendingEmail,
            token: code,
            type: "signup",
          });
          if (res && res.error) throw res.error;
          var session = await resolveSession(res);
          if (!session) throw new Error(isTr ? "Oturum bulunamadı" : "No session established");
          await afterAuth(session);
        } catch (err) {
          if (otpError && otpErrorText) {
            otpErrorText.textContent = (err && err.message) || (isTr ? "Geçersiz veya süresi dolmuş kod" : "Invalid or expired code");
            otpError.hidden = false;
          }
          verifyBtn.disabled = false;
          verifyBtn.removeAttribute("data-loading");
          verifyBtn.removeAttribute("aria-busy");
          verifyBtn.textContent = _vLabel || (isTr ? "Doğrula" : "Verify");
          Array.prototype.forEach.call(otpDigits, function (d) {
            d.value = "";
            d.classList.remove("onboarding-otp-digit--filled");
          });
          if (otpDigits[0]) otpDigits[0].focus();
        }
      });
    }

    /* --- Resend OTP --- */
    var resendBtn = wizard.querySelector("[data-onboarding-resend-btn]");
    if (resendBtn) {
      resendBtn.addEventListener("click", async function () {
        if (!pendingEmail) return;
        resendBtn.disabled = true;
        resendBtn.dataset.loading = "true";
        resendBtn.setAttribute("aria-busy", "true");
        var _label = resendBtn.textContent;
        resendBtn.textContent = "";
        try {
          if (supabaseClient && supabaseClient.auth && supabaseClient.auth.resend) {
            await supabaseClient.auth.resend({ type: "signup", email: pendingEmail });
          }
          resendBtn.removeAttribute("data-loading");
          resendBtn.removeAttribute("aria-busy");
          resendBtn.textContent = isTr ? "Gönderildi!" : "Sent!";
          setTimeout(function () {
            resendBtn.textContent = isTr ? "Tekrar Gönder" : "Resend";
            resendBtn.disabled = false;
          }, 3000);
        } catch (err) {
          resendBtn.removeAttribute("data-loading");
          resendBtn.removeAttribute("aria-busy");
          resendBtn.textContent = _label || (isTr ? "Tekrar Gönder" : "Resend");
          resendBtn.disabled = false;
          var otpError = wizard.querySelector("[data-onboarding-otp-error]");
          var otpErrorText = wizard.querySelector("[data-onboarding-otp-error-text]");
          if (otpError && otpErrorText) {
            otpErrorText.textContent = (err && err.message) || (isTr ? "Kod gönderilemedi" : "Could not resend code");
            otpError.hidden = false;
          }
        }
      });
    }

    /* --- Selfie camera logic --- */
    var selfieStartBtn = wizard.querySelector("[data-onboarding-selfie-start]");
    var selfieCaptureBtn = wizard.querySelector("[data-onboarding-selfie-capture]");
    var selfieRetakeBtn = wizard.querySelector("[data-onboarding-selfie-retake]");
    var selfieVideo = wizard.querySelector("[data-onboarding-selfie-video]");
    var selfieCanvas = wizard.querySelector("[data-onboarding-selfie-canvas]");
    var selfiePreview = wizard.querySelector("[data-onboarding-selfie-preview]");
    var selfieDataInput = wizard.querySelector("[data-onboarding-selfie-data]");
    var selfieFileInput = wizard.querySelector("[data-onboarding-selfie-file]");

    function stopSelfieStream() {
      if (selfieStream) {
        selfieStream.getTracks().forEach(function (t) { t.stop(); });
        selfieStream = null;
      }
    }

    if (selfieStartBtn) {
      selfieStartBtn.addEventListener("click", async function () {
        try {
          stopSelfieStream();
          selfieStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
          if (selfieVideo) {
            selfieVideo.srcObject = selfieStream;
            selfieVideo.style.display = "block";
          }
          selfieStartBtn.style.display = "none";
          if (selfieCaptureBtn) selfieCaptureBtn.style.display = "";
          if (selfiePreview) selfiePreview.style.display = "none";
          if (selfieRetakeBtn) selfieRetakeBtn.style.display = "none";
        } catch (err) {
          if (window.console) console.warn("[nautico] Camera error:", err);
          // Reveal the upload fallback so signup is never blocked.
          if (selfieUploadUI) selfieUploadUI.style.display = "";
          var errorEl = wizard.querySelector("[data-onboarding-error]");
          var errorText = wizard.querySelector("[data-onboarding-error-text]");
          if (errorEl && errorText) {
            errorText.textContent = isTr ? "Kamera açılamadı -- lütfen bir selfie yükleyin" : "Camera unavailable -- please upload a selfie";
            errorEl.hidden = false;
          }
        }
      });
    }

    if (selfieCaptureBtn) {
      selfieCaptureBtn.addEventListener("click", function () {
        if (!selfieVideo || !selfieCanvas) return;
        var vw = selfieVideo.videoWidth || 640;
        var vh = selfieVideo.videoHeight || 640;
        var side = Math.min(vw, vh);
        var sx = (vw - side) / 2;
        var sy = (vh - side) / 2;
        var out = 512;
        selfieCanvas.width = out;
        selfieCanvas.height = out;
        var ctx = selfieCanvas.getContext("2d");
        // Mirror the capture so it matches the mirrored preview.
        ctx.save();
        ctx.translate(out, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(selfieVideo, sx, sy, side, side, 0, 0, out, out);
        ctx.restore();
        selfieDataUrl = selfieCanvas.toDataURL("image/jpeg", 0.85);
        if (selfieDataInput) selfieDataInput.value = selfieDataUrl;
        if (selfiePreview) {
          selfiePreview.src = selfieDataUrl;
          selfiePreview.style.display = "block";
        }
        if (selfieVideo) selfieVideo.style.display = "none";
        stopSelfieStream();
        haptic();
        selfieCaptureBtn.style.display = "none";
        if (selfieRetakeBtn) selfieRetakeBtn.style.display = "";
      });
    }

    if (selfieRetakeBtn) {
      selfieRetakeBtn.addEventListener("click", function () {
        selfieDataUrl = "";
        if (selfieDataInput) selfieDataInput.value = "";
        if (selfiePreview) selfiePreview.style.display = "none";
        selfieRetakeBtn.style.display = "none";
        if (selfieStartBtn) selfieStartBtn.style.display = "";
        if (selfieStartBtn) selfieStartBtn.click();
      });
    }

    if (selfieFileInput) {
      selfieFileInput.addEventListener("change", function () {
        var file = selfieFileInput.files && selfieFileInput.files[0];
        if (!file) return;
        var errBox = wizard.querySelector("[data-onboarding-error]");
        var reader = new FileReader();
        reader.onload = function (e) {
          var url = e.target.result;
          var probe = new Image();
          probe.onload = function () {
            if (errBox) errBox.hidden = true;
            try {
              var side = Math.min(probe.naturalWidth, probe.naturalHeight);
              var sx = (probe.naturalWidth - side) / 2;
              var sy = (probe.naturalHeight - side) / 2;
              var cc = document.createElement("canvas");
              cc.width = 512;
              cc.height = 512;
              cc.getContext("2d").drawImage(probe, sx, sy, side, side, 0, 0, 512, 512);
              selfieDataUrl = cc.toDataURL("image/jpeg", 0.85);
            } catch (_) {
              selfieDataUrl = url;
            }
            if (selfieDataInput) selfieDataInput.value = selfieDataUrl;
            if (selfiePreview) {
              selfiePreview.src = selfieDataUrl;
              selfiePreview.style.display = "block";
            }
          };
          probe.src = url;
        };
        reader.readAsDataURL(file);
      });
    }

    /* --- iOS-style wheel selectors (service area / experience / specialties) --- */
    var WHEEL_ROW = 40;
    wizard.querySelectorAll("[data-onboarding-wheel]").forEach(function (wrap) {
      var key = wrap.getAttribute("data-onboarding-wheel");
      var wheel = wrap.querySelector(".nw-wheel");
      var items = Array.prototype.slice.call(wheel.querySelectorAll(".nw-wheel-item"));
      var input = wizard.querySelector('[data-onboarding-chips-input="' + key + '"]');
      var multi = wrap.hasAttribute("data-wheel-multi");
      var addBtn = wizard.querySelector('[data-wheel-add="' + key + '"]');
      var tagsBox = wizard.querySelector('[data-wheel-tags="' + key + '"]');
      var selected = [];
      var lastIdx = -1;

      function centerIndex() {
        return Math.max(0, Math.min(items.length - 1, Math.round(wheel.scrollTop / WHEEL_ROW)));
      }
      function highlight() {
        var idx = centerIndex();
        if (idx !== lastIdx) {
          if (lastIdx !== -1) detent();
          lastIdx = idx;
        }
        items.forEach(function (el, i) {
          el.classList.toggle("is-center", i === idx);
          var d = Math.abs(i - idx);
          el.style.opacity = d === 0 ? "1" : d === 1 ? "0.5" : d === 2 ? "0.26" : "0.12";
        });
        if (!multi && input && items[idx]) input.value = items[idx].getAttribute("data-wheel-value");
      }
      function syncTags() {
        if (!tagsBox) return;
        tagsBox.innerHTML = selected.map(function (v, i) {
          var label = v;
          items.forEach(function (el) { if (el.getAttribute("data-wheel-value") === v) label = el.textContent; });
          return '<button type="button" class="nw-tag" data-tag-idx="' + i + '"><span>' + label + "</span><b>&times;</b></button>";
        }).join("");
        tagsBox.querySelectorAll("[data-tag-idx]").forEach(function (t) {
          t.addEventListener("click", function () {
            selected.splice(parseInt(t.getAttribute("data-tag-idx"), 10), 1);
            if (input) input.value = selected.join(", ");
            syncTags();
            haptic();
          });
        });
      }
      wheel.addEventListener("scroll", function () { requestAnimationFrame(highlight); }, { passive: true });
      items.forEach(function (el, i) {
        el.addEventListener("click", function () {
          wheel.scrollTo({ top: i * WHEEL_ROW, behavior: "smooth" });
        });
      });
      if (addBtn) {
        addBtn.addEventListener("click", function () {
          var idx = centerIndex();
          var v = items[idx] && items[idx].getAttribute("data-wheel-value");
          if (v && selected.indexOf(v) === -1) {
            selected.push(v);
            if (input) input.value = selected.join(", ");
            syncTags();
            haptic();
            addBtn.classList.add("nw-wheel-add--pop");
            setTimeout(function () { addBtn.classList.remove("nw-wheel-add--pop"); }, 250);
          }
        });
      }
      wrap._refreshWheel = highlight;
      highlight();
    });

    /* --- Selfie vs business-logo choice (business accounts) --- */
    var logoUI = wizard.querySelector("[data-onboarding-logo-ui]");
    var logoFileInput = wizard.querySelector("[data-onboarding-logo-file]");
    var logoPreview = wizard.querySelector("[data-onboarding-logo-preview]");

    wizard.querySelectorAll("[data-onboarding-avatar-choice]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        avatarMode = btn.getAttribute("data-onboarding-avatar-choice"); // selfie | logo
        haptic();
        wizard.querySelectorAll("[data-onboarding-avatar-choice]").forEach(function (b) {
          b.classList.toggle("onboarding-chip--active", b === btn);
        });
        var isLogo = avatarMode === "logo";
        if (selfieCameraUI) selfieCameraUI.style.display = isLogo ? "none" : "";
        if (selfieUploadUI && isLogo) selfieUploadUI.style.display = "none";
        if (logoUI) logoUI.style.display = isLogo ? "" : "none";
        if (selfiePreview) selfiePreview.style.display = !isLogo && selfieDataUrl ? "block" : "none";
        if (logoPreview) logoPreview.style.display = isLogo && logoDataUrl ? "block" : "none";
        if (isLogo) stopSelfieStream();
      });
    });

    if (logoFileInput) {
      logoFileInput.addEventListener("change", function () {
        var file = logoFileInput.files && logoFileInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (e) {
          var url = e.target.result;
          var probe = new Image();
          probe.onload = function () {
            try {
              // Scale down (no crop) so logos keep their aspect ratio.
              var scale = Math.min(1, 512 / Math.max(probe.naturalWidth, probe.naturalHeight));
              var cc = document.createElement("canvas");
              cc.width = Math.max(1, Math.round(probe.naturalWidth * scale));
              cc.height = Math.max(1, Math.round(probe.naturalHeight * scale));
              cc.getContext("2d").drawImage(probe, 0, 0, cc.width, cc.height);
              logoDataUrl = cc.toDataURL("image/png");
            } catch (_) {
              logoDataUrl = url;
            }
            if (logoPreview) {
              logoPreview.src = logoDataUrl;
              logoPreview.style.display = "block";
            }
          };
          probe.src = url;
        };
        reader.readAsDataURL(file);
      });
    }
  }

  /* -------------------------------------------------------------
     Public entry point.
     ------------------------------------------------------------- */
  function start() {
    var existing = document.getElementById("nautico-wizard");
    if (existing) existing.remove();

    var locale = "en";
    try { locale = localStorage.getItem("nautico-language") || "en"; } catch (_) {}
    if (locale !== "tr") locale = "en";

    var host = document.createElement("div");
    host.id = "nautico-wizard";
    host.style.cssText =
      "position:fixed;inset:0;z-index:6100;overflow-y:auto;-webkit-overflow-scrolling:touch;background:var(--bg-primary,#08131F);";
    host.innerHTML = buildMarkup(locale === "tr", locale);
    document.body.appendChild(host);
    wire(host, locale);
  }

  window.NauticoWizard = { start: start };
})();
