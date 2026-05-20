// Generates a 1280x720 JPG hero image with Gemini, compresses via sharp.
// Falls back to an on-brand generated image so the pipeline never fails.
import sharp from 'sharp';
import { GEMINI_IMAGE_MODEL } from './config.mjs';

const WIDTH = 1280;
const HEIGHT = 720;
const QUALITY = 82;

async function generateWithGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${prompt}. Photorealistic, professional, no text, no watermark, 16:9.` }] }],
      generationConfig: { imageConfig: { aspectRatio: '16:9' } },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p) => p.inlineData?.data);
  if (!img) throw new Error('Gemini returned no image data');
  return Buffer.from(img.inlineData.data, 'base64');
}

// On-brand fallback: purple gradient with the KM mark, rendered to JPG.
async function brandedFallback(title) {
  const safe = (title || 'Kreative Minds').replace(/[<&>]/g, '').slice(0, 60);
  const svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2a1a5e"/><stop offset="100%" stop-color="#6d28d9"/>
    </linearGradient></defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g)"/>
    <text x="80" y="${HEIGHT - 120}" font-family="Outfit, Arial, sans-serif" font-size="46" font-weight="600" fill="#ffffff">${safe}</text>
    <text x="80" y="${HEIGHT - 60}" font-family="Arial, sans-serif" font-size="26" fill="#fbbf24">Kreative Minds</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: QUALITY }).toBuffer();
}

// Returns a JPG buffer ready to write. `usedFallback` flag in result.
export async function generateHeroImage({ prompt, title }) {
  let raw;
  let usedFallback = false;
  try {
    raw = await generateWithGemini(prompt);
  } catch (e) {
    console.warn(`[image] Gemini failed (${e.message}); using branded fallback.`);
    raw = await brandedFallback(title);
    usedFallback = true;
  }
  const jpg = await sharp(raw)
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toBuffer();
  return { buffer: jpg, usedFallback };
}
