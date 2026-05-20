// Pull real visitor-style questions from public Reddit JSON (no API key).
// Public endpoints can rate-limit datacenter IPs, so we use a descriptive
// User-Agent, retry with backoff, and fall back to curated questions upstream.
import { CATEGORIES, SEARCH, BLOCKLIST } from './config.mjs';
import { isDuplicateQuestion } from './ledger.mjs';

const UA = 'web:kreativeminds-auto-blog:v1.0 (by /u/khalidgraphy; contact hi@kreativeminds.ae)';

const QUESTION_STARTERS = /^(how|what|why|when|where|should|can|is|are|do|does|which|would|will|whats|whens)\b/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    if (attempt >= 3) return null;
    await sleep(800 * attempt);
    return fetchJson(url, attempt + 1);
  }
}

function looksLikeQuestion(title) {
  if (!title) return false;
  const t = title.trim();
  if (t.length < 18 || t.length > 140) return false;
  return t.endsWith('?') || QUESTION_STARTERS.test(t);
}

function isRelevant(title, keywords) {
  const t = title.toLowerCase();
  return keywords.some((k) => t.includes(k));
}

function isBlocked(title) {
  const t = title.toLowerCase();
  return BLOCKLIST.some((b) => t.includes(b));
}

// Returns an array of candidate question strings for a category, best first.
// Strategy: search each subreddit for the category's queries, keep only
// question-form titles that also contain a relevant keyword.
export async function fetchQuestions(categoryId, ledger) {
  const cat = CATEGORIES[categoryId];
  const search = SEARCH[categoryId] || { queries: [], keywords: [] };
  const candidates = [];
  const seen = new Set();

  for (const sub of cat.subreddits) {
    for (const q of search.queries) {
      const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(
        q
      )}&restrict_sr=on&sort=top&t=year&limit=25`;
      const data = await fetchJson(url);
      const children = data?.data?.children || [];
      for (const c of children) {
        const d = c.data || {};
        const title = (d.title || '').replace(/\s+/g, ' ').trim();
        if (!looksLikeQuestion(title)) continue;
        if (d.over_18) continue;
        if (isBlocked(title)) continue;
        if (!isRelevant(title, search.keywords)) continue;
        const key = title.toLowerCase();
        if (seen.has(key)) continue;
        if (isDuplicateQuestion(ledger, title)) continue;
        seen.add(key);
        candidates.push({ title, score: d.score || 0, sub });
      }
      await sleep(300); // be polite between requests
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.map((c) => c.title);
}
