/**
 * whisper.js
 * Audio translation service using Groq's Whisper large-v3-turbo model.
 * Accepts any language audio blob, auto-detects the spoken language,
 * and returns a plain-English transcription.
 */

/** Groq API endpoint for audio translations (auto-detects language → English) */
const GROQ_TRANSLATION_URL = 'https://api.groq.com/openai/v1/audio/translations';

/** Whisper large-v3: fast enough for field use, accurate enough for Indian regional languages */
const DEFAULT_MODEL = 'whisper-large-v3';

/** Network timeout floor for audio upload (ms). Prevents indefinite spinner on slow connections. */
const MIN_REQUEST_TIMEOUT_MS = 45_000;

/**
 * Transcribe and translate an audio blob to English text using Groq Whisper.
 *
 * @param {Blob} audioBlob — the recorded audio (typically audio/webm)
 * @param {object} [options]
 * @param {string} [options.model] — model override
 * @returns {Promise<string>} The translated English text.
 * @throws {Error} If the API key is missing, the network times out, or the request fails.
 */
export const transcribeAudio = async (audioBlob, options = {}) => {
  const { model = DEFAULT_MODEL } = options;

  // ── 1. Build multipart form data ─────────────────────────
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', model);
  formData.append('response_format', 'text');

  // ── 2. Call Groq Whisper API (with timeout dynamic to file size)
  const controller = new AbortController();
  const timeoutMs = Math.max(MIN_REQUEST_TIMEOUT_MS, Math.ceil(audioBlob.size / 10_000) * 1000);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    // ── Try Vercel Serverless Proxy Route first ───────────────────────────
    response = await fetch('/api/translate', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok && (response.status === 404 || response.status === 500)) {
      throw new Error('Proxy bypass triggered');
    }
  } catch (proxyError) {
    console.warn('[Whisper] Serverless proxy bypassed/failed. Trying direct client fallback...', proxyError.message);

    // ── Direct direct fallback if proxy isn't available (local dev) ───────
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Groq API key not configured. Please set GROQ_API_KEY on the Vercel dashboard or VITE_GROQ_API_KEY in your local .env file.'
      );
    }

    try {
      response = await fetch(GROQ_TRANSLATION_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
        signal: controller.signal,
      });
    } catch (networkError) {
      if (networkError.name === 'AbortError') {
        throw new Error('Transcription timed out — audio upload took too long. Try a shorter recording.');
      }
      throw new Error('Network error — could not reach the transcription service. Check your internet connection.');
    }
  } finally {
    clearTimeout(timeoutId);
  }

  // ── 4. Handle API errors ─────────────────────────────────
  if (!response.ok) {
    let errorMessage = `Transcription failed (HTTP ${response.status})`;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody?.error?.message || errorMessage;
    } catch {
      // Couldn't parse error body — keep the generic message
    }
    throw new Error(errorMessage);
  }

  // ── 5. Return transcription text ─────────────────────────
  const text = await response.text();
  return text.trim();
};
