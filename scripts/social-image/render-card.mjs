// Renders a scroll-stopping, on-brand square social card (1080x1080) for
// KreativeMinds standalone image posts. Brand: deep purple + gold (dark theme).
// Reusable by the social-image pipeline; run directly to produce a demo.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SIZE = 1080;
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Brand palette (from assets/css/site.css)
const C = {
  bg1: '#14102A',
  bg2: '#0B0816',
  gold: '#F4D34A',
  goldStrong: '#FFE066',
  cream: '#F5F2EA',
  creamSoft: '#D8D4C6',
  purpleLine: 'rgba(244,211,74,0.18)',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Word-wrap a string to <= maxChars per line.
function wrap(text, maxChars = 18) {
  const words = String(text).trim().split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur.trim());
  return lines;
}

// Build card lines from a cream `setup` and a gold `punch`.
export function linesFromHook(setup, punch) {
  let s = String(setup).trim();
  if (!/[.!?:,]$/.test(s)) s += '.'; // separate setup from punch
  const setupLines = wrap(s).map((t) => ({ t, hi: false }));
  const punchLines = wrap(punch).map((t) => ({ t, hi: true }));
  return [...setupLines, ...punchLines];
}

// card = { eyebrow, lines:[{t, hi?}], footerHandle }
export function buildSvg(card) {
  const lineH = 96;
  const n = card.lines.length;
  // Vertically center the headline block around the card middle.
  const startY = Math.max(330, Math.round(560 - (n * lineH) / 2));
  // Extra gap when switching from cream setup to gold punch.
  let gap = 0;
  const lines = card.lines
    .map((ln, i) => {
      if (i > 0 && ln.hi && !card.lines[i - 1].hi) gap += 28;
      const y = startY + i * lineH + gap;
      const fill = ln.hi ? C.gold : C.cream;
      return `<text x="96" y="${y}" font-family="Outfit, Montserrat, 'Arial Black', Arial, sans-serif" font-size="78" font-weight="700" fill="${fill}" letter-spacing="-1">${esc(ln.t)}</text>`;
    })
    .join('\n');

  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${C.bg1}"/>
      <stop offset="100%" stop-color="${C.bg2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="78%" cy="20%" r="60%">
      <stop offset="0%" stop-color="rgba(244,211,74,0.16)"/>
      <stop offset="100%" stop-color="rgba(244,211,74,0)"/>
    </radialGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#glow)"/>

  <!-- faint oversized KM monogram, decorative -->
  <text x="640" y="980" font-family="Outfit, 'Arial Black', sans-serif" font-size="900" font-weight="800" fill="rgba(244,211,74,0.05)">KM</text>

  <!-- eyebrow pill -->
  <rect x="96" y="150" width="${40 + card.eyebrow.length * 17}" height="52" rx="26" fill="rgba(244,211,74,0.12)" stroke="${C.gold}" stroke-width="1.5"/>
  <text x="120" y="184" font-family="'JetBrains Mono', monospace" font-size="24" font-weight="500" letter-spacing="3" fill="${C.gold}">${esc(card.eyebrow.toUpperCase())}</text>

  <!-- headline -->
  ${lines}

  <!-- gold rule -->
  <rect x="96" y="${startY + (n - 1) * lineH + 28 + 36}" width="120" height="6" rx="3" fill="${C.gold}"/>

  <!-- footer -->
  <text x="96" y="990" font-family="Outfit, Arial, sans-serif" font-size="34" font-weight="600" fill="${C.cream}">Kreative Minds</text>
  <text x="96" y="1030" font-family="'JetBrains Mono', monospace" font-size="24" fill="${C.creamSoft}">${esc(card.footerHandle || 'kreativeminds.ae')}</text>
</svg>`;
}

export async function renderCard(card, outPath) {
  const svg = buildSvg(card);
  const base = sharp(Buffer.from(svg));
  // composite the gold KM logo bottom-right
  const logo = await sharp(path.join(REPO_ROOT, 'logo-yellow.png'))
    .resize(190, 190, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const jpg = await base
    .composite([{ input: logo, top: SIZE - 250, left: SIZE - 250 }])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  await sharp(jpg).toFile(outPath);
  return outPath;
}

// Direct run = demo
if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = {
    eyebrow: 'Brand strategy',
    lines: [
      { t: 'People rarely buy' },
      { t: 'the best product.' },
      { t: 'They buy the one', hi: false },
      { t: 'they remember.', hi: true },
    ],
    footerHandle: 'kreativeminds.ae',
  };
  const out = process.argv[2] || '/tmp/km-social-demo.jpg';
  renderCard(demo, out).then((p) => console.log('wrote', p));
}
