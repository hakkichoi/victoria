// VICTORIA PROJECT — Planning / roadmap marquee (public read-only)

function fmtPeriod(iso){
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
}

async function loadPlanningTrack(){
  const track = document.getElementById('planningTrack');
  if (!track) return;

  const { data, error } = await sb
    .from('planning_items')
    .select('period_date, title, detail')
    .order('period_date', { ascending: true });

  if (error || !data || data.length === 0){
    track.parentElement.style.display = 'none';
    return;
  }

  const cards = data.map(item => `
    <div class="planning-card">
      <span class="period">${fmtPeriod(item.period_date)}</span>
      <h3>${item.title}</h3>
      ${item.detail ? `<p>${item.detail}</p>` : ''}
    </div>
  `).join('');

  track.innerHTML = cards + cards; // duplicated once for a seamless loop
}

document.addEventListener('DOMContentLoaded', loadPlanningTrack);
