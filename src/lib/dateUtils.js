// ============ DATE FORMATTING FUNCTIONS ============

export function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
}

export function formatDateFull(date) {
    return new Date(date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
}

// ============ DATE CALCULATION FUNCTIONS ============

export function getWeekDates(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    const dates = [];
    for (let i = 0; i < 7; i++) {
        const newDate = new Date(monday);
        newDate.setDate(monday.getDate() + i);
        dates.push(newDate);
    }
    return dates;
}

export function getMonthDates(year, month) {
    const dates = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d));
    }
    return dates;
}

export function toISODateString(date) {
    const d = new Date(date);
    // Use local date parts to avoid timezone conversion issues
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get today's date with time set to 00:00:00.000
 * Useful for date comparisons
 */
export function getTodayDate() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
}

// ============ CONSTANTS ============

export const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

// ============ CONFIGURATION CONSTANTS ============

export const DEBOUNCE_DELAY_MS = 300;
export const STREAK_THRESHOLD_PERCENTAGE = 75;
