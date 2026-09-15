function renderHomework() {
  const cls = needClass("功課");
  if (!cls) return;
  $("#pageTitle").textContent = "功課清單";
  $("#pageSub").textContent = cls.name + " ・只記交收，不記分數";
  $("#topActions").innerHTML = classPicker(`<button class="btn" id="addHw">＋ 新增功課</button>`);
  $("#classSel").onchange = e => setClass(e.target.value);
  $("#addHw").onclick = () => editHomework();

  const list = [...(cls.homeworks||[])].sort((a,b)=>(b.due||"").localeCompare(a.due||""));
  if (!list.length) {
    $("#app").innerHTML = `<div class="card empty">未有功課。<button class="btn" id="x">新增一項</button></div>`;
    $("#x").onclick = () => editHomework();
    return;
  }
  $("#app").innerHTML = list.map(h => {
    const st = hwStats(h, cls);
    return `<div class="card">
      <div class="head" style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
        <div>
          <strong>${esc(h.title)}</strong>
          <div class="hw-meta">${esc(h.type)} ・ 佈置 ${fmt(h.assigned)} ・ 限期 ${fmt(h.due)} ・ 交齊率 ${st.rate}%</div>
        </div>
        <div class="row">
          <button class="btn sm" data-collect="${h.id}">收功課</button>
          <button class="btn sec sm" data-edit="${h.id}">編輯</button>
          <button class="btn sec sm" data-del="${h.id}">刪除</button>
        </div>
      </div>
      <div class="bar"><i style="width:${st.rate}%"></i></div>
      <div class="muted" style="margin-top:8px">已交 ${st.done}　遲交 ${st.late}　欠交 ${st.miss}</div>
    </div>`;
  }).join('<div style="height:12px"></div>');
  $$("[data-collect]").forEach(b => b.onclick = () => collectHw(b.dataset.collect));
  $$("[data-edit]").forEach(b => b.onclick = () => editHomework(b.dataset.edit));
  $$("[data-del]").forEach(b => b.onclick = () => {
    if (!confirm("刪除此功課？")) return;
    cls.homeworks = cls.homeworks.filter(h => h.id !== b.dataset.del);
    save(); render();
  });
}

function editHomework(id) {
  const cls = cur();
  const hw = cls.homeworks.find(h => h.id === id) || {title:"", type:"功課", assigned: today(), due: today()};
  openDlg(`
    <h3>${id ? "編輯功課" : "新增功課"}</h3>
    <div class="field"><label>標題</label><input id="ht" value="${esc(hw.title)}" /></div>
    <div class="field"><label>類型</label>
      <select id="hy">
        ${["功課","工作紙","默書","測驗","其他"].map(t => `<option ${t===hw.type?"selected":""}>${t}</option>`).join("")}
      </select>
    </div>
    <div class="field"><label>佈置日期</label><input type="date" id="ha" value="${esc(hw.assigned||"")}" /></div>
    <div class="field"><label>限期</label><input type="date" id="hd" value="${esc(hw.due||"")}" /></div>
    <div class="actions"><button class="btn sec" data-close>取消</button><button class="btn" id="hs">儲存</button></div>`);
  $("#hs").onclick = () => {
    const title = $("#ht").value.trim();
    if (!title) return toast("請填標題");
    if (id) {
      Object.assign(hw, {title, type: $("#hy").value, assigned: $("#ha").value, due: $("#hd").value});
    } else {
      const rec = {};
      enrolled(cls).forEach(s => rec[s.id] = "missing");
      cls.homeworks.push({id: uid(), title, type: $("#hy").value, assigned: $("#ha").value, due: $("#hd").value, records: rec});
    }
    save(); $("#dlg").close(); render();
  };
}

function collectHw(id) {
  const cls = cur();
  const hw = cls.homeworks.find(h => h.id === id);
  const rows = enrolled(cls).sort((a,b)=>a.no-b.no).map(s => {
    const st = (hw.records || {})[s.id] || "missing";
    return `<div class="collect-row">
      <div>${pad(s.no)} ${esc(s.name)}</div>
      <div class="seg" data-sid="${s.id}">
        <button data-st="done" class="${st==="done"?"on-ok":""}">已交</button>
        <button data-st="late" class="${st==="late"?"on-late":""}">遲交</button>
        <button data-st="missing" class="${st==="missing"?"on-miss":""}">欠交</button>
      </div>
    </div>`;
  }).join("");
  openDlg(`<h3>收功課　${esc(hw.title)}</h3>
    <div class="row" style="margin-bottom:10px">
      <button class="btn sm good" id="allOk">全班已交</button>
      <button class="btn sm sec" id="allMiss">全班欠交</button>
    </div>
    ${rows || "<div class='muted'>沒有在學學生</div>"}
    <div class="actions"><button class="btn" data-close>完成</button></div>`);
  const apply = (sid, st) => {
    hw.records = hw.records || {};
    hw.records[sid] = st;
    save();
  };
  $$(".seg").forEach(seg => {
    seg.querySelectorAll("button").forEach(btn => btn.onclick = () => {
      apply(seg.dataset.sid, btn.dataset.st);
      seg.querySelectorAll("button").forEach(x => x.className = "");
      btn.className = btn.dataset.st === "done" ? "on-ok" : btn.dataset.st === "late" ? "on-late" : "on-miss";
    });
  });
  $("#allOk").onclick = () => { enrolled(cls).forEach(s => apply(s.id, "done")); $("#dlg").close(); render(); collectHw(id); };
  $("#allMiss").onclick = () => { enrolled(cls).forEach(s => apply(s.id, "missing")); $("#dlg").close(); render(); collectHw(id); };
}

function renderBehavior() {
  const cls = needClass("行為");
  if (!cls) return;
  $("#pageTitle").textContent = "行為記錄";
  $("#pageSub").textContent = cls.name + " ・自由打一句，可隨時改";
  $("#topActions").innerHTML = classPicker(`<button class="btn" id="addB">＋ 新增記錄</button>`);
  $("#classSel").onchange = e => setClass(e.target.value);
  $("#addB").onclick = () => editBehavior();

  const list = [...(cls.behaviors||[])].sort((a,b)=> b.date.localeCompare(a.date));
  if (!list.length) {
    $("#app").innerHTML = `<div class="card empty">未有行為記錄。可新增，或到設定載入含示範行為的資料。</div>`;
    return;
  }
  $("#app").innerHTML = `<div class="card">${list.map(b => {
    const s = cls.students.find(x => x.id === b.studentId);
    return `<div class="item">
      <div><strong>${esc(s?.name || "（已刪除）")}</strong>　${esc(b.text)}<div class="muted">${esc(b.date)}${s? " ・ "+pad(s.no):""}</div></div>
      <div class="row">
        <button class="btn sec sm" data-eb="${b.id}">編輯</button>
        <button class="btn sec sm" data-db="${b.id}">刪除</button>
      </div>
    </div>`;
  }).join("")}</div>`;
  $$("[data-eb]").forEach(b => b.onclick = () => editBehavior(b.dataset.eb));
  $$("[data-db]").forEach(b => b.onclick = () => {
    if (!confirm("刪除此記錄？")) return;
    cls.behaviors = cls.behaviors.filter(x => x.id !== b.dataset.db);
    save(); render();
  });
}

function editBehavior(id) {
  const cls = cur();
  const b = (cls.behaviors||[]).find(x => x.id === id) || {studentId: enrolled(cls)[0]?.id || "", date: today(), text: ""};
  const opts = enrolled(cls).map(s => `<option value="${s.id}" ${s.id===b.studentId?"selected":""}>${pad(s.no)} ${esc(s.name)}</option>`).join("");
  openDlg(`
    <h3>${id ? "編輯行為" : "新增行為"}</h3>
    <div class="field"><label>學生</label><select id="bs">${opts}</select></div>
    <div class="field"><label>日期</label><input type="date" id="bd" value="${esc(b.date||today())}" /></div>
    <div class="field"><label>記錄（自由輸入）</label><textarea id="bt" placeholder="例如：課堂主動答問／欠帶計算機">${esc(b.text)}</textarea></div>
    <div class="actions"><button class="btn sec" data-close>取消</button><button class="btn" id="bsave">儲存</button></div>`);
  $("#bsave").onclick = () => {
    const text = $("#bt").value.trim();
    if (!text) return toast("請寫一句記錄");
    if (!id) cls.behaviors.push({id: uid(), studentId: $("#bs").value, date: $("#bd").value, text});
    else Object.assign(b, {studentId: $("#bs").value, date: $("#bd").value, text});
    save(); $("#dlg").close(); render();
  };
}

function renderStudents() {
  const cls = needClass("學生");
  if (!cls) return;
  $("#pageTitle").textContent = "班別與學生";
  $("#pageSub").textContent = `${cls.name} ・ ${enrolled(cls).length} 人在學`;
  $("#topActions").innerHTML = classPicker(`
    <button class="btn sec sm" id="editCls">編輯班別</button>
    <button class="btn sec sm" id="pasteStu">批量貼上</button>
    <button class="btn sm" id="addStu">＋ 學生</button>`);
  $("#classSel").onchange = e => setClass(e.target.value);
  $("#editCls").onclick = () => editClass(cls.id);
  $("#pasteStu").onclick = pasteStudents;
  $("#addStu").onclick = () => editStudent();

  const list = [...cls.students].sort((a,b)=>a.no-b.no);
  $("#app").innerHTML = `<div class="card">
    ${list.length ? list.map(s => `<div class="item">
      <div>${pad(s.no)} ${esc(s.name)}
        <div class="muted">${esc(s.gender||"—")} ・ ${s.enrolled!==false?"在學":"離班"} ・ 欠交 ${missCount(cls,s.id)} 次${s.phone?" ・ "+esc(s.phone):""}${s.note?" ・ "+esc(s.note):""}</div>
      </div>
      <div class="row">
        <button class="btn sec sm" data-es="${s.id}">編輯</button>
        <button class="btn sec sm" data-ds="${s.id}">刪除</button>
      </div>
    </div>`).join("") : `<div class="empty">未有學生。用「批量貼上」最快。</div>`}
  </div>`;
  $$("[data-es]").forEach(b => b.onclick = () => editStudent(b.dataset.es));
  $$("[data-ds]").forEach(b => b.onclick = () => {
    if (!confirm("刪除此學生？相關行為仍會保留顯示名稱為已刪除。")) return;
    cls.students = cls.students.filter(s => s.id !== b.dataset.ds);
    save(); render();
  });
}

function editStudent(id) {
  const cls = cur();
  const s = cls.students.find(x => x.id === id) || {no: (cls.students.length+1), name:"", gender:"", enrolled:true, phone:"", note:""};
  openDlg(`
    <h3>${id?"編輯學生":"新增學生"}</h3>
    <div class="field"><label>座號</label><input id="sn" type="number" value="${esc(s.no)}" /></div>
    <div class="field"><label>姓名</label><input id="sname" value="${esc(s.name)}" /></div>
    <div class="field"><label>性別</label>
      <select id="sg"><option value="">—</option><option ${s.gender==="男"?"selected":""}>男</option><option ${s.gender==="女"?"selected":""}>女</option></select>
    </div>
    <div class="field"><label>在學</label>
      <select id="se"><option value="1" ${s.enrolled!==false?"selected":""}>在學</option><option value="0" ${s.enrolled===false?"selected":""}>離班</option></select>
    </div>
    <div class="field"><label>家長電話</label><input id="sp" value="${esc(s.phone)}" /></div>
    <div class="field"><label>備註</label><input id="snote" value="${esc(s.note)}" /></div>
    <div class="actions"><button class="btn sec" data-close>取消</button><button class="btn" id="ss">儲存</button></div>`);
  $("#ss").onclick = () => {
    const name = $("#sname").value.trim();
    if (!name) return toast("請填姓名");
    const data = {no: Number($("#sn").value)||1, name, gender: $("#sg").value, enrolled: $("#se").value==="1", phone: $("#sp").value.trim(), note: $("#snote").value.trim()};
    if (id) Object.assign(s, data);
    else cls.students.push({id: uid(), ...data});
    save(); $("#dlg").close(); render();
  };
}

function pasteStudents() {
  const cls = cur();
  openDlg(`
    <h3>批量貼上名單</h3>
    <p class="muted">每行一人。可用「座號 姓名 性別 電話」，或只貼姓名。</p>
    <textarea id="pt" placeholder="1 陳大文 男 91234567\n2 李嘉欣 女"></textarea>
    <div class="field" style="margin-top:10px">
      <label><input type="checkbox" id="replace" /> 取代現有名單（否則加在後面）</label>
    </div>
    <div class="actions"><button class="btn sec" data-close>取消</button><button class="btn" id="pok">匯入</button></div>`);
  $("#pok").onclick = () => {
    const rows = parseRoster($("#pt").value);
    if (!rows.length) return toast("沒有可匯入的列");
    if ($("#replace").checked) cls.students = rows;
    else {
      const start = cls.students.length;
      rows.forEach((r,i) => { if (!/^\d+/.test(String(r.no))) r.no = start+i+1; });
      cls.students.push(...rows);
    }
    save(); $("#dlg").close(); render(); toast("已匯入 "+rows.length+" 人");
  };
}

function renderSettings() {
  $("#pageTitle").textContent = "設定";
  $("#pageSub").textContent = "本機儲存 ・ 可匯出備份";
  $("#topActions").innerHTML = "";
  $("#app").innerHTML = `
    <div class="grid">
      <div class="card">
        <h3>班別</h3>
        ${(state.classes||[]).map(c => `<div class="item"><div>${esc(c.name)}<div class="muted">${esc(c.year||"")} ・ ${c.students.length} 人</div></div>
          <div class="row"><button class="btn sec sm" data-ec="${c.id}">編輯</button><button class="btn sec sm" data-dc="${c.id}">刪除班</button></div></div>`).join("") || "<div class='muted'>未有班別</div>"}
        <div class="row" style="margin-top:12px"><button class="btn" id="nc">＋ 新增班別</button></div>
      </div>
      <div class="card">
        <h3>示範資料</h3>
        <p class="muted">載入中四E、中五A 示範班，含功課與可編輯的行為記錄。不會刪你現有班別。</p>
        <button class="btn sec" id="ld">載入示範資料</button>
      </div>
      <div class="card">
        <h3>備份</h3>
        <div class="row">
          <button class="btn" id="ex">匯出 JSON</button>
          <button class="btn sec" id="im">匯入 JSON</button>
        </div>
        <input type="file" id="file" accept="application/json" hidden />
      </div>
      <div class="card">
        <h3>顯示</h3>
        <button class="btn sec" id="th">${state.theme==="dark"?"改回淺色":"改用深色"}</button>
      </div>
      <div class="card">
        <h3>危險操作</h3>
        <button class="btn warn" id="wipe">清除本機全部資料</button>
      </div>
    </div>`;
  $("#nc").onclick = promptNewClass;
  $("#ld").onclick = loadDemo;
  $$("[data-ec]").forEach(b => b.onclick = () => editClass(b.dataset.ec));
  $$("[data-dc]").forEach(b => b.onclick = () => {
    if (!confirm("刪除此班及所有功課／行為？")) return;
    state.classes = state.classes.filter(c => c.id !== b.dataset.dc);
    if (state.currentClassId === b.dataset.dc) state.currentClassId = state.classes[0]?.id || null;
    save(); render();
  });
  $("#ex").onclick = exportJson;
  $("#im").onclick = () => $("#file").click();
  $("#file").onchange = importJson;
  $("#th").onclick = () => { state.theme = state.theme==="dark"?"light":"dark"; save(); render(); };
  $("#wipe").onclick = () => {
    if (!confirm("確定清除？請先匯出備份。")) return;
    state = emptyState(); save(); render();
  };
}

function promptNewClass() {
  openDlg(`<h3>新增班別</h3>
    <div class="field"><label>班名</label><input id="cn" placeholder="例如 中四E" /></div>
    <div class="field"><label>學年</label><input id="cy" value="2025-2026" /></div>
    <div class="field"><label>備註</label><input id="cnote" /></div>
    <div class="actions"><button class="btn sec" data-close>取消</button><button class="btn" id="cs">建立</button></div>`);
  $("#cs").onclick = () => {
    const name = $("#cn").value.trim();
    if (!name) return toast("請填班名");
    const c = {id: uid(), name, year: $("#cy").value.trim(), note: $("#cnote").value.trim(), students: [], homeworks: [], behaviors: []};
    state.classes.push(c);
    state.currentClassId = c.id;
    save(); $("#dlg").close(); go("students");
  };
}
function editClass(id) {
  const c = state.classes.find(x => x.id === id);
  openDlg(`<h3>編輯班別</h3>
    <div class="field"><label>班名</label><input id="cn" value="${esc(c.name)}" /></div>
    <div class="field"><label>學年</label><input id="cy" value="${esc(c.year||"")}" /></div>
    <div class="field"><label>備註</label><input id="cnote" value="${esc(c.note||"")}" /></div>
    <div class="actions"><button class="btn sec" data-close>取消</button><button class="btn" id="cs">儲存</button></div>`);
  $("#cs").onclick = () => {
    c.name = $("#cn").value.trim() || c.name;
    c.year = $("#cy").value.trim();
    c.note = $("#cnote").value.trim();
    save(); $("#dlg").close(); render();
  };
}

function loadDemo() {
  const demos = demoData();
  demos.forEach(d => state.classes.push(d));
  state.currentClassId = demos[0].id;
  save(); go("home"); toast("已載入示範班（含可編輯行為）");
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {type: "application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "banwu-backup-" + today() + ".json";
  a.click();
}
function importJson(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (!data.classes) throw new Error("格式不對");
      state = data;
      save(); render(); toast("已匯入");
    } catch { toast("匯入失敗"); }
  };
  r.readAsText(f);
  e.target.value = "";
}

function needClass(title) {
  $("#pageTitle").textContent = title;
  if (!state.classes.length) {
    $("#pageSub").textContent = "請先建立班別";
    $("#topActions").innerHTML = "";
    $("#app").innerHTML = `<div class="card empty"><button class="btn" id="n">新增班別</button> <button class="btn sec" id="d">載入示範</button></div>`;
    $("#n").onclick = promptNewClass;
    $("#d").onclick = loadDemo;
    return null;
  }
  if (!cur()) { setClass(state.classes[0].id); return null; }
  return cur();
}

function render() {
  document.documentElement.dataset.theme = state.theme;
  $("#btnTheme").textContent = state.theme === "dark" ? "淺色模式" : "深色模式";
  ({home: renderHome, homework: renderHomework, behavior: renderBehavior, students: renderStudents, settings: renderSettings}[view] || renderHome)();
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
save();
render();
