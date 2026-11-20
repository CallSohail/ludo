import QRCode from "qrcode";
import { verificationUrl } from "./certificateService";
import { playerMonogram, playerPortraitFile } from "./playerPortraits";
const W = 1400,
  H = 990,
  S = 2.5;
const C = {
  paper: "#111c18",
  panel: "#1b2b23",
  ink: "#f1f4ec",
  muted: "#b9c8bc",
  green: "#b7e6c4",
  line: "#40584a",
  gold: "#e3c78f",
  notice: "#f0cbbb",
};
const coverCenter = 924;
const coverWidth = 750;
const coverNotesTop = 625;
const coverNotesBottom = 803;
const assetCache = new Map();

function certificateImage(file) {
  if (!file) return Promise.resolve(null);
  if (!assetCache.has(file)) {
    const result = new Promise((resolve) => {
      const image = new Image();
      const finish = (value) => {
        clearTimeout(timer);
        image.onload = null;
        image.onerror = null;
        resolve(value);
      };
      const timer = setTimeout(() => finish(null), 5000);
      image.onload = () => finish(image.naturalWidth ? image : null);
      image.onerror = () => finish(null);
      image.src = `${import.meta.env.BASE_URL}${file}`;
    });
    assetCache.set(file, result);
  }
  return assetCache.get(file);
}

function text(
  c,
  t,
  x,
  y,
  size = 18,
  color = C.ink,
  align = "center",
  weight = 400,
) {
  c.font = `${weight} ${size}px "DM Sans"`;
  c.fillStyle = color;
  c.textAlign = align;
  c.fillText(String(t), x, y);
}
function rule(c, x, y, x2, y2, color = C.line, width = 1) {
  c.beginPath();
  c.strokeStyle = color;
  c.lineWidth = width;
  c.moveTo(x, y);
  c.lineTo(x2, y2);
  c.stroke();
}
function wrap(c, t, width, size = 17) {
  c.font = `400 ${size}px "DM Sans"`;
  let out = [];
  for (const paragraph of String(t).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (c.measureText(line ? line + " " + word : word).width <= width) {
        line = line ? line + " " + word : word;
        continue;
      }
      if (line) out.push(line);
      line = "";
      for (const ch of Array.from(word)) {
        if (c.measureText(line + ch).width > width && line) {
          out.push(line);
          line = "";
        }
        line += ch;
      }
    }
    if (line && !line.includes(" ") && out.length && out.at(-1).includes(" ")) {
      const previous = out.at(-1).split(" "),
        word = previous.pop();
      if (c.measureText(word + " " + line).width <= width) {
        out[out.length - 1] = previous.join(" ");
        line = word + " " + line;
      }
    }
    out.push(line);
  }
  return out;
}
function strokeRound(c, x, y, width, height, radius, colour, size = 1) {
  c.beginPath();
  c.roundRect(x, y, width, height, radius);
  c.lineWidth = size;
  c.strokeStyle = colour;
  c.stroke();
}

function drawCoverImage(c, image, x, y, width, height) {
  const scale = Math.max(
    width / image.naturalWidth,
    height / image.naturalHeight,
  );
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  c.drawImage(
    image,
    (image.naturalWidth - sourceWidth) / 2,
    (image.naturalHeight - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
}

function crown(c, x, y, width, colour) {
  c.save();
  c.translate(x, y);
  c.scale(width / 48, width / 48);
  c.beginPath();
  c.moveTo(-23, -8);
  c.lineTo(-12, 0);
  c.lineTo(0, -15);
  c.lineTo(12, 0);
  c.lineTo(23, -8);
  c.lineTo(18, 11);
  c.lineTo(-18, 11);
  c.closePath();
  c.fillStyle = colour;
  c.fill();
  c.restore();
}

function base(c, model) {
  const gradient = c.createLinearGradient(0, 0, W, H);
  gradient.addColorStop(0, "#192921");
  gradient.addColorStop(0.62, C.paper);
  gradient.addColorStop(1, "#18261e");
  c.fillStyle = gradient;
  c.fillRect(0, 0, W, H);
  strokeRound(
    c,
    27,
    27,
    W - 54,
    H - 54,
    22,
    model.leader ? C.gold : C.line,
    model.leader ? 2 : 1,
  );
  text(c, "Ludo Super League", 59, 83, 23, C.ink, "left", 600);
  text(c, "Évry 2026", 1341, 83, 19, C.muted, "right", 500);
  rule(c, 58, 112, 1342, 112);
}

function drawPortrait(c, model, photo, x, y, radius) {
  const accent = model.leader ? C.gold : C.green;
  c.save();
  c.shadowColor = "#06120cd0";
  c.shadowBlur = radius / 8;
  c.shadowOffsetY = radius / 18;
  c.beginPath();
  c.arc(x, y, radius + 5, 0, 2 * Math.PI);
  c.fillStyle = C.paper;
  c.fill();
  c.restore();
  c.save();
  c.beginPath();
  c.arc(x, y, radius, 0, 2 * Math.PI);
  c.clip();
  if (photo) {
    drawCoverImage(c, photo, x - radius, y - radius, radius * 2, radius * 2);
  } else {
    const fill = c.createLinearGradient(
      x - radius,
      y - radius,
      x + radius,
      y + radius,
    );
    fill.addColorStop(0, "#406c55");
    fill.addColorStop(1, "#142b21");
    c.fillStyle = fill;
    c.fillRect(x - radius, y - radius, 2 * radius, 2 * radius);
    text(
      c,
      playerMonogram(model.name),
      x,
      y + radius * 0.25,
      radius * 0.7,
      C.ink,
      "center",
      600,
    );
  }
  c.restore();
  c.beginPath();
  c.arc(x, y, radius + 3, 0, 2 * Math.PI);
  c.strokeStyle = accent;
  c.lineWidth = radius > 50 ? 2.5 : 1.5;
  c.stroke();
}

function portraitPanel(c, model, photo, art) {
  const x = 50,
    y = 133,
    width = 412,
    height = 669;
  c.save();
  c.beginPath();
  c.roundRect(x, y, width, height, 20);
  c.clip();
  if (art) {
    drawCoverImage(c, art, x, y, width, height);
  } else {
    const fill = c.createLinearGradient(x, y + height, x + width, y);
    fill.addColorStop(0, "#11251b");
    fill.addColorStop(1, "#315b48");
    c.fillStyle = fill;
    c.fillRect(x, y, width, height);
  }
  c.restore();
  strokeRound(
    c,
    x,
    y,
    width,
    height,
    20,
    model.leader ? "#b79a6488" : "#73a88877",
  );
  const center = x + width / 2;
  const portraitY = y + 250;
  c.beginPath();
  c.arc(center, portraitY, 151, 0, 2 * Math.PI);
  c.strokeStyle = model.leader ? "#dec18b77" : "#a9d3b688";
  c.lineWidth = 1;
  c.stroke();
  drawPortrait(c, model, photo, center, portraitY, 132);
  if (model.leader) {
    crown(c, center, y + 44, 34, C.gold);
    text(c, "Crown edition", center, y + 83, 20, C.gold, "center", 600);
  }
}

function coverHeading(c, model) {
  const accent = model.leader ? C.gold : C.green;
  text(c, "Certificate of", coverCenter, 197, 28, C.muted, "center", 400);
  text(c, "Recognition", coverCenter, 277, 82, C.ink, "center", 600);
  rule(c, coverCenter - 56, 303, coverCenter + 56, 303, accent, 2);
  text(c, "Presented to", coverCenter, 343, 18, C.muted);
  let size = 72;
  c.font = `600 ${size}px "DM Sans"`;
  while (size > 20 && c.measureText(model.name).width > coverWidth) {
    size -= 2;
    c.font = `600 ${size}px "DM Sans"`;
  }
  c.textAlign = "center";
  c.fillStyle = C.ink;
  c.fillText(model.name, coverCenter, 424, coverWidth);
  text(c, model.title, coverCenter, 471, 23, accent, "center", 500);
}

function coverMetrics(c, model) {
  const x = coverCenter - coverWidth / 2;
  c.fillStyle = C.panel;
  c.beginPath();
  c.roundRect(x, 507, coverWidth, 83, 15);
  c.fill();
  const metrics = [
    ["Position", `${model.rank} / ${model.total}`],
    ["Penalty points", model.points],
    [
      "Recorded awards",
      model.historyAvailable ? model.metric.awards : "Unavailable",
    ],
  ];
  metrics.forEach(([label, value], index) => {
    const center = x + ((index + 0.5) * coverWidth) / 3;
    if (index)
      rule(c, center - coverWidth / 6, 527, center - coverWidth / 6, 570);
    text(c, label, center, 534, 15, C.muted);
    text(
      c,
      value,
      center,
      572,
      value === "Unavailable" ? 20 : 31,
      C.ink,
      "center",
      600,
    );
  });
}

function commentBlocks(c, comments) {
  let pages = [],
    page = [],
    height = 0;
  for (const comment of comments) {
    const parts = wrap(c, comment.reason || "Score recorded", 1110, 18);
    let offset = 0;
    while (offset < parts.length) {
      const room = Math.max(1, Math.floor((535 - height - 58) / 26));
      const chunk = parts.slice(offset, offset + room);
      const block = { ...comment, lines: chunk, continued: offset > 0 };
      const h = chunk.length * 26 + 58;
      if (height + h > 540 && page.length) {
        pages.push(page);
        page = [];
        height = 0;
        continue;
      }
      page.push(block);
      height += h;
      offset += chunk.length;
      if (offset < parts.length) {
        pages.push(page);
        page = [];
        height = 0;
      }
    }
  }
  if (page.length) pages.push(page);
  return pages;
}
function personalNote(model, message) {
  return (model.issued ? model.message : message).trim();
}
function coverContent(c, model, message) {
  const note = personalNote(model, message);
  const comments = model.comments || [];
  const latest = comments.at(-1)?.reason || "";
  const facts = model.commendations.flatMap((line) =>
    wrap(c, line, coverWidth, 16),
  );
  const groups = [];
  const rows = comments.length > 1 ? [...comments] : [];
  let available = coverNotesBottom - coverNotesTop - facts.length * 23 - 24;
  function tryCover(heading, content) {
    const lines = wrap(c, content, coverWidth - 32, 17);
    const height = 25 + lines.length * 23 + 10;
    if (height > available) return false;
    available -= height;
    groups.push({ heading, lines });
    return true;
  }
  if (
    note &&
    (note.length > 250 ||
      note.split("\n").length > 3 ||
      !tryCover("Personal commendation", note))
  ) {
    rows.unshift({ kind: "message", reason: note });
  }
  if (
    latest &&
    !tryCover("From the table", `“${latest}”`) &&
    comments.length === 1
  )
    rows.push(comments[0]);
  return { facts, groups, pages: commentBlocks(c, rows) };
}

export async function certificatePageCount(model, message = "") {
  await document.fonts.load('400 18px "DM Sans"');
  const c = document.createElement("canvas").getContext("2d");
  return 1 + coverContent(c, model, message).pages.length;
}

function drawCoverContent(c, content, model) {
  let y = coverNotesTop;
  for (const line of content.facts) {
    text(c, line, coverCenter, y, 16, C.muted);
    y += 23;
  }
  for (const group of content.groups) {
    y += 6;
    text(
      c,
      group.heading,
      coverCenter,
      y,
      15,
      model.leader ? C.gold : C.green,
      "center",
      600,
    );
    y += 23;
    for (const line of group.lines) {
      text(c, line, coverCenter, y, 17, C.ink);
      y += 23;
    }
    y += 6;
  }
  if (content.pages.length)
    text(
      c,
      "Recognition notes on the following pages",
      coverCenter,
      802,
      14,
      C.green,
      "center",
      500,
    );
}

async function footer(c, model, pageNo, pageCount) {
  rule(c, 82, 824, 1318, 824);
  const url = model.issued ? verificationUrl(model.id) : verificationUrl();
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, url, {
    width: 280,
    margin: 4,
    errorCorrectionLevel: "M",
    color: { dark: "#132319", light: "#f2f6ec" },
  });
  c.drawImage(qr, 82, 845, 94, 94);
  text(
    c,
    model.revokedAt
      ? "REVOKED certificate • check the record"
      : model.issued
        ? model.demo
          ? "Demo issuance • this browser only"
          : "Issued certificate • verify the record"
        : "Unissued preview • not a verified award",
    198,
    861,
    14,
    model.issued && !model.revokedAt ? C.green : C.notice,
    "left",
    500,
  );
  text(
    c,
    model.issued
      ? model.id
      : "Sign in as scorekeeper to issue a verifiable certificate",
    198,
    886,
    12,
    C.muted,
    "left",
  );
  text(
    c,
    model.issued
      ? `Record fingerprint: ${String(model.contentHash).slice(0, 20)}`
      : "Scan to open the certificate verification page",
    198,
    908,
    12,
    C.muted,
    "left",
  );
  text(c, url.replace(/^https?:\/\//, ""), 198, 932, 11, C.green, "left", 500);
  text(c, `${model.dateLabel} · Europe/Paris`, 1318, 864, 12, C.muted, "right");
  text(c, `Page ${pageNo} of ${pageCount}`, 1318, 889, 12, C.muted, "right");
  text(
    c,
    "Awarded for the league’s penalty standings",
    1318,
    932,
    11,
    C.muted,
    "right",
  );
}
export async function renderCertificate(
  canvas,
  model,
  message = "",
  pageIndex = 0,
) {
  if (!canvas) throw new Error("The certificate preview is unavailable.");
  const [photo, art] = await Promise.all([
    certificateImage(playerPortraitFile(model.playerId)),
    pageIndex === 0 ? certificateImage("certificate-glass-panel.webp") : null,
    document.fonts.load('400 18px "DM Sans"'),
    document.fonts.load('500 64px "DM Sans"'),
    document.fonts.load('600 72px "DM Sans"'),
  ]);
  canvas.width = W * S;
  canvas.height = H * S;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("Your browser could not create the certificate.");
  c.scale(S, S);
  base(c, model);
  const cover = coverContent(c, model, message);
  const pages = 1 + cover.pages.length;
  if (pageIndex > 0) {
    const blocks = cover.pages[pageIndex - 1];
    if (!blocks) throw new Error("This certificate page is unavailable.");
    drawPortrait(c, model, photo, 124, 181, 37);
    text(c, "Recognition notes", 700, 178, 42, C.ink, "center", 600);
    text(
      c,
      `${model.name} · Certificate ${model.issued ? model.id : "preview"}`,
      700,
      207,
      14,
      C.muted,
    );
    let y = 252;
    for (const block of blocks) {
      text(
        c,
        block.kind === "message"
          ? `Personal commendation${block.continued ? " · continued" : ""}`
          : `Entry #${block.event_number || "—"} · ${block.points > 0 ? "+" : ""}${block.points} points${block.continued ? " · continued" : ""}`,
        100,
        y,
        13,
        model.leader ? C.gold : C.green,
        "left",
        500,
      );
      y += 30;
      for (const line of block.lines) {
        text(c, line, 100, y, 18, C.ink, "left");
        y += 26;
      }
      rule(c, 100, y + 9, 1300, y + 9);
      y += 28;
    }
    await footer(c, model, pageIndex + 1, pages);
    return canvas;
  }
  portraitPanel(c, model, photo, art);
  coverHeading(c, model);
  coverMetrics(c, model);
  drawCoverContent(c, cover, model);
  await footer(c, model, 1, pages);
  return canvas;
}
export function canvasPng(canvas) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("The image could not be created. Try again.")),
      "image/png",
    ),
  );
}
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function certificatePdf(canvas, model, message = "") {
  const { PDFDocument, PDFName, PDFString } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Ludo Super League · ${model.name}`);
  pdf.setCreator("Ludo Super League");
  const count = await certificatePageCount(model, message);
  for (let i = 0; i < count; i++) {
    const source =
      i === 0
        ? canvas
        : await renderCertificate(
            document.createElement("canvas"),
            model,
            message,
            i,
          );
    const image = await pdf.embedPng(
      await (await canvasPng(source)).arrayBuffer(),
    );
    const page = pdf.addPage([841.89, 595.276]);
    page.drawImage(image, { x: 0, y: 0, width: 841.89, height: 595.276 });
    const link = pdf.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [48, 26, 510, 88],
      Border: [0, 0, 0],
      A: {
        Type: "Action",
        S: "URI",
        URI: PDFString.of(
          model.issued ? verificationUrl(model.id) : verificationUrl(),
        ),
      },
    });
    page.node.set(PDFName.of("Annots"), pdf.context.obj([link]));
    if (i > 0) {
      source.width = 1;
      source.height = 1;
    }
  }
  return new Blob([await pdf.save()], { type: "application/pdf" });
}
export async function certificatePngBundle(canvas, model, message = "") {
  const count = await certificatePageCount(model, message);
  if (count === 1) return { blob: await canvasPng(canvas), extension: "png" };
  const { zipSync } = await import("fflate");
  const files = {};
  for (let i = 0; i < count; i++) {
    const source =
      i === 0
        ? canvas
        : await renderCertificate(
            document.createElement("canvas"),
            model,
            message,
            i,
          );
    files[`certificate-page-${String(i + 1).padStart(2, "0")}.png`] =
      new Uint8Array(await (await canvasPng(source)).arrayBuffer());
    if (i > 0) {
      source.width = 1;
      source.height = 1;
    }
  }
  return {
    blob: new Blob([zipSync(files, { level: 0 })], { type: "application/zip" }),
    extension: "zip",
  };
}
