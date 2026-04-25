/**
 * Shared data helpers for NoteForm: category list + optional API loader with default category seeding.
 * Used by Notes and ProjectDetail.
 */

const DEFAULT_CATEGORIES = [
  { name: 'Ideas', icon: '💡', color: '#f59e0b' },
  { name: 'Personal', icon: '🏠', color: '#10b981' },
  { name: 'Reading', icon: '📚', color: '#3b82f6' },
  { name: 'Work', icon: '💼', color: '#8b5cf6' },
];

export function buildCategoryList(managedCategories, stats) {
  const managedNames = (managedCategories || []).map((c) => c.name).filter(Boolean);
  const fromStats = (stats?.categories || [])
    .map((c) => (typeof c === 'string' ? c : c.name))
    .filter(Boolean);
  const unique = new Set(['All', ...managedNames, ...fromStats]);
  return Array.from(unique);
}

/**
 * Fetches active categories, seeding defaults when the user has none.
 * @param {object} notesApi - API namespace from `../api/client` (notes)
 * @returns {Promise<Array>} managed category documents
 */
export async function loadManagedCategoriesWithSeeding(notesApi) {
  const res = await notesApi.getCategories({ activeOnly: 'true' });
  let cats = res.data || [];

  if (cats.length === 0) {
    for (const cat of DEFAULT_CATEGORIES) {
      try {
        const existing = cats.find((c) => c.name.toLowerCase() === cat.name.toLowerCase());
        if (!existing) {
          await notesApi.createCategory(cat);
        }
      } catch (err) {
        if (err.response?.status !== 400) {
          console.error('Error creating default category:', err);
        }
      }
    }
    const reloadRes = await notesApi.getCategories({ activeOnly: 'true' });
    cats = reloadRes.data || [];
  }

  return cats;
}

/**
 * Stats + managed categories in parallel (for project page NoteForm first open).
 * @param {object} notesApi
 * @returns {Promise<{ stats: object, managedCategories: Array }>}
 */
export async function fetchNoteFormCatalog(notesApi) {
  const [statsRes, managedCategories] = await Promise.all([
    notesApi.stats(),
    loadManagedCategoriesWithSeeding(notesApi),
  ]);
  return {
    stats: statsRes.data,
    managedCategories,
  };
}
