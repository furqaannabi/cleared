// Design prototype only: the creator's slim header, seals and platform marks. Never shipped, never imported.
const PSEAL = 'M12.00 1.40A2.48 2.48 0 0 1 16.60 2.45A2.48 2.48 0 0 1 20.29 5.39A2.48 2.48 0 0 1 22.33 9.64A2.48 2.48 0 0 1 22.33 14.36A2.48 2.48 0 0 1 20.29 18.61A2.48 2.48 0 0 1 16.60 21.55A2.48 2.48 0 0 1 12.00 22.60A2.48 2.48 0 0 1 7.40 21.55A2.48 2.48 0 0 1 3.71 18.61A2.48 2.48 0 0 1 1.67 14.36A2.48 2.48 0 0 1 1.67 9.64A2.48 2.48 0 0 1 3.71 5.39A2.48 2.48 0 0 1 7.40 2.45A2.48 2.48 0 0 1 12.00 1.40Z';
const head = document.createElement("header");
head.className = "chead";
head.innerHTML = `<a class="logo" href="#" style="font-size:19px"><svg viewBox="0 0 24 24" style="width:24px;height:24px"><path d="${PSEAL}" fill="var(--marigold)"/><path d="M8 12.5l3 3 5-6" fill="none" stroke="var(--espresso-ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Cleared</a><span class="who">Ada Okafor</span>`;
document.body.prepend(head);
// <i class="sl done|now|todo|clock|lock|ret"></i>
const ICON = { done: '<path d="M20 6 9 17l-5-5"/>', now: '<circle cx="12" cy="12" r="2.5" fill="currentColor"/>', todo: "", clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>', lock: '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 0 1 6 0v3"/>', ret: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>', flag: '<path d="M6 21V4M6 4h11l-2 4 2 4H6"/>' };
const FILL = { done: "var(--latte)", now: "var(--marigold)", todo: "var(--line-soft)", clock: "var(--waiting-wash)", lock: "var(--espresso-ink)", ret: "var(--latte)", flag: "var(--fail-wash)" };
for (const el of document.querySelectorAll("i.sl")) {
  const k = Object.keys(ICON).find((c) => el.classList.contains(c)) ?? "todo";
  const color = k === "lock" ? "var(--marigold)" : k === "flag" ? "var(--fail)" : "var(--espresso)";
  const big = el.classList.contains("big") ? " big" : "";
  el.outerHTML = `<span class="seal sl${big}" style="color:${color}" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${PSEAL}" fill="${FILL[k]}"/></svg><svg class="i" viewBox="0 0 24 24">${ICON[k]}</svg></span>`;
}
const YT = '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor"/></svg>';
for (const el of document.querySelectorAll("i.pl")) el.outerHTML = `<span class="pl yt" aria-hidden="true">${YT}</span>`;
