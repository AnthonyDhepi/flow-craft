import { useCallback, useEffect, useRef, useState } from 'react';
import { saveStoredDocument } from './lib/persistence';
import { useEditorStore } from './store/editor-store';

export type ThemeMode = 'dark' | 'light';

const THEME_STORAGE_KEY = 'flowcraft.theme';

export function useThemeMode(): { theme: ThemeMode; toggleTheme: () => void } {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return {
    theme,
    toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
  };
}

/** Debounced autosave of the active document while the editor is open. */
export function useAutosave(enabled: boolean, onSaved?: () => void): void {
  const document = useEditorStore((state) => state.document);
  const setSaveStatus = useEditorStore((state) => state.setSaveStatus);
  const savedRef = useRef(onSaved);
  savedRef.current = onSaved;

  useEffect(() => {
    if (!enabled) {
      setSaveStatus('idle');
      return;
    }

    setSaveStatus('saving');
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          await saveStoredDocument(document);
          if (cancelled) return;
          setSaveStatus('saved');
          savedRef.current?.();
        } catch {
          if (cancelled) return;
          setSaveStatus('error');
        }
      })();
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [document, enabled, setSaveStatus]);
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable;
}

/** Global editor shortcuts. `onCommandPalette` opens the ⌘K launcher. */
export function useEditorShortcuts(enabled: boolean, onCommandPalette: () => void): void {
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const deleteSelection = useEditorStore((state) => state.deleteSelection);
  const duplicateSelectedNode = useEditorStore((state) => state.duplicateSelectedNode);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (modifier && key === 'k') {
        event.preventDefault();
        onCommandPalette();
        return;
      }

      if (isTypingTarget(event.target)) return;

      if (modifier && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }
      if (modifier && (key === 'y' || (key === 'z' && event.shiftKey))) {
        event.preventDefault();
        redo();
        return;
      }
      if (modifier && key === 'd') {
        event.preventDefault();
        duplicateSelectedNode();
        return;
      }
      if (key === 'delete' || key === 'backspace') {
        event.preventDefault();
        deleteSelection();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteSelection, duplicateSelectedNode, enabled, onCommandPalette, redo, undo]);
}

/** Ephemeral toast messages that auto-dismiss. */
export function useToast(): { toast: string | null; showToast: (message: string) => void } {
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<number>();

  const showToast = useCallback((message: string) => {
    window.clearTimeout(timerRef.current);
    setToast(message);
    timerRef.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return { toast, showToast };
}
