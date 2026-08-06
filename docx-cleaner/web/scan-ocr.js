/**
 * Image preprocessing for scanned documents: denoise, whiten, remove pen marks.
 */

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s, v };
}

function isInkPixel(r, g, b, inkColors) {
  const { h, s, v } = rgbToHsv(r, g, b);
  if (v < 0.15 || v > 0.92) return false;
  if (s < 0.18) return false;

  for (const color of inkColors) {
    if (color === "blue" && h >= 180 && h <= 260 && s > 0.2) return true;
    if (color === "red" && (h <= 25 || h >= 330) && s > 0.2) return true;
    if (color === "green" && h >= 80 && h <= 160 && s > 0.2) return true;
    if (color === "purple" && h >= 260 && h <= 320 && s > 0.15) return true;
  }
  return false;
}

function medianFilterGray(gray, w, h, radius) {
  const out = new Uint8ClampedArray(gray.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const vals = [];
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = clamp(y + dy, 0, h - 1);
          const nx = clamp(x + dx, 0, w - 1);
          vals.push(gray[ny * w + nx]);
        }
      }
      vals.sort((a, b) => a - b);
      out[y * w + x] = vals[Math.floor(vals.length / 2)];
    }
  }
  return out;
}

function otsuThreshold(gray) {
  const hist = new Array(256).fill(0);
  for (const v of gray) hist[v]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) ** 2;
    if (variance > maxVar) {
      maxVar = variance;
      threshold = t;
    }
  }
  return threshold;
}

/**
 * @param {HTMLCanvasElement} sourceCanvas
 * @param {{ denoise?: boolean, whiten?: boolean, removeInk?: string[], sharpen?: boolean }} options
 */
function preprocessScan(sourceCanvas, options = {}) {
  const {
    denoise = true,
    whiten = true,
    removeInk = ["blue", "red", "green"],
    sharpen = false,
  } = options;

  const canvas = document.createElement("canvas");
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(sourceCanvas, 0, 0);

  const { width: w, height: h } = canvas;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Remove colored pen marks / scribbles
  if (removeInk.length) {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (isInkPixel(r, g, b, removeInk)) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      }
    }
  }

  // Grayscale
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  let processed = gray;
  if (denoise) {
    processed = medianFilterGray(processed, w, h, 1);
  }

  const threshold = otsuThreshold(processed);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    let v = processed[p];
    if (whiten) {
      v = v > threshold - 8 ? 255 : v < threshold - 40 ? 0 : v;
    }
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }

  if (sharpen) {
    const copy = new Uint8ClampedArray(data);
    const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let sum = 0;
        let ki = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * w + (x + kx)) * 4;
            sum += copy[idx] * kernel[ki++];
          }
        }
        const idx = (y * w + x) * 4;
        const val = clamp(sum, 0, 255);
        data[idx] = data[idx + 1] = data[idx + 2] = val;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function splitOcrText(text) {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 2);
}

async function renderPdfPage(pdfjsLib, pdf, pageNum, scale = 2) {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  return canvas;
}

async function ocrCanvas(canvas, onProgress) {
  const worker = await Tesseract.createWorker("chi_sim", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(Math.round((m.progress || 0) * 100));
      }
    },
  });
  try {
    const { data } = await worker.recognize(canvas);
    return data.text || "";
  } finally {
    await worker.terminate();
  }
}

/**
 * OCR a scanned PDF or image file.
 */
async function ocrScanFile(file, options, onStatus) {
  const preprocessOpts = {
    denoise: options.denoise !== false,
    whiten: options.whiten !== false,
    removeInk: [],
    sharpen: !!options.sharpen,
  };
  if (options.removeBlue) preprocessOpts.removeInk.push("blue");
  if (options.removeRed) preprocessOpts.removeInk.push("red");
  if (options.removeGreen) preprocessOpts.removeInk.push("green");

  const pages = [];
  const ext = file.name.toLowerCase();

  if (ext.endsWith(".pdf")) {
    const pdfjsLib = options.pdfjsLib;
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    for (let i = 1; i <= pdf.numPages; i++) {
      if (onStatus) onStatus(`正在处理第 ${i}/${pdf.numPages} 页…`);
      const raw = await renderPdfPage(pdfjsLib, pdf, i, options.scale || 2);
      pages.push(preprocessScan(raw, preprocessOpts));
    }
  } else if (/\.(jpg|jpeg|png|webp|bmp)$/i.test(ext)) {
    const img = await loadImage(file);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext("2d").drawImage(img, 0, 0);
    pages.push(preprocessScan(canvas, preprocessOpts));
  } else {
    throw new Error("请上传 PDF 或图片（jpg/png）");
  }

  const allParagraphs = [];
  for (let i = 0; i < pages.length; i++) {
    if (onStatus) onStatus(`正在识别第 ${i + 1}/${pages.length} 页文字…`);
    const text = await ocrCanvas(pages[i], (pct) => {
      if (onStatus) onStatus(`识别第 ${i + 1} 页：${pct}%`);
    });
    allParagraphs.push(...splitOcrText(text));
  }

  return {
    paragraphs: allParagraphs,
    cleanedPages: pages,
    pageCount: pages.length,
    charCount: allParagraphs.join("").length,
  };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function canvasesToPdfBlob(canvases) {
  const { jsPDF } = window.jspdf;
  let pdf = null;
  for (let i = 0; i < canvases.length; i++) {
    const c = canvases[i];
    const imgData = c.toDataURL("image/jpeg", 0.92);
    const w = c.width;
    const h = c.height;
    const orientation = w > h ? "l" : "p";
    if (i === 0) {
      pdf = new jsPDF({ orientation, unit: "px", format: [w, h] });
    } else {
      pdf.addPage([w, h], orientation);
    }
    pdf.addImage(imgData, "JPEG", 0, 0, w, h);
  }
  return pdf.output("blob");
}

window.preprocessScan = preprocessScan;
window.ocrScanFile = ocrScanFile;
window.canvasesToPdfBlob = canvasesToPdfBlob;
