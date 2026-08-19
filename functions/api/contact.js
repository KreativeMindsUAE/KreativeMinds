// Per-IP rate-limit gate for the kreativeminds.ae contact form (Cloudflare Pages Function).
//
// The browser calls this BEFORE it submits the form to FormSubmit. If the client IP is
// within limits (max 2 per hour, 4 per 24h) we record the attempt and return {ok:true},
// and the browser then submits to FormSubmit as normal. If the IP is over a limit we
// return 429 and the browser shows a message instead of submitting. This function never
// sends email itself and makes no external request, so a genuine lead is never lost:
// any non-429 response (including an error) lets the browser deliver.

const HOUR = 3600;
const DAY = 86400;
const MAX_PER_HOUR = 2;
const MAX_PER_DAY = 4;
const LIMIT_MESSAGE =
  "You have reached the submission limit. Please email us directly at hi@kreativeminds.ae and we will get back to you.";

export async function onRequestPost({ request, env }) {
  const now = Math.floor(Date.now() / 1000);
  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const db = env.RL_DB;

  if (db) {
    try {
      await db.prepare("DELETE FROM submissions WHERE ts < ?").bind(now - DAY).run();
      const h = await db
        .prepare("SELECT COUNT(*) AS c FROM submissions WHERE ip = ? AND ts > ?")
        .bind(ip, now - HOUR)
        .first();
      const d = await db
        .prepare("SELECT COUNT(*) AS c FROM submissions WHERE ip = ? AND ts > ?")
        .bind(ip, now - DAY)
        .first();
      const perHour = (h && h.c) || 0;
      const perDay = (d && d.c) || 0;
      if (perHour >= MAX_PER_HOUR || perDay >= MAX_PER_DAY) {
        return json({ ok: false, limit: true, message: LIMIT_MESSAGE }, 429);
      }
      await db.prepare("INSERT INTO submissions (ip, ts) VALUES (?, ?)").bind(ip, now).run();
    } catch (e) {
      // On any DB error, allow the submission through (never block a genuine lead).
    }
  }

  return json({ ok: true }, 200);
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json" },
  });
}
