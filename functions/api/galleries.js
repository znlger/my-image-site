const DEFAULT_SITE = {
  siteName: "女明星生图",
  title1: "精选女明星生图",
  title2: "高清原图预览",
  description: "每日精选更新，覆盖活动现场、红毯、路透、写真等热门图集。\n先看预览再选择，高清细节清楚，适合收藏、参考与素材整理。"
};

const DEFAULT_GALLERIES = [
  {
    id: "gallery-001",
    title: "红毯活动生图预览",
    category: "活动",
    date: "今天",
    cover: "https://pub-028955ec84bf459da0de8cda01630dea.r2.dev/691d8e835b3a1.jpeg",
    tags: ["红毯", "活动", "生图"],
    images: [
      "https://pub-028955ec84bf459da0de8cda01630dea.r2.dev/691d8e835b3a1.jpeg",
      "https://pub-028955ec84bf459da0de8cda01630dea.r2.dev/2021-07-13%20023939.jpg"
    ]
  }
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

async function readJson(env, key, fallback) {
  const obj = await env.IMAGES.get(key);
  if (!obj) return fallback;
  return await obj.json();
}

async function writeJson(env, key, data) {
  await env.IMAGES.put(key, JSON.stringify(data, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" }
  });
}

function checkPassword(request, env, formData = null) {
  const headerPassword = request.headers.get("x-admin-password") || "";
  const formPassword = formData ? (formData.get("password") || "") : "";
  const input = headerPassword || formPassword;
  return env.ADMIN_PASSWORD && input === env.ADMIN_PASSWORD;
}

export async function onRequestGet({ env }) {
  const data = await readJson(env, "data/galleries.json", DEFAULT_GALLERIES);
  return json(data);
}

export async function onRequestPost({ request, env }) {
  if (!checkPassword(request, env)) return json({ error: "Unauthorized" }, 401);
  const data = await request.json();
  if (!Array.isArray(data)) return json({ error: "Invalid galleries data" }, 400);
  await writeJson(env, "data/galleries.json", data);
  return json({ ok: true });
}
