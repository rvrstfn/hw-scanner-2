import { BrowserMultiFormatReader } from "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.4/+esm";
import {
  BarcodeFormat,
  DecodeHintType,
} from "https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/+esm";

const employeeSelect = document.getElementById("employeeSelect");
const statusEl = document.getElementById("status");
const qrResultEl = document.getElementById("qrResult");
const barcodeResultEl = document.getElementById("barcodeResult");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const submitBtn = document.getElementById("submitBtn");
const videoElement = document.getElementById("preview");

const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.DATA_MATRIX,
]);
const reader = new BrowserMultiFormatReader();
reader.setHints(hints);

let qrData = null;
let barcodeData = null;
let cameraActive = false;
let videoControls = null;

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

async function startCamera() {
  if (cameraActive) {
    return;
  }
  if (!employeeSelect.value) {
    setStatus("error", "Pick your name before scanning.");
    return;
  }

  resetResults();
  setStatus("idle", "Starting camera…");
  startBtn.disabled = true;
  stopBtn.disabled = false;

  try {
    const devices = await reader.listVideoInputDevices();
    const preferredDevice =
      devices.find((device) => device.label.toLowerCase().includes("back")) ||
      devices[0];

    if (!preferredDevice) {
      throw new Error("No camera found");
    }

    cameraActive = true;
    reader
      .decodeFromVideoDevice(
        preferredDevice.deviceId,
        videoElement,
        (result, error, controls) => {
          if (controls) {
            videoControls = controls;
          }
          if (error) {
            return;
          }
          if (!result) {
            return;
          }

          const format = result.getBarcodeFormat();
          const text = result.getText();

          if (format === BarcodeFormat.QR_CODE) {
            qrData = text;
            qrResultEl.textContent = text;
          } else {
            barcodeData = text;
            barcodeResultEl.textContent = text;
          }

          if (qrData || barcodeData) {
            setStatus("success", "Code captured. Scan other code or submit.");
          }

          if (qrData && barcodeData) {
            setStatus("success", "Both codes captured. Ready to submit.");
            submitBtn.disabled = false;
          }
        }
      )
      .then(() => {
        /* Promise resolves when the stream stops; nothing to do here. */
      })
      .catch((error) => {
        console.error(error);
        setStatus("error", error.message || "Could not start camera");
        startBtn.disabled = false;
        stopBtn.disabled = true;
        cameraActive = false;
      });
    setStatus("idle", "Camera active. Aim at the code.");
  } catch (error) {
    console.error(error);
    setStatus("error", error.message || "Could not start camera");
    startBtn.disabled = false;
    stopBtn.disabled = true;
    cameraActive = false;
  }
}

function stopCamera() {
  if (!cameraActive) {
    return;
  }
  if (videoControls) {
    videoControls.stop();
    videoControls = null;
  }
  reader.reset();
  cameraActive = false;
  videoElement.srcObject = null;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  setStatus("idle", "Camera stopped.");
}

async function submitScan() {
  if (!employeeSelect.value) {
    setStatus("error", "Select your name before submitting.");
    return;
  }
  if (!qrData && !barcodeData) {
    setStatus("error", "Scan at least one code before submitting.");
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
    stopCamera();
    resetResults();
  } catch (error) {
    console.error("Failed to submit", error);
    setStatus("error", "Could not submit scan. Try again.");
    submitBtn.disabled = false;
  }
}

startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);
submitBtn.addEventListener("click", submitScan);

window.addEventListener("beforeunload", () => {
  stopCamera();
});

loadEmployees();
