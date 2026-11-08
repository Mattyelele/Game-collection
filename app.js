"use strict";

const MAX_RESULTS = 50;

// Lower-case, strip accents and punctuation so "Pokémon: Red" matches "pokemon red".
const norm = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

let titles = []; // [{ title, key, platforms: [..] }]

const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---------- data ----------
async function load() {
  try {
    const res = await fetch("games.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    build(data);
  } catch (err) {
    const msg = el("p", "error", "Couldn't load the game list (" + err.message + ").");
    $("stats").replaceChildren(msg);
  }
}

function build(data) {
  const games = data.games || [];
  const byKey = new Map();
  const perPlatform = new Map();

  for (const g of games) {
    const key = norm(g.title);
    if (!byKey.has(key)) byKey.set(key, { title: g.title, key, platforms: [] });
    const entry = byKey.get(key);
    if (!entry.platforms.includes(g.platform)) entry.platforms.push(g.platform);
    perPlatform.set(g.platform, (perPlatform.get(g.platform) || 0) + 1);
  }

  titles = [...byKey.values()];
  for (const t of titles) t.platforms.sort((a, b) => a.localeCompare(b));

  renderStats(games.length, titles.length, perPlatform);

  if (data.updated) {
    const d = new Date(data.updated);
    if (!isNaN(d)) $("updated").textContent = "Last updated " + d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  }

  if ($("search").value) runSearch();
}

function renderStats(total, unique, perPlatform) {
  $("stat-total").textContent = total.toLocaleString();
  $("stat-unique").textContent = unique.toLocaleString();
  $("stat-platforms").textContent = perPlatform.size.toLocaleString();

  const rows = [...perPlatform.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const max = rows.length ? rows[0][1] : 1;

  const list = $("platform-list");
  list.replaceChildren();
  for (const [name, count] of rows) {
    const li = el("li", "platform-row");
    const bar = el("div", "bar");
    bar.style.width = (count / max) * 100 + "%";
    li.append(bar, el("span", "name", name), el("span", "count", count.toLocaleString()));
    list.append(li);
  }
}

// ---------- search ----------
function score(t, q, tokens) {
  const k = t.key;
  if (k === q) return 0;
  if (k.startsWith(q)) return 1;
  if (k.includes(" " + q)) return 2;
  if (k.includes(q)) return 3;
  // every word present somewhere
  if (tokens.every((w) => k.includes(w))) return 4;
  return -1;
}

function runSearch() {
  const box = $("results");
  const q = norm($("search").value);

  if (!q) {
    box.hidden = true;
    box.replaceChildren();
    return;
  }

  const tokens = q.split(" ");
  const hits = [];
  for (const t of titles) {
    const s = score(t, q, tokens);
    if (s >= 0) hits.push({ t, s });
  }
  hits.sort((a, b) => a.s - b.s || a.t.title.localeCompare(b.t.title));

  const frag = document.createDocumentFragment();
  const exact = hits.length && hits[0].s === 0 ? hits[0].t : null;

  if (exact) {
    frag.append(el("div", "verdict yes", "✓ Yes, I own it on " + exact.platforms.join(", ")));
  } else if (hits.length) {
    frag.append(el("div", "verdict maybe", "No exact match — " + hits.length.toLocaleString() + " similar title" + (hits.length === 1 ? "" : "s")));
  } else {
    frag.append(el("div", "verdict no", "✗ Not in my collection"));
  }

  if (hits.length) {
    const ul = el("ul", "result-list");
    for (const { t } of hits.slice(0, MAX_RESULTS)) {
      const li = el("li", "result");
      li.append(el("span", "title", t.title));
      const badges = el("span", "badges");
      for (const p of t.platforms) badges.append(el("span", "badge", p));
      li.append(badges);
      ul.append(li);
    }
    frag.append(ul);
    if (hits.length > MAX_RESULTS) {
      frag.append(el("p", "more", "Showing the first " + MAX_RESULTS + " of " + hits.length.toLocaleString() + " matches — keep typing to narrow it down."));
    }
  }

  box.replaceChildren(frag);
  box.hidden = false;
}

let timer;
$("search").addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(runSearch, 80);
});

// Focus the search bar on desktop only, so phones don't pop the keyboard open on load.
if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
  $("search").focus();
}

// Pressing Search/Enter on a phone keyboard dismisses it so results are visible.
$("search").addEventListener("keydown", (e) => {
  if (e.key === "Enter") e.target.blur();
});

load();
