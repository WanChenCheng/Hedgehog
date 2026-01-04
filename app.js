/* global HH */
(() => {
  // ---------------- utils ----------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  }

  function mmddToday() {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function isNight() {
    const h = new Date().getHours();
    return h >= 22 || h < 6;
  }

  function normalizeMMDD(s) {
    const t = String(s || "").trim();
    const m = t.match(/^(\d{1,2})-(\d{1,2})$/);
    if (!m) return null;
    const mm = clamp(parseInt(m[1], 10), 1, 12);
    const dd = clamp(parseInt(m[2], 10), 1, 31);
    return `${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }

  // ---------------- DOM ----------------
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d", { alpha: true });
  const tabsEl = document.getElementById("tabs");
  const panelEl = document.getElementById("panel");
  const subtitleEl = document.getElementById("subtitle");
  const birthdayInput = document.getElementById("birthdayInput");

  // ---------------- state ----------------
  const state = {
    mode: "daily",
    awake: true,
    blush: false,
    opts: { dirty: 0.18, mesh: 0.55, tongue: false },
    birthday: "09-18",
    idleMs: 0,

    pressing: false,
    longPressFired: false,

    // render control
    needsRedraw: true,
    running: false,
    rafId: 0,
    lastTs: performance.now(),
    lastDrawTs: 0,

    // sleep animation
    bob: 0, // -1..1
  };

  // ---------------- persistence ----------------
  const LS = {
    birthday: "HH_BIRTHDAY",
    quoteKey: "HH_QUOTE_KEY",
    quoteText: "HH_QUOTE_TEXT",
  };

  try {
    const saved = localStorage.getItem(LS.birthday);
    const norm = normalizeMMDD(saved);
    if (norm) state.birthday = norm;
  } catch {}

  birthdayInput.value = state.birthday;

  // ---------------- tabs ----------------
  const MODES = [
    ["daily", "今天"],
    ["sleep", "哄睡"],
    ["care", "照顧"],
    ["birthday", "生日"],
    ["quote", "一句話"],
  ];

  MODES.forEach(([id, label]) => {
    const el = document.createElement("div");
    el.className = "tab";
    el.textContent = label;
    el.dataset.mode = id;
    el.onclick = () => switchMode(id);
    tabsEl.appendChild(el);
  });

  function setSubtitle() {
    if (state.mode === "sleep") subtitleEl.textContent = "哄睡互動 · 點一下眨眼、長按睡著";
    else if (state.mode === "care") subtitleEl.textContent = "照顧模式 · 調整髒舊、網格、吐舌";
    else if (state.mode === "birthday") subtitleEl.textContent = "生日模式 · 設定日期，當天會特別開心";
    else if (state.mode === "quote") subtitleEl.textContent = "一句話 · 給你一小段溫柔";
    else subtitleEl.textContent = "奶茶色 · 睡前陪伴";
  }

  function switchMode(mode) {
    state.mode = mode;
    state.idleMs = 0;
    state.pressing = false;
    state.longPressFired = false;

    // 進睡眠模式：預設醒著，之後依 idle / 長按變化
    if (mode === "sleep") state.awake = true;

    // 生日模式：當天自動腮紅
    if (mode === "birthday") {
      state.blush = (normalizeMMDD(state.birthday) === mmddToday());
    } else if (mode !== "birthday") {
      // 其他模式別強制關腮紅（保留照顧裡手動開）
      // 但如果原本是生日自動腮紅，切走就回預設 false
      if (state.blush && normalizeMMDD(state.birthday) === mmddToday()) state.blush = false;
    }

    setSubtitle();
    setActiveTab();
    renderPanel();
    requestRedraw();
    ensureLoop();
  }

  function setActiveTab() {
    [...tabsEl.children].forEach((el) => {
      el.classList.toggle("active", el.dataset.mode === state.mode);
    });
  }

  // ---------------- canvas sizing (throttled) ----------------
  let lastRectW = 0;
  let lastRectH = 0;
  let lastDpr = 0;

  function resizeCanvasIfNeeded() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);

    // 只有尺寸或 dpr 變了才重新設定
    if (r.width === lastRectW && r.height === lastRectH && dpr === lastDpr) return false;

    lastRectW = r.width;
    lastRectH = r.height;
    lastDpr = dpr;

    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      return true;
    }
    return false;
  }

  let resizeScheduled = false;
  function scheduleResize() {
    if (resizeScheduled) return;
    resizeScheduled = true;
    requestAnimationFrame(() => {
      resizeScheduled = false;
      const changed = resizeCanvasIfNeeded();
      if (changed) requestRedraw();
      ensureLoop();
    });
  }
  window.addEventListener("resize", scheduleResize, { passive: true });

  // ---------------- rendering ----------------
  function draw() {
    // resize if needed (cheap check)
    const changed = resizeCanvasIfNeeded();
    if (changed) state.needsRedraw = true;

    if (!state.needsRedraw) return;

    state.needsRedraw = false;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 背景淡影
    ctx.fillStyle = "rgba(0,0,0,.06)";
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2 + h * 0.02 + state.bob * (h * 0.01);
    const scale = Math.min(w, h) / 280;

    HH.drawHedgehog(ctx, cx, cy, scale, state.awake, state.blush, { ...state.opts });
  }

  function requestRedraw() {
    state.needsRedraw = true;
  }

  // ---------------- quotes ----------------
  const QUOTES = [
    "你已經很努力了喔。",
    "慢慢來沒關係，我在。",
    "今天做不到的，明天也可以再試一次。",
    "別急著證明什麼，先照顧好自己。",
    "就算只前進一小步，也是一種前進。",
    "你值得被溫柔對待，包括你自己。",
  ];

  function getDailyQuote() {
    const key = todayKey();
    try {
      const lastKey = localStorage.getItem(LS.quoteKey);
      const lastText = localStorage.getItem(LS.quoteText);
      if (lastKey === key && lastText) return { key, text: lastText };
    } catch {}

    const idx = Math.floor(Math.random() * QUOTES.length);
    const text = QUOTES[idx];

    try {
      localStorage.setItem(LS.quoteKey, key);
      localStorage.setItem(LS.quoteText, text);
    } catch {}

    return { key, text };
  }

  function getRandomQuote() {
    const idx = Math.floor(Math.random() * QUOTES.length);
    return QUOTES[idx];
  }

  // ---------------- panel UI helpers ----------------
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function btn(text, primary, onClick) {
    const b = el("button", primary ? "btn primary" : "btn", text);
    b.type = "button";
    b.onclick = onClick;
    return b;
  }

  function fieldRow(labelText, rightNode) {
    const row = el("div", "field");
    const lab = el("label", "", labelText);
    row.appendChild(lab);
    row.appendChild(rightNode);
    return row;
  }

  function renderPanel() {
    panelEl.innerHTML = "";
    panelEl.appendChild(el("div", "panelTitle", "狀態"));

    if (state.mode === "daily") {
      const q = getDailyQuote();

      panelEl.appendChild(el("div", "quote", q.text));

      const r = el("div", "row");
      r.appendChild(btn("眨眼一下", false, () => blink()));
      r.appendChild(btn("臉紅一下", false, () => {
        state.blush = !state.blush;
        requestRedraw();
        ensureLoop();
      }));
      panelEl.appendChild(r);

      panelEl.appendChild(el("div", "hint", "小提醒：今天的句子每天只會換一次。"));
      return;
    }

    if (state.mode === "sleep") {
      panelEl.appendChild(el("div", "quote", isNight()
        ? "現在很晚了，讓我們慢慢放鬆。"
        : "如果想休息一下，也可以先把眼睛閉起來。"));

      const r = el("div", "row");
      r.appendChild(btn("眨眼", false, () => blink()));
      r.appendChild(btn("睡著", true, async () => {
        await longSleep();
        requestRedraw();
        ensureLoop();
      }));
      r.appendChild(btn("叫醒", false, () => {
        state.awake = true;
        state.idleMs = 0;
        requestRedraw();
        ensureLoop();
      }));
      panelEl.appendChild(r);

      panelEl.appendChild(el("div", "hint", "互動：點一下眨眼；長按畫面會睡著。"));
      return;
    }

    if (state.mode === "care") {
      const dirtyWrap = el("div", "");
      const dirty = document.createElement("input");
      dirty.type = "range";
      dirty.min = "0";
      dirty.max = "1";
      dirty.step = "0.01";
      dirty.value = String(state.opts.dirty);
      dirty.oninput = () => {
        state.opts.dirty = parseFloat(dirty.value);
        requestRedraw();
        ensureLoop();
      };
      dirtyWrap.appendChild(dirty);

      const meshWrap = el("div", "");
      const mesh = document.createElement("input");
      mesh.type = "range";
      mesh.min = "0";
      mesh.max = "1";
      mesh.step = "0.01";
      mesh.value = String(state.opts.mesh);
      mesh.oninput = () => {
        state.opts.mesh = parseFloat(mesh.value);
        requestRedraw();
        ensureLoop();
      };
      meshWrap.appendChild(mesh);

      const tongueWrap = el("div", "");
      const tongue = document.createElement("input");
      tongue.type = "checkbox";
      tongue.checked = !!state.opts.tongue;
      tongue.onchange = () => {
        state.opts.tongue = tongue.checked;
        requestRedraw();
        ensureLoop();
      };
      tongueWrap.appendChild(tongue);

      const blushWrap = el("div", "");
      const blush = document.createElement("input");
      blush.type = "checkbox";
      blush.checked = !!state.blush;
      blush.onchange = () => {
        state.blush = blush.checked;
        requestRedraw();
        ensureLoop();
      };
      blushWrap.appendChild(blush);

      panelEl.appendChild(fieldRow("髒舊程度", dirtyWrap));
      panelEl.appendChild(fieldRow("網格感", meshWrap));
      panelEl.appendChild(fieldRow("吐舌", tongueWrap));
      panelEl.appendChild(fieldRow("腮紅", blushWrap));

      const r = el("div", "row");
      r.appendChild(btn("重置", false, () => {
        state.opts.dirty = 0.18;
        state.opts.mesh = 0.55;
        state.opts.tongue = false;
        state.blush = false;
        renderPanel();
        requestRedraw();
        ensureLoop();
      }));
      r.appendChild(btn("眨眼一下", false, () => blink()));
      panelEl.appendChild(r);

      panelEl.appendChild(el("div", "hint", "你可以把它想像成幫刺蝟整理一下狀態。"));
      return;
    }

    if (state.mode === "birthday") {
      const today = mmddToday();
      const b = normalizeMMDD(state.birthday) || "09-11";
      const isBday = (b === today);

      const msg = isBday
        ? "今天是你的日子。你不需要很厲害，也值得被喜歡。"
        : `你的生日設定為 ${b}（今天是 ${today}）`;

      panelEl.appendChild(el("div", "quote", msg));

      const r = el("div", "row");
      r.appendChild(btn("幫我慶祝", true, async () => {
        state.blush = true;
        state.opts.tongue = true;
        state.awake = true;
        requestRedraw();
        ensureLoop();
        await sleep(900);
        state.opts.tongue = false;
        requestRedraw();
        ensureLoop();
      }));
      r.appendChild(btn("眨眼一下", false, () => blink()));
      panelEl.appendChild(r);

      panelEl.appendChild(el("div", "hint", "生日日期輸入格式：MM-DD（例如 09-11）。"));
      return;
    }

    if (state.mode === "quote") {
      const q = el("div", "quote", getRandomQuote());
      panelEl.appendChild(q);

      const r = el("div", "row");
      r.appendChild(btn("換一句", true, () => {
        q.textContent = getRandomQuote();
      }));
      r.appendChild(btn("眨眼一下", false, () => blink()));
      panelEl.appendChild(r);

      panelEl.appendChild(el("div", "hint", "如果你想把句子換成你自己的，抱歉此功能尚未開發。"));
      return;
    }
  }

  // ---------------- interactions ----------------
  let pressTimer = null;

  async function blink() {
    const prev = state.awake;
    state.awake = false;
    requestRedraw(); ensureLoop();
    await sleep(160);
    state.awake = prev;
    requestRedraw(); ensureLoop();
  }

  async function longSleep() {
    state.awake = true;
    requestRedraw(); ensureLoop();
    await sleep(140);
    state.awake = false;
    requestRedraw(); ensureLoop();
  }

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);

    if (state.mode !== "sleep") return;
    state.pressing = true;
    state.longPressFired = false;

    pressTimer = setTimeout(async () => {
      if (!state.pressing) return;
      state.longPressFired = true;
      await longSleep();
    }, 520);
  });

  canvas.addEventListener("pointerup", async (e) => {
    try { canvas.releasePointerCapture(e.pointerId); } catch {}

    if (state.mode !== "sleep") return;

    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }

    if (!state.longPressFired) {
      await blink();
    }

    state.pressing = false;
    state.longPressFired = false;
  });

  canvas.addEventListener("pointerleave", (e) => {
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
    state.pressing = false;
    state.longPressFired = false;
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
  });

  // ---------------- birthday input ----------------
  birthdayInput.addEventListener("change", () => {
    const norm = normalizeMMDD(birthdayInput.value);
    if (!norm) {
      birthdayInput.value = state.birthday; // 回填舊值
      return;
    }
    state.birthday = norm;
    birthdayInput.value = norm;
    try { localStorage.setItem(LS.birthday, norm); } catch {}

    if (state.mode === "birthday") {
      state.blush = (norm === mmddToday());
      renderPanel();
      requestRedraw();
      ensureLoop();
    }
  });

  // ---------------- loop (only when needed) ----------------
  function shouldAnimate() {
    // 只有 sleep 模式需要溫柔動畫；其他模式只在互動/變更時 redraw 一次
    if (state.mode !== "sleep") return false;

    // sleep 模式：醒著時會隨 idle 慢慢睡著 + 有輕微 bob
    return true;
  }

  function ensureLoop() {
    if (state.running) return;
    // 有需要才開 loop
    if (!state.needsRedraw && !shouldAnimate()) return;

    state.running = true;
    state.lastTs = performance.now();
    state.rafId = requestAnimationFrame(tick);
  }

  function stopLoopIfIdle() {
    if (state.mode === "sleep") return; // sleep 需要持續
    if (state.needsRedraw) return;      // 還要畫
    state.running = false;
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = 0;
  }

  function tick(ts) {
    const dt = ts - state.lastTs;
    state.lastTs = ts;

    if (state.mode === "sleep") {
      state.idleMs += dt;

      const th = isNight() ? 10000 : 30000;
      if (state.idleMs > th && state.awake) {
        state.awake = false;
        requestRedraw();
      }

      // 低負載 bob：醒著更明顯，睡著更小
      const speed = state.awake ? 0.0012 : 0.0007;
      state.bob = Math.sin(ts * speed) * (state.awake ? 1 : 0.6);
      requestRedraw(); // sleep 需要持續更新 bob
    } else {
      state.bob = 0;
    }

    // 限制 sleep 模式繪製頻率：最多約 30fps（避免卡頓）
    const minFrameMs = (state.mode === "sleep") ? 33 : 0;
    if (ts - state.lastDrawTs >= minFrameMs) {
      draw();
      state.lastDrawTs = ts;
    }

    // 繼續或停下
    if (state.needsRedraw || shouldAnimate()) {
      state.rafId = requestAnimationFrame(tick);
    } else {
      stopLoopIfIdle();
    }
  }

  // ---------------- init ----------------
  setSubtitle();
  setActiveTab();
  scheduleResize();
  renderPanel();
  requestRedraw();
  ensureLoop();
})();
