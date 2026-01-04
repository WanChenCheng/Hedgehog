// draw_hedgehog.js
window.HH = window.HH || {};

// 小工具：固定的 pseudo-random（不會每帧閃）
// 用整數格點 + sin 產生「看起來隨機」的值
function hash01(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

HH.drawHedgehog = function (ctx, cx, cy, scale = 1, awake = true, blush = false, opts = {}) {
  // opts 可選：{ dirty=0.18, mesh=0.55, tongue=false }
  const {
    dirty = 0.18,     // 臉/背的髒舊程度
    mesh = 0.55,      // 背部網格感強度
    tongue = false,   // 本尊通常不吐舌
  } = opts;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // ========== 1) BACK (布偶背部：橢圓 + 網格 + 斑駁) ==========
  ctx.save();
  ctx.fillStyle = "#8a7a43"; // 橄欖咖啡
  ctx.beginPath();
  ctx.ellipse(0, 0, 95, 112, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.16 * mesh;
  ctx.strokeStyle = "rgba(255,255,255,.55)";
  ctx.lineWidth = 1;

  for (let i = -110; i <= 110; i += 8) {
    ctx.beginPath();
    ctx.moveTo(-110, i);
    ctx.lineTo(110, i - 60);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-110, i - 60);
    ctx.lineTo(110, i);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, 95, 112, 0, 0, Math.PI * 2);
  ctx.clip();

  for (let gx = -90; gx <= 90; gx += 6) {
    for (let gy = -105; gy <= 105; gy += 6) {
      const v = hash01(gx, gy);
      if (v < 0.62) continue;

      const a = (v - 0.62) / 0.38;
      ctx.globalAlpha = 0.10 + a * 0.20 * dirty;
      ctx.fillStyle = v > 0.86 ? "rgba(255,255,255,.75)" : "rgba(70,55,35,.85)";
      ctx.beginPath();
      ctx.arc(gx + (v - 0.5) * 4, gy + (0.5 - v) * 4, 2.2 + a * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.restore();

  // ========== 2) FACE (米色絨毛感) ==========
  ctx.save();
  ctx.fillStyle = "#d8cbbb";
  ctx.beginPath();
  ctx.ellipse(0, 18, 84, 78, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(0, 18, 84, 78, 0, 0, Math.PI * 2);
  ctx.clip();

  for (let gx = -80; gx <= 80; gx += 7) {
    for (let gy = -55; gy <= 85; gy += 7) {
      const v = hash01(gx + 999, gy + 777);
      if (v < 0.72) continue;
      ctx.globalAlpha = 0.05 + (v - 0.72) * 0.20 * dirty;
      ctx.fillStyle = "rgba(120,95,70,.8)";
      ctx.beginPath();
      ctx.arc(gx, gy + 18, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // ========== 3) EARS (外翻布耳) ==========
  function drawFlippedEar(x, y, flip = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(flip * 0.35);

    ctx.fillStyle = "#c9b8a6";
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#b8a796";
    ctx.beginPath();
    ctx.ellipse(flip * 4, 3, 10, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "rgba(90,70,50,.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 16, Math.PI * 0.2, Math.PI * 0.9);
    ctx.stroke();

    ctx.restore();
  }

  drawFlippedEar(-68, -14, -1);
  drawFlippedEar(68, -14, 1);

  // ========== 4) EYES (小黑豆眼) ==========
  if (awake) {
    ctx.fillStyle = "#1f1a17";
    ctx.beginPath(); ctx.arc(-30, 8, 9.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(30, 8, 9.5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.beginPath(); ctx.arc(-33, 5, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(27, 5, 2.2, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.strokeStyle = "#2b1a16";
    ctx.lineWidth = 4.5;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-42, 8); ctx.quadraticCurveTo(-30, 16, -18, 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(18, 8); ctx.quadraticCurveTo(30, 16, 42, 8); ctx.stroke();
  }

  // ========== 5) NOSE ==========
  ctx.fillStyle = "#141312";
  ctx.beginPath();
  ctx.arc(0, 48, 17, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "rgba(0,0,0,1)";
  ctx.beginPath();
  ctx.ellipse(0, 52, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(255,255,255,.20)";
  ctx.beginPath();
  ctx.arc(-6, 44, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,.22)";
  ctx.beginPath();
  ctx.ellipse(-6, 44, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = "#4a2a1f";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-10, 62);
  ctx.quadraticCurveTo(0, 66, 10, 62);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (awake && tongue) {
    ctx.fillStyle = "#ff8fb2";
    ctx.beginPath();
    ctx.moveTo(-5, 63);
    ctx.quadraticCurveTo(0, 74, 5, 63);
    ctx.closePath();
    ctx.fill();
  }

  if (blush) {
    ctx.fillStyle = "rgba(255,105,180,.18)";
    ctx.beginPath(); ctx.arc(-52, 40, 13, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(52, 40, 13, 0, Math.PI * 2); ctx.fill();
  }

  // ========== 6) PAWS ==========
  ctx.fillStyle = "#c9b8a6";
  ctx.beginPath(); ctx.ellipse(-42, 96, 14, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(42, 96, 14, 12, 0, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = "#c9b8a6";

  ctx.beginPath();
  ctx.ellipse(-42, 100, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(42, 100, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.restore();
};
