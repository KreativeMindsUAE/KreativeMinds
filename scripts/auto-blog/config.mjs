// Central config for the KreativeMinds auto-blog pipeline.
// One category per article. Rotation order below is followed in sequence,
// tracked via topics-done.json so categories cycle evenly.

export const SITE = {
  origin: 'https://kreativeminds.ae',
  author: 'Khalid Hussain Mir',
  authorUrl: 'https://linkedin.com/in/Khalidgraphy',
  logo: 'https://kreativeminds.ae/logo-purple.png',
  region: 'Gulf and South Asia (MEASA)',
};

// Rotation order. Each run picks the category whose turn is next.
export const ROTATION = [
  'digital-marketing',
  'seo',
  'web-development',
  'ecommerce',
  'ai-tools',
  'business-formation-uae',
];

// Per-category sourcing + framing.
// subreddits: where we look for real visitor questions.
// fallbackQuestions: used only when Reddit returns nothing usable, so the
//   pipeline never fails. Curated to stay inside the agency's scope.
export const CATEGORIES = {
  'digital-marketing': {
    label: 'Digital marketing',
    eyebrow: 'Digital marketing',
    serviceAnchor: 'services.html#core',
    subreddits: ['marketing', 'DigitalMarketing', 'PPC', 'advertising', 'smallbusiness'],
    fallbackQuestions: [
      'How much should a small business spend on digital marketing each month?',
      'What digital marketing channels work best for a new business with a small budget?',
      'How do I measure if my marketing is actually working?',
    ],
  },
  seo: {
    label: 'SEO',
    eyebrow: 'SEO',
    serviceAnchor: 'services.html#core',
    subreddits: ['SEO', 'bigseo', 'juststart', 'Entrepreneur'],
    fallbackQuestions: [
      'How long does SEO take to show results for a new website?',
      'What are the most important SEO basics for a small business site?',
      'Do I still need a blog for SEO in 2026?',
    ],
  },
  'web-development': {
    label: 'Web development',
    eyebrow: 'Web development',
    serviceAnchor: 'services.html#core',
    subreddits: ['webdev', 'web_design', 'Wordpress', 'nocode'],
    fallbackQuestions: [
      'Should a small business use WordPress or a custom website?',
      'How much should a professional business website cost?',
      'What makes a business website load faster?',
    ],
  },
  ecommerce: {
    label: 'eCommerce',
    eyebrow: 'eCommerce',
    serviceAnchor: 'services.html#core',
    subreddits: ['ecommerce', 'shopify', 'FulfillmentByAmazon', 'EntrepreneurRideAlong'],
    fallbackQuestions: [
      'How do I get my first sales on a new online store?',
      'Is Shopify worth it for a small online business?',
      'What are the most common reasons online stores fail?',
    ],
  },
  'ai-tools': {
    label: 'AI tools',
    eyebrow: 'AI tools',
    serviceAnchor: 'services.html#core',
    subreddits: ['artificial', 'ChatGPT', 'automation', 'smallbusiness'],
    fallbackQuestions: [
      'Which AI tools actually save time for a small business?',
      'How can a business use AI without a technical team?',
      'Is it safe to use AI tools with customer data?',
    ],
  },
  'business-formation-uae': {
    label: 'Business formation in the UAE',
    eyebrow: 'Business setup',
    serviceAnchor: 'services.html#core',
    subreddits: ['dubai', 'UAE', 'DubaiEntrepreneurs', 'expats'],
    fallbackQuestions: [
      'What does it really cost to set up a business in the UAE?',
      'Free zone or mainland for a small online business in the UAE?',
      'What steps are involved in registering a company in Dubai?',
    ],
  },
};

// OpenRouter free models. We try them in order; free models get rate-limited
// upstream, so the writer retries with backoff and rotates through this list.
// Override the first choice with env OPENROUTER_MODEL.
export const DEFAULT_MODEL = 'openai/gpt-oss-120b:free';
export const FALLBACK_MODELS = [
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'z-ai/glm-4.5-air:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-4-31b-it:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
];

// Gemini image model (per project notes: name without -preview, aspect ratio in imageConfig).
export const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

// Reddit search queries + relevance keywords per category.
// We search each subreddit for these terms and keep only question-form titles
// that also contain at least one relevant keyword, so we get on-topic questions
// instead of generic top posts.
export const SEARCH = {
  'digital-marketing': {
    queries: ['marketing budget', 'social media ads', 'how to get customers', 'marketing strategy'],
    keywords: ['market', 'ads', 'advert', 'campaign', 'customer', 'lead', 'brand', 'audience', 'conversion', 'funnel', 'email', 'content'],
  },
  seo: {
    queries: ['seo for small business', 'rank on google', 'how long does seo take', 'seo basics'],
    keywords: ['seo', 'google', 'rank', 'keyword', 'backlink', 'serp', 'search', 'traffic', 'indexed', 'sitemap', 'meta'],
  },
  'web-development': {
    queries: ['business website cost', 'wordpress vs custom', 'website slow', 'best website builder'],
    keywords: ['website', 'web', 'wordpress', 'site', 'page speed', 'hosting', 'domain', 'developer', 'design', 'mobile', 'cms'],
  },
  ecommerce: {
    queries: ['first sale online store', 'is shopify worth it', 'why online stores fail', 'start online store'],
    keywords: ['store', 'shopify', 'ecommerce', 'product', 'sales', 'checkout', 'cart', 'shipping', 'dropship', 'online shop', 'conversion'],
  },
  'ai-tools': {
    queries: ['ai tools for business', 'automate with ai', 'best ai tool', 'ai for small business'],
    keywords: ['ai', 'automat', 'tool', 'chatgpt', 'workflow', 'prompt', 'agent', 'model', 'generate', 'productiv'],
  },
  'business-formation-uae': {
    queries: ['business setup dubai', 'free zone vs mainland', 'company registration uae', 'cost to start business uae', 'trade license dubai'],
    // Business-setup specific only. Bare "dubai"/"uae" are NOT here, or general
    // city chatter (tap water, who left town) would slip through.
    keywords: ['free zone', 'freezone', 'mainland', 'trade license', 'trade licence', 'business setup', 'set up a business', 'company registration', 'register a company', 'llc', 'sole establishment', 'corporate tax', 'company formation', 'ejari', 'business license'],
  },
};

// Global safety net: drop any sourced question matching these, so the writer
// never receives off-topic or sensitive prompts. Honors the explicit rule
// "no politics, no war, stay within agency scope". Expand on request.
export const BLOCKLIST = [
  'politic', 'election', 'war', 'military', 'protest', 'conflict', 'palestin', 'israel',
  'gaza', 'ukrain', 'russia', 'religion', 'religious', 'scam', 'fraud', 'lawsuit',
  'arrest', 'crime', 'visa ban', 'deport', 'tap water', 'salary', 'racist', 'gossip',
];

// How many real visitor questions to bundle per article.
export const QUESTIONS_PER_ARTICLE = { min: 2, max: 3 };
