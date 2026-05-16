const DEFAULT_GALLERIES = [
  {
    id: "gallery-001",
    title: "红毯活动生图预览",
    category: "活动",
    date: "今天",
    cover: "https://pub-028955ec84bf459da0de8cda01630dea.r2.dev/691d8e835b3a1.jpeg",
    tags: ["红毯", "活动", "生图"],
    buyUrl: "",
    images: [
      "https://pub-028955ec84bf459da0de8cda01630dea.r2.dev/691d8e835b3a1.jpeg",
      "https://pub-028955ec84bf459da0de8cda01630dea.r2.dev/2021-07-13%20023939.jpg"
    ]
  }
];
function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
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
function checkPassword(request, env) {
  const headerPassword = request.headers.get("x-admin-password") || "";
  return env.ADMIN_PASSWORD && headerPassword === env.ADMIN_PASSWORD;
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