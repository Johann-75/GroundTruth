/**
 * ai.js — Groq Llama 3.1 8B & Llama 3.3 70B integration for AI summarization.
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL_PER_VISIT = 'llama-3.1-8b-instant';
const MODEL_PATTERNS = 'llama-3.3-70b-versatile';


/**
 * Generate a structured field debrief from visit data.
 * @param {Object} visitData - The visit data to analyze
 * @returns {Promise<Object>} Structured debrief with key_findings, blockers, sentiment, etc.
 */
export const generateFieldDebrief = async (visitData) => {
  try {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;

    if (!apiKey) {
      throw new Error('Groq API Key is not configured. Please set the VITE_GROQ_API_KEY environment variable.');
    }

    const systemPrompt = `You are a field intelligence analyst for The/Nudge Institute, reviewing a single field visit report submitted by a field officer working in rural India.

Base every claim only on what is stated or directly implied in the notes/transcription provided. Do not invent details, numbers, or outcomes that aren't there.

Return a JSON object with exactly these keys:
- key_findings: array of 1-5 strings. Only include genuine, specific observations. If the visit was routine with nothing notable, return fewer items rather than padding.
- blockers: array of objects { "issue": string, "severity": "high"|"medium"|"low" }. Severity rubric — high: actively blocking program delivery or causing ongoing harm/loss (e.g. spoiled produce, halted operations); medium: causing delay or inefficiency but work continues; low: a friction point or risk, not yet causing measurable impact. Return an empty array if no blockers are mentioned.
- community_sentiment: "positive" | "mixed" | "negative"
- sentiment_explanation: one sentence that cites a specific detail from the notes as evidence — never just restate the sentiment label.
- follow_ups: array of 0-4 strings. Only suggest follow-ups directly implied by the notes — do not invent generic next steps.
- tags: array of 2-5 strings, chosen from this fixed vocabulary where possible — [Infrastructure, Supply Chain, Training & Capacity, Bureaucratic/Regulatory, Finance, Community Engagement, Technology/Digital, Weather/Seasonal] — plus at most one free-text tag if nothing fits.

If field notes are empty or contain no usable information, return key_findings: [], blockers: [], community_sentiment: "mixed", sentiment_explanation: "Insufficient detail in the report to assess sentiment.", follow_ups: [], tags: [].`;

    const userMessage = `Visit Date: ${visitData.date}
Location: ${visitData.state}, ${visitData.district}, ${visitData.block || 'N/A'}
Program Area: ${visitData.programArea}
Stakeholders Met: ${Array.isArray(visitData.stakeholders) ? visitData.stakeholders.join(', ') : visitData.stakeholders}
Field Notes: ${visitData.notes || 'No notes provided'}
Voice Transcription: ${visitData.voiceTranscription || 'N/A'}`;

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_PER_VISIT,
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Groq API error (${response.status}): ${errorData?.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from Groq API');
    }

    const parsed = JSON.parse(content);

    // Validate required fields exist
    if (!parsed.key_findings || !parsed.community_sentiment) {
      throw new Error('Incomplete AI response JSON structure');
    }

    return parsed;
  } catch (error) {
    console.error('AI debrief generation failed:', error);
    throw error;
  }
};

/**
 * Analyze patterns across multiple visit summaries.
 * Used by the Manager Dashboard for macro-level insights.
 * @param {Array} visitSummaries - Array of visit objects with aiSummary populated
 * @returns {Promise<Object>} Pattern analysis results
 */
export const analyzePatterns = async (visitSummaries) => {
  if (visitSummaries.length === 0) {
    return null;
  }

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Groq API Key is not configured. Please set the VITE_GROQ_API_KEY environment variable.');
  }

  try {
    // Cap at the 15 most recent visits to stay within Groq rate limits
    const sortedVisits = [...visitSummaries]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 15);

    // 1. Tally recurring blockers and group them in Plain JS
    const blockerCounts = {};
    const blockerAreas = {};
    
    sortedVisits.forEach((v) => {
      const summary = v.aiSummary || {};
      const areaName = `${v.district}, ${v.state}`;
      summary.blockers?.forEach((b) => {
        if (!b.issue) return;
        const key = b.issue.trim();
        const normKey = key.toLowerCase();
        
        let matchedKey = Object.keys(blockerCounts).find(k => k.toLowerCase() === normKey);
        if (!matchedKey) {
          matchedKey = key;
          blockerCounts[matchedKey] = 0;
          blockerAreas[matchedKey] = new Set();
        }
        
        blockerCounts[matchedKey] += 1;
        blockerAreas[matchedKey].add(areaName);
      });
    });

    const recurringBlockers = Object.keys(blockerCounts).map((issue) => ({
      issue,
      frequency: blockerCounts[issue],
      affected_areas: Array.from(blockerAreas[issue]),
    })).sort((a, b) => b.frequency - a.frequency);

    // 2. Build condensed visit summaries including blocker severity
    const visitDescriptions = sortedVisits.map((v, i) => {
      const summary = v.aiSummary || {};
      const blockersStr = summary.blockers?.map(b => `${b.issue} (Severity: ${b.severity})`).join('; ') || 'none';
      return `Visit ${i + 1}: ${v.date} | ${v.state}, ${v.district} | ${v.programArea} | Sentiment: ${summary.community_sentiment || 'unknown'} | Blockers: ${blockersStr} | Findings: ${summary.key_findings?.join('; ') || 'none'}`;
    }).join('\n');

    const preAggregatedBlockersStr = recurringBlockers.map(b => `- ${b.issue}: ${b.frequency} time(s) across [${b.affected_areas.join(', ')}]`).join('\n');

    const systemPrompt = `You are a field operations analyst for The/Nudge Institute. You will receive pre-aggregated data from recent field visits: blocker frequency counts (already tallied), and per-visit sentiment/severity/findings. Do not recompute frequencies — use the counts given to you.

Return a JSON object with exactly these keys:
- geographic_patterns: array of objects { "region": string, "pattern_description": string }, only for regions with 2+ visits showing a consistent pattern. Omit regions with insufficient data rather than speculating.
- program_trends: array of objects { "program": string, "trend": string, "sentiment": "positive"|"negative" }. Each trend must reference a specific cause from the underlying findings/blockers — no generic statements.
- sentiment_trajectory: "improving" | "stable" | "declining" — compare the average sentiment of the 3 most recent visits against the average of all prior visits in the dataset. If fewer than 6 total visits, return "stable" (insufficient data to call a trend).
- priority_actions: array of 1-3 strings, action-verb-led. Only include as many as are genuinely warranted by distinct issues in the data — do not pad to 3 if there are only 1-2 real issues.
- synthesis: one sentence, citing the single most urgent issue and its location/program, in plain operational language a program manager would say out loud.`;

    const userMessage = `Here is the pre-aggregated blocker count data:
${preAggregatedBlockersStr || 'No blockers reported.'}

Here are the detailed per-visit records (findings, sentiment, severity):
${visitDescriptions}

Please analyze these ${sortedVisits.length} field visits and return the insights JSON.`;

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_PATTERNS,
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Groq API error (${response.status}): ${errorData?.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from Groq API');
    }
    const parsed = JSON.parse(content);
    // Merge the plain JS pre-aggregated blockers back into the final object
    parsed.recurring_blockers = recurringBlockers;
    return parsed;
  } catch (error) {
    console.error('Pattern analysis failed:', error);
    throw error;
  }
};






