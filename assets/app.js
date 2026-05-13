const posts = [
  {
    title: "示例图集 01",
    category: "写真",
    date: "2026-05-13",
    cover: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=900&auto=format&fit=crop",
    url: "/posts/sample-01.html",
    tags: ["预览", "样例", "高清"]
  },
  {
    title: "示例图集 02",
    category: "活动",
    date: "2026-05-13",
    cover: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=900&auto=format&fit=crop",
    url: "/posts/sample-02.html",
    tags: ["现场", "活动"]
  },
  {
    title: "示例图集 03",
    category: "街拍",
    date: "2026-05-13",
    cover: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&auto=format&fit=crop",
    url: "/posts/sample-03.html",
    tags: ["街拍", "样例"]
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
    btn.className = "filter";
    btn.dataset.category = cat;
    btn.textContent = cat;
    wrap.appendChild(btn);
  });

  wrap.addEventListener("click", e => {
    if (!e.target.matches(".filter")) return;
    document.querySelectorAll(".filter").forEach(b => b.classList.remove("active"));
    e.target.classList.add("active");
    currentCategory = e.target.dataset.category;
    renderPosts();
  });
}

function renderPosts() {
  const q = document.querySelector("#searchInput").value.trim().toLowerCase();
  const grid = document.querySelector("#postGrid");

  const filtered = posts.filter(p => {
    const matchCategory = currentCategory === "全部" || p.category === currentCategory;
    const text = [p.title, p.category, ...p.tags].join(" ").toLowerCase();
    const matchSearch = !q || text.includes(q);
    return matchCategory && matchSearch;
  });

  grid.innerHTML = filtered.map(p => `
    <a class="card" href="${p.url}">
      <img class="cover" src="${p.cover}" alt="${p.title}" loading="lazy">
      <div class="card-body">
        <h2>${p.title}</h2>
        <div class="meta">${p.category} · ${p.date}</div>
        <div class="tags">${p.tags.map(t => `<span class="tag">#${t}</span>`).join("")}</div>
      </div>
    </a>
  `).join("");

  if (!filtered.length) {
    grid.innerHTML = "<p>没有找到相关图集。</p>";
  }
}

document.querySelector("#searchInput").addEventListener("input", renderPosts);
document.querySelector("#year").textContent = new Date().getFullYear();

const notice = document.querySelector("#notice");
const closeNotice = document.querySelector("#closeNotice");
if (!localStorage.getItem("noticeClosed")) {
  notice.style.display = "flex";
}
closeNotice.onclick = () => {
  notice.style.display = "none";
  localStorage.setItem("noticeClosed", "1");
};

renderStats();
renderFilters();
renderPosts();
