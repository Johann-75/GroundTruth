/**
 * whisper.js
 * Audio transcription service using Groq's Whisper large-v3 model.
 * Sends raw audio blobs to the Groq API and returns plain-text transcriptions.
 */



/** Groq API endpoint for audio transcription */
const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

/** Default model — Whisper large-v3-turbo on Groq */
const DEFAULT_MODEL = 'whisper-large-v3-turbo';

/**
 * Transcribe an audio blob to text using Groq Whisper.
 *
 * @param {Blob} audioBlob — the recorded audio (typically audio/webm)
 * @param {object} [options]
 * @param {string} [options.language='en'] — ISO-639-1 language code hint
 * @param {string} [options.model] — model override (defaults to whisper-large-v3-turbo)
 * @returns {Promise<string>} The transcribed text.
 * @throws {Error} If the API key is missing or the request fails.
 */
export const transcribeAudio = async (audioBlob, options = {}) => {
  const { language = 'en', model = DEFAULT_MODEL } = options;

  // ── 1. Retrieve API key ──────────────────────────────────
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Groq API key not configured. Please set the VITE_GROQ_API_KEY environment variable in your env file.'
    );
  }

  // ── 2. Build multipart form data ─────────────────────────
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', model);
  formData.append('language', language);
  formData.append('response_format', 'text');

  // ── 3. Call Groq Whisper API ─────────────────────────────
  let response;
  try {
    response = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });
  } catch (networkError) {
    throw new Error(
      'Network error — could not reach the transcription service. Check your internet connection.'
    );
  }

  // ── 4. Handle errors ────────────────────────────────────
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
