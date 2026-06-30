export const parseAiDate = (dateString, effectiveDateStr = null) => {
  if (!dateString || dateString === "not_found") return null;

  // 1. Check if it's already a standard date
  const standardMatch = dateString.match(/(\d{2})[\.\-\/](\d{2})[\.\-\/](\d{4})/);
  if (standardMatch) return new Date(standardMatch[3], standardMatch[2] - 1, standardMatch[1]);

  // 2. 🆕 Handle "Within X weeks/months" logic
  if (dateString.toLowerCase().includes("week") || dateString.toLowerCase().includes("month")) {
      // Get a reference date (Use effective_date if available, else today)
      let baseDate = effectiveDateStr ? parseAiDate(effectiveDateStr) : new Date();
      if (!baseDate) baseDate = new Date();

      const num = parseInt(dateString.match(/\d+/)[0]);
      const newDate = new Date(baseDate);

      if (dateString.toLowerCase().includes("week")) {
          newDate.setDate(baseDate.getDate() + (num * 7));
      } else if (dateString.toLowerCase().includes("month")) {
          newDate.setMonth(baseDate.getMonth() + num);
      }
      return newDate;
  }

  // 3. Fallback for "31st March 2026"
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
