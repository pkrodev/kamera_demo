(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const SEGMENTS = [
    { key: "car1", start: 0.0, end: 2.5, make: "Audi", color: "czerwony", plate: "WX123YZ" },
    { key: "car2", start: 2.5, end: 4.0, make: "BMW",  color: "zielony",  plate: "AB456CD" },
    { key: "car3", start: 4.0, end: 5.0, make: "BMW",  color: "czarny",   plate: "EF789GH" },
  ];

  const DEFAULT_PERMISSIONS = { car1: true, car2: true, car3: false };

  const state = {
    stage: 1,
    segmentIndex: 0,
    lastSegmentIndex: -1,
    lastTime: 0,
    lockUntil: 0,
    segmentSeen: [false, false, false],
    permissions: { ...DEFAULT_PERMISSIONS },
    history: [],
    demoInView: false,
    videoReady: false,
    decisionToken: 0,
  };

  const ctaSee = $("#ctaSee");
  const demoSection = $("#demo");

  const video = $("#cameraVideo");
  const videoPlaceholder = $("#videoPlaceholder");
  const overlay = $("#overlay");

  const toast = $("#toast");
  const toastText = $("#toastText");

  const btnPlay = $("#btnPlay");
  const btnRestart = $("#btnRestart");
  const btnFreeze = $("#btnFreeze");
  const jumpButtons = $$("[data-jump]");

  const dots = $$("[data-stage]");
  const barFill = $("#barFill");

  const plateText = $("#plateText");
  const colorText = $("#colorText");
  const makeTag = $("#makeTag");

  const pillPlate = $("#pillPlate");
  const pillMake = $("#pillMake");
  const pillColor = $("#pillColor");

  const s1State = $("#s1State");
  const s1Plate = $("#s1Plate");
  const s1Color = $("#s1Color");

  const stagePanels = $$("[data-stage-panel]");
  const btnNext1 = $("#btnNext1");
  const btnNext2 = $("#btnNext2");
  const btnBack2 = $("#btnBack2");
  const btnBack3 = $("#btnBack3");

  const checkingText = $("#checkingText");
  const toggleAllowed = $("#toggleAllowed");
  const toggleNeeds = $("#toggleNeeds");
  const decisionTitle = $("#decisionTitle");
  const decisionSub = $("#decisionSub");

  const historyBody = $("#historyBody");
  const historyEmpty = $("#historyEmpty");

  const btnAddToList = $("#btnAddToList");
  const btnOneTime = $("#btnOneTime");
  const btnRestartFlow = $("#btnRestartFlow");

  const uiToast = $("#uiToast");
  const uiToastText = $("#uiToastText");
  const btnQuote = $("#btnQuote");

  function nowMs() { return Date.now(); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function timeLabel() {
    const d = new Date();
    return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function getSegmentIndex(t) {
    for (let i = 0; i < SEGMENTS.length; i++) {
      const s = SEGMENTS[i];
      if (t >= s.start && t < (s.end - 0.0005)) return i;
    }
    return SEGMENTS.length - 1;
  }

  function getCurrentSegment() {
    return SEGMENTS[state.segmentIndex] ?? SEGMENTS[0];
  }

  function showOverlayToast(message = "Nowy wjazd wykryty") {
    toastText.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showOverlayToast._t);
    showOverlayToast._t = window.setTimeout(() => toast.classList.remove("show"), 950);
  }

  function showUiToast(message) {
    uiToastText.textContent = message;
    uiToast.classList.add("show");
    window.clearTimeout(showUiToast._t);
    showUiToast._t = window.setTimeout(() => uiToast.classList.remove("show"), 1600);
  }

  function lockStage(ms = 9000) {
    state.lockUntil = nowMs() + ms;
  }

  function setStage(stage, reason = "manual", lockMs = 9000) {
    const next = clamp(stage, 1, 3);
    if (state.stage === next) return;

    state.stage = next;
    if (reason !== "auto") lockStage(lockMs);

    stagePanels.forEach((p) => {
      const s = Number(p.getAttribute("data-stage-panel"));
      p.hidden = s !== state.stage;
    });

    dots.forEach((d) => {
      const s = Number(d.getAttribute("data-stage"));
      d.classList.toggle("active", s === state.stage);
    });

    barFill.style.width = `${(state.stage / 3) * 100}%`;

    if (state.stage === 2) animateDecisionCheck();
    else updateDecisionUI();
  }

  function updateVehicleUI() {
    const seg = getCurrentSegment();

    plateText.textContent = seg.plate;
    colorText.textContent = seg.color;
    makeTag.textContent = seg.make;

    pillPlate.textContent = seg.plate;
    pillMake.textContent = seg.make;
    pillColor.textContent = `Kolor: ${seg.color}`;

    s1Plate.textContent = seg.plate;
    s1Color.textContent = seg.color;

    if (!state.videoReady) s1State.textContent = "Oczekiwanie na wideo…";
    else if (video.paused) s1State.textContent = "Podgląd zatrzymany";
    else s1State.textContent = "Wykryto pojazd";

    syncToggleFromPermissions();
    updateDecisionUI();
  }

  function syncToggleFromPermissions() {
    const seg = getCurrentSegment();
    const onList = !!state.permissions[seg.key];
    toggleAllowed.classList.toggle("active", onList);
    toggleNeeds.classList.toggle("active", !onList);
  }

  function animateDecisionCheck() {
    const token = ++state.decisionToken;

    checkingText.textContent = "Sprawdzam listę uprawnień…";
    decisionTitle.textContent = "Sprawdzanie…";
    decisionSub.textContent = "Sekundka — porównuję numer z listą uprawnień.";

    window.setTimeout(() => {
      if (token !== state.decisionToken) return;
      checkingText.textContent = "Gotowe.";
      updateDecisionUI();
    }, 520);
  }

  function updateDecisionUI() {
    const seg = getCurrentSegment();
    const onList = !!state.permissions[seg.key];

    if (onList) {
      decisionTitle.textContent = "Wjazd dozwolony";
      decisionSub.textContent = "Numer jest na liście. Szlaban / brama może otworzyć się automatycznie.";
    } else {
      decisionTitle.textContent = "Wymaga akceptacji";
      decisionSub.textContent = "Numer jest poza listą. Wysłano powiadomienie do administratora.";
    }

    updateLastDetectedEntryForCurrentVehicle();
  }

  function ensureHistoryEmptyState() {
    if (state.history.length === 0) {
      historyEmpty.hidden = false;
      if (!historyEmpty.parentElement) historyBody.appendChild(historyEmpty);
    } else {
      historyEmpty.hidden = true;
      if (historyEmpty.parentElement) historyEmpty.remove();
    }
  }

  function statusForCurrentVehicle() {
    const seg = getCurrentSegment();
    const onList = !!state.permissions[seg.key];
    if (onList) return { code: "ok", label: "wpuszczony", note: "Na liście uprawnień" };
    return { code: "wait", label: "oczekuje", note: "Wymaga akceptacji (powiadomiono administratora)" };
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function createRowElement(e) {
    const wrap = document.createElement("div");
    wrap.dataset.id = e.id;

    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="mono">${escapeHtml(e.time)}</div>
      <div class="mono">${escapeHtml(e.plate)}</div>
      <div class="status ${escapeHtml(e.statusCode)}">
        <span class="badge-dot" aria-hidden="true"></span>
        <span>${escapeHtml(e.statusLabel)}</span>
      </div>
    `;
    wrap.appendChild(row);

    if (e.note) {
      const note = document.createElement("div");
      note.className = "row-note";
      note.textContent = e.note;
      wrap.appendChild(note);
    }

    return wrap;
  }

  function updateRowElement(wrap, e) {
    const row = wrap.querySelector(".row");
    const t = row.children[0];
    const p = row.children[1];
    const s = row.children[2];

    t.textContent = e.time;
    p.textContent = e.plate;

    s.className = `status ${e.statusCode}`;
    s.querySelector("span:last-child").textContent = e.statusLabel;

    const existingNote = wrap.querySelector(".row-note");
    if (e.note) {
      if (existingNote) existingNote.textContent = e.note;
      else {
        const note = document.createElement("div");
        note.className = "row-note";
        note.textContent = e.note;
        wrap.appendChild(note);
      }
    } else if (existingNote) {
      existingNote.remove();
    }
  }

  function addHistoryEntry(entry) {
    state.history.push(entry);

    if (state.history.length > 6) {
      const removed = state.history.shift();
      const el = historyBody.querySelector(`[data-id="${CSS.escape(removed.id)}"]`);
      if (el) el.remove();
    }

    ensureHistoryEmptyState();

    const el = createRowElement(entry);
    historyBody.appendChild(el);

    const nearBottom = (historyBody.scrollHeight - historyBody.scrollTop - historyBody.clientHeight) < 40;
    if (nearBottom) historyBody.scrollTop = historyBody.scrollHeight;
  }

  function addDetectedEntryOncePerSegment() {
    const idx = state.segmentIndex;
    if (state.segmentSeen[idx]) return;

    state.segmentSeen[idx] = true;

    const seg = getCurrentSegment();
    const st = statusForCurrentVehicle();

    addHistoryEntry({
      id: `det-${seg.key}-${Date.now()}`,
      type: "detected",
      time: timeLabel(),
      plate: seg.plate,
      statusCode: st.code,
      statusLabel: st.label,
      note: st.note,
      key: seg.key,
    });
  }

  function updateLastDetectedEntryForCurrentVehicle() {
    const seg = getCurrentSegment();
    for (let i = state.history.length - 1; i >= 0; i--) {
      const e = state.history[i];
      if (e.type === "detected" && e.key === seg.key) {
        const st = statusForCurrentVehicle();
        e.statusCode = st.code;
        e.statusLabel = st.label;
        e.note = st.note;

        const el = historyBody.querySelector(`[data-id="${CSS.escape(e.id)}"]`);
        if (el) updateRowElement(el, e);
        break;
      }
    }
  }

  function setVideoAvailable(isAvailable) {
    state.videoReady = isAvailable;

    video.style.display = isAvailable ? "block" : "none";
    videoPlaceholder.hidden = isAvailable;
    overlay.style.display = isAvailable ? "" : "none";

    btnPlay.disabled = !isAvailable;
    btnRestart.disabled = !isAvailable;
    btnFreeze.disabled = !isAvailable;
    jumpButtons.forEach(b => (b.disabled = !isAvailable));

    updateVehicleUI();
  }

  function updatePlayButton() {
    btnPlay.textContent = video.paused ? "Play" : "Pause";
    btnFreeze.textContent = video.paused ? "Wznów" : "Pauza na ujęciu";
  }

  function resetHistoryAndSegments() {
    state.history = [];
    state.segmentSeen = [false, false, false];
    historyBody.innerHTML = "";
    historyBody.appendChild(historyEmpty);
    historyEmpty.hidden = false;
  }

  function resetDemo(all = true) {
    resetHistoryAndSegments();
    if (all) state.permissions = { ...DEFAULT_PERMISSIONS };
    syncToggleFromPermissions();
    updateDecisionUI();
    showUiToast("Zresetowano DEMO.");
  }

  function onSegmentChange() {
    updateVehicleUI();
    showOverlayToast("Nowy wjazd wykryty");
    addDetectedEntryOncePerSegment();

    if (!video.paused && state.demoInView && nowMs() > state.lockUntil) {
      setStage(state.segmentIndex + 1, "auto", 0);
    }
  }

  function onTimeUpdate() {
    const t = video.currentTime;

    if (t + 0.02 < state.lastTime) {
      resetHistoryAndSegments();
      state.lastSegmentIndex = -1;
      if (nowMs() > state.lockUntil) setStage(1, "auto", 0);
    }

    const idx = getSegmentIndex(t);
    state.segmentIndex = idx;

    if (idx !== state.lastSegmentIndex) {
      state.lastSegmentIndex = idx;
      onSegmentChange();
    } else {
      updatePlayButton();
      updateVehicleUI();
    }

    state.lastTime = t;
  }

  async function safePlay() {
    try { await video.play(); } catch (_) {}
    updatePlayButton();
  }

  function jumpToSegment(index) {
    const idx = clamp(index, 0, SEGMENTS.length - 1);
    const seg = SEGMENTS[idx];

    setStage(idx + 1, "jump", 10000);

    try {
      video.currentTime = seg.start + 0.02;
    } catch (_) {
      const t = seg.start + 0.02;
      const once = () => {
        video.currentTime = t;
        video.removeEventListener("loadedmetadata", once);
      };
      video.addEventListener("loadedmetadata", once);
    }

    showOverlayToast(`Ujęcie: Auto ${idx + 1}`);
    safePlay();
  }

  function setupScrollStageObserver() {
    const steps = $$("[data-stage-step]");
    if (!("IntersectionObserver" in window) || steps.length === 0) return;

    const io = new IntersectionObserver((entries) => {
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) return;
      const stage = Number(visible.target.getAttribute("data-stage-step"));
      setStage(stage, "scroll", 9000);
    }, { threshold: [0.35, 0.55, 0.75] });

    steps.forEach(s => io.observe(s));
  }

  function setupDemoInViewObserver() {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      const entry = entries[0];
      state.demoInView = !!entry?.isIntersecting;
      if (state.demoInView && state.videoReady) safePlay();
    }, { threshold: 0.35 });

    io.observe(demoSection);
  }

  function bindEvents() {
    ctaSee.addEventListener("click", () => {
      $("#demo").scrollIntoView({ behavior: "smooth", block: "start" });
      lockStage(8000);
      safePlay();
    });

    btnPlay.addEventListener("click", async () => {
      if (!state.videoReady) return;
      if (video.paused) await safePlay();
      else video.pause();
      updatePlayButton();
      updateVehicleUI();
    });

    btnFreeze.addEventListener("click", () => {
      if (!state.videoReady) return;
      if (video.paused) {
        safePlay();
        showUiToast("Wznowiono podgląd.");
      } else {
        video.pause();
        showUiToast("Zatrzymano podgląd na aktualnym ujęciu.");
      }
      updatePlayButton();
      updateVehicleUI();
    });

    btnRestart.addEventListener("click", () => {
      if (!state.videoReady) return;
      video.currentTime = 0.0;
      state.lastTime = 0;
      state.lastSegmentIndex = -1;
      resetHistoryAndSegments();
      setStage(1, "manual", 10000);
      showOverlayToast("Restart");
      safePlay();
    });

    jumpButtons.forEach((b) => {
      b.addEventListener("click", () => {
        const idx = Number(b.getAttribute("data-jump"));
        jumpToSegment(idx);
      });
    });

    dots.forEach((d) => {
      d.addEventListener("click", () => {
        const s = Number(d.getAttribute("data-stage"));
        setStage(s, "manual", 12000);
      });
    });

    btnNext1.addEventListener("click", () => setStage(2, "manual", 12000));
    btnNext2.addEventListener("click", () => setStage(3, "manual", 12000));
    btnBack2.addEventListener("click", () => setStage(1, "manual", 12000));
    btnBack3.addEventListener("click", () => setStage(2, "manual", 12000));

    toggleAllowed.addEventListener("click", () => {
      const seg = getCurrentSegment();
      state.permissions[seg.key] = true;
      syncToggleFromPermissions();
      updateDecisionUI();
      showUiToast("Ustawiono: Na liście.");
    });

    toggleNeeds.addEventListener("click", () => {
      const seg = getCurrentSegment();
      state.permissions[seg.key] = false;
      syncToggleFromPermissions();
      updateDecisionUI();
      showUiToast("Ustawiono: Poza listą.");
    });

    btnAddToList.addEventListener("click", () => {
      const seg = getCurrentSegment();
      state.permissions[seg.key] = true;
      syncToggleFromPermissions();
      updateDecisionUI();
      showUiToast("Dodano do listy. Wjazd dozwolony.");
      showOverlayToast("Dodano do listy");
    });

    btnOneTime.addEventListener("click", () => {
      const seg = getCurrentSegment();
      addHistoryEntry({
        id: `one-${seg.key}-${Date.now()}`,
        type: "oneTime",
        time: timeLabel(),
        plate: seg.plate,
        statusCode: "ok",
        statusLabel: "wpuszczony",
        note: "Jednorazowy wjazd przyznany",
        key: seg.key,
      });
      showUiToast("Przyznano jednorazowy wjazd.");
      showOverlayToast("Jednorazowy wjazd");
    });

    btnRestartFlow.addEventListener("click", () => {
      resetDemo(true);
      video.currentTime = 0.0;
      state.lastTime = 0;
      state.lastSegmentIndex = -1;
      setStage(1, "manual", 10000);
      safePlay();
    });

    btnQuote.addEventListener("click", () => {
      showUiToast("To DEMO nie wysyła formularzy. W realnym wdrożeniu dodamy kontakt i zasady.");
    });

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("play", () => { updatePlayButton(); updateVehicleUI(); });
    video.addEventListener("pause", () => { updatePlayButton(); updateVehicleUI(); });
  }

  function initVideoFallback() {
    setVideoAvailable(false);

    video.addEventListener("error", () => setVideoAvailable(false));
    video.addEventListener("loadeddata", () => setVideoAvailable(true));
    video.addEventListener("loadedmetadata", () => {
      setVideoAvailable(true);
      updatePlayButton();
      onTimeUpdate();
    });

    window.setTimeout(() => {
      const stillNoData = (video.readyState === 0);
      if (stillNoData) setVideoAvailable(false);
    }, 900);
  }

  function init() {
    setStage(1, "manual", 0);
    state.segmentIndex = 0;

    resetHistoryAndSegments();
    updateVehicleUI();
    updatePlayButton();

    initVideoFallback();
    bindEvents();
    setupScrollStageObserver();
    setupDemoInViewObserver();
  }

  init();
})();
