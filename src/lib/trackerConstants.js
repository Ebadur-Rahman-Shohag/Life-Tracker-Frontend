// ============ HABIT TRACKER CONSTANTS ============

export const HABIT_MILESTONES = [30, 50, 75, 100, 150, 200, 250, 300, 365];

// Unique colors for habit identification
export const HABIT_COLORS = [
    { dot: 'bg-red-500', text: 'text-red-500' },
    { dot: 'bg-orange-500', text: 'text-orange-500' },
    { dot: 'bg-amber-500', text: 'text-amber-500' },
    { dot: 'bg-emerald-500', text: 'text-emerald-500' },
    { dot: 'bg-blue-500', text: 'text-blue-500' },
    { dot: 'bg-purple-500', text: 'text-purple-500' },
    { dot: 'bg-pink-500', text: 'text-pink-500' },
    { dot: 'bg-cyan-500', text: 'text-cyan-500' },
    { dot: 'bg-lime-500', text: 'text-lime-500' },
    { dot: 'bg-indigo-500', text: 'text-indigo-500' },
];

// ============ PRAYER TRACKER CONSTANTS ============

export const PRAYER_MILESTONES = [7, 30, 50, 75, 100, 150, 200, 365];

export const TOTAL_DAILY_PRAYERS = 5;

// Progress thresholds for UI color coding
export const PRAYER_PROGRESS_THRESHOLD_AMBER = 60; // Percentage for amber color
export const PRAYER_PROGRESS_THRESHOLD_EMERALD = 100; // Percentage for emerald color (perfect day)
export const PRAYER_SUCCESS_THRESHOLD = 100; // All prayers completed = success day
