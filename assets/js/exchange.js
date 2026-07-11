// VICTORIA PROJECT — exchange calculators (VICT lot exchange + BLC exchange)

let ADMIN_RATE = 1; // USDT (or VICT, they're 1:1) per 1 BLC-equivalent unit; loaded from Supabase

async function loadAdminRate(){
  try {
    const { data, error } = await sb.from('exchange_rates').select('rate').eq('pair', 'USDT_BLC').single();
    if (!error && data) ADMIN_RATE = Number(data.rate);
  } catch (e) {
    console.warn('exchange: could not load admin rate, using default', e);
  }
}

function unitValueInUsdt(coin){
  if (coin === 'USDT' || coin === 'VICT') return 1;
  if (coin === 'BLC') return ADMIN_RATE;
  return 1;
}

/* =========================================================
   WIDGET 1 — USDT <-> VICT, sold only in 100-VICT lots
   ========================================================= */
let victFromCoin = 'USDT';
let victToCoin = 'VICT';

function renderVictCoinSelects(){
  const fromEl = document.getElementById('victFromCoin');
  const toEl = document.getElementById('victToCoin');
  if (!fromEl || !toEl) return;
  fromEl.innerHTML = `<option value="USDT">USDT (Tron)</option><option value="VICT">VICT</option>`;
  toEl.innerHTML = `<option value="USDT">USDT (Tron)</option><option value="VICT">VICT</option>`;
  fromEl.value = victFromCoin;
  toEl.value = victToCoin;
}

function victRecalc(){
  const units = Math.max(1, parseInt(document.getElementById('victUnits').value, 10) || 1);
  const amount = units * 100;
  document.getElementById('victFromAmount').value = fmtNum(amount);
  document.getElementById('victToAmount').value = fmtNum(amount);
}

function initVictWidget(){
  const fromEl = document.getElementById('victFromCoin');
  const toEl = document.getElementById('victToCoin');
  const unitsEl = document.getElementById('victUnits');
  const swapBtn = document.getElementById('victSwapBtn');
  const exchangeBtn = document.getElementById('victExchangeBtn');
  if (!exchangeBtn) return; // not on this page

  renderVictCoinSelects();
  victRecalc();

  fromEl.addEventListener('change', ()=>{
    victFromCoin = fromEl.value;
    victToCoin = victFromCoin === 'USDT' ? 'VICT' : 'USDT';
    renderVictCoinSelects();
  });
  toEl.addEventListener('change', ()=>{
    victToCoin = toEl.value;
    victFromCoin = victToCoin === 'USDT' ? 'VICT' : 'USDT';
    renderVictCoinSelects();
  });
  swapBtn.addEventListener('click', ()=>{
    [victFromCoin, victToCoin] = [victToCoin, victFromCoin];
    renderVictCoinSelects();
  });
  unitsEl.addEventListener('input', victRecalc);
  document.getElementById('victUnitMinus').addEventListener('click', ()=>{
    unitsEl.value = Math.max(1, (parseInt(unitsEl.value, 10) || 1) - 1);
    victRecalc();
  });
  document.getElementById('victUnitPlus').addEventListener('click', ()=>{
    unitsEl.value = (parseInt(unitsEl.value, 10) || 1) + 1;
    victRecalc();
  });

  const modal = document.getElementById('victConfirmModal');
  const details = document.getElementById('victConfirmDetails');
  const msgEl = document.getElementById('victExchangeMsg');

  exchangeBtn.addEventListener('click', async ()=>{
    msgEl.textContent = '';
    const units = Math.max(1, parseInt(unitsEl.value, 10) || 1);
    const amount = units * 100;

    const { data: { session } } = await sb.auth.getSession();
    if (!session){
      sessionStorage.setItem('victoria_pending_vict_exchange', JSON.stringify({
        from_coin: victFromCoin, to_coin: victToCoin, units
      }));
      window.location.href = 'login.html?redirect=index.html%23exchange-vict';
      return;
    }

    details.innerHTML = `
      <div>${i18n.t('exchange.unit_label')}: <strong>${units}</strong></div>
      <div style="margin-top:8px;">${i18n.t('exchange.send_label')}: <strong>${fmtNum(amount)} ${victFromCoin}</strong></div>
      <div style="margin-top:8px;">${i18n.t('exchange.receive_label')}: <strong>${fmtNum(amount)} ${victToCoin}</strong></div>
    `;
    modal.classList.add('open');
  });

  document.getElementById('victConfirmCancel').addEventListener('click', ()=> modal.classList.remove('open'));

  document.getElementById('victConfirmSubmit').addEventListener('click', async ()=>{
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    const units = Math.max(1, parseInt(unitsEl.value, 10) || 1);
    const amount = units * 100;
    const { error } = await sb.from('exchange_requests').insert({
      user_id: session.user.id,
      from_coin: victFromCoin,
      to_coin: victToCoin,
      from_amount: amount,
      to_amount: amount,
      rate_used: 1,
      units,
      status: 'pending'
    });
    modal.classList.remove('open');
    if (error){
      msgEl.textContent = error.message;
      msgEl.className = 'form-msg error';
    } else {
      window.location.href = 'mypage.html?tab=requests';
    }
  });

  const pending = sessionStorage.getItem('victoria_pending_vict_exchange');
  if (pending){
    sessionStorage.removeItem('victoria_pending_vict_exchange');
    const p = JSON.parse(pending);
    victFromCoin = p.from_coin; victToCoin = p.to_coin;
    unitsEl.value = p.units;
    renderVictCoinSelects();
    victRecalc();
  }
}

/* =========================================================
   WIDGET 2 — BLC exchange (USDT or VICT <-> BLC; one side is
   always BLC, so this stays separate from the lot-based widget)
   ========================================================= */
const BLC_COIN_LABEL = { USDT: 'USDT (Tron)', BLC: 'BLC', VICT: 'VICT' };
let blcFromCoin = null;
let blcToCoin = null;

// whichever side isn't BLC must be USDT or VICT, and exactly one side is BLC
function blcOptionsFor(otherSideVal){
  if (otherSideVal === 'BLC') return ['USDT', 'VICT'];
  if (otherSideVal === 'USDT' || otherSideVal === 'VICT') return ['BLC'];
  return ['USDT', 'BLC', 'VICT'];
}

function renderBlcCoinSelects(){
  const fromEl = document.getElementById('fromCoin');
  const toEl = document.getElementById('toCoin');
  if (!fromEl || !toEl) return;

  const placeholder = (selected) => `<option value="" disabled ${selected ? '' : 'selected'}>${i18n.t('exchange.select_placeholder')}</option>`;
  const fromOptions = blcOptionsFor(blcToCoin);
  const toOptions = blcOptionsFor(blcFromCoin);

  fromEl.innerHTML = placeholder(blcFromCoin) + fromOptions.map(c => `<option value="${c}">${BLC_COIN_LABEL[c]}</option>`).join('');
  toEl.innerHTML = placeholder(blcToCoin) + toOptions.map(c => `<option value="${c}">${BLC_COIN_LABEL[c]}</option>`).join('');
  fromEl.value = blcFromCoin || '';
  toEl.value = blcToCoin || '';
}

function blcComputeToAmount(fromAmount){
  if (!blcFromCoin || !blcToCoin || !fromAmount || isNaN(fromAmount)) return '';
  const usdtValue = Number(fromAmount) * unitValueInUsdt(blcFromCoin);
  return Number((usdtValue / unitValueInUsdt(blcToCoin)).toFixed(6));
}

function blcRecalc(){
  const fromAmount = document.getElementById('fromAmount').value;
  document.getElementById('toAmount').value = blcComputeToAmount(fromAmount);
}

function initBlcWidget(){
  const fromEl = document.getElementById('fromCoin');
  const toEl = document.getElementById('toCoin');
  const fromAmountEl = document.getElementById('fromAmount');
  const swapBtn = document.getElementById('swapBtn');
  const exchangeBtn = document.getElementById('exchangeBtn');
  if (!exchangeBtn) return; // not on this page

  renderBlcCoinSelects();
  blcRecalc();
  loadAdminRate().then(blcRecalc);

  fromEl.addEventListener('change', ()=>{
    blcFromCoin = fromEl.value || null;
    // if the new from-coin makes the current to-coin invalid, clear it
    if (blcToCoin && !blcOptionsFor(blcFromCoin).includes(blcToCoin)) blcToCoin = null;
    if (!blcToCoin){
      const opts = blcOptionsFor(blcFromCoin);
      if (opts.length === 1) blcToCoin = opts[0];
    }
    renderBlcCoinSelects();
    blcRecalc();
  });

  toEl.addEventListener('change', ()=>{
    blcToCoin = toEl.value || null;
    if (blcFromCoin && !blcOptionsFor(blcToCoin).includes(blcFromCoin)) blcFromCoin = null;
    if (!blcFromCoin){
      const opts = blcOptionsFor(blcToCoin);
      if (opts.length === 1) blcFromCoin = opts[0];
    }
    renderBlcCoinSelects();
    blcRecalc();
  });

  fromAmountEl.addEventListener('input', blcRecalc);

  swapBtn.addEventListener('click', ()=>{
    [blcFromCoin, blcToCoin] = [blcToCoin, blcFromCoin];
    renderBlcCoinSelects();
    blcRecalc();
  });

  const modal = document.getElementById('confirmModal');
  const confirmDetails = document.getElementById('confirmDetails');
  const msgEl = document.getElementById('exchangeMsg');

  exchangeBtn.addEventListener('click', async ()=>{
    msgEl.textContent = '';
    const fromAmount = parseFloat(fromAmountEl.value);

    if (!blcFromCoin || !blcToCoin){
      msgEl.textContent = i18n.t('exchange.select_placeholder');
      msgEl.className = 'form-msg error';
      return;
    }
    if (!fromAmount || fromAmount <= 0){
      msgEl.textContent = i18n.t('exchange.rate_note_admin');
      msgEl.className = 'form-msg error';
      return;
    }

    const { data: { session } } = await sb.auth.getSession();
    if (!session){
      sessionStorage.setItem('victoria_pending_exchange', JSON.stringify({
        from_coin: blcFromCoin, to_coin: blcToCoin,
        from_amount: fromAmount, to_amount: parseFloat(document.getElementById('toAmount').value)
      }));
      window.location.href = 'login.html?redirect=index.html%23exchange-blc&pending=1';
      return;
    }

    confirmDetails.innerHTML = `
      <div>${i18n.t('exchange.send_label')}: <strong>${fmtNum(fromAmount)} ${blcFromCoin}</strong></div>
      <div style="margin-top:8px;">${i18n.t('exchange.receive_label')}: <strong>${document.getElementById('toAmount').value} ${blcToCoin}</strong></div>
    `;
    modal.classList.add('open');
  });

  document.getElementById('confirmCancel').addEventListener('click', ()=> modal.classList.remove('open'));

  document.getElementById('confirmSubmit').addEventListener('click', async ()=>{
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    const payload = {
      user_id: session.user.id,
      from_coin: blcFromCoin,
      to_coin: blcToCoin,
      from_amount: parseFloat(fromAmountEl.value),
      to_amount: parseFloat(document.getElementById('toAmount').value),
      rate_used: unitValueInUsdt(blcFromCoin) / unitValueInUsdt(blcToCoin),
      status: 'pending'
    };
    const { error } = await sb.from('exchange_requests').insert(payload);
    modal.classList.remove('open');
    if (error){
      msgEl.textContent = error.message;
      msgEl.className = 'form-msg error';
    } else {
      window.location.href = 'mypage.html?tab=requests';
    }
  });

  const pending = sessionStorage.getItem('victoria_pending_exchange');
  if (pending){
    sessionStorage.removeItem('victoria_pending_exchange');
    const p = JSON.parse(pending);
    blcFromCoin = p.from_coin; blcToCoin = p.to_coin;
    fromAmountEl.value = p.from_amount;
    renderBlcCoinSelects();
    blcRecalc();
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  initVictWidget();
  initBlcWidget();
});
