import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import css from 'highlight.js/lib/languages/css';
import html from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';

export const EMPTY_NOTE_DOC = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

export const noteLowlight = createLowlight();

noteLowlight.register('javascript', javascript);
noteLowlight.register('typescript', typescript);
noteLowlight.register('python', python);
noteLowlight.register('java', java);
noteLowlight.register('css', css);
noteLowlight.register('html', html);
noteLowlight.register('json', json);
noteLowlight.register('bash', bash);

const tableConfig = {
  resizable: true,
  lastColumnResizable: true,
  HTMLAttributes: {
    class: 'tiptap-table',
  },
};

export function buildNoteExtensions({ placeholder } = {}) {
  const extensions = [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
      codeBlock: false,
      link: false,
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: 'https',
      HTMLAttributes: {
        class: 'note-editor-link',
        rel: 'noopener noreferrer',
        target: '_blank',
      },
    }),
    Table.configure(tableConfig),
    TableRow,
    TableHeader,
    TableCell,
    TaskList.configure({
      HTMLAttributes: {
        class: 'task-list',
      },
    }),
    TaskItem.configure({
      nested: true,
      HTMLAttributes: {
        class: 'task-item',
        'data-type': 'taskItem',
      },
    }),
    CodeBlockLowlight.configure({
      lowlight: noteLowlight,
      defaultLanguage: 'plaintext',
    }),
  ];

  if (placeholder) {
    extensions.push(
      Placeholder.configure({
        placeholder,
      })
    );
  }

  return extensions;
}

/** Cached extensions for read-only HTML rendering (BlockRenderer). */
export const NOTE_RENDER_EXTENSIONS = buildNoteExtensions();
