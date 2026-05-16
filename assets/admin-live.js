let adminPassword = "";
let galleries = [];
let site = {};
let currentIndex = 0;

let draggedGalleryIndex = null;
let draggedImageIndex = null;
let pendingCover = null;
let pendingDetails = [];
let activeDragItem = null;

const WATERMARK_STORAGE_KEY = "WATERMARK_SETTINGS_V1";

function toast(msg) {
  const el = document.querySelector("#toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
}

function logDebug(data) {
  const el = document.querySelector("#debugLog");
  if (!el) return;
  el.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

function setDebug(id, text, cls = "") {
  const el = document.querySelector(`#${id}`);
  if (!el) return;
  el.textContent = text;
  el.className = cls;
}

function getBeijingDateParts(date) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const obj = {};
  parts.forEach(part => {
    if (part.type !== "literal") obj[part.type] = Number(part.value);
  });
  return obj;
}

function beijingDayNumber(date) {
  const p = getBeijingDateParts(date);
  return Math.floor(Date.UTC(p.year, p.month - 1, p.day) / 86400000);
}

function chineseNumber(num) {
  const map = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  if (num <= 10) return map[num] || String(num);
  if (num < 20) return "十" + map[num - 10];
  if (num < 100) {
    const ten = Math.floor(num / 10);
    const one = num % 10;
    return map[ten] + "十" + (one ? map[one] : "");
  }
  return String(num);
}

function formatRelativeDate(gallery) {
  const raw = gallery && (gallery.createdAt || gallery.uploadedAt);
  if (!raw) return (gallery && gallery.date) || "今天";

  const created = new Date(raw);
  if (Number.isNaN(created.getTime())) return (gallery && gallery.date) || "今天";

  const diff = Math.max(0, beijingDayNumber(new Date()) - beijingDayNumber(created));
  if (diff === 0) return "今天";
  if (diff === 1) return "昨天";
  if (diff < 7) return `${chineseNumber(diff)}天前`;
  if (diff < 30) return `${chineseNumber(Math.floor(diff / 7))}周前`;
  if (diff < 365) return `${chineseNumber(Math.floor(diff / 30))}个月前`;
  return `${chineseNumber(Math.floor(diff / 365))}年前`;
}

function touchGalleryCreatedAt(gallery) {
  if (gallery && !gallery.createdAt) gallery.createdAt = new Date().toISOString();
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "未知";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function safeFilename(name) {
  return String(name || "image").replace(/\.[^.]+$/, "").slice(0, 80);
}

async function apiJson(url, options = {}) {
  const headers = options.headers || {};
  headers["x-admin-password"] = adminPassword;

  if (options.body && !(options.body instanceof FormData)) {
    headers["content-type"] = "application/json";
  }

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(data.error || data.message || text || `HTTP ${res.status}`);
  }

  return data;
}

async function login() {
  adminPassword = document.querySelector("#passwordInput").value.trim();

  if (!adminPassword) return toast("请输入管理员密码");

  sessionStorage.setItem("ADMIN_PASSWORD", adminPassword);

  try {
    await loadAll();
    document.querySelector("#loginCard").classList.add("hidden");
    document.querySelector("#adminApp").classList.remove("hidden");
    initWatermarkControls();
    await runDebug();
  } catch (err) {
    logDebug("登录或加载失败：\n" + err.message);
    toast("登录失败：" + err.message);
  }
}

async function loadAll() {
  site = await apiJson("./api/site");
  galleries = await apiJson("./api/galleries");

  if (!galleries.length) addGallery(false);

  galleries.forEach(g => {
    if (!Array.isArray(g.images)) g.images = [];
    if (!Array.isArray(g.tags)) g.tags = [];
    if (!g.buyUrl) g.buyUrl = "";
  });

  fillSite();
  selectGallery(0);
}

function fillSite() {
  document.querySelector("#siteName").value = site.siteName || "女明星生图";
  document.querySelector("#title1").value = site.title1 || "精选女明星生图";
  document.querySelector("#title2").value = site.title2 || "高清原图预览";
  document.querySelector("#description").value = site.description || "";
  const aboutInput = document.querySelector("#aboutTextInput");
  if (aboutInput) aboutInput.value = site.aboutText || "";
}

async function saveSite() {
  try {
    site = {
      siteName: document.querySelector("#siteName").value.trim(),
      title1: document.querySelector("#title1").value.trim(),
      title2: document.querySelector("#title2").value.trim(),
      description: document.querySelector("#description").value.trim(),
      aboutText: document.querySelector("#aboutTextInput")?.value.trim() || ""
    };

    const result = await apiJson("./api/site", {
      method: "POST",
      body: JSON.stringify(site)
    });

    logDebug({ action: "saveSite", result });
    toast("网站设置已保存");
  } catch (err) {
    logDebug("保存网站设置失败：\n" + err.message);
    toast("保存失败：" + err.message);
  }
}

function renderList() {
  const list = document.querySelector("#galleryList");

  list.innerHTML = galleries.map((g, i) => `
    <div
      class="gallery-item ${i === currentIndex ? "active" : ""}"
      draggable="true"
      onclick="selectGallery(${i})"
      ondragstart="handleGalleryDragStart(event, ${i})"
      ondragover="handleGalleryDragOver(event)"
      ondrop="handleGalleryDrop(event, ${i})"
      ondragend="handleGalleryDragEnd(event)"
      title="按住拖动可以调整图集顺序"
      style="cursor:grab"
    >
      <div class="thumb">
        <img src="${g.cover || ""}" loading="lazy" decoding="async">
      </div>
      <div class="gallery-info">
        <strong>${g.title || "未命名图集"}</strong>
        <span>${g.category || ""} · ${formatRelativeDate(g)} · ${(g.images || []).length} 张</span>
      </div>
      <span class="badge">拖动</span>
    </div>
  `).join("");
}

function handleGalleryDragStart(event, index) {
  draggedGalleryIndex = index;
  event.currentTarget.style.opacity = "0.45";
  event.currentTarget.style.cursor = "grabbing";

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  }
}

function handleGalleryDragOver(event) {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
}

async function handleGalleryDrop(event, targetIndex) {
  event.preventDefault();

  if (draggedGalleryIndex === null) return;
  if (draggedGalleryIndex === targetIndex) return;

  const moved = galleries.splice(draggedGalleryIndex, 1)[0];
  galleries.splice(targetIndex, 0, moved);

  currentIndex = targetIndex;
  draggedGalleryIndex = null;

  renderList();
  selectGallery(currentIndex);

  try {
    await saveGalleries();
    toast("图集顺序已调整并保存");
  } catch (err) {
    logDebug("图集排序保存失败：\n" + err.message);
    toast("图集排序保存失败：" + err.message);
  }
}

function handleGalleryDragEnd(event) {
  draggedGalleryIndex = null;
  event.currentTarget.style.opacity = "1";
  event.currentTarget.style.cursor = "grab";
}

function selectGallery(index) {
  currentIndex = Math.max(0, Math.min(index, galleries.length - 1));

  const g = galleries[currentIndex];
  if (!g) return;

  document.querySelector("#galleryId").value = g.id;
  document.querySelector("#galleryTitle").value = g.title || "";
  document.querySelector("#galleryCategory").value = g.category || "活动";
  document.querySelector("#galleryDate").value = formatRelativeDate(g);
  document.querySelector("#galleryTags").value = (g.tags || []).join(", ");
  const buyUrlInput = document.querySelector("#galleryBuyUrl");
  if (buyUrlInput) buyUrlInput.value = g.buyUrl || "";
  document.querySelector("#coverPreview").src = g.cover || "";

  clearPendingCover(false);
  clearPendingDetails(false);
  renderImages();
  renderList();
}

function syncForm() {
  const g = galleries[currentIndex];
  if (!g) return;

  g.title = document.querySelector("#galleryTitle").value.trim();
  g.category = document.querySelector("#galleryCategory").value;
  g.date = formatRelativeDate(g);
  g.tags = document.querySelector("#galleryTags").value
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
  const buyUrlInput = document.querySelector("#galleryBuyUrl");
  g.buyUrl = buyUrlInput ? buyUrlInput.value.trim() : (g.buyUrl || "");
}

function renderImages() {
  const g = galleries[currentIndex];
  if (!g) return;

  if (!Array.isArray(g.images)) g.images = [];

  document.querySelector("#detailPreview").innerHTML = g.images.map((src, i) => `
    <div
      class="image-card"
      draggable="true"
      ondragstart="handleImageDragStart(event, ${i})"
      ondragover="handleImageDragOver(event)"
      ondrop="handleImageDrop(event, ${i})"
      ondragend="handleImageDragEnd(event)"
      title="按住拖动可以调整图片顺序"
      style="cursor:grab"
    >
      <img src="${src}" loading="lazy" decoding="async">
      <button onclick="removeImage(${i})">×</button>
    </div>
  `).join("");
}

function handleImageDragStart(event, index) {
  draggedImageIndex = index;
  event.currentTarget.style.opacity = "0.45";
  event.currentTarget.style.cursor = "grabbing";

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  }
}

function handleImageDragOver(event) {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
}

async function handleImageDrop(event, targetIndex) {
  event.preventDefault();

  const g = galleries[currentIndex];
  if (!g || !Array.isArray(g.images)) return;

  if (draggedImageIndex === null) return;
  if (draggedImageIndex === targetIndex) return;

  const moved = g.images.splice(draggedImageIndex, 1)[0];
  g.images.splice(targetIndex, 0, moved);

  draggedImageIndex = null;

  renderImages();
  renderList();

  try {
    await saveGalleries();
    toast("图片顺序已调整并保存");
  } catch (err) {
    logDebug("图片排序保存失败：\n" + err.message);
    toast("图片排序保存失败：" + err.message);
  }
}

function handleImageDragEnd(event) {
  draggedImageIndex = null;
  event.currentTarget.style.opacity = "1";
  event.currentTarget.style.cursor = "grab";
}

async function saveGalleries() {
  try {
    syncForm();

    galleries.forEach(g => {
      if (g.createdAt) g.date = formatRelativeDate(g);
      if (!g.buyUrl) g.buyUrl = "";
    });

    const result = await apiJson("./api/galleries", {
      method: "POST",
      body: JSON.stringify(galleries)
    });

    renderList();

    logDebug({
      action: "saveGalleries",
      result,
      currentGallery: galleries[currentIndex]
    });

    toast("图集已保存，网站会自动更新");
  } catch (err) {
    logDebug("保存图集失败：\n" + err.message);
    toast("保存失败：" + err.message);
    throw err;
  }
}

function addGallery(save = true) {
  const next = galleries.length + 1;

  galleries.push({
    id: `gallery-${String(next).padStart(3, "0")}`,
    title: "新图集标题",
    category: "活动",
    createdAt: new Date().toISOString(),
    date: "今天",
    cover: "",
    tags: ["生图"],
    buyUrl: "",
    images: []
  });

  selectGallery(galleries.length - 1);

  if (save) toast("已新增图集，请上传图片并保存");
}

async function deleteGallery() {
  if (!confirm("确定删除这个图集吗？")) return;

  galleries.splice(currentIndex, 1);

  if (!galleries.length) addGallery(false);

  currentIndex = 0;
  selectGallery(0);
  await saveGalleries();
}

function removeImage(i) {
  const g = galleries[currentIndex];
  if (!g || !Array.isArray(g.images)) return;

  g.images.splice(i, 1);
  renderImages();
  renderList();
}

function clearImages() {
  const g = galleries[currentIndex];
  if (!g) return;

  g.images = [];
  renderImages();
  renderList();
}

function moveImage() {
  const arr = galleries[currentIndex].images || [];

  if (arr.length > 1) {
    arr.unshift(arr.pop());
    renderImages();
    toast("已调整顺序，记得保存");
  }
}

function getWatermarkSettings() {
  return {
    darkEnabled: document.querySelector("#wmDarkEnabled")?.checked ?? true,
    darkText: document.querySelector("#wmDarkText")?.value || "明星生图 · maimg.com",
    darkStyle: document.querySelector("#wmDarkStyle")?.value || "soft",
    darkOpacity: Number(document.querySelector("#wmDarkOpacity")?.value || 24) / 100,
    darkSize: Number(document.querySelector("#wmDarkSize")?.value || 24),
    darkDensity: Number(document.querySelector("#wmDarkDensity")?.value || 340),
    darkLineHeight: Number(document.querySelector("#wmDarkLineHeight")?.value || 1.35),
    darkOffsetX: Number(document.querySelector("#wmDarkOffsetX")?.value || 0),
    darkOffsetY: Number(document.querySelector("#wmDarkOffsetY")?.value || 0),
    mainEnabled: document.querySelector("#wmMainEnabled")?.checked ?? true,
    mainText: document.querySelector("#wmMainText")?.value || "maimg.com",
    mainStyle: document.querySelector("#wmMainStyle")?.value || "white",
    mainSize: Number(document.querySelector("#wmMainSize")?.value || 86),
    mainOpacity: Number(document.querySelector("#wmMainOpacity")?.value || 95) / 100,
    mainLineHeight: Number(document.querySelector("#wmMainLineHeight")?.value || 1.2)
  };
}

function saveWatermarkSettings() {
  try {
    localStorage.setItem(WATERMARK_STORAGE_KEY, JSON.stringify(getWatermarkSettings()));
  } catch {}
}

function initWatermarkControls() {
  const raw = localStorage.getItem(WATERMARK_STORAGE_KEY);
  if (raw) {
    try {
      const s = JSON.parse(raw);
      if (document.querySelector("#wmDarkEnabled")) document.querySelector("#wmDarkEnabled").checked = s.darkEnabled !== false;
      if (document.querySelector("#wmDarkText")) document.querySelector("#wmDarkText").value = s.darkText || "明星生图 · maimg.com";
      if (document.querySelector("#wmDarkStyle")) document.querySelector("#wmDarkStyle").value = s.darkStyle || "soft";
      if (document.querySelector("#wmDarkOpacity")) document.querySelector("#wmDarkOpacity").value = Math.round((s.darkOpacity ?? 0.24) * 100);
      if (document.querySelector("#wmDarkSize")) document.querySelector("#wmDarkSize").value = s.darkSize || 24;
      if (document.querySelector("#wmDarkDensity")) document.querySelector("#wmDarkDensity").value = s.darkDensity || 340;
      if (document.querySelector("#wmDarkLineHeight")) document.querySelector("#wmDarkLineHeight").value = s.darkLineHeight || 1.35;
      if (document.querySelector("#wmDarkOffsetX")) document.querySelector("#wmDarkOffsetX").value = s.darkOffsetX || 0;
      if (document.querySelector("#wmDarkOffsetY")) document.querySelector("#wmDarkOffsetY").value = s.darkOffsetY || 0;
      if (document.querySelector("#wmMainEnabled")) document.querySelector("#wmMainEnabled").checked = s.mainEnabled !== false;
      if (document.querySelector("#wmMainText")) document.querySelector("#wmMainText").value = s.mainText || "maimg.com";
      if (document.querySelector("#wmMainStyle")) document.querySelector("#wmMainStyle").value = s.mainStyle || "white";
      if (document.querySelector("#wmMainSize")) document.querySelector("#wmMainSize").value = s.mainSize || 86;
      if (document.querySelector("#wmMainOpacity")) document.querySelector("#wmMainOpacity").value = Math.round((s.mainOpacity ?? 0.95) * 100);
      if (document.querySelector("#wmMainLineHeight")) document.querySelector("#wmMainLineHeight").value = s.mainLineHeight || 1.2;
    } catch {}
  }

  [
    "wmDarkEnabled", "wmDarkText", "wmDarkStyle", "wmDarkOpacity", "wmDarkSize", "wmDarkDensity", "wmDarkLineHeight", "wmDarkOffsetX", "wmDarkOffsetY",
    "wmMainEnabled", "wmMainText", "wmMainStyle", "wmMainSize", "wmMainOpacity", "wmMainLineHeight"
  ].forEach(id => {
    const el = document.querySelector(`#${id}`);
    if (!el) return;
    el.addEventListener("input", () => { saveWatermarkSettings(); rerenderPendingPreviews(); });
    el.addEventListener("change", () => { saveWatermarkSettings(); rerenderPendingPreviews(); });
  });

  saveWatermarkSettings();
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片读取失败，可能是格式不支持或文件损坏"));
    };
    img.src = url;
  });
}

function getScaledSize(img, maxWidth) {
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;
  if (width > maxWidth) {
    height = Math.round(height * maxWidth / width);
    width = maxWidth;
  }
  return { width, height };
}

function drawImageWithWatermarks(canvas, img, options = {}) {
  const preview = options.preview || false;
  const maxWidth = options.maxWidth || (preview ? 520 : 1600);
  const size = getScaledSize(img, maxWidth);
  canvas.width = size.width;
  canvas.height = size.height;

  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const settings = getWatermarkSettings();
  if (settings.darkEnabled) drawCleanFullscreenWatermark(ctx, canvas.width, canvas.height, settings);
  if (settings.mainEnabled) drawMainWatermark(ctx, canvas.width, canvas.height, settings, options.mainPos || { xRatio: 0.5, yRatio: 0.56 });
}

function getLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function measureMultiline(ctx, lines, lineHeightPx) {
  let width = 0;
  for (const line of lines) width = Math.max(width, ctx.measureText(line).width);
  const height = lines.length ? (lines.length - 1) * lineHeightPx + lineHeightPx : 0;
  return { width, height };
}

function drawMultilineText(ctx, lines, x, y, lineHeightPx, drawLine) {
  if (!lines.length) return;
  const startY = y - ((lines.length - 1) * lineHeightPx) / 2;
  lines.forEach((line, i) => drawLine(line, x, startY + i * lineHeightPx));
}

function drawCleanFullscreenWatermark(ctx, w, h, settings) {
  const lines = getLines(settings.darkText || "");
  if (!lines.length) return;

  const style = settings.darkStyle;
  const opacity = settings.darkOpacity;
  const size = settings.darkSize;
  const step = settings.darkDensity;
  const lineHeightPx = size * (settings.darkLineHeight || 1.35);
  const offsetX = settings.darkOffsetX || 0;
  const offsetY = settings.darkOffsetY || 0;

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-32 * Math.PI / 180);
  ctx.translate(-w / 2 + offsetX, -h / 2 + offsetY);

  ctx.font = `700 ${size}px "Microsoft YaHei", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // 阵列位置只由密度和偏移决定，不随文字大小改变而跑位。
  const stepX = step;
  const stepY = Math.max(step * 0.55, 70);

  const startX = -w - stepX * 2;
  const endX = w * 2 + stepX * 2;
  const startY = -h - stepY * 2;
  const endY = h * 2 + stepY * 2;

  for (let y = startY; y <= endY; y += stepY) {
    for (let x = startX; x <= endX; x += stepX) {
      if (style === "soft") drawMultilineSoftText(ctx, lines, x, y, lineHeightPx, size, opacity, "255,255,255");
      else if (style === "dark") drawMultilineSoftText(ctx, lines, x, y, lineHeightPx, size, opacity, "0,0,0");
      else drawMultilineMixedText(ctx, lines, x, y, lineHeightPx, size, opacity);
    }
  }
  ctx.restore();
}

function drawMultilineSoftText(ctx, lines, x, y, lineHeightPx, size, opacity, rgb) {
  ctx.save();
  ctx.lineWidth = Math.max(1, size / 18);
  ctx.strokeStyle = `rgba(0,0,0,${opacity * 0.18})`;
  ctx.fillStyle = `rgba(${rgb},${opacity})`;
  drawMultilineText(ctx, lines, x, y, lineHeightPx, (line, tx, ty) => {
    ctx.strokeText(line, tx, ty);
    ctx.fillText(line, tx, ty);
  });
  ctx.restore();
}

function drawMultilineMixedText(ctx, lines, x, y, lineHeightPx, size, opacity) {
  ctx.save();
  ctx.lineWidth = Math.max(1, size / 20);
  ctx.strokeStyle = `rgba(255,255,255,${opacity * 0.68})`;
  ctx.fillStyle = `rgba(0,0,0,${opacity * 0.72})`;
  drawMultilineText(ctx, lines, x, y, lineHeightPx, (line, tx, ty) => {
    ctx.strokeText(line, tx, ty);
    ctx.fillText(line, tx, ty);
  });
  ctx.restore();
}

function drawMainWatermark(ctx, w, h, settings, pos) {
  const lines = getLines(settings.mainText || "");
  if (!lines.length) return;

  const size = settings.mainSize;
  const opacity = settings.mainOpacity;
  const style = settings.mainStyle;
  const lineHeightPx = size * (settings.mainLineHeight || 1.2);
  const x = (pos.xRatio ?? 0.5) * w;
  const y = (pos.yRatio ?? 0.56) * h;

  ctx.save();
  ctx.font = `900 ${size}px Arial, "Microsoft YaHei", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const stroke = Math.max(2, Math.round(size / 20));

  if (style === "white") {
    ctx.shadowColor = `rgba(0,0,0,${0.45 * opacity})`;
    ctx.shadowBlur = Math.max(2, size / 16);
    ctx.shadowOffsetX = Math.max(1, size / 22);
    ctx.shadowOffsetY = Math.max(1, size / 22);
    ctx.lineWidth = stroke;
    ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
    ctx.fillStyle = `rgba(255,255,255,${opacity})`;
    drawMultilineText(ctx, lines, x, y, lineHeightPx, (line, tx, ty) => {
      ctx.strokeText(line, tx, ty);
      ctx.fillText(line, tx, ty);
    });
  }

  if (style === "dark") {
    ctx.shadowColor = `rgba(255,255,255,${0.18 * opacity})`;
    ctx.shadowBlur = Math.max(2, size / 24);
    drawMultilineText(ctx, lines, x, y, lineHeightPx, (line, tx, ty) => {
      ctx.fillStyle = `rgba(0,0,0,${0.58 * opacity})`;
      ctx.fillText(line, tx + 2, ty + 2);
      ctx.fillStyle = `rgba(255,255,255,${0.78 * opacity})`;
      ctx.fillText(line, tx, ty);
    });
  }

  if (style === "yellow") {
    ctx.shadowColor = `rgba(0,0,0,${0.35 * opacity})`;
    ctx.shadowBlur = Math.max(2, size / 18);
    ctx.lineWidth = stroke;
    ctx.strokeStyle = `rgba(75,45,0,${0.55 * opacity})`;
    ctx.fillStyle = `rgba(255,205,70,${opacity})`;
    drawMultilineText(ctx, lines, x, y, lineHeightPx, (line, tx, ty) => {
      ctx.strokeText(line, tx, ty);
      ctx.fillText(line, tx, ty);
    });
  }

  ctx.restore();
}

async function createWatermarkedFile(item, kind) {
  const maxWidth = kind === "cover" ? 900 : 1600;
  const quality = kind === "cover" ? 0.78 : 0.82;
  const canvas = document.createElement("canvas");
  drawImageWithWatermarks(canvas, item.img, { preview: false, maxWidth, mainPos: item.mainPos });

  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", quality));
  if (!blob) throw new Error("水印图片生成失败");
  const newName = safeFilename(item.file.name) + ".webp";
  return new File([blob], newName, { type: "image/webp", lastModified: Date.now() });
}

function setupCanvasDrag(canvas, item, renderFn) {
  canvas.addEventListener("pointerdown", e => {
    activeDragItem = item;
    updatePendingMainPos(e, canvas, item);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", e => {
    if (activeDragItem !== item) return;
    updatePendingMainPos(e, canvas, item);
  });
  canvas.addEventListener("pointerup", () => {
    activeDragItem = null;
    renderFn();
  });
  canvas.addEventListener("pointerleave", () => {
    activeDragItem = null;
  });
}

function updatePendingMainPos(e, canvas, item) {
  const rect = canvas.getBoundingClientRect();
  item.mainPos.xRatio = Math.max(0.02, Math.min(0.98, (e.clientX - rect.left) / rect.width));
  item.mainPos.yRatio = Math.max(0.02, Math.min(0.98, (e.clientY - rect.top) / rect.height));
  drawImageWithWatermarks(canvas, item.img, { preview: true, maxWidth: 520, mainPos: item.mainPos });
}

async function prepareCover(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const img = await loadImageFromFile(file);
    pendingCover = { file, img, mainPos: { xRatio: 0.5, yRatio: 0.56 } };
    document.querySelector("#pendingCoverWrap").classList.remove("hidden");
    renderPendingCover();
    toast("封面已生成水印预览，拖动主水印后点击确认上传");
  } catch (err) {
    logDebug("封面读取失败：\n" + err.message);
    toast("封面读取失败：" + err.message);
  } finally {
    e.target.value = "";
  }
}

function renderPendingCover() {
  if (!pendingCover) return;
  const canvas = document.querySelector("#pendingCoverCanvas");
  drawImageWithWatermarks(canvas, pendingCover.img, { preview: true, maxWidth: 520, mainPos: pendingCover.mainPos });
  if (!canvas.dataset.dragReady) {
    setupCanvasDrag(canvas, pendingCover, renderPendingCover);
    canvas.dataset.dragReady = "1";
  }
}

function clearPendingCover(showToast = true) {
  pendingCover = null;
  const wrap = document.querySelector("#pendingCoverWrap");
  if (wrap) wrap.classList.add("hidden");
  const canvas = document.querySelector("#pendingCoverCanvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  if (showToast) toast("已取消封面待上传");
}

async function uploadPreparedFile(file, originalFile, kind, index = 1) {
  const g = galleries[currentIndex];
  touchGalleryCreatedAt(g);
  g.date = formatRelativeDate(g);

  const form = new FormData();
  form.append("file", file);
  form.append("galleryId", g.id);
  form.append("kind", kind);
  form.append("index", String(index));
  form.append("password", adminPassword);

  const res = await fetch("./api/upload", { method: "POST", body: form });
  const text = await res.text();

  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!res.ok) {
    logDebug({ uploadFailed: true, status: res.status, response: data });
    throw new Error(data.error || data.message || text || `HTTP ${res.status}`);
  }

  const savedBytes = originalFile.size - file.size;
  logDebug({
    uploadSuccess: true,
    kind,
    watermarkApplied: true,
    originalFile: { name: originalFile.name, size: originalFile.size, readableSize: formatBytes(originalFile.size), type: originalFile.type },
    uploadedFile: { name: file.name, size: file.size, readableSize: formatBytes(file.size), type: file.type },
    savedBytes,
    savedReadableSize: formatBytes(savedBytes),
    result: data
  });

  return data;
}

async function uploadPendingCover() {
  if (!pendingCover) return toast("请先选择封面图");
  try {
    toast("正在给封面加水印并上传...");
    const uploadFile = await createWatermarkedFile(pendingCover, "cover");
    const result = await uploadPreparedFile(uploadFile, pendingCover.file, "cover", 1);
    const g = galleries[currentIndex];
    g.cover = result.url;
    g.date = formatRelativeDate(g);
    document.querySelector("#galleryDate").value = g.date;
    document.querySelector("#coverPreview").src = result.url;
    clearPendingCover(false);
    renderList();
    await saveGalleries();
    toast("封面已加水印、上传并保存");
  } catch (err) {
    logDebug("封面上传失败：\n" + err.message);
    toast("封面上传失败：" + err.message);
  }
}

async function prepareDetails(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  try {
    toast(`正在生成 ${files.length} 张水印预览...`);
    pendingDetails = [];
    for (const file of files) {
      const img = await loadImageFromFile(file);
      pendingDetails.push({ file, img, mainPos: { xRatio: 0.5, yRatio: 0.56 } });
    }
    renderPendingDetails();
    toast("详情图已生成水印预览，可逐张拖动主水印位置");
  } catch (err) {
    logDebug("详情图读取失败：\n" + err.message);
    toast("详情图读取失败：" + err.message);
  } finally {
    e.target.value = "";
  }
}

function renderPendingDetails() {
  const tools = document.querySelector("#pendingDetailTools");
  const wrap = document.querySelector("#pendingDetailPreview");
  if (!wrap) return;

  if (!pendingDetails.length) {
    wrap.innerHTML = "";
    tools && tools.classList.add("hidden");
    return;
  }

  tools && tools.classList.remove("hidden");
  wrap.innerHTML = pendingDetails.map((item, i) => `
    <div class="pending-card">
      <div class="pending-title">${i + 1}. ${item.file.name}</div>
      <canvas data-pending-index="${i}"></canvas>
      <p class="hint">拖动主水印位置；暗水印会统一套用。</p>
    </div>
  `).join("");

  wrap.querySelectorAll("canvas[data-pending-index]").forEach(canvas => {
    const index = Number(canvas.dataset.pendingIndex);
    const item = pendingDetails[index];
    drawImageWithWatermarks(canvas, item.img, { preview: true, maxWidth: 420, mainPos: item.mainPos });
    setupCanvasDrag(canvas, item, () => renderSinglePendingCanvas(canvas, item));
  });
}

function renderSinglePendingCanvas(canvas, item) {
  drawImageWithWatermarks(canvas, item.img, { preview: true, maxWidth: 420, mainPos: item.mainPos });
}

function rerenderPendingPreviews() {
  if (pendingCover) renderPendingCover();
  if (pendingDetails.length) {
    const wrap = document.querySelector("#pendingDetailPreview");
    if (wrap) {
      wrap.querySelectorAll("canvas[data-pending-index]").forEach(canvas => {
        const index = Number(canvas.dataset.pendingIndex);
        const item = pendingDetails[index];
        if (item) renderSinglePendingCanvas(canvas, item);
      });
    }
  }
}

function clearPendingDetails(showToast = true) {
  pendingDetails = [];
  const wrap = document.querySelector("#pendingDetailPreview");
  if (wrap) wrap.innerHTML = "";
  const tools = document.querySelector("#pendingDetailTools");
  if (tools) tools.classList.add("hidden");
  if (showToast) toast("已清空待上传详情图");
}

async function uploadPendingDetails() {
  if (!pendingDetails.length) return toast("请先选择详情图片");

  try {
    toast(`正在给 ${pendingDetails.length} 张图片加水印并上传...`);
    const g = galleries[currentIndex];
    if (!Array.isArray(g.images)) g.images = [];

    for (let i = 0; i < pendingDetails.length; i++) {
      const item = pendingDetails[i];
      logDebug(`开始处理详情图 ${i + 1}/${pendingDetails.length}：${item.file.name}\n原始大小：${formatBytes(item.file.size)}\n类型：${item.file.type}`);
      const uploadFile = await createWatermarkedFile(item, "detail");
      const result = await uploadPreparedFile(uploadFile, item.file, "detail", g.images.length + 1);
      g.images.push(result.url);
      g.date = formatRelativeDate(g);
      document.querySelector("#galleryDate").value = g.date;
    }

    clearPendingDetails(false);
    renderImages();
    renderList();
    await saveGalleries();
    toast("详情图已逐张加水印、上传并保存");
  } catch (err) {
    logDebug("详情图上传失败：\n" + err.message);
    toast("上传失败：" + err.message);
  }
}

async function runDebug() {
  try {
    setDebug("dbgPassword", "检查中...", "debug-warn");
    setDebug("dbgImages", "检查中...", "debug-warn");
    setDebug("dbgBaseUrl", "检查中...", "debug-warn");

    const data = await apiJson("./api/debug");

    setDebug("dbgPassword", data.adminPasswordConfigured ? "已设置" : "未设置", data.adminPasswordConfigured ? "debug-ok" : "debug-bad");
    setDebug("dbgImages", data.imagesBinding ? "已绑定" : "未绑定", data.imagesBinding ? "debug-ok" : "debug-bad");
    setDebug("dbgBaseUrl", data.imageBaseUrl || "未设置", data.imageBaseUrl ? "debug-ok" : "debug-bad");
    setDebug("dbgWrite", "未测试", "debug-warn");
    logDebug(data);
  } catch (err) {
    logDebug("检查配置失败：\n" + err.message);
    toast("检查配置失败：" + err.message);
  }
}

async function testR2Write() {
  try {
    setDebug("dbgWrite", "测试中...", "debug-warn");

    const data = await apiJson("./api/debug", {
      method: "POST",
      body: JSON.stringify({ test: true })
    });

    setDebug("dbgWrite", data.writeOk ? "成功" : "失败", data.writeOk ? "debug-ok" : "debug-bad");
    logDebug(data);
    toast(data.writeOk ? "R2 写入测试成功" : "R2 写入测试失败");
  } catch (err) {
    setDebug("dbgWrite", "失败", "debug-bad");
    logDebug("R2 写入测试失败：\n" + err.message);
    toast("R2 写入测试失败：" + err.message);
  }
}

document.querySelector("#loginBtn").addEventListener("click", login);
document.querySelector("#saveSiteBtn").addEventListener("click", saveSite);
document.querySelector("#saveGalleryBtn").addEventListener("click", saveGalleries);
document.querySelector("#addGalleryBtn").addEventListener("click", () => addGallery(true));
document.querySelector("#deleteGalleryBtn").addEventListener("click", deleteGallery);
document.querySelector("#coverFile").addEventListener("change", prepareCover);
document.querySelector("#detailFiles").addEventListener("change", prepareDetails);
document.querySelector("#clearImagesBtn").addEventListener("click", clearImages);
document.querySelector("#moveImageBtn").addEventListener("click", moveImage);
document.querySelector("#runDebugBtn").addEventListener("click", runDebug);
document.querySelector("#testR2Btn").addEventListener("click", testR2Write);

document.querySelector("#uploadPendingCoverBtn")?.addEventListener("click", uploadPendingCover);
document.querySelector("#clearPendingCoverBtn")?.addEventListener("click", () => clearPendingCover(true));
document.querySelector("#uploadPendingDetailsBtn")?.addEventListener("click", uploadPendingDetails);
document.querySelector("#clearPendingDetailsBtn")?.addEventListener("click", () => clearPendingDetails(true));

["galleryTitle", "galleryCategory", "galleryTags", "galleryBuyUrl"].forEach(id => {
  const el = document.querySelector(`#${id}`);
  if (!el) return;
  el.addEventListener("input", syncForm);
  el.addEventListener("change", syncForm);
});

const saved = sessionStorage.getItem("ADMIN_PASSWORD");
if (saved) document.querySelector("#passwordInput").value = saved;
