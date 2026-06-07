import { useCallback, useEffect, useRef, useState } from 'react';
import { references as referencesApi } from '../api/client';
import ProjectSelector from './ProjectSelector';

function parseTagsString(s) {
  if (!s || typeof s !== 'string') return [];
  return s
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function tagsToString(tags) {
  if (!Array.isArray(tags)) return '';
  return tags.filter(Boolean).join(', ');
}

const emptyForm = {
  title: '',
  url: '',
  description: '',
  tags: '',
  isFavorite: false,
};

function normalizeId(id) {
  if (id == null) return '';
  return typeof id === 'string' ? id : String(id._id || id);
}

function normalizeUrl(url) {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const EMPTY_DEFAULT_PROJECTS = [];

/**
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {'create'|'edit'} props.mode
 * @param {object|null} [props.initialReference]
 * @param {string[]} [props.defaultProjectIds]
 * @param {Array<{_id: string, name: string}>} props.projects — for chip labels
 * @param {() => void | Promise<void>} [props.onSuccess] — after successful save (parent can refetch)
 */
export default function ReferenceFormModal({
  open,
  onClose,
  mode = 'create',
  initialReference = null,
  defaultProjectIds = EMPTY_DEFAULT_PROJECTS,
  projects = [],
  onSuccess,
}) {
  const [form, setForm] = useState(emptyForm);
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const selectorRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const prevOpen = useRef(false);

  const resetForOpen = useCallback(() => {
    if (mode === 'edit' && initialReference) {
      setForm({
        title: initialReference.title || '',
        url: initialReference.url || '',
        description: initialReference.description || '',
        tags: tagsToString(initialReference.tags),
        isFavorite: Boolean(initialReference.isFavorite),
      });
      setSelectedProjectIds(
        (initialReference.projectIds || []).map((id) => normalizeId(id)).filter(Boolean)
      );
    } else {
      setForm(emptyForm);
      setSelectedProjectIds((defaultProjectIds || []).map((id) => normalizeId(id)).filter(Boolean));
    }
    setFormError(null);
    setShowProjectSelector(false);
  }, [mode, initialReference, defaultProjectIds]);

  useEffect(() => {
    if (open && !prevOpen.current) {
      resetForOpen();
    }
    prevOpen.current = open;
  }, [open, resetForOpen]);

  useEffect(() => {
    if (!open) return;
    function handleEscape(event) {
      if (event.key === 'Escape' && !saving) onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, saving, onClose]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event) {
      if (selectorRef.current && !selectorRef.current.contains(event.target)) {
        setShowProjectSelector(false);
      }
    }
    if (showProjectSelector) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, showProjectSelector]);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    const title = form.title.trim();
    if (!title) {
      setFormError('Title is required');
      return;
    }
    const payload = {
      title,
      url: normalizeUrl(form.url),
      description: form.description != null ? String(form.description) : '',
      tags: parseTagsString(form.tags),
      isFavorite: form.isFavorite,
      projectIds: selectedProjectIds,
    };
    setSaving(true);
    try {
      if (mode === 'edit' && initialReference?._id) {
        await referencesApi.update(initialReference._id, payload);
      } else {
        await referencesApi.create(payload);
      }
      if (onSuccess) {
        await onSuccess();
      }
      onClose();
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.msg || err.response?.data?.message || err.message;
      setFormError(msg || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const isEdit = mode === 'edit';

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={() => !saving && onClose()} />
      <div
        className="relative bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reference-form-title"
      >
        <h2 id="reference-form-title" className="text-lg font-semibold text-slate-800 mb-4">
          {isEdit ? 'Edit reference' : 'New reference'}
        </h2>
        {formError && <p className="text-sm text-red-600 mb-3">{formError}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
              maxLength={500}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">URL (optional)</label>
            <input
              type="text"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="https://…"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm resize-y min-h-[100px]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="e.g. reading, work"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Projects (optional)</label>
            <div className="relative" ref={selectorRef}>
              <button
                type="button"
                onClick={() => setShowProjectSelector(!showProjectSelector)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-800 bg-white hover:bg-slate-50"
              >
                {selectedProjectIds.length === 0
                  ? 'Select projects…'
                  : `${selectedProjectIds.length} project${selectedProjectIds.length !== 1 ? 's' : ''} selected`}
              </button>
              {showProjectSelector && (
                <div className="absolute z-10 w-full mt-1">
                  <ProjectSelector
                    selected={selectedProjectIds}
                    onChange={setSelectedProjectIds}
                    onClose={() => setShowProjectSelector(false)}
                    projects={projects}
                  />
                </div>
              )}
            </div>
            {selectedProjectIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedProjectIds.map((projectId) => {
                  const project = projects.find(
                    (p) => String(p._id) === String(projectId)
                  );
                  return (
                    <span
                      key={projectId}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-emerald-50 text-emerald-700 border border-emerald-200"
                    >
                      {project?.name || projectId}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedProjectIds(selectedProjectIds.filter((id) => id !== projectId))
                        }
                        className="text-emerald-600 hover:text-emerald-800"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isFavorite}
              onChange={(e) => setForm((f) => ({ ...f, isFavorite: e.target.checked }))}
              className="rounded border-slate-300"
            />
            Favorite
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
