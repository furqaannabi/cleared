// Design prototype only: wraps <main> in the app shell (rail on desktop, top bar on phones).
const SEAL = 'M12.00 1.40A2.48 2.48 0 0 1 16.60 2.45A2.48 2.48 0 0 1 20.29 5.39A2.48 2.48 0 0 1 22.33 9.64A2.48 2.48 0 0 1 22.33 14.36A2.48 2.48 0 0 1 20.29 18.61A2.48 2.48 0 0 1 16.60 21.55A2.48 2.48 0 0 1 12.00 22.60A2.48 2.48 0 0 1 7.40 21.55A2.48 2.48 0 0 1 3.71 18.61A2.48 2.48 0 0 1 1.67 14.36A2.48 2.48 0 0 1 1.67 9.64A2.48 2.48 0 0 1 3.71 5.39A2.48 2.48 0 0 1 7.40 2.45A2.48 2.48 0 0 1 12.00 1.40Z';
const logo = `<a class="logo" href="#" style="color:#fff"><svg viewBox="0 0 24 24"><path d="${SEAL}" fill="var(--marigold)"/><path d="M8 12.5l3 3 5-6" fill="none" stroke="var(--espresso-ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Cleared</a>`;
const step = document.body.dataset.step || "Invite";
const main = document.querySelector("main");
const app = document.createElement("div");
app.className = "app";
app.innerHTML = `<aside class="rail"><div class="lg">${logo}</div><a class="new" href="#">+ New deal</a><p class="rh">Deals</p>
<a class="dl on"><i class="av">GT</i><span>Glow Theory<small>${step}</small></span></a><a class="dl"><i class="av b">NC</i><span>Northbound Coffee<small>Brand review</small></span></a><a class="dl"><i class="av c">KA</i><span>Kora Audio<small>Waiting for your draft</small></span></a></aside>
<div class="col"><header class="topbar">${logo}<span style="font-weight:700">Deals</span></header></div>`;
main.replaceWith(app);
app.querySelector(".col").append(main);
// seals: <i class="sl ok|now|todo"></i>
for (const el of document.querySelectorAll("i.sl")) {
  const k = el.classList.contains("ok") ? ["var(--pass-wash)", '<path d="M20 6 9 17l-5-5"/>', "var(--pass)"] : el.classList.contains("now") ? ["var(--marigold)", '<circle cx="12" cy="12" r="2.5" fill="currentColor"/>'] : ["var(--line-soft)", ""];
  el.outerHTML = `<span class="seal sl" aria-hidden="true" style="color:${k[2] || "var(--espresso-ink)"}"><svg class="s" viewBox="0 0 24 24"><path d="${SEAL}" fill="${k[0]}"/></svg><svg class="i" viewBox="0 0 24 24">${k[1]}</svg></span>`;
}
