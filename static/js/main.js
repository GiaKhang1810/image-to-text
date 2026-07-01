"use strict";

(() => {
    const API_PATH = "/image-to-text";
    const UPLOAD_FIELD = "image";
    const HISTORY_KEY = "billscan.history";

    let selectedFile = null;
    let selectedImageDataUrl = "";
    let lastText = "";
    let detailCurrentText = "";

    const $ = (id) => document.getElementById(id);

    const els = {};

    document.addEventListener("DOMContentLoaded", () => {
        cacheElements();
        bindEvents();
        initFixedApiBadge();
        renderHistory();
    });

    function cacheElements() {
        els.serverOverlay = $("server-overlay");
        els.serverLabel = $("server-label");
        els.serverDot = $("server-dot");

        els.dropzone = $("dropzone");
        els.fileInput = $("file-input");
        els.fileBox = $("file-box");
        els.fileName = $("file-name");
        els.previewWrap = $("preview-wrap");
        els.previewImg = $("preview-img");

        els.scanBtn = $("scan-btn");
        els.errorBox = $("error-box");
        els.result = $("result");
        els.resultBadge = $("result-badge");
        els.rawText = $("raw-text");
        els.parsedContent = $("parsed-content");

        els.historyCount = $("history-count");
        els.historyList = $("history-list");

        els.detailOverlay = $("detail-overlay");
        els.detailTitle = $("detail-title");
        els.detailText = $("detail-text");
    }

    function bindEvents() {
        if (els.fileInput) {
            els.fileInput.addEventListener("change", (event) => {
                const file = event.target.files?.[0];
                if (file) setFile(file);
            });
        }

        if (els.dropzone) {
            els.dropzone.addEventListener("dragover", (event) => {
                event.preventDefault();
                els.dropzone.classList.add("drag-over");
            });

            els.dropzone.addEventListener("dragleave", () => {
                els.dropzone.classList.remove("drag-over");
            });

            els.dropzone.addEventListener("drop", (event) => {
                event.preventDefault();
                els.dropzone.classList.remove("drag-over");

                const file = event.dataTransfer.files?.[0];
                if (file) setFile(file);
            });
        }

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") closeDetail();
        });
    }

    function initFixedApiBadge() {
        if (els.serverLabel) {
            els.serverLabel.textContent = API_PATH;
            els.serverLabel.title = API_PATH;
        }

        if (els.serverDot) {
            els.serverDot.classList.remove("online", "offline");
        }

        if (els.serverOverlay) {
            els.serverOverlay.classList.add("hidden");
        }
    }

    function setApiState(state) {
        if (!els.serverDot) return;

        els.serverDot.classList.remove("online", "offline");

        if (state === "online") els.serverDot.classList.add("online");
        if (state === "offline") els.serverDot.classList.add("offline");
    }

    function showError(message) {
        if (!els.errorBox) return;

        els.errorBox.textContent = message || "Có lỗi xảy ra.";
        els.errorBox.style.display = "block";
    }

    function clearError() {
        if (!els.errorBox) return;

        els.errorBox.textContent = "";
        els.errorBox.style.display = "none";
        els.errorBox.style.color = "";
        els.errorBox.style.borderLeftColor = "";
        els.errorBox.style.background = "";
    }

    function setFile(file) {
        clearError();

        if (!file.type.startsWith("image/")) {
            showError("Vui lòng chọn file ảnh JPG, PNG hoặc WEBP.");
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            showError("Ảnh vượt quá 10 MB. Vui lòng chọn ảnh nhỏ hơn.");
            return;
        }

        selectedFile = file;

        if (els.fileName) els.fileName.textContent = file.name;
        if (els.fileBox) els.fileBox.style.display = "flex";
        if (els.scanBtn) els.scanBtn.disabled = false;

        const reader = new FileReader();

        reader.onload = () => {
            selectedImageDataUrl = String(reader.result || "");

            if (els.previewImg) els.previewImg.src = selectedImageDataUrl;
            if (els.previewWrap) els.previewWrap.style.display = "block";
        };

        reader.onerror = () => {
            selectedImageDataUrl = "";
            showError("Không thể đọc file ảnh.");
        };

        reader.readAsDataURL(file);
    }

    async function runOCR() {
        clearError();

        if (!selectedFile) {
            showError("Bạn chưa chọn ảnh.");
            return;
        }

        setLoading(true);
        showSkeletonResult();

        try {
            const formData = new FormData();
            formData.append(UPLOAD_FIELD, selectedFile);

            const response = await fetch(API_PATH, {
                method: "POST",
                body: formData
            });

            const data = await readJson(response);
            const apiStatus = Number(data.status);

            if (!response.ok || apiStatus !== 200) {
                throw new Error(data.message || `Server trả lỗi ${data.status || response.status}.`);
            }

            const message = String(data.message || "").trim();

            if (!message) {
                throw new Error("Server trả về message rỗng.");
            }

            lastText = message;

            renderResult(message);
            addHistory({
                filename: selectedFile.name,
                text: message,
                image: selectedImageDataUrl
            });

            setApiState("online");
        } catch (error) {
            lastText = "";
            setApiState("offline");
            showError(error.message || "Không thể kết nối server.");
            hideResult();
        } finally {
            setLoading(false);
        }
    }

    async function readJson(response) {
        try {
            return await response.json();
        } catch {
            return {
                status: response.status,
                message: "Server không trả về JSON hợp lệ."
            };
        }
    }

    function setLoading(isLoading) {
        if (!els.scanBtn) return;

        els.scanBtn.disabled = isLoading || !selectedFile;
        els.scanBtn.innerHTML = isLoading
            ? "⏳ &nbsp;Đang quét..."
            : "⬡ &nbsp;Quét &amp; Phân Tích";
    }

    function showSkeletonResult() {
        if (els.result) els.result.style.display = "block";
        if (els.resultBadge) els.resultBadge.textContent = "Đang xử lý";

        if (els.parsedContent) {
            els.parsedContent.innerHTML = `
                <div class="skeleton w80"></div>
                <div class="skeleton w60"></div>
                <div class="skeleton w45"></div>
            `;
        }

        if (els.rawText) {
            els.rawText.textContent = "Đang gửi ảnh lên server...";
        }
    }

    function hideResult() {
        if (els.result) els.result.style.display = "none";
        if (els.rawText) els.rawText.textContent = "";
        if (els.parsedContent) els.parsedContent.innerHTML = "";
    }

    function renderResult(text) {
        if (els.result) els.result.style.display = "block";
        if (els.resultBadge) els.resultBadge.textContent = "OCR";
        if (els.rawText) els.rawText.textContent = text;

        renderParsedTable(text);
        switchTab("table");
    }

    function renderParsedTable(text) {
        if (!els.parsedContent) return;

        const lines = text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

        if (!lines.length) {
            els.parsedContent.innerHTML = `<div class="parsed-empty">Không có nội dung.</div>`;
            return;
        }

        const rows = lines.map((line, index) => {
            return `
                <tr>
                    <td><span class="badge-mon">${index + 1}</span></td>
                    <td>${escapeHtml(line)}</td>
                </tr>
            `;
        }).join("");

        els.parsedContent.innerHTML = `
            <table class="parsed-table">
                <thead>
                    <tr>
                        <th>STT</th>
                        <th>Nội dung</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function copyText() {
        if (!lastText) {
            showError("Chưa có nội dung để sao chép.");
            return;
        }

        navigator.clipboard.writeText(lastText)
            .then(() => showTemporaryMessage("Đã sao chép kết quả."))
            .catch(() => showError("Không thể sao chép vào clipboard."));
    }

    function showTemporaryMessage(message) {
        clearError();

        if (!els.errorBox) return;

        els.errorBox.textContent = message;
        els.errorBox.style.display = "block";
        els.errorBox.style.color = "var(--green)";
        els.errorBox.style.borderLeftColor = "var(--green)";
        els.errorBox.style.background = "#f1fff3";

        setTimeout(() => {
            clearError();
        }, 1500);
    }

    function exportCSV() {
        if (!lastText) {
            showError("Chưa có dữ liệu để xuất CSV.");
            return;
        }

        const lines = lastText
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

        const csvRows = [
            ["STT", "Nội dung"],
            ...lines.map((line, index) => [String(index + 1), line])
        ];

        const csv = csvRows
            .map((row) => row.map(csvCell).join(","))
            .join("\n");

        const blob = new Blob(["\uFEFF" + csv], {
            type: "text/csv;charset=utf-8"
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");

        a.href = url;
        a.download = `billscan-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();

        a.remove();
        URL.revokeObjectURL(url);
    }

    function csvCell(value) {
        return `"${String(value).replaceAll('"', '""')}"`;
    }

    function resetAll() {
        removeFile();
        clearError();
        hideResult();

        lastText = "";
        selectedImageDataUrl = "";

        if (els.resultBadge) els.resultBadge.textContent = "OCR";
        switchTab("table");
    }

    function removeFile() {
        selectedFile = null;
        selectedImageDataUrl = "";

        if (els.fileInput) els.fileInput.value = "";
        if (els.fileName) els.fileName.textContent = "—";
        if (els.fileBox) els.fileBox.style.display = "none";
        if (els.previewImg) els.previewImg.src = "";
        if (els.previewWrap) els.previewWrap.style.display = "none";
        if (els.scanBtn) els.scanBtn.disabled = true;
    }

    function switchTab(tab) {
        const tableActive = tab === "table";

        $("tab-table")?.classList.toggle("active", tableActive);
        $("tab-raw")?.classList.toggle("active", !tableActive);

        $("panel-table")?.classList.toggle("active", tableActive);
        $("panel-raw")?.classList.toggle("active", !tableActive);
    }

    function showScreen(screen) {
        const isScan = screen === "scan";

        $("screen-scan")?.classList.toggle("active", isScan);
        $("screen-history")?.classList.toggle("active", !isScan);

        $("nav-scan")?.classList.toggle("active", isScan);
        $("nav-history")?.classList.toggle("active", !isScan);

        $("sb-scan")?.classList.toggle("active", isScan);
        $("sb-history")?.classList.toggle("active", !isScan);

        if (!isScan) renderHistory();
    }

    function getHistory() {
        try {
            const data = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
            return Array.isArray(data) ? data : [];
        } catch {
            return [];
        }
    }

    function saveHistory(history) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }

    function addHistory(item) {
        const history = getHistory();

        history.unshift({
            id: crypto.randomUUID?.() || String(Date.now()),
            filename: item.filename,
            text: item.text,
            image: item.image || "",
            createdAt: new Date().toISOString()
        });

        saveHistory(history.slice(0, 50));
        renderHistory();
    }

    function renderHistory() {
        const history = getHistory();

        if (els.historyCount) {
            els.historyCount.textContent = `${history.length} mục`;
        }

        if (!els.historyList) return;

        if (!history.length) {
            els.historyList.innerHTML = `
                <div class="history-empty">
                    Chưa có lịch sử quét.
                </div>
            `;
            return;
        }

        els.historyList.innerHTML = `
            <div class="history-list">
                ${history.map(renderHistoryItem).join("")}
            </div>
        `;
    }

    function renderHistoryItem(item) {
        const preview = String(item.text || "").replace(/\s+/g, " ").slice(0, 120);
        const date = formatDate(item.createdAt);

        const thumb = item.image
            ? `<img class="history-thumb" src="${item.image}" alt="Ảnh đã quét">`
            : `<div class="history-thumb-placeholder">🧾</div>`;

        return `
            <div class="history-item" onclick="openHistoryDetail('${escapeAttr(item.id)}')">
                ${thumb}
                <div class="history-info">
                    <div class="history-filename">${escapeHtml(item.filename || "Không tên")}</div>
                    <div class="history-preview">${escapeHtml(preview || "Không có nội dung")}</div>
                </div>
                <div class="history-meta">
                    <div class="history-time">${escapeHtml(date)}</div>
                    <button class="history-del" onclick="deleteHistoryItem(event, '${escapeAttr(item.id)}')">Xóa</button>
                </div>
            </div>
        `;
    }

    function escapeAttr(value) {
        return String(value)
            .replaceAll("\\", "\\\\")
            .replaceAll("'", "\\'");
    }

    function formatDate(value) {
        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "—";

        return date.toLocaleString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
    }

    function openHistoryDetail(id) {
        const item = getHistory().find((entry) => entry.id === id);

        if (!item) return;

        detailCurrentText = item.text || "";

        if (els.detailTitle) els.detailTitle.textContent = item.filename || "Chi tiết";
        if (els.detailText) els.detailText.textContent = detailCurrentText;
        if (els.detailOverlay) els.detailOverlay.classList.add("open");
    }

    function deleteHistoryItem(event, id) {
        event.stopPropagation();

        const history = getHistory().filter((item) => item.id !== id);
        saveHistory(history);
        renderHistory();
    }

    function clearHistory() {
        const ok = confirm("Xóa toàn bộ lịch sử quét?");

        if (!ok) return;

        localStorage.removeItem(HISTORY_KEY);
        renderHistory();
    }

    function closeDetail(event) {
        if (event && event.target !== els.detailOverlay) return;

        els.detailOverlay?.classList.remove("open");
    }

    function copyDetail() {
        if (!detailCurrentText) return;

        navigator.clipboard.writeText(detailCurrentText)
            .then(() => showTemporaryMessage("Đã sao chép nội dung."))
            .catch(() => showError("Không thể sao chép vào clipboard."));
    }

    window.runOCR = runOCR;
    window.removeFile = removeFile;
    window.copyText = copyText;
    window.exportCSV = exportCSV;
    window.resetAll = resetAll;
    window.switchTab = switchTab;
    window.showScreen = showScreen;

    window.clearHistory = clearHistory;
    window.openHistoryDetail = openHistoryDetail;
    window.deleteHistoryItem = deleteHistoryItem;
    window.closeDetail = closeDetail;
    window.copyDetail = copyDetail;
})();