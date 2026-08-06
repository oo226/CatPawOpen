/**
 * PDF comparison using pdf.js — runs entirely in the browser.
 */

const PUNCT_RE = /[\s\u00a0，。、；：""''（）()【】《》<>·…—.,;:!?\-[\]]/g;
const SEGMENT_SPLIT_RE = /[。；\n]+/;
const MIN_SEGMENT_LEN = 6;
const MAX_MISSING_DISPLAY = 20;

export function normalizeForCompare(text) {
  return text.replace(PUNCT_RE, "");
}

export async function extractPdfText(arrayBuffer, pdfjsLib) {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const parts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join("");
    if (pageText.trim()) parts.push(pageText);
  }
  return parts.join("\n");
}

function splitSegments(text) {
  const segments = [];
  for (const part of text.split(SEGMENT_SPLIT_RE)) {
    const trimmed = part.trim();
    if (normalizeForCompare(trimmed).length >= MIN_SEGMENT_LEN) {
      segments.push(trimmed);
    }
  }
  return segments;
}

function fuzzyContains(haystack, needle, threshold = 0.85) {
  if (!needle) return true;
  if (haystack.includes(needle)) return true;
  const needleLen = needle.length;
  if (needleLen < MIN_SEGMENT_LEN) return haystack.includes(needle);
  const window = Math.max(needleLen, MIN_SEGMENT_LEN);
  for (let i = 0; i <= Math.max(0, haystack.length - window); i++) {
    const chunk = haystack.slice(i, i + window);
    let matches = 0;
    for (let j = 0; j < needleLen && j < chunk.length; j++) {
      if (chunk[j] === needle[j]) matches += 1;
    }
    if (matches / needleLen >= threshold) return true;
  }
  return false;
}

export async function compareWithPdf(pdfArrayBuffer, docxParagraphs, pdfjsLib) {
  const pdfText = await extractPdfText(pdfArrayBuffer, pdfjsLib);
  const docxText = docxParagraphs.join("\n");
  const pdfNorm = normalizeForCompare(pdfText);
  const docxNorm = normalizeForCompare(docxText);

  if (!pdfNorm) {
    return {
      status: "error",
      message: "PDF 中未能提取到文字（可能是纯图片扫描件，需 OCR 后的 PDF）",
      coverage_percent: 0,
      matched_segments: 0,
      total_segments: 0,
      missing_segments: [],
    };
  }

  const segments = splitSegments(pdfText);
  const missing = [];
  let matched = 0;

  for (const segment of segments) {
    const segNorm = normalizeForCompare(segment);
    if (docxNorm.includes(segNorm) || fuzzyContains(docxNorm, segNorm)) {
      matched += 1;
    } else {
      missing.push(segment.length <= 80 ? segment : segment.slice(0, 80) + "…");
    }
  }

  const coverage = segments.length ? (matched / segments.length) * 100 : 0;
  let status = "error";
  let message = "缺失较多，建议检查原文件或重新 OCR";
  if (coverage >= 95) {
    status = "ok";
    message = "对照良好，整理结果与 PDF 内容基本一致";
  } else if (coverage >= 80) {
    status = "warning";
    message = "有部分内容可能缺失，请对照下方缺失片段检查";
  }

  return {
    coverage_percent: Math.round(coverage * 10) / 10,
    matched_segments: matched,
    total_segments: segments.length,
    missing_segments: missing.slice(0, MAX_MISSING_DISPLAY),
    status,
    message,
  };
}
