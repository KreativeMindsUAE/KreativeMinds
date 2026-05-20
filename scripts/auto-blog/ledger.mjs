// topics-done.json read/write + de-duplication helpers.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { ROTATION } from './config.mjs';

const LEDGER_PATH = new URL('./topics-done.json', import.meta.url);

export async function loadLedger() {
  if (!existsSync(LEDGER_PATH)) return { posts: [] };
  try {
    const raw = await readFile(LEDGER_PATH, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.posts)) data.posts = [];
    return data;
  } catch {
    return { posts: [] };
  }
}

export async function saveLedger(ledger) {
  await writeFile(LEDGER_PATH, JSON.stringify(ledger, null, 2) + '\n', 'utf8');
}

// Next category = the one least-recently used in the rotation.
export function nextCategory(ledger) {
  const lastUsedAt = new Map();
  ledger.posts.forEach((p, i) => lastUsedAt.set(p.category, i));
  let best = ROTATION[0];
  let bestIdx = Infinity;
  for (const cat of ROTATION) {
    const idx = lastUsedAt.has(cat) ? lastUsedAt.get(cat) : -1;
    if (idx < bestIdx) {
      bestIdx = idx;
      best = cat;
    }
  }
  return best;
}

const norm = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// True if a question is too close to one we already covered.
export function isDuplicateQuestion(ledger, question) {
  const q = norm(question);
  if (!q) return true;
  const qWords = new Set(q.split(' ').filter((w) => w.length > 3));
  for (const post of ledger.posts) {
    for (const used of post.questions || []) {
      const u = norm(used);
      if (u === q) return true;
      const uWords = new Set(u.split(' ').filter((w) => w.length > 3));
      if (qWords.size && uWords.size) {
        let overlap = 0;
        for (const w of qWords) if (uWords.has(w)) overlap++;
        const ratio = overlap / Math.min(qWords.size, uWords.size);
        if (ratio >= 0.7) return true;
      }
    }
  }
  return false;
}

export function slugExists(ledger, slug) {
  return ledger.posts.some((p) => p.slug === slug);
}
