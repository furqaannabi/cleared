// Design prototype only: status seals for the brand's review. Never shipped, never imported.
// Runs before ../brand-deal/brand.js (which adds the header, platform marks and plain seals).
const RSEAL = 'M12.00 1.40A2.48 2.48 0 0 1 16.60 2.45A2.48 2.48 0 0 1 20.29 5.39A2.48 2.48 0 0 1 22.33 9.64A2.48 2.48 0 0 1 22.33 14.36A2.48 2.48 0 0 1 20.29 18.61A2.48 2.48 0 0 1 16.60 21.55A2.48 2.48 0 0 1 12.00 22.60A2.48 2.48 0 0 1 7.40 21.55A2.48 2.48 0 0 1 3.71 18.61A2.48 2.48 0 0 1 1.67 14.36A2.48 2.48 0 0 1 1.67 9.64A2.48 2.48 0 0 1 3.71 5.39A2.48 2.48 0 0 1 7.40 2.45A2.48 2.48 0 0 1 12.00 1.40Z';
// <i class="st pass|acc|live|asked|unsure|fixreq|obj|fail"></i>
const KINDS = {
  pass: ["var(--pass-wash)", "var(--pass)", '<path d="M20 6 9 17l-5-5"/>'],
  acc: ["var(--latte)", "var(--espresso)", '<circle cx="12" cy="12" r="7"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'],
  live: ["var(--waiting-wash)", "var(--waiting)", '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>'],
  asked: ["var(--unsure-wash)", "var(--unsure)", '<path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>'],
  unsure: ["var(--unsure-wash)", "var(--unsure)", '<path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>'],
  fixreq: ["var(--waiting-wash)", "var(--waiting)", '<path d="M5 19 19 5M14 5h5v5"/>'],
  obj: ["var(--fail-wash)", "var(--fail)", '<path d="M6 21V4M6 4h11l-2 4 2 4H6"/>'],
  fail: ["var(--fail-wash)", "var(--fail)", '<path d="M7 7l10 10M17 7 7 17"/>'],
};
for (const el of document.querySelectorAll("i.st")) {
  const k = Object.keys(KINDS).find((c) => el.classList.contains(c)) ?? "pass";
  const [fill, ink, path] = KINDS[k];
  el.outerHTML = `<span class="seal st" style="color:${ink}" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${RSEAL}" fill="${fill}"/></svg><svg class="i" viewBox="0 0 24 24">${path}</svg></span>`;
}
for (const el of document.querySelectorAll(".screen")) {
  el.insertAdjacentHTML("afterbegin", '<span class="bottle"></span><span class="tag">Sample draft (synthetic)</span><span class="play"><svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg></span>');
}
