/**
 * script.js - DeepGuard Deepfake Detection Frontend
 * Features: Login, per-user localStorage history, sidebar dashboard,
 *           drag-drop upload, Cropper.js, FastAPI detect, toast alerts.
 */

// CONFIG
const API_URL     = "http://localhost:8000/predict";
const STORAGE_KEY = (name) => "dg_hist_" + name.trim().toLowerCase().replace(/\s+/g, "_");
const MAX_HIST    = 60;

// STATE
let currentUser    = null;
let history_data   = [];
let currentFile    = null;
let currentDataURL = null;
let cropper        = null;
let sidebarOpen    = false;
let toastTimer     = null;

// DOM - Login
const loginPage  = document.getElementById("login-page");
const usernameIn = document.getElementById("username-input");
const loginBtn   = document.getElementById("login-btn");

// DOM - App
const appEl      = document.getElementById("app");
const userAvatar = document.getElementById("user-avatar");
const userLabel  = document.getElementById("user-name-label");
const logoutBtn  = document.getElementById("logout-btn");

// DOM - Sidebar
const sidebar     = document.getElementById("sidebar");
const hamburger   = document.getElementById("sidebar-toggle");
const sbOverlay   = document.getElementById("sb-overlay");
const sbUserName  = document.getElementById("sb-user-name");
const statTotal   = document.getElementById("stat-total");
const statReal    = document.getElementById("stat-real");
const statFake    = document.getElementById("stat-fake");
const dashGrid    = document.getElementById("dash-grid");
const dashEmpty   = document.getElementById("dash-empty");
const clearAllBtn = document.getElementById("clear-all-btn");

// DOM - Sidebar Tabs
const tabDashboard   = document.getElementById("tab-dashboard");
const tabHistory     = document.getElementById("tab-history");
const panelDashboard = document.getElementById("panel-dashboard");
const panelHistory   = document.getElementById("panel-history");
const sbHistList     = document.getElementById("sb-hist-list");
const sbHistEmpty    = document.getElementById("sb-hist-empty");
const sbClearHistBtn = document.getElementById("sb-clear-hist-btn");
const arrowDash      = document.getElementById("arrow-dashboard");

// DOM - Upload
const dropZone        = document.getElementById("drop-zone");
const fileInput       = document.getElementById("file-input");
const previewWrap     = document.getElementById("preview-wrap");
const previewImg      = document.getElementById("preview-img");
const clearImgBtn     = document.getElementById("clear-img-btn");
const fileInfo        = document.getElementById("file-info");
const detectBtn       = document.getElementById("detect-btn");
const detectText      = detectBtn.querySelector(".detect-text");
const detectSpinnerEl = detectBtn.querySelector(".detect-spinner");

// DOM - Result
const resultPh    = document.getElementById("result-placeholder");
const resultBody  = document.getElementById("result-body");
const resultBadge = document.getElementById("result-badge");
const resultLabel = document.getElementById("result-label");
const resultDesc  = document.getElementById("result-desc");
const confPct     = document.getElementById("conf-pct");
const confBar     = document.getElementById("conf-bar");
const reasonBlock = document.getElementById("reason-block");
const reasonText  = document.getElementById("result-reason");
const metaModel   = document.getElementById("meta-model");
const metaDec     = document.getElementById("meta-decision");
const againBtn    = document.getElementById("again-btn");

// DOM - History
const histList  = document.getElementById("history-list");
const histEmpty = document.getElementById("hist-empty");
const clearHist = document.getElementById("clear-hist-btn");

// DOM - Toast
const toastEl = document.getElementById("toast");

// ─── TOAST ────────────────────────────────────────────────────────────────────
function showToast(msg, type, dur) {
  type = type || "info";
  dur  = dur  || 3500;
  if (toastTimer) clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.className   = "toast show t-" + type;
  toastTimer = setTimeout(function() { toastEl.classList.remove("show"); }, dur);
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function doLogin() {
  var name = usernameIn.value.trim();
  if (!name) {
    usernameIn.classList.add("shake");
    setTimeout(function() { usernameIn.classList.remove("shake"); }, 500);
    usernameIn.focus();
    return;
  }
  currentUser  = name;
  history_data = loadHistory(name);
  userAvatar.textContent = name.charAt(0).toUpperCase();
  userLabel.textContent  = name;
  if (sbUserName) sbUserName.textContent = name;
  loginPage.classList.add("fade-out");
  setTimeout(function() {
    loginPage.classList.add("hidden");
    appEl.classList.remove("hidden");
    initSidebarMode();
    renderDashboard();
    renderHistory();
    renderSidebarHistory();
    showToast("Welcome, " + name + "!", "success");
  }, 380);
}

function doLogout() {
  currentUser  = null;
  history_data = [];
  clearUpload();
  appEl.classList.add("hidden");
  loginPage.classList.remove("hidden");
  loginPage.classList.remove("fade-out");
  usernameIn.value = "";
  closeSidebar();
  setTimeout(function() { usernameIn.focus(); }, 100);
}

loginBtn.addEventListener("click", doLogin);
usernameIn.addEventListener("keydown", function(e) { if (e.key === "Enter") doLogin(); });
logoutBtn.addEventListener("click", doLogout);

// ─── LOCAL STORAGE ────────────────────────────────────────────────────────────
function loadHistory(name) {
  try {
    var raw = localStorage.getItem(STORAGE_KEY(name));
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

function saveHistory(name, data) {
  try {
    localStorage.setItem(STORAGE_KEY(name), JSON.stringify(data.slice(0, MAX_HIST)));
  } catch(e) {
    console.warn("[DeepGuard] localStorage save failed:", e);
  }
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function initSidebarMode() {
  if (window.innerWidth >= 960) {
    sidebar.classList.remove("sb-closed");
    sidebar.classList.remove("sb-open");
    sidebarOpen = true;
  } else {
    sidebar.classList.remove("sb-open");
    sidebar.classList.add("sb-closed");
    if (sbOverlay) sbOverlay.classList.add("hidden");
    sidebarOpen = false;
  }
}

function openSidebar() {
  sidebarOpen = true;
  if (window.innerWidth < 960) {
    sidebar.classList.add("sb-open");
    if (sbOverlay) sbOverlay.classList.remove("hidden");
  } else {
    sidebar.classList.remove("sb-closed");
  }
}

function closeSidebar() {
  sidebarOpen = false;
  if (window.innerWidth < 960) {
    sidebar.classList.remove("sb-open");
    if (sbOverlay) sbOverlay.classList.add("hidden");
  } else {
    sidebar.classList.add("sb-closed");
  }
}

hamburger.addEventListener("click", function() { sidebarOpen ? closeSidebar() : openSidebar(); });
if (sbOverlay) sbOverlay.addEventListener("click", closeSidebar);
window.addEventListener("resize", function() { if (currentUser) initSidebarMode(); });

// ─── SIDEBAR TABS ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  if (tab === "dashboard") {
    if (tabDashboard)   tabDashboard.classList.add("active");
    if (tabHistory)     tabHistory.classList.remove("active");
    if (panelDashboard) panelDashboard.classList.remove("hidden");
    if (panelHistory)   panelHistory.classList.add("hidden");
    closeHistoryPage();
  } else {
    if (tabDashboard)   tabDashboard.classList.remove("active");
    if (tabHistory)     tabHistory.classList.add("active");
    if (panelDashboard) panelDashboard.classList.add("hidden");
    if (panelHistory)   panelHistory.classList.remove("hidden");
    renderSidebarHistory();
    openHistoryPage();
  }
}

if (tabDashboard) tabDashboard.addEventListener("click", function() { switchTab("dashboard"); });
if (tabHistory)   tabHistory.addEventListener("click",   function() { switchTab("history"); });

// ─── HISTORY FULL PAGE ────────────────────────────────────────────────────────
var mainDetect = document.getElementById("main-detect");
var histPage   = document.getElementById("hist-page");
var hpGrid     = document.getElementById("hp-grid");
var hpEmpty    = document.getElementById("hp-empty");
var hpSubtitle = document.getElementById("hp-subtitle");
var hpClearBtn = document.getElementById("hp-clear-btn");
var hpBackBtn  = document.getElementById("hp-back-btn");
var hpGoDetect = document.getElementById("hp-go-detect");
var hpFilters  = document.querySelectorAll(".hp-filter");

var activeFilter = "all";

function openHistoryPage() {
  if (!mainDetect || !histPage) return;
  mainDetect.classList.add("hidden");
  histPage.classList.remove("hidden");
  renderHistoryPage();
}

function closeHistoryPage() {
  if (!histPage || !mainDetect) return;
  histPage.classList.add("hidden");
  mainDetect.classList.remove("hidden");
}

function renderHistoryPage() {
  if (!hpSubtitle || !hpGrid || !hpEmpty) return;
  var count = history_data.length;
  hpSubtitle.textContent = count + " scan" + (count !== 1 ? "s" : "") + " for " + (currentUser || "you");
  var filtered = activeFilter === "all"
    ? history_data
    : history_data.filter(function(e) { return e.prediction === activeFilter; });
  Array.from(hpGrid.children).forEach(function(c) { if (c.id !== "hp-empty") c.remove(); });
  if (filtered.length === 0) { hpEmpty.style.display = ""; return; }
  hpEmpty.style.display = "none";
  filtered.forEach(function(entry, i) {
    var cls   = clsFor(entry.prediction);
    var label = entry.prediction;
    var card  = document.createElement("div");
    card.className = "hp-card " + cls;
    card.style.animationDelay = (i * 0.04) + "s";
    var imgSrc = entry.dataURL ? entry.dataURL : "";
    card.innerHTML =
      '<div class="hp-card-img-wrap">' +
        '<img src="' + imgSrc + '" alt="' + escHtml(entry.filename) + '" class="hp-card-img" loading="lazy" />' +
        '<div class="hp-card-badge ' + cls + '">' + label + '</div>' +
      '</div>' +
      '<div class="hp-card-body">' +
        '<div class="hp-card-name" title="' + escHtml(entry.filename) + '">' + escHtml(entry.filename) + '</div>' +
        '<div class="hp-card-conf-row">' +
          '<span class="hp-card-conf-lbl">Confidence</span>' +
          '<span class="hp-card-conf-pct">' + entry.confidence + '%</span>' +
        '</div>' +
        '<div class="hp-card-bar-track">' +
          '<div class="hp-card-bar ' + cls + '" style="width:' + entry.confidence + '%"></div>' +
        '</div>' +
        '<div class="hp-card-meta">' +
          '<span>' + escHtml(entry.model) + '</span>' +
          '<span>' + escHtml(entry.timestamp) + '</span>' +
        '</div>' +
      '</div>';
    hpGrid.appendChild(card);
  });
}

hpFilters.forEach(function(btn) {
  btn.addEventListener("click", function() {
    hpFilters.forEach(function(b) { b.classList.remove("active"); });
    btn.classList.add("active");
    activeFilter = btn.dataset.filter;
    renderHistoryPage();
  });
});

if (hpBackBtn)  hpBackBtn.addEventListener("click",  closeHistoryPage);
if (hpGoDetect) hpGoDetect.addEventListener("click", closeHistoryPage);
if (hpClearBtn) hpClearBtn.addEventListener("click", function() {
  history_data = [];
  if (currentUser) saveHistory(currentUser, []);
  renderDashboard(); renderHistoryPage(); renderSidebarHistory();
  showToast("History cleared.", "info");
});

// ─── DASHBOARD RENDER ─────────────────────────────────────────────────────────
function renderDashboard() {
  var total     = history_data.length;
  var realCount = history_data.filter(function(e) { return e.prediction === "Real"; }).length;
  var fakeCount = history_data.filter(function(e) { return e.prediction === "Fake"; }).length;
  if (statTotal) statTotal.textContent = total;
  if (statReal)  statReal.textContent  = realCount;
  if (statFake)  statFake.textContent  = fakeCount;
  if (dashGrid) {
    Array.from(dashGrid.children).forEach(function(c) { if (c.id !== "dash-empty") c.remove(); });
    if (total === 0) {
      if (dashEmpty) dashEmpty.style.display = "";
    } else {
      if (dashEmpty) dashEmpty.style.display = "none";
      history_data.slice(0, 4).forEach(function(entry) {
        var cls  = clsFor(entry.prediction);
        var mini = document.createElement("div");
        mini.className = "dash-mini-card " + cls;
        var imgSrc = entry.dataURL ? entry.dataURL : "";
        mini.innerHTML =
          '<img src="' + imgSrc + '" alt="' + escHtml(entry.filename) + '" loading="lazy" />' +
          '<span class="dash-mini-pill ' + cls + '">' + entry.prediction + '</span>';
        dashGrid.appendChild(mini);
      });
    }
  }
}

// ─── SIDEBAR HISTORY RENDER ───────────────────────────────────────────────────
function renderSidebarHistory() {
  if (!sbHistList) return;
  Array.from(sbHistList.children).forEach(function(c) { if (c.id !== "sb-hist-empty") c.remove(); });
  if (history_data.length === 0) { if (sbHistEmpty) sbHistEmpty.style.display = ""; return; }
  if (sbHistEmpty) sbHistEmpty.style.display = "none";
  history_data.forEach(function(entry) {
    var cls  = clsFor(entry.prediction);
    var item = document.createElement("div");
    item.className = "sb-hist-item";
    var imgSrc = entry.dataURL ? entry.dataURL : "";
    item.innerHTML =
      '<img class="sb-hist-thumb" src="' + imgSrc + '" alt="thumb" loading="lazy" />' +
      '<div class="sb-hist-info">' +
        '<div class="sb-hist-name">' + escHtml(entry.filename) + '</div>' +
        '<div class="sb-hist-meta">' + entry.confidence + '% . ' + escHtml(entry.timestamp) + '</div>' +
      '</div>' +
      '<span class="sb-hist-pill ' + cls + '">' + entry.prediction + '</span>';
    sbHistList.appendChild(item);
  });
}

if (sbClearHistBtn) sbClearHistBtn.addEventListener("click", function() {
  history_data = [];
  if (currentUser) saveHistory(currentUser, []);
  renderHistory(); renderDashboard(); renderSidebarHistory();
  showToast("History cleared.", "info");
});

// ─── HISTORY INLINE LIST ──────────────────────────────────────────────────────
function renderHistory() {
  if (!histList) return;
  histList.innerHTML = "";
  if (history_data.length === 0) { if (histEmpty) histList.appendChild(histEmpty); return; }
  history_data.forEach(function(entry) {
    var cls  = clsFor(entry.prediction);
    var item = document.createElement("div");
    item.className = "hist-item";
    var imgSrc = entry.dataURL ? entry.dataURL : "";
    item.innerHTML =
      '<img class="hist-thumb" src="' + imgSrc + '" alt="thumb" loading="lazy" />' +
      '<div class="hist-info">' +
        '<div class="hist-name">' + escHtml(entry.filename) + '</div>' +
        '<div class="hist-meta">' + escHtml(entry.model) + ' - ' + entry.confidence + '% - ' + escHtml(entry.timestamp) + '</div>' +
      '</div>' +
      '<span class="hist-pill ' + cls + '">' + entry.prediction + '</span>';
    histList.appendChild(item);
  });
}

if (clearHist) clearHist.addEventListener("click", function() {
  history_data = [];
  if (currentUser) saveHistory(currentUser, []);
  renderHistory(); renderDashboard(); renderSidebarHistory();
  showToast("History cleared.", "info");
});

if (clearAllBtn) clearAllBtn.addEventListener("click", function() {
  history_data = [];
  if (currentUser) saveHistory(currentUser, []);
  renderHistory(); renderDashboard(); renderSidebarHistory();
  showToast("All history cleared.", "info");
});

// ─── FILE UPLOAD ──────────────────────────────────────────────────────────────
function loadFile(file) {
  var ALLOWED = ["image/jpeg", "image/png", "image/webp"];
  if (ALLOWED.indexOf(file.type) === -1) {
    showToast("Please upload a JPEG, PNG, or WebP image.", "error");
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    showToast("File is too large. Max 20 MB.", "error");
    return;
  }
  currentFile = file;
  var reader  = new FileReader();
  reader.onload = function(ev) {
    currentDataURL = ev.target.result;
    if (cropper) { cropper.destroy(); cropper = null; }
    previewImg.src = currentDataURL;
    dropZone.classList.add("hidden");
    previewWrap.classList.remove("hidden");
    if (fileInfo) {
      fileInfo.classList.remove("hidden");
      fileInfo.textContent = file.name + " (" + (file.size / 1024).toFixed(1) + " KB)";
    }
    if (detectBtn) detectBtn.disabled = false;
    if (typeof Cropper !== "undefined") {
      cropper = new Cropper(previewImg, {
        aspectRatio: 1,
        viewMode: 1,
        autoCropArea: 0.8,
        movable: true,
        zoomable: true,
        scalable: false,
        cropBoxResizable: true
      });
    }
  };
  reader.readAsDataURL(file);
}

function clearUpload() {
  currentFile = null;
  currentDataURL = null;
  if (cropper) { cropper.destroy(); cropper = null; }
  previewImg.src = "";
  previewWrap.classList.add("hidden");
  if (fileInfo) fileInfo.classList.add("hidden");
  dropZone.classList.remove("hidden");
  if (detectBtn) detectBtn.disabled = true;
  resetResult();
}

function resetResult() {
  if (resultPh)   resultPh.classList.remove("hidden");
  if (resultBody) resultBody.classList.add("hidden");
  if (confBar)    { confBar.style.transition = "none"; confBar.style.width = "0%"; }
}

dropZone.addEventListener("dragover", function(e) { e.preventDefault(); dropZone.classList.add("dz-active"); });
["dragleave", "dragend"].forEach(function(ev) {
  dropZone.addEventListener(ev, function() { dropZone.classList.remove("dz-active"); });
});
dropZone.addEventListener("drop", function(e) {
  e.preventDefault();
  dropZone.classList.remove("dz-active");
  var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) loadFile(f);
});
dropZone.addEventListener("click",   function() { fileInput.click(); });
dropZone.addEventListener("keydown", function(e) { if (e.key === "Enter" || e.key === " ") fileInput.click(); });
fileInput.addEventListener("change", function() { if (fileInput.files[0]) loadFile(fileInput.files[0]); });
clearImgBtn.addEventListener("click", clearUpload);

// ─── DETECTION ────────────────────────────────────────────────────────────────
detectBtn.addEventListener("click", runDetection);

async function runDetection() {
  if (!currentFile) { showToast("Please upload an image first.", "info"); return; }
  detectBtn.disabled = true;
  detectBtn.classList.add("loading");
  if (detectText)      detectText.classList.add("hidden");
  if (detectSpinnerEl) detectSpinnerEl.classList.remove("hidden");
  try {
    var formData = new FormData();
    if (cropper) {
      var blob = await new Promise(function(res) {
        cropper.getCroppedCanvas({ maxWidth: 1024, maxHeight: 1024 })
               .toBlob(function(b) { res(b); }, currentFile.type || "image/jpeg", 0.95);
      });
      formData.append("file", blob, currentFile.name);
      currentDataURL = cropper.getCroppedCanvas({ width: 224, height: 224 })
                               .toDataURL(currentFile.type || "image/jpeg");
    } else {
      formData.append("file", currentFile);
    }
    var res = await fetch(API_URL, { method: "POST", body: formData });
    if (!res.ok) {
      var msg = "Server error (" + res.status + ")";
      try { var j = await res.json(); msg = j.detail || msg; } catch(e2) {}
      throw new Error(msg);
    }
    var data = await res.json();
    if (data.error) throw new Error(data.error);
    showResult(data);
    addToHistory(data);
  } catch(err) {
    var isFetch = err.name === "TypeError" && err.message.indexOf("fetch") !== -1;
    showToast(
      isFetch
        ? "Cannot reach API - please start the FastAPI server on port 8000."
        : err.message,
      "error", 5500
    );
    console.error("[DeepGuard]", err);
  } finally {
    detectBtn.classList.remove("loading");
    if (detectText)      detectText.classList.remove("hidden");
    if (detectSpinnerEl) detectSpinnerEl.classList.add("hidden");
    detectBtn.disabled = false;
  }
}

// ─── SHOW RESULT ──────────────────────────────────────────────────────────────
function showResult(data) {
  var prediction = data.prediction;
  var confidence = data.confidence;
  var model_used = data.model_used;
  var reason     = data.reason;
  var cls = clsFor(prediction);
  var pct = Math.round((confidence || 0) * 100);

  if (resultBadge) { resultBadge.className = "result-badge " + cls; resultBadge.textContent = prediction; }
  if (resultLabel) { resultLabel.className = "result-label " + cls; resultLabel.textContent = prediction; }
  if (resultDesc) {
    if (prediction === "Real") {
      resultDesc.textContent = "This image appears to be an authentic, unmanipulated photograph.";
    } else if (prediction === "Uncertain") {
      resultDesc.textContent = "The model could not make a confident classification.";
    } else {
      resultDesc.textContent = "This image shows signs of AI-generation or digital manipulation.";
    }
  }
  if (reasonBlock && reasonText) {
    if (reason) {
      reasonBlock.classList.remove("hidden");
      reasonBlock.className = "reason-block " + cls;
      reasonText.textContent = reason;
    } else {
      reasonBlock.classList.add("hidden");
    }
  }
  if (confPct) {
    confPct.textContent = pct + "%";
    if (prediction === "Real") {
      confPct.style.color = "var(--green)";
    } else if (prediction === "Uncertain") {
      confPct.style.color = "var(--gold)";
    } else {
      confPct.style.color = "var(--red)";
    }
  }
  if (confBar) {
    confBar.className = "conf-bar " + cls;
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        confBar.style.transition = "width 0.95s cubic-bezier(.4,0,.2,1)";
        confBar.style.width = pct + "%";
      });
    });
  }
  if (metaModel) metaModel.textContent = model_used || "Unknown";
  if (metaDec) {
    metaDec.textContent = prediction;
    if (confPct) metaDec.style.color = confPct.style.color;
  }
  if (resultPh)   resultPh.classList.add("hidden");
  if (resultBody) resultBody.classList.remove("hidden");
  showToast(prediction + " - " + pct + "% confidence", "success");
}

// ─── HISTORY ──────────────────────────────────────────────────────────────────
function addToHistory(data) {
  history_data.unshift({
    filename:   currentFile.name,
    dataURL:    currentDataURL,
    prediction: data.prediction,
    confidence: Math.round((data.confidence || 0) * 100),
    model:      data.model_used || "Unknown",
    timestamp:  new Date().toLocaleString()
  });
  if (currentUser) saveHistory(currentUser, history_data);
  renderHistory();
  renderDashboard();
  renderSidebarHistory();
}

if (againBtn) againBtn.addEventListener("click", clearUpload);

// ─── UTILS ────────────────────────────────────────────────────────────────────
function clsFor(prediction) {
  if (prediction === "Real")      return "real";
  if (prediction === "Uncertain") return "uncertain";
  return "fake";
}

function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;");
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
setTimeout(function() { if (usernameIn) usernameIn.focus(); }, 100);
console.log("[DeepGuard] Ready. API:", API_URL);
