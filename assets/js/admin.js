// VICTORIA PROJECT — Admin page logic

let CURRENT_FILTER = 'all';

function statusBadgeAdmin(status){
  const map = {
    pending:      { cls:'badge-pending',   key:'mypage.status_pending' },
    tx_submitted: { cls:'badge-submitted', key:'mypage.status_submitted' },
    completed:    { cls:'badge-completed', key:'mypage.status_completed' }
  };
  const s = map[status] || map.pending;
  return `<span class="badge ${s.cls}">${i18n.t(s.key)}</span>`;
}

async function loadRequests(){
  let query = sb.from('exchange_requests')
    .select('*, profiles(email, full_name)')
    .order('created_at', { ascending: false });

  if (CURRENT_FILTER !== 'all') query = query.eq('status', CURRENT_FILTER);

  const { data, error } = await query;
  const el = document.getElementById('requestsTable');

  if (error || !data || data.length === 0){
    el.innerHTML = `<div class="empty-state">${i18n.t('admin.no_requests')}</div>`;
    return;
  }

  el.innerHTML = `<table class="data">
    <thead><tr>
      <th>${i18n.t('admin.date_col')}</th>
      <th>${i18n.t('admin.user_col')}</th>
      <th>${i18n.t('admin.detail_col')}</th>
      <th>${i18n.t('admin.tx_col')}</th>
      <th>${i18n.t('admin.status_col')}</th>
      <th>${i18n.t('admin.action_col')}</th>
    </tr></thead>
    <tbody>${data.map(r => `
      <tr>
        <td>${fmtDate(r.created_at)}</td>
        <td>${(r.profiles && (r.profiles.full_name || r.profiles.email)) || r.user_id.slice(0,8)}</td>
        <td>${fmtNum(r.from_amount)} ${r.from_coin} → ${fmtNum(r.to_amount)} ${r.to_coin}</td>
        <td style="max-width:180px; overflow-wrap:anywhere; font-size:12.5px;">${r.tx_hash || '—'}${r.tx_note ? `<div class="muted">${r.tx_note}</div>` : ''}</td>
        <td>${statusBadgeAdmin(r.status)}</td>
        <td>${r.status !== 'completed'
              ? `<button class="btn btn-teal btn-sm" data-complete="${r.id}">${i18n.t('admin.complete_button')}</button>`
              : `<span class="muted" style="font-size:12px;">${fmtDate(r.completed_at)}</span>`}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;

  el.querySelectorAll('[data-complete]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      if (!confirm(i18n.t('admin.complete_confirm'))) return;
      const id = btn.getAttribute('data-complete');
      const { error } = await sb.from('exchange_requests').update({
        status: 'completed',
        completed_at: new Date().toISOString()
      }).eq('id', id);
      if (error) { alert(error.message); return; }
      await loadRequests();
    });
  });
}

async function loadRateAndPriceDefaults(){
  const { data: rate } = await sb.from('exchange_rates').select('rate').eq('pair','USDT_BLC').single();
  if (rate) document.getElementById('rateInput').value = rate.rate;
  document.getElementById('priceDate').value = new Date().toISOString().slice(0,10);
}

document.addEventListener('DOMContentLoaded', async ()=>{
  const session = await requireAuth();
  if (!session) return;

  const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', session.user.id).single();
  if (!profile || !profile.is_admin){
    document.getElementById('adminGate').style.display = '';
    document.getElementById('adminGate').textContent = 'Access denied.';
    return;
  }

  document.getElementById('adminContent').style.display = '';
  await loadRateAndPriceDefaults();
  await loadRequests();

  document.querySelectorAll('.filter-chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      CURRENT_FILTER = chip.dataset.filter;
      loadRequests();
    });
  });

  document.getElementById('rateForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const msg = document.getElementById('rateMsg');
    const rate = parseFloat(document.getElementById('rateInput').value);
    const { error } = await sb.from('exchange_rates').upsert({
      pair: 'USDT_BLC', rate, updated_at: new Date().toISOString(), updated_by: session.user.id
    });
    msg.textContent = error ? error.message : i18n.t('mypage.saved_msg');
    msg.className = 'form-msg ' + (error ? 'error' : 'ok');
  });

  document.getElementById('priceForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const msg = document.getElementById('priceMsg');
    const price_date = document.getElementById('priceDate').value;
    const price = parseFloat(document.getElementById('priceInput').value);
    const { error } = await sb.from('blc_price_history').upsert({ price_date, price }, { onConflict: 'price_date' });
    msg.textContent = error ? error.message : i18n.t('mypage.saved_msg');
    msg.className = 'form-msg ' + (error ? 'error' : 'ok');
  });
});
