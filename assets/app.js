let posts = [];
let site = {};
let currentCategory = "全部";

const DEFAULT_ABOUT_TEXT = "本站用于女明星生图、活动图、红毯图、写真图集预览。请确保上传图片拥有版权或授权。";

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

function applySavedTheme() {
  const saved = localStorage.getItem("SITE_THEME") || "light";
  document.body.classList.toggle("theme-dark", saved === "dark");
  updateThemeButton();
}

function updateThemeButton() {
  const btn = document.querySelector("#themeToggle");
  if (!btn) return;
  const isDark = document.body.classList.contains("theme-dark");
  btn.textContent = isDark ? "亮色" : "暗色";
  btn.setAttribute("aria-label", isDark ? "切换到亮色主题" : "切换到暗色主题");
}

function setupThemeToggle() {
  const btn = document.querySelector("#themeToggle");
  if (!btn) return;
  btn.onclick = () => {
    const nextDark = !document.body.classList.contains("theme-dark");
    document.body.classList.toggle("theme-dark", nextDark);
    localStorage.setItem("SITE_THEME", nextDark ? "dark" : "light");
    updateThemeButton();
  };
  updateThemeButton();
}

function isValidUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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

function formatRelativeDate(post) {
  const raw = post && (post.createdAt || post.uploadedAt);
  if (!raw) return (post && post.date) || "今天";

  const created = new Date(raw);
  if (Number.isNaN(created.getTime())) return (post && post.date) || "今天";

  const today = beijingDayNumber(new Date());
  const then = beijingDayNumber(created);
  const diff = Math.max(0, today - then);

  if (diff === 0) return "今天";
  if (diff === 1) return "昨天";
  if (diff < 7) return `${chineseNumber(diff)}天前`;
  if (diff < 30) return `${chineseNumber(Math.floor(diff / 7))}周前`;
  if (diff < 365) return `${chineseNumber(Math.floor(diff / 30))}个月前`;
  return `${chineseNumber(Math.floor(diff / 365))}年前`;
}

function applySite() {
  const siteName = site.siteName || "女明星生图";
  const brandName = document.querySelector("#brandName");
  const footerName = document.querySelector("#footerName");
  const title1 = document.querySelector("#title1");
  const title2 = document.querySelector("#title2");
  const desc = document.querySelector("#siteDesc");
  const aboutText = document.querySelector("#aboutText");

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
    const hasBuyUrl = isValidUrl(p.buyUrl);

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
          <span class="badge">${safeText(formatRelativeDate(p))}</span>
          <span class="badge">${hasBuyUrl ? "可购买 · " : ""}◉ ${countImages(p)}</span>
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

  const hasBuyUrl = isValidUrl(gallery.buyUrl);

  document.title = `${gallery.title} - ${site.siteName || "女明星生图"}`;

  head.innerHTML = `
    <h1>${safeText(gallery.title)}</h1>
    <p>分类：${safeText(gallery.category || "")} · ${safeText(formatRelativeDate(gallery))} · ${images.length} 张</p>
    ${hasBuyUrl ? `<div class="post-actions"><a class="buy-button" href="${safeText(gallery.buyUrl)}" target="_blank" rel="noopener noreferrer">购买同款 / 查看链接</a></div>` : ""}
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
  applySavedTheme();
  const year = document.querySelector("#year");
  if (year) year.textContent = new Date().getFullYear();

  await loadData();

  applySite();
  renderStackIfExist();
  renderFiltersIfExist();
  renderPostsIfExist();
  renderGalleryDetailIfExist();
  setupSearchIfExist();
  setupThemeToggle();
}

init().catch(err => {
  document.body.insertAdjacentHTML(
    "beforeend",
    `<main><div class="error">数据加载失败：${safeText(err.message)}</div></main>`
  );
});
