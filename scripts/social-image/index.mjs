// Orchestrator for the social-image stream.
//   node index.mjs                 # generate, write into repo /social + feed
//   node index.mjs --topic=seo     # force a topic
//   node index.mjs --dry-run       # write to /tmp, leave repo + ledger untouched
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { TOPICS, FORMATS, SITE } from './config.mjs';
import { writePost } from './writer.mjs';
import { renderCard, linesFromHook } from './render-card.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');
const LEDGER = path.join(SCRIPT_DIR, 'social-done.json');

function parseArgs() {
  const a = { dryRun: false, topic: null };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') a.dryRun = true;
    else if (arg.startsWith('--topic=')) a.topic = arg.split('=')[1];
  }
  return a;
}

async function loadLedger() {
  if (!existsSync(LEDGER)) return { posts: [] };
  try {
    const d = JSON.parse(await readFile(LEDGER, 'utf8'));
    if (!Array.isArray(d.posts)) d.posts = [];
    return d;
  } catch {
    return { posts: [] };
  }
}

// Next topic + format least-recently used.
function nextTopic(ledger) {
  const last = new Map();
  ledger.posts.forEach((p, i) => last.set(p.topic, i));
  let best = TOPICS[0];
  let bestIdx = Infinity;
  for (const t of TOPICS) {
    const idx = last.has(t.id) ? last.get(t.id) : -1;
    if (idx < bestIdx) {
      bestIdx = idx;
      best = t;
    }
  }
  return best;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const xmlEsc = (s) =>
  String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// RSS where each item carries the caption (description) + image (enclosure).
function buildRss(feed) {
  const items = feed
    .map(
      (e) => `    <item>
      <title>${xmlEsc(e.topic)} post ${xmlEsc(e.date)}</title>
      <link>${xmlEsc(e.image)}</link>
      <guid isPermaLink="false">${xmlEsc(e.id)}</guid>
      <pubDate>${new Date(e.date + 'T07:00:00Z').toUTCString()}</pubDate>
      <description>${xmlEsc(e.caption)}</description>
      <enclosure url="${xmlEsc(e.image)}" type="image/jpeg" />
    </item>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Kreative Minds social posts</title>
  <link>${SITE.origin}/social/</link>
  <description>Auto-generated social image posts</description>
${items}
</channel></rss>
`;
}

async function main() {
  const args = parseArgs();
  const outRoot = args.dryRun ? '/tmp/km-social-dryrun' : REPO_ROOT;
  const ledger = await loadLedger();

  const topic = args.topic ? TOPICS.find((t) => t.id === args.topic) || nextTopic(ledger) : nextTopic(ledger);
  const format = FORMATS[ledger.posts.length % FORMATS.length];
  console.log(`[run] topic: ${topic.id}  format: "${format}"  (dryRun=${args.dryRun})`);

  const post = await writePost(topic, format);
  console.log(`[post] setup="${post.setup}" punch="${post.punch}"`);

  const id = `${topic.id}-${todayIso()}${args.dryRun ? '-dry' : ''}`;
  const imgRel = `social/${id}.jpg`;
  const imgPath = path.join(outRoot, imgRel);
  await mkdir(path.dirname(imgPath), { recursive: true });

  await renderCard(
    { eyebrow: topic.eyebrow, lines: linesFromHook(post.setup, post.punch), footerHandle: SITE.handle },
    imgPath
  );
  console.log(`[image] wrote ${imgPath}`);

  // Caption shown on socials = caption + blank line + hashtags.
  const caption = `${post.caption}\n\n${post.hashtags.join(' ')}`;
  const feedEntry = {
    id,
    topic: topic.id,
    image: `${SITE.origin}/${imgRel}`,
    imagePath: imgRel,
    caption,
    date: todayIso(),
  };

  if (!args.dryRun) {
    // Append to the feed Make.com watches.
    const feedPath = path.join(REPO_ROOT, 'social', 'social-posts.json');
    let feed = [];
    if (existsSync(feedPath)) {
      try {
        feed = JSON.parse(await readFile(feedPath, 'utf8'));
      } catch {
        feed = [];
      }
    }
    feed.unshift(feedEntry);
    feed = feed.slice(0, 50); // keep last 50
    await writeFile(feedPath, JSON.stringify(feed, null, 2) + '\n', 'utf8');

    // RSS feed for Make.com "Watch RSS feed items" (image in <enclosure>).
    await writeFile(path.join(REPO_ROOT, 'social', 'feed.xml'), buildRss(feed), 'utf8');

    ledger.posts.push({ id, topic: topic.id, date: todayIso() });
    await writeFile(LEDGER, JSON.stringify(ledger, null, 2) + '\n', 'utf8');
    console.log('[feed] appended social/social-posts.json + ledger');
  } else {
    await writeFile(path.join(outRoot, 'social', `${id}.json`), JSON.stringify(feedEntry, null, 2));
    console.log('[feed] dry-run, wrote sample json only');
  }

  if (process.env.GITHUB_OUTPUT) {
    await writeFile(process.env.GITHUB_OUTPUT, `id=${id}\ntopic=${topic.id}\n`, { flag: 'a' });
  }
  console.log('[done]\n--- caption preview ---\n' + caption);
}

main().catch((e) => {
  console.error('[fatal]', e.message);
  process.exit(1);
});
