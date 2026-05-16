function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
function checkPassword(request, env) {
  const headerPassword = request.headers.get("x-admin-password") || "";
  return env.ADMIN_PASSWORD && headerPassword === env.ADMIN_PASSWORD;
}
export async function onRequestGet({ request, env }) {
  if (!checkPassword(request, env)) return json({ error: "Unauthorized. ADMIN_PASSWORD is missing or password is wrong." }, 401);
  const result = {
    ok: true,
    adminPasswordConfigured: Boolean(env.ADMIN_PASSWORD),
    imagesBinding: Boolean(env.IMAGES),
    imageBaseUrl: env.IMAGE_BASE_URL || "",
    imageBaseUrlLooksValid: Boolean(env.IMAGE_BASE_URL && env.IMAGE_BASE_URL.startsWith("https://")),
    hints: []
  };
  if (!result.imagesBinding) result.hints.push("R2 binding IMAGES is missing.");
  if (!result.imageBaseUrl) result.hints.push("IMAGE_BASE_URL is missing.");
  if (result.imageBaseUrl && !result.imageBaseUrl.startsWith("https://")) result.hints.push("IMAGE_BASE_URL should start with https://");
  return json(result);
}
export async function onRequestPost({ request, env }) {
  if (!checkPassword(request, env)) return json({ error: "Unauthorized. ADMIN_PASSWORD is missing or password is wrong." }, 401);
  const result = { ok:true, adminPasswordConfigured:Boolean(env.ADMIN_PASSWORD), imagesBinding:Boolean(env.IMAGES), imageBaseUrl:env.IMAGE_BASE_URL || "", writeOk:false, testKey:"debug/r2-write-test.txt", publicUrl:"" };
  if (!env.IMAGES) return json({ ...result, error:"R2 binding IMAGES is missing." }, 500);
  try {
    await env.IMAGES.put(result.testKey, "R2 write test " + new Date().toISOString(), { httpMetadata: { contentType: "text/plain; charset=utf-8" } });
    result.writeOk = true;
    if (env.IMAGE_BASE_URL) result.publicUrl = env.IMAGE_BASE_URL.replace(/\/$/, "") + "/" + result.testKey;
    return json(result);
  } catch (err) {
    return json({ ...result, error: err.message || String(err) }, 500);
  }
}