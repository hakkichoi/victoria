// VICTORIA PROJECT — shared app logic (nav state, seal icon, small helpers)

function paintSeals(){
  document.querySelectorAll('.seal:empty').forEach(el => {
    el.innerHTML = '<img src="assets/img/vict-logo.png" alt="VICT">';
  });
}

function fmtDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString(i18n.lang === 'ko' ? 'ko-KR' : i18n.lang, { year:'numeric', month:'short', day:'numeric' });
}
function fmtNum(n){
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 6 });
}

// ---------- header auth state ----------
async function refreshNavAuthState(){
  const { data: { session } } = await sb.auth.getSession();
  const loggedOutEls = document.querySelectorAll('.nav-auth-out');
  const loggedInEls  = document.querySelectorAll('.nav-auth-in');
  const adminEls     = document.querySelectorAll('.nav-auth-admin');

  if (!session){
    loggedOutEls.forEach(el => el.style.display = '');
    loggedInEls.forEach(el => el.style.display = 'none');
    adminEls.forEach(el => el.style.display = 'none');
    return null;
  }

  loggedOutEls.forEach(el => el.style.display = 'none');
  loggedInEls.forEach(el => el.style.display = '');

  const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', session.user.id).single();
  if (profile && profile.is_admin){
    adminEls.forEach(el => el.style.display = '');
  } else {
    adminEls.forEach(el => el.style.display = 'none');
  }
  return session;
}

async function logout(){
  await sb.auth.signOut();
  window.location.href = 'index.html';
}

function bindLogoutButtons(){
  document.querySelectorAll('[data-action="logout"]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{ e.preventDefault(); logout(); });
  });
}

// require login on protected pages; sends users back after login via redirect param
async function requireAuth(){
  const { data: { session } } = await sb.auth.getSession();
  if (!session){
    const back = encodeURIComponent(window.location.pathname.split('/').pop());
    window.location.href = `login.html?redirect=${back}`;
    return null;
  }
  return session;
}

// ---------- partner bank marquee ----------
// NOTE: these are generic placeholder marks (a colored monogram chip + name),
// not the banks' actual trademarked logos — see README for why, and swap in
// official logo files (with permission) once real partnerships are in place.
const PARTNER_BANKS = [
  { short: 'HSBC',      color: '#FF4D8B', text: '#FFFFFF' },
  { short: 'Shinhan',   color: '#1A3A3A', text: '#FFFFFF' },
  { short: 'IBK',       color: '#B8A4ED', text: '#0A0A0A' },
  { short: 'BOC',       color: '#FFB084', text: '#0A0A0A' },
  { short: 'BofA',      color: '#E8B94A', text: '#0A0A0A' },
  { short: 'ICBC',      color: '#A4D4C5', text: '#0A0A0A' },
  { short: 'Barclays',  color: '#FF6B5A', text: '#FFFFFF' }
];

function bankLogoSVG(bank){
  const initials = bank.short.slice(0, bank.short.length > 6 ? 3 : 2).toUpperCase();
  return `
  <svg class="partner-logo" viewBox="0 0 176 56" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${bank.short}">
    <rect x="0.5" y="0.5" width="175" height="55" rx="14" fill="#FFFFFF" stroke="#E5E5E5"/>
    <rect x="14" y="14" width="28" height="28" rx="8" fill="${bank.color}"/>
    <text x="28" y="32.5" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="11" fill="${bank.text}">${initials}</text>
    <text x="56" y="33" font-family="Inter, sans-serif" font-weight="600" font-size="15" fill="#0A0A0A">${bank.short}</text>
  </svg>`;
}

function renderPartnerMarquee(){
  const track = document.getElementById('partnerTrack');
  if (!track) return;
  const logos = PARTNER_BANKS.map(bankLogoSVG).join('');
  track.innerHTML = logos + logos; // duplicated once for a seamless loop
}

document.addEventListener('DOMContentLoaded', renderPartnerMarquee);

// ---------- admin Tron wallet address (shown wherever users need to send coins) ----------
async function paintAdminWalletAddress(){
  const targets = document.querySelectorAll('.admin-wallet-addr');
  if (targets.length === 0) return;
  const { data } = await sb.from('site_settings').select('admin_tron_wallet').eq('key', 'main').single();
  const addr = (data && data.admin_tron_wallet) || '—';
  targets.forEach(el => el.textContent = addr);
}

function bindCopyWalletButtons(){
  document.querySelectorAll('.copy-wallet-btn').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const row = btn.closest('.wallet-address-row');
      const addr = row ? row.querySelector('code').textContent : '';
      try {
        await navigator.clipboard.writeText(addr);
        const original = btn.textContent;
        btn.textContent = i18n.t('exchange.copied');
        setTimeout(()=> btn.textContent = original, 1500);
      } catch (e) { /* clipboard API unavailable — silently ignore */ }
    });
  });
}

document.addEventListener('DOMContentLoaded', ()=>{
  paintSeals();
  refreshNavAuthState();
  bindLogoutButtons();
  paintAdminWalletAddress();
  bindCopyWalletButtons();
  document.querySelectorAll('[data-lang-select]').forEach(sw=>{
    sw.addEventListener('change', (e)=> i18n.setLang(e.target.value));
  });
});

