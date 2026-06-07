import { useMemo } from 'react';
import { generateHTML } from '@tiptap/html';
import { buildNoteExtensions } from '../lib/noteTipTap';
import 'highlight.js/styles/github-dark-dimmed.css';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function BlockRenderer({ content }) {
  const htmlContent = useMemo(() => {
    if (!content) return '';

    if (typeof content === 'object' && content.type === 'doc') {
      try {
        return generateHTML(content, buildNoteExtensions());
      } catch (err) {
        console.error('Error rendering TipTap content:', err);
        return '';
      }
    }

    if (typeof content === 'string') {
      return content
        .split('\n')
        .map((line) => (line ? `<p>${escapeHtml(line)}</p>` : '<p><br></p>'))
        .join('');
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
