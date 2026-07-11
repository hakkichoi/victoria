// VICTORIA PROJECT — Buy VICT with KRW

const FEE_RATE = 0.03;
let USD_KRW_RATE = null;

async function loadFxRate(){
  const rateDisplay = document.getElementById('rateDisplay');
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const json = await res.json();
    if (json && json.rates && json.rates.KRW){
      USD_KRW_RATE = Number(json.rates.KRW);
      rateDisplay.textContent = `₩${fmtNum(Math.round(USD_KRW_RATE))}`;
    } else {
      throw new Error('rate not found in response');
    }
  } catch (e) {
    console.warn('buy-vict: could not load live FX rate', e);
    rateDisplay.textContent = '—';
  }
  recalc();
}

async function loadBankInfo(){
  const box = document.getElementById('bankInfoBox');
  const { data } = await sb.from('site_settings').select('krw_bank_name, krw_bank_account, krw_account_holder').eq('key', 'main').single();
  if (!data || !data.krw_bank_name){
    return; // keep the "not set up yet" placeholder text
  }
  box.innerHTML = `
    <div><span class="muted">${i18n.t('buyvict.bank_name_label')}:</span> <strong>${data.krw_bank_name}</strong></div>
    <div><span class="muted">${i18n.t('buyvict.bank_account_label')}:</span> <strong>${data.krw_bank_account || ''}</strong></div>
    <div><span class="muted">${i18n.t('buyvict.bank_holder_label')}:</span> <strong>${data.krw_account_holder || ''}</strong></div>
  `;
}

function currentUnits(){
  return Math.max(1, parseInt(document.getElementById('units').value, 10) || 1);
}

function recalc(){
  const units = currentUnits();
  const vict = units * 100;
  const base = vict; // 1 VICT ~= 1 USD (USDT-pegged)
  const fee = base * FEE_RATE;
  const totalUsd = base + fee;
  const krwRaw = USD_KRW_RATE ? totalUsd * USD_KRW_RATE : null;
  const krwFinal = krwRaw !== null ? Math.floor(krwRaw / 10) * 10 : null;

  document.getElementById('outVict').textContent = fmtNum(vict);
  document.getElementById('outBase').textContent = `$${fmtNum(base.toFixed(2))}`;
  document.getElementById('outFee').textContent = `$${fmtNum(fee.toFixed(2))}`;
  document.getElementById('outTotalUsd').textContent = `$${fmtNum(totalUsd.toFixed(2))}`;
  document.getElementById('outTotalKrw').textContent = krwFinal !== null ? `₩${fmtNum(krwFinal)}` : '—';
}

document.addEventListener('DOMContentLoaded', ()=>{
  const unitsEl = document.getElementById('units');
  if (!unitsEl) return; // not on this page

  loadFxRate();
  loadBankInfo();

  unitsEl.addEventListener('input', recalc);
  document.getElementById('unitMinus').addEventListener('click', ()=>{
    unitsEl.value = Math.max(1, currentUnits() - 1);
    recalc();
  });
  document.getElementById('unitPlus').addEventListener('click', ()=>{
    unitsEl.value = currentUnits() + 1;
    recalc();
  });

  const modal = document.getElementById('buyConfirmModal');
  const details = document.getElementById('buyConfirmDetails');
  const msgEl = document.getElementById('buyMsg');

  document.getElementById('buyBtn').addEventListener('click', async ()=>{
    msgEl.textContent = '';
    if (!USD_KRW_RATE){
      msgEl.textContent = i18n.t('buyvict.rate_loading');
      msgEl.className = 'form-msg error';
      return;
    }

    const { data: { session } } = await sb.auth.getSession();
    if (!session){
      sessionStorage.setItem('victoria_pending_krw_units', String(currentUnits()));
      window.location.href = 'login.html?redirect=buy-vict.html';
      return;
    }

    const units = currentUnits();
    const krwText = document.getElementById('outTotalKrw').textContent;
    details.innerHTML = `
      <div>${i18n.t('exchange.unit_label')}: <strong>${units}</strong></div>
      <div style="margin-top:8px;">${i18n.t('buyvict.breakdown_vict')}: <strong>${fmtNum(units * 100)} VICT</strong></div>
      <div style="margin-top:8px;">${i18n.t('buyvict.breakdown_total_krw')}: <strong>${krwText}</strong></div>
    `;
    modal.classList.add('open');
  });

  document.getElementById('buyConfirmCancel').addEventListener('click', ()=> modal.classList.remove('open'));

  document.getElementById('buyConfirmSubmit').addEventListener('click', async ()=>{
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;

    const units = currentUnits();
    const vict = units * 100;
    const base = vict;
    const fee = base * FEE_RATE;
    const totalUsd = base + fee;
    const krwFinal = Math.floor((totalUsd * USD_KRW_RATE) / 10) * 10;

    const { error } = await sb.from('krw_purchase_requests').insert({
      user_id: session.user.id,
      units,
      vict_amount: vict,
      usd_krw_rate: USD_KRW_RATE,
      fee_rate: FEE_RATE,
      krw_amount: krwFinal,
      status: 'pending'
    });

    modal.classList.remove('open');
    if (error){
      msgEl.textContent = error.message;
      msgEl.className = 'form-msg error';
    } else {
      window.location.href = 'mypage.html?tab=krw';
    }
  });

  const pendingUnits = sessionStorage.getItem('victoria_pending_krw_units');
  if (pendingUnits){
    sessionStorage.removeItem('victoria_pending_krw_units');
    unitsEl.value = pendingUnits;
  }
});
