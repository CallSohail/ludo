// A single canvas is used for preview, PNG and PDF, keeping exports identical.
const WIDTH = 1400,
  HEIGHT = 990,
  SCALE = 2.5;
function lines(ctx, text, maxWidth) {
  const result = [];
  for (const paragraph of String(text).split("\n")) {
    if (!paragraph) {
      result.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth) {
        line = next;
        continue;
      }
      if (line) {
        result.push(line);
        line = "";
      }
      if (ctx.measureText(word).width <= maxWidth) {
        line = word;
        continue;
      }
      for (const char of Array.from(word)) {
        if (ctx.measureText(line + char).width > maxWidth && line) {
          result.push(line);
          line = "";
        }
        line += char;
      }
    }
    if (line) result.push(line);
  }
  return result;
}
function text(
  ctx,
  value,
  x,
  y,
  { font = '18px "DM Sans"', color = "#263e35", align = "left" } = {},
) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(String(value), x, y);
}
function rule(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function seal(ctx, x, y, rank, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = "#f7f3e9";
  ctx.lineWidth = 1.2;
  for (const r of [68, 60, 53]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI) / 16;
    rule(
      ctx,
      x + Math.cos(a) * 63,
      y + Math.sin(a) * 63,
      x + Math.cos(a) * 67,
      y + Math.sin(a) * 67,
      color,
      1,
    );
  }
  if (rank === 1) {
    ctx.beginPath();
    ctx.moveTo(x - 18, y - 30);
    ctx.lineTo(x - 14, y - 44);
    ctx.lineTo(x - 5, y - 36);
    ctx.lineTo(x, y - 49);
    ctx.lineTo(x + 6, y - 36);
    ctx.lineTo(x + 18, y - 44);
    ctx.lineTo(x + 14, y - 26);
    ctx.lineTo(x - 14, y - 26);
    ctx.closePath();
    ctx.stroke();
  }
  text(ctx, `#${rank}`, x, y + 14, {
    font: `600 ${rank === 1 ? 40 : 47}px "Cormorant Garamond"`,
    color,
    align: "center",
  });
  text(ctx, "POSITION", x, y + 34, {
    font: '9px "DM Sans"',
    color,
    align: "center",
  });
  ctx.restore();
}
export async function renderCertificate(canvas, model, message = "") {
  if (!canvas)
    throw new Error("Certificate preview is unavailable. Please try again.");
  await Promise.all([
    document.fonts.load('400 18px "DM Sans"'),
    document.fonts.load('500 24px "DM Sans"'),
    document.fonts.load('400 24px "Cormorant Garamond"'),
    document.fonts.load('600 72px "Cormorant Garamond"'),
  ]);
  canvas.width = WIDTH * SCALE;
  canvas.height = HEIGHT * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new Error(
      "Your browser could not create the certificate. Try another browser.",
    );
  ctx.scale(SCALE, SCALE);
  const ink = "#183c31",
    muted = "#546659",
    gold = model.leader
      ? "#94703a"
      : model.rank === 2
        ? "#667b75"
        : model.rank === 3
          ? "#a16c51"
          : "#9b7383";
  ctx.fillStyle = "#f7f3e9";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = gold;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(30, 30, 1340, 930);
  ctx.strokeStyle = "#c9c6b5";
  ctx.lineWidth = 0.6;
  ctx.strokeRect(42, 42, 1316, 906);
  // Fine corner ornaments borrow the geometry of the Ludo board.
  for (const [x, y, sx, sy] of [
    [58, 58, 1, 1],
    [1342, 58, -1, 1],
    [58, 932, 1, -1],
    [1342, 932, -1, -1],
  ]) {
    const ornament = sy === -1 ? 32 : 68;
    rule(ctx, x, y, x + sx * ornament, y, gold, 2);
    rule(ctx, x, y, x, y + sy * ornament, gold, 2);
    ctx.fillStyle = gold;
    ctx.fillRect(x + sx * 10 - 2, y + sy * 10 - 2, 4, 4);
  }
  text(ctx, "LUDO", 100, 105, { font: '500 29px "DM Sans"', color: ink });
  text(ctx, "SUPER LEAGUE", 100, 125, { font: '11px "DM Sans"', color: muted });
  text(ctx, "ÉVRY 2026", 1300, 102, {
    font: '12px "DM Sans"',
    color: ink,
    align: "right",
  });
  text(
    ctx,
    model.leader ? "THE CROWN EDITION" : "THE LEAGUE COLLECTION",
    1300,
    124,
    { font: '10px "DM Sans"', color: gold, align: "right" },
  );
  rule(ctx, 100, 152, 1300, 152, "#c7c8b8");
  text(ctx, "Certificate of recognition", 100, 221, {
    font: '600 54px "Cormorant Garamond"',
    color: ink,
  });
  text(ctx, model.title, 102, 257, { font: '500 18px "DM Sans"', color: gold });
  seal(ctx, 1215, 244, model.rank, gold);
  text(ctx, "Presented to", 102, 310, { font: '14px "DM Sans"', color: muted });
  let nameSize = 76;
  ctx.font = `600 ${nameSize}px "Cormorant Garamond"`;
  while (ctx.measureText(model.name).width > 1178 && nameSize > 34) {
    nameSize -= 2;
    ctx.font = `600 ${nameSize}px "Cormorant Garamond"`;
  }
  const nameLines = lines(ctx, model.name, 1178);
  const nameY = 378;
  for (let i = 0; i < nameLines.length; i++)
    text(ctx, nameLines[i], 100, nameY + i * (nameSize + 2), {
      font: `600 ${nameSize}px "Cormorant Garamond"`,
      color: ink,
    });
  const start = 420 + Math.max(0, nameLines.length - 1) * (nameSize + 2);
  text(
    ctx,
    "In recognition of a place in our league’s friendly rivalry,",
    102,
    start,
    { font: '400 24px "Cormorant Garamond"', color: muted },
  );
  text(ctx, "and a record that belongs to the table.", 102, start + 27, {
    font: '400 24px "Cormorant Garamond"',
    color: muted,
  });
  let y = start + 70;
  const bottomLimit = 792;
  const notes = message.trim();
  let fontSize = 17;
  const measure = (size) => {
    ctx.font = `400 ${size}px "DM Sans"`;
    return (
      model.commendations
        .map((c) => lines(ctx, c, 1154))
        .reduce((n, l) => n + l.length * (size + 7) + 8, 0) +
      (notes ? lines(ctx, notes, 1180).length * (size + 7) + 42 : 0)
    );
  };
  while (measure(fontSize) > bottomLimit - y && fontSize > 12) fontSize--;
  for (const commendation of model.commendations) {
    ctx.font = `400 ${fontSize}px "DM Sans"`;
    const wrapped = lines(ctx, commendation, 1154);
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.arc(107, y - 5, 2, 0, Math.PI * 2);
    ctx.fill();
    for (const line of wrapped) {
      text(ctx, line, 122, y, {
        font: `400 ${fontSize}px "DM Sans"`,
        color: ink,
      });
      y += fontSize + 7;
    }
    y += 8;
  }
  if (notes) {
    y += 10;
    text(ctx, "A message from the table", 102, y, {
      font: '500 12px "DM Sans"',
      color: gold,
    });
    y += 25;
    ctx.font = `400 ${fontSize}px "DM Sans"`;
    for (const line of lines(ctx, notes, 1180)) {
      text(ctx, line, 102, y, {
        font: `400 ${fontSize}px "DM Sans"`,
        color: ink,
      });
      y += fontSize + 7;
    }
  }
  if (y > 810)
    throw new Error(
      "This message is too long to fit this certificate. Shorten it and try again.",
    );
  rule(ctx, 100, 823, 1300, 823, "#c7c8b8");
  const metrics = [
    ["CURRENT POSITION", `${model.rank} / ${model.total}`],
    ["PENALTY POINTS", model.points],
    [
      "RECORDED AWARDS",
      model.historyAvailable ? model.metric.awards : "Not available",
    ],
  ];
  metrics.forEach(([label, value], i) => {
    const x = 102 + i * 397;
    text(ctx, label, x, 850, { font: '10px "DM Sans"', color: muted });
    text(ctx, value, x, 885, {
      font: '600 30px "Cormorant Garamond"',
      color: ink,
    });
  });
  text(
    ctx,
    `Standings snapshot · ${model.dateLabel} · Europe/Paris`,
    102,
    919,
    { font: '10px "DM Sans"', color: muted },
  );
  text(ctx, model.id, 1300, 919, {
    font: '10px "DM Sans"',
    color: muted,
    align: "right",
  });
  text(
    ctx,
    "Recognition of recorded penalties, not a match-win award. Positions may change as scores are updated.",
    102,
    938,
    { font: '9px "DM Sans"', color: muted },
  );
  return canvas;
}
export function canvasPng(canvas) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(
              new Error("The image could not be created. Please try again."),
            ),
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
export async function certificatePdf(canvas) {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle("Ludo Super League · Player recognition");
  pdf.setCreator("Ludo Super League");
  const png = await canvasPng(canvas);
  const image = await pdf.embedPng(await png.arrayBuffer());
  const page = pdf.addPage([841.89, 595.276]);
  page.drawImage(image, { x: 0, y: 0, width: 841.89, height: 595.276 });
  return new Blob([await pdf.save()], { type: "application/pdf" });
}
