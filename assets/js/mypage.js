// VICTORIA PROJECT — My Page logic

let CURRENT_USER = null;

function statusBadge(status){
  const map = {
    pending:   { cls: 'badge-pending',   key: 'mypage.status_pending' },
    tx_submitted: { cls: 'badge-submitted', key: 'mypage.status_submitted' },
    completed: { cls: 'badge-completed', key: 'mypage.status_completed' }
  };
  const s = map[status] || map.pending;
  return `<span class="badge ${s.cls}">${i18n.t(s.key)}</span>`;
}

function switchTab(tab){
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.style.display = (p.id === 'panel-' + tab) ? '' : 'none');
}

async function loadProfile(){
  const { data, error } = await sb.from('profiles').select('*').eq('id', CURRENT_USER.id).single();
  if (error){
    console.error('mypage: failed to load profile', error);
    const msg = document.getElementById('profileMsg');
    if (msg){ msg.textContent = error.message; msg.className = 'form-msg error'; }
    return;
  }
  if (!data) return;
  document.getElementById('pEmail').value = data.email || '';
  document.getElementById('pName').value = data.full_name || '';
  document.getElementById('pPhone').value = data.phone || '';
  document.getElementById('pWallet').value = data.tron_wallet || '';
  document.getElementById('pTelegram').value = data.telegram_id || '';
  document.getElementById('pWhatsapp').value = data.whatsapp_id || '';

  if (data.is_admin) document.getElementById('adminLink').style.display = '';
}

async function loadRequests(){
  const { data, error } = await sb.from('exchange_requests')
    .select('*').eq('user_id', CURRENT_USER.id)
    .in('status', ['pending','tx_submitted'])
    .order('created_at', { ascending: false });

  const el = document.getElementById('requestsList');
  if (error) console.error('mypage: failed to load requests', error);
  if (error || !data || data.length === 0){
    el.innerHTML = `<div class="empty-state">${i18n.t('mypage.no_requests')}</div>`;
    return;
  }

  el.innerHTML = `<div class="table-scroll"><table class="data">
    <thead><tr>
      <th>${i18n.t('admin.date_col')}</th><th>${i18n.t('admin.detail_col')}</th>
      <th>${i18n.t('admin.status_col')}</th><th></th>
    </tr></thead>
    <tbody>${data.map(r => `
      <tr>
        <td>${fmtDate(r.created_at)}</td>
        <td>${fmtNum(r.from_amount)} ${r.from_coin} → ${fmtNum(r.to_amount)} ${r.to_coin}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${r.status === 'pending'
              ? `<button class="btn btn-outline btn-sm" data-submit-tx="${r.id}">${i18n.t('mypage.submit_tx_button')}</button>`
              : `<span class="muted" style="font-size:12.5px;">${r.tx_hash ? r.tx_hash.slice(0,10)+'…' : ''}</span>`}</td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;

  el.querySelectorAll('[data-submit-tx]').forEach(btn=>{
    btn.addEventListener('click', ()=> openTxModal(btn.getAttribute('data-submit-tx')));
  });
}

async function loadCompleted(){
  const { data, error } = await sb.from('exchange_requests')
    .select('*').eq('user_id', CURRENT_USER.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });

  const el = document.getElementById('completedList');
  if (error) console.error('mypage: failed to load completed', error);
  if (error || !data || data.length === 0){
    el.innerHTML = `<div class="empty-state">${i18n.t('mypage.no_completed')}</div>`;
    return;
  }

  el.innerHTML = `<table class="data">
    <thead><tr>
      <th>${i18n.t('admin.date_col')}</th><th>${i18n.t('admin.detail_col')}</th><th>${i18n.t('admin.status_col')}</th>
    </tr></thead>
    <tbody>${data.map(r => `
      <tr>
        <td>${fmtDate(r.completed_at || r.created_at)}</td>
        <td>${fmtNum(r.from_amount)} ${r.from_coin} → ${fmtNum(r.to_amount)} ${r.to_coin}</td>
        <td>${statusBadge(r.status)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <p class="muted" style="font-size:12.5px; margin-top:14px;">${i18n.t('mypage.locked_note')}</p>`;
}

function openTxModal(requestId){
  document.getElementById('txRequestId').value = requestId;
  document.getElementById('txHash').value = '';
  document.getElementById('txNote').value = '';
  document.getElementById('txMsg').textContent = '';
  document.getElementById('txModal').classList.add('open');
}

// If the person just confirmed their email from the signup flow, the extra
// profile fields they typed in (phone, wallet, telegram...) were stashed in
// localStorage since they don't survive the round-trip through their inbox.
// Apply them once, then forget them.
async function applyPendingSignupProfile(userId){
  const raw = localStorage.getItem('victoria_pending_profile');
  if (!raw) return;
  localStorage.removeItem('victoria_pending_profile');
  try {
    const pendingProfile = JSON.parse(raw);
    await sb.from('profiles').update(pendingProfile).eq('id', userId);
  } catch (e) {
    console.warn('mypage: could not apply pending signup profile', e);
  }
}

document.addEventListener('DOMContentLoaded', async ()=>{
  const session = await requireAuth();
  if (!session) return;
  CURRENT_USER = session.user;
  await applyPendingSignupProfile(CURRENT_USER.id);

  await loadProfile();
  await loadRequests();
  await loadCompleted();

  document.querySelectorAll('.tab-btn').forEach(b=>{
    b.addEventListener('click', ()=> switchTab(b.dataset.tab));
  });

  const urlTab = new URLSearchParams(window.location.search).get('tab');
  if (urlTab) switchTab(urlTab);

  document.getElementById('profileForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const msg = document.getElementById('profileMsg');
    const { error } = await sb.from('profiles').update({
      full_name: document.getElementById('pName').value.trim() || null,
      phone: document.getElementById('pPhone').value.trim() || null,
      tron_wallet: document.getElementById('pWallet').value.trim() || null,
      telegram_id: document.getElementById('pTelegram').value.trim() || null,
      whatsapp_id: document.getElementById('pWhatsapp').value.trim() || null,
      updated_at: new Date().toISOString()
    }).eq('id', CURRENT_USER.id);

    msg.textContent = error ? error.message : i18n.t('mypage.saved_msg');
    msg.className = 'form-msg ' + (error ? 'error' : 'ok');
  });

  document.getElementById('txCancel').addEventListener('click', ()=>{
    document.getElementById('txModal').classList.remove('open');
  });

  document.getElementById('txForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const msg = document.getElementById('txMsg');
    const id = document.getElementById('txRequestId').value;
    const { error } = await sb.from('exchange_requests').update({
      tx_hash: document.getElementById('txHash').value.trim(),
      tx_note: document.getElementById('txNote').value.trim() || null,
      status: 'tx_submitted',
      tx_submitted_at: new Date().toISOString()
    }).eq('id', id).eq('user_id', CURRENT_USER.id);

    if (error){
      msg.textContent = error.message;
      msg.className = 'form-msg error';
      return;
    }
    document.getElementById('txModal').classList.remove('open');
    await loadRequests();
  });
});
