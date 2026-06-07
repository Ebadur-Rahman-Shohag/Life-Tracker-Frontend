import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { references as referencesApi } from '../api/client';
import { useProjects } from '../context/ProjectsContext';
import Loader from '../components/Loader';
import ConfirmModal from '../components/ConfirmModal';
import ReferenceFormModal from '../components/ReferenceFormModal';

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

function truncate(text, max = 240) {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

export default function References() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [list, setList] = useState([]);
  const { allProjects: projects, allProjectsLoaded, fetchAllProjects } = useProjects();
  const [initialLoad, setInitialLoad] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [projectFilterId, setProjectFilterId] = useState('');
  const [favoriteFilter, setFavoriteFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updatedAt');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const loadSeqRef = useRef(0);
  const isFirstLoadRef = useRef(true);

  const listParams = useMemo(() => {
    const p = { sort: sortBy };
    const q = debouncedSearch.trim();
    if (q) p.q = q;
    const tag = tagFilter.trim();
    if (tag) p.tag = tag;
    if (projectFilterId) p.projectId = projectFilterId;
    if (favoriteFilter === 'true') p.favorite = 'true';
    if (favoriteFilter === 'false') p.favorite = 'false';
    return p;
  }, [debouncedSearch, tagFilter, projectFilterId, favoriteFilter, sortBy]);

  const hasActiveFilters = Boolean(
    debouncedSearch.trim() || tagFilter.trim() || projectFilterId || favoriteFilter !== 'all'
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (!allProjectsLoaded) {
      fetchAllProjects();
    }
  }, [allProjectsLoaded, fetchAllProjects]);

  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    const isFirst = isFirstLoadRef.current;
    setError(null);
    if (!isFirst) setListLoading(true);
    try {
      const { data } = await referencesApi.list(listParams);
      if (seq !== loadSeqRef.current) return;
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      setError(e.response?.data?.message || e.message || 'Failed to load references');
    } finally {
      if (seq !== loadSeqRef.current) return;
      isFirstLoadRef.current = false;
      setInitialLoad(false);
      setListLoading(false);
    }
  }, [listParams]);

  useEffect(() => {
    load();
  }, [load]);

  const openEditModal = useCallback((ref) => {
    setEditing(ref);
    setModalOpen(true);
  }, []);

  const editIdFromQuery = searchParams.get('edit');
  const deepLinkInFlight = useRef(false);
  useEffect(() => {
    if (!editIdFromQuery) return;
    if (initialLoad) return;
    if (deepLinkInFlight.current) return;
    let cancelled = false;
    deepLinkInFlight.current = true;
    (async () => {
      try {
        let ref = list.find((r) => r._id === editIdFromQuery);
        if (!ref) {
          try {
            const { data } = await referencesApi.get(editIdFromQuery);
            ref = data;
          } catch {
            if (!cancelled) {
              setError('Reference not found.');
              setSearchParams(
                (p) => {
                  const next = new URLSearchParams(p);
                  next.delete('edit');
                  return next;
                },
                { replace: true }
              );
            }
            return;
          }
        }
        if (cancelled || !ref) return;
        openEditModal(ref);
        setSearchParams(
          (p) => {
            const next = new URLSearchParams(p);
            next.delete('edit');
            return next;
          },
          { replace: true }
        );
      } finally {
        deepLinkInFlight.current = false;
      }
    })();
    return () => {
      cancelled = true;
      deepLinkInFlight.current = false;
    };
  }, [editIdFromQuery, initialLoad, list, openEditModal, setSearchParams]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(ref) {
    openEditModal(ref);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function handleDeleteConfirmed() {
    if (!confirmDelete) return;
    const deleted = confirmDelete;
    try {
      await referencesApi.delete(deleted._id);
      setConfirmDelete(null);
      setList((prev) => prev.filter((r) => r._id !== deleted._id));
    } catch {
      setConfirmDelete(null);
      setError('Failed to delete reference. Please try again.');
      await load();
    }
  }

  async function handleToggleFavorite(ref) {
    const previous = ref.isFavorite;
    setList((prev) =>
      prev.map((r) => (r._id === ref._id ? { ...r, isFavorite: !r.isFavorite } : r))
    );
    try {
      await referencesApi.update(ref._id, { isFavorite: !previous });
    } catch {
      setList((prev) =>
        prev.map((r) => (r._id === ref._id ? { ...r, isFavorite: previous } : r))
      );
      setError('Failed to update favorite.');
    }
  }

  function handleTagClick(tag) {
    setTagFilter(tag);
  }

  if (initialLoad) {
    return <Loader message="Loading references…" />;
  }

  function renderEmptyState() {
    if (error && list.length === 0) {
      return (
        <div className="text-center py-16 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
          <p className="text-slate-600 mb-2">Could not load references.</p>
          <p className="text-sm text-slate-500">Check the message above and try again.</p>
        </div>
      );
    }
    if (hasActiveFilters) {
      return (
        <div className="text-center py-16 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
          <p className="text-slate-600 mb-2">No references match your filters.</p>
          <p className="text-sm text-slate-500 mb-4">Try adjusting your search or filters.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setDebouncedSearch('');
              setTagFilter('');
              setProjectFilterId('');
              setFavoriteFilter('all');
            }}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium"
          >
            Clear filters
          </button>
        </div>
      );
    }
    return (
      <div className="text-center py-16 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
        <p className="text-slate-600 mb-2">No references yet. Add a link, short summary, or optional URL.</p>
        <p className="text-sm text-slate-500 mb-4 max-w-md mx-auto">
          Link items to one or more projects to see them in the{' '}
          <strong className="font-medium text-slate-600">Connected References</strong> section on each project page.
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
        >
          Add reference
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">References</h1>
          <p className="text-sm text-slate-600 mt-1">Save links, notes, and sources in one place.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="shrink-0 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
        >
          Add reference
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>
      )}

      <div className="mb-4 flex flex-col sm:flex-row gap-3 flex-wrap">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search title, description, URL, or tags…"
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none"
        />
        <input
          type="text"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          placeholder="Filter by tag"
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm w-full sm:w-40"
        />
        <select
          value={favoriteFilter}
          onChange={(e) => setFavoriteFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
        >
          <option value="all">All</option>
          <option value="true">Favorites</option>
          <option value="false">Not favorites</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
        >
          <option value="updatedAt">Newest updated</option>
          <option value="createdAt">Newest created</option>
        </select>
        <select
          value={projectFilterId}
          onChange={(e) => setProjectFilterId(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white min-w-[10rem]"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {listLoading && (
        <p className="text-sm text-slate-500 mb-3" aria-live="polite">
          Updating…
        </p>
      )}

      {list.length === 0 ? (
        renderEmptyState()
      ) : (
        <ul className={`space-y-3 transition-opacity ${listLoading ? 'opacity-60' : ''}`}>
          {list.map((ref) => (
            <li key={ref._id}>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-slate-800 break-words">{ref.title}</h2>
                    {ref.url ? (
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-emerald-700 hover:underline break-all inline-block mt-1"
                      >
                        {ref.url}
                      </a>
                    ) : null}
                    <p className="text-xs text-slate-500 mt-1">{formatTimestamp(ref.updatedAt || ref.createdAt)}</p>
                    {ref.description ? (
                      <p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap break-words">
                        {truncate(ref.description, 400)}
                      </p>
                    ) : null}
                    {ref.projectIds && ref.projectIds.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap mt-3">
                        {ref.projectIds.map((pid) => {
                          const id = typeof pid === 'string' ? pid : pid?._id;
                          const project = projects.find((p) => p._id === id);
                          return (
                            <Link
                              key={id}
                              to={`/tasks/projects/${id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                            >
                              <span>📁</span>
                              <span className="max-w-[140px] truncate">{project?.name || 'Project'}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                    {ref.tags && ref.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {ref.tags.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => handleTagClick(t)}
                            className="inline-flex px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(ref)}
                      aria-pressed={!!ref.isFavorite}
                      aria-label={ref.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      className={`px-2 py-1 rounded-lg text-sm border transition-colors ${
                        ref.isFavorite
                          ? 'bg-amber-50 border-amber-200 text-amber-700'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      ★
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(ref)}
                      className="text-sm text-slate-500 hover:text-emerald-700 px-2 py-1 rounded-lg hover:bg-emerald-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(ref)}
                      className="text-sm text-slate-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ReferenceFormModal
        key={editing?._id || 'create'}
        open={modalOpen}
        onClose={closeModal}
        mode={editing ? 'edit' : 'create'}
        initialReference={editing}
        projects={projects}
        onSuccess={load}
      />

      <ConfirmModal
        open={!!confirmDelete}
        title="Delete reference?"
        message={confirmDelete ? `Remove “${confirmDelete.title}”? This cannot be undone.` : ''}
        confirmText="Delete"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmDelete(null)}
        variant="danger"
      />
    </div>
  );
}
