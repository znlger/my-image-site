let posts = [];
let site = {};
let currentCategory = "全部";

async function safeJson(url, fallback) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch {
    return fallback;
  }
}

async function loadData() {
  site = await safeJson("./api/site", null);
  if (!site) site = await safeJson("./data/site.json", {});
  posts = await safeJson("./api/galleries", null);
  if (!posts) posts = await safeJson("./data/galleries.json", []);
}

function countImages(p) {
  return Array.isArray(p.images) ? p.images.length : 0;
}

function applySite() {
  const siteName = site.siteName || "女明星生图";
  const brandName = document.querySelector("#brandName");
  const footerName = document.querySelector("#footerName");
  const title1 = document.querySelector("#title1");
  const title2 = document.querySelector("#title2");
  const desc = document.querySelector("#siteDesc");

  if (brandName) brandName.textContent = siteName;
  if (footerName) footerName.textContent = siteName;
  if (title1) title1.textContent = site.title1 || "精选女明星生图";
  if (title2) title2.textContent = site.title2 || "高清原图预览";
  if (desc) desc.innerHTML = (site.description || "").replace(/\n/g, "<br>");
}

function renderStackIfExist() {
  const stack = document.querySelector("#coverStack");
  if (!stack) return;

  const topFive = posts.slice(0, 5);
  stack.innerHTML = topFive.map((p, index) => `
    <a class="stack-card c${index + 1}" href="./gallery.html?id=${encodeURIComponent(p.id)}">
      <img src="${p.cover}" alt="${p.title}">
    </a>
  `).join("") + `
    <div class="stack-caption">
      <div>
        <small>前五图集封面精选</small>
        <strong>从左到右，一张盖着一张</strong>
      </div>
      <span class="count">${topFive.length} 组精选</span>
    </div>
  `;
}

function renderFiltersIfExist() {
  const wrap = document.querySelector("#categories");
  if (!wrap) return;
  const categories = [...new Set(posts.map(p => p.category).filter(Boolean))];

  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.dataset.category = cat;
    btn.textContent = cat;
    wrap.appendChild(btn);
  });

  wrap.addEventListener("click", e => {
    if (!e.target.matches("button")) return;
    document.querySelectorAll("#categories button").forEach(b => b.classList.remove("active"));
    e.target.classList.add("active");
    currentCategory = e.target.dataset.category;
    renderPostsIfExist();
  });
}

function renderPostsIfExist() {
  const grid = document.querySelector("#postGrid");
  if (!grid) return;

  const searchEl = document.querySelector("#searchInput");
  const q = searchEl ? searchEl.value.trim().toLowerCase() : "";

  const filtered = posts.filter(p => {
    const matchCategory = currentCategory === "全部" || p.category === currentCategory;
    const text = [p.title, p.category, ...(p.tags || [])].join(" ").toLowerCase();
    const matchSearch = !q || text.includes(q);
    return matchCategory && matchSearch;
  });

  grid.innerHTML = filtered.map(p => `
    <a class="gallery-card" href="./gallery.html?id=${encodeURIComponent(p.id)}">
      <img src="${p.cover}" alt="${p.title}" loading="lazy">
      <div class="card-top">
        <span class="badge">${p.date || ""}</span>
        <span class="badge">◉ ${countImages(p)}</span>
      </div>
      <div class="card-content">
        <h2>${p.title}</h2>
        <div class="card-meta">
          <span>${p.category || ""}</span>
          <span>${countImages(p)} 张</span>
        </div>
      </div>
    </a>
  `).join("");

  if (!filtered.length) grid.innerHTML = "<p>没有找到相关图集。</p>";
}

function renderGalleryDetailIfExist() {
  const head = document.querySelector("#galleryHead");
  const imagesWrap = document.querySelector("#galleryImages");
  if (!head || !imagesWrap) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const gallery = posts.find(p => p.id === id) || posts[0];

  if (!gallery) {
    head.innerHTML = `<div class="error">没有找到这个图集。</div>`;
    return;
  }

  document.title = `${gallery.title} - ${site.siteName || "女明星生图"}`;
  head.innerHTML = `
    <h1>${gallery.title}</h1>
    <p>分类：${gallery.category || ""} · ${gallery.date || ""} · ${countImages(gallery)} 张</p>
  `;

  imagesWrap.innerHTML = (gallery.images || []).map(src => `
    <img src="${src}" alt="${gallery.title}" loading="lazy">
  `).join("");
}

function setupSearchIfExist() {
  const searchToggle = document.querySelector("#searchToggle");
  const searchPanel = document.querySelector("#searchPanel");
  const searchInput = document.querySelector("#searchInput");
  if (searchToggle && searchPanel && searchInput) {
    searchToggle.onclick = () => {
      searchPanel.classList.toggle("show");
      if (searchPanel.classList.contains("show")) searchInput.focus();
    };
    searchInput.addEventListener("input", renderPostsIfExist);
  }
}

async function init() {
  const year = document.querySelector("#year");
  if (year) year.textContent = new Date().getFullYear();
  await loadData();
  applySite();
  renderStackIfExist();
  renderFiltersIfExist();
  renderPostsIfExist();
  renderGalleryDetailIfExist();
  setupSearchIfExist();
}

init().catch(err => {
  document.body.insertAdjacentHTML("beforeend", `<main><div class="error">数据加载失败：${err.message}</div></main>`);
});
