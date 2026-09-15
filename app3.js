const REASONS = ["病假", "事假", "遲到", "早退", "校外活動", "無故缺席", "其他"];
const DOCS = [
  { key: "doctor", label: "醫生紙" },
  { key: "parent", label: "家長信" },
  { key: "handbook", label: "填寫手冊" }
];

function absencesOf(cls) {
  if (!cls.absences) cls.absences = [];
  return cls.absences;
}
function docsComplete(a) {
  const d = a.docs || {};
  return DOCS.every(x => d[x.key]);
}
function pendingAbsences(cls) {
  return absencesOf(cls).filter(a => !docsComplete(a));
}

function renderAffairs() {
  const cls = needClass("班務");
  if (!cls) return;
  const filter = window._affairsFilter || "pending";
  $("#pageTitle").textContent = "班務告假";
  $("#pageSub").textContent = "缺席須於復課日交回醫生紙、家長信及填寫手冊，未齊全列於「待跟進」。";
  $("#topActions").innerHTML = classPicker(`<button class="btn" id="addAbs">＋ 新增缺席</button>`);
  $("#classSel").onchange = e => setClass(e.target.value);
  $("#addAbs").onclick = () => editAbsence();

  const all = [...absencesOf(cls)].sort((a, b) => (b.start || "").localeCompare(a.start || ""));
  const list = filter === "pending" ? all.filter(a => !docsComplete(a)) : all;

  $("#app").innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="row">
        <button class="btn sm ${filter === "pending" ? "" : "sec"}" data-af="pending">待跟進（${pendingAbsences(cls).length}）</button>
        <button class="btn sm ${filter === "all" ? "" : "sec"}" data-af="all">全部（${all.length}）</button>
      </div>
    </div>
    <div class="card">
      ${list.length ? list.map(a => {
        const s = cls.students.find(x => x.id === a.studentId);
        const done = docsComplete(a);
        const docTxt = DOCS.filter(d => (a.docs || {})[d.key]).map(d => d.label).join("、") || "未交文件";
        return `<div class="item">
          <div>
            <strong>${esc(s?.name || "（已刪除）")}</strong>　${esc(a.reason || "")}
            <div class="muted">${esc(a.start)} 至 ${esc(a.end || a.start)}${a.returnDate ? "　復課 " + esc(a.returnDate) : "　復課未填"}　·　${esc(docTxt)}</div>
            ${a.note ? `<div class="muted">${esc(a.note)}</div>` : ""}
          </div>
          <div class="row">
            <span class="pill ${done ? "ok" : "miss"}">${done ? "已齊全" : "待跟進"}</span>
            <button class="btn sec sm" data-ea="${a.id}">編輯</button>
            <button class="btn sec sm" data-da="${a.id}">刪除</button>
          </div>
        </div>`;
      }).join("") : `<div class="empty">${filter === "pending" ? "沒有待跟進的缺席。" : "尚未有缺席記錄。"}</div>`}
    </div>`;
  $$("[data-af]").forEach(b => b.onclick = () => { window._affairsFilter = b.dataset.af; render(); });
  $$("[data-ea]").forEach(b => b.onclick = () => editAbsence(b.dataset.ea));
  $$("[data-da]").forEach(b => b.onclick = () => {
    if (!confirm("刪除此缺席記錄？")) return;
    cls.absences = absencesOf(cls).filter(x => x.id !== b.dataset.da);
    save(); render();
  });
}

function editAbsence(id) {
  const cls = cur();
  if (!cls) return;
  const stu = enrolled(cls);
  const a = absencesOf(cls).find(x => x.id === id) || {
    studentId: stu[0]?.id || "",
    start: today(),
    end: today(),
    returnDate: "",
    reason: "病假",
    docs: { doctor: false, parent: false, handbook: false },
    note: ""
  };
  const docs = Object.assign({ doctor: false, parent: false, handbook: false }, a.docs || {});
  openDlg(`
    <h3>${id ? "編輯缺席" : "新增缺席記錄"}</h3>
    <div class="field"><label>學生</label>
      <div class="stu-chips" id="stuPick">
        ${stu.map(s => `<button type="button" data-sid="${s.id}" class="${s.id === a.studentId ? "on" : ""}">${pad(s.no)} ${esc(s.name)}</button>`).join("") || "<span class='muted'>請先加入學生</span>"}
      </div>
    </div>
    <div class="field"><label>缺席開始日期</label><input type="date" id="as" value="${esc(a.start || today())}" /></div>
    <div class="field"><label>缺席結束日期</label><input type="date" id="ae" value="${esc(a.end || today())}" /></div>
    <div class="field"><label>復課日期（可稍後補填）</label><input type="date" id="ar" value="${esc(a.returnDate || "")}" /></div>
    <div class="field"><label>缺席理由</label>
      <div class="chips" id="reasonPick">
        ${REASONS.map(r => `<button type="button" class="chip ${r === (a.reason || "病假") ? "on" : ""}" data-r="${r}">${r}</button>`).join("")}
      </div>
    </div>
    <div class="field">
      <div class="row" style="justify-content:space-between">
        <label style="margin:0">已交回文件 CHECK LIST</label>
        <button type="button" class="btn sec sm" id="allDocs">全部齊全</button>
      </div>
      ${DOCS.map(d => `<label class="check-row"><input type="checkbox" data-doc="${d.key}" ${docs[d.key] ? "checked" : ""} /> ${d.label}</label>`).join("")}
    </div>
    <div class="field"><label>詳情備註（可留空）</label><textarea id="an">${esc(a.note || "")}</textarea></div>
    <div class="actions"><button class="btn sec" data-close>取消</button><button class="btn" id="asave">儲存缺席記錄</button></div>`);

  let sid = a.studentId;
  let reason = a.reason || "病假";
  $$("#stuPick [data-sid]").forEach(b => b.onclick = () => {
    sid = b.dataset.sid;
    $$("#stuPick button").forEach(x => x.classList.toggle("on", x === b));
  });
  $$("#reasonPick .chip").forEach(b => b.onclick = () => {
    reason = b.dataset.r;
    $$("#reasonPick .chip").forEach(x => x.classList.toggle("on", x === b));
  });
  $("#allDocs").onclick = () => $$("[data-doc]").forEach(c => { c.checked = true; });
  $("#asave").onclick = () => {
    if (!sid) return toast("請選學生");
    const rec = {
      studentId: sid,
      start: $("#as").value || today(),
      end: $("#ae").value || $("#as").value || today(),
      returnDate: $("#ar").value || "",
      reason,
      docs: {
        doctor: $("[data-doc=doctor]").checked,
        parent: $("[data-doc=parent]").checked,
        handbook: $("[data-doc=handbook]").checked
      },
      note: $("#an").value.trim()
    };
    if (id) Object.assign(a, rec);
    else absencesOf(cls).push({ id: uid(), ...rec });
    save();
    $("#dlg").close();
    window._affairsFilter = docsComplete(rec) ? "all" : "pending";
    go("affairs");
  };
}

function seedDemoAbsences() {
  (state.classes || []).forEach(cls => {
    if (absencesOf(cls).length) return;
    const s = enrolled(cls)[3] || enrolled(cls)[0];
    const s2 = enrolled(cls)[1];
    if (!s) return;
    cls.absences.push({
      id: uid(), studentId: s.id, start: "2026-09-12", end: "2026-09-15", returnDate: "",
      reason: "病假", docs: { doctor: false, parent: true, handbook: false }, note: "示範：醫生紙及手冊未交。"
    });
    if (s2) {
      cls.absences.push({
        id: uid(), studentId: s2.id, start: "2026-09-14", end: "2026-09-14", returnDate: "2026-09-15",
        reason: "遲到", docs: { doctor: true, parent: true, handbook: true }, note: "已齊全示範。"
      });
    }
  });
}

const _loadDemoOrig = typeof loadDemo === "function" ? loadDemo : null;
if (_loadDemoOrig) {
  loadDemo = function () {
    _loadDemoOrig();
    seedDemoAbsences();
    save();
    render();
  };
}

function render() {
  document.documentElement.dataset.theme = state.theme;
  $("#btnTheme").textContent = state.theme === "dark" ? "淺色模式" : "深色模式";
  ({
    home: renderHome,
    homework: renderHomework,
    behavior: renderBehavior,
    affairs: renderAffairs,
    students: renderStudents,
    settings: renderSettings
  }[view] || renderHome)();
}
