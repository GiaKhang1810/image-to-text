
const HISTORY_KEY  = "billscan_history";
const SERVER_KEY   = "billscan_server_url";
const DEFAULT_URL  = "https://b4lztp3f-8000.asse.devtunnels.ms/";   // Relative URL — hoạt động khi frontend cùng domain với server

/* ─── Server URL helpers ──────────────────────────────────────────── */
function getServerUrl() {
    return localStorage.getItem(SERVER_KEY) || DEFAULT_URL;
}

function saveServerUrl(url) {
    localStorage.setItem(SERVER_KEY, url.trim().replace(/\/$/, ""));
    updateServerBadge();
}

function getOcrEndpoint() {
    const base = getServerUrl();
    if (base === DEFAULT_URL || base.endsWith("/ocr")) return base;
    return base + "/ocr";
}

function getHealthEndpoint() {
    const base = getServerUrl();
    if (base === DEFAULT_URL) return "/health";
    return base.replace(/\/ocr$/, "") + "/health";
}

/* ─── Server badge ────────────────────────────────────────────────── */
function updateServerBadge() {
    const url   = getServerUrl();
    const label = document.getElementById("server-label");
    const dot   = document.getElementById("server-dot");
    if (label) label.textContent = url.length > 30 ? "…" + url.slice(-22) : url;
    if (dot)   dot.className = "status-dot";
    pingServer();
}

async function pingServer() {
    const dot = document.getElementById("server-dot");
    if (!dot) return;
    try {
        const r = await fetch(getHealthEndpoint(), { signal: AbortSignal.timeout(4000) });
        dot.className = "status-dot " + (r.ok ? "online" : "offline");
    } catch {
        dot.className = "status-dot offline";
    }
}

/* ─── Server config modal ─────────────────────────────────────────── */
function showServerModal() {
    document.getElementById("server-overlay").classList.remove("hidden");
    document.getElementById("server-url-input").value = getServerUrl();
    document.getElementById("server-url-input").focus();
}

function hideServerModal() {
    document.getElementById("server-overlay").classList.add("hidden");
}

function saveServerModal() {
    const val = document.getElementById("server-url-input").value.trim();
    if (!val) return;
    saveServerUrl(val);
    hideServerModal();
}

/* ─── History helpers ─────────────────────────────────────────────── */
function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch { return []; }
}

function saveHistory(list) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

function addToHistory(filename, text, parsedItems, thumbDataUrl) {
    const list = loadHistory();
    list.unshift({
        id: Date.now(),
        filename,
        text,
        parsedItems: parsedItems || [],
        thumb: thumbDataUrl || null,
        time: new Date().toLocaleString("vi-VN"),
    });
    if (list.length > 50) list.splice(50);
    saveHistory(list);
}

function clearHistory() {
    if (!confirm("Xóa toàn bộ lịch sử?")) return;
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
}

function deleteHistoryItem(id) {
    const list = loadHistory().filter(i => i.id !== id);
    saveHistory(list);
    renderHistory();
}

function renderHistory() {
    const list = loadHistory();
    const el   = document.getElementById("history-list");
    document.getElementById("history-count").textContent = list.length + " mục";

    if (list.length === 0) {
        el.innerHTML = '<div class="history-empty">Chưa có lịch sử nào</div>';
        return;
    }

    el.innerHTML = list.map(item => `
        <div class="history-item" onclick="openDetail(${item.id})">
            ${item.thumb
                ? `<img class="history-thumb" src="${item.thumb}" alt="" />`
                : `<div class="history-thumb-placeholder">🖼</div>`}
            <div class="history-info">
                <div class="history-filename">${escHtml(item.filename)}</div>
                <div class="history-preview">${escHtml(item.text.slice(0, 80))}${item.text.length > 80 ? "…" : ""}</div>
            </div>
            <div class="history-meta">
                <span class="history-time">${item.time}</span>
                <button class="history-del" onclick="event.stopPropagation(); deleteHistoryItem(${item.id})">✕ xóa</button>
            </div>
        </div>
    `).join("");
}

function escHtml(str) {
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/* ─── Detail modal ────────────────────────────────────────────────── */
function openDetail(id) {
    const item = loadHistory().find(i => i.id === id);
    if (!item) return;
    document.getElementById("detail-title").textContent = item.filename;
    document.getElementById("detail-text").textContent  = item.text;
    document.getElementById("detail-overlay").classList.add("open");
}

function closeDetail(e) {
    if (e && e.target !== document.getElementById("detail-overlay")) return;
    document.getElementById("detail-overlay").classList.remove("open");
}

function copyDetail() {
    navigator.clipboard.writeText(document.getElementById("detail-text").textContent).then(() => {
        const btn = document.querySelector(".detail-btn");
        const orig = btn.textContent;
        btn.textContent = "✓ Đã sao chép";
        setTimeout(() => btn.textContent = orig, 2000);
    });
}

/* ─── Navigation ──────────────────────────────────────────────────── */
function showScreen(name) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".sidebar-item").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".nav-btn").forEach(s => s.classList.remove("active"));
    document.getElementById("screen-" + name).classList.add("active");
    document.getElementById("sb-" + name).classList.add("active");
    document.getElementById("nav-" + name).classList.add("active");
    if (name === "history") renderHistory();
}

/* ─── Tabs ────────────────────────────────────────────────────────── */
function switchTab(name) {
    document.querySelectorAll(".result-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".result-panel").forEach(p => p.classList.remove("active"));
    document.getElementById("tab-" + name).classList.add("active");
    document.getElementById("panel-" + name).classList.add("active");
}

/* ─── File handling ───────────────────────────────────────────────── */
let selectedFile = null;
let thumbDataUrl  = null;

const dropzone  = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");

dropzone.addEventListener("dragover",  e => { e.preventDefault(); dropzone.classList.add("drag-over"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
dropzone.addEventListener("drop", e => {
    e.preventDefault();
    dropzone.classList.remove("drag-over");
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

function handleFile(file) {
    if (file.size > 10 * 1024 * 1024) { showError("File quá lớn. Tối đa 10MB."); return; }
    selectedFile = file;
    thumbDataUrl = null;
    document.getElementById("file-name").textContent      = file.name;
    document.getElementById("file-box").style.display     = "flex";
    document.getElementById("scan-btn").disabled          = false;
    document.getElementById("result").style.display       = "none";
    hideError();

    if (file.type.startsWith("image/")) {
        document.getElementById("preview-img").src            = URL.createObjectURL(file);
        document.getElementById("preview-wrap").style.display = "block";
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const scale  = Math.min(80 / img.width, 80 / img.height, 1);
                canvas.width  = img.width  * scale;
                canvas.height = img.height * scale;
                canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                thumbDataUrl = canvas.toDataURL("image/jpeg", 0.6);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    } else {
        document.getElementById("preview-wrap").style.display = "none";
    }
}

function removeFile() {
    selectedFile = null; thumbDataUrl = null;
    fileInput.value = "";
    document.getElementById("file-box").style.display     = "none";
    document.getElementById("preview-wrap").style.display = "none";
    document.getElementById("scan-btn").disabled          = true;
    document.getElementById("result").style.display       = "none";
    hideError();
}

/* ─── OCR — gọi FastAPI server ────────────────────────────────────── */
async function runOCR() {
    if (!selectedFile) return;
    setLoading(true);
    hideError();

    // Hiện skeleton trong lúc chờ
    document.getElementById("parsed-content").innerHTML = `
        <div class="skeleton w80"></div>
        <div class="skeleton w60"></div>
        <div class="skeleton w45"></div>`;
    document.getElementById("result").style.display = "block";

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
        const res = await fetch(getOcrEndpoint(), { method: "POST", body: formData });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(err.detail || "HTTP " + res.status);
        }

        const data = await res.json();
        const text  = data.text  || "(Không nhận ra văn bản)";
        const items = Array.isArray(data.items) ? data.items : [];

        document.getElementById("raw-text").textContent = text;
        renderParsedTable(items, data.tong || "", data.ngay_hoadon || "");
        document.getElementById("result").style.display = "block";
        switchTab("table");
        document.getElementById("result").scrollIntoView({ behavior: "smooth", block: "start" });

        addToHistory(selectedFile.name, text, items, thumbDataUrl);

    } catch (err) {
        document.getElementById("result").style.display = "none";
        const isNetwork = err.message.includes("fetch") || err.message.includes("Failed") || err.message.includes("NetworkError");
        showError(isNetwork
            ? "Không kết nối được server tại: " + getOcrEndpoint() + ". Kiểm tra server đang chạy."
            : "Lỗi: " + err.message
        );
    } finally {
        setLoading(false);
    }
}

/* ─── Render bảng kết quả ─────────────────────────────────────────── */
function renderParsedTable(items, tong, ngay_hoadon) {
    const container = document.getElementById("parsed-content");

    let summary = "";
    if (ngay_hoadon) {
        summary = `<div style="font-size:.75rem;color:var(--gray);margin-bottom:10px">
            📅 Ngày hóa đơn: <strong style="color:var(--black)">${escHtml(ngay_hoadon)}</strong>
        </div>`;
    }

    if (!items.length) {
        container.innerHTML = summary + `<div class="parsed-empty">⚠ Không tìm thấy mặt hàng nào. Xem tab "Văn bản gốc" để kiểm tra.</div>`;
        return;
    }

    const rows = items.map((item, i) => `
        <tr>
            <td><span style="color:var(--gray);font-size:.72rem;font-weight:700">${i + 1}</span></td>
            <td><span class="badge-mon">${escHtml(item.mon || "—")}</span></td>
            <td><span class="badge-gia">${escHtml(item.gia || "—")}</span></td>
            <td style="color:var(--gray);font-size:.78rem">${escHtml(item.ngay || "—")}</td>
        </tr>`).join("");

    const totRow = tong ? `
        <tr style="background:var(--blue-light)">
            <td colspan="2" style="font-weight:800;font-size:.8rem;color:var(--blue)">TỔNG CỘNG</td>
            <td colspan="2"><span class="badge-gia" style="background:#c8e6c9">${escHtml(tong)}</span></td>
        </tr>` : "";

    container.innerHTML = summary + `
        <table class="parsed-table">
            <thead><tr>
                <th style="width:32px">#</th>
                <th>Tên món</th><th>Giá tiền</th><th>Ngày</th>
            </tr></thead>
            <tbody>${rows}${totRow}</tbody>
        </table>`;
}

/* ─── Helpers ─────────────────────────────────────────────────────── */
function setLoading(on) {
    const btn = document.getElementById("scan-btn");
    btn.disabled    = on;
    btn.textContent = on ? "⏳  Đang xử lý..." : "⬡  Quét & Phân Tích";
}

function showError(msg) {
    const el = document.getElementById("error-box");
    el.textContent   = "⚠ " + msg;
    el.style.display = "block";
}

function hideError() {
    document.getElementById("error-box").style.display = "none";
}

function copyText() {
    navigator.clipboard.writeText(document.getElementById("raw-text").textContent).then(() => {
        const btn = document.querySelector(".action-btn");
        const orig = btn.textContent;
        btn.textContent = "✓ Đã sao chép";
        setTimeout(() => btn.textContent = orig, 2000);
    });
}

function exportCSV() {
    const history = loadHistory();
    const latest  = history[0];
    let csv = "\uFEFF\"#\",\"Tên món\",\"Giá tiền\",\"Ngày\"\n";
    if (latest?.parsedItems?.length) {
        latest.parsedItems.forEach((item, i) => {
            csv += [i+1, item.mon||"", item.gia||"", item.ngay||""]
                .map(v => `"${String(v).replace(/"/g,'""')}"`)
                .join(",") + "\n";
        });
    } else {
        const raw = document.getElementById("raw-text").textContent;
        csv += `"1","${raw.replace(/"/g,'""')}","",""\n`;
    }
    const a = document.createElement("a");
    a.href     = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "billscan_" + Date.now() + ".csv";
    a.click();
}

function resetAll() {
    removeFile();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ─── Init ────────────────────────────────────────────────────────── */
window.addEventListener("DOMContentLoaded", () => {
    updateServerBadge();
    setInterval(pingServer, 15000);

    document.getElementById("server-url-input")?.addEventListener("keydown", e => {
        if (e.key === "Enter") saveServerModal();
        if (e.key === "Escape") hideServerModal();
    });
});
