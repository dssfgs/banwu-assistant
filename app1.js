const KEY = "banwu-assistant-v1";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => d || "—";

const emptyState = () => ({
  version: 1,
  theme: "light",
  currentClassId: null,
  classes: []
});

let state = load();
let view = "home";
let deferredPrompt = null;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const s = JSON.parse(raw);
    if (!s.classes) return emptyState();
    return s;
  } catch {
    return emptyState();
  }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
  document.documentElement.dataset.theme = state.theme;
}
function cur() {
  return state.classes.find(c => c.id === state.currentClassId) || null;
}
function setClass(id) {
  state.currentClassId = id;
  save();
  render();
}
function enrolled(cls) {
  return (cls?.students || []).filter(s => s.enrolled !== false);
}

function demoData() {
  const aId = uid(), bId = uid();
  const stuA = [
    ["陳大文","男","9123 4567"],["李嘉欣","女","9123 4568"],["黃志強","男",""],
    ["張小美","女","9123 1111"],["何俊傑","男",""],["林詩敏","女",""],
    ["吳家豪","男",""],["梁雅雯","女",""],["周子軒","男",""],["鄭沛琳","女",""]
  ].map((x,i) => ({id: uid(), no: i+1, name: x[0], gender: x[1], enrolled: true, phone: x[2], note: ""}));
  const stuB = [
    ["陳大文","男"],["李嘉欣","女"],["黃志強","男"],["張小美","女"],["何俊傑","男"]
  ].map((x,i) => ({id: uid(), no: i+1, name: x[0], gender: x[1], enrolled: true, phone: "", note: ""}));

  const hwA1 = {id: uid(), title: "工作紙：二次函數", type: "工作紙", assigned: "2026-09-08", due: "2026-09-13", records: {}};
  const hwA2 = {id: uid(), title: "練習：三角比", type: "功課", assigned: "2026-09-12", due: "2026-09-16", records: {}};
  stuA.forEach((s,i) => { hwA1.records[s.id] = i === 3 ? "missing" : "done"; });
  stuA.forEach((s,i) => { hwA2.records[s.id] = i === 3 ? "missing" : (i === 2 ? "late" : "done"); });

  const behA = [
    {id: uid(), studentId: stuA[0].id, date: "2026-09-15", text: "課堂主動答問，解釋頂點座標清楚。"},
    {id: uid(), studentId: stuA[1].id, date: "2026-09-14", text: "欠交工作紙，已致電提醒。"},
    {id: uid(), studentId: stuA[2].id, date: "2026-09-13", text: "協助派發測驗卷。"},
    {id: uid(), studentId: stuA[3].id, date: "2026-09-12", text: "連續兩次欠交，需約見。"},
    {id: uid(), studentId: stuA[0].id, date: "2026-09-11", text: "小測進步，已當面嘉許。"}
  ];
  const hwB = {id: uid(), title: "溫習紙", type: "功課", assigned: "2026-09-10", due: "2026-09-16", records: {}};
  stuB.forEach((s,i) => { hwB.records[s.id] = i === 3 ? "missing" : "done"; });
  const behB = [
    {id: uid(), studentId: stuB[0].id, date: "2026-09-15", text: "小組討論時帶領同學。"},
    {id: uid(), studentId: stuB[3].id, date: "2026-09-14", text: "欠帶計算機。"}
  ];

  return [
    {id: aId, name: "中四E", year: "2025-2026", note: "示範班・可刪除", students: stuA, homeworks: [hwA1, hwA2], behaviors: behA},
    {id: bId, name: "中五A", year: "2025-2026", note: "示範班・可刪除", students: stuB, homeworks: [hwB], behaviors: behB}
  ];
}

function missCount(cls, sid) {
  return (cls.homeworks || []).filter(h => (h.records || {})[sid] === "missing").length;
}
function hwStats(hw, cls) {
  const ids = enrolled(cls).map(s => s.id);
  let done = 0, miss = 0, late = 0;
  ids.forEach(id => {
    const st = (hw.records || {})[id] || "missing";
    if (st === "done") done++;
    else if (st === "late") late++;
    else miss++;
  });
  const total = ids.length || 1;
  return {done, miss, late, rate: Math.round(((done + late) / total) * 100)};
}

function parseRoster(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out = [];
  lines.forEach((line, i) => {
    const parts = line.split(/[\s,\t]+/).filter(Boolean);
    let no = i + 1, name = line, gender = "", phone = "";
    if (/^\d+/.test(parts[0]) && parts[1]) {
      no = parseInt(parts[0], 10);
      name = parts[1];
      gender = /^(男|女|M|F)$/i.test(parts[2] || "") ? parts[2].replace(/^M$/i,"男").replace(/^F$/i,"女") : "";
      phone = parts.slice(gender ? 3 : 2).join(" ");
    } else if (parts.length >= 1) {
      name = parts[0];
      gender = /^(男|女)$/.test(parts[1] || "") ? parts[1] : "";
      phone = parts.slice(gender ? 2 : 1).join(" ");
    }
    out.push({id: uid(), no, name, gender, enrolled: true, phone, note: ""});
  });
  return out;
}

function openDlg(html) {
  const d = $("#dlg");
  d.innerHTML = `<div class="dlg">${html}</div>`;
  d.showModal();
  d.querySelector("[data-close]")?.addEventListener("click", () => d.close());
}

function toast(msg) {
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = "position:fixed;bottom:20px;right:20px;background:var(--ink);color:#fff;padding:10px 14px;border-radius:10px;z-index:9";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

function go(v) {
  view = v;
  $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === v));
  render();
}

document.querySelectorAll(".nav-btn").forEach(b => b.addEventListener("click", () => go(b.dataset.view)));
$("#btnTheme").addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  save(); render();
});
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $("#btnInstall").hidden = false;
});
$("#btnInstall").addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $("#btnInstall").hidden = true;
});

function classPicker(extra = "") {
  if (!state.classes.length) return extra;
  return `<select id="classSel">${state.classes.map(c => `<option value="${c.id}" ${c.id===state.currentClassId?"selected":""}>${esc(c.name)}</option>`).join("")}</select>` + extra;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&','<':'<','>':'>','"':'"',"'":"&#39;"}[m]));
}

function renderHome() {
  $("#pageTitle").textContent = "總覽";
  $("#pageSub").textContent = "今日 " + today() + " ・資料只存在本機";
  $("#topActions").innerHTML = classPicker(`<button class="btn sec sm" id="addClassQuick">＋ 新增班別</button>`);
  $("#classSel")?.addEventListener("change", e => setClass(e.target.value));
  $("#addClassQuick")?.addEventListener("click", promptNewClass);

  const cls = cur();
  if (!state.classes.length) {
    $("#app").innerHTML = `<div class="card empty">
      <p>尚未建立班別。</p>
      <div class="row" style="justify-content:center">
        <button class="btn" id="e1">新增班別</button>
        <button class="btn sec" id="e2">載入示範資料</button>
      </div>
    </div>`;
    $("#e1").onclick = promptNewClass;
    $("#e2").onclick = loadDemo;
    return;
  }
  if (!cls) { setClass(state.classes[0].id); return; }

  const dueSoon = (cls.homeworks || []).filter(h => h.due && h.due >= today() && h.due <= addDays(today(), 2));
  const ranking = enrolled(cls).map(s => ({s, n: missCount(cls, s.id)})).filter(x => x.n > 0).sort((a,b)=>b.n-a.n).slice(0,10);
  const beh = [...(cls.behaviors||[])].sort((a,b)=> b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0,8);
  const rate = avgRate(cls);

  $("#app").innerHTML = `
    <div class="quick">
      <button data-g="homework">收功課</button>
      <button data-g="behavior">記行為</button>
      <button data-g="students">學生名單</button>
      <button data-g="homework">功課清單</button>
    </div>
    <div class="grid cols-2">
      <div class="card">
        <h3>即將到期</h3>
        ${dueSoon.length ? dueSoon.map(h => `<div class="item"><div>${esc(h.title)}<div class="muted">限期 ${esc(h.due)}</div></div><span class="pill late">${hwStats(h,cls).rate}% 已交</span></div>`).join("") : `<div class="muted">未來兩日沒有到期功課。</div>`}
      </div>
      <div class="card">
        <h3>欠交排行</h3>
        ${ranking.length ? ranking.map(x => `<div class="item"><div>${pad(x.s.no)} ${esc(x.s.name)}</div><span class="pill miss">${x.n} 次</span></div>`).join("") : `<div class="muted">本班暫無欠交。</div>`}
      </div>
      <div class="card">
        <h3>最近行為</h3>
        ${beh.length ? beh.map(b => {
          const s = cls.students.find(x => x.id===b.studentId);
          return `<div class="item"><div>${esc(s?.name||"?")}　${esc(b.text)}<div class="muted">${esc(b.date)}</div></div></div>`;
        }).join("") : `<div class="muted">尚未記錄。可到「行為」新增或載入示範。</div>`}
      </div>
      <div class="card">
        <h3>本班交齊率</h3>
        <div class="stat">${rate}%</div>
        <div class="bar"><i style="width:${rate}%"></i></div>
        <div class="muted" style="margin-top:8px">${esc(cls.name)} ・ ${enrolled(cls).length} 人在學</div>
      </div>
    </div>`;
  $$("[data-g]").forEach(b => b.onclick = () => go(b.dataset.g));
}

function avgRate(cls) {
  const hws = cls.homeworks || [];
  if (!hws.length) return 0;
  return Math.round(hws.reduce((a,h)=>a+hwStats(h,cls).rate,0)/hws.length);
}
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate()+n);
  return d.toISOString().slice(0,10);
}
function pad(n) { return String(n).padStart(2,"0"); }
