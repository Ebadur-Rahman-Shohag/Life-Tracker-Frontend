export function sortTasks(tasks) {
  return [...tasks].sort(
    (a, b) => (a.order || 0) - (b.order || 0) || new Date(a.createdAt) - new Date(b.createdAt)
  );
}

/** Move one item to a 1-based position within an ordered list. Returns new array or null if unchanged. */
export function reorderListToPosition(items, itemId, position) {
  const idx = items.findIndex((item) => String(item._id) === String(itemId));
  if (idx < 0) return null;
  const targetIdx = Math.min(Math.max(Math.round(position), 1), items.length) - 1;
  if (targetIdx === idx) return null;
  const reordered = [...items];
  const [item] = reordered.splice(idx, 1);
  reordered.splice(targetIdx, 0, item);
  return reordered;
}
