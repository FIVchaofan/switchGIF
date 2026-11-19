(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const BRIDGE = window.AndroidBridge || null;
  const MIN_CLIP = 0.2;
  const MAX_BYTES = 120 * 1024 * 1024;
  const MAX_DURATION = 30;
  const MAX_WIDTH = 1080;
  const ALLOWED_EXT = new Set(["mp4", "m4v", "mov", "webm", "mkv", "avi", "wmv", "flv", "mpg", "mpeg", "ts"]);
  const FFMPEG_BASE = new URL("ffmpeg/", document.baseURI).href;

  const state = {
    file: null,
    media: null,
    start: 0,
    end: 0,
    fps: 20,
    width: 640,
    colors: 256,
    loop: true,
    speed: 1.0,
    busy: false,
    converting: false,
    cancelled: false,
    token: 0,
    segmentPreview: false,
    dragHandle: null,
    ffmpeg: null,
    ffmpegLoading: null,
    result: null,
    resultBytes: null,
    resultUrl: null,
    saving: false,
    saved: false,
    savedName: null,
    shareAfterSave: false,
    gallerySaving: false,
    galleryAfterSave: false,
    importing: false,
    currentPass: 0,
    logs: [],
    libraryOpen: false,
    libraryItems: [],
    libraryFolders: [],
    libraryFolder: "",
    libraryQuery: "",
    folderMode: "create",
    folderTarget: null,
    folderDeleteTarget: null,
    moveTarget: null,
    renameTarget: null,
    deleteTarget: null,
    previewTarget: null,
  };

  const el = {
    dropzone: $("dropzone"),
    fileInput: $("file-input"),
    dropIdle: $("drop-idle"),
    dropUploading: $("drop-uploading"),
    uploadName: $("upload-name"),
    uploadBar: $("upload-bar"),
    uploadPercent: $("upload-percent"),
    editor: $("editor"),
    video: $("video"),
    fileName: $("file-name"),
    fileMeta: $("file-meta"),
    removeMedia: $("remove-media"),
    previewResolution: $("preview-resolution"),
    previewDuration: $("preview-duration"),
    segmentPlay: $("segment-play"),
    segmentPlayLabel: $("segment-play-label"),
    previewSpeedText: $("preview-speed-text"),
    trimTrack: $("trim-track"),
    trimFilm: $("trim-film"),
    trimSelection: $("trim-selection"),
    trimPlayhead: $("trim-playhead"),
    startTime: $("start-time"),
    endTime: $("end-time"),
    clipDuration: $("clip-duration"),
    resetTrim: $("reset-trim"),
    fpsGroup: $("fps-group"),
    widthGroup: $("width-group"),
    colorGroup: $("color-group"),
    speedGroup: $("speed-group"),
    speedReadout: $("speed-readout"),
    topSpeedText: $("top-speed-text"),
    fpsHint: $("fps-hint"),
    sourceSizeHint: $("source-size-hint"),
    loopToggle: $("loop-toggle"),
    summaryDuration: $("summary-duration"),
    summarySize: $("summary-size"),
    summaryEstimate: $("summary-estimate"),
    outputSummary: $("output-summary"),
    settingsCard: $("settings-card"),
    cta: $("android-cta"),
    ctaDuration: $("cta-duration"),
    ctaDetail: $("cta-detail"),
    ctaConvert: $("cta-convert"),
    convertButton: $("convert-button"),
    settingsState: $("settings-state"),
    healthBanner: $("health-banner"),
    healthMessage: $("health-message"),
    toastStack: $("toast-stack"),
    progressModal: $("progress-modal"),
    progressFilename: $("progress-filename"),
    progressPercent: $("progress-percent"),
    progressStage: $("progress-stage"),
    progressFill: $("progress-fill"),
    progressBar: $("progress-bar"),
    progressTitle: $("progress-title"),
    cancelButton: $("cancel-button"),
    resultModal: $("result-modal"),
    resultGif: $("result-gif"),
    resultFilename: $("result-filename"),
    resultLoopLabel: $("result-loop-label"),
    resultLede: $("result-lede"),
    resultDuration: $("result-duration"),
    resultResolution: $("result-resolution"),
    resultFps: $("result-fps"),
    resultSize: $("result-size"),
    timingCheck: $("timing-check"),
    timingDetail: $("timing-detail"),
    downloadButton: $("download-button"),
    downloadLabel: $("download-label"),
    resultGalleryButton: $("result-gallery-button"),
    shareButton: $("share-button"),
    againButton: $("again-button"),
    newVideoButton: $("new-video-button"),
    resultClose: $("result-close"),
    libraryButton: $("library-button"),
    libraryBadge: $("library-badge"),
    libraryPage: $("library-page"),
    libraryBack: $("library-back"),
    libraryCount: $("library-count"),
    librarySummary: $("library-summary"),
    libraryRefresh: $("library-refresh"),
    libraryLoading: $("library-loading"),
    libraryEmpty: $("library-empty"),
    libraryEmptyClose: $("library-empty-close"),
    libraryEmptyTitle: $("library-empty-title"),
    libraryEmptyCopy: $("library-empty-copy"),
    libraryList: $("library-list"),
    libraryImport: $("library-import"),
    libraryImportLabel: $("library-import-label"),
    importModal: $("import-modal"),
    importImages: $("import-images"),
    importVideos: $("import-videos"),
    importCancel: $("import-cancel"),
    librarySearchInput: $("library-search-input"),
    librarySearchClear: $("library-search-clear"),
    libraryFolders: $("library-folders"),
    folderCreate: $("folder-create"),
    folderRename: $("folder-rename"),
    folderDelete: $("folder-delete"),
    folderModal: $("folder-modal"),
    folderTitle: $("folder-title"),
    folderInput: $("folder-input"),
    folderError: $("folder-error"),
    folderCancel: $("folder-cancel"),
    folderConfirm: $("folder-confirm"),
    folderDeleteModal: $("folder-delete-modal"),
    folderDeleteName: $("folder-delete-name"),
    folderDeleteCancel: $("folder-delete-cancel"),
    folderDeleteConfirm: $("folder-delete-confirm"),
    moveModal: $("move-modal"),
    moveName: $("move-name"),
    moveOptions: $("move-options"),
    moveCancel: $("move-cancel"),
    renameModal: $("rename-modal"),
    renameInput: $("rename-input"),
    renameExtension: $("rename-extension"),
    renameError: $("rename-error"),
    renameCancel: $("rename-cancel"),
    renameConfirm: $("rename-confirm"),
    deleteModal: $("delete-modal"),
    deleteName: $("delete-name"),
    deleteCancel: $("delete-cancel"),
    deleteConfirm: $("delete-confirm"),
    previewModal: $("gif-preview-modal"),
    previewStage: $("gif-preview-stage"),
    previewName: $("gif-preview-name"),
    previewMeta: $("gif-preview-meta"),
    previewClose: $("gif-preview-close"),
    previewShare: $("gif-preview-share"),
    previewGallery: $("gif-preview-gallery"),
  };

  // ------------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------------

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function fmtClock(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(safe / 60);
    const secs = safe - minutes * 60;
    return `${String(minutes).padStart(2, "0")}:${secs.toFixed(1).padStart(4, "0")}`;
  }

  function fmtDuration(seconds) {
    const value = Math.max(0, Number(seconds) || 0);
    return value < 10 ? `${value.toFixed(2)}s` : `${value.toFixed(1)}s`;
  }

  function fmtBytes(bytes) {
    const value = Math.max(0, Number(bytes) || 0);
    if (value < 1024) return `${value.toFixed(0)} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
    const mb = value / (1024 * 1024);
    return `${mb < 10 ? mb.toFixed(1) : mb.toFixed(0)} MB`;
  }

  function fmtEstimateRange(bytes) {
    return `预计 ${fmtBytes(bytes * 0.85)} – ${fmtBytes(bytes * 1.2)}`;
  }

  function fmtDate(timestamp) {
    const value = Number(timestamp);
    if (!value) return "—";
    const date = new Date(value);
    const pad = (number) => String(number).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function extOf(name) {
    const index = (name || "").lastIndexOf(".");
    return index >= 0 ? name.slice(index + 1).toLowerCase() : "";
  }

  function showToast(message, type = "info", duration = 4200) {
    const toast = document.createElement("div");
    toast.className = `toast${type === "error" ? " is-error" : type === "success" ? " is-success" : ""}`;
    const dot = document.createElement("span");
    dot.className = "toast-dot";
    const text = document.createElement("span");
    text.textContent = message;
    toast.append(dot, text);
    el.toastStack.appendChild(toast);
    window.setTimeout(() => {
      toast.classList.add("is-leaving");
      window.setTimeout(() => toast.remove(), 240);
    }, duration);
  }

  function setModalOpen() {
    const anyOpen = [...document.querySelectorAll(".modal")].some((modal) => !modal.hidden);
    document.body.classList.toggle("modal-open", anyOpen);
  }

  function openModal(modal) {
    modal.hidden = false;
    setModalOpen();
  }

  function closeModal(modal) {
    modal.hidden = true;
    setModalOpen();
  }

  function setButtonIcon(button, iconId) {
    const use = button.querySelector("use");
    if (use) use.setAttribute("href", iconId);
  }

  function setStateChip(text, variant = "") {
    el.settingsState.textContent = text;
    el.settingsState.classList.toggle("is-ready", variant === "ready");
    el.settingsState.classList.toggle("is-done", variant === "done");
  }

  function effectiveWidth() {
    if (!state.media) return 640;
    const raw = state.width === "original" ? state.media.width : Number(state.width);
    return Math.max(2, Math.min(raw, state.media.width, MAX_WIDTH));
  }

  function effectiveHeight() {
    if (!state.media) return 360;
    return Math.max(2, Math.round(effectiveWidth() * (state.media.height / state.media.width)));
  }

  function effectiveFps() {
    if (!state.media) return state.fps;
    const sourceFps = state.media.fps || 30;
    return Math.min(state.fps, Math.max(5, Math.round(sourceFps)));
  }

  function clipDuration() {
    return Math.max(0, state.end - state.start);
  }

  function formatSpeed(speed) {
    const value = Number(speed) || 1;
    return value === Math.round(value) ? value.toFixed(1) : String(value);
  }

  function outputDuration() {
    return clipDuration() / Math.max(0.1, state.speed);
  }

  function setNativeBusy(busy) {
    state.busy = busy;
    if (BRIDGE) {
      try { BRIDGE.setBusy(Boolean(busy)); } catch { /* no-op */ }
    }
  }

  function showCta(show) {
    el.cta.hidden = !show;
    document.body.classList.toggle("has-cta", Boolean(show));
  }

  // ------------------------------------------------------------------
  // File reading
  // ------------------------------------------------------------------

  function readVideoInfo(url) {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        video.removeAttribute("src");
        video.load();
        fn(value);
      };
      const timer = window.setTimeout(() => {
        finish(reject, new Error("读取视频超时，请换一个文件试试。"));
      }, 15000);
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.onloadedmetadata = () => {
        const duration = Number(video.duration);
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (!isFinite(duration) || duration <= 0) {
          finish(reject, new Error("无法读取视频时长，这个格式可能不受支持。"));
          return;
        }
        if (!width || !height) {
          finish(reject, new Error("没有找到视频画面。"));
          return;
        }
        finish(resolve, { duration, width, height });
      };
      video.onerror = () => finish(reject, new Error("这个视频无法预览，请换 MP4 / MOV / WebM 试试。"));
      video.src = url;
    });
  }

  function seekVideo(video, time) {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        video.removeEventListener("seeked", finish);
        resolve();
      };
      const timer = window.setTimeout(finish, 3000);
      video.addEventListener("seeked", finish, { once: true });
      try {
        video.currentTime = time;
      } catch {
        finish();
      }
    });
  }

  async function generateFilmstrip(url) {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    video.load();
    try {
      await new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error("timeout")), 10000);
        video.onloadeddata = () => {
          window.clearTimeout(timer);
          resolve();
        };
        video.onerror = () => {
          window.clearTimeout(timer);
          reject(new Error("video error"));
        };
      });
      const duration = Number(video.duration);
      if (!isFinite(duration) || duration <= 0) return;
      const frames = 10;
      const cellW = 180;
      const cellH = 100;
      const canvas = document.createElement("canvas");
      canvas.width = cellW * frames;
      canvas.height = cellH;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#111416";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      let posterDone = false;
      for (let index = 0; index < frames; index++) {
        await seekVideo(video, (duration * (index + 0.5)) / frames);
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (!vw || !vh) continue;
        const scale = Math.max(cellW / vw, cellH / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        ctx.save();
        ctx.beginPath();
        ctx.rect(index * cellW, 0, cellW, cellH);
        ctx.clip();
        ctx.drawImage(video, (cellW - dw) / 2 + index * cellW, (cellH - dh) / 2, dw, dh);
        ctx.restore();

        if (!posterDone) {
          const poster = document.createElement("canvas");
          poster.width = Math.min(720, vw);
          poster.height = Math.round(poster.width * (vh / vw));
          poster.getContext("2d").drawImage(video, 0, 0, poster.width, poster.height);
          try { el.video.poster = poster.toDataURL("image/jpeg", 0.82); } catch { /* no-op */ }
          posterDone = true;
        }
      }
      el.trimFilm.style.backgroundImage = `url("${canvas.toDataURL("image/jpeg", 0.72)}")`;
    } catch {
      /* filmstrip is decorative */
    } finally {
      video.removeAttribute("src");
      video.load();
    }
  }

  function handleFile(file) {
    if (!file || state.converting) return;
    const ext = extOf(file.name);
    const mime = (file.type || "").toLowerCase();
    if (ext && !ALLOWED_EXT.has(ext) && !mime.startsWith("video/")) {
      showToast("请选择视频文件（MP4 / MOV / WebM / MKV）。", "error");
      return;
    }
    if (file.size > MAX_BYTES) {
      showToast(`文件有 ${fmtBytes(file.size)}，请选择小于 120 MB 的短视频。`, "error");
      return;
    }

    setNativeBusy(true);
    el.dropzone.hidden = false;
    el.editor.hidden = true;
    el.dropIdle.hidden = true;
    el.dropUploading.hidden = false;
    el.uploadName.textContent = file.name;
    el.uploadBar.style.width = "18%";
    el.uploadPercent.textContent = "18%";
    setStateChip("读取中");

    const url = URL.createObjectURL(file);
    readVideoInfo(url)
      .then((info) => {
        if (info.duration > MAX_DURATION + 0.05) {
          URL.revokeObjectURL(url);
          resetUploadUi();
          showToast(`这个视频有 ${info.duration.toFixed(0)} 秒，目前最多支持 30 秒。`, "error", 6000);
          return;
        }
        el.uploadBar.style.width = "100%";
        el.uploadPercent.textContent = "100%";
        loadMedia(file, url, info);
      })
      .catch((error) => {
        URL.revokeObjectURL(url);
        resetUploadUi();
        showToast(error.message || "读取视频失败。", "error", 6000);
      });
  }

  function resetUploadUi() {
    setNativeBusy(false);
    el.dropIdle.hidden = false;
    el.dropUploading.hidden = true;
    el.uploadBar.style.width = "0%";
    el.uploadPercent.textContent = "0%";
    if (state.media) {
      el.dropzone.hidden = true;
      el.editor.hidden = false;
    }
    setStateChip(state.media ? "已就绪" : "待选择", state.media ? "ready" : "");
  }

  // ------------------------------------------------------------------
  // Media setup / reset
  // ------------------------------------------------------------------

  function loadMedia(file, url, info) {
    state.file = file;
    state.media = {
      filename: file.name || "video.mp4",
      size: file.size,
      duration: info.duration,
      width: info.width,
      height: info.height,
      fps: 30,
      url,
    };
    state.start = 0;
    state.end = info.duration;
    state.result = null;
    state.resultBytes = null;
    state.saved = false;
    state.fps = 20;
    state.colors = 256;
    state.loop = true;
    state.speed = 1.0;
    state.segmentPreview = false;

    const widths = [640, 480, 360];
    state.width = widths.find((width) => width <= info.width) || "original";

    el.dropzone.hidden = true;
    el.editor.hidden = false;
    el.settingsCard.hidden = false;
    el.dropUploading.hidden = true;
    el.dropIdle.hidden = false;
    el.fileName.textContent = state.media.filename;
    el.fileMeta.textContent = `${info.width} × ${info.height} · ${fmtBytes(file.size)}`;
    el.previewResolution.textContent = `${info.width} × ${info.height}`;
    el.previewDuration.textContent = `${info.duration.toFixed(2)}s`;
    el.sourceSizeHint.textContent = `源片 ${info.width} × ${info.height}`;
    el.video.src = url;
    el.video.poster = "";
    el.video.muted = true;
    el.video.load();
    el.video.addEventListener("loadeddata", () => {
      if (!state.media || state.segmentPreview) return;
      el.video.play().catch(() => {
        // Autoplay may be blocked; the user can still press the preview button.
      });
    }, { once: true });
    el.trimFilm.style.backgroundImage = "none";

    setNativeBusy(false);
    syncSettingsControls();
    updateTrimUi();
    updateSummary();
    el.outputSummary.classList.remove("is-empty");
    showCta(true);
    setStateChip("已就绪", "ready");
    el.convertButton.disabled = false;
    el.convertButton.querySelector(".convert-button-label span").textContent = "生成 GIF";
    el.video.currentTime = 0;
    setSegmentPreview(false);
    generateFilmstrip(url);
  }

  function resetApp() {
    if (state.converting) return;
    if (state.media?.url) URL.revokeObjectURL(state.media.url);
    if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);

    state.file = null;
    state.media = null;
    state.start = 0;
    state.end = 0;
    state.result = null;
    state.resultBytes = null;
    state.resultUrl = null;
    state.saved = false;
    state.savedName = null;
    state.shareAfterSave = false;
    state.gallerySaving = false;
    state.galleryAfterSave = false;
    state.converting = false;
    state.segmentPreview = false;
    state.dragHandle = null;

    el.video.pause();
    el.video.removeAttribute("src");
    el.video.poster = "";
    el.video.load();
    el.editor.hidden = true;
    el.dropzone.hidden = false;
    el.settingsCard.hidden = true;
    el.dropIdle.hidden = false;
    el.dropUploading.hidden = true;
    el.trimFilm.style.backgroundImage = "none";
    el.trimPlayhead.classList.remove("is-visible");
    el.convertButton.disabled = true;
    el.convertButton.querySelector(".convert-button-label span").textContent = "生成 GIF";
    el.fileInput.value = "";
    el.outputSummary.classList.add("is-empty");
    setStateChip("待选择");
    setSegmentPreview(false);
    setNativeBusy(false);
    showCta(false);
    updateSummary();

    state.fps = 20;
    state.width = 640;
    state.colors = 256;
    state.loop = true;
    state.speed = 1.0;
    syncSettingsControls();
  }

  // ------------------------------------------------------------------
  // Timeline
  // ------------------------------------------------------------------

  function updateTrimUi() {
    if (!state.media) return;
    const duration = Math.max(0.001, state.media.duration || 0);
    const left = clamp((state.start / duration) * 100, 0, 100);
    const right = clamp((state.end / duration) * 100, 0, 100);
    el.trimSelection.style.left = `${left}%`;
    el.trimSelection.style.width = `${Math.max(0.25, right - left)}%`;
    el.startTime.textContent = fmtClock(state.start);
    el.endTime.textContent = fmtClock(state.end);
    el.clipDuration.textContent = fmtDuration(clipDuration());

    const startHandle = el.trimSelection.querySelector('[data-handle="start"]');
    const endHandle = el.trimSelection.querySelector('[data-handle="end"]');
    if (startHandle) {
      startHandle.setAttribute("aria-valuemin", "0");
      startHandle.setAttribute("aria-valuemax", String(Math.max(0, state.end - MIN_CLIP)));
      startHandle.setAttribute("aria-valuenow", state.start.toFixed(2));
      startHandle.setAttribute("aria-valuetext", fmtClock(state.start));
    }
    if (endHandle) {
      endHandle.setAttribute("aria-valuemin", String(state.start + MIN_CLIP));
      endHandle.setAttribute("aria-valuemax", String(duration));
      endHandle.setAttribute("aria-valuenow", state.end.toFixed(2));
      endHandle.setAttribute("aria-valuetext", fmtClock(state.end));
    }
    updateSummary();
  }

  function updatePlayhead() {
    if (!state.media) return;
    const duration = Math.max(0.001, state.media.duration || 0);
    el.trimPlayhead.style.left = `${clamp((el.video.currentTime / duration) * 100, 0, 100)}%`;
    el.trimPlayhead.classList.add("is-visible");
  }

  function seekTo(seconds) {
    if (!state.media) return;
    const duration = state.media.duration || 0;
    el.video.currentTime = clamp(seconds, 0, Math.max(0, duration - 0.01));
    updatePlayhead();
  }

  function setTrimValue(which, value) {
    if (!state.media) return;
    const duration = state.media.duration || 0;
    const gap = Math.min(0.5, Math.max(MIN_CLIP, duration * 0.02));
    if (which === "start") {
      state.start = clamp(value, 0, state.end - gap);
    } else {
      state.end = clamp(value, state.start + gap, duration);
    }
    updateTrimUi();
  }

  function pointerTime(event) {
    const rect = el.trimTrack.getBoundingClientRect();
    const ratio = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    return ratio * (state.media?.duration || 0);
  }

  function startDrag(event) {
    if (!state.media || event.button !== 0) return;
    const handle = event.target.closest("[data-handle]");
    if (handle) {
      state.dragHandle = handle.dataset.handle;
      try { el.trimTrack.setPointerCapture?.(event.pointerId); } catch { /* no-op */ }
      event.preventDefault();
      return;
    }
    seekTo(pointerTime(event));
  }

  function moveDrag(event) {
    if (!state.dragHandle) return;
    setTrimValue(state.dragHandle, pointerTime(event));
    if (state.dragHandle === "start") {
      seekTo(state.start);
    } else if (state.segmentPreview && el.video.currentTime > state.end) {
      seekTo(state.end);
    }
  }

  function endDrag(event) {
    if (!state.dragHandle) return;
    state.dragHandle = null;
    try { el.trimTrack.releasePointerCapture?.(event.pointerId); } catch { /* no-op */ }
  }

  function nudgeHandle(which, delta) {
    if (!state.media) return;
    const current = which === "start" ? state.start : state.end;
    setTrimValue(which, current + delta);
    if (which === "start") seekTo(state.start);
  }

  // ------------------------------------------------------------------
  // Segment preview
  // ------------------------------------------------------------------

  function setSegmentPreview(active) {
    state.segmentPreview = active;
    setButtonIcon(el.segmentPlay.querySelector(".segment-play-icon svg"), active ? "#i-pause" : "#i-play");
    el.segmentPlayLabel.textContent = active ? "停止试看" : "试看所选片段";
    el.segmentPlay.classList.toggle("is-playing", active);
  }

  async function toggleSegmentPreview() {
    if (!state.media) return;
    if (state.segmentPreview) {
      el.video.pause();
      setSegmentPreview(false);
      return;
    }
    el.video.currentTime = Math.max(0, state.start);
    try {
      await el.video.play();
      setSegmentPreview(true);
    } catch {
      showToast("无法播放预览，请确认视频编码受系统支持。", "error");
    }
  }

  // ------------------------------------------------------------------
  // Settings
  // ------------------------------------------------------------------

  function syncSettingsControls() {
    el.fpsGroup.querySelectorAll("[data-fps]").forEach((button) => {
      const active = Number(button.dataset.fps) === state.fps;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    el.widthGroup.querySelectorAll("[data-width]").forEach((button) => {
      const isOriginal = button.dataset.width === "original";
      const active = isOriginal ? state.width === "original" : Number(button.dataset.width) === state.width;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    el.colorGroup.querySelectorAll("[data-colors]").forEach((button) => {
      const active = Number(button.dataset.colors) === state.colors;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    el.speedGroup.querySelectorAll("[data-speed]").forEach((button) => {
      const active = Number(button.dataset.speed) === state.speed;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    const speed = formatSpeed(state.speed);
    const speedKind = state.speed === 1 ? "原速" : "变速";
    el.speedReadout.innerHTML = `${speed}× <em>${speedKind}</em>`;
    el.topSpeedText.textContent = `${speed}× ${speedKind}`;
    el.previewSpeedText.textContent = `${speed}× ${speedKind}预览`;
    try { el.video.playbackRate = state.speed; } catch { /* no-op */ }
    el.loopToggle.classList.toggle("is-on", state.loop);
    el.loopToggle.setAttribute("aria-checked", String(state.loop));
    const hints = { 10: "轻量", 15: "均衡", 20: "均衡 · 推荐", 25: "最顺滑" };
    el.fpsHint.textContent = state.media && effectiveFps() !== state.fps
      ? `源片约 ${effectiveFps()}fps`
      : (hints[state.fps] || "均衡");
  }

  function updateSummary() {
    if (!state.media) {
      el.summaryDuration.textContent = "—";
      el.summarySize.textContent = "—";
      el.summaryEstimate.textContent = "—";
      el.sourceSizeHint.textContent = "自适应高度";
      el.ctaDuration.textContent = "—";
      el.ctaDetail.textContent = "—";
      return;
    }
    const width = effectiveWidth();
    const height = effectiveHeight();
    const fps = effectiveFps();
    const duration = clipDuration();
    const outDuration = outputDuration();
    const speedText = formatSpeed(state.speed);
    el.summaryDuration.innerHTML = `${outDuration.toFixed(2)} 秒 <em>${state.speed === 1 ? "原速" : `${speedText}×`}</em>`;
    el.summarySize.textContent = `${width} × ${height} · ${fps}fps`;
    const pixels = width * height * fps * outDuration;
    const colorFactor = 0.62 + (state.colors / 256) * 0.38;
    const speedRatio = state.speed >= 1
      ? 0.68
      : 0.52 + ((state.speed - 0.5) / 0.5) * 0.16;
    el.summaryEstimate.textContent = fmtEstimateRange(pixels * 0.16 * colorFactor * speedRatio);
    el.fpsHint.textContent = fps !== state.fps ? `源片约 ${fps}fps` : el.fpsHint.textContent;
    el.ctaDuration.textContent = `${outDuration.toFixed(2)}s`;
    el.ctaDetail.textContent = `${width} × ${height} · ${fps}fps · ${speedText}×`;
  }

  // ------------------------------------------------------------------
  // FFmpeg engine
  // ------------------------------------------------------------------

  function onProgress({ progress }) {
    if (!state.converting) return;
    const normalized = clamp(Number(progress) || 0, 0, 1);
    if (state.currentPass === 1) {
      el.progressStage.textContent = "正在分析画面色彩…";
      el.progressPercent.textContent = "…";
      el.progressBar.classList.add("is-pending");
    } else if (state.currentPass === 2) {
      updateProgressUi(44 + normalized * 54, "正在生成 GIF…");
    }
  }

  function ensureFFmpeg() {
    if (state.ffmpeg && state.ffmpeg.loaded) return Promise.resolve(state.ffmpeg);
    if (state.ffmpegLoading) return state.ffmpegLoading;

    state.ffmpegLoading = (async () => {
      if (!window.FFmpegWASM) throw new Error("转换引擎没有加载成功，请重启应用。");
      const ffmpeg = new FFmpegWASM.FFmpeg();
      ffmpeg.on("progress", onProgress);
      ffmpeg.on("log", ({ message }) => {
        state.logs.push(message);
        if (state.logs.length > 40) state.logs.shift();
      });
      updateProgressUi(1, "正在加载转换引擎…");
      await ffmpeg.load({
        coreURL: `${FFMPEG_BASE}ffmpeg-core.js`,
        wasmURL: `${FFMPEG_BASE}ffmpeg-core.wasm`,
      });
      state.ffmpeg = ffmpeg;
      return ffmpeg;
    })();

    state.ffmpegLoading
      .catch(() => {
        state.ffmpeg = null;
      })
      .finally(() => {
        state.ffmpegLoading = null;
      });
    return state.ffmpegLoading;
  }

  async function cleanupFfmpeg(ffmpeg, names) {
    for (const name of names) {
      try { await ffmpeg.deleteFile(name); } catch { /* no-op */ }
    }
  }

  // ------------------------------------------------------------------
  // Conversion
  // ------------------------------------------------------------------

  function resetProgressUi() {
    const card = el.progressModal.querySelector(".progress-card");
    card.classList.remove("has-error");
    el.progressTitle.textContent = "正在生成 GIF";
    el.progressStage.textContent = "正在准备…";
    el.progressPercent.textContent = "0%";
    el.progressFill.style.width = "0%";
    el.progressFill.style.background = "";
    el.progressBar.classList.add("is-pending");
    el.cancelButton.textContent = "取消";
    el.cancelButton.disabled = false;
    el.progressFilename.textContent = state.file?.name || "";
  }

  function updateProgressUi(percent, stage) {
    const value = clamp(percent, 0, 99);
    el.progressPercent.textContent = `${Math.round(value)}%`;
    el.progressFill.style.width = `${value}%`;
    el.progressBar.classList.toggle("is-pending", value < 1);
    if (stage) el.progressStage.textContent = stage;
  }

  async function startConversion() {
    if (!state.media || state.converting || state.saving) return;
    if (clipDuration() < MIN_CLIP) {
      showToast("选择的片段太短，请至少保留 0.2 秒。", "error");
      return;
    }

    state.converting = true;
    state.cancelled = false;
    state.token += 1;
    const token = state.token;
    state.logs = [];
    state.currentPass = 0;
    setNativeBusy(true);
    el.ctaConvert.disabled = true;
    showCta(false);
    el.convertButton.disabled = true;
    el.convertButton.querySelector(".convert-button-label span").textContent = "正在生成…";
    setStateChip("转换中");
    resetProgressUi();
    openModal(el.progressModal);
    el.cancelButton.focus({ preventScroll: true });

    const start = state.start;
    const duration = clipDuration();
    const width = effectiveWidth();
    const fps = effectiveFps();
    const colors = state.colors;
    const loop = state.loop;
    const speed = state.speed;
    const expectedDuration = duration / speed;
    const speedFilter = speed === 1 ? "" : `setpts=PTS/${speed},`;
    const ext = ALLOWED_EXT.has(extOf(state.file.name)) ? extOf(state.file.name) : "mp4";
    const inputName = `input.${ext}`;
    let ffmpeg = null;

    try {
      ffmpeg = await ensureFFmpeg();
      if (token !== state.token || state.cancelled) return;

      updateProgressUi(2, "正在读取视频…");
      const bytes = new Uint8Array(await state.file.arrayBuffer());
      await ffmpeg.writeFile(inputName, bytes);
      if (token !== state.token || state.cancelled) return;

      state.currentPass = 1;
      updateProgressUi(4, "正在分析画面色彩…");
      el.progressPercent.textContent = "…";
      el.progressBar.classList.add("is-pending");
      const paletteArgs = [
        "-hide_banner", "-loglevel", "error",
        "-ss", start.toFixed(3), "-t", duration.toFixed(3), "-i", inputName,
        "-an", "-vf",
        `${speedFilter}fps=${fps},scale=${width}:-1:flags=lanczos,palettegen=max_colors=${colors}:stats_mode=diff`,
        "-frames:v", "1", "-y", "palette.png",
      ];
      let code = await ffmpeg.exec(paletteArgs, -1);
      if (code !== 0 && code !== undefined) throw new Error("色彩分析失败，请换一个视频试试。");
      if (token !== state.token || state.cancelled) return;

      state.currentPass = 2;
      updateProgressUi(44, "正在生成 GIF…");
      const gifArgs = [
        "-hide_banner", "-loglevel", "error",
        "-ss", start.toFixed(3), "-t", duration.toFixed(3), "-i", inputName,
        "-i", "palette.png", "-an",
        "-lavfi", `${speedFilter}fps=${fps},scale=${width}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a:diff_mode=rectangle`,
        "-loop", loop ? "0" : "-1",
        "-y", "out.gif",
      ];
      code = await ffmpeg.exec(gifArgs, -1);
      if (code !== 0 && code !== undefined) throw new Error("GIF 编码失败，请减少片段长度后重试。");
      if (token !== state.token || state.cancelled) return;

      updateProgressUi(99, "正在收尾…");
      const data = await ffmpeg.readFile("out.gif");
      const output = new Uint8Array(data);
      if (!output.length) throw new Error("没有生成有效的 GIF。");
      if (token !== state.token || state.cancelled) return;

      const parsed = parseGif(output) || {};
      const gifDuration = parsed.duration || expectedDuration;
      const delta = gifDuration - expectedDuration;
      const tolerance = Math.max(0.13, 1.05 / Math.max(fps, 1));
      const blob = new Blob([output], { type: "image/gif" });
      if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);
      state.resultUrl = URL.createObjectURL(blob);
      state.resultBytes = output;
      const suffix = speed === 1 ? "原速" : `${formatSpeed(speed)}x`;
      state.result = {
        url: state.resultUrl,
        filename: `${(state.media.filename.replace(/\.[^.]+$/, "") || "clip").slice(0, 60)}_${suffix}.gif`,
        duration: Number(gifDuration.toFixed(3)),
        source_duration: Number(duration.toFixed(3)),
        expected_duration: Number(expectedDuration.toFixed(3)),
        delta_ms: Math.round(delta * 1000),
        timing_ok: Math.abs(delta) <= tolerance,
        speed,
        fps,
        width: parsed.width || width,
        height: parsed.height || Math.round(width * (state.media.height / state.media.width)),
        size: output.length,
        colors,
        loop,
      };
      finishConversion(state.result);
      await cleanupFfmpeg(ffmpeg, [inputName, "palette.png", "out.gif"]);
    } catch (error) {
      if (state.cancelled || token !== state.token) return;
      failConversion(error?.message || "转换失败，请重试。");
      if (ffmpeg) await cleanupFfmpeg(ffmpeg, [inputName, "palette.png", "out.gif"]);
    }
  }

  function finishConversion(result) {
    state.converting = false;
    state.currentPass = 0;
    setNativeBusy(false);
    showCta(false);
    el.ctaConvert.disabled = false;
    el.progressPercent.textContent = "100%";
    el.progressFill.style.width = "100%";
    el.progressBar.classList.remove("is-pending");
    el.progressStage.textContent = "完成";
    setStateChip("已完成", "done");
    el.convertButton.disabled = false;
    el.convertButton.querySelector(".convert-button-label span").textContent = "生成 GIF";

    window.setTimeout(() => {
      closeModal(el.progressModal);
      populateResult(result);
      openModal(el.resultModal);
      el.downloadButton.focus({ preventScroll: true });
      window.setTimeout(() => saveGif(true), 260);
    }, 380);
  }

  function failConversion(message) {
    state.converting = false;
    state.currentPass = 0;
    setNativeBusy(false);
    el.ctaConvert.disabled = false;
    el.convertButton.disabled = false;
    el.convertButton.querySelector(".convert-button-label span").textContent = "重新生成 GIF";
    setStateChip(state.media ? "已就绪" : "待选择", state.media ? "ready" : "");

    const card = el.progressModal.querySelector(".progress-card");
    card.classList.add("has-error");
    el.progressTitle.textContent = "转换没有完成";
    el.progressStage.textContent = message;
    el.progressPercent.textContent = "!";
    el.progressFill.style.width = "100%";
    el.progressFill.style.background = "var(--danger)";
    el.progressBar.classList.remove("is-pending");
    el.cancelButton.textContent = "关闭";
    el.cancelButton.disabled = false;
    showToast(message, "error", 6500);
  }

  async function cancelConversion() {
    if (!state.converting) {
      closeModal(el.progressModal);
      resetProgressUi();
      showCta(Boolean(state.media));
      el.ctaConvert.disabled = false;
      return;
    }
    state.cancelled = true;
    state.token += 1;
    state.converting = false;
    state.currentPass = 0;
    setNativeBusy(false);
    if (state.ffmpeg) {
      try { state.ffmpeg.terminate(); } catch { /* no-op */ }
      state.ffmpeg = null;
    }
    state.ffmpegLoading = null;
    closeModal(el.progressModal);
    resetProgressUi();
    showCta(Boolean(state.media));
    el.ctaConvert.disabled = false;
    el.convertButton.disabled = false;
    el.convertButton.querySelector(".convert-button-label span").textContent = "生成 GIF";
    setStateChip(state.media ? "已就绪" : "待选择", state.media ? "ready" : "");
    showToast("转换已取消。");
  }

  // ------------------------------------------------------------------
  // GIF parsing (duration / dimensions)
  // ------------------------------------------------------------------

  function parseGif(bytes) {
    try {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      if (bytes.length < 13 || String.fromCharCode(bytes[0], bytes[1], bytes[2]) !== "GIF") return null;
      const width = view.getUint16(6, true);
      const height = view.getUint16(8, true);
      const packed = bytes[10];
      let offset = 13;
      if (packed & 0x80) offset += 3 * (1 << ((packed & 0x07) + 1));
      let delay = 0;
      let frames = 0;
      const skipSubBlocks = () => {
        while (offset < bytes.length) {
          const size = bytes[offset++];
          if (size === 0) break;
          offset += size;
          if (offset > bytes.length) throw new Error("bad gif");
        }
      };
      while (offset < bytes.length) {
        const marker = bytes[offset++];
        if (marker === 0x3b) break;
        if (marker === 0x21) {
          const label = bytes[offset++];
          if (label === 0xf9 && bytes[offset] >= 4) {
            const size = bytes[offset];
            delay += view.getUint16(offset + 2, true);
            offset += size + 2;
          } else {
            skipSubBlocks();
          }
        } else if (marker === 0x2c) {
          if (offset + 9 > bytes.length) break;
          const imagePacked = bytes[offset + 8];
          offset += 9;
          if (imagePacked & 0x80) offset += 3 * (1 << ((imagePacked & 0x07) + 1));
          offset += 1;
          skipSubBlocks();
          frames += 1;
        } else {
          break;
        }
      }
      return { width, height, duration: delay / 100, frames };
    } catch {
      return null;
    }
  }

  // ------------------------------------------------------------------
  // Save / share
  // ------------------------------------------------------------------

  function sendBase64Chunks(bytes, chunkSize, onChunk) {
    for (let start = 0; start < bytes.length; start += chunkSize) {
      const part = bytes.subarray(start, start + chunkSize);
      let binary = "";
      const step = 0x8000;
      for (let i = 0; i < part.length; i += step) {
        binary += String.fromCharCode.apply(null, part.subarray(i, i + step));
      }
      onChunk(btoa(binary));
    }
  }

  function libraryUrl(item) {
    return `https://app.local/library/${encodeURIComponent(item.name)}?v=${Number(item.modified) || 0}`;
  }

  function parseBridgeJson(value, fallback) {
    try {
      return JSON.parse(value || "");
    } catch {
      return fallback;
    }
  }

  function setLibraryBadge(count) {
    if (!el.libraryBadge) return;
    el.libraryBadge.textContent = String(count);
    el.libraryBadge.hidden = count <= 0;
    el.libraryCount.textContent = String(count);
  }

  function refreshLibraryBadge() {
    if (!BRIDGE) return;
    const items = parseBridgeJson(BRIDGE.listGifs(), []);
    setLibraryBadge(Array.isArray(items) ? items.length : 0);
  }

  function mediaUrl(item) {
    return libraryUrl(item);
  }

  function thumbnailUrl(item) {
    return `https://app.local/thumb/${encodeURIComponent(item.name)}?v=${Number(item.modified) || 0}`;
  }

  function typeLabel(item) {
    if (item.type === "video") return "视频";
    if (item.type === "image") return "图片";
    return "GIF";
  }

  function openLibrary() {
    if (!BRIDGE) return;
    if (state.converting || state.saving) {
      showToast("正在处理，请稍候…");
      return;
    }
    state.libraryOpen = true;
    state.libraryFolder = "";
    state.libraryQuery = "";
    el.librarySearchInput.value = "";
    el.libraryPage.hidden = false;
    document.body.classList.add("library-open");
    closePreview();
    loadLibrary();
    el.libraryBack.focus({ preventScroll: true });
  }

  function closeLibrary() {
    state.libraryOpen = false;
    el.libraryPage.hidden = true;
    document.body.classList.remove("library-open");
    closePreview();
    closeModal(el.importModal);
    closeModal(el.folderModal);
    closeModal(el.folderDeleteModal);
    closeModal(el.moveModal);
    el.libraryList.replaceChildren();
    el.libraryFolders.replaceChildren();
    el.libraryEmpty.hidden = true;
  }

  function loadLibrary() {
    if (!BRIDGE) return;
    el.libraryLoading.hidden = false;
    el.libraryEmpty.hidden = true;
    el.libraryList.replaceChildren();
    el.libraryFolders.replaceChildren();
    let items = [];
    let folders = [];
    try {
      items = parseBridgeJson(BRIDGE.listGifs(), []);
      folders = parseBridgeJson(BRIDGE.listFolders(), []);
    } catch {
      items = [];
      folders = [];
    }
    state.libraryItems = Array.isArray(items) ? items : [];
    state.libraryFolders = Array.isArray(folders) ? folders : [];
    if (state.libraryFolder && !state.libraryFolders.includes(state.libraryFolder)) {
      state.libraryFolder = "";
    }
    el.libraryLoading.hidden = true;
    renderLibrary();
  }

  function openImportChooser() {
    if (!BRIDGE || state.importing) return;
    openModal(el.importModal);
  }

  function beginImport(kind) {
    if (!BRIDGE || state.importing) return;
    closeModal(el.importModal);
    state.importing = true;
    el.libraryImport.disabled = true;
    el.libraryImportLabel.textContent = "正在导入…";
    try {
      if (kind === "video") {
        BRIDGE.pickVideosToImport();
      } else {
        BRIDGE.pickImagesToImport();
      }
    } catch {
      state.importing = false;
      el.libraryImport.disabled = false;
      el.libraryImportLabel.textContent = "导入";
      showToast("无法打开照片选择器。", "error");
    }
  }

  window.onMediaImported = (ok, message, name) => {
    state.importing = false;
    el.libraryImport.disabled = false;
    el.libraryImportLabel.textContent = "导入";
    if (ok) {
      if (state.libraryFolder && name) {
        try {
          BRIDGE.moveToFolder(name, state.libraryFolder);
        } catch {
          // Keep the imported file at the root if the folder move fails.
        }
      }
      if (state.libraryOpen) loadLibrary();
      refreshLibraryBadge();
      showToast(message || "已导入作品库。", "success", 4200);
    } else if (message && !message.includes("取消")) {
      showToast(message, "error", 6000);
    }
  };

  function filteredLibraryItems() {
    const query = state.libraryQuery.trim().toLowerCase();
    if (query) {
      return state.libraryItems.filter((item) => item.name.toLowerCase().includes(query));
    }
    if (state.libraryFolder) {
      return state.libraryItems.filter((item) => item.folder === state.libraryFolder);
    }
    return state.libraryItems;
  }

  function renderLibrary() {
    const total = state.libraryItems.length;
    const items = filteredLibraryItems();
    const query = state.libraryQuery.trim();
    setLibraryBadge(total);
    renderFolders();

    if (query) {
      el.librarySummary.textContent = `找到 ${items.length} 个作品`;
    } else if (state.libraryFolder) {
      el.librarySummary.textContent = `文件夹「${state.libraryFolder}」 · ${items.length} 个作品`;
    } else {
      el.librarySummary.textContent = total ? `共 ${total} 个作品` : "还没有作品";
    }

    el.librarySearchClear.hidden = !query;
    el.folderRename.hidden = !state.libraryFolder;
    el.folderDelete.hidden = !state.libraryFolder;
    el.libraryList.replaceChildren();

    if (!items.length) {
      el.libraryEmpty.hidden = false;
      if (query) {
        el.libraryEmptyTitle.textContent = "没有找到匹配的作品";
        el.libraryEmptyCopy.innerHTML = "换一个关键词试试，<br>搜索会覆盖全部文件夹。";
        el.libraryEmptyClose.textContent = "查看全部作品";
        el.libraryEmptyClose.onclick = () => {
          state.libraryQuery = "";
          el.librarySearchInput.value = "";
          state.libraryFolder = "";
          renderLibrary();
        };
      } else if (state.libraryFolder) {
        el.libraryEmptyTitle.textContent = "这个文件夹是空的";
        el.libraryEmptyCopy.innerHTML = "点击作品上的「移动」，<br>把作品放进这个文件夹。";
        el.libraryEmptyClose.textContent = "查看全部作品";
        el.libraryEmptyClose.onclick = () => {
          state.libraryFolder = "";
          renderLibrary();
        };
      } else {
        el.libraryEmptyTitle.textContent = "还没有作品";
        el.libraryEmptyCopy.innerHTML = "生成的第一张 GIF 会自动保存在这里，<br>也可以导入图片、视频或 GIF。";
        el.libraryEmptyClose.textContent = "去生成一张";
        el.libraryEmptyClose.onclick = () => {
          closeLibrary();
          if (!state.media) window.setTimeout(() => el.fileInput.click(), 80);
        };
      }
      return;
    }

    el.libraryEmpty.hidden = true;
    for (const item of items) {
      el.libraryList.appendChild(buildLibraryCard(item, Boolean(query)));
    }
  }

  function renderFolders() {
    const counts = new Map();
    for (const item of state.libraryItems) {
      if (item.folder) counts.set(item.folder, (counts.get(item.folder) || 0) + 1);
    }
    el.libraryFolders.replaceChildren();
    const rootChip = makeFolderChip("全部", "", state.libraryItems.length, !state.libraryFolder && !state.libraryQuery);
    el.libraryFolders.appendChild(rootChip);
    for (const folder of state.libraryFolders) {
      el.libraryFolders.appendChild(makeFolderChip(
        folder,
        folder,
        counts.get(folder) || 0,
        state.libraryFolder === folder && !state.libraryQuery,
      ));
    }
    const add = document.createElement("button");
    add.type = "button";
    add.className = "folder-chip is-add";
    add.innerHTML = `<svg aria-hidden="true"><use href="#i-plus"></use></svg><span>新建</span>`;
    add.addEventListener("click", openCreateFolder);
    el.libraryFolders.appendChild(add);
  }

  function makeFolderChip(label, folder, count, active) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `folder-chip${active ? " is-active" : ""}`;
    chip.innerHTML = `<svg aria-hidden="true"><use href="#i-folder"></use></svg><span></span><small>${count}</small>`;
    chip.querySelector("span").textContent = label === "" ? "全部" : label;
    chip.addEventListener("click", () => {
      state.libraryFolder = folder;
      state.libraryQuery = "";
      el.librarySearchInput.value = "";
      renderLibrary();
    });
    return chip;
  }

  function buildLibraryCard(item, searching) {
    const card = document.createElement("article");
    card.className = "library-card";

    const thumb = document.createElement("button");
    thumb.type = "button";
    thumb.className = "library-thumb";
    thumb.setAttribute("aria-label", `预览 ${item.name}`);
    if (item.type === "video") {
      if (item.thumbnail) {
        const image = document.createElement("img");
        image.src = thumbnailUrl(item);
        image.alt = item.name;
        image.loading = "lazy";
        thumb.appendChild(image);
      } else {
        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        video.preload = "metadata";
        video.src = `${mediaUrl(item)}#t=0.1`;
        thumb.appendChild(video);
      }
      const play = document.createElement("span");
      play.className = "library-thumb-play";
      play.innerHTML = `<svg aria-hidden="true"><use href="#i-play"></use></svg>`;
      thumb.appendChild(play);
    } else {
      const image = document.createElement("img");
      image.src = mediaUrl(item);
      image.alt = item.name;
      image.loading = "lazy";
      image.decoding = "async";
      thumb.appendChild(image);
    }
    const badge = document.createElement("span");
    badge.className = `library-type${item.type === "gif" ? " is-gif" : item.type === "video" ? " is-video" : ""}`;
    badge.textContent = typeLabel(item);
    thumb.appendChild(badge);
    thumb.addEventListener("click", () => openPreview(item));

    const main = document.createElement("div");
    main.className = "library-card-main";

    const name = document.createElement("strong");
    name.className = "library-name";
    name.textContent = item.name;
    name.title = item.name;

    const meta = document.createElement("span");
    meta.className = "library-meta";
    meta.textContent = `${typeLabel(item)} · ${fmtBytes(item.size)} · ${fmtDate(item.modified)}`;
    if (item.folder && (searching || !state.libraryFolder)) {
      const folderTag = document.createElement("span");
      folderTag.className = "library-folder-tag";
      folderTag.textContent = ` · ${item.folder}`;
      meta.appendChild(folderTag);
    }

    const actions = document.createElement("div");
    actions.className = "library-actions";
    actions.append(
      makeLibraryAction("重命名", "#i-edit", "", () => openRename(item)),
      makeLibraryAction("移动", "#i-move", "", () => openMove(item)),
      makeLibraryAction("分享", "#i-share", "is-share", () => BRIDGE.shareMedia(item.name)),
      makeLibraryAction("删除", "#i-trash", "is-danger", () => openDelete(item)),
    );

    main.append(name, meta, actions);
    card.append(thumb, main);
    return card;
  }

  function makeLibraryAction(label, iconId, extraClass, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `library-action${extraClass ? ` ${extraClass}` : ""}`;
    button.innerHTML = `<svg aria-hidden="true"><use href="${iconId}"></use></svg>`;
    const text = document.createElement("span");
    text.textContent = label;
    button.appendChild(text);
    button.addEventListener("click", onClick);
    return button;
  }

  function openCreateFolder() {
    state.folderMode = "create";
    state.folderTarget = null;
    state.folderDeleteTarget = null;
    el.folderTitle.textContent = "新建文件夹";
    el.folderInput.value = "";
    el.folderError.textContent = "";
    openModal(el.folderModal);
    window.setTimeout(() => el.folderInput.focus({ preventScroll: true }), 60);
  }

  function openRenameFolder() {
    if (!state.libraryFolder) return;
    state.folderMode = "rename";
    state.folderTarget = state.libraryFolder;
    el.folderTitle.textContent = "重命名文件夹";
    el.folderInput.value = state.libraryFolder;
    el.folderError.textContent = "";
    openModal(el.folderModal);
    window.setTimeout(() => {
      el.folderInput.focus({ preventScroll: true });
      el.folderInput.select();
    }, 60);
  }

  function submitFolder() {
    if (!BRIDGE) return;
    const name = el.folderInput.value.trim();
    if (!name) {
      el.folderError.textContent = "请输入文件夹名称。";
      return;
    }
    let result;
    if (state.folderMode === "rename" && state.folderTarget) {
      result = parseBridgeJson(BRIDGE.renameFolder(state.folderTarget, name), { ok: false });
    } else {
      result = parseBridgeJson(BRIDGE.createFolder(name), { ok: false });
    }
    if (!result.ok) {
      el.folderError.textContent = result.error || "操作失败。";
      return;
    }
    if (state.folderMode === "rename" && state.folderTarget === state.libraryFolder) {
      state.libraryFolder = result.name || name;
    }
    closeModal(el.folderModal);
    state.folderTarget = null;
    showToast(state.folderMode === "rename" ? "文件夹已重命名。" : "文件夹已创建。", "success");
    loadLibrary();
  }

  function openDeleteFolder() {
    if (!state.libraryFolder) return;
    state.folderDeleteTarget = state.libraryFolder;
    const count = state.libraryItems.filter((item) => item.folder === state.libraryFolder).length;
    el.folderDeleteName.textContent = `${state.libraryFolder} · ${count} 个作品`;
    openModal(el.folderDeleteModal);
    el.folderDeleteConfirm.focus({ preventScroll: true });
  }

  function submitDeleteFolder() {
    if (!BRIDGE || !state.folderDeleteTarget) return;
    const folder = state.folderDeleteTarget;
    const result = parseBridgeJson(BRIDGE.deleteFolder(folder), { ok: false });
    if (!result.ok) {
      showToast(result.error || "删除文件夹失败。", "error");
      return;
    }
    closeModal(el.folderDeleteModal);
    state.folderDeleteTarget = null;
    state.libraryFolder = "";
    showToast(result.moved ? `文件夹已删除，${result.moved} 个作品移回全部作品。` : "文件夹已删除。", "success", 4200);
    loadLibrary();
  }

  function openMove(item) {
    if (!BRIDGE) return;
    state.moveTarget = item;
    el.moveName.textContent = item.name;
    el.moveOptions.replaceChildren();
    const choices = [""].concat(state.libraryFolders);
    for (const folder of choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "move-option";
      button.innerHTML = `<svg aria-hidden="true"><use href="#i-folder"></use></svg><span></span><small></small>`;
      button.querySelector("span").textContent = folder || "全部作品（根目录）";
      button.querySelector("small").textContent = item.folder === folder ? "当前位置" : "";
      button.addEventListener("click", () => moveItemTo(folder));
      el.moveOptions.appendChild(button);
    }
    openModal(el.moveModal);
    el.moveCancel.focus({ preventScroll: true });
  }

  function moveItemTo(folder) {
    if (!BRIDGE || !state.moveTarget) return;
    const result = parseBridgeJson(
      BRIDGE.moveToFolder(state.moveTarget.name, folder),
      { ok: false },
    );
    if (!result.ok) {
      showToast(result.error || "移动失败。", "error");
      return;
    }
    closeModal(el.moveModal);
    state.moveTarget = null;
    showToast(folder ? `已移动到「${folder}」。` : "已移回全部作品。", "success");
    loadLibrary();
  }

  function openRename(item) {
    state.renameTarget = item;
    const dot = item.name.lastIndexOf(".");
    const extension = dot > 0 ? item.name.slice(dot) : "";
    el.renameError.textContent = "";
    el.renameExtension.textContent = extension || "";
    el.renameInput.value = dot > 0 ? item.name.slice(0, dot) : item.name;
    openModal(el.renameModal);
    window.setTimeout(() => {
      el.renameInput.focus({ preventScroll: true });
      el.renameInput.select();
    }, 60);
  }

  function submitRename() {
    if (!state.renameTarget || !BRIDGE) return;
    const base = el.renameInput.value.trim();
    if (!base) {
      el.renameError.textContent = "请输入文件名。";
      return;
    }
    if (base.length > 60) {
      el.renameError.textContent = "文件名最多 60 个字符。";
      return;
    }
    const result = parseBridgeJson(
      BRIDGE.renameGif(state.renameTarget.name, base),
      { ok: false, error: "重命名失败" },
    );
    if (!result.ok) {
      el.renameError.textContent = result.error || "这个名称已经存在。";
      return;
    }
    closeModal(el.renameModal);
    state.renameTarget = null;
    showToast("已重命名。", "success");
    loadLibrary();
  }

  function openDelete(item) {
    state.deleteTarget = item;
    el.deleteName.textContent = item.name;
    openModal(el.deleteModal);
    el.deleteConfirm.focus({ preventScroll: true });
  }

  function submitDelete() {
    if (!state.deleteTarget || !BRIDGE) return;
    const result = parseBridgeJson(BRIDGE.deleteGif(state.deleteTarget.name), { ok: false });
    if (!result.ok) {
      showToast(result.error || "删除失败，请重试。", "error");
      return;
    }
    closeModal(el.deleteModal);
    state.deleteTarget = null;
    showToast("已从作品库删除。", "success");
    loadLibrary();
  }

  function openPreview(item) {
    if (!BRIDGE) return;
    state.previewTarget = item;
    el.previewStage.replaceChildren();
    if (item.type === "video") {
      const cover = document.createElement("button");
      cover.type = "button";
      cover.className = "preview-video-cover";
      cover.setAttribute("aria-label", `播放 ${item.name}`);
      if (item.thumbnail) {
        const image = document.createElement("img");
        image.src = thumbnailUrl(item);
        image.alt = item.name;
        cover.appendChild(image);
      } else {
        const icon = document.createElement("span");
        icon.className = "preview-video-icon";
        icon.innerHTML = `<svg aria-hidden="true"><use href="#i-video"></use></svg>`;
        cover.appendChild(icon);
      }
      const play = document.createElement("span");
      play.className = "preview-play-button";
      play.innerHTML = `<svg aria-hidden="true"><use href="#i-play"></use></svg><span>播放视频</span>`;
      cover.appendChild(play);
      cover.addEventListener("click", () => BRIDGE.playVideo(item.name));
      el.previewStage.appendChild(cover);
    } else {
      const image = document.createElement("img");
      image.src = mediaUrl(item);
      image.alt = item.name;
      el.previewStage.appendChild(image);
    }
    el.previewName.textContent = item.name;
    el.previewMeta.textContent = `${typeLabel(item)} · ${fmtBytes(item.size)} · ${fmtDate(item.modified)}${item.folder ? ` · ${item.folder}` : ""}`;
    el.previewGallery.hidden = !BRIDGE;
    el.previewGallery.disabled = false;
    el.previewGallery.textContent = "保存到手机";
    openModal(el.previewModal);
    el.previewClose.focus({ preventScroll: true });
  }

  function closePreview() {
    if (el.previewModal.hidden) return;
    const video = el.previewStage.querySelector("video");
    if (video) {
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch { /* no-op */ }
    }
    closeModal(el.previewModal);
    el.previewStage.replaceChildren();
    state.previewTarget = null;
  }

  function saveGif(auto = false) {
    if (!state.result || !state.resultBytes || state.saving) return;
    if (!BRIDGE) {
      if (auto) return;
      const link = document.createElement("a");
      link.href = state.resultUrl;
      link.download = state.result.filename;
      link.click();
      return;
    }
    if (state.saved) {
      if (!auto) openLibrary();
      return;
    }

    state.saving = true;
    setNativeBusy(true);
    el.downloadLabel.textContent = auto ? "正在保存到作品…" : "正在保存…";
    try {
      BRIDGE.beginSave(state.result.filename);
      sendBase64Chunks(state.resultBytes, 384 * 1024, (chunk) => BRIDGE.appendSave(chunk));
      BRIDGE.finishSave();
    } catch (error) {
      state.saving = false;
      setNativeBusy(false);
      el.downloadLabel.textContent = "重试保存";
      try { BRIDGE.cancelSave(); } catch { /* no-op */ }
      showToast("保存失败，请重试。", "error");
    }
  }

  window.onGifSaved = (ok, message, name) => {
    state.saving = false;
    setNativeBusy(false);
    if (ok) {
      state.saved = true;
      state.savedName = name || null;
      refreshLibraryBadge();
      if (state.libraryOpen) loadLibrary();
      if (!state.result) {
        showToast(message || "已私密保存到作品库", "success", 3200);
        state.shareAfterSave = false;
        if (state.galleryAfterSave && state.savedName) {
          state.galleryAfterSave = false;
          exportToGallery(state.savedName);
        }
        return;
      }
      if (name) {
        state.result.filename = name;
        if (!el.resultModal.hidden) {
          el.resultFilename.textContent = name;
          el.resultGif.alt = `生成的 GIF：${name}`;
        }
      }
      el.downloadLabel.textContent = "打开作品库";
      setButtonIcon(el.downloadButton, "#i-folder");
      el.resultLede.textContent = "已私密保存在作品库，可随时分享。";
      showToast(message || "已私密保存到作品库", "success", 3200);
      if (state.galleryAfterSave && state.savedName) {
        state.galleryAfterSave = false;
        exportToGallery(state.savedName);
      }
      if (state.shareAfterSave && BRIDGE) {
        state.shareAfterSave = false;
        if (state.savedName) BRIDGE.shareMedia(state.savedName);
      }
    } else {
      el.downloadLabel.textContent = "重试保存";
      setButtonIcon(el.downloadButton, "#i-download");
      el.resultLede.textContent = "节奏和时长都没变，保存失败后可重试。";
      showToast(message || "保存失败，请重试。", "error", 6000);
    }
  };

  function shareGif() {
    if (!BRIDGE) return;
    if (state.saved && state.savedName) {
      BRIDGE.shareMedia(state.savedName);
    } else {
      state.shareAfterSave = true;
      saveGif();
    }
  }

  function exportToGallery(name) {
    if (!BRIDGE || !name || state.gallerySaving) return;
    state.gallerySaving = true;
    setNativeBusy(true);
    if (el.resultGalleryButton) {
      el.resultGalleryButton.disabled = true;
      el.resultGalleryButton.textContent = "正在保存…";
    }
    if (el.previewGallery) {
      el.previewGallery.disabled = true;
      el.previewGallery.textContent = "正在保存…";
    }
    try {
      BRIDGE.saveMediaToGallery(name);
    } catch {
      state.gallerySaving = false;
      setNativeBusy(false);
      resetGalleryButtons();
      showToast("保存到手机失败，请重试。", "error");
    }
  }

  function resetGalleryButtons() {
    if (el.resultGalleryButton) {
      el.resultGalleryButton.disabled = false;
      el.resultGalleryButton.textContent = "保存到手机";
    }
    if (el.previewGallery) {
      el.previewGallery.disabled = false;
      el.previewGallery.textContent = "保存到手机";
    }
  }

  window.onGallerySaved = (ok, message) => {
    state.gallerySaving = false;
    setNativeBusy(false);
    resetGalleryButtons();
    showToast(
      ok ? (message || "已保存到手机相册，可在相册中查看。") : (message || "保存到手机失败，请重试。"),
      ok ? "success" : "error",
      ok ? 4200 : 6000,
    );
  };

  // ------------------------------------------------------------------
  // Result
  // ------------------------------------------------------------------

  function populateResult(result) {
    const speed = Number(result.speed) || 1;
    const speedText = formatSpeed(speed);
    el.resultGif.classList.remove("is-loaded");
    el.resultGif.onload = () => el.resultGif.classList.add("is-loaded");
    el.resultGif.onerror = () => el.resultGif.classList.add("is-loaded");
    el.resultGif.src = `${result.url}`;
    el.resultGif.alt = `生成的 GIF：${result.filename}`;
    el.resultFilename.textContent = result.filename;
    el.resultLoopLabel.textContent = result.loop
      ? `${speedText}× ${speed === 1 ? "原速" : "变速"}循环`
      : `${speedText}× ${speed === 1 ? "原速" : "变速"} · 播放一次`;
    el.resultLede.textContent = speed === 1
      ? "节奏和时长都没变，正在保存到作品库。"
      : `已按 ${speedText}× ${speed > 1 ? "加快" : "放慢"}生成，正在保存到作品库。`;
    el.resultDuration.textContent = `${Number(result.duration).toFixed(2)}s`;
    el.resultResolution.textContent = `${result.width} × ${result.height}`;
    el.resultFps.textContent = `${result.fps}fps`;
    el.resultSize.textContent = fmtBytes(result.size);
    el.downloadButton.href = result.url;
    el.downloadButton.setAttribute("download", result.filename);
    el.downloadLabel.textContent = "保存到作品";
    setButtonIcon(el.downloadButton, "#i-download");
    el.resultGalleryButton.hidden = !BRIDGE;
    el.resultGalleryButton.disabled = false;
    el.resultGalleryButton.textContent = "保存到手机";
    el.shareButton.hidden = !BRIDGE;
    state.saving = false;
    state.saved = false;
    state.savedName = null;
    state.shareAfterSave = false;
    state.gallerySaving = false;
    state.galleryAfterSave = false;

    const expected = Number(result.expected_duration) || Number(result.source_duration) / speed;
    const delta = Number(result.delta_ms) || 0;
    const tolerance = Math.max(130, 1050 / Math.max(result.fps || 1, 1));
    const timingOk = Math.abs(delta) <= tolerance;
    el.timingCheck.classList.toggle("is-warn", !timingOk);
    if (timingOk) {
      el.timingCheck.querySelector("strong").textContent = speed === 1 ? "时长与视频一致" : "变速后时长一致";
      el.timingDetail.textContent = speed === 1
        ? `原片 ${Number(result.source_duration).toFixed(2)}s · 输出 ${Number(result.duration).toFixed(2)}s`
        : `原片 ${Number(result.source_duration).toFixed(2)}s ÷ ${speedText}× = ${expected.toFixed(2)}s · 输出 ${Number(result.duration).toFixed(2)}s`;
    } else {
      el.timingCheck.querySelector("strong").textContent = `时长偏差 ${Math.round(delta)} ms`;
      el.timingDetail.textContent = `按 ${speedText}× 计算应为 ${expected.toFixed(2)}s，GIF 实际 ${Number(result.duration).toFixed(2)}s`;
    }
  }

  function closeResult() {
    closeModal(el.resultModal);
    el.resultGif.removeAttribute("src");
    setStateChip(state.media ? "已就绪" : "待选择", state.media ? "ready" : "");
    showCta(Boolean(state.media));
    el.ctaConvert.disabled = false;
  }

  // ------------------------------------------------------------------
  // Events
  // ------------------------------------------------------------------

  function bindUploadEvents() {
    el.dropzone.addEventListener("click", (event) => {
      if (event.target.closest("#remove-media")) return;
      if (state.busy || state.converting) return;
      el.fileInput.click();
    });
    el.dropzone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!state.busy) el.fileInput.click();
      }
    });
    el.fileInput.addEventListener("change", () => {
      const file = el.fileInput.files?.[0];
      if (file) handleFile(file);
      el.fileInput.value = "";
    });
    el.removeMedia.addEventListener("click", (event) => {
      event.stopPropagation();
      if (state.converting) return;
      resetApp();
      showToast("视频已移除。");
    });
  }

  function bindTimelineEvents() {
    el.trimTrack.addEventListener("pointerdown", startDrag);
    el.trimTrack.addEventListener("pointermove", moveDrag);
    el.trimTrack.addEventListener("pointerup", endDrag);
    el.trimTrack.addEventListener("pointercancel", endDrag);
    el.trimTrack.addEventListener("lostpointercapture", () => { state.dragHandle = null; });

    el.trimSelection.querySelectorAll("[data-handle]").forEach((handle) => {
      handle.addEventListener("keydown", (event) => {
        const which = handle.dataset.handle;
        let delta = 0;
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") delta = -0.1;
        if (event.key === "ArrowRight" || event.key === "ArrowUp") delta = 0.1;
        if (!delta) return;
        event.preventDefault();
        nudgeHandle(which, event.shiftKey ? delta * 5 : delta);
      });
    });

    el.resetTrim.addEventListener("click", () => {
      if (!state.media) return;
      state.start = 0;
      state.end = state.media.duration || 0;
      updateTrimUi();
      seekTo(0);
    });

    el.segmentPlay.addEventListener("click", toggleSegmentPreview);
    el.video.addEventListener("timeupdate", () => {
      updatePlayhead();
      if (state.segmentPreview && el.video.currentTime >= state.end - 0.02) {
        el.video.pause();
        el.video.currentTime = state.end;
        setSegmentPreview(false);
      }
    });
    el.video.addEventListener("play", updatePlayhead);
    el.video.addEventListener("pause", () => {
      if (state.segmentPreview && el.video.currentTime < state.end - 0.04) setSegmentPreview(false);
    });
    el.video.addEventListener("seeked", updatePlayhead);
    el.video.addEventListener("error", () => {
      if (state.media) showToast("系统无法预览这个视频编码，但仍可尝试生成。", "error", 5200);
    });
  }

  function bindSettingsEvents() {
    el.fpsGroup.addEventListener("click", (event) => {
      const button = event.target.closest("[data-fps]");
      if (!button) return;
      state.fps = Number(button.dataset.fps);
      syncSettingsControls();
      updateSummary();
    });
    el.widthGroup.addEventListener("click", (event) => {
      const button = event.target.closest("[data-width]");
      if (!button) return;
      state.width = button.dataset.width === "original" ? "original" : Number(button.dataset.width);
      syncSettingsControls();
      updateSummary();
    });
    el.colorGroup.addEventListener("click", (event) => {
      const button = event.target.closest("[data-colors]");
      if (!button) return;
      state.colors = Number(button.dataset.colors);
      syncSettingsControls();
      updateSummary();
    });
    el.speedGroup.addEventListener("click", (event) => {
      const button = event.target.closest("[data-speed]");
      if (!button) return;
      state.speed = Number(button.dataset.speed) || 1;
      syncSettingsControls();
      updateSummary();
    });
    el.loopToggle.addEventListener("click", () => {
      state.loop = !state.loop;
      syncSettingsControls();
    });
    el.convertButton.addEventListener("click", startConversion);
    el.ctaConvert.addEventListener("click", startConversion);
  }

  function bindModalEvents() {
    el.cancelButton.addEventListener("click", cancelConversion);
    el.resultClose.addEventListener("click", closeResult);
    el.resultModal.querySelectorAll("[data-close-result]").forEach((node) => {
      node.addEventListener("click", closeResult);
    });

    el.downloadButton.addEventListener("click", (event) => {
      if (!BRIDGE) return;
      event.preventDefault();
      if (state.saved) {
        closeResult();
        openLibrary();
      } else {
        saveGif();
      }
    });
    el.shareButton.addEventListener("click", shareGif);
    el.resultGalleryButton.addEventListener("click", () => {
      if (!BRIDGE) return;
      if (state.savedName) {
        exportToGallery(state.savedName);
      } else {
        state.galleryAfterSave = true;
        saveGif();
      }
    });

    el.againButton.addEventListener("click", () => {
      if (state.saving) {
        showToast("正在保存，请稍候…");
        return;
      }
      closeResult();
      setStateChip("已就绪", "ready");
      el.convertButton.focus({ preventScroll: true });
    });

    el.newVideoButton.addEventListener("click", () => {
      if (state.saving) {
        showToast("正在保存，请稍候…");
        return;
      }
      closeResult();
      resetApp();
      window.setTimeout(() => el.fileInput.click(), 80);
    });
  }

  function bindLibraryEvents() {
    el.libraryButton.addEventListener("click", openLibrary);
    el.libraryBack.addEventListener("click", closeLibrary);
    el.libraryRefresh.addEventListener("click", loadLibrary);
    el.libraryImport.addEventListener("click", openImportChooser);
    el.importImages.addEventListener("click", () => beginImport("image"));
    el.importVideos.addEventListener("click", () => beginImport("video"));
    el.importCancel.addEventListener("click", () => closeModal(el.importModal));
    el.importModal.querySelectorAll("[data-close-import]").forEach((node) => {
      node.addEventListener("click", () => closeModal(el.importModal));
    });
    el.librarySearchInput.addEventListener("input", () => {
      state.libraryQuery = el.librarySearchInput.value;
      renderLibrary();
    });
    el.librarySearchClear.addEventListener("click", () => {
      state.libraryQuery = "";
      el.librarySearchInput.value = "";
      renderLibrary();
    });
    el.folderCreate.addEventListener("click", openCreateFolder);
    el.folderRename.addEventListener("click", openRenameFolder);
    el.folderDelete.addEventListener("click", openDeleteFolder);
    el.folderCancel.addEventListener("click", () => closeModal(el.folderModal));
    el.folderModal.querySelectorAll("[data-close-folder]").forEach((node) => {
      node.addEventListener("click", () => closeModal(el.folderModal));
    });
    el.folderConfirm.addEventListener("click", submitFolder);
    el.folderInput.addEventListener("input", () => { el.folderError.textContent = ""; });
    el.folderInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submitFolder();
      }
    });
    el.folderDeleteCancel.addEventListener("click", () => {
      closeModal(el.folderDeleteModal);
      state.folderDeleteTarget = null;
    });
    el.folderDeleteModal.querySelectorAll("[data-close-folder-delete]").forEach((node) => {
      node.addEventListener("click", () => {
        closeModal(el.folderDeleteModal);
        state.folderDeleteTarget = null;
      });
    });
    el.folderDeleteConfirm.addEventListener("click", submitDeleteFolder);
    el.moveCancel.addEventListener("click", () => {
      closeModal(el.moveModal);
      state.moveTarget = null;
    });
    el.moveModal.querySelectorAll("[data-close-move]").forEach((node) => {
      node.addEventListener("click", () => {
        closeModal(el.moveModal);
        state.moveTarget = null;
      });
    });

    el.renameCancel.addEventListener("click", () => {
      closeModal(el.renameModal);
      state.renameTarget = null;
    });
    el.renameModal.querySelectorAll("[data-close-rename]").forEach((node) => {
      node.addEventListener("click", () => {
        closeModal(el.renameModal);
        state.renameTarget = null;
      });
    });
    el.renameConfirm.addEventListener("click", submitRename);
    el.renameInput.addEventListener("input", () => { el.renameError.textContent = ""; });
    el.renameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submitRename();
      }
    });

    el.deleteCancel.addEventListener("click", () => {
      closeModal(el.deleteModal);
      state.deleteTarget = null;
    });
    el.deleteModal.querySelectorAll("[data-close-delete]").forEach((node) => {
      node.addEventListener("click", () => {
        closeModal(el.deleteModal);
        state.deleteTarget = null;
      });
    });
    el.deleteConfirm.addEventListener("click", submitDelete);

    el.previewClose.addEventListener("click", closePreview);
    el.previewModal.querySelectorAll("[data-close-preview]").forEach((node) => {
      node.addEventListener("click", closePreview);
    });
    el.previewShare.addEventListener("click", () => {
      if (state.previewTarget && BRIDGE) BRIDGE.shareMedia(state.previewTarget.name);
    });
    el.previewGallery.addEventListener("click", () => {
      if (state.previewTarget && BRIDGE) exportToGallery(state.previewTarget.name);
    });
  }

  window.androidBack = () => {
    if (!el.importModal.hidden) {
      closeModal(el.importModal);
      return true;
    }
    if (!el.folderModal.hidden) {
      closeModal(el.folderModal);
      state.folderTarget = null;
      return true;
    }
    if (!el.folderDeleteModal.hidden) {
      closeModal(el.folderDeleteModal);
      state.folderDeleteTarget = null;
      return true;
    }
    if (!el.moveModal.hidden) {
      closeModal(el.moveModal);
      state.moveTarget = null;
      return true;
    }
    if (!el.renameModal.hidden) {
      closeModal(el.renameModal);
      state.renameTarget = null;
      return true;
    }
    if (!el.deleteModal.hidden) {
      closeModal(el.deleteModal);
      state.deleteTarget = null;
      return true;
    }
    if (!el.previewModal.hidden) {
      closePreview();
      return true;
    }
    if (!el.resultModal.hidden) {
      closeResult();
      return true;
    }
    if (state.libraryOpen) {
      closeLibrary();
      return true;
    }
    if (!el.progressModal.hidden) {
      if (state.converting) {
        showToast("正在生成，请先点“取消”。");
      } else {
        closeModal(el.progressModal);
        resetProgressUi();
      }
      return true;
    }
    return false;
  };

  function init() {
    bindUploadEvents();
    bindTimelineEvents();
    bindSettingsEvents();
    bindModalEvents();
    bindLibraryEvents();
    updateSummary();

    if (BRIDGE) {
      refreshLibraryBadge();
    } else if (el.libraryButton) {
      el.libraryButton.hidden = true;
    }

    if (!window.WebAssembly) {
      el.healthBanner.hidden = false;
      el.healthMessage.textContent = "当前系统 WebView 不支持 WebAssembly，无法生成 GIF。请更新 Android System WebView。";
      setStateChip("不支持");
      el.convertButton.disabled = true;
    }
    if ("ontouchstart" in window) {
      document.documentElement.classList.add("touch");
    }
  }

  init();
})();


