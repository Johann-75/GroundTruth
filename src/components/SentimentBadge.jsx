import './SentimentBadge.css';

/**
 * SentimentBadge — displays community sentiment as a colored pill.
 * Values: positive, mixed, negative
 */
function SentimentBadge({ sentiment, size = 'default' }) {
    if (!sentiment) return null;

  const label =
    sentiment.charAt(0).toUpperCase() + sentiment.slice(1).toLowerCase();

  return (
    <span
      className={`sentiment-badge sentiment-badge-${sentiment.toLowerCase()} sentiment-badge-${size}`}
    >
      <span className="sentiment-badge-dot" />
      {label}
    </span>
  );
}

export default SentimentBadge;
