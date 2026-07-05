/**
 * Module-level cache so prayer tracker data survives route changes.
 * Cleared only on full page refresh.
 */
let cache = {
  dailyStats: [],
  streakStats: null,
  monthlyStats: null,
  dailyStatsKey: '',
  monthlyStatsYear: null,
};

export function getPrayerCache() {
  return cache;
}

export function updatePrayerCache(partial) {
  cache = { ...cache, ...partial };
}

export function buildPrayerCacheKey(view, startDate, endDate, year) {
  if (view === 'year') return `year:${year}`;
  return `${view}:${startDate}:${endDate}`;
}

export function hasPrayerCacheForView(view, cacheKey, year) {
  if (view === 'year') {
    return cache.monthlyStatsYear === year && cache.monthlyStats != null;
  }
  return cache.dailyStatsKey === cacheKey && cache.dailyStats.length > 0;
}
