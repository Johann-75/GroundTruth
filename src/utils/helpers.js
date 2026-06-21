/**
 * helpers.js
 * Utility functions used across the app — date formatting,
 * ID generation, data aggregation helpers.
 */

/**
 * Generate a unique ID for visits and other entities.
 * Uses timestamp + random suffix for uniqueness.
 */
export const generateId = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
};

/**
 * Format a date string to a human-readable format.
 * e.g., "2025-06-15" → "Jun 15, 2025"
 */
export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Format a date string to a shorter format for cards.
 * e.g., "2025-06-15" → "Jun 15"
 */
export const formatDateShort = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Get today's date in YYYY-MM-DD format (for date input default).
 */
export const getTodayISO = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get relative time string (e.g., "2 days ago", "Just now").
 */
export const getRelativeTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
};

/**
 * Truncate text to a specified length, adding ellipsis.
 */
export const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '…';
};

/**
 * Count occurrences of items in an array.
 * Returns an object like { "Agriculture": 5, "Skilling": 3 }
 */
export const countOccurrences = (arr) => {
  return arr.reduce((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {});
};

/**
 * Convert a File/Blob to a base64 data URL.
 * Used for photo thumbnails in the UI.
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Get initials from a name (for avatars).
 * e.g., "Priya Sharma" → "PS"
 */
export const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

/**
 * Capitalize the first letter of a string.
 */
export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Get a color class based on sentiment value.
 */
export const getSentimentColor = (sentiment) => {
  switch (sentiment?.toLowerCase()) {
    case 'positive':
      return 'var(--color-sentiment-positive)';
    case 'negative':
      return 'var(--color-sentiment-negative)';
    case 'mixed':
    default:
      return 'var(--color-sentiment-mixed)';
  }
};

/**
 * Get a color for blocker severity.
 */
export const getSeverityColor = (severity) => {
  switch (severity?.toLowerCase()) {
    case 'high':
      return 'var(--color-danger)';
    case 'medium':
      return 'var(--color-warning)';
    case 'low':
      return 'var(--color-accent)';
    default:
      return 'var(--color-text-muted)';
  }
};

/**
 * Format a timestamp to a short 24-hour time string (HH:MM).
 */
export const formatTime = (timestamp) => {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch (e) {
    return '';
  }
};
