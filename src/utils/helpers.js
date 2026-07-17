/**
 * helpers.js
 * Utility functions — date formatting, ID generation, data aggregation.
 */

/**
 * Generate a collision-resistant ID using timestamp + random suffix.
 * @returns {string}
 */
export const generateId = () => {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${ts}-${rand}`;
};

/**
 * Format a date string to a human-readable form.
 * e.g. "2025-06-15" → "Jun 15, 2025"
 * @param {string} dateString
 * @returns {string}
 */
export const formatDate = (dateString) =>
  new Date(dateString).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

/**
 * Return today's date as a YYYY-MM-DD string (for date input defaults).
 * Uses local time, suitable for IST and adjacent timezones.
 * @returns {string}
 */
export const getTodayISO = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Return a relative time string for recent timestamps.
 * e.g. "2 days ago", "Just now"
 * @param {string} dateString
 * @returns {string}
 */
export const getRelativeTime = (dateString) => {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(dateString);
};

/**
 * Truncate text to a maximum length with an ellipsis.
 * @param {string} text
 * @param {number} [maxLength=100]
 * @returns {string}
 */
export const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '…';
};

/**
 * Get up to two uppercase initials from a full name.
 * e.g. "Priya Sharma" → "PS"
 * @param {string} name
 * @returns {string}
 */
export const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase())
    .slice(0, 2)
    .join('');
};

/**
 * Map a community sentiment value to its CSS colour variable.
 * @param {'positive'|'mixed'|'negative'} sentiment
 * @returns {string}
 */
export const getSentimentColor = (sentiment) => {
  switch (sentiment?.toLowerCase()) {
    case 'positive': return 'var(--color-sentiment-positive)';
    case 'negative': return 'var(--color-sentiment-negative)';
    default:         return 'var(--color-sentiment-mixed)';
  }
};

/**
 * Map a blocker severity value to its CSS colour variable.
 * @param {'high'|'medium'|'low'} severity
 * @returns {string}
 */
export const getSeverityColor = (severity) => {
  switch (severity?.toLowerCase()) {
    case 'high':   return 'var(--color-danger)';
    case 'medium': return 'var(--color-warning)';
    case 'low':    return 'var(--color-accent)';
    default:       return 'var(--color-text-muted)';
  }
};

/**
 * Format a UTC timestamp to a short HH:MM 24-hour string.
 * @param {string|number} timestamp
 * @returns {string}
 */
export const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
