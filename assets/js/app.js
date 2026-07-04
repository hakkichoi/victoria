// VICTORIA PROJECT — shared app logic (nav state, seal icon, small helpers)

const SEAL_SVG = `
<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="24" cy="24" r="21" stroke="currentColor" stroke-width="2"/>
  <circle cx="24" cy="24" r="15.5" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 3"/>
  <path d="M16 24.5L21 29.5L32 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

function paintSeals(){
  document.querySelectorAll('.seal:empty').forEach(el => el.innerHTML = SEAL_SVG);
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

document.addEventListener('DOMContentLoaded', ()=>{
  paintSeals();
  refreshNavAuthState();
  bindLogoutButtons();
  const langSwitch = document.getElementById('langSwitch');
  if (langSwitch){
    langSwitch.addEventListener('change', (e)=> i18n.setLang(e.target.value));
  }
});
