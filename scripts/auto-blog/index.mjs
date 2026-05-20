// Orchestrator: pick category -> fetch questions -> write -> image -> render -> write files.
// Usage:
//   node index.mjs                       # normal run, writes into the repo
//   node index.mjs --category=seo        # force a category
//   node index.mjs --dry-run             # write to a temp dir, leave repo + ledger untouched
//   node index.mjs --out=/tmp/x          # custom output root (implies no ledger write to repo)
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CATEGORIES, QUESTIONS_PER_ARTICLE } from './config.mjs';
import { loadLedger, saveLedger, nextCategory, slugExists } from './ledger.mjs';
import { fetchQuestions } from './reddit.mjs';
import { writeArticle } from './writer.mjs';
import { generateHeroImage } from './image.mjs';
import { renderPost } from './render.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');

function parseArgs() {
  const args = { dryRun: false, category: null, out: null };
  for (const a of process.argv.slice(2)) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a.startsWith('--category=')) args.category = a.split('=')[1];
    else if (a.startsWith('--out=')) args.out = a.split('=')[1];
  }
  return args;
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Visible body word count (excludes FAQ, which only lives in JSON-LD).
function countWords(a) {
  const parts = [a.lead, a.closingParagraph, a.pullQuote];
  for (const s of a.sections || []) {
    parts.push(s.h2, ...(s.paragraphs || []), ...(s.list || []));
  }
  return parts.join(' ').split(/\s+/).filter(Boolean).length;
}

async function main() {
  const args = parseArgs();
  const outRoot = args.out || (args.dryRun ? path.join('/tmp', 'km-auto-blog-dryrun') : REPO_ROOT);
  const writeToRepo = !args.dryRun && !args.out;

  const ledger = await loadLedger();
  const categoryId = args.category && CATEGORIES[args.category] ? args.category : nextCategory(ledger);
  console.log(`[run] category: ${categoryId}  (dryRun=${args.dryRun})`);

  // 1) Source questions (Reddit, with curated fallback).
  let questions = await fetchQuestions(categoryId, ledger);
  console.log(`[reddit] ${questions.length} candidate question(s) found`);
  if (questions.length < QUESTIONS_PER_ARTICLE.min) {
    const fb = CATEGORIES[categoryId].fallbackQuestions;
    console.log(`[reddit] too few; using curated fallback questions`);
    questions = fb;
  }
  questions = questions.slice(0, QUESTIONS_PER_ARTICLE.max);
  console.log('[questions]\n' + questions.map((q, i) => `  ${i + 1}. ${q}`).join('\n'));

  // 2) Write the article. Retry if a draft comes in under the word floor
  //    (vague source questions sometimes yield thin drafts).
  const MIN_WORDS = 430;
  let article;
  let best = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const draft = await writeArticle(categoryId, questions, attempt > 1);
    const wc = countWords(draft);
    console.log(`[article] attempt ${attempt}: ${wc} words`);
    if (!best || wc > countWords(best)) best = draft;
    if (wc >= MIN_WORDS) {
      article = draft;
      break;
    }
  }
  article = article || best;

  // 3) Resolve a unique slug.
  let slug = slugify(article.slug || article.title);
  if (!slug) slug = `${categoryId}-${todayIso()}`;
  if (writeToRepo) {
    let n = 2;
    const base = slug;
    while (slugExists(ledger, slug) || existsSync(path.join(REPO_ROOT, 'blog', `${slug}.html`))) {
      slug = `${base}-${n++}`;
    }
  }
  const dateIso = todayIso();
  console.log(`[article] "${article.title}"  slug=${slug}`);

  // 4) Hero image.
  const { buffer: imgBuf, usedFallback } = await generateHeroImage({
    prompt: article.imagePrompt || `${CATEGORIES[categoryId].label} hero image`,
    title: article.title,
  });
  console.log(`[image] ${imgBuf.length} bytes${usedFallback ? ' (branded fallback)' : ' (Gemini)'}`);

  // 5) Render HTML.
  const html = renderPost({ article, slug, dateIso, categoryId });

  // 6) Write outputs.
  const htmlPath = path.join(outRoot, 'blog', `${slug}.html`);
  const imgPath = path.join(outRoot, 'assets', 'images', 'blog', `${slug}.jpg`);
  await mkdir(path.dirname(htmlPath), { recursive: true });
  await mkdir(path.dirname(imgPath), { recursive: true });
  await writeFile(htmlPath, html, 'utf8');
  await writeFile(imgPath, imgBuf);
  console.log(`[write] ${htmlPath}`);
  console.log(`[write] ${imgPath}`);

  // 7) Update ledger (only on a real repo run).
  if (writeToRepo) {
    ledger.posts.push({ slug, category: categoryId, questions, date: dateIso, fallbackImage: usedFallback });
    await saveLedger(ledger);
    console.log('[ledger] updated topics-done.json');
  } else {
    console.log('[ledger] skipped (dry-run / custom out)');
  }

  // Emit slug for the workflow (PR title, branch name).
  if (process.env.GITHUB_OUTPUT) {
    await writeFile(process.env.GITHUB_OUTPUT, `slug=${slug}\ntitle=${article.title}\ncategory=${categoryId}\n`, {
      flag: 'a',
    });
  }
  console.log('[done]');
}

main().catch((e) => {
  console.error('[fatal]', e.message);
  process.exit(1);
});
