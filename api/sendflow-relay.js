// Simple in-memory rate limiter (resets on cold start, fine for basic abuse protection)
const requestLog = new Map();
const RATE_LIMIT = 20; // max requests
const RATE_WINDOW_MS = 60 * 1000; // per 1 minute, per IP
const ALLOWED_ORIGINS = [
  'https://ampifire.com',
  'https://yes.ampifire.com',
  'https://now.ampifire.com',
  'https://get.ampifire.com',
  'https://live.ampifire.ai',
];

const SENDFLOW_URL = 'https://webhooksendflow.com.br/w/IqDZIpbHskJzDN5kIfbU';

function isRateLimited(ip) {
  const now = Date.now();
  const entry = requestLog.get(ip) || { count: 0, windowStart: now };

  if (now - entry.windowStart > RATE_WINDOW_MS) {
    entry.count = 1;
    entry.windowStart = now;
  } else {
    entry.count += 1;
  }

  requestLog.set(ip, entry);
  return entry.count > RATE_LIMIT;
}

export default async function handler(req, res) {
  // Lock CORS to ampifire.com only
  const origin = req.headers.origin || req.headers.referer || '';
  const isAllowed = ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));

  if (!isAllowed) {
    return res.status(403).json({ error: 'forbidden' });
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'too many requests, slow down' });
  }

  const user = req.body && req.body.data && req.body.data.user;
  if (!user || !user.email || !user.phoneNumber) {
    return res.status(400).json({ error: 'user.email and user.phoneNumber required' });
  }

  try {
    // Server-to-server call: not subject to browser CORS, so this can use
    // application/json exactly like the working Postman request.
    const r = await fetch(SENDFLOW_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    res.status(200).json({ relayed: true, sendflowStatus: r.status });
  } catch (err) {
    res.status(502).json({ error: 'relay failed' });
  }
}
