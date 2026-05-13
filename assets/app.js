const posts = [
  {
    title: "红毯活动生图预览",
    category: "活动",
    date: "5天前",
    count: 6,
    cover: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=900&auto=format&fit=crop",
    url: "/posts/sample-01.html",
    tags: ["活动", "生图", "高清"]
  },
  {
    title: "白裙现场图集",
    category: "写真",
    date: "5天前",
    count: 4,
    cover: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&auto=format&fit=crop",
    url: "/posts/sample-02.html",
    tags: ["写真", "预览"]
  },
  {
    title: "近景高清图",
    category: "街拍",
    date: "5天前",
    count: 5,
    cover: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=900&auto=format&fit=crop",
    url: "/posts/sample-03.html",
    tags: ["街拍", "高清"]
  },
  {
    title: "舞台造型图",
    category: "活动",
    date: "6天前",
    count: 8,
    cover: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=900&auto=format&fit=crop",
    url: "/posts/sample-04.html",
    tags: ["舞台", "现场"]
  },
  {
    title: "暖色调写真预览",
    category: "写真",
    date: "7天前",
    count: 9,
    cover: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900&auto=format&fit=crop",
    url: "/posts/sample-05.html",
    tags: ["写真", "暖色"]
  },
  {
    title: "城市街拍合集",
    category: "街拍",
    date: "8天前",
    count: 7,
    cover: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&auto=format&fit=crop",
    url: "/posts/sample-06.html",
    tags: ["街拍", "城市"]
  }
];

let currentCategory = "全部";

function renderStats() {
  const categories = [...new Set(posts.map(p => p.category))];
  const tags = [...new Set(posts.flatMap(p => p.tags))];
  document.querySelector("#postCount").textContent = posts.length;
  document.querySelector("#categoryCount").textContent = categories.length;
  document.querySelector("#tagCount").textContent = tags.length;
}

function renderFilters() {
  const wrap = document.querySelector("#categories");
  const categories = [...new Set(posts.map(p => p.category))];

  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "category-pill";
    btn.dataset.category = cat;
    btn.textContent = cat;
    wrap.appendChild(btn);
  });

  wrap.addEventListener("click", e => {
    if (!e.target.matches(".category-pill")) return;
    document.querySelectorAll(".category-pill").forEach(b => b.classList.remove("active"));
    e.target.classList.add("active");
    currentCategory = e.target.dataset.category;
    renderPosts();
  });
}

function renderPosts() {
  const searchEl = document.querySelector("#searchInput");
  const q = searchEl ? searchEl.value.trim().toLowerCase() : "";
  const grid = document.querySelector("#postGrid");

  const filtered = posts.filter(p => {
    const matchCategory = currentCategory === "全部" || p.category === currentCategory;
    const text = [p.title, p.category, ...p.tags].join(" ").toLowerCase();
    const matchSearch = !q || text.includes(q);
    return matchCategory && matchSearch;
  });

  grid.innerHTML = filtered.map(p => `
    <a class="gallery-card" href="${p.url}">
      <img src="${p.cover}" alt="${p.title}" loading="lazy">
      <div class="card-top">
        <span class="badge">${p.date}</span>
        <span class="badge">◉ ${p.count}</span>
      </div>
      <div class="card-content">
        <h2>${p.title}</h2>
        <div class="card-meta">
          <span>${p.category}</span>
          <span>${p.count} 张</span>
        </div>
        <div class="tags">${p.tags.map(t => `<span class="tag">#${t}</span>`).join("")}</div>
      </div>
    </a>
  `).join("");

  if (!filtered.length) {
    grid.innerHTML = "<p>没有找到相关图集。</p>";
  }
}

document.querySelector("#year").textContent = new Date().getFullYear();

const searchToggle = document.querySelector("#searchToggle");
const searchPanel = document.querySelector("#searchPanel");
const searchInput = document.querySelector("#searchInput");

searchToggle.onclick = () => {
  searchPanel.classList.toggle("show");
  if (searchPanel.classList.contains("show")) searchInput.focus();
};

searchInput.addEventListener("input", renderPosts);

renderStats();
renderFilters();
renderPosts();
