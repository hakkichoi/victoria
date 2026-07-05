// VICTORIA PROJECT — VICT Funding section (public read-only transparency feed)

const FUNDING_PAGE_SIZE = 10;
let fundingCurrentPage = 1;
let fundingTotalCount = 0;

function fmtFundingDate(iso){
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

async function loadFundingPage(page){
  fundingCurrentPage = page;
  const from = (page - 1) * FUNDING_PAGE_SIZE;
  const to = from + FUNDING_PAGE_SIZE - 1;

  const { data, count, error } = await sb
    .from('funding_transactions')
    .select('tx_date, tx_address, amount', { count: 'exact' })
    .order('tx_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  const listEl = document.getElementById('fundingList');
  if (error || !data || data.length === 0){
    listEl.innerHTML = `<div class="empty-state">${i18n.t('funding.empty')}</div>`;
    document.getElementById('fundingPagination').innerHTML = '';
    return;
  }

  fundingTotalCount = count || data.length;

  listEl.innerHTML = data.map(r => `
    <div class="funding-row">
      <span class="fdate">${fmtFundingDate(r.tx_date)}</span>
      <span class="faddr">${r.tx_address}</span>
      <span class="famount">${fmtNum(r.amount)} USDT</span>
    </div>
  `).join('');

  renderFundingPagination();
}

function renderFundingPagination(){
  const totalPages = Math.max(1, Math.ceil(fundingTotalCount / FUNDING_PAGE_SIZE));
  const el = document.getElementById('fundingPagination');
  if (totalPages <= 1){ el.innerHTML = ''; return; }

  let html = '';
  for (let p = 1; p <= totalPages; p++){
    html += `<button class="${p === fundingCurrentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
  }
  el.innerHTML = html;

  el.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click', ()=> loadFundingPage(Number(btn.getAttribute('data-page'))));
  });
}

async function loadFundingSummary(){
  const { data, error } = await sb.from('funding_summary').select('*').eq('key', 'main').single();
  const row = document.getElementById('fundingSummaryRow');
  if (!row) return;
  if (error || !data){
    row.innerHTML = `<td>—</td><td>—</td><td>—</td>`;
    return;
  }
  row.innerHTML = `
    <td>${fmtNum(data.total_wallets)} Wallet</td>
    <td>${fmtNum(data.cumulative_amount)} USDT</td>
    <td>${fmtNum(data.reward_count)}${i18n.lang==='ko'?'회':'x'} | ${fmtNum(data.reward_amount)} USDT</td>
  `;
}

document.addEventListener('DOMContentLoaded', ()=>{
  if (!document.getElementById('fundingList')) return; // not on this page
  loadFundingPage(1);
  loadFundingSummary();
});
