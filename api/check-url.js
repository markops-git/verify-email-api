const ALLOWED_ORIGINS = [
  'https://ampifire.com',
  'https://yes.ampifire.com',
  'https://now.ampifire.com',
  'https://get.ampifire.com',
  'https://live.ampifire.ai',
];

const BLOCKED_DOMAINS = {
  email_provider: [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
    'aol.com', 'icloud.com', 'protonmail.com', 'mail.com', 'gmx.com'
  ],
  search_engine: [
  'google.com', 'bing.com', 'duckduckgo.com', 'baidu.com'
  ],
  social_media: [
    'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com',
    'tiktok.com', 'youtube.com', 'pinterest.com', 'threads.net', 'snapchat.com',
    'whatsapp.com', 'telegram.org'
  ],
  link_in_bio: [
    'linktr.ee', 'linktree.com', 'bio.link', 'beacons.ai', 'campsite.bio',
    'lnk.bio', 'carrd.co', 'msha.ke', 'shor.by'
  ],
  free_website_builder: [
    'wix.com', 'wixsite.com', 'wordpress.com', 'blogspot.com', 'blogger.com',
    'weebly.com', 'squarespace.com', 'godaddysites.com', 'webflow.io',
    'jimdo.com', 'strikingly.com', 'site123.com', 'ucraft.com', 'yola.com'
  ],
  free_page_hosting: [
    'notion.site', 'notion.so', 'sites.google.com', 'docs.google.com',
    'drive.google.com', 'github.io', 'netlify.app', 'vercel.app',
    'pages.dev', 'repl.co', 'glitch.me'
  ],
  url_shortener: [
    'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly', 'rebrand.ly',
    'is.gd', 'buff.ly', 'shorturl.at'
  ],
  marketplace: [
    'etsy.com', 'amazon.com', 'ebay.com', 'fiverr.com', 'upwork.com'
  ]
};

function checkGenericDomain(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    for (const [category, domains] of Object.entries(BLOCKED_DOMAINS)) {
      if (domains.some(d => hostname === d || hostname.endsWith(`.${d}`))) {
        return category;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const origin = req.headers.origin || req.headers.referer || '';
  const isAllowed = ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));

  if (!isAllowed) {
    return res.status(403).json({ error: 'forbidden' });
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();

  let { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });

  // add protocol if missing
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  const genericCategory = checkGenericDomain(url);
  if (genericCategory) {
    return res.status(200).json({
      exists: false,
      reason: 'generic_domain',
      category: genericCategory
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal
    });

    clearTimeout(timeout);

    res.status(200).json({
      exists: response.ok,
      status: response.status,
      finalUrl: response.url
    });
  } catch (err) {
    res.status(200).json({
      exists: false,
      error: err.name === 'AbortError' ? 'timeout' : 'unreachable'
    });
  }
}