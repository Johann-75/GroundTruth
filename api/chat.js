// api/chat.js
// Vercel Serverless Function to proxy Groq Chat Completions (Llama) securely.

export default async function handler(req, res) {
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

  // Simple body validation to prevent malicious abuse
  if (!req.body || typeof req.body !== 'object') {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }
  const { model, messages } = req.body;
  if (!model || !messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'Missing required parameters: model and messages (array)' });
    return;
  }
  const allowedModels = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile'];
  if (!allowedModels.includes(model)) {
    res.status(400).json({ error: `Unauthorized model: ${model}` });
    return;
  }

  // Retrieve private environment variable (NOT VITE_ prefixed to ensure it remains secret on server side)
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server key not configured. Please add GROQ_API_KEY to your Vercel project environment variables.' });
    return;
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: req.body.response_format,
        temperature: req.body.temperature ?? 0.3,
        max_tokens: req.body.max_tokens ?? 1024
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      res.status(response.status).json(err);
      return;
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    console.error('[Proxy Chat] Error forwarding request:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
