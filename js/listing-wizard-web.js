(function () {
/* ═══════════════════════════════════════════════════════════════
   NAUTICO — Create Listing Wizard
   Direct port of Yapply's marketplaceSubmissionPage.js (client flow),
   reskinned marine. One question per step, animated line-art step
   icons (enter / exit / envelope fly-off), progress dots, step-check
   overlay, photo upload (≤3, 2MB) and a summary step.
   Website build — classic script exposing window.NauticoListingWizard.
   ═══════════════════════════════════════════════════════════════ */

/* Website build: no ES modules — data layer via window.supabaseClient (app.js). */
var MARINE_CATEGORIES = [
  { id: "wash_detail",      en: "Wash & Detailing",   tr: "Yıkama ve Detaylı Temizlik" },
  { id: "antifoul",         en: "Antifouling",        tr: "Zehirli Boya (Antifouling)" },
  { id: "mechanical",       en: "Mechanical",         tr: "Mekanik" },
  { id: "electrical",       en: "Electrical",         tr: "Elektrik" },
  { id: "upholstery",       en: "Upholstery",         tr: "Döşeme" },
  { id: "winterization",    en: "Winterization",      tr: "Kışa Hazırlık" },
  { id: "captain_delivery", en: "Captain & Delivery", tr: "Kaptan ve Teslimat" },
  { id: "other",            en: "Other",              tr: "Diğer" },
];
var CURRENCY = "TRY";
async function getSupabaseClient() {
  if (window.supabaseClient) return window.supabaseClient;
  if (window.sb) return window.sb;
  throw new Error("Supabase client not ready");
}
async function createListing(p) {
  const supabase = await getSupabaseClient();
  const row = {
    owner_user_id: p.ownerUserId,
    owner_email: p.ownerEmail || "",
    owner_role: "owner",
    status: "open-for-bids",
    title: p.title || "",
    description: p.description || "",
    category: p.category || "other",
    location: p.location || "",
    boat_id: p.boatId || null,
    boat_length_m: p.boatLengthM != null && p.boatLengthM !== "" ? Number(p.boatLengthM) : null,
    budget: p.budget || null,
    currency: p.currency || CURRENCY,
    timeframe: p.timeframe || "",
    payload: p.payload || {},
  };
  const res = await supabase.from("marketplace_listings").insert(row).select().single();
  if (res.error) throw res.error;
  return res.data;
}

/* ── i18n helper (same shape as the other marketplace modules) ── */
function t(locale, en, tr) { return locale === "tr" ? tr : en; }

const TURKISH_MARINAS = [
  "Bodrum", "Marmaris", "Göcek", "Fethiye", "Çeşme", "Datça", "Kaş",
  "Kalkan", "Antalya", "Ayvalık", "İstanbul", "İzmir", "Muğla", "Didim",
  "Kuşadası", "Yalıkavak", "Turgutreis", "Göltürkbükü", "Finike", "Alaçatı",
];

/* ── Marine budget ranges (Yapply budgetOptions, marine amounts) ── */
function budgetOptions(isTr) {
  /* num = numeric midpoint stored in the (numeric) budget column — it drives
     the bid token-cost tiers. The human label goes into payload.budgetLabel. */
  return [
    { label: isTr ? "1.000 - 5.000 TL" : "1,000 - 5,000 TL", value: "1000-5000", num: 3000 },
    { label: isTr ? "5.000 - 15.000 TL" : "5,000 - 15,000 TL", value: "5000-15000", num: 10000 },
    { label: isTr ? "15.000 - 50.000 TL" : "15,000 - 50,000 TL", value: "15000-50000", num: 32500 },
    { label: isTr ? "50.000 - 150.000 TL" : "50,000 - 150,000 TL", value: "50000-150000", num: 100000 },
    { label: isTr ? "150.000 TL+" : "150,000 TL+", value: "150000+", num: 150000 },
  ];
}

function timeframeOptions(isTr) {
  return [
    { label: isTr ? "Acil — bu hafta" : "Urgent — this week", value: "this-week" },
    { label: isTr ? "Bu ay" : "This month", value: "this-month" },
    { label: isTr ? "Sezon öncesi" : "Before the season", value: "before-season" },
    { label: isTr ? "Esnek" : "Flexible", value: "flexible" },
  ];
}

/* ── Wizard steps (Yapply clientWizardSteps, marine copy) ── */
function wizardSteps(isTr) {
  return [
    { id: "listingTitle", title: isTr ? "İlan Başlığı" : "Listing Title",
      subtitle: isTr ? "İlanınıza kısa ve açık bir başlık verin." : "Give your listing a short, clear title." },
    { id: "category", title: isTr ? "Hizmet Kategorisi" : "Service Category",
      subtitle: isTr ? "İşinize en uygun kategoriyi seçin." : "Choose the best category for the job." },
    { id: "details", title: isTr ? "İş Açıklaması" : "Job Description",
      subtitle: isTr ? "Yapılacak işi detaylı bir şekilde tanımlayın." : "Describe the work in detail." },
    { id: "contact", title: isTr ? "İletişim ve Konum" : "Contact & Location",
      subtitle: isTr ? "Telefon numaranızı ve marinanızı girin." : "Enter your phone number and marina." },
    { id: "budget", title: isTr ? "Bütçe Aralığı" : "Budget Range",
      subtitle: isTr ? "İşiniz için tahmini bütçenizi belirleyin." : "Set your estimated budget for the job." },
    { id: "timeframe", title: isTr ? "Zamanlama" : "Timing",
      subtitle: isTr ? "İş ne zaman yapılmalı?" : "When should the work be done?" },
    { id: "boat", title: isTr ? "Tekne Bilgisi" : "Boat Info",
      subtitle: isTr ? "Teknenizin boyunu doğrulayın." : "Confirm your boat's length." },
    { id: "photos", title: isTr ? "Fotoğraflar" : "Photos",
      subtitle: isTr ? "Sorunun veya işin fotoğraflarını yükleyin." : "Upload photos of the issue or job." },
    { id: "summary", title: isTr ? "Özet" : "Summary",
      subtitle: isTr ? "Bilgilerinizi kontrol edin ve ilanınızı yayınlayın." : "Review your info and publish your listing." },
  ];
}

/* ═══ Step icons — Yapply wizardIcons.js, marine-adapted ═══ */
const S = "currentColor";
const SW = "1.6";
const VB = "0 0 48 48";
const NONE = "none";

function iconPencil() {
  return `<svg viewBox="${VB}" fill="${NONE}" xmlns="http://www.w3.org/2000/svg">
    <path d="M28 6l8 8-18 18H10v-8L28 6z" stroke="${S}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M24 10l8 8" stroke="${S}" stroke-width="${SW}" stroke-linecap="round"/>
    <path d="M10 32h28" stroke="${S}" stroke-width="${SW}" stroke-linecap="round" opacity="0.35"/>
    <path d="M10 38h20" stroke="${S}" stroke-width="${SW}" stroke-linecap="round" opacity="0.2"/>
  </svg>`;
}

function iconBook() {
  return `<svg viewBox="${VB}" fill="${NONE}" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 10v30" stroke="${S}" stroke-width="${SW}" stroke-linecap="round"/>
    <path d="M24 10c-4-2-9-3-14-2v28c5-1 10 0 14 2" stroke="${S}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M24 10c4-2 9-3 14-2v28c-5-1-10 0-14 2" stroke="${S}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M14 18h6" stroke="${S}" stroke-width="${SW}" stroke-linecap="round" opacity="0.3"/>
    <path d="M28 18h6" stroke="${S}" stroke-width="${SW}" stroke-linecap="round" opacity="0.3"/>
  </svg>`;
}

function iconNotepad() {
  return `<svg viewBox="${VB}" fill="${NONE}" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="6" width="28" height="36" rx="3" stroke="${S}" stroke-width="${SW}"/>
    <path d="M16 14h16" stroke="${S}" stroke-width="${SW}" stroke-linecap="round"/>
    <path d="M16 20h12" stroke="${S}" stroke-width="${SW}" stroke-linecap="round" opacity="0.5"/>
    <path d="M16 26h14" stroke="${S}" stroke-width="${SW}" stroke-linecap="round" opacity="0.35"/>
    <path d="M16 32h8" stroke="${S}" stroke-width="${SW}" stroke-linecap="round" opacity="0.2"/>
  </svg>`;
}

function iconPhone() {
  return `<svg viewBox="${VB}" fill="${NONE}" xmlns="http://www.w3.org/2000/svg">
    <rect x="13" y="4" width="22" height="40" rx="4" stroke="${S}" stroke-width="${SW}"/>
    <path d="M13 10h22" stroke="${S}" stroke-width="${SW}" opacity="0.3"/>
    <path d="M13 36h22" stroke="${S}" stroke-width="${SW}" opacity="0.3"/>
    <circle cx="24" cy="40" r="1.2" fill="${S}" opacity="0.3"/>
    <path d="M19 18h10" stroke="${S}" stroke-width="1.2" stroke-linecap="round" opacity="0.25"/>
    <path d="M19 22h7" stroke="${S}" stroke-width="1.2" stroke-linecap="round" opacity="0.18"/>
  </svg>`;
}

function iconMoney() {
  return `<svg viewBox="${VB}" fill="${NONE}" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="12" width="38" height="24" rx="3" stroke="${S}" stroke-width="${SW}" stroke-linejoin="round"/>
    <rect x="9" y="16" width="30" height="16" rx="1.5" stroke="${S}" stroke-width="1" opacity="0.2"/>
    <circle cx="24" cy="24" r="7" stroke="${S}" stroke-width="${SW}"/>
    <text x="24" y="27.5" font-size="10" fill="${S}" font-weight="600" text-anchor="middle" font-family="system-ui, sans-serif">₺</text>
  </svg>`;
}

function iconClock() {
  /* Timing step — replaces Yapply's construction helmet */
  return `<svg viewBox="${VB}" fill="${NONE}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="17" stroke="${S}" stroke-width="${SW}"/>
    <path d="M24 13v11l8 5" stroke="${S}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M24 7v2" stroke="${S}" stroke-width="1.2" stroke-linecap="round" opacity="0.3"/>
    <path d="M24 39v2" stroke="${S}" stroke-width="1.2" stroke-linecap="round" opacity="0.3"/>
    <path d="M7 24h2" stroke="${S}" stroke-width="1.2" stroke-linecap="round" opacity="0.3"/>
    <path d="M39 24h2" stroke="${S}" stroke-width="1.2" stroke-linecap="round" opacity="0.3"/>
  </svg>`;
}

function iconBoat() {
  /* Boat info step — replaces Yapply's blueprint */
  return `<svg viewBox="${VB}" fill="${NONE}" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 30h32l-4 8H12l-4-8z" stroke="${S}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M24 8v22" stroke="${S}" stroke-width="${SW}" stroke-linecap="round"/>
    <path d="M24 10c8 3 11 10 11 16H24" stroke="${S}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M24 14c-5 2-8 8-8 12h8" stroke="${S}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/>
    <path d="M6 42c3 2 6 2 9 0s6-2 9 0 6 2 9 0 6-2 9 0" stroke="${S}" stroke-width="1.2" stroke-linecap="round" opacity="0.3"/>
  </svg>`;
}

function iconCamera() {
  return `<svg viewBox="${VB}" fill="${NONE}" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="14" width="36" height="26" rx="4" stroke="${S}" stroke-width="${SW}"/>
    <circle cx="24" cy="28" r="8" stroke="${S}" stroke-width="${SW}"/>
    <circle cx="24" cy="28" r="3" stroke="${S}" stroke-width="1.2" opacity="0.35"/>
    <path d="M18 14l2-4h8l2 4" stroke="${S}" stroke-width="${SW}" stroke-linejoin="round"/>
    <circle cx="36" cy="20" r="1.5" fill="${S}" opacity="0.25"/>
  </svg>`;
}

function iconEnvelope() {
  return `<svg viewBox="${VB}" fill="${NONE}" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="10" width="36" height="28" rx="3" stroke="${S}" stroke-width="${SW}"/>
    <path d="M6 14l18 12 18-12" stroke="${S}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M6 34l12-10" stroke="${S}" stroke-width="1.2" stroke-linecap="round" opacity="0.25"/>
    <path d="M42 34l-12-10" stroke="${S}" stroke-width="1.2" stroke-linecap="round" opacity="0.25"/>
  </svg>`;
}

const STEP_ICONS = {
  listingTitle: iconPencil,
  category: iconBook,
  details: iconNotepad,
  contact: iconPhone,
  budget: iconMoney,
  timeframe: iconClock,
  boat: iconBoat,
  photos: iconCamera,
  summary: iconEnvelope,
};

function getStepIcon(stepId) { return (STEP_ICONS[stepId] || iconPencil)(); }

/* ═══ CSS — Yapply app-shell wizard block, scoped .nx-lw + marine vars ═══ */
let _stylesInjected = false;
function ensureStyles() {
  if (_stylesInjected || document.getElementById("nx-listing-wizard-styles")) { _stylesInjected = true; return; }
  _stylesInjected = true;
  const s = document.createElement("style");
  s.id = "nx-listing-wizard-styles";
  s.textContent = `
.nx-lw { max-width: 480px; margin: 0 auto; padding: 1.5rem 1rem 2rem;
  display: flex; flex-direction: column; justify-content: center;
  min-height: calc(100vh - 140px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  --lw-accent: var(--sea-blue, #1B6FA8);
  --lw-line: var(--border-color, rgba(255,255,255,0.12));
  --lw-bg: var(--input-bg, var(--bg-secondary, #0D1F34));
  --lw-panel: var(--bg-card, #112A42);
  --lw-text: var(--text-primary, #E2EEF8);
  --lw-dim: var(--text-secondary, #8BBAD6);
}
.nx-lw .wizard-progress { display: flex !important; flex-direction: column; align-items: center; gap: 0.6rem;
  margin: 0 0 1.5rem; width: 100%; height: auto !important; background: none !important;
  border: none !important; border-radius: 0 !important; overflow: visible !important; }
.nx-lw .wizard-dots { display: flex; gap: 8px; align-items: center; }
.nx-lw .wizard-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--lw-line); transition: background 250ms, transform 250ms; }
.nx-lw .wizard-dot--active { background: var(--lw-accent); transform: scale(1.3); }
.nx-lw .wizard-dot--completed { background: var(--lw-accent); opacity: 0.5; }
.nx-lw .wizard-step-counter { font-size: 0.7rem; font-weight: 500; letter-spacing: 0.08em; color: var(--lw-dim); }
.nx-lw .wizard-card { background: var(--lw-panel); border: 1px solid var(--lw-line); border-radius: 16px; padding: 1.5rem; animation: lwFadeIn 300ms ease both; }
@keyframes lwFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.nx-lw .wizard-card__title { font-size: 1.4rem; font-weight: 600; color: var(--lw-text); margin: 0 0 0.3rem; line-height: 1.2; }
.nx-lw .wizard-card__subtitle { font-size: 0.85rem; color: var(--lw-dim); margin: 0 0 1.2rem; line-height: 1.4; }
.nx-lw .wizard-card__body { display: flex; flex-direction: column; gap: 1.35rem; }
.nx-lw .wizard-card__error { margin-top: 0.75rem; padding: 0.65rem 0.85rem; border-radius: 8px; background: rgba(220,60,60,0.12); border: 1px solid rgba(220,60,60,0.25); }
.nx-lw .wizard-card__error p { margin: 0; font-size: 0.8rem; color: #e55; }
.nx-lw .wizard-field { display: flex; flex-direction: column; gap: 0.4rem; }
.nx-lw .wizard-label { font-size: 0.8rem; font-weight: 600; color: var(--lw-text); letter-spacing: 0.02em; }
.nx-lw .wizard-input, .nx-lw .wizard-textarea { font-family: inherit; font-size: 0.95rem; color: var(--lw-text); background: var(--lw-bg); border: 1px solid var(--lw-line); border-radius: 10px; padding: 0.75rem 0.9rem; outline: none; transition: border-color 200ms, box-shadow 200ms; -webkit-appearance: none; }
.nx-lw .wizard-input:focus, .nx-lw .wizard-textarea:focus { border-color: var(--lw-accent); box-shadow: 0 0 0 3px rgba(27,111,168,0.15); }
.nx-lw .wizard-input::placeholder, .nx-lw .wizard-textarea::placeholder { color: var(--lw-dim); opacity: 0.6; }
.nx-lw .wizard-textarea { resize: vertical; min-height: 100px; }
.nx-lw .wizard-hint { font-size: 0.7rem; color: var(--lw-dim); opacity: 0.7; margin-top: 0.15rem; }
.nx-lw .wizard-select-wrapper { position: relative; display: flex; align-items: center; }
.nx-lw .wizard-select { font-family: inherit; font-size: 0.95rem; color: var(--lw-text); background: var(--lw-bg); border: 1px solid var(--lw-line); border-radius: 10px; padding: 0.75rem 2.5rem 0.75rem 0.9rem; width: 100%; outline: none; cursor: pointer; -webkit-appearance: none; appearance: none; transition: border-color 200ms, box-shadow 200ms; }
.nx-lw .wizard-select:focus { border-color: var(--lw-accent); box-shadow: 0 0 0 3px rgba(27,111,168,0.15); }
.nx-lw .wizard-select option { background: var(--lw-bg); color: var(--lw-text); padding: 0.5rem; }
.nx-lw .wizard-select-arrow { position: absolute; right: 0.85rem; pointer-events: none; color: var(--lw-dim); }
.nx-lw .wizard-upload-area { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; padding: 2rem 1rem; border: 2px dashed var(--lw-line); border-radius: 12px; background: var(--lw-bg); cursor: pointer; transition: border-color 200ms; position: relative; }
.nx-lw .wizard-upload-area:active { border-color: var(--lw-accent); }
.nx-lw .wizard-upload-icon { color: var(--lw-dim); opacity: 0.5; }
.nx-lw .wizard-upload-text { font-size: 0.85rem; color: var(--lw-dim); margin: 0; }
.nx-lw .wizard-upload-hint { font-size: 0.7rem; color: var(--lw-dim); opacity: 0.6; }
.nx-lw .wizard-upload-input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
.nx-lw .wizard-upload-preview { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 0.75rem; }
.nx-lw .wizard-upload-thumb { position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; margin: 0; }
.nx-lw .wizard-upload-thumb img { width: 100%; height: 100%; object-fit: cover; }
.nx-lw .wizard-upload-remove { position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; border-radius: 50%; background: rgba(0,0,0,0.65); color: #fff; border: none; font-size: 14px; line-height: 1; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.nx-lw .wizard-upload-message { font-size: 0.75rem; color: #e55; margin: 0.5rem 0 0; }
.nx-lw .wizard-summary { display: flex; flex-direction: column; gap: 0; }
.nx-lw .wizard-summary-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 0.65rem 0; border-bottom: 1px solid var(--lw-line); gap: 1rem; }
.nx-lw .wizard-summary-row:last-child { border-bottom: none; }
.nx-lw .wizard-summary-label { font-size: 0.75rem; font-weight: 600; color: var(--lw-dim); flex-shrink: 0; text-transform: uppercase; letter-spacing: 0.04em; }
.nx-lw .wizard-summary-value { font-size: 0.85rem; color: var(--lw-text); text-align: right; word-break: break-word; }
.nx-lw .wizard-actions { display: flex; gap: 0.75rem; margin-top: 1.25rem; }
.nx-lw .wizard-btn { font-family: inherit; font-size: 0.9rem; font-weight: 600; border: none; border-radius: 12px; padding: 0.85rem 1.5rem; cursor: pointer; transition: background 180ms, transform 120ms, opacity 180ms; -webkit-tap-highlight-color: transparent; }
.nx-lw .wizard-btn:active { transform: scale(0.97); }
.nx-lw .wizard-btn--pressed { animation: lwBtnPress 400ms cubic-bezier(0.34, 1.56, 0.64, 1) !important; }
@keyframes lwBtnPress { 0% { transform: scale(1); } 20% { transform: scale(0.92); } 50% { transform: scale(1.06); } 75% { transform: scale(0.98); } 100% { transform: scale(1); } }
.nx-lw .wizard-btn:disabled { opacity: 0.5; pointer-events: none; }
.nx-lw .wizard-btn--back { background: var(--lw-panel); color: var(--lw-dim); border: 1px solid var(--lw-line); flex: 0 0 auto; }
.nx-lw .wizard-btn--next { background: var(--grad-primary, linear-gradient(135deg, #1B6FA8, #2A8DC8)); color: #fff; flex: 1; }
.nx-lw .wizard-btn--publish { background: var(--grad-primary, linear-gradient(135deg, #1B6FA8, #2A8DC8)); color: #fff; animation: lwPulse 1.5s ease infinite; }
@keyframes lwPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(27,111,168,0.35); } 50% { box-shadow: 0 0 0 6px rgba(27,111,168,0); } }
.nx-lw .wizard-icon { position: relative; width: 100%; display: flex; align-items: center; justify-content: center; height: 72px; margin-bottom: 0.25rem; pointer-events: none; }
.nx-lw .wizard-icon__graphic { width: 48px; height: 48px; color: var(--lw-accent); opacity: 1; transform: scale(1) translateY(0); transition: opacity 0.22s ease, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.nx-lw .wizard-icon__graphic svg { width: 100%; height: 100%; display: block; }
.nx-lw .wizard-icon__graphic--exit { opacity: 0; transform: scale(0.85) translateY(4px); transition: opacity 0.15s ease, transform 0.15s ease; }
.nx-lw .wizard-icon__graphic--enter { opacity: 1; transform: scale(1) translateY(0); transition: opacity 0.3s ease 0.04s, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1) 0.04s; }
.nx-lw .wizard-icon__graphic--fly { opacity: 0; transform: translate(120px, -30px) scale(0.6) rotate(-6deg); transition: opacity 0.6s ease 0.08s, transform 0.7s cubic-bezier(0.4, 0, 0.2, 1); }
[data-theme="light"] .nx-lw .wizard-icon__graphic { color: var(--sea-blue, #1B6FA8); }
@media (max-height: 600px) { .nx-lw .wizard-icon { height: 56px; } .nx-lw .wizard-icon__graphic { width: 40px; height: 40px; } }
/* step-check overlay (same look as the signup wizard) */
.nx-lw .lw-step-check { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 5; pointer-events: none; }
.nx-lw .wizard-icon { pointer-events: none; }
.nx-lw .wizard-icon:has(.lw-step-check) .wizard-icon__graphic { opacity: 0; }
.nx-lw .lw-step-check__badge { width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; background: var(--grad-primary, linear-gradient(135deg, #1B6FA8, #2A8DC8)); box-shadow: 0 10px 30px rgba(27,111,168,0.45); animation: lwCheckPop 0.34s cubic-bezier(0.22, 1.4, 0.36, 1) both; }
.nx-lw .lw-step-check__badge svg { width: 26px; height: 26px; }
.nx-lw .lw-step-check--leaving .lw-step-check__badge { animation: lwCheckLeave 0.22s ease both; }
@keyframes lwCheckPop { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
@keyframes lwCheckLeave { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.7); } }
.nx-lw .lw-body-anim-in { animation: lwBodyIn 0.3s cubic-bezier(0.22, 1, 0.36, 1) both; }
@keyframes lwBodyIn { from { opacity: 0; transform: translateX(18px); } to { opacity: 1; transform: translateX(0); } }
`;
  document.head.appendChild(s);
}


/* ═══ Image optimizer — Yapply optimizeMarketplaceImageFile, verbatim port.
   iPhone photos (3–8MB) are re-encoded on a canvas: longest side ≤1024px,
   quality steps 0.68→0.30, scale steps 1→0.5, until the file is ≤400KB.
   Nothing sane ever gets rejected for size. ═══ */
const MAX_IMAGE_UPLOAD_BYTES = 400 * 1024;
const MAX_IMAGE_DIMENSION = 1024;
const IMAGE_COMPRESSION_QUALITY = 0.68;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be decoded."));
    image.src = dataUrl;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob || null), mimeType, quality);
  });
}

function replaceFileExtension(filename, extension) {
  const safeExtension = String(extension || "").replace(/^\./, "");
  if (!safeExtension) return filename;
  const sourceName = String(filename || "image");
  const dotIndex = sourceName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? sourceName.slice(0, dotIndex) : sourceName;
  return baseName + "." + safeExtension;
}

function getImageCompressionMimeType(fileType, canvas) {
  if (fileType === "image/jpeg" || fileType === "image/webp") return fileType;
  if (fileType === "image/png") {
    const webpCandidate = canvas.toDataURL("image/webp", IMAGE_COMPRESSION_QUALITY);
    if (webpCandidate.startsWith("data:image/webp")) return "image/webp";
  }
  return fileType || "image/jpeg";
}

function getExtensionForMimeType(mimeType) {
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/png") return "png";
  return "jpg";
}

async function optimizeImageFile(file, { maxBytes = MAX_IMAGE_UPLOAD_BYTES, maxDimension = MAX_IMAGE_DIMENSION } = {}) {
  if (!(file instanceof File)) return null;
  const fileType = String(file.type || "").toLowerCase();
  if (!fileType.startsWith("image/")) return file;
  if (fileType === "image/svg+xml" || fileType === "image/gif") {
    return file.size <= maxBytes ? file : null;
  }

  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageFromDataUrl(sourceDataUrl);
  const naturalWidth = Number(image.naturalWidth || image.width || 0);
  const naturalHeight = Number(image.naturalHeight || image.height || 0);
  if (!naturalWidth || !naturalHeight) return file.size <= maxBytes ? file : null;

  const longestSide = Math.max(naturalWidth, naturalHeight);
  const baseScale = longestSide > maxDimension ? maxDimension / longestSide : 1;
  const mimeType = getImageCompressionMimeType(fileType, document.createElement("canvas"));
  const qualitySteps = [IMAGE_COMPRESSION_QUALITY, 0.55, 0.42, 0.30];
  const scaleSteps = [1, 0.85, 0.7, 0.5];

  if (file.size <= maxBytes && baseScale >= 1) return file;

  let smallestCandidate = null;
  for (const scaleStep of scaleSteps) {
    const width = Math.max(1, Math.round(naturalWidth * baseScale * scaleStep));
    const height = Math.max(1, Math.round(naturalHeight * baseScale * scaleStep));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) continue;
    context.drawImage(image, 0, 0, width, height);

    for (const quality of qualitySteps) {
      const blob = mimeType === "image/png"
        ? await canvasToBlob(canvas, mimeType)
        : await canvasToBlob(canvas, mimeType, quality);
      if (!blob) continue;
      if (!smallestCandidate || blob.size < smallestCandidate.size) smallestCandidate = blob;
      if (blob.size <= maxBytes) {
        return new File([blob], replaceFileExtension(file.name, getExtensionForMimeType(blob.type || mimeType)),
          { type: blob.type || mimeType, lastModified: file.lastModified });
      }
    }
  }

  if (file.size <= maxBytes) return file;
  if (smallestCandidate && smallestCandidate.size <= maxBytes) {
    return new File([smallestCandidate],
      replaceFileExtension(file.name, getExtensionForMimeType(smallestCandidate.type || mimeType)),
      { type: smallestCandidate.type || mimeType, lastModified: file.lastModified });
  }
  return null;
}

/* ── Escaping (Yapply helpers) ── */
function escapeAttr(str) {
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function truncateText(text, maxLen) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trim() + "...";
}

function haptic() {
  try {
    if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Haptics) {
      Capacitor.Plugins.Haptics.impact({ style: "LIGHT" });
    }
  } catch (e) {}
}

/* ── Data helpers ── */
async function getUser() {
  try {
    const supabase = await getSupabaseClient();
    const res = await supabase.auth.getUser();
    const u = res && res.data && res.data.user;
    if (u && u.id) return { id: u.id, email: u.email || "" };
  } catch (e) {}
  return null;
}

async function getActiveYacht(uid) {
  try {
    const supabase = await getSupabaseClient();
    const res = await supabase
      .from("user_yachts")
      .select("id,name,brand,model,length_m,length_ft,year,home_port,berth,photos")
      .eq("owner_id", uid)
      .order("created_at", { ascending: true })
      .limit(1);
    if (!res.error && Array.isArray(res.data) && res.data.length) return res.data[0];
  } catch (e) {}
  return null;
}

function yachtLengthM(y) {
  if (!y) return null;
  if (y.length_m != null && y.length_m !== "") return Number(y.length_m);
  if (y.length_ft != null && y.length_ft !== "") return Math.round(Number(y.length_ft) * 0.3048 * 10) / 10;
  return null;
}

async function uploadListingPhoto(uid, file, index) {
  try {
    const supabase = await getSupabaseClient();
    const ext = (file.name && file.name.split(".").pop()) || "jpg";
    const path = "listing-photos/" + uid + "/" + Date.now() + "-" + index + "." + ext;
    const up = await supabase.storage.from("nautico-media")
      .upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });
    if (up && up.error) { console.warn("[nautico] listing photo upload:", up.error.message); return null; }
    const pub = supabase.storage.from("nautico-media").getPublicUrl(path);
    return (pub && pub.data && pub.data.publicUrl) || null;
  } catch (e) { console.warn("[nautico] listing photo threw:", e && e.message); return null; }
}

/* ── Step body renderers (Yapply renderStep*, marine fields) ── */
function renderStepTitle(data, isTr) {
  return `
    <div class="wizard-field">
      <label class="wizard-label" for="lw-title">${isTr ? "İlan Başlığı" : "Listing Title"}</label>
      <input class="wizard-input" type="text" id="lw-title" name="title"
        placeholder="${isTr ? "Sezon öncesi tekne yıkama, motor bakımı, cila..." : "Pre-season hull wash, engine service, polish..."}"
        value="${escapeAttr(data.title || "")}" required />
    </div>`;
}

function renderStepCategory(data, isTr) {
  const options = MARINE_CATEGORIES.map((c) => {
    const label = isTr ? c.tr : c.en;
    const selected = data.category === c.id ? "selected" : "";
    return `<option value="${escapeAttr(c.id)}" ${selected}>${escapeHtml(label)}</option>`;
  }).join("");
  return `
    <div class="wizard-field">
      <label class="wizard-label" for="lw-category">${isTr ? "Kategori" : "Category"}</label>
      <div class="wizard-select-wrapper">
        <select class="wizard-select" id="lw-category" name="category" required>
          <option value="" disabled ${!data.category ? "selected" : ""}>${isTr ? "Bir kategori seçin" : "Select a category"}</option>
          ${options}
        </select>
        <svg class="wizard-select-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>`;
}

function renderStepDetails(data, isTr) {
  return `
    <div class="wizard-field">
      <label class="wizard-label" for="lw-details">${isTr ? "İş Açıklaması" : "Job Description"}</label>
      <textarea class="wizard-textarea" id="lw-details" name="description" rows="6"
        placeholder="${isTr ? "Yapılacak işi, teknenin durumunu ve erişimi açıklayın." : "Describe the work, the boat's condition and access."}" required>${escapeHtml(data.description || "")}</textarea>
      <small class="wizard-hint">${isTr ? "İletişim bilgilerini açıklamaya yazmayınız." : "Do not include contact details in the description."}</small>
    </div>`;
}

function renderStepContact(data, isTr) {
  return `
    <div class="wizard-field">
      <label class="wizard-label" for="lw-phone">${isTr ? "Telefon Numarası" : "Phone Number"}</label>
      <input class="wizard-input" type="tel" id="lw-phone" name="phone"
        placeholder="+90 5XX XXX XX XX" autocomplete="tel" value="${escapeAttr(data.phone || "")}" required />
    </div>
    <div class="wizard-field">
      <label class="wizard-label" for="lw-location">${isTr ? "Konum / Marina" : "Location / Marina"}</label>
      <select class="wizard-input" id="lw-location" name="location" required>
        <option value="" disabled ${!data.location ? "selected" : ""}>${isTr ? "Marina seçin" : "Select a marina"}</option>
        ${TURKISH_MARINAS.map((c) => `<option value="${escapeAttr(c)}" ${data.location === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}
      </select>
    </div>`;
}

function renderStepBudget(data, isTr) {
  const options = budgetOptions(isTr).map((opt) => {
    const selected = data.budget === opt.value ? "selected" : "";
    return `<option value="${escapeAttr(opt.value)}" ${selected}>${opt.label}</option>`;
  }).join("");
  return `
    <div class="wizard-field">
      <label class="wizard-label" for="lw-budget">${isTr ? "Tahmini Bütçe" : "Estimated Budget"}</label>
      <div class="wizard-select-wrapper">
        <select class="wizard-select" id="lw-budget" name="budget" required>
          <option value="" disabled ${!data.budget ? "selected" : ""}>${isTr ? "Bütçe aralığı seçin" : "Select a budget range"}</option>
          ${options}
        </select>
        <svg class="wizard-select-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>`;
}

function renderStepTimeframe(data, isTr) {
  const options = timeframeOptions(isTr).map((opt) => {
    const selected = data.timeframe === opt.value ? "selected" : "";
    return `<option value="${escapeAttr(opt.value)}" ${selected}>${opt.label}</option>`;
  }).join("");
  return `
    <div class="wizard-field">
      <label class="wizard-label" for="lw-timeframe">${isTr ? "İş ne zaman yapılmalı?" : "When should the work happen?"}</label>
      <div class="wizard-select-wrapper">
        <select class="wizard-select" id="lw-timeframe" name="timeframe" required>
          <option value="" disabled ${!data.timeframe ? "selected" : ""}>${isTr ? "Seçin" : "Select"}</option>
          ${options}
        </select>
        <svg class="wizard-select-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>`;
}

function renderStepBoat(data, isTr, yacht) {
  const hint = yacht
    ? (isTr ? "Kaynak: " : "From: ") + (yacht.name || yacht.brand || (isTr ? "tekneniz" : "your vessel"))
    : "";
  return `
    <div class="wizard-field">
      <label class="wizard-label" for="lw-boatlen">${isTr ? "Tekne Boyu (m)" : "Boat Length (m)"}</label>
      <input class="wizard-input" type="number" step="0.1" min="0" id="lw-boatlen" name="boatLengthM"
        placeholder="12.5" value="${escapeAttr(data.boatLengthM != null ? data.boatLengthM : "")}" />
      ${hint ? `<small class="wizard-hint">${escapeHtml(hint)}</small>` : ""}
    </div>`;
}

function renderStepPhotos(data, isTr) {
  return `
    <div class="wizard-field">
      <label class="wizard-label">${isTr ? "Fotoğraf Yükleme" : "Upload Photos"}</label>
      <div class="wizard-upload-area" data-wizard-upload-area>
        <div class="wizard-upload-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        <p class="wizard-upload-text">${isTr ? "Fotoğraf yüklemek için dokunun" : "Tap to upload photos"}</p>
        <small class="wizard-upload-hint">${isTr ? "En fazla 3 görsel — fotoğraflar otomatik optimize edilir" : "Up to 3 images — photos are optimized automatically"}</small>
        <input type="file" name="referenceUpload" accept="image/*" multiple class="wizard-upload-input" data-wizard-upload-input />
      </div>
      <div class="wizard-upload-preview" data-wizard-upload-preview hidden></div>
      <p class="wizard-upload-message" data-wizard-upload-message hidden></p>
    </div>`;
}

function categoryLabel(id, isTr) {
  const m = MARINE_CATEGORIES.find((c) => c.id === id);
  return m ? (isTr ? m.tr : m.en) : (id || "");
}
function budgetLabel(value, isTr) {
  const opt = budgetOptions(isTr).find((o) => o.value === value);
  return opt ? opt.label : (value || "");
}
function budgetNumber(value) {
  const opt = budgetOptions(false).find((o) => o.value === value);
  return opt ? opt.num : null;
}
function timeframeLabel(value, isTr) {
  const opt = timeframeOptions(isTr).find((o) => o.value === value);
  return opt ? opt.label : (value || "");
}

function renderStepSummary(data, isTr) {
  const rows = [
    { label: isTr ? "Başlık" : "Title", value: data.title },
    { label: isTr ? "Kategori" : "Category", value: categoryLabel(data.category, isTr) },
    { label: isTr ? "Açıklama" : "Description", value: data.description ? truncateText(data.description, 120) : "" },
    { label: isTr ? "Telefon" : "Phone", value: data.phone },
    { label: isTr ? "Konum" : "Location", value: data.location },
    { label: isTr ? "Bütçe" : "Budget", value: budgetLabel(data.budget, isTr) },
    { label: isTr ? "Zamanlama" : "Timing", value: timeframeLabel(data.timeframe, isTr) },
    { label: isTr ? "Tekne Boyu" : "Boat Length", value: data.boatLengthM ? data.boatLengthM + " m" : "" },
    { label: isTr ? "Fotoğraflar" : "Photos", value: data._photoCount ? `${data._photoCount} ${isTr ? "fotoğraf" : "photo(s)"}` : (isTr ? "Yüklenmedi" : "None uploaded") },
  ];
  const rowsHtml = rows.filter((r) => r.value).map((r) => `
      <div class="wizard-summary-row">
        <span class="wizard-summary-label">${r.label}</span>
        <span class="wizard-summary-value">${escapeHtml(r.value)}</span>
      </div>`).join("");
  return `<div class="wizard-summary">${rowsHtml}</div>`;
}

/* ═══ Main entry — same signature as the old renderCreatePage ═══ */
async function renderCreatePage(container, opts) {
  opts = opts || {};
  const locale = opts.locale || "en";
  const isTr = locale === "tr";
  ensureStyles();

  const user = await getUser();
  if (!user) {
    container.innerHTML =
      '<div class="ves-empty"><div style="font-size:1.05rem;font-weight:600;color:var(--text-primary);margin-bottom:6px">' +
      escapeHtml(t(locale, "Sign in to post a job", "İş ilanı vermek için giriş yapın")) + "</div>" +
      "<div>" + escapeHtml(t(locale, "Create an account or log in from the Account tab.", "Hesap sekmesinden giriş yapın veya kayıt olun.")) + "</div></div>";
    return;
  }

  const yacht = await getActiveYacht(user.id);
  const STEPS = wizardSteps(isTr);

  const RENDERERS = [
    (d) => renderStepTitle(d, isTr),
    (d) => renderStepCategory(d, isTr),
    (d) => renderStepDetails(d, isTr),
    (d) => renderStepContact(d, isTr),
    (d) => renderStepBudget(d, isTr),
    (d) => renderStepTimeframe(d, isTr),
    (d) => renderStepBoat(d, isTr, yacht),
    (d) => renderStepPhotos(d, isTr),
    (d) => renderStepSummary(d, isTr),
  ];

  let currentStep = 0;
  const data = { boatLengthM: yachtLengthM(yacht), location: (yacht && yacht.home_port) || "" };
  let uploadFiles = [];
  let previewUrls = [];

  const step0 = STEPS[0];
  container.innerHTML = `
    <section class="nx-lw" data-wizard-root>
      <div class="wizard-icon" data-wizard-icon>
        <div class="wizard-icon__graphic" data-wizard-icon-graphic>${getStepIcon(step0.id)}</div>
      </div>
      ${progressDots(STEPS.length, 0)}
      <div class="wizard-card" data-wizard-card>
        <h2 class="wizard-card__title" data-wizard-title>${step0.title}</h2>
        <p class="wizard-card__subtitle" data-wizard-subtitle>${step0.subtitle}</p>
        <div class="wizard-card__body" data-wizard-body>${RENDERERS[0](data)}</div>
        <div class="wizard-card__error" data-wizard-error hidden style="display:none;"><p data-wizard-error-text></p></div>
      </div>
      <div class="wizard-actions" data-wizard-actions>
        <button class="wizard-btn wizard-btn--back" data-wizard-back type="button" hidden>${isTr ? "Geri" : "Back"}</button>
        <button class="wizard-btn wizard-btn--next" data-wizard-next type="button">${isTr ? "Devam Et" : "Continue"}</button>
      </div>
    </section>`;

  const root = container.querySelector("[data-wizard-root]");
  const titleEl = root.querySelector("[data-wizard-title]");
  const subtitleEl = root.querySelector("[data-wizard-subtitle]");
  const bodyEl = root.querySelector("[data-wizard-body]");
  const errorBox = root.querySelector("[data-wizard-error]");
  const errorText = root.querySelector("[data-wizard-error-text]");
  const nextBtn = root.querySelector("[data-wizard-next]");
  const backBtn = root.querySelector("[data-wizard-back]");

  function progressDotsUpdate() {
    const el = root.querySelector(".wizard-progress");
    if (el) el.outerHTML = progressDots(STEPS.length, currentStep);
  }

  /* ── Step-complete check animation (Yapply playStepCheck) ── */
  function playStepCheck(done) {
    try {
      /* Pop the check in the step-ICON slot at the top — never over the inputs. */
      const host = root.querySelector("[data-wizard-icon]") || root;
      const overlay = document.createElement("div");
      overlay.className = "lw-step-check";
      overlay.innerHTML = '<div class="lw-step-check__badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5 10-11"/></svg></div>';
      if (getComputedStyle(host).position === "static") host.style.position = "relative";
      host.appendChild(overlay);
      haptic();
      setTimeout(() => overlay.classList.add("lw-step-check--leaving"), 340);
      setTimeout(() => { overlay.remove(); if (typeof done === "function") done(); }, 560);
    } catch (_) {
      if (typeof done === "function") done();
    }
  }

  function animateButton(btn) {
    btn.classList.add("wizard-btn--pressed");
    btn.addEventListener("animationend", () => btn.classList.remove("wizard-btn--pressed"), { once: true });
  }

  function collectStepData() {
    const step = STEPS[currentStep];
    switch (step.id) {
      case "listingTitle": {
        const input = bodyEl.querySelector('input[name="title"]');
        if (input) data.title = input.value.trim();
        break;
      }
      case "category": {
        const sel = bodyEl.querySelector('select[name="category"]');
        if (sel) data.category = sel.value;
        break;
      }
      case "details": {
        const ta = bodyEl.querySelector('textarea[name="description"]');
        if (ta) data.description = ta.value.trim();
        break;
      }
      case "contact": {
        const phone = bodyEl.querySelector('input[name="phone"]');
        const loc = bodyEl.querySelector('select[name="location"]');
        if (phone) data.phone = phone.value.trim();
        if (loc) data.location = loc.value;
        break;
      }
      case "budget": {
        const sel = bodyEl.querySelector('select[name="budget"]');
        if (sel) data.budget = sel.value;
        break;
      }
      case "timeframe": {
        const sel = bodyEl.querySelector('select[name="timeframe"]');
        if (sel) data.timeframe = sel.value;
        break;
      }
      case "boat": {
        const input = bodyEl.querySelector('input[name="boatLengthM"]');
        if (input) data.boatLengthM = input.value ? Number(input.value) : null;
        break;
      }
    }
  }

  function validateStep() {
    const step = STEPS[currentStep];
    switch (step.id) {
      case "listingTitle":
        if (!data.title || data.title.length < 4) return isTr ? "Lütfen bir ilan başlığı girin." : "Please enter a listing title.";
        break;
      case "category":
        if (!data.category) return isTr ? "Lütfen bir kategori seçin." : "Please select a category.";
        break;
      case "details":
        if (!data.description) return isTr ? "Lütfen iş açıklaması girin." : "Please enter a job description.";
        break;
      case "contact":
        if (!data.phone) return isTr ? "Lütfen telefon numaranızı girin." : "Please enter your phone number.";
        if (!data.location) return isTr ? "Lütfen konum seçin." : "Please select a location.";
        break;
      case "budget":
        if (!data.budget) return isTr ? "Lütfen bir bütçe aralığı seçin." : "Please select a budget range.";
        break;
      case "timeframe":
        if (!data.timeframe) return isTr ? "Lütfen zamanlama seçin." : "Please select the timing.";
        break;
      case "photos": {
        if (uploadFiles.length === 0) return isTr ? "Lütfen en az bir fotoğraf yükleyin." : "Please upload at least one photo.";
        const imgs = bodyEl.querySelectorAll("[data-wizard-upload-preview] img");
        for (const img of imgs) {
          if (!img.complete || img.naturalWidth === 0) return isTr ? "Fotoğraflar yükleniyor, lütfen bekleyin." : "Photos are loading, please wait.";
        }
        break;
      }
    }
    return null;
  }

  function showError(msg) {
    if (msg) {
      errorBox.hidden = false;
      errorBox.style.display = "";
      errorText.textContent = msg;
    } else {
      errorBox.hidden = true;
      errorBox.style.display = "none";
      errorText.textContent = "";
    }
  }

  function renderStep() {
    const step = STEPS[currentStep];
    const isLast = currentStep === STEPS.length - 1;

    titleEl.textContent = step.title;
    subtitleEl.textContent = step.subtitle;
    data._photoCount = uploadFiles.length;

    const card = root.querySelector("[data-wizard-card]");
    if (card) { card.style.animation = "none"; card.offsetHeight; card.style.animation = ""; }

    bodyEl.innerHTML = RENDERERS[currentStep](data);
    progressDotsUpdate();

    /* Step icon enter / exit transition (Yapply) */
    const iconEl = root.querySelector("[data-wizard-icon-graphic]");
    if (iconEl) {
      iconEl.classList.remove("wizard-icon__graphic--enter", "wizard-icon__graphic--fly");
      iconEl.classList.add("wizard-icon__graphic--exit");
      setTimeout(() => {
        iconEl.innerHTML = getStepIcon(step.id);
        iconEl.classList.remove("wizard-icon__graphic--exit");
        iconEl.classList.add("wizard-icon__graphic--enter");
        setTimeout(() => iconEl.classList.remove("wizard-icon__graphic--enter"), 380);
      }, 160);
    }

    backBtn.hidden = currentStep === 0;
    backBtn.textContent = isTr ? "Geri" : "Back";
    const publishLabel = isTr ? "İlanımı Yayınla" : "Publish My Listing";
    nextBtn.textContent = isLast ? publishLabel : (isTr ? "Devam Et" : "Continue");
    nextBtn.classList.toggle("wizard-btn--publish", isLast);
    nextBtn.disabled = false;

    showError(null);

    if (step.id === "photos") {
      setupPhotoUploadHandlers();
      renderUploadPreviews();
    }

    try { root.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {}
  }

  function setupPhotoUploadHandlers() {
    const uploadInput = bodyEl.querySelector("[data-wizard-upload-input]");
    if (!uploadInput) return;
    uploadInput.addEventListener("change", async () => {
      const msgEl = bodyEl.querySelector("[data-wizard-upload-message]");
      const incoming = Array.from(uploadInput.files || []).filter(
        (f) => f instanceof File && f.type.startsWith("image/")
      );
      const nonImages = Array.from(uploadInput.files || []).filter(
        (f) => f instanceof File && !f.type.startsWith("image/")
      );

      if (msgEl && incoming.length) {
        msgEl.hidden = false;
        msgEl.textContent = isTr ? "Fotoğraflar optimize ediliyor…" : "Optimizing photos…";
      }

      /* Yapply pipeline: compress each photo to ≤400KB / 1024px — iPhone
         photos always fit; only undecodable files are refused. */
      let failed = 0;
      const existingKeys = new Set(uploadFiles.map((f) => `${f.name}:${f.lastModified}`));
      for (const file of incoming) {
        const key = `${file.name}:${file.lastModified}`;
        if (existingKeys.has(key) || uploadFiles.length >= 3) continue;
        let optimized = null;
        try { optimized = await optimizeImageFile(file); } catch (e) { optimized = null; }
        if (!optimized) { failed += 1; continue; }
        uploadFiles.push(optimized);
        existingKeys.add(key);
      }

      if (nonImages.length > 0 && msgEl) {
        msgEl.hidden = false;
        msgEl.textContent = isTr ? "Yalnızca görsel dosyaları yükleyebilirsiniz." : "Only image files can be uploaded.";
      } else if (failed > 0 && msgEl) {
        msgEl.hidden = false;
        msgEl.textContent = isTr ? "Bir görsel işlenemedi — lütfen farklı bir fotoğraf deneyin." : "One image could not be processed — please try a different photo.";
      } else if (uploadFiles.length >= 3 && incoming.length > 0 && msgEl) {
        msgEl.hidden = false;
        msgEl.textContent = isTr ? "En fazla 3 görsel yükleyebilirsiniz." : "You can upload a maximum of 3 images.";
      } else if (msgEl) {
        msgEl.hidden = true;
        msgEl.textContent = "";
      }

      uploadInput.value = "";
      renderUploadPreviews();
      showError(null);
    });
  }

  function clearPreviewUrls() {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    previewUrls = [];
  }

  function renderUploadPreviews() {
    const previewContainer = bodyEl.querySelector("[data-wizard-upload-preview]");
    if (!previewContainer) return;
    clearPreviewUrls();
    if (uploadFiles.length === 0) {
      previewContainer.hidden = true;
      previewContainer.innerHTML = "";
      return;
    }
    previewContainer.hidden = false;
    previewContainer.innerHTML = uploadFiles.map((file, i) => {
      const url = URL.createObjectURL(file);
      previewUrls.push(url);
      return `
        <figure class="wizard-upload-thumb">
          <img src="${url}" alt="${escapeAttr(file.name)}" />
          <button type="button" class="wizard-upload-remove" data-remove-index="${i}" aria-label="${isTr ? "Kaldır" : "Remove"}">×</button>
        </figure>`;
    }).join("");
    previewContainer.querySelectorAll("[data-remove-index]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = Number(btn.getAttribute("data-remove-index"));
        uploadFiles = uploadFiles.filter((_, i) => i !== idx);
        renderUploadPreviews();
      });
    });
  }

  async function handleSubmit() {
    nextBtn.disabled = true;
    nextBtn.textContent = isTr ? "Yayınlanıyor..." : "Publishing...";

    /* Envelope flies off to the right on submit (Yapply) */
    const flyIcon = root.querySelector("[data-wizard-icon-graphic]");
    if (flyIcon) {
      flyIcon.innerHTML = iconEnvelope();
      flyIcon.classList.remove("wizard-icon__graphic--enter", "wizard-icon__graphic--exit");
      flyIcon.classList.add("wizard-icon__graphic--fly");
    }

    try {
      /* Upload issue photos to storage first */
      const photoUrls = [];
      for (let i = 0; i < uploadFiles.length; i++) {
        const url = await uploadListingPhoto(user.id, uploadFiles[i], i);
        if (url) photoUrls.push({ url });
      }

      await createListing({
        ownerUserId: user.id,
        ownerEmail: user.email,
        title: data.title,
        description: data.description || "",
        category: data.category,
        location: data.location || "",
        boatId: yacht ? yacht.id : "",
        boatLengthM: data.boatLengthM != null ? data.boatLengthM : undefined,
        budget: budgetNumber(data.budget),
        currency: CURRENCY,
        timeframe: timeframeLabel(data.timeframe, isTr),
        payload: {
          photos: photoUrls,
          boatPhotos: (yacht && Array.isArray(yacht.photos)) ? yacht.photos : [],
          phone: data.phone || "",
          budgetLabel: budgetLabel(data.budget, isTr),
        },
      });

      haptic();
      clearPreviewUrls();
      if (typeof opts.onCreated === "function") { try { opts.onCreated(); } catch (e) {} }
    } catch (error) {
      showError((error && error.message) || (isTr ? "İlanınız kaydedilemedi. Lütfen tekrar deneyin." : "Your listing could not be saved. Please try again."));
      nextBtn.disabled = false;
      nextBtn.textContent = isTr ? "İlanımı Yayınla" : "Publish My Listing";
    }
  }

  nextBtn.addEventListener("click", async () => {
    animateButton(nextBtn);
    collectStepData();
    const err = validateStep();
    if (err) { showError(err); return; }

    const isLast = currentStep === STEPS.length - 1;
    if (isLast) {
      await handleSubmit();
    } else {
      playStepCheck(() => {
        currentStep++;
        renderStep();
        bodyEl.classList.remove("lw-body-anim-in");
        void bodyEl.offsetWidth;
        bodyEl.classList.add("lw-body-anim-in");
      });
    }
  });

  backBtn.addEventListener("click", () => {
    animateButton(backBtn);
    if (currentStep > 0) {
      collectStepData();
      currentStep--;
      renderStep();
    }
  });

  window.addEventListener("beforeunload", clearPreviewUrls, { once: true });
}

/* ── Progress dots (Yapply createProgressDots) ── */
function progressDots(totalSteps, currentStep) {
  const dots = Array.from({ length: totalSteps }, (_, i) => {
    let cls = "wizard-dot";
    if (i === currentStep) cls += " wizard-dot--active";
    if (i < currentStep) cls += " wizard-dot--completed";
    return `<span class="${cls}"></span>`;
  }).join("");
  return `
    <div class="wizard-progress">
      <div class="wizard-dots">${dots}</div>
      <span class="wizard-step-counter">${currentStep + 1} / ${totalSteps}</span>
    </div>`;
}


/* ── Modal opener for the website ── */
window.NauticoListingWizard = {
  open: function (opts) {
    opts = opts || {};
    var old = document.getElementById("nlw-ov");
    if (old) old.remove();
    var ov = document.createElement("div");
    ov.id = "nlw-ov";
    ov.style.cssText = "position:fixed;inset:0;z-index:10000;background:rgba(2,12,22,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);overflow-y:auto;padding:28px 12px;";
    var box = document.createElement("div");
    box.style.cssText = "max-width:560px;margin:0 auto;background:var(--bg-card,#112A42);border:1px solid var(--border-color,rgba(255,255,255,.12));border-radius:22px;position:relative;";
    var x = document.createElement("button");
    x.textContent = "\u00d7";
    x.setAttribute("aria-label", "Close");
    x.style.cssText = "position:absolute;top:10px;right:12px;width:34px;height:34px;border-radius:50%;border:none;background:rgba(255,255,255,.08);color:var(--text-primary,#fff);font-size:20px;cursor:pointer;z-index:3;";
    x.addEventListener("click", function () { ov.remove(); });
    ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); });
    var host = document.createElement("div");
    box.appendChild(x);
    box.appendChild(host);
    ov.appendChild(box);
    document.body.appendChild(ov);
    renderCreatePage(host, {
      locale: opts.locale || "en",
      onCreated: function () {
        ov.remove();
        if (typeof opts.onCreated === "function") opts.onCreated();
      },
    }).catch(function (e) { console.warn("[nautico] wizard:", e && e.message); });
  },
};
})();
