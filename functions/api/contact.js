// Rate-limited contact-form proxy for kreativeminds.ae (Cloudflare Pages Function).
// Caps per client IP: max 2 submissions / hour, max 4 / 24h.
// Within limits it forwards to FormSubmit (info@kmmpr.com) so email delivery is unchanged.
// On any server/forward failure it returns 502 so the browser can fall back to a direct
// FormSubmit post (never lose a lead). Blocked requests return 429.

const HOUR = 3600;
const DAY = 86400;
const MAX_PER_HOUR = 2;
const MAX_PER_DAY = 4;
const FORWARD_URL = "https://formsubmit.co/ajax/info@kmmpr.com";
const LIMIT_MESSAGE =
  "You have reached the submission limit. Please email us directly at hi@kreativeminds.ae and we will get back to you.";

export async function onRequestPost({ request, env }) {
  const now = Math.floor(Date.now() / 1000);
  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";

  let form;
  try {
    form = await request.formData();
  } catch (e) {
    return json({ ok: false, message: "Invalid submission." }, 400);
  }

  // Honeypot: silently accept, never forward or count.
  if (String(form.get("_honey") || "").trim() !== "") {
    return json({ ok: true });
  }

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
    } catch (e) {
      // If the rate-limit check fails, fall through and still deliver the message.
    }
  }

  const payload = {
    name: String(form.get("name") || ""),
    email: String(form.get("email") || ""),
    company: String(form.get("company") || ""),
    topic: String(form.get("topic") || ""),
    message: String(form.get("message") || ""),
    _subject: String(form.get("_subject") || "New enquiry via kreativeminds.ae"),
    _template: "table",
  };

  let forwarded = false;
  try {
    const r = await fetch(FORWARD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    forwarded = r.ok;
  } catch (e) {
    forwarded = false;
  }

  if (!forwarded) {
    // Let the browser fall back to a direct FormSubmit post so the lead is not lost.
    return json({ ok: false, forwardFailed: true }, 502);
  }

  // Only count messages that were within limits AND actually delivered.
  if (db) {
    try {
      await db.prepare("INSERT INTO submissions (ip, ts) VALUES (?, ?)").bind(ip, now).run();
    } catch (e) {}
  }

  return json({ ok: true });
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json" },
  });
}
