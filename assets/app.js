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

  if (!Array.isArray(posts)) posts = [];
}

function countImages(p) {
  return Array.isArray(p.images) ? p.images.filter(Boolean).length : 0;
}

function safeText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  if (desc) desc.innerHTML = safeText(site.description || "").replace(/\n/g, "<br>");
}

function renderStackIfExist() {
  const stack = document.querySelector("#coverStack");
  if (!stack) return;

  const topFive = posts
    .filter(p => p && p.cover)
    .slice(0, 5);

  if (!topFive.length) {
    stack.innerHTML = "";
    return;
  }

  stack.innerHTML = topFive.map((p, index) => {
    const isMain = index === 2 || (topFive.length < 3 && index === 0);

    return `
      <a class="stack-card c${index + 1}" href="./gallery.html?id=${encodeURIComponent(p.id)}">
        <img
          src="${safeText(p.cover)}"
          alt="${safeText(p.title)}"
          loading="${isMain ? "eager" : "lazy"}"
          decoding="async"
          fetchpriority="${isMain ? "high" : "low"}"
        >
      </a>
    `;
  }).join("") + `
    <div class="stack-caption">
      <div>
        <small>精选女明星生图</small>
        <strong>原图高清无水印，放大可见毛孔</strong>
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

    document.querySelectorAll("#categories button").forEach(b => {
      b.classList.remove("active");
    });

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

  const visiblePosts = filtered.filter(p => p && p.cover);

  grid.innerHTML = visiblePosts.map((p, index) => {
    const isEarly = index < 4;

    return `
      <a class="gallery-card" href="./gallery.html?id=${encodeURIComponent(p.id)}">
        <img
          src="${safeText(p.cover)}"
          alt="${safeText(p.title)}"
          loading="${isEarly ? "eager" : "lazy"}"
          decoding="async"
          fetchpriority="${isEarly ? "auto" : "low"}"
        >
        <div class="card-top">
          <span class="badge">${safeText(p.date || "")}</span>
          <span class="badge">◉ ${countImages(p)}</span>
        </div>
        <div class="card-content">
          <h2>${safeText(p.title)}</h2>
          <div class="card-meta">
            <span>${safeText(p.category || "")}</span>
            <span>${countImages(p)} 张</span>
          </div>
        </div>
      </a>
    `;
  }).join("");

  if (!visiblePosts.length) grid.innerHTML = "<p>没有找到相关图集。</p>";
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

  const images = Array.isArray(gallery.images)
    ? gallery.images.filter(Boolean)
    : [];

  document.title = `${gallery.title} - ${site.siteName || "女明星生图"}`;

  head.innerHTML = `
    <h1>${safeText(gallery.title)}</h1>
    <p>分类：${safeText(gallery.category || "")} · ${safeText(gallery.date || "")} · ${images.length} 张</p>
  `;

  imagesWrap.innerHTML = images.map((src, index) => {
    const isFirst = index === 0;

    return `
      <img
        src="${safeText(src)}"
        alt="${safeText(gallery.title)}"
        loading="${isFirst ? "eager" : "lazy"}"
        decoding="async"
        fetchpriority="${isFirst ? "high" : "low"}"
      >
    `;
  }).join("");
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
  document.body.insertAdjacentHTML(
    "beforeend",
    `<main><div class="error">数据加载失败：${safeText(err.message)}</div></main>`
  );
});
