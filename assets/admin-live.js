let adminPassword = "";
let galleries = [];
let site = {};
let currentIndex = 0;

function toast(msg) {
  const el = document.querySelector("#toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2400);
}

async function apiJson(url, options = {}) {
  const headers = options.headers || {};
  headers["x-admin-password"] = adminPassword;
  if (options.body && !(options.body instanceof FormData)) {
    headers["content-type"] = "application/json";
  }
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

async function login() {
  adminPassword = document.querySelector("#passwordInput").value.trim();
  if (!adminPassword) return toast("请输入管理员密码");
  sessionStorage.setItem("ADMIN_PASSWORD", adminPassword);
  await loadAll();
  document.querySelector("#loginCard").classList.add("hidden");
  document.querySelector("#adminApp").classList.remove("hidden");
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
  site = {
    siteName: document.querySelector("#siteName").value.trim(),
    title1: document.querySelector("#title1").value.trim(),
    title2: document.querySelector("#title2").value.trim(),
    description: document.querySelector("#description").value.trim()
  };
  await apiJson("./api/site", { method: "POST", body: JSON.stringify(site) });
  toast("网站设置已保存");
}

function renderList() {
  const list = document.querySelector("#galleryList");
  list.innerHTML = galleries.map((g, i) => `
    <div class="gallery-item ${i === currentIndex ? "active" : ""}" onclick="selectGallery(${i})">
      <div class="thumb"><img src="${g.cover || ""}"></div>
      <div class="gallery-info">
        <strong>${g.title || "未命名图集"}</strong>
        <span>${g.category || ""} · ${g.date || ""} · ${(g.images || []).length} 张</span>
      </div>
      <span class="badge">编辑</span>
    </div>
  `).join("");
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
  g.tags = document.querySelector("#galleryTags").value.split(",").map(x => x.trim()).filter(Boolean);
}

function renderImages() {
  const g = galleries[currentIndex];
  const wrap = document.querySelector("#detailPreview");
  wrap.innerHTML = (g.images || []).map((src, i) => `
    <div class="image-card">
      <img src="${src}">
      <button onclick="removeImage(${i})">×</button>
    </div>
  `).join("");
}

async function saveGalleries() {
  syncForm();
  await apiJson("./api/galleries", { method: "POST", body: JSON.stringify(galleries) });
  renderList();
  toast("图集已保存，网站会自动更新");
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
  galleries[currentIndex].images.splice(i, 1);
  renderImages();
  renderList();
}

function clearImages() {
  galleries[currentIndex].images = [];
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

async function uploadOne(file, kind, index = 1) {
  const g = galleries[currentIndex];
  const form = new FormData();
  form.append("file", file);
  form.append("galleryId", g.id);
  form.append("kind", kind);
  form.append("index", String(index));
  form.append("password", adminPassword);
  const res = await fetch("./api/upload", { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

async function uploadCover(e) {
  const file = e.target.files[0];
  if (!file) return;
  toast("封面上传中...");
  const result = await uploadOne(file, "cover", 1);
  galleries[currentIndex].cover = result.url;
  document.querySelector("#coverPreview").src = result.url;
  renderList();
  await saveGalleries();
  toast("封面已上传并保存");
}

async function uploadDetails(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  toast(`正在上传 ${files.length} 张图片...`);
  const g = galleries[currentIndex];
  if (!Array.isArray(g.images)) g.images = [];
  for (let i = 0; i < files.length; i++) {
    const result = await uploadOne(files[i], "detail", g.images.length + 1);
    g.images.push(result.url);
  }
  renderImages();
  renderList();
  await saveGalleries();
  toast("详情图已上传并保存");
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
["galleryTitle","galleryCategory","galleryDate","galleryTags"].forEach(id => {
  document.querySelector(`#${id}`).addEventListener("input", syncForm);
  document.querySelector(`#${id}`).addEventListener("change", syncForm);
});

const saved = sessionStorage.getItem("ADMIN_PASSWORD");
if (saved) {
  document.querySelector("#passwordInput").value = saved;
}
