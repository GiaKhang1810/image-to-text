const API_URL = "http://127.0.0.1:8000";

async function runOCR() {
    const file = imageInput.files[0];

    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_URL}/ocr`, {
        method: "POST",
        body: formData
    });

    const data = await response.json();

    console.log("OCR RESPONSE:", data);

    resultBox.value = data.text || data.error || "Không có kết quả";
}