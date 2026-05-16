const DEFAULT_SITE = {
  siteName: "女明星生图",
  title1: "精选女明星生图",
  title2: "高清原图预览",
  description: "每日精选更新，覆盖活动现场、红毯、路透、写真等热门图集。\n先看预览再选择，高清细节清楚，适合收藏、参考与素材整理。",
  aboutText: "「如妖如魔」工作室 · 介绍\n\n大家好，我是如妖如魔，和我的小伙伴们一起，始终奔走在摄影拍图的第一线。"
};

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
  const data = await readJson(env, "data/site.json", DEFAULT_SITE);
  return json({ ...DEFAULT_SITE, ...data });
}
export async function onRequestPost({ request, env }) {
  if (!checkPassword(request, env)) return json({ error: "Unauthorized" }, 401);
  const data = await request.json();
  await writeJson(env, "data/site.json", data);
  return json({ ok: true });
}