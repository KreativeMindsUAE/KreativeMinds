// Config for the standalone social-image post stream (Mon/Wed/Sat).
// Scroll-stopping branded text cards within the agency's scope.

export const SITE = {
  origin: 'https://kreativeminds.ae',
  handle: 'kreativeminds.ae',
  region: 'Gulf and South Asia (MEASA)',
};

// Topic rotation (cycles via social-done.json). One angle per post.
export const TOPICS = [
  { id: 'brand', eyebrow: 'Brand strategy', theme: 'branding, positioning, being memorable' },
  { id: 'marketing', eyebrow: 'Digital marketing', theme: 'ads, content, getting customers, ROI' },
  { id: 'seo', eyebrow: 'SEO', theme: 'ranking on Google, organic traffic, content' },
  { id: 'web', eyebrow: 'Web development', theme: 'websites that convert, speed, design' },
  { id: 'ecommerce', eyebrow: 'eCommerce', theme: 'online stores, conversions, retention' },
  { id: 'ai', eyebrow: 'AI tools', theme: 'using AI to save time and work smarter' },
  { id: 'business', eyebrow: 'Business setup', theme: 'starting and running a business in the UAE' },
];

// Hook formats the writer rotates through for variety.
export const FORMATS = [
  'a bold, slightly contrarian truth',
  'a common myth, then the real truth',
  'a surprising stat or number framed simply',
  'a sharp question that makes the reader stop',
  'a short, practical tip stated as a strong opinion',
];

// Hashtag pool per topic (writer picks 5-8, blends niche + reach + local).
export const HASHTAGS = {
  brand: ['#branding', '#brandstrategy', '#smallbusiness', '#startup', '#dubaibusiness', '#marketingtips', '#entrepreneur'],
  marketing: ['#digitalmarketing', '#marketingtips', '#socialmediamarketing', '#contentmarketing', '#dubaimarketing', '#smallbusiness', '#growth'],
  seo: ['#seo', '#seotips', '#googleranking', '#contentmarketing', '#digitalmarketing', '#smallbusiness', '#dubaiseo'],
  web: ['#webdesign', '#webdevelopment', '#website', '#uxdesign', '#smallbusiness', '#dubaiwebdesign', '#conversion'],
  ecommerce: ['#ecommerce', '#onlinestore', '#shopify', '#dtc', '#smallbusiness', '#ecommercetips', '#dubaibusiness'],
  ai: ['#aitools', '#artificialintelligence', '#automation', '#productivity', '#smallbusiness', '#aiforbusiness', '#futureofwork'],
  business: ['#dubaibusiness', '#businesssetup', '#uaebusiness', '#startup', '#entrepreneur', '#freezone', '#dubai'],
};

export const DEFAULT_MODEL = 'openai/gpt-oss-120b:free';
export const FALLBACK_MODELS = [
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'z-ai/glm-4.5-air:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-4-31b-it:free',
];

// Safety net (same intent as the blog blocklist).
export const BLOCKLIST = [
  'politic', 'election', 'war', 'military', 'religion', 'religious', 'scam', 'fraud',
  'lawsuit', 'arrest', 'crime', 'deport', 'racist',
];
