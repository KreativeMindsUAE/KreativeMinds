// Writes a scroll-stopping hook (for the card) + caption + hashtags via OpenRouter.
// Card hook is split into `setup` (cream) and `punch` (gold) for the brand layout.
import { DEFAULT_MODEL, FALLBACK_MODELS, SITE, HASHTAGS, BLOCKLIST } from './config.mjs';

const MODELS = [process.env.OPENROUTER_MODEL || DEFAULT_MODEL, ...FALLBACK_MODELS].filter(
  (m, i, a) => m && a.indexOf(m) === i
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SYSTEM = `You write short, scroll-stopping social posts for Kreative Minds, a Dubai digital agency.
Goal: make a busy person STOP scrolling. Be punchy, human, confident. Never robotic.
Rules:
- No em dashes or en dashes. Use commas, periods, hyphens.
- The card hook must be SHORT. "setup" = up to ~8 words, "punch" = up to ~5 words (the memorable payoff).
- Caption: 2 to 4 short lines, friendly and useful, no hashtags inside it. You may use at most one tasteful emoji.
- Stay strictly inside business, marketing, web, SEO, ecommerce, AI tools, or UAE business setup. Never politics, war, religion, or anything sensitive.
- Reply with ONLY valid JSON.`;

function buildPrompt(topic, format, sampleTags) {
  return `Topic: ${topic.theme} (label: ${topic.eyebrow})
Hook format to use: ${format}

Return JSON:
{
  "setup": "first part of the hook, plain (max ~8 words)",
  "punch": "the short memorable payoff shown in gold (max ~5 words)",
  "caption": "2 to 4 short lines that add value or curiosity. No hashtags here.",
  "hashtags": ["pick 5 to 8 relevant lowercase hashtags, blend niche + local; you may reuse from this pool or add better ones: ${sampleTags.join(' ')}"]
}`;
}

function sanitize(s) {
  return typeof s === 'string'
    ? s.replace(/\s*[‒-―—–]\s*/g, ', ').replace(/[‐‑]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim()
    : s;
}

function isBlocked(text) {
  const t = (text || '').toLowerCase();
  return BLOCKLIST.some((b) => t.includes(b));
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const s = body.indexOf('{');
  const e = body.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error('No JSON in response');
  return JSON.parse(body.slice(s, e + 1));
}

async function callModel(apiKey, model, prompt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': SITE.origin,
      'X-Title': 'Kreative Minds Social',
    },
    body: JSON.stringify({
      model,
      temperature: 0.85,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    const err = new Error(`OpenRouter ${res.status}: ${t.slice(0, 160)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response');
  return content;
}

export async function writePost(topic, format) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');
  const prompt = buildPrompt(topic, format, HASHTAGS[topic.id] || []);

  let lastErr;
  for (let pass = 0; pass < 2; pass++) {
    for (const model of MODELS) {
      try {
        const raw = extractJson(await callModel(apiKey, model, prompt));
        const post = {
          setup: sanitize(raw.setup),
          punch: sanitize(raw.punch),
          caption: sanitize(raw.caption),
          hashtags: (raw.hashtags || [])
            .map((h) => String(h).trim().replace(/^#?/, '#').toLowerCase())
            .filter((h) => h.length > 1)
            .slice(0, 8),
        };
        if (!post.setup || !post.punch || !post.caption) throw new Error('Missing fields');
        if (isBlocked(`${post.setup} ${post.punch} ${post.caption}`)) throw new Error('Blocked content');
        console.log(`[writer] model used: ${model}`);
        return post;
      } catch (e) {
        lastErr = e;
        const transient = e.status === 429 || (e.status >= 500 && e.status < 600);
        console.warn(`[writer] ${model} failed: ${e.message}`);
        if (e.status === 401 || e.status === 402 || e.status === 403) throw e;
        if (e.status === 429) await sleep(1500 * (pass + 1));
      }
    }
  }
  throw lastErr || new Error('All models failed');
}
