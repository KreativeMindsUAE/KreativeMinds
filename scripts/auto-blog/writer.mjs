// Writes the article via OpenRouter, enforcing the KreativeBlog_Editor rulebook.
// Returns a structured object the renderer turns into HTML.
import { DEFAULT_MODEL, FALLBACK_MODELS, SITE, CATEGORIES } from './config.mjs';

// Ordered list of free models to try; rate-limited ones are skipped to the next.
const MODELS = [process.env.OPENROUTER_MODEL || DEFAULT_MODEL, ...FALLBACK_MODELS].filter(
  (m, i, a) => m && a.indexOf(m) === i
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The rulebook, encoded for the model. Mirrors memory: kreativeblog_editor.
const SYSTEM_PROMPT = `You are the in-house blog writer for Kreative Minds, a Dubai digital agency.
Write for a real visitor who typed a real question. Your job is to ANSWER it helpfully, not to sell.

VOICE
- User-friendly, as simple as possible, friendly and professional. Sound like a helpful human on the team.
- Short, clear sentences. Plain words.

BANNED LANGUAGE
- Do not use generic AI or robotic filler. Never use: delve, leverage, robust, seamless, unlock, elevate, embark, harness, realm, tapestry, testament, foster, furthermore, moreover, "in today's fast-paced world", "navigate the landscape", "game-changer", "when it comes to", "at the end of the day".
- NEVER use em dashes or en dashes. Use commas, periods, or simple hyphens only.

CAPITALIZATION
- Sentence case everywhere. Headings: capitalize only the FIRST word (plus proper nouns). No Title Case.
- Common words (is, or, if, that, this, like, and, the, a, of, to, in, for, with) are never capitalized unless they are the first word of a sentence or heading.
- Country names and country codes always start with a capital and stay in standard caps: UAE, UK, KSA, Pakistan, India, Saudi Arabia, Qatar, etc.

STRUCTURE
- 450 to 700 words total.
- One H2 per question. Answer each question directly and practically.
- Stay strictly inside the agency's scope. Never write about politics, war, religion, or anything outside business, marketing, web, ecommerce, AI tools, or UAE business setup.

BRAND MENTION (exact placement)
- In the MIDDLE of the closing paragraph (not its first or last sentence), mention Kreative Minds as one of the best solutions in the ${SITE.region}. Keep it natural and soft, woven into a sentence.

OUTPUT
- Reply with ONLY valid JSON, no markdown, matching the requested schema exactly.`;

function buildUserPrompt(categoryId, questions) {
  const cat = CATEGORIES[categoryId];
  return `Category: ${cat.label}
Real questions to answer in this single article (one H2 each):
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Return JSON with this exact shape:
{
  "title": "blog title, sentence case, includes the core topic, max ~70 chars",
  "slug": "url-slug-kebab-case-no-year-unless-relevant",
  "metaDescription": "140-160 char SEO description, plain and specific",
  "keywords": "6-10 comma separated search phrases",
  "ogTitle": "short share title",
  "ogDescription": "one sentence share description",
  "twitterTitle": "very short title",
  "twitterDescription": "one short sentence",
  "pageLead": "1-2 sentence intro shown under the H1, friendly",
  "heroAlt": "descriptive alt text for the hero image",
  "imagePrompt": "a vivid, concrete prompt for a photorealistic 16:9 hero image relevant to the topic, no text in image, professional, ${cat.label} theme, Gulf business context",
  "lead": "opening paragraph of the article body (the .lead), sets up the answer",
  "sections": [
    { "h2": "heading answering question 1", "paragraphs": ["...", "..."], "list": ["optional bullet", "optional bullet"] }
  ],
  "pullQuote": "one memorable sentence summarizing the takeaway",
  "ctaHeadline": "short CTA headline relevant to the topic",
  "ctaText": "1 sentence inviting the reader to reach out",
  "closingParagraph": "final paragraph; mention Kreative Minds as one of the best solutions in the ${SITE.region} in the MIDDLE sentence",
  "faq": [ { "q": "question text", "a": "concise answer" } ],
  "readMinutes": 5
}
Make "sections" have exactly one entry per question above, in order. Keep "list" optional (omit or empty array if not needed).`;
}

// Acronyms / codes that must stay in standard caps (rulebook). Kept to terms
// that are NOT common English words so we never miscapitalize prose.
const ACRONYMS = {
  seo: 'SEO', ai: 'AI', uae: 'UAE', uk: 'UK', ksa: 'KSA', vat: 'VAT', roi: 'ROI',
  ppc: 'PPC', sem: 'SEM', cms: 'CMS', faq: 'FAQ', b2b: 'B2B', b2c: 'B2C',
  saas: 'SaaS', api: 'API', crm: 'CRM', kpi: 'KPI', gcc: 'GCC', measa: 'MEASA',
  nfc: 'NFC', qr: 'QR', aed: 'AED', url: 'URL', sms: 'SMS', diy: 'DIY', llc: 'LLC',
  // Region proper nouns the model often lowercases.
  dubai: 'Dubai', sharjah: 'Sharjah', abu: 'Abu', dhabi: 'Dhabi', ajman: 'Ajman',
  qatar: 'Qatar', bahrain: 'Bahrain', oman: 'Oman', kuwait: 'Kuwait', riyadh: 'Riyadh',
  jeddah: 'Jeddah', doha: 'Doha', india: 'India', pakistan: 'Pakistan',
  google: 'Google', shopify: 'Shopify', wordpress: 'WordPress', chatgpt: 'ChatGPT',
};

function fixAcronyms(s) {
  return s.replace(/\b([A-Za-z][A-Za-z0-9]{1,14})\b/g, (m) => ACRONYMS[m.toLowerCase()] || m);
}

// Remove em/en/figure dashes and odd unicode hyphens; normalize.
function sanitizeText(s) {
  if (typeof s !== 'string') return s;
  return fixAcronyms(
    s
      .replace(/\s*[‒-―]\s*/g, ', ') // figure/en/em/horizontal bar -> comma
      .replace(/[‐‑]/g, '-') // hyphen / non-breaking hyphen -> ascii hyphen
      .replace(/[‘’]/g, "'") // smart single quotes
      .replace(/[“”]/g, '"') // smart double quotes
  ).trim();
}

// Headings + title: capitalize first letter only (proper nouns/acronyms already handled).
function capitalizeFirst(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function deepSanitize(obj) {
  if (typeof obj === 'string') return sanitizeText(obj);
  if (Array.isArray(obj)) return obj.map(deepSanitize);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = deepSanitize(v);
    return out;
  }
  return obj;
}

function extractJson(text) {
  // Model may wrap JSON in prose or code fences; grab the outermost object.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in model response');
  return JSON.parse(body.slice(start, end + 1));
}

async function callModel(apiKey, model, userPrompt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': SITE.origin,
      'X-Title': 'Kreative Minds Auto Blog',
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    const err = new Error(`OpenRouter ${res.status}: ${t.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty OpenRouter response');
  return content;
}

export async function writeArticle(categoryId, questions, expand = false) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');
  let userPrompt = buildUserPrompt(categoryId, questions);
  if (expand) {
    userPrompt +=
      '\n\nIMPORTANT: write a fuller article, 550 to 680 words total. Add concrete, practical detail and a short example under each heading. Do not pad with filler.';
  }

  let lastErr;
  // Two passes over the model list, with backoff, to ride out transient 429s.
  for (let pass = 0; pass < 2; pass++) {
    for (const model of MODELS) {
      try {
        const content = await callModel(apiKey, model, userPrompt);
        const article = deepSanitize(extractJson(content));
        if (!article.title || !Array.isArray(article.sections) || !article.sections.length) {
          throw new Error('Article JSON missing required fields');
        }
        // Headings + title: ensure leading capital (acronyms already fixed).
        article.title = capitalizeFirst(article.title);
        article.sections.forEach((s) => (s.h2 = capitalizeFirst(s.h2)));
        if (Array.isArray(article.faq)) article.faq.forEach((f) => (f.q = capitalizeFirst(f.q)));
        console.log(`[writer] model used: ${model}`);
        return article;
      } catch (e) {
        lastErr = e;
        const transient = e.status === 429 || (e.status >= 500 && e.status < 600);
        console.warn(`[writer] ${model} failed: ${e.message}${transient ? ' (will retry/rotate)' : ''}`);
        if (e.status === 429) await sleep(1500 * (pass + 1));
        if (!transient && !/JSON|required fields/.test(e.message)) {
          // Auth/quota style errors won't fix by rotating; bail fast.
          if (e.status === 401 || e.status === 402 || e.status === 403) throw e;
        }
      }
    }
  }
  throw lastErr || new Error('All models failed');
}
