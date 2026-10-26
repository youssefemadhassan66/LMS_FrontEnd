import React, { useId, useLayoutEffect, useRef } from 'react';

const INDENT = { python: '    ', javascript: '  ' };

const lineStartOf = (text, index) => text.lastIndexOf('\n', index - 1) + 1;

/**
 * Plain-textarea code editor: line numbers, Tab / Shift+Tab indent, Enter keeps
 * the indentation, Ctrl/Cmd+Enter runs. Tab stays inside the editor so it can
 * indent; Esc then Tab moves focus on (Esc is kept from closing a dialog, which
 * would throw the code away).
 */
const CodeEditor = ({ value, onChange, language = 'python', onRun, readOnly = false, label = 'Code editor', minHeight }) => {
  const textareaRef = useRef(null);
  const gutterRef = useRef(null);
  const tabReleased = useRef(false);
  const pendingSelection = useRef(null);
  const unit = INDENT[language] || '    ';
  const keysHintId = useId();
  const lineCount = value.split('\n').length;

  // Restores the caret after an edit that went through React state rather
  // than the browser's own undo-aware insertText.
  useLayoutEffect(() => {
    const selection = pendingSelection.current;
    if (!selection || !textareaRef.current) return;
    pendingSelection.current = null;
    textareaRef.current.setSelectionRange(selection[0], selection[1]);
  }, [value]);

  const replaceRange = (start, end, text, selectStart, selectEnd) => {
    const el = textareaRef.current;
    el.setSelectionRange(start, end);
    let inserted = false;
    try {
      // Keeps Ctrl+Z working; jsdom and very old browsers lack it
      inserted = typeof document.execCommand === 'function' && document.execCommand('insertText', false, text);
    } catch {
      inserted = false;
    }
    const caret = start + text.length;
    if (inserted) {
      el.setSelectionRange(selectStart ?? caret, selectEnd ?? caret);
    } else {
      pendingSelection.current = [selectStart ?? caret, selectEnd ?? caret];
      onChange(value.slice(0, start) + text + value.slice(end));
    }
  };

  const indent = (outdent) => {
    const el = textareaRef.current;
    const { selectionStart: start, selectionEnd: end } = el;
    if (!outdent && start === end) {
      replaceRange(start, end, unit);
      return;
    }
    const from = lineStartOf(value, start);
    const block = value.slice(from, end);
    const lines = block.split('\n');
    let firstShift = 0;
    let total = 0;
    const changed = lines.map((line, index) => {
      if (!outdent) {
        if (index === 0) firstShift = unit.length;
        total += unit.length;
        return unit + line;
      }
      const remove = line.startsWith('\t') ? 1 : Math.min(unit.length, line.length - line.trimStart().length);
      if (index === 0) firstShift = -remove;
      total -= remove;
      return line.slice(remove);
    }).join('\n');
    if (changed === block) return;
    replaceRange(from, end, changed, Math.max(from, start + firstShift), end + total);
  };

  const newlineWithIndent = () => {
    const el = textareaRef.current;
    const { selectionStart: start, selectionEnd: end } = el;
    const line = value.slice(lineStartOf(value, start), start);
    let leading = line.match(/^[ \t]*/)[0];
    const trimmed = line.trimEnd();
    const opensBlock = language === 'python' ? trimmed.endsWith(':') : /[{[(]$/.test(trimmed);
    if (opensBlock) leading += unit;
    replaceRange(start, end, `\n${leading}`);
  };

  const handleKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      onRun?.();
      return;
    }
    if (readOnly) return;
    if (event.key === 'Escape') {
      tabReleased.current = true;
      event.stopPropagation();
      return;
    }
    if (event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey) {
      if (tabReleased.current) {
        tabReleased.current = false;
        return;
      }
      event.preventDefault();
      indent(event.shiftKey);
      return;
    }
    tabReleased.current = false;
    if (event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.isComposing) {
      event.preventDefault();
      newlineWithIndent();
    }
  };

  return (
    <div className="cs-editor" style={minHeight ? { '--cs-editor-min-height': minHeight } : undefined}>
      <div ref={gutterRef} className="cs-gutter" aria-hidden="true">
        {Array.from({ length: lineCount }, (_, index) => index + 1).join('\n')}
      </div>
      <textarea
        ref={textareaRef}
        className="cs-textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={(event) => { if (gutterRef.current) gutterRef.current.scrollTop = event.target.scrollTop; }}
        readOnly={readOnly}
        aria-label={label}
        aria-describedby={readOnly ? undefined : keysHintId}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        wrap="off"
      />
      {!readOnly && (
        <span id={keysHintId} className="sr-only">
          Tab indents. Press Escape, then Tab, to leave the editor. Control+Enter runs the code.
        </span>
      )}
    </div>
  );
};

export default CodeEditor;
