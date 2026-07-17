# GroundTruth v2.0

## 1. Overview
GroundTruth is a local-first, multi-lingual field intelligence system that helps field officers log reports in their regional Indian languages (both in UI and via spoken voice dictation) and automatically compiles them into structured, translated debriefs for program managers.

In the field, reporting friction causes vital data to remain trapped in scattered paper notebooks. On the management side, synthesizing hundreds of text logs manually to find cross-program anomalies is an operational bottleneck.

During a visit, field officers can record details such as location, date, program area, stakeholders met, and observations through either text or voice input. An LLM converts each raw note into a structured debrief (key findings, blockers with severity, sentiment, follow-ups). This allows officers to continue documenting visits even in areas with poor or no internet connectivity.

It also includes a manager dashboard that automatically surfaces programmatic trends, recurring blockers, and priority management actions across geographies.

## 2. Core Architecture
The application follows a local-first architecture where all data is saved on the device before being synchronized with the cloud. Since network connectivity can be unreliable in rural areas, the application does not depend on a constant internet connection.

The app is local-first such that all writes/reads hit IndexedDB (via localForage) immediately, so officers can log a visit with zero connectivity and no data loss. The moment the officer clicks save while offline, the transaction status is set to pending. Once connected, the LLM structures the output for the locally saved note. A background sync engine reconciles unsynced records with Supabase (Postgres) once connectivity returns.

Data flow: 
Capture Form -> IndexedDB (instant save) -> Sync Engine (in background when internet is available)
-> Vercel Serverless Proxies (/api/chat, /api/translate) (secures private API keys)
-> Groq API (Whisper transcription, then Llama 3.1 8B structuring for per-visit debrief) 
-> AI Summary written back to the local record 
-> Supabase (Postgres) 
-> Manager Dashboard : The application passes the filtered, synced visit array back into an aggregation LLM pipeline (powered by Llama 3.3 70B), generating unified cross-visit patterns in real-time.

Visits are stored in a single Postgres table with one flexible jsonb column (ai_summary) holding the LLM output, rather than a rigid set of normalized columns so the AI's output schema can evolve without database migrations.

## 3. Tools & LLM Stack

| Layer | Choice |
| :--- | :--- |
| **Frontend** | React 19 + Vite, PWA shell with `vite-plugin-pwa` (Workbox) service worker for automatic, hash-based offline asset precaching |
| **Local storage** | localForage (IndexedDB wrapper) storing notes text when offline. Provides a robust, transactional key-value store directly on the device hardware, completely independent of browser tabs or cloud endpoints. |
| **Cloud backend** | Supabase (Postgres) was used as the backend database because it provides authentication, database management, and built-in Row Level Security, which simplified development. |
| **Speech-to-text** | Groq Whisper translations (`whisper-large-v3`) : Automatically transcribes and translates regional Indian languages (Hindi, Kannada, Tamil, etc.) into plain English text logs in one API request. |
| **Structuring + synthesis LLM** | Groq Llama 3.1 8B instant (for per-visit debrief extraction) and Llama 3.3 70B versatile (for cross-visit pattern/trend aggregation on the dashboard). The 70B model is selected for the macro-level aggregation to handle the complex reasoning required for trends, trajectory, actions, and synthesis, while keeping token costs and latency low via request debouncing. |
| **UI Localization** | Google Translate Element API : Enables instant dynamic UI translations into 22 scheduled Indian languages with full web font fallbacks. |

## 4. Key Technical & Design Decisions
*   **Offline-first over online-required**: Field connectivity in rural India is unreliable, so writes go to IndexedDB first and sync in the background — an officer's report is never lost to a dead network.
*   **jsonb for AI output, avoiding normalized columns**: Keeps the schema stable while the LLM's extraction format (tags, severity scales, new fields) is free to evolve during iteration.
*   **Voice-first capture**: Voice input was added because field officers often need to record long observations on mobile devices. Speaking notes is faster and more convenient than typing lengthy reports.
*   **Token Conservation & Request Debouncing**: During testing, I noticed that changing dashboard filters repeatedly triggered expensive LLM calls, leading to unnecessary token consumption and rate-limit issues. To address this, pattern analysis is only triggered when the manager explicitly clicks the "Analyze Patterns" button, reducing API usage and improving responsiveness.
*   **Secure Serverless Proxying**: To prevent users from extracting my private `GROQ_API_KEY` through browser inspect tabs, all LLM Completions and Whisper translations route through secure Vercel serverless functions (`/api/chat` and `/api/translate`) guarded by origin-locking CORS verification.
