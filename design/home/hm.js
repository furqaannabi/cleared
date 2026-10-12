/* Shared example data and pieces for the creator home mockups (HM 1.0). Example data, not real accounts. */
const I = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  yt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3Z"/></svg>',
  ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
  cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.5L16 9.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  dot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="8"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  sort: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16l-6 8v6l-4-2v-4z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
};

const TOTALS = {
  held: { amount: "$2,660.00", posts: "3 posts" },
  way: { amount: "$1,140.00", posts: "2 posts" },
  paid: { amount: "$6,412.50", posts: "6 posts" },
};
const STUCK = [{ brand: "Juniper & Salt", post: "Reel", text: "the payout didn’t go through." }];

const FIGURES = [
  { name: "On time", value: "6 of 7 posts", line: "went live before their deadline", pts: [2, 2, 1, 1.5] },
  { name: "Passed first time", value: "5 of 8 drafts", line: "passed every item on the first check", pts: [0, 1, 0.5, 0.67] },
  { name: "Time to paid", value: "2 days", line: "on average, from posting to paid", pts: [3, 2.5, 2, 1.5] },
];
const MONTHS = [
  { m: "May", v: 0, t: "$0" }, { m: "Jun", v: 760, t: "$760" }, { m: "Jul", v: 1425, t: "$1,425" },
  { m: "Aug", v: 1140, t: "$1,140" }, { m: "Sep", v: 2327.5, t: "$2,327.50" }, { m: "Oct", v: 760, t: "$760", now: true },
];

const DEALS = {
  "Needs you": [
    { brand: "Glow Theory", av: "", posts: [["yt", "YouTube video", "fail", I.cross, "2 to fix"]] },
    { brand: "Juniper & Salt", av: "sky", posts: [["ig", "Reel", "fail", I.cross, "Payout didn’t go through"]] },
  ],
  "Under way": [
    { brand: "Pine & Co", av: "sun", posts: [["yt", "YouTube video", "uns", I.clock, "Brand review · 31h left"], ["yt", "Short", "wait", I.clock, "Checking"]] },
    { brand: "Maple & Moss", av: "", posts: [["ig", "Reel", "uns", I.clock, "Waiting for Maple & Moss to agree"]] },
  ],
  Finished: [
    { brand: "Kora Audio", av: "sky", posts: [["yt", "YouTube video", "pass", I.check, "Paid"]] },
    { brand: "Tide Studio", av: "sun", posts: [["yt", "YouTube video", "pass", I.check, "Paid"], ["yt", "Short", "pass", I.check, "Paid"]] },
  ],
};

const PAID = [
  ["9 Oct 2026", "Kora Audio", "YouTube video", "$800.00", "$40.00", "$760.00", "5UX0294KQ1", "7HK21934LM"],
  ["24 Sep 2026", "Tide Studio", "Short", "$1,050.00", "$52.50", "$997.50", "8RT4410ZPA", "3MV88201QD"],
  ["11 Sep 2026", "Tide Studio", "YouTube video", "$1,400.00", "$70.00", "$1,330.00", "2KD7735WBE", "3MV88201QC"],
  ["20 Aug 2026", "Juniper & Salt", "YouTube video", "$1,200.00", "$60.00", "$1,140.00", "9PL3302HNS", "6TQ55018RA"],
  ["15 Jul 2026", "Glow Theory", "Reel", "$1,500.00", "$75.00", "$1,425.00", "4WE9917MCX", "1BN22764LK"],
  ["3 Jun 2026", "Maple & Moss", "Short", "$800.00", "$40.00", "$760.00", "7JC1180TYV", "5ZA90433PE"],
];

const mark = (p) => `<span class="h-mk ${p}">${I[p]}</span>`;

function rail() {
  const row = (b, av, name, st) => `<div class="h-row"><b class="${av}">${b}</b><span>${name}<small>${st}</small></span></div>`;
  return `<aside class="h-rail"><span class="h-logo"><i></i>Cleared</span>
  <span class="h-new">+ New deal</span>
  <div class="h-row on">${I.home}<span>Home</span></div>
  <span class="h-nav">Deals</span>
  ${row("GT", "", "Glow Theory", "Draft check · 2 to fix")}${row("JS", "sky", "Juniper &amp; Salt", "Payout didn’t go through")}${row("PC", "sun", "Pine &amp; Co", "Brand review · 31h left")}${row("MM", "", "Maple &amp; Moss", "Waiting for brand")}${row("KA", "sky", "Kora Audio", "Paid")}
  <div class="h-row h-me"><b>AO</b><span>Ada Okafor<small>Creator</small></span></div></aside>`;
}
const topBar = () => `<div class="h-top"><span class="h-logo"><i></i>Cleared</span><span>${I.menu}Deals</span></div>`;

function stuckLine() {
  return STUCK.map((s) => `<a href="#" class="h-stuck">${I.cross}<span><b>${s.brand} · ${s.post}:</b> ${s.text}</span></a>`).join("");
}

function bars() {
  const max = Math.max(...MONTHS.map((x) => x.v));
  return `<div class="h-bars" role="img" aria-label="Paid each month: ${MONTHS.map((x) => `${x.m}${x.now ? " so far" : ""} ${x.t}`).join(", ")}">${MONTHS.map((x) => `<div class="h-bar${x.now ? " now" : ""}${x.v ? "" : " none"}"><em>${x.v ? x.t : ""}</em><i style="height:${(x.v / max) * 100}%"></i></div>`).join("")}</div>
  <div class="h-months">${MONTHS.map((x) => (x.now ? `<span><b>${x.m}</b><br>so far</span>` : `<span>${x.m}</span>`)).join("")}</div>`;
}

function spark(pts) {
  const w = 120, h = 30, max = Math.max(...pts), min = Math.min(...pts);
  const xy = pts.map((p, i) => [4 + (i * (w - 8)) / (pts.length - 1), h - 5 - ((p - min) / (max - min || 1)) * (h - 10)]);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lx, ly] = xy[xy.length - 1];
  return `<svg class="h-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" vector-effect="non-scaling-stroke"/><circle cx="${lx}" cy="${ly}" r="3"/></svg>`;
}

function deals(cls) {
  return Object.entries(DEALS).map(([group, list]) => `<section class="${cls}-grp"><h3 class="${cls}-gh">${group}<span>${list.length}</span></h3>
  ${list.map((d) => `<a href="#" class="${cls}-deal"><span class="${cls}-brand">${d.brand}</span><span class="${cls}-posts">${d.posts.map(([p, name, tone, icon, st]) => `<span class="${cls}-post">${mark(p)}<span><span class="${cls}-pn">${name}</span><span class="h-st ${tone}">${icon}${st}</span></span></span>`).join("")}</span>${I.arrow}</a>`).join("")}</section>`).join("");
}

function grid() {
  const th = (t, extra = "", num = false) => `<th class="${num ? "num" : ""}"><span>${t}${extra}</span></th>`;
  return `<div class="h-grid"><table><thead><tr>${th("Date paid", I.sort).replace("<th", '<th aria-sort="descending"').replace('class=""', 'class="sorted"')}${th("Brand", I.filter)}${th("Post")}${th("Deal amount", "", true)}${th("Fee", "", true)}${th("Received", "", true)}${th("Payout reference")}${th("Hold reference")}</tr></thead>
  <tbody>${PAID.map((r) => `<tr><td>${r[0]}</td><td><b>${r[1]}</b></td><td>${r[2]}</td><td class="num">${r[3]}</td><td class="num">${r[4]}</td><td class="num got">${r[5]}</td><td class="ref">${r[6]}</td><td class="ref">${r[7]}</td></tr>`).join("")}</tbody></table></div>`;
}

function cards() {
  return PAID.map((r) => `<article class="h-card"><div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline"><b>${r[1]} · ${r[2]}</b><span class="h-quiet">${r[0]}</span></div>
  <dl><dt>Deal amount</dt><dd>${r[3]}</dd><dt>Cleared’s fee</dt><dd>${r[4]}</dd><dt class="got">Received</dt><dd class="got">${r[5]}</dd><dt>Payout reference</dt><dd>${r[6]}</dd><dt>Hold reference</dt><dd>${r[7]}</dd></dl></article>`).join("");
}
