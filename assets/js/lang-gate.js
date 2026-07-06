// VICTORIA PROJECT — first-visit language gate
// Shows a full-page (not a modal) language chooser the very first time someone
// lands on the site. Once a language is picked, it's remembered (localStorage)
// and the gate never shows again on this browser.

document.addEventListener('DOMContentLoaded', ()=>{
  const gate = document.getElementById('langGate');
  if (!gate) return;

  const alreadyChosen = localStorage.getItem('victoria_lang_chosen');
  if (alreadyChosen){
    gate.classList.add('hidden');
    return;
  }

  document.body.style.overflow = 'hidden';

  gate.querySelectorAll('[data-gate-lang]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const lang = btn.getAttribute('data-gate-lang');
      i18n.setLang(lang);
      localStorage.setItem('victoria_lang_chosen', '1');
      gate.classList.add('hidden');
      document.body.style.overflow = '';
    });
  });
});
