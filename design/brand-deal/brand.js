// Design prototype only: the brand's slim frame (no rail) and the seals. Never shipped, never imported.
const SEAL = 'M12.00 1.40A2.48 2.48 0 0 1 16.60 2.45A2.48 2.48 0 0 1 20.29 5.39A2.48 2.48 0 0 1 22.33 9.64A2.48 2.48 0 0 1 22.33 14.36A2.48 2.48 0 0 1 20.29 18.61A2.48 2.48 0 0 1 16.60 21.55A2.48 2.48 0 0 1 12.00 22.60A2.48 2.48 0 0 1 7.40 21.55A2.48 2.48 0 0 1 3.71 18.61A2.48 2.48 0 0 1 1.67 14.36A2.48 2.48 0 0 1 1.67 9.64A2.48 2.48 0 0 1 3.71 5.39A2.48 2.48 0 0 1 7.40 2.45A2.48 2.48 0 0 1 12.00 1.40Z';
const logo = `<a class="logo" href="#" style="color:#fff"><svg viewBox="0 0 24 24"><path d="${SEAL}" fill="var(--marigold)"/><path d="M8 12.5l3 3 5-6" fill="none" stroke="var(--espresso-ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Cleared</a>`;
const bar = document.createElement("header");
bar.className = "bhead";
bar.innerHTML = `${logo}<span>Ada Okafor invited <b>Glow Theory</b></span>`;
document.body.prepend(bar);
// <i class="sl held|now|todo|done"></i>
for (const el of document.querySelectorAll("i.sl")) {
  const k = el.classList.contains("held") || el.classList.contains("done")
    ? ["var(--latte)", '<path d="M20 6 9 17l-5-5"/>']
    : el.classList.contains("now") ? ["var(--marigold)", '<circle cx="12" cy="12" r="2.5" fill="currentColor"/>'] : ["var(--line-soft)", ""];
  el.outerHTML = `<span class="seal sl" aria-hidden="true"><svg class="s" viewBox="0 0 24 24"><path d="${SEAL}" fill="${k[0]}"/></svg><svg class="i" viewBox="0 0 24 24">${k[1]}</svg></span>`;
}
const YT = '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor"/></svg>';
const IG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>';
for (const el of document.querySelectorAll("i.pl")) el.outerHTML = `<span class="pl ${el.classList.contains("ig") ? "ig" : "yt"}" aria-hidden="true">${el.classList.contains("ig") ? IG : YT}</span>`;
