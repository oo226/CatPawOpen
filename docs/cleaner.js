/**
 * Browser port of docx-cleaner core logic.
 * Processes .docx entirely client-side — no server upload.
 */

const EMU_PER_INCH = 914400;
const ROTATION_TOLERANCE = 450000;
const LIST_ITEM_RE = /^[（(][一二三四五六七八九十百千0-9]+[）)]/;
const HEADING_RE = /^《.+》第.+条/;
const PAGE_NUMBER_RE = /^\d{1,3}$/;
const SPACED_CHARS_RE = /(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/g;

function localName(el) {
  return el.localName || (el.tagName || "").replace(/^[^:]+:/, "");
}

function textFromElement(element) {
  const parts = [];
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent) {
      parts.push(node.textContent);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = localName(node);
    if (tag === "t" && node.textContent) parts.push(node.textContent);
    if (tag === "tab") parts.push("\t");
    if (tag === "br") parts.push("\n");
    for (const child of node.childNodes) walk(child);
  };
  walk(element);
  return parts.join("");
}

function normalizeText(text) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(SPACED_CHARS_RE, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function rotationFromElement(element) {
  const all = element.getElementsByTagName("*");
  for (const node of all) {
    if (localName(node) === "xfrm" && node.getAttribute("rot")) {
      const rot = parseInt(node.getAttribute("rot"), 10);
      if (!Number.isNaN(rot)) return rot;
    }
  }
  return 0;
}

function offsetFromAnchor(anchor) {
  let x = 0;
  let y = 0;
  const all = anchor.getElementsByTagName("*");
  for (const node of all) {
    if (localName(node) === "posOffset" && node.textContent) {
      const parent = node.parentElement;
      const gp = parent?.parentElement;
      if (gp && localName(gp) === "positionH") x = parseInt(node.textContent, 10) || 0;
      if (gp && localName(gp) === "positionV") y = parseInt(node.textContent, 10) || 0;
    }
  }
  return { x, y };
}

function isRotated(rotation) {
  rotation = rotation % 21600000;
  return (
    Math.abs(rotation - 5400000) <= ROTATION_TOLERANCE ||
    Math.abs(rotation - 16200000) <= ROTATION_TOLERANCE
  );
}

function unrotateText(text, rotation) {
  if (!isRotated(rotation)) return text;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return text;
  rotation = rotation % 21600000;
  const maxLen = Math.max(...lines.map((l) => l.length));
  const chars = [];
  if (Math.abs(rotation - 5400000) <= ROTATION_TOLERANCE) {
    for (let col = 0; col < maxLen; col++) {
      for (let row = lines.length - 1; row >= 0; row--) {
        if (col < lines[row].length) chars.push(lines[row][col]);
      }
    }
    return chars.join("");
  }
  if (Math.abs(rotation - 16200000) <= ROTATION_TOLERANCE) {
    for (let col = maxLen - 1; col >= 0; col--) {
      for (let row = 0; row < lines.length; row++) {
        if (col < lines[row].length) chars.push(lines[row][col]);
      }
    }
    return chars.join("");
  }
  return text;
}

function makeBlock(text, x, y, rotation, source, sequence, keepPageNumbers) {
  if (!text) return null;
  const isPageNumber = PAGE_NUMBER_RE.test(text);
  if (isPageNumber && !keepPageNumbers) return null;
  return {
    sortY: y || sequence,
    sortX: x,
    text,
    source,
    rotation,
    sequence,
    isPageNumber,
    isHeading: HEADING_RE.test(text),
    isListItem: LIST_ITEM_RE.test(text),
  };
}

function paragraphHasFloatingShape(para) {
  const all = para.getElementsByTagName("*");
  for (const node of all) {
    const tag = localName(node);
    if (tag === "drawing" || tag === "pict" || tag === "txbxContent") return true;
  }
  return false;
}

function byLocalName(root, name) {
  return [...root.getElementsByTagName("*")].filter((el) => localName(el) === name);
}

function extractFromRoot(doc, baseSequence, keepPageNumbers) {
  const blocks = [];
  let sequence = baseSequence;

  for (const anchor of byLocalName(doc, "anchor")) {
    const rotation = rotationFromElement(anchor);
    const { x, y } = offsetFromAnchor(anchor);
    for (const txbx of byLocalName(anchor, "txbxContent")) {
      let text = normalizeText(textFromElement(txbx));
      if (!text) continue;
      text = unrotateText(text, rotation);
      const block = makeBlock(text, x, y, rotation, "textbox", sequence, keepPageNumbers);
      if (block) {
        blocks.push(block);
        sequence += 1;
      }
    }
  }

  for (const vml of byLocalName(doc, "textbox")) {
    for (const txbx of byLocalName(vml, "txbxContent")) {
      const text = normalizeText(textFromElement(txbx));
      if (!text) continue;
      const block = makeBlock(text, sequence, sequence, 0, "textbox-vml", sequence, keepPageNumbers);
      if (block) {
        blocks.push(block);
        sequence += 1;
      }
    }
  }

  for (const drawing of byLocalName(doc, "drawing")) {
    let inAnchor = false;
    let p = drawing.parentElement;
    while (p) {
      if (localName(p) === "anchor") {
        inAnchor = true;
        break;
      }
      p = p.parentElement;
    }
    if (inAnchor) continue;

    const rotation = rotationFromElement(drawing);
    for (const txbx of byLocalName(drawing, "txbxContent")) {
      let text = normalizeText(textFromElement(txbx));
      if (!text) continue;
      text = unrotateText(text, rotation);
      const block = makeBlock(text, 0, sequence, rotation, "textbox-inline", sequence, keepPageNumbers);
      if (block) {
        blocks.push(block);
        sequence += 1;
      }
    }
  }

  const bodies = byLocalName(doc, "body");
  for (const body of bodies) {
    for (const para of [...body.children].filter((el) => localName(el) === "p")) {
      const text = normalizeText(textFromElement(para));
      if (!text || paragraphHasFloatingShape(para)) continue;
      const block = makeBlock(text, 0, sequence, 0, "paragraph", sequence, keepPageNumbers);
      if (block) {
        blocks.push(block);
        sequence += 1;
      }
    }
    for (const table of byLocalName(body, "tbl")) {
      for (const row of byLocalName(table, "tr")) {
        const rowTexts = [];
        for (const cell of byLocalName(row, "tc")) {
          const cellText = normalizeText(textFromElement(cell));
          if (cellText) rowTexts.push(cellText);
        }
        if (rowTexts.length) {
          const block = makeBlock(rowTexts.join(" | "), 0, sequence, 0, "table", sequence, keepPageNumbers);
          if (block) {
            blocks.push(block);
            sequence += 1;
          }
        }
      }
    }
  }

  return blocks;
}

function deduplicateBlocks(blocks) {
  const seen = new Set();
  const unique = [];
  for (const block of blocks) {
    const key = block.text.replace(/\s+/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(block);
  }
  return unique;
}

function shouldMerge(prev, curr) {
  if (curr.isHeading || curr.isListItem) return false;
  if (prev.isHeading) return false;
  if (prev.isListItem && curr.isListItem) return false;
  if (prev.source.startsWith("textbox") || curr.source.startsWith("textbox")) {
    return Math.abs(prev.sortY - curr.sortY) <= EMU_PER_INCH / 2;
  }
  if (prev.source === "paragraph" && curr.source === "paragraph") return true;
  return false;
}

function joinWithoutSpace(left, right) {
  if (!left || !right) return false;
  return left.charCodeAt(left.length - 1) > 127 || right.charCodeAt(0) > 127;
}

function mergeBlocks(blocks) {
  if (!blocks.length) return [];
  const paragraphs = [];
  let buffer = blocks[0].text;
  for (let i = 1; i < blocks.length; i++) {
    const prev = blocks[i - 1];
    const curr = blocks[i];
    if (shouldMerge(prev, curr)) {
      if (prev.isListItem || curr.isListItem || prev.isHeading || curr.isHeading) {
        paragraphs.push(buffer);
        buffer = curr.text;
      } else {
        buffer = buffer + curr.text;
      }
    } else {
      paragraphs.push(buffer);
      buffer = curr.text;
    }
  }
  paragraphs.push(buffer);
  return paragraphs.map((p) => normalizeText(p)).filter(Boolean);
}

function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildParagraphXml(text) {
  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  if (HEADING_RE.test(text)) {
    return `<w:p xmlns:w="${W}"><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/><w:rFonts w:eastAsia="宋体"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
  }
  if (LIST_ITEM_RE.test(text)) {
    return `<w:p xmlns:w="${W}"><w:pPr><w:ind w:left="480" w:firstLine="-480"/></w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="宋体"/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
  }
  return `<w:p xmlns:w="${W}"><w:pPr><w:ind w:firstLine="480"/></w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="宋体"/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

async function buildDocx(paragraphs) {
  const bodyContent = paragraphs.map(buildParagraphXml).join("");
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyContent}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;

  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`);
  zip.file("word/document.xml", documentXml);
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

async function cleanDocx(arrayBuffer, options = {}) {
  const keepPageNumbers = !!options.keepPageNumbers;
  const zip = await JSZip.loadAsync(arrayBuffer);
  const names = Object.keys(zip.files).filter(
    (n) => n.startsWith("word/") && n.endsWith(".xml")
  );

  let blocks = [];
  let sequence = 0;
  const parser = new DOMParser();

  for (const name of names.sort()) {
    const xml = await zip.file(name).async("string");
    const doc = parser.parseFromString(xml, "application/xml");
    const extracted = extractFromRoot(doc, sequence, keepPageNumbers);
    blocks = blocks.concat(extracted);
    sequence += 10000;
  }

  blocks = deduplicateBlocks(blocks);
  blocks.sort((a, b) => a.sortY - b.sortY || a.sortX - b.sortX || a.sequence - b.sequence);

  const paragraphs = mergeBlocks(blocks);
  const blob = await buildDocx(paragraphs);

  const stats = {
    input_blocks: blocks.length,
    output_paragraphs: paragraphs.length,
    unrotated_blocks: blocks.filter((b) => isRotated(b.rotation)).length,
    textbox_blocks: blocks.filter((b) => b.source === "textbox").length,
  };

  return { blob, paragraphs, stats };
}

window.cleanDocx = cleanDocx;
window.buildDocx = buildDocx;
