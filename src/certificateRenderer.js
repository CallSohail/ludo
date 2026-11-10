import QRCode from "qrcode";
import { verificationUrl } from "./certificateService";
const W = 1400,
  H = 990,
  S = 2.5;
const C = {
  paper: "#101512",
  panel: "#17221b",
  ink: "#f0f3e9",
  muted: "#b1bfae",
  green: "#b3e77f",
  pink: "#e1b0c3",
  line: "#3c5140",
  gold: "#dec18b",
};
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
function paragraph(
  c,
  t,
  x,
  y,
  width,
  size = 17,
  color = C.ink,
  align = "center",
) {
  for (const line of wrap(c, t, width, size)) {
    text(c, line, x, y, size, color, align);
    y += size + 8;
  }
  return y;
}
function base(c, model) {
  c.fillStyle = C.paper;
  c.fillRect(0, 0, W, H);
  c.fillStyle = C.green;
  c.fillRect(38, 38, 1324, 5);
  c.strokeStyle = C.line;
  c.lineWidth = 1;
  c.strokeRect(38, 38, 1324, 914);
  text(c, "Ludo Super League", 82, 88, 18, C.ink, "left", 500);
  text(c, "Évry 2026", 1318, 88, 16, C.muted, "right");
  if (model.leader) {
    c.strokeStyle = C.gold;
    c.lineWidth = 3;
    c.strokeRect(50, 50, 1300, 890);
  }
  if (model.leader) {
    c.fillStyle = C.gold;
    c.beginPath();
    c.moveTo(674, 65);
    c.lineTo(687, 75);
    c.lineTo(700, 59);
    c.lineTo(713, 75);
    c.lineTo(726, 65);
    c.lineTo(720, 85);
    c.lineTo(680, 85);
    c.closePath();
    c.fill();
    text(c, "CROWN EDITION · POSITION 01", 700, 104, 10, C.gold, "center", 500);
  }
  rule(c, 82, 112, 1318, 112);
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
function attachedNote(model, message) {
  const note = personalNote(model, message);
  return note.length > 250 || note.split("\n").length > 3;
}
function attachmentPages(c, model, message) {
  const rows = model.comments?.length > 1 ? [...model.comments] : [];
  if (attachedNote(model, message))
    rows.unshift({ kind: "message", reason: personalNote(model, message) });
  return commentBlocks(c, rows);
}
export async function certificatePageCount(model, message = "") {
  await document.fonts.load('400 18px "DM Sans"');
  const c = document.createElement("canvas").getContext("2d");
  return 1 + attachmentPages(c, model, message).length;
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
    model.issued && !model.revokedAt ? C.green : C.pink,
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
    "Penalty recognition, not a match-win award",
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
  await Promise.all([
    document.fonts.load('400 18px "DM Sans"'),
    document.fonts.load('500 64px "DM Sans"'),
    document.fonts.load('600 64px "DM Sans"'),
  ]);
  canvas.width = W * S;
  canvas.height = H * S;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("Your browser could not create the certificate.");
  c.scale(S, S);
  base(c, model);
  const comments = model.comments || [];
  const extra = attachmentPages(c, model, message);
  const pages = 1 + extra.length;
  if (pageIndex > 0) {
    const blocks = extra[pageIndex - 1];
    if (!blocks) throw new Error("This certificate page is unavailable.");
    text(c, "Recognition notes", 700, 174, 36, C.green, "center", 500);
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
        C.pink,
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
  // The recipient and recognition heading share the page's center axis.
  text(c, "Certificate of", 700, 175, 24, C.muted, "center", 400);
  text(c, "Recognition", 700, 242, 66, C.green, "center", 600);
  rule(c, 590, 269, 810, 269, C.pink, 2);
  text(
    c,
    model.title,
    700,
    307,
    18,
    model.leader ? C.gold : C.pink,
    "center",
    500,
  );
  text(c, "Presented to", 700, 352, 14, C.muted);
  let nameSize = 62;
  c.font = `500 ${nameSize}px "DM Sans"`;
  while (c.measureText(model.name).width > 1120 && nameSize > 26) {
    nameSize -= 2;
    c.font = `500 ${nameSize}px "DM Sans"`;
  }
  let nameLines = wrap(c, model.name, 1120, nameSize);
  if (nameLines.length > 2)
    throw new Error(
      "This name is too long to fit the certificate. Please shorten the player name.",
    );
  let y = 412;
  for (const line of nameLines) {
    text(c, line, 700, y, nameSize, C.ink, "center", 500);
    y += nameSize + 3;
  }
  y = Math.max(452, y + 5);
  const metrics = [
    ["Position", `${model.rank} / ${model.total}`],
    ["Penalty points", model.points],
    [
      "Recorded awards",
      model.historyAvailable ? model.metric.awards : "Not available",
    ],
  ];
  metrics.forEach(([label, value], i) => {
    const x = 360 + i * 340;
    text(c, label, x, y, 12, C.muted);
    text(
      c,
      value,
      x,
      y + 33,
      value === "Not available" ? 16 : 26,
      value === "Not available" ? C.muted : C.green,
      "center",
      500,
    );
  });
  y += 72;
  let size = 17;
  const note = attachedNote(model, message)
    ? "The full personal commendation appears on the following page."
    : personalNote(model, message);
  const quote = comments.at(-1)?.reason || "";
  const measure = (n) =>
    model.commendations.reduce(
      (sum, t) => sum + wrap(c, t, 1150, n).length * (n + 8) + 4,
      0,
    ) +
    (note ? wrap(c, note, 1120, n).length * (n + 8) + 30 : 0) +
    (quote ? wrap(c, quote, 1120, n).length * (n + 8) + 34 : 0);
  while (measure(size) > 792 - y && size > 13) size--;
  if (measure(size) > 801 - y)
    throw new Error(
      "The message has too many lines for the certificate. Shorten it or remove extra line breaks.",
    );
  for (const commendation of model.commendations) {
    y = paragraph(c, commendation, 700, y, 1150, size, C.muted);
    y += 4;
  }
  if (note) {
    y += 7;
    text(c, "A personal commendation", 700, y, 12, C.pink, "center", 500);
    y += 23;
    y = paragraph(c, note, 700, y, 1120, size, C.ink);
  }
  if (quote) {
    y += 8;
    text(
      c,
      comments.length > 1
        ? `From the table · all ${comments.length} comments attached`
        : "From the table",
      700,
      y,
      12,
      C.pink,
      "center",
      500,
    );
    y += 23;
    paragraph(c, `“${quote}”`, 700, y, 1120, size, C.ink);
  }
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
