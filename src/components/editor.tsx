import { useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider, type ReactFlowInstance } from '@xyflow/react';
import {
  ArrowLeft, Braces, ChevronRight, Circle, Command, Copy, Database, Diamond, Download, FileDown,
  Frame, ImageDown, LayoutGrid, Maximize, Moon, PanelsTopLeft, Redo2, RotateCcw, Square, Sun, Trash2, Undo2, Upload,
} from 'lucide-react';
import { Canvas } from './canvas';
import { ShapePalette } from './shape-palette';
import { Inspector } from './inspector';
import { CommandPalette, type Command as PaletteCommand } from './command-palette';
import { getImportTemplate } from '../lib/import';
import { downloadDocument, exportCanvasToPng, readDocumentFromFile } from '../lib/persistence';
import { useEditorShortcuts } from '../hooks';
import type { ThemeMode } from '../hooks';
import { useEditorStore } from '../store/editor-store';
import type { FlowEdge, FlowNode } from '../types';

const SAVE_LABEL: Record<string, string> = {
  idle: 'Ready',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

export function Editor({
  onExit,
  theme,
  toggleTheme,
  showToast,
}: {
  onExit: () => void;
  theme: ThemeMode;
  toggleTheme: () => void;
  showToast: (message: string) => void;
}): JSX.Element {
  const document = useEditorStore((state) => state.document);
  const saveStatus = useEditorStore((state) => state.saveStatus);
  const history = useEditorStore((state) => state.history);
  const future = useEditorStore((state) => state.future);
  const addNode = useEditorStore((state) => state.addNode);
  const autoLayout = useEditorStore((state) => state.autoLayout);
  const renameDiagram = useEditorStore((state) => state.renameDiagram);
  const updateDiagramMeta = useEditorStore((state) => state.updateDiagramMeta);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const resetDocument = useEditorStore((state) => state.resetDocument);
  const importDocument = useEditorStore((state) => state.importDocument);
  const duplicateSelectedNode = useEditorStore((state) => state.duplicateSelectedNode);
  const deleteSelection = useEditorStore((state) => state.deleteSelection);

  const [reactFlow, setReactFlow] = useState<ReactFlowInstance<FlowNode, FlowEdge> | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pendingFit, setPendingFit] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEditorShortcuts(true, () => setPaletteOpen((open) => !open));

  const fit = useMemo(
    () => () => window.requestAnimationFrame(() => reactFlow?.fitView({ padding: 0.2, duration: 320 })),
    [reactFlow],
  );

  useEffect(() => {
    if (reactFlow && pendingFit) {
      fit();
      setPendingFit(false);
    }
  }, [fit, pendingFit, reactFlow]);

  const runLayout = (direction: 'TB' | 'LR') => {
    autoLayout(direction);
    fit();
  };

  const exportJson = () => {
    downloadDocument(document);
    showToast('Exported JSON file');
  };

  const exportPng = async () => {
    if (!canvasRef.current) return;
    try {
      await exportCanvasToPng(canvasRef.current, document);
      showToast('Exported PNG image');
    } catch (error) {
      showToast(`PNG export failed: ${getErrorMessage(error)}`);
    }
  };

  const copyJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify(document, null, 2));
    showToast('Copied diagram JSON');
  };

  const copyTemplate = async () => {
    await navigator.clipboard.writeText(getImportTemplate());
    showToast('Copied import template');
  };

  const onImportFile = async (file: File) => {
    try {
      const next = await readDocumentFromFile(file);
      importDocument(next);
      setPendingFit(true);
      showToast('Diagram imported');
    } catch (error) {
      showToast(`Import failed: ${getErrorMessage(error)}`);
    }
  };

  const commands: PaletteCommand[] = [
    { id: 'add-start', label: 'Add start / end step', section: 'Shapes', icon: Circle, run: () => addNode('start') },
    { id: 'add-process', label: 'Add process step', section: 'Shapes', icon: Square, run: () => addNode('process') },
    { id: 'add-decision', label: 'Add decision step', section: 'Shapes', icon: Diamond, run: () => addNode('decision') },
    { id: 'add-data', label: 'Add data step', section: 'Shapes', icon: Database, run: () => addNode('data') },
    { id: 'layout-v', label: 'Auto-layout vertical', section: 'Arrange', icon: LayoutGrid, run: () => runLayout('TB') },
    { id: 'layout-h', label: 'Auto-layout horizontal', section: 'Arrange', icon: LayoutGrid, run: () => runLayout('LR') },
    { id: 'fit', label: 'Fit diagram to screen', section: 'Arrange', icon: Maximize, run: fit },
    { id: 'undo', label: 'Undo', section: 'Edit', icon: Undo2, run: undo },
    { id: 'redo', label: 'Redo', section: 'Edit', icon: Redo2, run: redo },
    { id: 'duplicate', label: 'Duplicate selected step', section: 'Edit', icon: Copy, run: duplicateSelectedNode },
    { id: 'delete', label: 'Delete selection', section: 'Edit', icon: Trash2, run: deleteSelection },
    { id: 'reset', label: 'Reset to a blank diagram', section: 'Edit', icon: RotateCcw, run: resetDocument },
    { id: 'export-json', label: 'Export as JSON', section: 'Share', icon: Download, run: exportJson },
    { id: 'export-png', label: 'Export as PNG', section: 'Share', icon: ImageDown, run: () => void exportPng() },
    { id: 'copy-json', label: 'Copy diagram JSON', section: 'Share', icon: Braces, run: () => void copyJson() },
    { id: 'import', label: 'Import a file', section: 'Share', icon: Upload, run: () => fileInputRef.current?.click() },
    { id: 'template', label: 'Copy import template', section: 'Share', icon: FileDown, run: () => void copyTemplate() },
    { id: 'theme', label: `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`, section: 'View', icon: theme === 'dark' ? Sun : Moon, run: toggleTheme },
    { id: 'home', label: 'Back to dashboard', section: 'View', icon: ArrowLeft, run: onExit },
  ];

  const ThemeIcon = theme === 'dark' ? Sun : Moon;

  return (
    <div className="editor">
      <header className="topbar">
        <div className="topbar__left">
          <button className="icon-btn" onClick={onExit} type="button" title="Back to dashboard" aria-label="Back to dashboard">
            <ArrowLeft size={18} />
          </button>
          <div className="topbar__crumbs">
            <span className="topbar__brand"><PanelsTopLeft size={15} /> FlowCraft</span>
            <ChevronRight size={14} className="topbar__sep" />
            <input
              className="topbar__title"
              aria-label="Diagram name"
              value={document.meta.name}
              onChange={(event) => renameDiagram(event.target.value)}
              onBlur={(event) => updateDiagramMeta({ name: event.target.value })}
            />
          </div>
          <span className={`save-status save-status--${saveStatus}`}>
            <span className="save-status__dot" />
            {SAVE_LABEL[saveStatus] ?? 'Ready'}
          </span>
        </div>

        <div className="topbar__right">
          <div className="btn-group">
            <button className="icon-btn" disabled={!history.length} onClick={undo} type="button" title="Undo" aria-label="Undo">
              <Undo2 size={17} />
            </button>
            <button className="icon-btn" disabled={!future.length} onClick={redo} type="button" title="Redo" aria-label="Redo">
              <Redo2 size={17} />
            </button>
          </div>
          <button className="btn btn--ghost" onClick={() => setPaletteOpen(true)} type="button" title="Command menu (⌘K)">
            <Command size={15} /> <span className="btn__text">Commands</span> <kbd>⌘K</kbd>
          </button>
          <button className="btn btn--ghost" onClick={exportJson} type="button">
            <Download size={15} /> <span className="btn__text">Export</span>
          </button>
          <button className="btn btn--primary" onClick={() => void exportPng()} type="button">
            <ImageDown size={15} /> <span className="btn__text">PNG</span>
          </button>
          <button className="icon-btn" onClick={toggleTheme} type="button" title="Toggle theme" aria-label="Toggle theme">
            <ThemeIcon size={17} />
          </button>
        </div>
      </header>

      <div className="editor__body">
        <aside className="rail">
          <ShapePalette />
        </aside>

        <main className="stage">
          <div className="stage__canvas" ref={canvasRef}>
            <ReactFlowProvider>
              <Canvas onReady={setReactFlow} theme={theme} />
            </ReactFlowProvider>
          </div>

          <div className="stage__toolbar">
            <button className="tool" onClick={() => addNode('process')} type="button" title="Add step"><Square size={16} /></button>
            <span className="tool__divider" />
            <button className="tool" onClick={() => runLayout('TB')} type="button" title="Auto-layout vertical"><LayoutGrid size={16} /></button>
            <button className="tool" onClick={() => runLayout('LR')} type="button" title="Auto-layout horizontal"><Frame size={16} /></button>
            <button className="tool" onClick={fit} type="button" title="Fit to screen"><Maximize size={16} /></button>
            <span className="tool__divider" />
            <button className="tool" onClick={() => fileInputRef.current?.click()} type="button" title="Import file"><Upload size={16} /></button>
          </div>
        </main>

        <Inspector />
      </div>

      {paletteOpen ? <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} /> : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onImportFile(file);
          event.currentTarget.value = '';
        }}
      />
    </div>
  );
}
