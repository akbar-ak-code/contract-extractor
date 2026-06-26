export const parseAiDate = (dateString) => {
  if (!dateString || dateString === "not_found") return null;
  const match = dateString.match(/(\d{2})[\.\-\/](\d{2})[\.\-\/](\d{4})/);
  if (match) return new Date(match[3], match[2] - 1, match[1]);
  
  const cleanedDateStr = dateString.replace(/\b(\d+)(st|nd|rd|th)\b/gi, '$1');
  const poDate = new Date(cleanedDateStr);
  return isNaN(poDate) ? null : poDate;
};

export const getDaysLeft = (targetDate) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
};

export const getDeadlineColor = (daysLeft) => {
  if (daysLeft < 0) return '#ef4444'; // Red (Expired)
  if (daysLeft <= 90) return '#f59e0b'; // Amber (Expiring Soon)
  return '#10b981'; // Green (Safe, > 90 days)
};