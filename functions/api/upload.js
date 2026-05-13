function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function checkPassword(request, env, formData = null) {
  const headerPassword = request.headers.get("x-admin-password") || "";
  const formPassword = formData ? (formData.get("password") || "") : "";
  const input = headerPassword || formPassword;
  return env.ADMIN_PASSWORD && input === env.ADMIN_PASSWORD;
}

function extFromFile(file) {
  const name = file.name || "";
  const found = name.split(".").pop().toLowerCase();

  if (found && found.length <= 5 && found !== name) return found;

  const type = file.type || "";
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";

  return "jpg";
}

function cleanId(text) {
  return String(text || "gallery")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .slice(0, 80);
}

export async function onRequestPost({ request, env }) {
  let form;

  try {
    form = await request.formData();
  } catch (err) {
    return json({
      error: "Cannot read formData: " + (err.message || String(err))
    }, 400);
  }

  if (!env.ADMIN_PASSWORD) {
    return json({
      error: "ADMIN_PASSWORD is not configured in Cloudflare Pages variables."
    }, 500);
  }

  if (!checkPassword(request, env, form)) {
    return json({
      error: "Unauthorized. Password is wrong or ADMIN_PASSWORD does not match."
    }, 401);
  }

  if (!env.IMAGES) {
    return json({
      error: "R2 binding IMAGES is missing. Add binding: IMAGES → female-star-images, then redeploy."
    }, 500);
  }

  if (!env.IMAGE_BASE_URL) {
    return json({
      error: "IMAGE_BASE_URL is missing. Add it in Variables and Secrets, then redeploy."
    }, 500);
  }

  const file = form.get("file");
  const galleryId = cleanId(form.get("galleryId"));
  const kind = String(form.get("kind") || "detail");
  const index = String(form.get("index") || "1").padStart(3, "0");

  if (!file || typeof file.arrayBuffer !== "function") {
    return json({ error: "No file uploaded." }, 400);
  }

  const ext = extFromFile(file);

  const key = kind === "cover"
    ? `covers/${galleryId}-cover.${ext}`
    : `galleries/${galleryId}/${galleryId}-${index}.${ext}`;

  const contentType = file.type || "image/jpeg";
  const cacheControl = "public, max-age=31536000, immutable";

  try {
    await env.IMAGES.put(key, await file.arrayBuffer(), {
      httpMetadata: {
        contentType,
        cacheControl
      }
    });
  } catch (err) {
    return json({
      error: "R2 put failed: " + (err.message || String(err)),
      key,
      galleryId,
      kind
    }, 500);
  }

  const url = env.IMAGE_BASE_URL.replace(/\/$/, "") + "/" + key;

  return json({
    ok: true,
    key,
    url,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    imageBaseUrl: env.IMAGE_BASE_URL,
    cacheControl
  });
}
