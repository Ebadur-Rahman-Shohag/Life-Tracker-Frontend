export function sortTasks(tasks) {
  return [...tasks].sort(
    (a, b) => (a.order || 0) - (b.order || 0) || new Date(a.createdAt) - new Date(b.createdAt)
  );
}
