import { useMemo } from 'react';
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cssLang from 'highlight.js/lib/languages/css';
import htmlLang from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import 'highlight.js/styles/github-dark-dimmed.css';

const lowlight = createLowlight();

lowlight.register('javascript', javascript);
lowlight.register('typescript', typescript);
lowlight.register('python', python);
lowlight.register('java', java);
lowlight.register('css', cssLang);
lowlight.register('html', htmlLang);
lowlight.register('json', json);
lowlight.register('bash', bash);

export default function BlockRenderer({ content }) {
  const htmlContent = useMemo(() => {
    if (!content) return '';

    // If content is a TipTap JSON document
    if (typeof content === 'object' && content.type === 'doc') {
      try {
        return generateHTML(content, [
          StarterKit.configure({
            heading: {
              levels: [1, 2, 3],
            },
            codeBlock: false,
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
          }),
        ]);
      } catch (err) {
        console.error('Error rendering TipTap content:', err);
        return '';
      }
    }

    // Legacy: plain text content
    if (typeof content === 'string') {
      return content.split('\n').map((line, i) => `<p>${line || '<br>'}</p>`).join('');
    }

    return '';
  }, [content]);

  if (!htmlContent) {
    return <p className="text-slate-400 italic">No content</p>;
  }

  return (
    <div
      className="note-content"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}
