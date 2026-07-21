export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://ampifire.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();

  let { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });

  // add protocol if missing
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
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