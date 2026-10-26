import { useCallback, useEffect, useRef } from 'react';
import { clearDraft, writeDraft } from '../utils/codeSandbox';

/**
 * Saves sandbox code to localStorage shortly after typing stops, and at once
 * on flush() (e.g. before switching language) or when the component unmounts.
 */
export const useCodeDraft = () => {
  const timer = useRef(null);
  const pending = useRef(null);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (!pending.current) return;
    writeDraft(pending.current.key, pending.current.code);
    pending.current = null;
  }, []);

  useEffect(() => flush, [flush]);

  const save = useCallback((key, code) => {
    pending.current = { key, code };
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 400);
  }, [flush]);

  const discard = useCallback((key) => {
    clearTimeout(timer.current);
    pending.current = null;
    clearDraft(key);
  }, []);

  return { save, flush, discard };
};

export default useCodeDraft;
