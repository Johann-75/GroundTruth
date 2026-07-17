// api/translate.js
// Vercel Serverless Function to proxy Groq Whisper Audio Translations securely.
import https from 'https';

export const config = {
  api: {
    bodyParser: false, // Disable body parser to receive raw multipart streams (required for binary files)
  },
};

export default function handler(req, res) {
  // CORS Headers
  const origin = req.headers.origin;
  const isAllowed = origin && (
    origin.startsWith('http://localhost:') || 
    origin.startsWith('http://127.0.0.1:') || 
    origin.endsWith('.vercel.app') ||
    origin === 'https://ground-truth-iota.vercel.app'
  );

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Check upload size limit (max 25MB to align with Groq API limits)
  const contentLength = req.headers['content-length'];
  if (contentLength && parseInt(contentLength, 10) > 25 * 1024 * 1024) {
    res.status(413).json({ error: 'Payload too large. Audio file size limit is 25MB.' });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server key not configured. Please add GROQ_API_KEY to your Vercel project environment variables.' });
    return;
  }

  const options = {
    hostname: 'api.groq.com',
    path: '/openai/v1/audio/translations',
    method: 'POST',
    headers: {
      ...req.headers,
      'authorization': `Bearer ${apiKey}`
    }
  };

  // Remove host header to prevent SSL SNI mismatches
  delete options.headers.host;

  // Pipe the request and proxy the response back to client
  const proxyReq = https.request(options, (proxyRes) => {
    if (!res.headersSent) {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
    }
    proxyRes.pipe(res);
  });

  req.pipe(proxyReq);

  proxyReq.on('error', (err) => {
    console.error('[Proxy Translate] Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });
}
