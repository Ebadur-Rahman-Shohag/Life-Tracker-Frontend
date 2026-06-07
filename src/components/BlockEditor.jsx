import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect, useRef } from 'react';
import { buildNoteExtensions, EMPTY_NOTE_DOC } from '../lib/noteTipTap';
import BlockEditorToolbar from './BlockEditorToolbar';

export default function BlockEditor({ content, onChange, onSaveRequest, placeholder = 'Start writing...' }) {
  const lastEmittedRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const onSaveRequestRef = useRef(onSaveRequest);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onSaveRequestRef.current = onSaveRequest;
  }, [onSaveRequest]);

  const editor = useEditor({
    extensions: buildNoteExtensions({ placeholder }),
    content: content || EMPTY_NOTE_DOC,
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON();
      lastEmittedRef.current = json;
      onChangeRef.current(json);
    },
    editorProps: {
      attributes: {
        class: 'note-editor-content focus:outline-none min-h-[8rem] px-4 py-3',
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          onSaveRequestRef.current?.();
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (!editor) return;

    if (!content) {
      lastEmittedRef.current = null;
      editor.commands.setContent(EMPTY_NOTE_DOC, { emitUpdate: false });
      return;
    }

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
    return (
      <div
        className="border border-slate-300 rounded-lg overflow-hidden bg-white flex flex-col min-h-[200px] max-h-[min(50vh,22rem)] w-full"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="h-10 border-b border-slate-200 bg-slate-50 flex items-center gap-2 px-2">
          <div className="h-6 w-20 rounded bg-slate-200/80" />
          <div className="h-6 w-16 rounded bg-slate-200/80" />
          <div className="h-6 w-24 rounded bg-slate-200/80" />
        </div>
        <div className="flex-1 min-h-[8rem] flex items-center justify-center bg-slate-50/80 text-sm text-slate-500">
          Loading editor…
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full min-h-[200px] max-h-full flex-col border border-slate-300 rounded-lg overflow-hidden bg-white h-full">
      <BlockEditorToolbar editor={editor} />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <EditorContent editor={editor} className="min-h-[8rem]" />
      </div>
    </div>
  );
}
