// Design prototype only: the money card's seal (lock while held, return arrow once back). Needs ../publish-and-pay/pp.js first (PSEAL, the header). Never shipped.
document.querySelectorAll("i.mseal").forEach((el) => {
  const back = el.dataset.k === "back";
  el.outerHTML = `<svg class="mseal" viewBox="0 0 24 24" aria-hidden="true"><path d="${PSEAL}" fill="${back ? "var(--latte-line)" : "var(--marigold-ink)"}"/><g fill="none" stroke="${back ? "var(--espresso)" : "var(--marigold)"}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${back ? '<path d="M10 13.5 7.5 11 10 8.5"/><path d="M7.5 11h5.5a3 3 0 0 1 0 6H11.5"/>' : '<rect x="8" y="11" width="8" height="6.5" rx="1.4"/><path d="M10 11V9.2a2 2 0 0 1 4 0V11"/>'}</g></svg>`;
});
