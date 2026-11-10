"use strict";

const STEP = 100; // rows shown at a time, so huge collections stay fast on phones

const $ = (id) => document.getElementById(id);

const norm = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return "";
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

let all = [];     // every game, with a precomputed search key
let shown = STEP; // how many rows are currently rendered

async function load() {
  try {
    const res = await fetch("games.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();

    all = (data.games || []).map((g) => ({
      ...g,
      key: norm(g.title + " " + (g.notes || "")),
      titleKey: norm(g.title),
    }));

    const platforms = [...new Set(all.map((g) => g.platform))].sort((a, b) => a.localeCompare(b));
    for (const p of platforms) {
      const o = el("option", "", p);
      o.value = p;
      $("platform").append(o);
    }

    if (data.updated) {
      const d = new Date(data.updated);
      if (!isNaN(d)) $("updated").textContent = "Last updated " + d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
    }
    render(true);
  } catch (err) {
    $("count-line").textContent = "";
    $("list").replaceChildren(el("li", "error", "Couldn't load the game list (" + err.message + ")."));
  }
}

function filtered() {
  const q = norm($("filter").value);
  const tokens = q ? q.split(" ") : [];
  const platform = $("platform").value;
  const status = $("status").value;

  const out = all.filter((g) => {
    if (platform && g.platform !== platform) return false;
    if (status === "completed" && !g.completed) return false;
    if (status === "not" && g.completed) return false;
    return tokens.every((t) => g.key.includes(t));
  });

  const sort = $("sort").value;
  const byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true }) || a.platform.localeCompare(b.platform);

  if (sort === "platform") {
    out.sort((a, b) => a.platform.localeCompare(b.platform) || byTitle(a, b));
  } else if (sort === "recent") {
    // completed games first, newest date first (undated ones after dated ones), then the rest A–Z
    out.sort((a, b) => {
      if (!!a.completed !== !!b.completed) return a.completed ? -1 : 1;
      const da = a.completedDate || "", db = b.completedDate || "";
      if (da !== db) return da < db ? 1 : -1;
      return byTitle(a, b);
    });
  } else {
    out.sort(byTitle);
  }
  return out;
}

function row(g) {
  const li = el("li", "game");

  const top = el("div", "game-top");
  top.append(el("span", "game-title", g.title), el("span", "badge", g.platform));
  li.append(top);

  if (g.completed) {
    const when = fmtDate(g.completedDate);
    li.append(el("div", "completed", "✓ Completed" + (when ? " · " + when : "")));
  }
  if (g.notes) li.append(el("p", "notes", g.notes));
  return li;
}

function render(reset) {
  if (reset) shown = STEP;
  const list = filtered();
  const slice = list.slice(0, shown);

  const done = list.filter((g) => g.completed).length;
  const filteredNow = list.length !== all.length;
  $("count-line").textContent =
    list.length.toLocaleString() + (filteredNow ? " of " + all.length.toLocaleString() : "") +
    " game" + (list.length === 1 ? "" : "s") +
    (done ? " · " + done.toLocaleString() + " completed" : "");

  if (!slice.length) {
    $("list").replaceChildren(el("li", "empty", all.length ? "No games match those filters." : "No games yet."));
  } else {
    const frag = document.createDocumentFragment();
    for (const g of slice) frag.append(row(g));
    $("list").replaceChildren(frag);
  }

  const remaining = list.length - slice.length;
  const more = $("more");
  more.hidden = remaining <= 0;
  if (remaining > 0) more.textContent = "Show more (" + remaining.toLocaleString() + " left)";
}

let timer;
$("filter").addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(() => render(true), 100);
});
$("filter").addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });
for (const id of ["platform", "status", "sort"]) $(id).addEventListener("change", () => render(true));
$("more").addEventListener("click", () => { shown += STEP; render(false); });

load();
