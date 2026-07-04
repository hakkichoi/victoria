// VICTORIA PROJECT — BLC price chart, drawn as a plain SVG polyline (no chart library)

async function drawBlcChart(){
  const svg = document.getElementById('blcChart');
  if (!svg) return;

  const { data, error } = await sb
    .from('blc_price_history')
    .select('price_date, price')
    .order('price_date', { ascending: true })
    .limit(60);

  const W = 640, H = 240, PAD = 28;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  if (error || !data || data.length === 0){
    svg.innerHTML = `<text x="${W/2}" y="${H/2}" text-anchor="middle" fill="#8C97B8" font-size="13" font-family="Inter,sans-serif">
      ${i18n.t('common.loading') === 'Loading...' ? 'No price data yet' : ''}
    </text>`;
    return;
  }

  const prices = data.map(r => Number(r.price));
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = (max - min) || 1;

  const points = data.map((r, i) => {
    const x = PAD + (i / (data.length - 1 || 1)) * (W - PAD * 2);
    const y = H - PAD - ((Number(r.price) - min) / range) * (H - PAD * 2);
    return [x, y];
  });

  const linePath = points.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const areaPath = linePath + ` L${points[points.length-1][0].toFixed(1)},${H-PAD} L${points[0][0].toFixed(1)},${H-PAD} Z`;

  const dateLabel = (iso) => new Date(iso).toLocaleDateString(undefined, { month:'short', day:'numeric' });
  const firstLabel = dateLabel(data[0].price_date);
  const lastLabel = dateLabel(data[data.length-1].price_date);

  svg.innerHTML = `
    <defs>
      <linearGradient id="blcFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#E3B54A" stop-opacity="0.30"/>
        <stop offset="100%" stop-color="#E3B54A" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <line x1="${PAD}" y1="${H-PAD}" x2="${W-PAD}" y2="${H-PAD}" stroke="#223055" stroke-width="1"/>
    <path d="${areaPath}" fill="url(#blcFill)"/>
    <path d="${linePath}" fill="none" stroke="#E3B54A" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
    <text x="${PAD}" y="${H-8}" fill="#8C97B8" font-size="11" font-family="Inter,sans-serif">${firstLabel}</text>
    <text x="${W-PAD}" y="${H-8}" text-anchor="end" fill="#8C97B8" font-size="11" font-family="Inter,sans-serif">${lastLabel}</text>
  `;
}

document.addEventListener('DOMContentLoaded', drawBlcChart);
