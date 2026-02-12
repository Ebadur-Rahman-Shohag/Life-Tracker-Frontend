import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { createLowlight } from 'lowlight';
import { useEffect, useRef } from 'react';

// Import languages for syntax highlighting
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import css from 'highlight.js/lib/languages/css';
import html from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';

const lowlight = createLowlight();

lowlight.register('javascript', javascript);
lowlight.register('typescript', typescript);
lowlight.register('python', python);
lowlight.register('java', java);
lowlight.register('css', css);
lowlight.register('html', html);
lowlight.register('json', json);
lowlight.register('bash', bash);

export default function BlockEditor({ content, onChange, placeholder = 'Start writing...' }) {
  const lastEmittedRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: false, // Use CodeBlockLowlight instead
      }),
      Table.configure({
        resizable: true,
        lastColumnResizable: true,
        HTMLAttributes: {
          class: 'tiptap-table',
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'plaintext',
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: content || {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      lastEmittedRef.current = json;
      onChange(json);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none focus:outline-none min-h-[300px] px-4 py-3',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;

    if (!content) {
      lastEmittedRef.current = null;
      editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph' }] }, { emitUpdate: false });
      return;
    }

    // Skip sync when content came from the editor (avoids overwriting blockquote, lists, etc.)
    const emittedStr = lastEmittedRef.current ? JSON.stringify(lastEmittedRef.current) : null;
    const contentStr = JSON.stringify(content);
    if (emittedStr === contentStr) {
      return;
    }

    const currentContent = editor.getJSON();
    const currentStr = JSON.stringify(currentContent);
    if (currentStr !== contentStr) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const MenuBar = () => (
    <div className="border-b border-slate-200 p-2 flex flex-wrap items-center gap-2 bg-slate-50 rounded-t-lg">
      <div className="flex items-center gap-1 border-r border-slate-300 pr-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-2 py-1 rounded text-sm font-medium ${
            editor.isActive('heading', { level: 1 })
              ? 'bg-emerald-100 text-emerald-700'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Heading 1"
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2 py-1 rounded text-sm font-medium ${
            editor.isActive('heading', { level: 2 })
              ? 'bg-emerald-100 text-emerald-700'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Heading 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`px-2 py-1 rounded text-sm font-medium ${
            editor.isActive('heading', { level: 3 })
              ? 'bg-emerald-100 text-emerald-700'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Heading 3"
        >
          H3
        </button>
      </div>

      <div className="flex items-center gap-1 border-r border-slate-300 pr-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-2 py-1 rounded text-sm font-medium ${
            editor.isActive('bold') ? 'bg-emerald-100 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-2 py-1 rounded text-sm font-medium ${
            editor.isActive('italic') ? 'bg-emerald-100 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Italic"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`px-2 py-1 rounded text-sm font-medium ${
            editor.isActive('code') ? 'bg-emerald-100 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Inline Code"
        >
          {'</>'}
        </button>
      </div>

      <div className="flex items-center gap-1 border-r border-slate-300 pr-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-2 py-1 rounded text-sm font-medium ${
            editor.isActive('bulletList') ? 'bg-emerald-100 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Bullet List"
        >
          •
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`px-2 py-1 rounded text-sm font-medium ${
            editor.isActive('orderedList') ? 'bg-emerald-100 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Numbered List"
        >
          1.
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`px-2 py-1 rounded text-sm font-medium ${
            editor.isActive('blockquote') ? 'bg-emerald-100 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Quote"
        >
          {'"'}
        </button>
      </div>

      <div className="flex items-center gap-1 border-r border-slate-300 pr-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`px-2 py-1 rounded text-sm font-medium ${
            editor.isActive('codeBlock') ? 'bg-emerald-100 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Code Block"
        >
          {'{ }'}
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
          className="px-2 py-1 rounded text-sm font-medium text-slate-600 hover:bg-slate-100"
          title="Insert Table"
        >
          ▦
        </button>
      </div>
    </div>
  );

  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden bg-white flex flex-col">
      <MenuBar />
      <div className="flex-1 min-h-[300px] max-h-[400px] overflow-y-auto">
        <EditorContent editor={editor} className="min-h-[300px]" />
      </div>
    </div>
  );
}
