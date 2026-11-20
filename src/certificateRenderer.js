import QRCode from "qrcode";
import "@fontsource/cinzel/latin-600.css";
import "@fontsource/baskervville/latin-400.css";
import { verificationUrl } from "./certificateService";
import { playerMonogram, playerPortraitFile } from "./playerPortraits";
const W = 1400,
  H = 990,
  S = 2.5;
const midnight = {
  paper: "#0b1628",
  ink: "#fbf0db",
  muted: "#c6c6c9",
  accent: "#d5b671",
  line: "#706044",
  notice: "#ffbdb2",
  left: 84,
  width: 600,
};
const ivory = {
  paper: "#fbf3e5",
  ink: "#1d2a42",
  muted: "#48556b",
  accent: "#765725",
  line: "#b69a69",
  notice: "#962f2c",
  left: 98,
  width: 670,
};
const notesTop = 658;
const notesBottom = 825;
const assetCache = new Map();

const displayFont = (leader) =>
  leader ? '600 132px "Cinzel"' : '400 107px "Baskervville"';

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
  size,
  color,
  align = "center",
  weight = 400,
  family = "DM Sans",
) {
  c.font = `${weight} ${size}px "${family}"`;
  c.fillStyle = color;
  c.textAlign = align;
  c.fillText(String(t), x, y);
}
function rule(c, x, y, x2, y2, color) {
  c.beginPath();
  c.strokeStyle = color;
  c.lineWidth = 1;
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

function base(c, theme, leader) {
  c.fillStyle = theme.paper;
  c.fillRect(0, 0, W, H);
  c.strokeStyle = theme.line;
  c.lineWidth = 1;
  c.strokeRect(35.5, 34.5, W - 71, H - 69);
  if (leader) {
    c.strokeStyle = theme.accent;
    c.strokeRect(25.5, 24.5, W - 51, H - 49);
  }
  text(c, "Ludo Super League", theme.left, 91, 24, theme.ink, "left", 600);
  text(c, "Évry 2026", 1318, 91, 22, theme.muted, "right");
}

function drawPortrait(c, model, theme, photo, x, y, radius) {
  c.save();
  c.beginPath();
  c.arc(x, y, radius, 0, 2 * Math.PI);
  c.clip();
  if (photo) {
    drawCoverImage(c, photo, x - radius, y - radius, radius * 2, radius * 2);
  } else {
    c.fillStyle = model.leader ? "#263855" : "#e9dbc0";
    c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    text(
      c,
      playerMonogram(model.name),
      x,
      y + radius * 0.24,
      radius * 0.72,
      theme.ink,
      "center",
      600,
    );
  }
  c.restore();
  c.beginPath();
  c.arc(x, y, radius + 4, 0, 2 * Math.PI);
  c.strokeStyle = theme.accent;
  c.lineWidth = model.leader ? 3 : 1.5;
  c.stroke();
}

function coverArtwork(c, model, art) {
  if (!art) return;
  if (model.leader) {
    const height = 718;
    const width = (height * art.naturalWidth) / art.naturalHeight;
    c.drawImage(art, 1025 - width / 2, 119, width, height);
  } else {
    drawCoverImage(c, art, 833, 146, 489, 681);
  }
}

function coverHeading(c, model, theme) {
  const x = theme.left;
  if (model.leader) {
    const [, firstLine, secondLine] = model.awardName.match(/^(\S+) (.+)$/);
    text(c, firstLine, x - 6, 298, 132, theme.accent, "left", 600, "Cinzel");
    c.letterSpacing = "6px";
    text(c, secondLine, x, 368, 46, theme.accent, "left", 600, "Cinzel");
    c.letterSpacing = "0px";
  } else {
    text(c, "Certificate of", x, 236, 43, theme.ink, "left", 400, "Baskervville");
    text(c, "Recognition", x - 5, 338, 107, theme.ink, "left", 400, "Baskervville");
  }
}

function coverRecipient(c, model, theme, photo) {
  const radius = 56;
  const x = theme.left + radius + 4;
  const y = 464;
  drawPortrait(c, model, theme, photo, x, y, radius);
  const labelX = x + radius + 29;
  text(c, "Presented to", labelX, 445, 21, theme.muted, "left");
  const maxWidth = theme.left + theme.width - labelX;
  const name = model.name.toLocaleUpperCase("fr-FR");
  c.font = '600 61px "DM Sans"';
  const size = Math.min(
    61,
    Math.floor((61 * maxWidth) / c.measureText(name).width),
  );
  text(c, name, labelX, 496, size, theme.ink, "left", 600);
}

function coverMetrics(c, model, theme) {
  const metrics = [
    ["League position", `#${String(model.rank).padStart(2, "0")}`],
    ["Penalty points", model.points],
  ];
  metrics.forEach(([label, value], index) => {
    const x = theme.left + index * 206;
    text(c, value, x, 590, 47, theme.ink, "left", 600);
    text(c, label, x, 620, 19, theme.muted, "left");
  });
  rule(c, theme.left, 637, theme.left + theme.width, 637, theme.line);
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
function coverContent(c, model, message, theme) {
  const note = personalNote(model, message);
  const comments = model.comments || [];
  const latest = comments.at(-1)?.reason || "";
  const facts = model.commendations.flatMap((line) =>
    wrap(c, line, theme.width, 17),
  );
  const groups = [];
  const rows = comments.length > 1 ? [...comments] : [];
  let available = notesBottom - notesTop - facts.length * 22 - 23;
  function tryCover(heading, content) {
    const lines = wrap(c, content, theme.width, 17);
    const height = 29 + lines.length * 22;
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
  const theme = model.leader ? midnight : ivory;
  return 1 + coverContent(c, model, message, theme).pages.length;
}

function drawCoverContent(c, content, theme) {
  let y = notesTop;
  for (const line of content.facts) {
    text(c, line, theme.left, y, 17, theme.muted, "left");
    y += 22;
  }
  for (const group of content.groups) {
    y += 6;
    text(
      c,
      group.heading,
      theme.left,
      y,
      15,
      theme.accent,
      "left",
      600,
    );
    y += 23;
    for (const line of group.lines) {
      text(c, line, theme.left, y, 17, theme.ink, "left");
      y += 22;
    }
    y += 6;
  }
  if (content.pages.length)
    text(
      c,
      "Recognition notes on the following pages",
      theme.left,
      notesBottom,
      16,
      theme.accent,
      "left",
      600,
    );
}

async function footer(c, model, theme, pageNo, pageCount) {
  rule(c, 82, 848, 1318, 848, theme.line);
  const url = model.issued ? verificationUrl(model.id) : verificationUrl();
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, url, {
    width: 210,
    margin: 4,
    errorCorrectionLevel: "M",
    color: { dark: midnight.paper, light: "#fffaf0" },
  });
  c.imageSmoothingEnabled = false;
  c.drawImage(qr, 82, 862, 84, 84);
  c.imageSmoothingEnabled = true;
  text(
    c,
    model.revokedAt
      ? "REVOKED certificate • check the record"
      : model.issued
        ? model.demo
          ? "Demo issuance • this browser only"
          : "Issued certificate • verify the record"
        : "Unissued preview • not a verified award",
    188,
    876,
    16,
    model.revokedAt || model.demo ? theme.notice : theme.ink,
    "left",
    600,
  );
  text(
    c,
    model.issued
      ? model.id
      : "Sign in as scorekeeper to issue a verifiable certificate",
    188,
    898,
    13,
    theme.muted,
    "left",
  );
  text(
    c,
    model.issued
      ? `Record fingerprint: ${String(model.contentHash).slice(0, 20)}`
      : "Scan to open the certificate verification page",
    188,
    918,
    13,
    theme.muted,
    "left",
  );
  text(c, url.replace(/^https?:\/\//, ""), 188, 940, 13, theme.accent, "left", 500);
  text(c, `${model.dateLabel} · Europe/Paris`, 1318, 876, 13, theme.muted, "right");
  text(c, `Page ${pageNo} of ${pageCount}`, 1318, 898, 13, theme.muted, "right");
  text(
    c,
    "Awarded for the league’s penalty standings",
    1318,
    940,
    13,
    theme.muted,
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
    pageIndex === 0 ? certificateImage("certificate-midnight-trophy.webp") : null,
    pageIndex === 0 ? document.fonts.load(displayFont(model.leader)) : null,
    document.fonts.load('400 18px "DM Sans"'),
    document.fonts.load('500 64px "DM Sans"'),
    document.fonts.load('600 72px "DM Sans"'),
  ]);
  canvas.width = W * S;
  canvas.height = H * S;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("Your browser could not create the certificate.");
  c.scale(S, S);
  c.imageSmoothingQuality = "high";
  const theme = model.leader ? midnight : ivory;
  base(c, theme, model.leader);
  const cover = coverContent(c, model, message, theme);
  const pages = 1 + cover.pages.length;
  if (pageIndex > 0) {
    const blocks = cover.pages[pageIndex - 1];
    if (!blocks) throw new Error("This certificate page is unavailable.");
    drawPortrait(c, model, theme, photo, 124, 181, 37);
    text(c, "Recognition notes", 700, 178, 42, theme.ink, "center", 600);
    text(
      c,
      `${model.name} · Certificate ${model.issued ? model.id : "preview"}`,
      700,
      207,
      14,
      theme.muted,
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
        theme.accent,
        "left",
        500,
      );
      y += 30;
      for (const line of block.lines) {
        text(c, line, 100, y, 18, theme.ink, "left");
        y += 26;
      }
      rule(c, 100, y + 9, 1300, y + 9, theme.line);
      y += 28;
    }
    await footer(c, model, theme, pageIndex + 1, pages);
    return canvas;
  }
  coverArtwork(c, model, art);
  coverHeading(c, model, theme);
  coverRecipient(c, model, theme, photo);
  coverMetrics(c, model, theme);
  drawCoverContent(c, cover, theme);
  await footer(c, model, theme, 1, pages);
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
  pdf.setTitle(`${model.awardName} · ${model.name}`);
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
      Rect: [49, 26, 510, 77],
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
