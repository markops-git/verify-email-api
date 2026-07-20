// Simple in-memory rate limiter (resets on cold start, fine for basic abuse protection)
const requestLog = new Map();
const RATE_LIMIT = 10; // max requests
const RATE_WINDOW_MS = 60 * 1000; // per 1 minute, per IP

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
  res.setHeader('Access-Control-Allow-Origin', 'https://ampifire.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'too many requests, slow down' });
  }

  const { email } = req.query;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'valid email required' });
  }

  const apiKey = process.env.QUICKEMAILVERIFICATION_API_KEY;
  const url = `https://api.quickemailverification.com/v1/verify?email=${encodeURIComponent(email)}&apikey=${apiKey}`;

  try {
    const r = await fetch(url);
    const data = await r.json();

    res.status(200).json({
      result: data.result,               // valid, invalid, unknown
      reason: data.reason,
      isDisposable: data.disposable === 'true',
      isRoleAccount: data.role === 'true',
      isAcceptAll: data.accept_all === 'true',
      safeToSend: data.safe_to_send === 'true',
      suggestion: data.did_you_mean || null
    });
  } catch (err) {
    res.status(500).json({ error: 'verification failed' });
  }
}