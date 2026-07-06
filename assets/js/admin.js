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

  el.innerHTML = `<div class="table-scroll"><table class="data">
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
  </table></div>`;

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

async function loadFundingAdminList(){
  const { data, error } = await sb
    .from('funding_transactions')
    .select('id, tx_date, tx_address, amount')
    .order('tx_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(30);

  const el = document.getElementById('fundingAdminList');
  if (error || !data || data.length === 0){
    el.innerHTML = `<div class="empty-state">${i18n.t('funding.empty')}</div>`;
    return;
  }

  el.innerHTML = `<div class="table-scroll"><table class="data">
    <thead><tr>
      <th>${i18n.t('admin.tx_date_label')}</th>
      <th>${i18n.t('admin.tx_address_label')}</th>
      <th>${i18n.t('admin.tx_amount_label')}</th>
      <th></th>
    </tr></thead>
    <tbody>${data.map(r => `
      <tr>
        <td>${r.tx_date}</td>
        <td style="font-family:monospace; font-size:12.5px;">${r.tx_address}</td>
        <td>${fmtNum(r.amount)} USDT</td>
        <td><button class="btn btn-danger btn-sm" data-delete-tx="${r.id}">${i18n.t('admin.delete_button')}</button></td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;

  el.querySelectorAll('[data-delete-tx]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const id = btn.getAttribute('data-delete-tx');
      const { error } = await sb.from('funding_transactions').delete().eq('id', id);
      if (error) { alert(error.message); return; }
      await loadFundingAdminList();
    });
  });
}

async function loadFundingSummaryDefaults(){
  const { data } = await sb.from('funding_summary').select('*').eq('key', 'main').single();
  if (!data) return;
  document.getElementById('sumWallets').value = data.total_wallets;
  document.getElementById('sumCumulative').value = data.cumulative_amount;
  document.getElementById('sumRewardCount').value = data.reward_count;
  document.getElementById('sumRewardAmount').value = data.reward_amount;
}

function fmtPeriodInput(iso){
  // 'YYYY-MM-01' -> 'YYYY-MM' for the <input type="month"> field
  return iso ? iso.slice(0, 7) : '';
}

async function loadPlanningAdminList(){
  const { data, error } = await sb
    .from('planning_items')
    .select('id, period_date, title, detail')
    .order('period_date', { ascending: true });

  const el = document.getElementById('planningAdminList');
  if (error || !data || data.length === 0){
    el.innerHTML = `<div class="empty-state">${i18n.t('funding.empty')}</div>`;
    return;
  }

  el.innerHTML = `<table class="data">
    <thead><tr>
      <th>${i18n.t('admin.planning_period_label')}</th>
      <th>${i18n.t('admin.planning_title_label')}</th>
      <th>${i18n.t('admin.planning_detail_label')}</th>
      <th></th>
    </tr></thead>
    <tbody>${data.map(r => `
      <tr>
        <td>${fmtPeriodInput(r.period_date)}</td>
        <td>${r.title}</td>
        <td class="muted" style="font-size:12.5px;">${r.detail || '—'}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-outline btn-sm" data-edit-planning="${r.id}">${i18n.t('admin.planning_edit_button')}</button>
          <button class="btn btn-danger btn-sm" data-delete-planning="${r.id}">${i18n.t('admin.delete_button')}</button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;

  const rowsById = Object.fromEntries(data.map(r => [String(r.id), r]));

  el.querySelectorAll('[data-edit-planning]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const r = rowsById[btn.getAttribute('data-edit-planning')];
      document.getElementById('planningEditId').value = r.id;
      document.getElementById('planningPeriod').value = fmtPeriodInput(r.period_date);
      document.getElementById('planningTitle').value = r.title;
      document.getElementById('planningDetail').value = r.detail || '';
      document.getElementById('planningSubmitBtn').textContent = i18n.t('admin.planning_save_button');
      document.getElementById('planningCancelBtn').style.display = '';
      window.scrollTo({ top: document.getElementById('planningForm').offsetTop - 100, behavior: 'smooth' });
    });
  });

  el.querySelectorAll('[data-delete-planning]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const id = btn.getAttribute('data-delete-planning');
      const { error } = await sb.from('planning_items').delete().eq('id', id);
      if (error) { alert(error.message); return; }
      await loadPlanningAdminList();
    });
  });
}

function resetPlanningForm(){
  document.getElementById('planningForm').reset();
  document.getElementById('planningEditId').value = '';
  document.getElementById('planningSubmitBtn').textContent = i18n.t('admin.planning_add_button');
  document.getElementById('planningCancelBtn').style.display = 'none';
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
  await loadFundingSummaryDefaults();
  await loadFundingAdminList();
  await loadPlanningAdminList();
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

  document.getElementById('fundingTxForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const msg = document.getElementById('fundingTxMsg');
    const { error } = await sb.from('funding_transactions').insert({
      tx_date: document.getElementById('fundingTxDate').value,
      tx_address: document.getElementById('fundingTxAddress').value.trim(),
      amount: parseFloat(document.getElementById('fundingTxAmount').value),
      created_by: session.user.id
    });
    msg.textContent = error ? error.message : i18n.t('mypage.saved_msg');
    msg.className = 'form-msg ' + (error ? 'error' : 'ok');
    if (!error){
      document.getElementById('fundingTxForm').reset();
      await loadFundingAdminList();
    }
  });

  document.getElementById('fundingSummaryForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const msg = document.getElementById('fundingSummaryMsg');
    const { error } = await sb.from('funding_summary').upsert({
      key: 'main',
      total_wallets: parseInt(document.getElementById('sumWallets').value, 10) || 0,
      cumulative_amount: parseFloat(document.getElementById('sumCumulative').value) || 0,
      reward_count: parseInt(document.getElementById('sumRewardCount').value, 10) || 0,
      reward_amount: parseFloat(document.getElementById('sumRewardAmount').value) || 0,
      updated_at: new Date().toISOString(),
      updated_by: session.user.id
    });
    msg.textContent = error ? error.message : i18n.t('mypage.saved_msg');
    msg.className = 'form-msg ' + (error ? 'error' : 'ok');
  });

  document.getElementById('planningForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const msg = document.getElementById('planningMsg');
    const editId = document.getElementById('planningEditId').value;
    const payload = {
      period_date: document.getElementById('planningPeriod').value + '-01',
      title: document.getElementById('planningTitle').value.trim(),
      detail: document.getElementById('planningDetail').value.trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: session.user.id
    };

    let error;
    if (editId){
      ({ error } = await sb.from('planning_items').update(payload).eq('id', editId));
    } else {
      ({ error } = await sb.from('planning_items').insert(payload));
    }

    msg.textContent = error ? error.message : i18n.t('mypage.saved_msg');
    msg.className = 'form-msg ' + (error ? 'error' : 'ok');
    if (!error){
      resetPlanningForm();
      await loadPlanningAdminList();
    }
  });

  document.getElementById('planningCancelBtn').addEventListener('click', resetPlanningForm);
});
