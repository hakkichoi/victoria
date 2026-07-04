// VICTORIA PROJECT — exchange calculator + request submission

let ADMIN_RATE = 1; // USDT (or VICT, they're 1:1) per 1 BLC-equivalent unit; loaded from Supabase

async function loadAdminRate(){
  const { data, error } = await sb.from('exchange_rates').select('rate').eq('pair', 'USDT_BLC').single();
  if (!error && data) ADMIN_RATE = Number(data.rate);
}

// value of 1 unit of `coin` expressed in USDT terms
function unitValueInUsdt(coin){
  if (coin === 'USDT' || coin === 'VICT') return 1;
  if (coin === 'BLC') return ADMIN_RATE;
  return 1;
}

function computeToAmount(fromCoin, toCoin, fromAmount){
  if (!fromAmount || isNaN(fromAmount)) return '';
  if (fromCoin === toCoin) return fromAmount;
  const usdtValue = Number(fromAmount) * unitValueInUsdt(fromCoin);
  const result = usdtValue / unitValueInUsdt(toCoin);
  return Number(result.toFixed(6));
}

function currentRateUsed(fromCoin, toCoin){
  return unitValueInUsdt(fromCoin) / unitValueInUsdt(toCoin);
}

function updateRateNote(){
  const from = document.getElementById('fromCoin').value;
  const to = document.getElementById('toCoin').value;
  const note = document.getElementById('rateNote');
  const involvesBlc = from === 'BLC' || to === 'BLC';
  note.setAttribute('data-i18n', involvesBlc ? 'exchange.rate_note_admin' : 'exchange.rate_note_fixed');
  note.innerHTML = i18n.t(involvesBlc ? 'exchange.rate_note_admin' : 'exchange.rate_note_fixed');
}

function recalc(){
  const fromCoin = document.getElementById('fromCoin').value;
  const toCoin = document.getElementById('toCoin').value;
  const fromAmount = document.getElementById('fromAmount').value;
  document.getElementById('toAmount').value = computeToAmount(fromCoin, toCoin, fromAmount);
  updateRateNote();
}

document.addEventListener('DOMContentLoaded', async ()=>{
  const fromCoinEl = document.getElementById('fromCoin');
  const toCoinEl = document.getElementById('toCoin');
  const fromAmountEl = document.getElementById('fromAmount');
  const swapBtn = document.getElementById('swapBtn');
  const exchangeBtn = document.getElementById('exchangeBtn');
  if (!exchangeBtn) return; // not on this page

  await loadAdminRate();
  recalc();

  fromCoinEl.addEventListener('change', recalc);
  toCoinEl.addEventListener('change', recalc);
  fromAmountEl.addEventListener('input', recalc);

  swapBtn.addEventListener('click', ()=>{
    const f = fromCoinEl.value, t = toCoinEl.value;
    fromCoinEl.value = t; toCoinEl.value = f;
    recalc();
  });

  const modal = document.getElementById('confirmModal');
  const confirmDetails = document.getElementById('confirmDetails');
  const msgEl = document.getElementById('exchangeMsg');

  exchangeBtn.addEventListener('click', async ()=>{
    msgEl.textContent = '';
    const fromAmount = parseFloat(fromAmountEl.value);
    if (!fromAmount || fromAmount <= 0){
      msgEl.textContent = i18n.t('exchange.rate_note_fixed');
      msgEl.className = 'form-msg error';
      return;
    }

    const { data: { session } } = await sb.auth.getSession();
    if (!session){
      sessionStorage.setItem('victoria_pending_exchange', JSON.stringify({
        from_coin: fromCoinEl.value, to_coin: toCoinEl.value,
        from_amount: fromAmount, to_amount: parseFloat(document.getElementById('toAmount').value),
        rate_used: currentRateUsed(fromCoinEl.value, toCoinEl.value)
      }));
      window.location.href = 'login.html?redirect=index.html%23exchange&pending=1';
      return;
    }

    confirmDetails.innerHTML = `
      <div>${i18n.t('exchange.send_label')}: <strong>${fmtNum(fromAmount)} ${fromCoinEl.value}</strong></div>
      <div style="margin-top:8px;">${i18n.t('exchange.receive_label')}: <strong>${document.getElementById('toAmount').value} ${toCoinEl.value}</strong></div>
    `;
    modal.classList.add('open');
  });

  document.getElementById('confirmCancel').addEventListener('click', ()=> modal.classList.remove('open'));

  document.getElementById('confirmSubmit').addEventListener('click', async ()=>{
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    const payload = {
      user_id: session.user.id,
      from_coin: fromCoinEl.value,
      to_coin: toCoinEl.value,
      from_amount: parseFloat(fromAmountEl.value),
      to_amount: parseFloat(document.getElementById('toAmount').value),
      rate_used: currentRateUsed(fromCoinEl.value, toCoinEl.value),
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

  // resume an exchange that was interrupted by a login redirect
  const pending = sessionStorage.getItem('victoria_pending_exchange');
  if (pending){
    sessionStorage.removeItem('victoria_pending_exchange');
    const p = JSON.parse(pending);
    fromCoinEl.value = p.from_coin; toCoinEl.value = p.to_coin;
    fromAmountEl.value = p.from_amount;
    recalc();
  }
});
