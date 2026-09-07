const DATA_FILES = new Set([
  "items.json",
  "tags.json"
]);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-CMS-Secret, Authorization"
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders() }
      });
    }

    if (request.method === "GET" && url.pathname.startsWith("/data/")) {
      const filename = url.pathname.replace("/data/", "");
      if (!DATA_FILES.has(filename)) {
        return new Response("Not Found", { status: 404, headers: corsHeaders() });
      }

      const content = await env.CMS_KV.get(filename);
      if (content === null) {
        return new Response("Not Found in KV", { status: 404, headers: corsHeaders() });
      }

      return new Response(content, {
        headers: { "Content-Type": "application/json; charset=UTF-8", ...corsHeaders() }
      });
    }

    if (request.method === "POST" && url.pathname === "/import") {
      const authSecret = request.headers.get("X-CMS-Secret") ||
        (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");

      if (!env.CMS_IMPORT_SECRET || authSecret !== env.CMS_IMPORT_SECRET) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders() });
      }

      let payload;
      try {
        payload = await request.json();
      } catch {
        return new Response("Invalid JSON", { status: 400, headers: corsHeaders() });
      }

      if (!payload || typeof payload.files !== "object") {
        return new Response("Bad Request: missing files object", { status: 400, headers: corsHeaders() });
      }

      for (const key of Object.keys(payload.files)) {
        if (!DATA_FILES.has(key)) {
          return new Response(`Bad Request: Unknown file '${key}'`, { status: 400, headers: corsHeaders() });
        }
      }

      for (const [key, value] of Object.entries(payload.files)) {
        const text = typeof value === "string" ? value : JSON.stringify(value);
        await env.CMS_KV.put(key, text);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders() }
      });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders() });
  }
};
