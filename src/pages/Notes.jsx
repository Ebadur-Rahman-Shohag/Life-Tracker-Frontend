import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense, memo } from 'react';
import { notes as notesApi } from '../api/client';
import { useProjects } from '../context/ProjectsContext';
import { buildCategoryList, loadManagedCategoriesWithSeeding } from '../lib/noteFormResources';
import { EMPTY_NOTE_DOC } from '../lib/noteTipTap';
import Loader from '../components/Loader';
import ConfirmModal from '../components/ConfirmModal';

const NoteForm = lazy(() => import('../components/NoteForm'));
const NoteCategoryForm = lazy(() => import('../components/NoteCategoryForm'));
const NoteDetailView = lazy(() => import('../components/NoteDetailView'));

function NoteFormModalShell({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl p-8 flex flex-col items-center gap-3">
        <div
          className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-emerald-600 animate-spin"
          aria-hidden
        />
        <p className="text-sm text-slate-600">Loading editor…</p>
      </div>
    </div>
  );
}

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

function notePreviewText(note) {
  return note.searchText || note.content || '';
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

const NoteCard = memo(function NoteCard({
  note,
  projects = [],
  onView,
  onEdit,
  onDelete,
  onToggleFavorite,
  onToggleArchive,
}) {
  const connectedProjects = useMemo(() => {
    if (!note.projectIds || note.projectIds.length === 0) return [];
    const ids = new Set((note.projectIds || []).map((id) => String(id)));
    return projects.filter((p) => ids.has(String(p._id)));
  }, [note.projectIds, projects]);

  const previewText = notePreviewText(note);

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
          className={`shrink-0 px-2 py-1 rounded-lg text-sm border transition-colors ${note.isFavorite
            ? 'bg-amber-50 border-amber-200 text-amber-700'
            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          title={note.isFavorite ? 'Unfavorite' : 'Favorite'}
        >
          ★
        </button>
      </div>

      {previewText ? (
        <p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap break-words">{truncate(previewText, 240)}</p>
      ) : (
        <p className="text-sm text-slate-400 mt-3 italic">No content</p>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-700">
            {note.category || 'Uncategorized'}
          </span>
          {connectedProjects.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {connectedProjects.slice(0, 2).map((project) => (
                <span
                  key={project._id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200"
                  title={project.name}
                >
                  <span>📁</span>
                  <span className="max-w-[100px] truncate">{project.name}</span>
                </span>
              ))}
              {connectedProjects.length > 2 && (
                <span className="text-xs text-slate-500">+{connectedProjects.length - 2} more</span>
              )}
            </div>
          )}
        </div>
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
});

async function fetchFullNoteIfNeeded(note) {
  if (!note?._id) return note;
  if (note.blocks && typeof note.blocks === 'object' && note.blocks.type === 'doc') {
    return note;
  }
  const { data } = await notesApi.get(note._id);
  return data;
}

export default function Notes() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [stats, setStats] = useState(null);
  const [notes, setNotes] = useState([]);
  const [managedCategories, setManagedCategories] = useState([]);
  const { allProjects: projects, allProjectsLoaded, fetchAllProjects } = useProjects();

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [mode, setMode] = useState('gallery');
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [detailViewOpen, setDetailViewOpen] = useState(false);
  const [viewingNote, setViewingNote] = useState(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);

  const initialLoadDoneRef = useRef(false);
  const skipFilterEffectRef = useRef(true);
  const skipSearchDebounceRef = useRef(true);

  const categories = useMemo(() => buildCategoryList(managedCategories, stats), [managedCategories, stats]);

  const loadStats = useCallback(async () => {
    const res = await notesApi.stats();
    setStats(res.data);
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const cats = await loadManagedCategoriesWithSeeding(notesApi);
      setManagedCategories(cats);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }, []);

  const loadNotes = useCallback(async (opts = {}) => {
    const effectiveSearch = (opts.search ?? search).trim();
    const params = {
      archived: mode === 'archived' ? 'true' : 'false',
      favoriteOnly: mode === 'favorites' ? 'true' : 'false',
      category: selectedCategory,
      search: effectiveSearch || undefined,
      projectId: selectedProjectId || undefined,
    };
    const res = await notesApi.list(params);
    setNotes(res.data || []);
  }, [mode, selectedCategory, selectedProjectId, search]);

  const refreshNotesData = useCallback(() => {
    return Promise.all([loadStats(), loadNotes()]).catch((err) => {
      console.error('Failed to refresh notes:', err);
    });
  }, [loadStats, loadNotes]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([
          loadStats(),
          loadCategories(),
          allProjectsLoaded ? Promise.resolve() : fetchAllProjects(),
          loadNotes({ search }),
        ]);
        if (!cancelled) {
          initialLoadDoneRef.current = true;
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (skipFilterEffectRef.current) {
      skipFilterEffectRef.current = false;
      return;
    }
    if (!initialLoadDoneRef.current) return;
    loadNotes({ search });
  }, [mode, selectedCategory, selectedProjectId, loadNotes, search]);

  useEffect(() => {
    if (skipSearchDebounceRef.current) {
      skipSearchDebounceRef.current = false;
      return;
    }
    if (!initialLoadDoneRef.current) return;
    const t = setTimeout(() => {
      loadNotes({ search });
    }, 300);
    return () => clearTimeout(t);
  }, [search, loadNotes]);

  const openNewNote = useCallback(() => {
    const categoryPrefill =
      selectedCategory && selectedCategory !== 'All' ? selectedCategory : 'Uncategorized';
    setEditingNote({ title: '', blocks: EMPTY_NOTE_DOC, category: categoryPrefill, isFavorite: false, tags: [] });
    setFormOpen(true);
  }, [selectedCategory]);

  const openDetailView = useCallback(async (note) => {
    setNoteLoading(true);
    setDetailViewOpen(true);
    try {
      const full = await fetchFullNoteIfNeeded(note);
      setViewingNote(full);
    } catch (err) {
      console.error('Failed to load note:', err);
      setError('Failed to load note.');
      setDetailViewOpen(false);
    } finally {
      setNoteLoading(false);
    }
  }, []);

  const closeDetailView = useCallback(() => {
    setDetailViewOpen(false);
    setViewingNote(null);
  }, []);

  const openEditNote = useCallback(async (note) => {
    closeDetailView();
    setNoteLoading(true);
    setFormOpen(true);
    try {
      const full = await fetchFullNoteIfNeeded(note);
      setEditingNote(full);
    } catch (err) {
      console.error('Failed to load note:', err);
      setError('Failed to load note for editing.');
      setFormOpen(false);
    } finally {
      setNoteLoading(false);
    }
  }, [closeDetailView]);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingNote(null);
  }, []);

  const handleSave = useCallback(async (payload) => {
    const noteId = editingNote?._id;
    try {
      if (noteId) {
        const { data: saved } = await notesApi.update(noteId, payload);
        setNotes((prev) => prev.map((n) => (n._id === saved._id ? saved : n)));
        if (viewingNote?._id === saved._id) {
          setViewingNote(saved);
        }
      } else {
        const { data: saved } = await notesApi.create(payload);
        setNotes((prev) => [saved, ...prev]);
      }
      closeForm();
      void refreshNotesData();
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.errors?.[0]?.msg ||
        err.response?.data?.message ||
        'Failed to save note. Please try again.';
      setError(msg);
      throw err;
    }
  }, [editingNote, viewingNote, closeForm, refreshNotesData]);

  const handleDelete = useCallback((note) => {
    setConfirmModal({
      open: true,
      title: 'Delete Note',
      message: `Are you sure you want to delete "${note.title}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
      confirmLoading: false,
      onConfirm: async () => {
        const deletedId = note._id;
        setConfirmModal((prev) => (prev ? { ...prev, confirmLoading: true } : null));
        try {
          await notesApi.delete(deletedId);
          closeDetailView();
          setNotes((prev) => prev.filter((n) => n._id !== deletedId));
          void refreshNotesData();
          setConfirmModal(null);
        } catch (err) {
          console.error(err);
          setError('Failed to delete note. Please try again.');
          void loadNotes();
          setConfirmModal((prev) => (prev ? { ...prev, confirmLoading: false } : null));
        }
      },
      onCancel: () => setConfirmModal(null),
    });
  }, [closeDetailView, refreshNotesData, loadNotes]);

  const handleToggleFavorite = useCallback(async (note) => {
    try {
      const nextFav = !note.isFavorite;
      await notesApi.toggleFavorite(note._id);
      if (viewingNote?._id === note._id) {
        if (mode === 'favorites' && !nextFav) {
          setDetailViewOpen(false);
          setViewingNote(null);
        } else {
          setViewingNote((v) => (v ? { ...v, isFavorite: nextFav } : v));
        }
      }
      await Promise.all([loadStats(), loadNotes({ search })]);
    } catch (err) {
      console.error(err);
      setError('Failed to update favorite.');
    }
  }, [viewingNote, mode, loadStats, loadNotes, search]);

  const handleToggleArchive = useCallback(async (note) => {
    try {
      const wasArchived = note.archived;
      await notesApi.toggleArchive(note._id);
      const nowArchived = !wasArchived;
      if (viewingNote?._id === note._id) {
        const shouldClose =
          ((mode === 'gallery' || mode === 'favorites') && !wasArchived && nowArchived) ||
          (mode === 'archived' && wasArchived && !nowArchived);
        if (shouldClose) {
          setDetailViewOpen(false);
          setViewingNote(null);
        } else {
          setViewingNote((v) => (v ? { ...v, archived: nowArchived } : v));
        }
      }
      await Promise.all([loadStats(), loadNotes({ search })]);
    } catch (err) {
      console.error(err);
      setError('Failed to update archive.');
    }
  }, [viewingNote, mode, loadStats, loadNotes, search]);

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

  function handleDeleteCategory(id) {
    const category = managedCategories.find((c) => c._id === id);
    setConfirmModal({
      open: true,
      title: 'Delete Category',
      message: `Are you sure you want to delete "${category?.name || 'this category'}"? Notes using this category will keep it, but you won't be able to use it for new notes.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
      confirmLoading: false,
      onConfirm: async () => {
        setConfirmModal((prev) => (prev ? { ...prev, confirmLoading: true } : null));
        try {
          await notesApi.deleteCategory(id);
          await loadCategories();
          await loadStats();
          setConfirmModal(null);
        } catch (err) {
          console.error(err);
          setError('Failed to delete category. Please try again.');
          setConfirmModal((prev) => (prev ? { ...prev, confirmLoading: false } : null));
        }
      },
      onCancel: () => setConfirmModal(null),
    });
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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader message="Loading notes..." />
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 font-medium">
            ×
          </button>
        </div>
      )}
      {!loading && (
        <>
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
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
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
                className={`px-3 py-2 rounded-lg text-sm font-medium border ${mode === 'gallery'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
              >
                Gallery
              </button>
              <button
                onClick={() => setMode('favorites')}
                className={`px-3 py-2 rounded-lg text-sm font-medium border ${mode === 'favorites'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
              >
                Favourite
              </button>
              <button
                onClick={() => setMode('archived')}
                className={`px-3 py-2 rounded-lg text-sm font-medium border ${mode === 'archived'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
              >
                Archive
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              >
                <option value="">All Projects</option>
                {projects
                  .filter((p) => !p.archived)
                  .map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.name}
                    </option>
                  ))}
              </select>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes…"
                className="flex-1 min-w-[160px] md:w-80 rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
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
                  projects={projects}
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

      {noteLoading && <NoteFormModalShell open onClose={() => {}} />}

      {formOpen && (
        <Suspense fallback={<NoteFormModalShell open onClose={closeForm} />}>
          <NoteForm
            open={formOpen}
            initialNote={editingNote}
            categories={categories}
            managedCategories={managedCategories}
            projects={projects}
            onClose={closeForm}
            onSubmit={handleSave}
          />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <NoteCategoryForm
          open={categoryFormOpen}
          category={editingCategory}
          onClose={closeCategoryForm}
          onSubmit={handleCategorySubmit}
          onDelete={handleDeleteCategory}
        />

        <NoteDetailView
          open={detailViewOpen && !noteLoading}
          note={viewingNote}
          managedCategories={managedCategories}
          onClose={closeDetailView}
          onEdit={openEditNote}
          onDelete={handleDelete}
          onToggleFavorite={handleToggleFavorite}
          onToggleArchive={handleToggleArchive}
        />
      </Suspense>

      {confirmModal && (
        <ConfirmModal
          open={confirmModal.open}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          cancelText={confirmModal.cancelText}
          variant={confirmModal.variant}
          onConfirm={confirmModal.onConfirm}
          onCancel={confirmModal.onCancel}
          confirmLoading={confirmModal.confirmLoading}
        />
      )}
        </>
      )}
    </div>
  );
}
