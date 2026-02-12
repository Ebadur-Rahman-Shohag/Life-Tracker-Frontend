import { useCallback, useEffect, useMemo, useState } from 'react';
import { notes as notesApi } from '../api/client';
import NoteForm from '../components/NoteForm';
import NoteCategoryForm from '../components/NoteCategoryForm';
import NoteDetailView from '../components/NoteDetailView';

function formatTimestamp(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function truncate(text, max = 200) {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

function buildCategoryList(managedCategories, stats) {
  const managedNames = (managedCategories || []).map((c) => c.name).filter(Boolean);
  const fromStats = (stats?.categories || [])
    .map((c) => (typeof c === 'string' ? c : c.name))
    .filter(Boolean);
  const unique = new Set(['All', ...managedNames, ...fromStats]);
  return Array.from(unique);
}

function countForCategory(stats, category) {
  if (!stats) return null;
  if (category === 'All') return stats.totalActive ?? null;
  const match = (stats.categories || []).find((c) => {
    const name = typeof c === 'string' ? c : c.name;
    return name === category;
  });
  return match ? (typeof match === 'object' ? match.count : 0) : 0;
}

function getCategoryIcon(managedCategories, categoryName) {
  if (!managedCategories) return null;
  const cat = managedCategories.find((c) => c.name === categoryName);
  return cat?.icon || null;
}

function getCategoryColor(managedCategories, categoryName) {
  if (!managedCategories) return null;
  const cat = managedCategories.find((c) => c.name === categoryName);
  return cat?.color || null;
}

function NoteCard({ note, onView, onEdit, onDelete, onToggleFavorite, onToggleArchive }) {
  return (
    <div
      className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col cursor-pointer"
      onClick={() => onView(note)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-800 truncate">{note.title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{formatTimestamp(note.updatedAt || note.createdAt)}</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(note);
          }}
          className={`shrink-0 px-2 py-1 rounded-lg text-sm border transition-colors ${
            note.isFavorite
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
          }`}
          title={note.isFavorite ? 'Unfavorite' : 'Favorite'}
        >
          ★
        </button>
      </div>

      {(() => {
        // Generate preview text from content
        let previewText = '';
        if (note.blocks && typeof note.blocks === 'object' && note.blocks.type === 'doc') {
          // Extract text from TipTap JSON document
          const extractText = (node) => {
            if (typeof node === 'string') return node;
            if (node.text) return node.text;
            if (node.content && Array.isArray(node.content)) {
              return node.content.map(extractText).join(' ');
            }
            return '';
          };
          previewText = extractText(note.blocks);
        } else if (note.content) {
          previewText = note.content;
        }
        return previewText ? (
          <p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap break-words">{truncate(previewText, 240)}</p>
        ) : (
          <p className="text-sm text-slate-400 mt-3 italic">No content</p>
        );
      })()}

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-700">
          {note.category || 'Uncategorized'}
        </span>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onEdit(note)}
            className="text-sm text-slate-500 hover:text-emerald-700 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onToggleArchive(note)}
            className="text-sm text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            {note.archived ? 'Unarchive' : 'Archive'}
          </button>
          <button
            onClick={() => onDelete(note)}
            className="text-sm text-slate-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Notes() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [stats, setStats] = useState(null);
  const [notes, setNotes] = useState([]);
  const [managedCategories, setManagedCategories] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [mode, setMode] = useState('gallery'); // gallery | favorites | archived
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [detailViewOpen, setDetailViewOpen] = useState(false);
  const [viewingNote, setViewingNote] = useState(null);

  const categories = useMemo(() => buildCategoryList(managedCategories, stats), [managedCategories, stats]);

  const loadStats = useCallback(async () => {
    const res = await notesApi.stats();
    setStats(res.data);
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const res = await notesApi.getCategories({ activeOnly: 'true' });
      let cats = res.data || [];

      // Initialize default categories if none exist
      if (cats.length === 0) {
        const defaultCategories = [
          { name: 'Ideas', icon: '💡', color: '#f59e0b' },
          { name: 'Personal', icon: '🏠', color: '#10b981' },
          { name: 'Reading', icon: '📚', color: '#3b82f6' },
          { name: 'Work', icon: '💼', color: '#8b5cf6' },
        ];

        // Create default categories one by one
        for (const cat of defaultCategories) {
          try {
            const existing = cats.find((c) => c.name.toLowerCase() === cat.name.toLowerCase());
            if (!existing) {
              await notesApi.createCategory(cat);
            }
          } catch (err) {
            // Ignore duplicate errors
            if (err.response?.status !== 400) {
              console.error('Error creating default category:', err);
            }
          }
        }

        // Reload categories after creating defaults
        const reloadRes = await notesApi.getCategories({ activeOnly: 'true' });
        cats = reloadRes.data || [];
      }

      setManagedCategories(cats);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }, []);

  const loadNotes = useCallback(async (opts = {}) => {
    const effectiveSearch = (opts.search ?? '').trim();
    const params = {
      archived: mode === 'archived' ? 'true' : 'false',
      favoriteOnly: mode === 'favorites' ? 'true' : 'false',
      category: selectedCategory,
      search: effectiveSearch || undefined,
    };
    const res = await notesApi.list(params);
    setNotes(res.data || []);
  }, [mode, selectedCategory]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([loadStats(), loadCategories(), loadNotes({ search })]);
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError('Failed to load notes.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [loadNotes, loadStats, loadCategories]);

  // Debounced search refresh (prevents request on every keystroke)
  useEffect(() => {
    const t = setTimeout(() => {
      loadNotes({ search });
    }, 300);
    return () => clearTimeout(t);
  }, [search, loadNotes]);

  function openNewNote() {
    const categoryPrefill =
      selectedCategory && selectedCategory !== 'All' ? selectedCategory : 'Uncategorized';
    setEditingNote({ title: '', content: '', category: categoryPrefill, isFavorite: false, tags: [] });
    setFormOpen(true);
  }

  function openDetailView(note) {
    setViewingNote(note);
    setDetailViewOpen(true);
  }

  function closeDetailView() {
    setDetailViewOpen(false);
    setViewingNote(null);
  }

  function openEditNote(note) {
    setEditingNote(note);
    setFormOpen(true);
    closeDetailView(); // Close detail view when opening edit
  }

  function closeForm() {
    setFormOpen(false);
    setEditingNote(null);
  }

  async function handleSave(payload) {
    try {
      if (editingNote?._id) {
        await notesApi.update(editingNote._id, payload);
      } else {
        await notesApi.create(payload);
      }
      closeForm();
      await Promise.all([loadStats(), loadNotes({ search })]);
    } catch (err) {
      console.error(err);
      setError('Failed to save note. Please try again.');
    }
  }

  async function handleDelete(note) {
    if (!confirm('Delete this note?')) return;
    try {
      await notesApi.delete(note._id);
      await Promise.all([loadStats(), loadNotes({ search })]);
      closeDetailView(); // Close detail view if open
    } catch (err) {
      console.error(err);
      setError('Failed to delete note. Please try again.');
    }
  }

  async function handleToggleFavorite(note) {
    try {
      await notesApi.toggleFavorite(note._id);
      await Promise.all([loadStats(), loadNotes({ search })]);
    } catch (err) {
      console.error(err);
      setError('Failed to update favorite.');
    }
  }

  async function handleToggleArchive(note) {
    try {
      await notesApi.toggleArchive(note._id);
      await Promise.all([loadStats(), loadNotes({ search })]);
    } catch (err) {
      console.error(err);
      setError('Failed to update archive.');
    }
  }

  function openNewCategory() {
    setEditingCategory(null);
    setCategoryFormOpen(true);
  }

  function openEditCategory(category) {
    setEditingCategory(category);
    setCategoryFormOpen(true);
  }

  function closeCategoryForm() {
    setCategoryFormOpen(false);
    setEditingCategory(null);
  }

  async function handleCategorySubmit(categoryData) {
    try {
      if (editingCategory) {
        await notesApi.updateCategory(editingCategory._id, categoryData);
      } else {
        await notesApi.createCategory(categoryData);
      }
      closeCategoryForm();
      await loadCategories();
      await loadStats();
    } catch (err) {
      console.error(err);
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.msg ||
        'Failed to save category. Please try again.';
      setError(errorMessage);
    }
  }

  async function handleDeleteCategory(id) {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      await notesApi.deleteCategory(id);
      await loadCategories();
      await loadStats();
    } catch (err) {
      console.error(err);
      setError('Failed to delete category. Please try again.');
    }
  }

  const sidebarItems = useMemo(() => {
    return [
      ...categories.map((c) => ({
        id: `cat:${c}`,
        label: c,
        count: countForCategory(stats, c),
        icon: getCategoryIcon(managedCategories, c),
        color: getCategoryColor(managedCategories, c),
      })),
      { id: 'favorites', label: 'Favorites', count: stats?.favorites ?? null },
      { id: 'archived', label: 'Archive', count: stats?.archived ?? null },
    ];
  }, [categories, stats, managedCategories]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[200px] text-slate-500">Loading…</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 font-medium">
            ×
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Notes</h1>
          <p className="text-sm text-slate-500">Capture ideas, plans, and quick thoughts.</p>
        </div>
        <button
          onClick={openNewNote}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700"
        >
          + New Note
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        <aside className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 h-fit">
          <div className="px-2 pb-2 flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-700">Categories</h2>
            <button
              onClick={openNewCategory}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              title="Manage Categories"
            >
              + Add
            </button>
          </div>

          <div className="space-y-1">
            {sidebarItems.map((item) => {
              const isCategory = item.id.startsWith('cat:');
              const label = item.label;

              const isActive =
                (isCategory && mode === 'gallery' && selectedCategory === label) ||
                (!isCategory && item.id === mode);

              const isManagedCategory = isCategory && managedCategories.some((c) => c.name === label);

              return (
                <div key={item.id} className="group relative">
                  <button
                    onClick={() => {
                      if (isCategory) {
                        setMode('gallery');
                        setSelectedCategory(label);
                        return;
                      }
                      if (item.id === 'favorites') setMode('favorites');
                      if (item.id === 'archived') setMode('archived');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {item.icon && <span className="text-base shrink-0">{item.icon}</span>}
                      <span className="truncate">{label}</span>
                    </div>
                    {item.count != null && <span className="text-xs text-slate-500 ml-2 shrink-0">{item.count}</span>}
                  </button>
                  {isManagedCategory && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const cat = managedCategories.find((c) => c.name === label);
                        if (cat) openEditCategory(cat);
                      }}
                      className="absolute right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-emerald-600 text-xs px-1"
                      title="Edit category"
                    >
                      ✎
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        <section className="space-y-4 min-w-0">
          <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode('gallery')}
                className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                  mode === 'gallery'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Gallery
              </button>
              <button
                onClick={() => setMode('favorites')}
                className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                  mode === 'favorites'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Favourite
              </button>
              <button
                onClick={() => setMode('archived')}
                className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                  mode === 'archived'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Archive
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes…"
                className="w-full md:w-80 rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
              <button
                onClick={() => loadNotes({ search })}
                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                title="Refresh"
              >
                ↻
              </button>
            </div>
          </div>

          {notes.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-xl border border-slate-200">
              <p className="text-slate-600 mb-2">No notes found.</p>
              <p className="text-sm text-slate-500">Create a note to get started.</p>
              <button
                onClick={openNewNote}
                className="mt-4 bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700"
              >
                + New Note
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {notes.map((note) => (
                <NoteCard
                  key={note._id}
                  note={note}
                  onView={openDetailView}
                  onEdit={openEditNote}
                  onDelete={handleDelete}
                  onToggleFavorite={handleToggleFavorite}
                  onToggleArchive={handleToggleArchive}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <NoteForm
        open={formOpen}
        initialNote={editingNote}
        categories={categories}
        managedCategories={managedCategories}
        onClose={closeForm}
        onSubmit={handleSave}
      />

      <NoteCategoryForm
        open={categoryFormOpen}
        category={editingCategory}
        onClose={closeCategoryForm}
        onSubmit={handleCategorySubmit}
        onDelete={handleDeleteCategory}
      />

      <NoteDetailView
        open={detailViewOpen}
        note={viewingNote}
        managedCategories={managedCategories}
        onClose={closeDetailView}
        onEdit={openEditNote}
        onDelete={handleDelete}
        onToggleFavorite={handleToggleFavorite}
        onToggleArchive={handleToggleArchive}
      />
    </div>
  );
}

