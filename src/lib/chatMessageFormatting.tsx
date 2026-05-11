import React from 'react';

function safeHref(url: string): string | null {
  const t = url.trim();
  if (/^https?:\/\//i.test(t)) return t;
  if (/^mailto:/i.test(t)) return t;
  if (t.startsWith('/') && !t.startsWith('//')) return t;
  if (t.startsWith('#')) return t;
  return null;
}

function parseInline(
  s: string,
  id: string,
  classes: { code: string; link: string }
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  let k = 0;

  const emitPlain = (from: number, to: number) => {
    if (from < to) {
      out.push(
        <span key={`${id}-t-${k++}`} className="whitespace-pre-wrap">
          {s.slice(from, to)}
        </span>
      );
    }
  };

  while (i < s.length) {
    if (s.startsWith('**', i)) {
      const end = s.indexOf('**', i + 2);
      if (end !== -1) {
        emitPlain(last, i);
        out.push(
          <strong key={`${id}-b-${k++}`} className="font-semibold">
            {s.slice(i + 2, end)}
          </strong>
        );
        i = end + 2;
        last = i;
        continue;
      }
    }

    if (s[i] === '`') {
      const end = s.indexOf('`', i + 1);
      if (end !== -1 && end > i + 1) {
        emitPlain(last, i);
        out.push(
          <code key={`${id}-c-${k++}`} className={classes.code}>
            {s.slice(i + 1, end)}
          </code>
        );
        i = end + 1;
        last = i;
        continue;
      }
    }

    if (s[i] === '*' && s[i + 1] !== '*') {
      const end = s.indexOf('*', i + 1);
      if (end !== -1 && end > i + 1) {
        emitPlain(last, i);
        out.push(<em key={`${id}-i-${k++}`}>{s.slice(i + 1, end)}</em>);
        i = end + 1;
        last = i;
        continue;
      }
    }

    if (s[i] === '[') {
      const rb = s.indexOf(']', i + 1);
      const op = rb >= 0 ? s.indexOf('(', rb) : -1;
      const cp = op === rb + 1 && op >= 0 ? s.indexOf(')', op + 1) : -1;
      if (rb > i && op === rb + 1 && cp > op) {
        const label = s.slice(i + 1, rb);
        const url = s.slice(op + 1, cp);
        const href = safeHref(url);
        emitPlain(last, i);
        if (href) {
          out.push(
            <a
              key={`${id}-a-${k++}`}
              href={href}
              className={classes.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              {label || url}
            </a>
          );
        } else {
          out.push(<span key={`${id}-bad-${k++}`}>{s.slice(i, cp + 1)}</span>);
        }
        i = cp + 1;
        last = i;
        continue;
      }
    }

    i += 1;
  }

  emitPlain(last, s.length);
  return out;
}

function renderBlocks(text: string, idPrefix: string, classes: { code: string; link: string }): React.ReactNode[] {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let bk = 0;

  while (i < lines.length) {
    const line = lines[i];
    const bullet = /^\s*-\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+\.\s+(.*)$/.exec(line);

    if (bullet) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = /^\s*-\s+(.*)$/.exec(lines[i]);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      blocks.push(
        <ul key={`${idPrefix}-ul-${bk++}`} className="list-disc pl-4 my-1 space-y-0.5 marker:text-inherit">
          {items.map((item, j) => (
            <li key={j} className="pl-0.5">
              {parseInline(item, `${idPrefix}-li-${j}`, classes)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (numbered) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = /^\s*\d+\.\s+(.*)$/.exec(lines[i]);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      blocks.push(
        <ol key={`${idPrefix}-ol-${bk++}`} className="list-decimal pl-4 my-1 space-y-0.5 marker:text-inherit">
          {items.map((item, j) => (
            <li key={j} className="pl-0.5">
              {parseInline(item, `${idPrefix}-oli-${j}`, classes)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    if (line.trim() === '') {
      i++;
      blocks.push(<div key={`${idPrefix}-sp-${bk++}`} className="h-2 shrink-0" aria-hidden />);
      continue;
    }

    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '') {
      const ul = /^\s*-\s+/.test(lines[i]);
      const ol = /^\s*\d+\.\s+/.test(lines[i]);
      if (ul || ol) break;
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(
      <div key={`${idPrefix}-p-${bk++}`} className="min-h-[1em] whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
        {paraLines.map((pl, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 ? <br /> : null}
            {parseInline(pl, `${idPrefix}-pl-${bk}-${idx}`, classes)}
          </React.Fragment>
        ))}
      </div>
    );
  }

  return blocks;
}

export type ChatMessageTone = 'own' | 'other';

export function FormattedChatMessage({ text, tone }: { text: string; tone: ChatMessageTone }) {
  const classes =
    tone === 'own'
      ? {
          code: 'px-1 py-0.5 rounded bg-white/25 text-[0.85em] font-mono align-baseline',
          link: 'underline font-medium decoration-white/80 text-white hover:decoration-white',
        }
      : {
          code: 'px-1 py-0.5 rounded bg-slate-100 text-slate-800 text-[0.85em] font-mono align-baseline',
          link: 'underline font-medium text-[#DE5532] decoration-[#DE5532]/50 hover:decoration-[#DE5532]',
        };

  if (!text) return null;
  return <div className="space-y-0.5 leading-relaxed">{renderBlocks(text, 'm', classes)}</div>;
}

export function applyWrap(
  value: string,
  start: number,
  end: number,
  open: string,
  close: string,
  emptyFallback: string
): { value: string; selectionStart: number; selectionEnd: number } {
  const sel = value.slice(start, end);
  const inner = sel || emptyFallback;
  const next = value.slice(0, start) + open + inner + close + value.slice(end);
  const caretEnd = start + open.length + inner.length + close.length;
  if (!sel && emptyFallback) {
    const caretStart = start + open.length;
    const caretInnerEnd = caretStart + emptyFallback.length;
    return { value: next, selectionStart: caretStart, selectionEnd: caretInnerEnd };
  }
  return { value: next, selectionStart: caretEnd, selectionEnd: caretEnd };
}

export function applyBulletLines(
  value: string,
  start: number,
  end: number
): { value: string; selectionStart: number; selectionEnd: number } {
  const sel = value.slice(start, end);
  if (sel) {
    const lines = sel.split('\n');
    const mapped = lines.map((line) => {
      if (/^\s*-\s+/.test(line)) return line;
      const m = /^(\s*)/.exec(line);
      const indent = m ? m[1] : '';
      const rest = line.slice(indent.length);
      if (!rest.trim()) return line;
      return `${indent}- ${rest}`;
    });
    const block = mapped.join('\n');
    const next = value.slice(0, start) + block + value.slice(end);
    return { value: next, selectionStart: start, selectionEnd: start + block.length };
  }
  const insert = '- ';
  const next = value.slice(0, start) + insert + value.slice(end);
  const pos = start + insert.length;
  return { value: next, selectionStart: pos, selectionEnd: pos };
}

export function applyNumberedLines(
  value: string,
  start: number,
  end: number
): { value: string; selectionStart: number; selectionEnd: number } {
  const sel = value.slice(start, end);
  if (sel) {
    const lines = sel.split('\n');
    const mapped = lines.map((line, idx) => {
      if (/^\s*\d+\.\s+/.test(line)) return line;
      const m = /^(\s*)/.exec(line);
      const indent = m ? m[1] : '';
      const rest = line.slice(indent.length);
      if (!rest.trim()) return line;
      return `${indent}${idx + 1}. ${rest}`;
    });
    const block = mapped.join('\n');
    const next = value.slice(0, start) + block + value.slice(end);
    return { value: next, selectionStart: start, selectionEnd: start + block.length };
  }
  const insert = '1. ';
  const next = value.slice(0, start) + insert + value.slice(end);
  const pos = start + insert.length;
  return { value: next, selectionStart: pos, selectionEnd: pos };
}

export function applyLinkTemplate(
  value: string,
  start: number,
  end: number
): { value: string; selectionStart: number; selectionEnd: number } {
  const sel = value.slice(start, end);
  const label = sel || 'texto';
  const insert = `[${label}](https://)`;
  const next = value.slice(0, start) + insert + value.slice(end);
  if (!sel) {
    const labelStart = start + 1;
    const labelEnd = labelStart + 'texto'.length;
    return { value: next, selectionStart: labelStart, selectionEnd: labelEnd };
  }
  const urlStart = start + insert.indexOf('https://');
  const urlEnd = urlStart + 'https://'.length;
  return { value: next, selectionStart: urlStart, selectionEnd: urlEnd };
}
