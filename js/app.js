/* ═══════════════════════════════════════════
   NAUTICO WEBSITE — App Logic
   Client-side routing, Supabase auth, dashboard
═══════════════════════════════════════════ */

// ── Supabase Init ──
const SUPABASE_URL = 'https://shgcdzdnmwkjqpwdlsug.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoZ2NkemRubXdranFwd2Rsc3VnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NzA5MDIsImV4cCI6MjA5MDA0NjkwMn0.sWSvSuj1sS7Yi1ucFjX6gkOSOQkSwr6yX45lN3dFdw8';

var sb = null;
let currentUser = null;

function initSupabase() {
  try {
    if (!sb && window.supabase && window.supabase.createClient) {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return true;
    }
  } catch (e) {
    console.log('Supabase init error:', e);
  }
  return !!sb;
}
// Try now (may not be loaded yet since script is async)
initSupabase();
// Retry when Supabase CDN finishes loading
document.querySelector('script[src*="supabase"]')?.addEventListener('load', () => {
  initSupabase();
  checkSession();
});
// Polling fallback — if the load event was missed, retry a few times
(function retrySupa(attempts) {
  if (sb || attempts <= 0) return;
  setTimeout(() => { initSupabase(); if (sb) checkSession(); else retrySupa(attempts - 1); }, 500);
})(10);

// ── Router ──
const routes = {
  home: 'page-home',
  pricing: 'page-pricing',
  contact: 'page-contact',
  privacy: 'page-privacy',
  login: 'page-login',
  dashboard: 'page-dashboard'
};

function navigate(route) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');

  // Show target page
  const pageId = routes[route];
  if (pageId) {
    const page = document.getElementById(pageId);
    if (page) {
      page.style.display = '';
      page.style.animation = 'none';
      page.offsetHeight; // trigger reflow
      page.style.animation = 'fadeIn 0.4s ease';
    }
  }

  // Update active nav link
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.route === route);
  });

  // Show/hide footer on dashboard/login
  const footer = document.getElementById('site-footer');
  if (footer) {
    footer.style.display = (route === 'dashboard') ? 'none' : '';
  }

  // Close mobile menu
  document.getElementById('nav-links')?.classList.remove('open');

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Update URL hash
  history.pushState(null, '', '#' + route);


  // If navigating to dashboard, check auth
  if (route === 'dashboard') {
    loadDashboard();
  }

  // If navigating to login and already logged in, redirect to dashboard
  if (route === 'login' && currentUser) {
    navigate('dashboard');
  }
}

// ── Button Navigation with Spinner ──
function navigateWithSpinner(button, route, delay = 300) {
  // Create spinner
  const spinner = document.createElement('span');
  spinner.className = 'btn-spinner';
  button.appendChild(spinner);

  // Wait for delay then navigate
  setTimeout(() => {
    navigate(route);
  }, delay);
}

// ── Event Listeners ──
document.addEventListener('DOMContentLoaded', () => {
  // Route links — use event delegation on document for maximum reliability
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-route]');
    if (!el) return;
    e.preventDefault();
    const route = el.dataset.route;

    // For buttons, show spinner before navigating
    if (el.tagName === 'A' && (el.classList.contains('btn') || el.closest('.btn'))) {
      const button = el.classList.contains('btn') ? el : el.closest('.btn');
      navigateWithSpinner(button, route);
    } else {
      navigate(route);
    }
  });

  // Smooth scroll buttons — any element with .scroll-to and data-target
  document.querySelectorAll('.scroll-to').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const targetId = btn.dataset.target;
      const target = document.getElementById(targetId);
      if (target) {
        const navHeight = document.getElementById('navbar')?.offsetHeight || 60;
        const y = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 10;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    });
  });

  // Hamburger menu
  document.getElementById('nav-hamburger')?.addEventListener('click', () => {
    document.getElementById('nav-links')?.classList.toggle('open');
  });

  // Login form
  document.getElementById('login-form')?.addEventListener('submit', handleLogin);

  // Logout button
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

  // Contact form
  document.getElementById('contact-form')?.addEventListener('submit', handleContact);

  // Handle initial route from URL hash
  const hash = window.location.hash.replace('#', '') || 'home';
  navigate(hash);

  // Check for existing session
  checkSession();

  // Navbar scroll effect
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    if (nav) {
      nav.style.background = window.scrollY > 50
        ? 'rgba(13,32,39,0.95)'
        : 'rgba(13,32,39,0.85)';
    }
  });

  // ── Scroll Animation (non-blocking — content always visible) ──
  // Elements have .anim-in class. They are fully visible by default.
  // On scroll, we add a subtle slide-up animation via CSS class.
  const animObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animation = 'slideUp 0.6s ease forwards';
        animObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.anim-in').forEach(el => animObserver.observe(el));
});

// Handle browser back/forward
window.addEventListener('popstate', () => {
  const hash = window.location.hash.replace('#', '') || 'home';
  navigate(hash);
});

// Fallback: handle hashchange (catches cases where click listeners don't fire)
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '') || 'home';
  if (routes[hash]) {
    navigate(hash);
  }
});

// ── Auth ──
async function checkSession() {
  if (!sb) return;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) {
      currentUser = session.user;
      updateNavForAuth(true);
    }
  } catch (e) {
    console.log('Session check error:', e);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  // Retry Supabase init in case CDN loaded after initial attempt
  if (!sb) initSupabase();
  if (!sb) {
    errorEl.textContent = 'Login service is temporarily unavailable. Please try again later.';
    errorEl.style.display = 'block';
    return;
  }

  btn.textContent = 'Logging in...';
  btn.disabled = true;
  errorEl.style.display = 'none';

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUser = data.user;
    updateNavForAuth(true);
    navigate('dashboard');
  } catch (err) {
    errorEl.textContent = err.message || 'Login failed. Please check your credentials.';
    errorEl.style.display = 'block';
  } finally {
    btn.textContent = 'Log In';
    btn.disabled = false;
  }
}

async function handleLogout() {
  if (sb) {
    await sb.auth.signOut();
  }
  currentUser = null;
  updateNavForAuth(false);
  navigate('home');
}

function updateNavForAuth(loggedIn) {
  const loginLink = document.querySelector('.nav-login-btn');
  if (loginLink) {
    if (loggedIn) {
      loginLink.textContent = 'Dashboard';
      loginLink.dataset.route = 'dashboard';
      loginLink.href = '#dashboard';
    } else {
      loginLink.textContent = 'Log In';
      loginLink.dataset.route = 'login';
      loginLink.href = '#login';
    }
  }
}

// ── Dashboard ──
async function loadDashboard() {
  if (!currentUser) {
    // Not logged in — redirect to login
    navigate('login');
    return;
  }

  // Set greeting
  const greeting = document.getElementById('dash-greeting');
  if (greeting) {
    const hour = new Date().getHours();
    const timeGreet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    greeting.textContent = timeGreet;
  }

  // Set email
  document.getElementById('dash-email').textContent = currentUser.email || '—';

  // Set joined date
  const joined = currentUser.created_at;
  if (joined) {
    document.getElementById('dash-joined').textContent = new Date(joined).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // Load profile from profiles table
  if (sb) {
    try {
      const { data: profile } = await sb
        .from('profiles')
        .select('full_name, role, preferred_language')
        .eq('id', currentUser.id)
        .single();

      if (profile) {
        document.getElementById('dash-name').textContent = profile.full_name || '—';
        document.getElementById('dash-country').textContent = profile.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : '—';
      }
    } catch (e) { console.log('Profile fetch:', e); }

    // Subscription info — no subscriptions table exists yet, show defaults
    document.getElementById('dash-plan').textContent = 'Free Trial';
    document.getElementById('dash-status').textContent = 'Active';
    document.getElementById('dash-status').style.color = 'var(--green)';
    document.getElementById('dash-trial').textContent = '—';
    document.getElementById('dash-billing').textContent = '—';

    // Load fleet stats from user_yachts (owner_id) and trips (user_id)
    try {
      const { count: vesselCount } = await sb
        .from('user_yachts')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', currentUser.id);

      const { data: trips } = await sb
        .from('trips')
        .select('distance_nm')
        .eq('user_id', currentUser.id);

      document.getElementById('dash-vessels').textContent = vesselCount || 0;
      document.getElementById('dash-voyages').textContent = trips?.length || 0;

      const totalDist = trips?.reduce((sum, t) => sum + (t.distance_nm || 0), 0) || 0;
      document.getElementById('dash-distance').textContent = totalDist > 0 ? totalDist.toLocaleString() + ' nm' : '—';
    } catch (e) { console.log('Fleet stats:', e); }
  }
}

// ── Contact Form ──
function handleContact(e) {
  e.preventDefault();
  // In production, this would send to a backend or email service
  // For now, show success message
  document.getElementById('contact-form').style.display = 'none';
  document.getElementById('contact-success').style.display = 'block';
}
