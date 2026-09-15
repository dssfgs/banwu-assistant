const CLOUD_KEY = "banwu-cloud-v1";
const DRIVE_NAME = "班務助手-備份.json";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

let cloud = loadCloud();
let tokenClient = null;
let accessToken = "";
let tokenExp = 0;
let backupTimer = null;
let backingUp = false;

function loadCloud() {
  try { return JSON.parse(localStorage.getItem(CLOUD_KEY) || "{}"); }
  catch { return {}; }
}
function saveCloud() {
  localStorage.setItem(CLOUD_KEY, JSON.stringify(cloud));
}
function gisReady() {
  return !!(window.google && google.accounts && google.accounts.oauth2);
}
function initTokenClient() {
  if (!gisReady() || !cloud.clientId) return null;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: cloud.clientId.trim(),
    scope: DRIVE_SCOPE,
    callback: (resp) => {
      if (resp && resp.access_token) {
        accessToken = resp.access_token;
        tokenExp = Date.now() + ((Number(resp.expires_in) || 3500) * 1000);
        cloud.connected = true;
        saveCloud();
        toast("已連接 Google Drive");
        if (typeof render === "function" && view === "settings") render();
      } else toast("授權未完成");
    }
  });
  return tokenClient;
}
function needToken() {
  return new Promise((resolve, reject) => {
    if (accessToken && Date.now() < tokenExp - 15000) return resolve(accessToken);
    if (!gisReady()) return reject(new Error("未載入 Google 登入元件，請檢查網絡後重新整理"));
    if (!cloud.clientId) return reject(new Error("請先貼上 Client ID"));
    initTokenClient();
    if (!tokenClient) return reject(new Error("無法初始化登入"));
    const prev = tokenClient.callback;
    tokenClient.callback = (resp) => {
      tokenClient.callback = prev;
      if (resp && resp.access_token) {
        accessToken = resp.access_token;
        tokenExp = Date.now() + ((Number(resp.expires_in) || 3500) * 1000);
        cloud.connected = true;
        saveCloud();
        resolve(accessToken);
      } else reject(new Error(resp?.error || "授權失敗"));
    };
    tokenClient.requestAccessToken({ prompt: accessToken ? "" : "consent" });
  });
}
async function driveFetch(url, opts = {}) {
  const tok = await needToken();
  const res = await fetch(url, { ...opts, headers: Object.assign({ Authorization: "Bearer " + tok }, opts.headers || {}) });
  if (!res.ok) {
    const t = await res.text();
    throw new Error("Drive " + res.status + " " + t.slice(0, 180));
  }
  return res;
}
async function findBackupFile() {
  const q = encodeURIComponent("name='" + DRIVE_NAME + "' and trashed=false");
  const res = await driveFetch("https://www.googleapis.com/drive/v3/files?spaces=drive&fields=files(id,name,modifiedTime)&q=" + q);
  const data = await res.json();
  const f = (data.files || [])[0];
  if (f) { cloud.fileId = f.id; cloud.modifiedTime = f.modifiedTime; saveCloud(); }
  return f || null;
}
async function createBackupFile(payload) {
  const meta = { name: DRIVE_NAME, mimeType: "application/json" };
  const body = new FormData();
  body.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  body.append("file", new Blob([payload], { type: "application/json" }));
  const res = await driveFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime", { method: "POST", body });
  return res.json();
}
async function updateBackupFile(id, payload) {
  const res = await driveFetch("https://www.googleapis.com/upload/drive/v3/files/" + id + "?uploadType=media&fields=id,modifiedTime", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: payload
  });
  return res.json();
}
async function downloadBackup(id) {
  const res = await driveFetch("https://www.googleapis.com/drive/v3/files/" + id + "?alt=media");
  return res.json();
}
function payloadNow() {
  return JSON.stringify(Object.assign({}, state, { _banwuCloud: { savedAt: new Date().toISOString() } }), null, 2);
}
async function backupNow(quiet) {
  if (backingUp) return;
  if (!cloud.clientId || !cloud.auto) return;
  backingUp = true;
  try {
    const body = payloadNow();
    let f = cloud.fileId ? { id: cloud.fileId } : await findBackupFile();
    const out = f && f.id ? await updateBackupFile(f.id, body) : await createBackupFile(body);
    cloud.fileId = out.id || cloud.fileId;
    cloud.modifiedTime = out.modifiedTime || new Date().toISOString();
    cloud.lastOk = new Date().toISOString();
    cloud.lastErr = "";
    saveCloud();
    if (!quiet) toast("已備份到 Drive");
    if (typeof render === "function" && view === "settings") render();
  } catch (e) {
    cloud.lastErr = String(e.message || e);
    saveCloud();
    if (!quiet) toast("備份失敗：" + cloud.lastErr);
  } finally { backingUp = false; }
}
function scheduleBackup() {
  if (!cloud.connected || cloud.auto === false) return;
  clearTimeout(backupTimer);
  backupTimer = setTimeout(() => backupNow(true), 3000);
}
async function restoreNow() {
  try {
    const f = await findBackupFile();
    if (!f) return toast("Drive 尚未有備份檔");
    const data = await downloadBackup(f.id);
    if (!data || !data.classes) throw new Error("雲端檔格式不對");
    if (state.classes && state.classes.length && !confirm("用雲端備份覆蓋本機資料？")) return;
    delete data._banwuCloud;
    state = data;
    save();
    cloud.fileId = f.id;
    cloud.modifiedTime = f.modifiedTime;
    saveCloud();
    toast("已從 Drive 還原");
    render();
  } catch (e) { toast("還原失敗：" + (e.message || e)); }
}
const _saveOrig = save;
save = function () { _saveOrig(); scheduleBackup(); };
const _rsOrig = renderSettings;
renderSettings = function () {
  _rsOrig();
  const box = document.createElement("div");
  box.className = "card";
  box.style.marginTop = "16px";
  const connected = !!(cloud.connected && cloud.clientId);
  box.innerHTML = `
    <h3>Google Drive 自動備份</h3>
    <p class="muted">登入你的 Google 帳戶後，改動約 3 秒會寫入 Drive 可見檔「${DRIVE_NAME}」。資料只在你的帳戶。</p>
    <div class="field"><label>OAuth Client ID</label>
      <input id="gid" placeholder="xxxx.apps.googleusercontent.com" value="${esc(cloud.clientId || "")}" />
    </div>
    <p class="muted">開 <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud 憑證</a> → 建立「網頁應用程式」OAuth 用戶端。授權 JavaScript 來源填：<br>
    <code>https://dssfgs.github.io</code><br>
    並啟用 <a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noopener">Google Drive API</a>。</p>
    <div class="row">
      <button class="btn" id="gSaveId">儲存 Client ID</button>
      <button class="btn sec" id="gConnect">${connected ? "重新授權" : "連接 Google"}</button>
      <button class="btn sec" id="gBackup">立即備份</button>
      <button class="btn sec" id="gRestore">從雲端還原</button>
    </div>
    <div class="field" style="margin-top:12px">
      <label><input type="checkbox" id="gAuto" ${cloud.auto !== false ? "checked" : ""} /> 改動後自動備份</label>
    </div>
    <div class="muted">
      狀態：${connected ? "已連接" : "未連接"}
      ${cloud.lastOk ? "<br>上次成功：" + esc(cloud.lastOk.replace("T", " ").slice(0, 19)) : ""}
      ${cloud.lastErr ? "<br>上次錯誤：" + esc(cloud.lastErr) : ""}
    </div>`;
  $("#app").appendChild(box);
  $("#gSaveId").onclick = () => { cloud.clientId = $("#gid").value.trim(); saveCloud(); initTokenClient(); toast("已儲存 Client ID"); };
  $("#gConnect").onclick = async () => {
    cloud.clientId = $("#gid").value.trim();
    cloud.auto = true;
    saveCloud();
    try {
      await needToken();
      const f = await findBackupFile();
      if (f && (!state.classes || !state.classes.length)) await restoreNow();
      else await backupNow(false);
    } catch (e) { toast(e.message || String(e)); }
    render();
  };
  $("#gBackup").onclick = () => backupNow(false);
  $("#gRestore").onclick = restoreNow;
  $("#gAuto").onchange = () => { cloud.auto = $("#gAuto").checked; saveCloud(); };
};
window.addEventListener("load", () => { if (cloud.clientId) setTimeout(initTokenClient, 600); });
