import { useEffect, useMemo, useState } from 'react';
import BlockEditor from './BlockEditor';

function normalizeTagsInput(value) {
  return value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

// Convert plain text to TipTap JSON format
function textToTipTapJSON(text) {
  if (!text || !text.trim()) {
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
        },
      ],
    };
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

export default function NoteForm({ open, initialNote, categories, managedCategories = [], onClose, onSubmit }) {
  const isEdit = !!initialNote?._id;

  const categoryOptions = useMemo(() => {
    const unique = new Set((categories || []).filter(Boolean));
    unique.delete('All');
    unique.delete('Favorites');
    unique.delete('Archive');
    unique.delete('Archived');
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [categories]);

  const getCategoryIcon = (catName) => {
    const cat = managedCategories.find((c) => c.name === catName);
    return cat?.icon || null;
  };

  const [title, setTitle] = useState('');
  const [content, setContent] = useState(null); // TipTap JSON format
  const [category, setCategory] = useState('Uncategorized');
  const [isFavorite, setIsFavorite] = useState(false);
  const [tagsInput, setTagsInput] = useState('');

  useEffect(() => {
    if (!open) {
      // Reset form when closed
      setTitle('');
      setContent({
        type: 'doc',
        content: [{ type: 'paragraph' }],
      });
      setCategory('Uncategorized');
      setIsFavorite(false);
      setTagsInput('');
      return;
    }
    
    setTitle(initialNote?.title || '');
    
    // Handle both legacy plain text and new block-based content
    // TipTap stores content as a single JSON document with type 'doc'
    if (initialNote?.blocks && typeof initialNote.blocks === 'object' && initialNote.blocks.type === 'doc') {
      // New format: TipTap JSON document
      setContent(initialNote.blocks);
    } else if (initialNote?.content) {
      // Legacy format: plain text - convert to TipTap JSON
      setContent(textToTipTapJSON(initialNote.content));
    } else {
      // Empty note
      setContent({
        type: 'doc',
        content: [{ type: 'paragraph' }],
      });
    }
    
    setCategory(initialNote?.category || 'Uncategorized');
    setIsFavorite(!!initialNote?.isFavorite);
    setTagsInput((initialNote?.tags || []).join(', '));
  }, [open, initialNote]);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    await onSubmit({
      title: trimmedTitle,
      blocks: content, // Send TipTap JSON as 'blocks', not 'content'
      category: (category || 'Uncategorized').trim(),
      isFavorite,
      tags: normalizeTagsInput(tagsInput),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col">
        {/* Fixed Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">{isEdit ? 'Edit note' : 'New note'}</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Form with Scrollable Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note title…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                maxLength={200}
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              >
                <option value="Uncategorized">Uncategorized</option>
                {categoryOptions.map((c) => {
                  const icon = getCategoryIcon(c);
                  return (
                    <option key={c} value={c}>
                      {icon ? `${icon} ${c}` : c}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Content</label>
              <BlockEditor
                content={content}
                onChange={(json) => setContent(json)}
                placeholder="Start writing... Use / for commands, or click the toolbar buttons above."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Tags</label>
                <input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g. weekly, work, idea"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
                <p className="text-xs text-slate-500">Comma-separated (optional).</p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Options</label>
                <label className="flex items-center gap-2 text-sm text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={isFavorite}
                    onChange={(e) => setIsFavorite(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-200"
                  />
                  Favorite
                </label>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="px-5 py-4 border-t border-slate-200 bg-white shrink-0">
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {isEdit ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

