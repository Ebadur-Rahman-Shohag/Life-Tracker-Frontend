import { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BlockRenderer from './BlockRenderer';
import { projects as projectsApi } from '../api/client';
import ConfirmModal from './ConfirmModal';

function formatTimestamp(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

// Convert plain text to TipTap JSON for rendering
function textToTipTapJSON(text) {
  if (!text || !text.trim()) {
    return null;
  }
  const lines = text.split('\n').filter((line) => line.trim() || line === '');
  const content = lines.map((line) => ({
    type: 'paragraph',
    content: line.trim() ? [{ type: 'text', text: line }] : [],
  }));
  return {
    type: 'doc',
    content: content.length > 0 ? content : [{ type: 'paragraph' }],
  };
}

export default function NoteDetailView({ open, note, managedCategories = [], onClose, onEdit, onDelete, onToggleFavorite, onToggleArchive }) {
  const navigate = useNavigate();
  const [connectedProjects, setConnectedProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);

  const categoryInfo = useMemo(() => {
    if (!managedCategories || !note?.category) return null;
    return managedCategories.find((c) => c.name === note.category);
  }, [managedCategories, note?.category]);

  useEffect(() => {
    async function loadProjects() {
      if (!note?.projectIds || note.projectIds.length === 0) {
        setConnectedProjects([]);
        return;
      }
      setLoadingProjects(true);
      try {
        const { data } = await projectsApi.list({ includeArchived: true });
        const projects = (data || []).filter((p) => note.projectIds.includes(p._id));
        
        // Build project paths with parent chain
        const projectsWithPath = projects.map((project) => {
          let path = project.name;
          let current = project;
          const visited = new Set([project._id]);
          
          // Build parent chain
          while (current.parentId && !visited.has(current.parentId)) {
            visited.add(current.parentId);
            const parent = data.find((p) => p._id === current.parentId);
            if (parent) {
              path = `${parent.name} > ${path}`;
              current = parent;
            } else {
              break;
            }
          }
          return { ...project, path };
        });
        
        setConnectedProjects(projectsWithPath);
      } catch (err) {
        console.error('Failed to load projects:', err);
      } finally {
        setLoadingProjects(false);
      }
    }
    if (open && note) {
      loadProjects();
    }
  }, [open, note]);

  if (!open || !note) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-slate-800 truncate">{note.title}</h2>
              <button
                onClick={() => onToggleFavorite(note)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  note.isFavorite
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
                title={note.isFavorite ? 'Unfavorite' : 'Favorite'}
              >
                ★ {note.isFavorite ? 'Favorited' : 'Favorite'}
              </button>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {categoryInfo ? (
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: `${categoryInfo.color}15`,
                    color: categoryInfo.color,
                    borderColor: `${categoryInfo.color}40`,
                    borderWidth: '1px',
                  }}
                >
                  {categoryInfo.icon && <span>{categoryInfo.icon}</span>}
                  <span>{note.category}</span>
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-slate-100 text-slate-700">
                  {note.category || 'Uncategorized'}
                </span>
              )}
              <span className="text-xs text-slate-500">
                Created: {formatTimestamp(note.createdAt)}
              </span>
              {note.updatedAt && note.updatedAt !== note.createdAt && (
                <span className="text-xs text-slate-500">
                  Updated: {formatTimestamp(note.updatedAt)}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {(() => {
            // Handle both legacy plain text and new block-based content
            let contentToRender = null;
            
            if (note.blocks && typeof note.blocks === 'object' && note.blocks.type === 'doc') {
              // New format: TipTap JSON document
              contentToRender = note.blocks;
            } else if (note.content) {
              // Legacy format: plain text - convert to TipTap JSON for rendering
              contentToRender = textToTipTapJSON(note.content);
            }
            
            return <BlockRenderer content={contentToRender} />;
          })()}

          {/* Connected Projects */}
          {connectedProjects.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Connected Projects</h3>
              <div className="flex flex-wrap gap-2">
                {connectedProjects.map((project) => (
                  <button
                    key={project._id}
                    onClick={() => {
                      navigate(`/tasks/projects/${project._id}`);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                    title={`Go to ${project.path}`}
                  >
                    <span>📁</span>
                    <span>{project.path}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {note.tags && note.tags.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {note.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2.5 py-1 rounded-md text-xs bg-slate-100 text-slate-700 border border-slate-200"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleArchive(note)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                note.archived
                  ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {note.archived ? 'Unarchive' : 'Archive'}
            </button>
            <button
              onClick={() => {
                setConfirmModal({
                  open: true,
                  title: 'Delete Note',
                  message: `Are you sure you want to delete "${note.title}"? This action cannot be undone.`,
                  confirmText: 'Delete',
                  cancelText: 'Cancel',
                  variant: 'danger',
                  onConfirm: () => {
                    onDelete(note);
                    onClose();
                    setConfirmModal(null);
                  },
                  onCancel: () => setConfirmModal(null),
                });
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
            >
              Delete
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                onEdit(note);
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
            >
              Edit
            </button>
          </div>
        </div>
      </div>

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
        />
      )}
    </div>
  );
}
