let adminPassword = "";
let galleries = [];
let site = {};
let currentIndex = 0;
let pendingWatermarkItems = [];
let watermarkDragIndex = null;

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
  if (options.body && !(options.body instanceof FormData)) headers["content-type"] = "application/json";
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data.error || data.message || text || `HTTP ${res.status}`);
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
  document.querySelector("#aboutText").value = site.aboutText || "";
}
async function saveSite() {
  try {
    site = {
      siteName: document.querySelector("#siteName").value.trim(),
      title1: document.querySelector("#title1").value.trim(),
      title2: document.querySelector("#title2").value.trim(),
      description: document.querySelector("#description").value.trim(),
      aboutText: document.querySelector("#aboutText").value.trim()
    };
    const result = await apiJson("./api/site", { method: "POST", body: JSON.stringify(site) });
    logDebug({ action: "saveSite", result });
    toast("网站设置已保存");
  } catch (err) { logDebug("保存网站设置失败：\n" + err.message); toast("保存失败：" + err.message); }
}
function renderList() {
  const list = document.querySelector("#galleryList");
  list.innerHTML = galleries.map((g, i) => `
    <div class="gallery-item ${i === currentIndex ? "active" : ""}" onclick="selectGallery(${i})">
      <div class="thumb"><img src="${g.cover || ""}"></div>
      <div class="gallery-info"><strong>${g.title || "未命名图集"}</strong><span>${g.category || ""} · ${g.date || ""} · ${(g.images || []).length} 张</span></div>
      <span class="badge">编辑</span>
    </div>`).join("");
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
  document.querySelector("#buyUrl").value = g.buyUrl || "";
  document.querySelector("#coverPreview").src = g.cover || "";
  renderImages(); renderList();
}
function syncForm() {
  const g = galleries[currentIndex];
  if (!g) return;
  g.title = document.querySelector("#galleryTitle").value.trim();
  g.category = document.querySelector("#galleryCategory").value;
  g.date = document.querySelector("#galleryDate").value.trim();
  g.tags = document.querySelector("#galleryTags").value.split(",").map(x => x.trim()).filter(Boolean);
  g.buyUrl = document.querySelector("#buyUrl").value.trim();
}
function renderImages() {
  const g = galleries[currentIndex];
  document.querySelector("#detailPreview").innerHTML = (g.images || []).map((src, i) => `
    <div class="image-card">
      <img src="${src}">
      <button onclick="removeImage(${i})">×</button>
      <button onclick="setCoverFromImage(${i})" style="left:7px;right:auto;width:auto;padding:0 10px;border-radius:999px">封面</button>
    </div>`).join("");
}
function setCoverFromImage(i) {
  const g = galleries[currentIndex];
  if (!g || !g.images || !g.images[i]) return;
  g.cover = g.images[i];
  document.querySelector("#coverPreview").src = g.cover;
  renderImages();
  renderList();
  toast("已设为封面，记得保存图集");
}
async function saveGalleries() {
  try {
    syncForm();
    const result = await apiJson("./api/galleries", { method: "POST", body: JSON.stringify(galleries) });
    renderList(); logDebug({ action: "saveGalleries", result, currentGallery: galleries[currentIndex] });
    toast("图集已保存，网站会自动更新");
  } catch (err) { logDebug("保存图集失败：\n" + err.message); toast("保存失败：" + err.message); }
}
function addGallery(save = true) {
  const next = galleries.length + 1;
  galleries.push({ id:`gallery-${String(next).padStart(3,"0")}`, title:"新图集标题", category:"活动", date:"今天", cover:"", tags:["生图"], buyUrl:"", images:[] });
  selectGallery(galleries.length - 1);
  if (save) toast("已新增图集，请上传图片并保存");
}
async function deleteGallery() {
  if (!confirm("确定删除这个图集吗？")) return;
  galleries.splice(currentIndex, 1);
  if (!galleries.length) addGallery(false);
  currentIndex = 0; selectGallery(0); await saveGalleries();
}
function removeImage(i) { galleries[currentIndex].images.splice(i,1); renderImages(); renderList(); }
function clearImages() { galleries[currentIndex].images = []; renderImages(); renderList(); }
function moveImage() { const arr = galleries[currentIndex].images || []; if (arr.length > 1) { arr.unshift(arr.pop()); renderImages(); toast("已调整顺序，记得保存"); } }
async function uploadOne(file, kind, index = 1) {
  const g = galleries[currentIndex];
  const form = new FormData();
  form.append("file", file); form.append("galleryId", g.id); form.append("kind", kind); form.append("index", String(index)); form.append("password", adminPassword);
  const res = await fetch("./api/upload", { method: "POST", body: form });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) { logDebug({ uploadFailed:true, status:res.status, response:data }); throw new Error(data.error || data.message || text || `HTTP ${res.status}`); }
  logDebug({ uploadSuccess:true, result:data });
  return data;
}
async function uploadDetails(e) {
  const files = Array.from(e.target.files); if (!files.length) return;
  try {
    toast(`正在上传 ${files.length} 张图片...`);
    const g = galleries[currentIndex]; if (!Array.isArray(g.images)) g.images = [];
    for (let i=0;i<files.length;i++) {
      const result = await uploadOne(files[i], "detail", g.images.length + 1);
      g.images.push(result.url);
      if (!g.cover) g.cover = result.url;
    }
    renderImages(); renderList(); await saveGalleries(); toast("详情图已上传并保存");
  } catch (err) { logDebug("详情图上传失败：\n" + err.message); toast("上传失败：" + err.message); }
  finally { e.target.value = ""; }
}
async function runDebug() {
  try {
    setDebug("dbgPassword","检查中...","debug-warn"); setDebug("dbgImages","检查中...","debug-warn"); setDebug("dbgBaseUrl","检查中...","debug-warn");
    const data = await apiJson("./api/debug");
    setDebug("dbgPassword", data.adminPasswordConfigured ? "已设置" : "未设置", data.adminPasswordConfigured ? "debug-ok" : "debug-bad");
    setDebug("dbgImages", data.imagesBinding ? "已绑定" : "未绑定", data.imagesBinding ? "debug-ok" : "debug-bad");
    setDebug("dbgBaseUrl", data.imageBaseUrl || "未设置", data.imageBaseUrl ? "debug-ok" : "debug-bad");
    setDebug("dbgWrite","未测试","debug-warn"); logDebug(data);
  } catch (err) { logDebug("检查配置失败：\n" + err.message); toast("检查配置失败：" + err.message); }
}
async function testR2Write() {
  try {
    setDebug("dbgWrite","测试中...","debug-warn");
    const data = await apiJson("./api/debug", { method:"POST", body: JSON.stringify({test:true}) });
    setDebug("dbgWrite", data.writeOk ? "成功" : "失败", data.writeOk ? "debug-ok" : "debug-bad");
    logDebug(data); toast(data.writeOk ? "R2 写入测试成功" : "R2 写入测试失败");
  } catch (err) { setDebug("dbgWrite","失败","debug-bad"); logDebug("R2 写入测试失败：\n" + err.message); toast("R2 写入测试失败：" + err.message); }
}

/* Watermark */
function openWatermarkPage() {
  pendingWatermarkItems = [];
  document.querySelector("#watermarkPreviewGrid").innerHTML = "";
  document.querySelector("#watermarkPage").classList.remove("hidden");
  loadWatermarkSettings();
}
function closeWatermarkPage() { document.querySelector("#watermarkPage").classList.add("hidden"); }
function readImage(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = r.result; };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
async function addWatermarkFiles(e) {
  const files = Array.from(e.target.files || []);
  for (const file of files) {
    const img = await readImage(file);
    pendingWatermarkItems.push({ file, img, pos:{x:.5,y:.56}, canvas:null });
  }
  renderWatermarkCards();
  e.target.value = "";
}
function renderWatermarkCards() {
  const grid = document.querySelector("#watermarkPreviewGrid");
  if (!pendingWatermarkItems.length) { grid.innerHTML = "<p>请选择图片。</p>"; return; }
  grid.innerHTML = pendingWatermarkItems.map((item,i)=>`
    <div class="watermark-card">
      <div class="watermark-card-head"><strong>${item.file.name}</strong><span>可拖水印</span></div>
      <div class="watermark-stage"><canvas data-index="${i}"></canvas></div>
    </div>`).join("");
  document.querySelectorAll("#watermarkPreviewGrid canvas").forEach(c => {
    c.onpointerdown = e => { watermarkDragIndex = Number(c.dataset.index); updateMainPos(e); c.setPointerCapture(e.pointerId); };
    c.onpointermove = e => { if (watermarkDragIndex !== null) updateMainPos(e); };
    c.onpointerup = () => watermarkDragIndex = null;
    c.onpointerleave = () => watermarkDragIndex = null;
  });
  renderWatermarks();
}
function updateMainPos(e) {
  const canvas = e.currentTarget;
  const i = Number(canvas.dataset.index);
  const item = pendingWatermarkItems[i];
  const rect = canvas.getBoundingClientRect();
  item.pos.x = Math.max(.02, Math.min(.98, (e.clientX - rect.left) / rect.width));
  item.pos.y = Math.max(.02, Math.min(.98, (e.clientY - rect.top) / rect.height));
  renderWatermarkOne(i);
}
function getLines(text) { return String(text||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean); }
function renderWatermarks() { pendingWatermarkItems.forEach((_,i)=>renderWatermarkOne(i)); saveWatermarkSettingsIfNeeded(); }
function renderWatermarkOne(i) {
  const item = pendingWatermarkItems[i];
  const canvas = document.querySelector(`#watermarkPreviewGrid canvas[data-index="${i}"]`);
  if (!item || !canvas) return;
  item.canvas = canvas;
  const ctx = canvas.getContext("2d");
  const maxW = 1000, scale = Math.min(1, maxW / item.img.naturalWidth);
  const w = Math.round(item.img.naturalWidth * scale), h = Math.round(item.img.naturalHeight * scale);
  canvas.width = w; canvas.height = h;
  ctx.drawImage(item.img,0,0,w,h);
  if (document.querySelector("#darkEnabled").checked) drawDarkWatermark(ctx,w,h);
  if (document.querySelector("#mainEnabled").checked) drawMainWatermark(ctx,w,h,item.pos);
}
function drawMultiline(ctx, lines, x, y, lh, fn) {
  const start = y - ((lines.length - 1) * lh) / 2;
  lines.forEach((line,i)=>fn(line,x,start+i*lh));
}
function drawDarkWatermark(ctx,w,h) {
  const lines = getLines(document.querySelector("#darkText").value); if (!lines.length) return;
  const style = document.querySelector("#darkStyle").value;
  const opacity = Number(document.querySelector("#darkOpacity").value)/100;
  const size = Number(document.querySelector("#darkSize").value);
  const step = Number(document.querySelector("#darkDensity").value);
  const lh = size * Number(document.querySelector("#darkLineHeight").value);
  const ox = Number(document.querySelector("#darkOffsetX").value);
  const oy = Number(document.querySelector("#darkOffsetY").value);
  ctx.save();
  ctx.translate(w/2,h/2); ctx.rotate(-32*Math.PI/180); ctx.translate(-w/2+ox,-h/2+oy);
  ctx.font = `700 ${size}px "Microsoft YaHei", Arial, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const sx = step, sy = Math.max(step*.55,70);
  for (let y=-h-sy*2;y<=h*2+sy*2;y+=sy) for (let x=-w-sx*2;x<=w*2+sx*2;x+=sx) {
    if (style === "mixed") {
      ctx.lineWidth = Math.max(1,size/20);
      ctx.strokeStyle = `rgba(255,255,255,${opacity*.68})`;
      ctx.fillStyle = `rgba(0,0,0,${opacity*.72})`;
    } else {
      const rgb = style === "dark" ? "0,0,0" : "255,255,255";
      ctx.lineWidth = Math.max(1,size/18);
      ctx.strokeStyle = `rgba(0,0,0,${opacity*.18})`;
      ctx.fillStyle = `rgba(${rgb},${opacity})`;
    }
    drawMultiline(ctx, lines, x, y, lh, (line,tx,ty)=>{ ctx.strokeText(line,tx,ty); ctx.fillText(line,tx,ty); });
  }
  ctx.restore();
}
function drawMainWatermark(ctx,w,h,pos) {
  const lines = getLines(document.querySelector("#mainText").value); if (!lines.length) return;
  const size = Number(document.querySelector("#mainSize").value);
  const opacity = Number(document.querySelector("#mainOpacity").value)/100;
  const style = document.querySelector("#mainStyle").value;
  const lh = size * Number(document.querySelector("#mainLineHeight").value);
  const x = pos.x*w, y = pos.y*h;
  ctx.save();
  ctx.font = `900 ${size}px Arial, "Microsoft YaHei", sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const stroke = Math.max(2, Math.round(size/20));
  if (style === "dark") {
    drawMultiline(ctx, lines, x, y, lh, (line,tx,ty)=>{
      ctx.fillStyle = `rgba(0,0,0,${.58*opacity})`; ctx.fillText(line,tx+2,ty+2);
      ctx.fillStyle = `rgba(255,255,255,${.78*opacity})`; ctx.fillText(line,tx,ty);
    });
  } else if (style === "yellow") {
    ctx.shadowColor = `rgba(0,0,0,${.35*opacity})`; ctx.shadowBlur = Math.max(2,size/18);
    ctx.lineWidth = stroke; ctx.strokeStyle = `rgba(75,45,0,${.55*opacity})`; ctx.fillStyle = `rgba(255,205,70,${opacity})`;
    drawMultiline(ctx, lines, x, y, lh, (line,tx,ty)=>{ctx.strokeText(line,tx,ty);ctx.fillText(line,tx,ty);});
  } else {
    ctx.shadowColor = `rgba(0,0,0,${.45*opacity})`; ctx.shadowBlur = Math.max(2,size/16);
    ctx.lineWidth = stroke; ctx.strokeStyle = `rgba(255,255,255,${opacity})`; ctx.fillStyle = `rgba(255,255,255,${opacity})`;
    drawMultiline(ctx, lines, x, y, lh, (line,tx,ty)=>{ctx.strokeText(line,tx,ty);ctx.fillText(line,tx,ty);});
  }
  ctx.restore();
}
function dataUrlToFile(dataUrl, name) {
  return fetch(dataUrl).then(r=>r.blob()).then(blob=>new File([blob], name, {type:"image/jpeg"}));
}
async function confirmWatermarkUpload() {
  if (!pendingWatermarkItems.length) return toast("请先选择图片");
  const g = galleries[currentIndex]; if (!Array.isArray(g.images)) g.images = [];
  toast("正在上传加水印图片...");
  try {
    for (let i=0;i<pendingWatermarkItems.length;i++) {
      const item = pendingWatermarkItems[i];
      const file = await dataUrlToFile(item.canvas.toDataURL("image/jpeg", .92), item.file.name.replace(/\.[^.]+$/,"") + "-watermarked.jpg");
      const result = await uploadOne(file, "detail", g.images.length + 1);
      g.images.push(result.url);
      if (!g.cover) g.cover = result.url;
    }
    renderImages(); renderList(); await saveGalleries(); closeWatermarkPage(); toast("加水印图片已上传并保存");
  } catch (err) { logDebug("水印上传失败：\n" + err.message); toast("上传失败：" + err.message); }
}
const wmIds = ["darkEnabled","darkText","darkStyle","darkOpacity","darkSize","darkDensity","darkLineHeight","darkOffsetX","darkOffsetY","mainEnabled","mainText","mainStyle","mainSize","mainOpacity","mainLineHeight","saveWatermarkSettings"];
function loadWatermarkSettings() {
  try {
    const data = JSON.parse(localStorage.getItem("watermarkSettings") || "{}");
    wmIds.forEach(id => {
      const el = document.querySelector("#"+id); if (!el || data[id] === undefined) return;
      if (el.type === "checkbox") el.checked = data[id]; else el.value = data[id];
    });
  } catch {}
}
function saveWatermarkSettingsIfNeeded() {
  const save = document.querySelector("#saveWatermarkSettings");
  if (!save || !save.checked) return;
  const data = {};
  wmIds.forEach(id => {
    const el = document.querySelector("#"+id); if (!el) return;
    data[id] = el.type === "checkbox" ? el.checked : el.value;
  });
  localStorage.setItem("watermarkSettings", JSON.stringify(data));
}

document.querySelector("#loginBtn").addEventListener("click", login);
document.querySelector("#saveSiteBtn").addEventListener("click", saveSite);
document.querySelector("#saveGalleryBtn").addEventListener("click", saveGalleries);
document.querySelector("#addGalleryBtn").addEventListener("click", () => addGallery(true));
document.querySelector("#deleteGalleryBtn").addEventListener("click", deleteGallery);
document.querySelector("#detailFiles").addEventListener("change", uploadDetails);
document.querySelector("#clearImagesBtn").addEventListener("click", clearImages);
document.querySelector("#moveImageBtn").addEventListener("click", moveImage);
document.querySelector("#runDebugBtn").addEventListener("click", runDebug);
document.querySelector("#testR2Btn").addEventListener("click", testR2Write);
document.querySelector("#openWatermarkBtn").addEventListener("click", openWatermarkPage);
document.querySelector("#closeWatermarkBtn").addEventListener("click", closeWatermarkPage);
document.querySelector("#confirmWatermarkBtn").addEventListener("click", confirmWatermarkUpload);
document.querySelector("#watermarkFiles").addEventListener("change", addWatermarkFiles);
["galleryTitle","galleryCategory","galleryDate","galleryTags","buyUrl"].forEach(id => {
  document.querySelector(`#${id}`).addEventListener("input", syncForm);
  document.querySelector(`#${id}`).addEventListener("change", syncForm);
});
wmIds.forEach(id => {
  const el = document.querySelector("#"+id); if (!el) return;
  el.addEventListener("input", renderWatermarks);
  el.addEventListener("change", renderWatermarks);
});
const saved = sessionStorage.getItem("ADMIN_PASSWORD");
if (saved) document.querySelector("#passwordInput").value = saved;