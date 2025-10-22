const employeeSelect = document.getElementById("employeeSelect");
const statusEl = document.getElementById("status");
const qrResultEl = document.getElementById("qrResult");
const barcodeResultEl = document.getElementById("barcodeResult");
const imageInput = document.getElementById("imageInput");
const imagePreviewWrapper = document.getElementById("imagePreviewWrapper");
const imagePreview = document.getElementById("imagePreview");
const decodeBtn = document.getElementById("decodeBtn");
const submitBtn = document.getElementById("submitBtn");

let qrData = null;
let barcodeData = null;
let selectedFile = null;

async function loadEmployees() {
  try {
    const response = await fetch("/api/users");
    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }
    const data = await response.json();
    const { employees } = data;
    employeeSelect.innerHTML =
      '<option value="">Choose your name…</option>' +
      employees.map((name) => `<option value="${name}">${name}</option>`).join("");
  } catch (error) {
    console.error("Failed to load employees", error);
    employeeSelect.innerHTML = '<option value="">Could not load names</option>';
    setStatus("error", "Failed to load employee list. Refresh to retry.");
  }
}

function setStatus(type, message) {
  statusEl.textContent = message;
  statusEl.className = "status";
  if (type === "success") {
    statusEl.classList.add("status--success");
  } else if (type === "error") {
    statusEl.classList.add("status--error");
  } else {
    statusEl.classList.add("status--idle");
  }
}

function resetResults() {
  qrData = null;
  barcodeData = null;
  qrResultEl.textContent = "–";
  barcodeResultEl.textContent = "–";
  submitBtn.disabled = true;
}

function handleFileSelection(file) {
  selectedFile = file;
  resetResults();
  if (!file) {
    imagePreviewWrapper.hidden = true;
    setStatus("idle", "No image selected");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    imagePreview.src = reader.result;
    imagePreviewWrapper.hidden = false;
  };
  reader.readAsDataURL(file);
  setStatus("idle", "Image ready. Tap decode to process.");
}

async function decodeImage() {
  if (!employeeSelect.value) {
    setStatus("error", "Pick your name before decoding.");
    return;
  }
  if (!selectedFile) {
    setStatus("error", "Upload a label photo first.");
    return;
  }

  try {
    decodeBtn.disabled = true;
    setStatus("idle", "Decoding…");
    const formData = new FormData();
    formData.append("image", selectedFile);

    const response = await fetch("/api/decode", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Decode failed (${response.status})`);
    }
    const { decoded } = await response.json();

    if (!decoded || decoded.length === 0) {
      setStatus("error", "No codes detected. Try a clearer photo.");
      return;
    }

    updateResults(decoded);
  } catch (error) {
    console.error("Decode failed", error);
    setStatus("error", "Decode failed. Try again.");
  } finally {
    decodeBtn.disabled = false;
  }
}

function updateResults(results) {
  resetResults();
  for (const item of results) {
    const format = (item.format || "").toUpperCase();
    const text = item.text || "";
    if (format.includes("QR")) {
      qrData = qrData || text;
      qrResultEl.textContent = qrData;
    } else {
      barcodeData = barcodeData || text;
      barcodeResultEl.textContent = barcodeData;
    }
  }

  if (qrData || barcodeData) {
    setStatus("success", "Codes decoded. Submit to store the scan.");
    submitBtn.disabled = false;
  } else {
    setStatus("error", "Could not classify codes. Try retaking the photo.");
  }
}

async function submitScan() {
  if (!employeeSelect.value) {
    setStatus("error", "Select your name before submitting.");
    return;
  }
  if (!qrData && !barcodeData) {
    setStatus("error", "Decode the image before submitting.");
    return;
  }

  try {
    submitBtn.disabled = true;
    const payload = {
      employee: employeeSelect.value,
      qrData,
      barcodeData,
    };
    const response = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }
    await response.json();
    setStatus("success", "Scan saved. Thank you!");
    handleFileSelection(null);
    imageInput.value = "";
  } catch (error) {
    console.error("Failed to submit", error);
    setStatus("error", "Could not submit scan. Try again.");
    submitBtn.disabled = false;
  }
}

imageInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0] || null;
  handleFileSelection(file);
});

decodeBtn.addEventListener("click", decodeImage);
submitBtn.addEventListener("click", submitScan);

loadEmployees();
