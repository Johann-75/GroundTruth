/**
 * ai.js — Groq LLM integration for AI-powered visit debriefs and pattern analysis.
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL_PER_VISIT = 'llama-3.1-8b-instant';
const MODEL_PATTERNS = 'llama-3.3-70b-versatile';

/**
 * Shared fetch wrapper for Groq chat completion calls.
 * Tries serverless proxy /api/chat first, falls back to direct client-side fetch if proxy is not found.
 */
const groqChat = async (model, messages, options = {}, retries = 1) => {
  const payload = {
    model,
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 1024,
    messages,
    ...options,
  };

  // ── 1. Try Vercel Serverless Proxy Route first ──────────────────────────
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // Retry once on proxy rate limit
    if (response.status === 429 && retries > 0) {
      await new Promise((r) => setTimeout(r, 2000));
      return groqChat(model, messages, options, retries - 1);
    }

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        try {
          return JSON.parse(content);
        } catch (jsonErr) {
          console.error('[AI] Proxy JSON parse failed. Content:', content);
          throw new Error('AI response was not valid JSON. Please try again.');
        }
      }
    } else if (response.status !== 404 && response.status !== 500) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Proxy error (${response.status}): ${err?.error?.message ?? 'Unknown'}`);
    }
  } catch (proxyError) {
    if (proxyError.message.includes('not valid JSON')) {
      throw proxyError; // Don't fall back if LLM was reached but output malformed JSON
    }
    console.warn('[AI] Serverless proxy bypassed/failed. Trying direct client fallback...', proxyError.message);
  }

  // ── 2. Fallback to direct client-side Groq call ─────────────────────────
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Groq API Key not configured. Please add GROQ_API_KEY to Vercel environment variables or VITE_GROQ_API_KEY to your local .env file.');
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  // Back off and retry once on rate-limit
  if (response.status === 429 && retries > 0) {
    await new Promise((r) => setTimeout(r, 2000));
    return groqChat(model, messages, options, retries - 1);
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Groq API error (${response.status}): ${err?.error?.message ?? 'Unknown error'}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from Groq API.');

  try {
    return JSON.parse(content);
  } catch (jsonErr) {
    console.error('[AI] Direct JSON parse failed. Content:', content);
    throw new Error('AI response was not valid JSON. Please try again.');
  }
};

/**
 * Generate a structured field debrief from a single visit.
 * @param {object} visitData
 * @returns {Promise<object>} Structured debrief: key_findings, blockers, sentiment, follow_ups, tags
 */
export const generateFieldDebrief = async (visitData) => {
  const systemPrompt = `You are a field intelligence analyst reviewing a single field visit report submitted by a field officer working in rural India.

Base every claim only on what is stated or directly implied in the notes/transcription provided. Do not invent details, numbers, or outcomes that are not there.

Return a JSON object with exactly these keys:
- key_findings: array of 1-5 strings. Only include genuine, specific observations. Return fewer items rather than padding if the visit was routine.
- blockers: array of objects { "issue": string, "normalized_tag": string, "severity": "high"|"medium"|"low" }.
  Severity rubric — high: actively blocking program delivery or causing ongoing harm; medium: causing delay but work continues; low: a friction point not yet causing measurable impact.
  normalized_tag must be a 2-4 word lowercase canonical phrase that would match the same blocker even if worded differently across visits — e.g. "biometric scanning failure", "input delivery delay", "electricity supply issue". This tag is used for cross-visit pattern matching so consistency matters more than precision.
  Return [] if no blockers.
- community_sentiment: "positive" | "mixed" | "negative"
- sentiment_explanation: one sentence citing a specific detail from the notes as evidence.
- follow_ups: array of 0-4 strings. Only suggest follow-ups directly implied by the notes.
- tags: array of 2-5 strings from this vocabulary where possible — [Infrastructure, Supply Chain, Training & Capacity, Bureaucratic/Regulatory, Finance, Community Engagement, Technology/Digital, Weather/Seasonal] — plus at most one free-text tag if nothing fits.

If notes are empty or unusable, return: key_findings: [], blockers: [], community_sentiment: "mixed", sentiment_explanation: "Insufficient detail to assess sentiment.", follow_ups: [], tags: [].`;

  const userMessage = `Visit Date: ${visitData.date}
Location: ${visitData.state}, ${visitData.district}, ${visitData.block || 'N/A'}
Program Area: ${visitData.programArea}
Stakeholders Met: ${Array.isArray(visitData.stakeholders) ? visitData.stakeholders.join(', ') : visitData.stakeholders}
Field Notes: ${visitData.notes || 'No notes provided'}
Voice Transcription: ${visitData.voiceTranscription || 'N/A'}`;

  try {
    const parsed = await groqChat(MODEL_PER_VISIT, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ]);

    if (!parsed.key_findings || !parsed.community_sentiment) {
      throw new Error('Incomplete AI response structure.');
    }
    return parsed;
  } catch (error) {
    console.error('[AI] generateFieldDebrief failed:', error);
    throw error;
  }
};

/**
 * Analyze patterns across multiple visit summaries for the manager dashboard.
 * Blockers are pre-aggregated in JS (keyed by normalized_tag) before sending to the LLM
 * so the model doesn't need to recount — cheaper and more accurate.
 *
 * @param {object[]} visitSummaries - Visits with aiSummary populated
 * @returns {Promise<object|null>} Pattern analysis object, or null if no visits provided
 */
export const analyzePatterns = async (visitSummaries) => {
  if (!visitSummaries.length) return null;

  // Cap at 15 most recent visits to stay within token limits
  const sortedVisits = [...visitSummaries]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 15);

  // Pre-aggregate blocker frequencies keyed by normalized_tag (semantic clustering)
  const blockerCounts = {};
  const blockerAreas = {};
  const blockerLabels = {}; // Key -> first seen human-readable issue description

  sortedVisits.forEach((v) => {
    const areaName = `${v.district}, ${v.state}`;
    v.aiSummary?.blockers?.forEach((b) => {
      if (!b.issue) return;
      // Prefer normalized_tag for consistent cross-visit matching; fall back to raw issue text
      const key = (b.normalized_tag || b.issue).trim().toLowerCase();
      if (!blockerLabels[key]) {
        blockerLabels[key] = b.issue.trim();
      }

      blockerCounts[key] = (blockerCounts[key] ?? 0) + 1;
      if (!blockerAreas[key]) blockerAreas[key] = new Set();
      blockerAreas[key].add(areaName);
    });
  });

  const recurringBlockers = Object.keys(blockerCounts)
    .map((tag) => ({
      tag, // Normalized key for grouping/matching
      issue: blockerLabels[tag] || tag, // Human-readable description
      frequency: blockerCounts[tag],
      affected_areas: Array.from(blockerAreas[tag]),
    }))
    .sort((a, b) => b.frequency - a.frequency);

  // Strip blockers from per-visit strings — they're already captured in preAggStr,
  // so repeating them is pure token waste.
  const visitDescriptions = sortedVisits
    .map((v, i) => {
      const s = v.aiSummary ?? {};
      return `Visit ${i + 1}: ${v.date} | ${v.state}, ${v.district} | ${v.programArea} | Sentiment: ${s.community_sentiment ?? 'unknown'} | Findings: ${s.key_findings?.join('; ') ?? 'none'}`;
    })
    .join('\n');

  const preAggStr = recurringBlockers
    .map((b) => `- ${b.issue}: ${b.frequency}x across [${b.affected_areas.join(', ')}]`)
    .join('\n');

  const systemPrompt = `You are a field operations analyst. You receive pre-aggregated blocker frequency counts and per-visit records. Do not recompute frequencies — use the counts given.

Return a JSON object with exactly these keys:
- geographic_patterns: array of { "region": string, "pattern_description": string }. Only regions with 2+ visits showing a consistent pattern.
- program_trends: array of { "program": string, "trend": string, "sentiment": "positive"|"negative" }. Each trend must cite a specific cause.
- sentiment_trajectory: "improving" | "stable" | "declining". Compare the 3 most recent visits against all prior. Return "stable" if fewer than 6 total visits.
- priority_actions: array of 1-3 action-verb-led strings. Only include as many as are genuinely warranted.
- synthesis: one sentence naming the single most urgent issue and its location/program.`;

  const userMessage = `Pre-aggregated blocker counts:
${preAggStr || 'No blockers reported.'}

Per-visit records:
${visitDescriptions}

Analyze these ${sortedVisits.length} field visits and return the insights JSON.`;

  try {
    const parsed = await groqChat(MODEL_PATTERNS, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ]);

    parsed.recurring_blockers = recurringBlockers;
    return parsed;
  } catch (error) {
    console.error('[AI] analyzePatterns failed:', error);
    throw error;
  }
};
