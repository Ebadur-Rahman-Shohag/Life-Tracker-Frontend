export const PRAYER_CATEGORIES = [
  { id: 'fajr', label: 'Fajr (Dawn)' },
  { id: 'zuhr', label: 'Zuhr (Midday)' },
  { id: 'asr', label: 'Asr (Afternoon)' },
  { id: 'maghrib', label: 'Maghrib (Sunset)' },
  { id: 'isha', label: 'Isha (Night)' },
];

export const LIFE_CATEGORIES = [
  { id: 'work', label: 'Work' },
  { id: 'learning', label: 'Learning' },
  { id: 'habit', label: 'Habit' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'exercise', label: 'Exercise' },
  { id: 'family', label: 'Family time' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'reading', label: 'Book reading' },
  { id: 'expenses', label: 'Money expenses' },
  { id: 'water', label: 'Water intake' },
  { id: 'mood', label: 'Mood' },
  { id: 'income', label: 'Income' },
  { id: 'meditation', label: 'Meditation' },
  { id: 'social', label: 'Social / Friends' },
  { id: 'notes', label: 'Daily notes' },
];

export const ALL_CATEGORIES = [...PRAYER_CATEGORIES, ...LIFE_CATEGORIES];

export const CATEGORY_UNITS = {
  sleep: 'hr',
  work: 'min',
  learning: 'min',
  exercise: 'min',
  family: 'min',
  entertainment: 'min',
  reading: 'min',
  meditation: 'min',
  social: 'min',
  water: 'glasses',
  expenses: 'currency',
  income: 'currency',
  mood: '1-5',
  fajr: 'prayed',
  zuhr: 'prayed',
  asr: 'prayed',
  maghrib: 'prayed',
  isha: 'prayed',
};
