import { useEffect, useReducer, useRef, useState } from 'react';

function toolbarBtnClass(active) {
  return `px-2 py-1 rounded text-sm font-medium ${
    active ? 'bg-emerald-100 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'
  }`;
}

function normalizeUrl(url) {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^(https?:\/\/|mailto:|tel:|#)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function toggleHeadingSingleBlock(editor, level) {
  const { state } = editor;
  const { empty, $from, $to, $anchor } = state.selection;
  const chain = editor.chain().focus();
  if (!empty && $from.parent !== $to.parent) {
    chain.setTextSelection($anchor.pos);
  }
  chain.toggleHeading({ level }).run();
}

export default function BlockEditorToolbar({ editor }) {
  const [, rerender] = useReducer((n) => n + 1, 0);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const linkInputRef = useRef(null);

  useEffect(() => {
    const refresh = () => rerender();
    editor.on('selectionUpdate', refresh);
    editor.on('transaction', refresh);
    return () => {
      editor.off('selectionUpdate', refresh);
      editor.off('transaction', refresh);
    };
  }, [editor]);

  useEffect(() => {
    if (showLinkInput && linkInputRef.current) {
      linkInputRef.current.focus();
      linkInputRef.current.select();
    }
  }, [showLinkInput]);

  function openLinkEditor() {
    const existing = editor.getAttributes('link').href || '';
    setLinkUrl(existing || 'https://');
    setShowLinkInput(true);
  }

  function applyLink() {
    const href = normalizeUrl(linkUrl);
    const { from, to, empty } = editor.state.selection;

    if (!href) {
      if (editor.isActive('link')) {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
      }
      setShowLinkInput(false);
      setLinkUrl('');
      return;
    }

    if (empty) {
      return;
    }

    editor.chain().focus().setTextSelection({ from, to }).setLink({ href }).run();
    setShowLinkInput(false);
    setLinkUrl('');
  }

  function cancelLink() {
    setShowLinkInput(false);
    setLinkUrl('');
  }

  const inTable = editor.isActive('table');

  return (
    <div className="border-b border-slate-200 bg-slate-50 rounded-t-lg">
      <div className="p-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 border-r border-slate-300 pr-2">
          <button type="button" onClick={() => toggleHeadingSingleBlock(editor, 1)} className={toolbarBtnClass(editor.isActive('heading', { level: 1 }))} title="Heading 1">
            H1
          </button>
          <button type="button" onClick={() => toggleHeadingSingleBlock(editor, 2)} className={toolbarBtnClass(editor.isActive('heading', { level: 2 }))} title="Heading 2">
            H2
          </button>
          <button type="button" onClick={() => toggleHeadingSingleBlock(editor, 3)} className={toolbarBtnClass(editor.isActive('heading', { level: 3 }))} title="Heading 3">
            H3
          </button>
        </div>

        <div className="flex items-center gap-1 border-r border-slate-300 pr-2">
          <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={toolbarBtnClass(editor.isActive('bold'))} title="Bold">
            <strong>B</strong>
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={toolbarBtnClass(editor.isActive('italic'))} title="Italic">
            <em>I</em>
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleCode().run()} className={toolbarBtnClass(editor.isActive('code'))} title="Inline Code">
            {'</>'}
          </button>
          <button type="button" onClick={openLinkEditor} className={toolbarBtnClass(editor.isActive('link'))} title="Link">
            🔗
          </button>
        </div>

        <div className="flex items-center gap-1 border-r border-slate-300 pr-2">
          <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={toolbarBtnClass(editor.isActive('bulletList'))} title="Bullet List">
            •
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={toolbarBtnClass(editor.isActive('orderedList'))} title="Numbered List">
            1.
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleTaskList().run()} className={toolbarBtnClass(editor.isActive('taskList'))} title="Task List">
            ☑
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={toolbarBtnClass(editor.isActive('blockquote'))} title="Quote">
            {'"'}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={toolbarBtnClass(editor.isActive('codeBlock'))} title="Code Block">
            {'{ }'}
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            className="px-2 py-1 rounded text-sm font-medium text-slate-600 hover:bg-slate-100"
            title="Insert Table"
          >
            ▦
          </button>
        </div>
      </div>

      {showLinkInput && (
        <div className="px-2 pb-2 flex items-center gap-2" data-link-input>
          <input
            ref={linkInputRef}
            type="url"
            data-link-input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyLink();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelLink();
              }
            }}
            placeholder="https://..."
            className="flex-1 min-w-0 rounded border border-slate-300 px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
          {editor.state.selection.empty && linkUrl.trim() && (
            <span className="text-xs text-amber-600 shrink-0">Select text first</span>
          )}
          <button type="button" onClick={applyLink} className="px-2 py-1 rounded text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700">
            Apply
          </button>
          {editor.isActive('link') && (
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().extendMarkRange('link').unsetLink().run();
                cancelLink();
              }}
              className="px-2 py-1 rounded text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Remove
            </button>
          )}
          <button type="button" onClick={cancelLink} className="px-2 py-1 rounded text-xs font-medium text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
        </div>
      )}

      {inTable && (
        <div className="px-2 pb-2 flex flex-wrap items-center gap-1 border-t border-slate-200 pt-2">
          <span className="text-xs text-slate-500 mr-1">Table:</span>
          <button type="button" onClick={() => editor.chain().focus().addRowBefore().run()} className="px-2 py-0.5 rounded text-xs text-slate-600 hover:bg-slate-100" title="Add row above">
            + Row ↑
          </button>
          <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className="px-2 py-0.5 rounded text-xs text-slate-600 hover:bg-slate-100" title="Add row below">
            + Row ↓
          </button>
          <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} className="px-2 py-0.5 rounded text-xs text-slate-600 hover:bg-slate-100" title="Delete row">
            − Row
          </button>
          <span className="text-slate-300 mx-1">|</span>
          <button type="button" onClick={() => editor.chain().focus().addColumnBefore().run()} className="px-2 py-0.5 rounded text-xs text-slate-600 hover:bg-slate-100" title="Add column left">
            + Col ←
          </button>
          <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className="px-2 py-0.5 rounded text-xs text-slate-600 hover:bg-slate-100" title="Add column right">
            + Col →
          </button>
          <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} className="px-2 py-0.5 rounded text-xs text-slate-600 hover:bg-slate-100" title="Delete column">
            − Col
          </button>
          <span className="text-slate-300 mx-1">|</span>
          <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className="px-2 py-0.5 rounded text-xs text-red-600 hover:bg-red-50" title="Delete table">
            Delete table
          </button>
        </div>
      )}
    </div>
  );
}
