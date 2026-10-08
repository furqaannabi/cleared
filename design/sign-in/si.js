// Design prototype only: seals, the Cleared mark and the Google mark. Never shipped.
const SEAL = 'M12.00 1.40A2.48 2.48 0 0 1 16.60 2.45A2.48 2.48 0 0 1 20.29 5.39A2.48 2.48 0 0 1 22.33 9.64A2.48 2.48 0 0 1 22.33 14.36A2.48 2.48 0 0 1 20.29 18.61A2.48 2.48 0 0 1 16.60 21.55A2.48 2.48 0 0 1 12.00 22.60A2.48 2.48 0 0 1 7.40 21.55A2.48 2.48 0 0 1 3.71 18.61A2.48 2.48 0 0 1 1.67 14.36A2.48 2.48 0 0 1 1.67 9.64A2.48 2.48 0 0 1 3.71 5.39A2.48 2.48 0 0 1 7.40 2.45A2.48 2.48 0 0 1 12.00 1.40Z';
const ICON = {
  lock: '<rect x="7.5" y="11" width="9" height="7" rx="1.5"/><path d="M9.7 11V9a2.3 2.3 0 0 1 4.6 0v2"/>',
  check: '<path d="M8 12.5l3 3 5-6"/>',
  doc: '<path d="M9 7.5h6M9 11h6M9 14.5h4"/>',
  coin: '<circle cx="12" cy="12" r="4.5"/><path d="M12 10v4"/>',
  done: '<path d="M8 12.5l3 3 5-6"/>',
};
document.querySelectorAll("i.w-seal").forEach((el) => {
  const k = el.dataset.k, fill = el.dataset.fill || "var(--marigold)", ink = el.dataset.ink || "var(--espresso-ink)";
  el.outerHTML = `<svg class="${el.className}" viewBox="0 0 24 24" aria-hidden="true"><path d="${SEAL}" fill="${fill}"/><g fill="none" stroke="${ink}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICON[k] || ""}</g></svg>`;
});
document.querySelectorAll("i.w-g").forEach((el) => {
  el.outerHTML = `<span class="w-g" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.5 5.8c4.4-4 6.8-10 6.8-17.2z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.8-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.8 6.1C6.6 42.6 14.6 48 24 48z"/></svg></span>`;
});
document.querySelectorAll("i.w-logo").forEach((el) => {
  el.outerHTML = `<a class="logo" href="#" style="font-size:19px"><svg viewBox="0 0 24 24" style="width:24px;height:24px"><path d="${SEAL}" fill="var(--marigold)"/><path d="M8 12.5l3 3 5-6" fill="none" stroke="var(--espresso-ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Cleared</a>`;
});
