import { useState, useEffect } from 'react';
import {
  Sparkles,
  AlertTriangle,
  Heart,
  ArrowRight,
  Tag,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import SentimentBadge from './SentimentBadge';
import { getSeverityColor } from '../utils/helpers';
import './AISummaryPanel.css';

/**
 * AISummaryPanel — renders the AI-generated structured debrief.
 * Shows key findings, blockers, sentiment, follow-ups, and tags.
 */
function AISummaryPanel({ summary, onRegenerate, isRegenerating }) {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const setOnlineTrue  = () => setOnline(true);
    const setOnlineFalse = () => setOnline(false);
    window.addEventListener('online',  setOnlineTrue);
    window.addEventListener('offline', setOnlineFalse);
    return () => {
      window.removeEventListener('online',  setOnlineTrue);
      window.removeEventListener('offline', setOnlineFalse);
    };
  }, []);

  if (!summary) {
    return (
      <div className="ai-summary-empty card">
        <Sparkles size={32} className="ai-summary-empty-icon" />
        <h3>No AI Debrief Yet</h3>
        <p>
          {online
            ? 'AI summary will be generated when you submit your visit log, or click below to generate one now.'
            : 'AI summary generation is deferred while offline. It will process automatically when network is restored.'}
        </p>
        {onRegenerate && (
          <button
            className="btn btn-primary"
            onClick={onRegenerate}
            disabled={isRegenerating || !online}
          >
            {isRegenerating ? (
              <>
                <Loader2 size={16} className="spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                {online ? 'Generate AI Debrief' : 'Offline — Pending Sync'}
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="ai-summary-panel">
      {/* Header */}
      <div className="ai-summary-header">
        <div className="ai-summary-title">
          <Sparkles size={20} />
          <h3>AI Debrief Summary</h3>
        </div>
        {onRegenerate && (
          <button
            className="btn btn-ghost btn-icon"
            onClick={onRegenerate}
            disabled={isRegenerating}
            title="Regenerate summary"
          >
            <RefreshCw size={16} className={isRegenerating ? 'spin' : ''} />
          </button>
        )}
      </div>

      {/* Key Findings */}
      {summary.key_findings?.length > 0 && (
        <div className="ai-summary-section">
          <h4 className="ai-summary-section-title">
            <span className="ai-section-icon ai-section-icon-findings">📋</span>
            Key Findings
          </h4>
          <ul className="ai-summary-list">
            {summary.key_findings.map((finding, i) => (
              <li key={i} className="ai-summary-list-item">{finding}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Blockers */}
      {summary.blockers?.length > 0 && (
        <div className="ai-summary-section">
          <h4 className="ai-summary-section-title">
            <span className="ai-section-icon ai-section-icon-blockers">
              <AlertTriangle size={16} />
            </span>
            Blockers Observed
          </h4>
          <div className="ai-summary-blockers">
            {summary.blockers.map((blocker, i) => (
              <div key={i} className="ai-blocker-item">
                <span
                  className="ai-blocker-severity"
                  style={{ background: getSeverityColor(blocker.severity) }}
                />
                <div className="ai-blocker-content">
                  <span className="ai-blocker-issue">{blocker.issue}</span>
                  <span className={`ai-blocker-level ai-blocker-level-${blocker.severity}`}>
                    {blocker.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Community Sentiment */}
      <div className="ai-summary-section">
        <h4 className="ai-summary-section-title">
          <span className="ai-section-icon ai-section-icon-sentiment">
            <Heart size={16} />
          </span>
          Community Sentiment
        </h4>
        <div className="ai-sentiment-display">
          <SentimentBadge sentiment={summary.community_sentiment} />
          {summary.sentiment_explanation && (
            <p className="ai-sentiment-explanation">{summary.sentiment_explanation}</p>
          )}
        </div>
      </div>

      {/* Follow-ups */}
      {summary.follow_ups?.length > 0 && (
        <div className="ai-summary-section">
          <h4 className="ai-summary-section-title">
            <span className="ai-section-icon ai-section-icon-followups">
              <ArrowRight size={16} />
            </span>
            Suggested Follow-ups
          </h4>
          <ul className="ai-summary-followups">
            {summary.follow_ups.map((followUp, i) => (
              <li key={i} className="ai-followup-item">
                <span className="ai-followup-number">{i + 1}</span>
                {followUp}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tags */}
      {summary.tags?.length > 0 && (
        <div className="ai-summary-section">
          <h4 className="ai-summary-section-title">
            <span className="ai-section-icon ai-section-icon-tags">
              <Tag size={16} />
            </span>
            Topics
          </h4>
          <div className="ai-summary-tags">
            {summary.tags.map((tag, i) => (
              <span key={i} className="ai-tag">{tag}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AISummaryPanel;
