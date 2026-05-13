let adminPassword = "";
let galleries = [];
let site = {};
let currentIndex = 0;

let draggedGalleryIndex = null;
let draggedImageIndex = null;

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

  fillSite();
  selectGallery(0);
}

function fillSite() {
  document.querySelector("#siteName").value = site.siteName || "女明星生图";
  document.querySelector("#title1").value = site.title1 || "精选女明星生图";
  document.querySelector("#title2").value = site.title2 || "高清原图预览";
  document.querySelector("#description").value = site.description || "";
}

async function saveSite() {
  try {
    site = {
      siteName: document.querySelector("#siteName").value.trim(),
      title1: document.querySelector("#title1").value.trim(),
      title2: document.querySelector("#title2").value.trim(),
      description: document.querySelector("#description").value.trim()
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
        <span>${g.category || ""} · ${g.date || ""} · ${(g.images || []).length} 张</span>
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
  document.querySelector("#galleryDate").value = g.date || "今天";
  document.querySelector("#galleryTags").value = (g.tags || []).join(", ");
  document.querySelector("#coverPreview").src = g.cover || "";

  renderImages();
  renderList();
}

function syncForm() {
  const g = galleries[currentIndex];
  if (!g) return;

  g.title = document.querySelector("#galleryTitle").value.trim();
  g.category = document.querySelector("#galleryCategory").value;
  g.date = document.querySelector("#galleryDate").value.trim();
  g.tags = document.querySelector("#galleryTags").value
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
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
    date: "今天",
    cover: "",
    tags: ["生图"],
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

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "未知";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * 上传前自动压缩图片
 * 封面：最大宽度 900px
 * 详情图：最大宽度 1600px
 * 输出格式：WebP
 */
async function compressImage(file, kind) {
  if (!file.type || !file.type.startsWith("image/")) return file;

  const maxWidth = kind === "cover" ? 900 : 1600;
  const quality = kind === "cover" ? 0.78 : 0.82;

  const img = new Image();
  const objectUrl = URL.createObjectURL(file);

  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("图片读取失败，可能是格式不支持或文件损坏"));
      img.src = objectUrl;
    });

    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;

    if (!width || !height) return file;

    if (width > maxWidth) {
      height = Math.round(height * maxWidth / width);
      width = maxWidth;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, "image/webp", quality);
    });

    if (!blob) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".webp";

    return new File([blob], newName, {
      type: "image/webp",
      lastModified: Date.now()
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function uploadOne(file, kind, index = 1) {
  const g = galleries[currentIndex];

  const uploadFile = await compressImage(file, kind);

  const form = new FormData();
  form.append("file", uploadFile);
  form.append("galleryId", g.id);
  form.append("kind", kind);
  form.append("index", String(index));
  form.append("password", adminPassword);

  const res = await fetch("./api/upload", {
    method: "POST",
    body: form
  });

  const text = await res.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    logDebug({
      uploadFailed: true,
      status: res.status,
      response: data
    });

    throw new Error(data.error || data.message || text || `HTTP ${res.status}`);
  }

  const savedBytes = file.size - uploadFile.size;
  const savedPercent = file.size > 0
    ? Math.round((savedBytes / file.size) * 100)
    : 0;

  logDebug({
    uploadSuccess: true,
    kind,
    originalFile: {
      name: file.name,
      size: file.size,
      readableSize: formatBytes(file.size),
      type: file.type
    },
    uploadedFile: {
      name: uploadFile.name,
      size: uploadFile.size,
      readableSize: formatBytes(uploadFile.size),
      type: uploadFile.type
    },
    savedBytes,
    savedReadableSize: formatBytes(savedBytes),
    savedPercent: `${savedPercent}%`,
    result: data
  });

  return data;
}

async function uploadCover(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    toast("封面压缩并上传中...");

    logDebug(`开始处理封面：${file.name}
原始大小：${formatBytes(file.size)}
类型：${file.type}`);

    const result = await uploadOne(file, "cover", 1);

    galleries[currentIndex].cover = result.url;
    document.querySelector("#coverPreview").src = result.url;

    renderList();
    await saveGalleries();

    toast("封面已压缩、上传并保存");
  } catch (err) {
    logDebug("封面上传失败：\n" + err.message);
    toast("封面上传失败：" + err.message);
  } finally {
    e.target.value = "";
  }
}

async function uploadDetails(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  try {
    toast(`正在压缩并上传 ${files.length} 张图片...`);

    const g = galleries[currentIndex];

    if (!Array.isArray(g.images)) g.images = [];

    for (let i = 0; i < files.length; i++) {
      logDebug(`开始处理详情图 ${i + 1}/${files.length}：${files[i].name}
原始大小：${formatBytes(files[i].size)}
类型：${files[i].type}`);

      const result = await uploadOne(files[i], "detail", g.images.length + 1);
      g.images.push(result.url);
    }

    renderImages();
    renderList();
    await saveGalleries();

    toast("详情图已压缩、上传并保存");
  } catch (err) {
    logDebug("详情图上传失败：\n" + err.message);
    toast("上传失败：" + err.message);
  } finally {
    e.target.value = "";
  }
}

async function runDebug() {
  try {
    setDebug("dbgPassword", "检查中...", "debug-warn");
    setDebug("dbgImages", "检查中...", "debug-warn");
    setDebug("dbgBaseUrl", "检查中...", "debug-warn");

    const data = await apiJson("./api/debug");

    setDebug(
      "dbgPassword",
      data.adminPasswordConfigured ? "已设置" : "未设置",
      data.adminPasswordConfigured ? "debug-ok" : "debug-bad"
    );

    setDebug(
      "dbgImages",
      data.imagesBinding ? "已绑定" : "未绑定",
      data.imagesBinding ? "debug-ok" : "debug-bad"
    );

    setDebug(
      "dbgBaseUrl",
      data.imageBaseUrl || "未设置",
      data.imageBaseUrl ? "debug-ok" : "debug-bad"
    );

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

    setDebug(
      "dbgWrite",
      data.writeOk ? "成功" : "失败",
      data.writeOk ? "debug-ok" : "debug-bad"
    );

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
document.querySelector("#coverFile").addEventListener("change", uploadCover);
document.querySelector("#detailFiles").addEventListener("change", uploadDetails);
document.querySelector("#clearImagesBtn").addEventListener("click", clearImages);
document.querySelector("#moveImageBtn").addEventListener("click", moveImage);
document.querySelector("#runDebugBtn").addEventListener("click", runDebug);
document.querySelector("#testR2Btn").addEventListener("click", testR2Write);

["galleryTitle", "galleryCategory", "galleryDate", "galleryTags"].forEach(id => {
  document.querySelector(`#${id}`).addEventListener("input", syncForm);
  document.querySelector(`#${id}`).addEventListener("change", syncForm);
});

const saved = sessionStorage.getItem("ADMIN_PASSWORD");
if (saved) document.querySelector("#passwordInput").value = saved;
