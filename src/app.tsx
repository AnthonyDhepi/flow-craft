import { useCallback, useEffect, useState } from 'react';
import { Dashboard } from './components/dashboard';
import { Editor } from './components/editor';
import { useAutosave, useThemeMode, useToast } from './hooks';
import { createId } from './lib/diagram';
import {
  deleteStoredDocument, downloadDocument, listStoredDocuments, saveStoredDocument,
} from './lib/persistence';
import type { FlowTemplate } from './lib/templates';
import { useEditorStore } from './store/editor-store';
import type { DiagramDocument, SavedDiagramRecord } from './types';

type View = 'dashboard' | 'editor';

export default function App(): JSX.Element {
  const { theme, toggleTheme } = useThemeMode();
  const { toast, showToast } = useToast();
  const [view, setView] = useState<View>('dashboard');
  const [charts, setCharts] = useState<SavedDiagramRecord[]>([]);

  const document = useEditorStore((state) => state.document);
  const importDocument = useEditorStore((state) => state.importDocument);
  const resetDocument = useEditorStore((state) => state.resetDocument);

  const refreshCharts = useCallback(async () => {
    setCharts(await listStoredDocuments());
  }, []);

  useAutosave(view === 'editor', refreshCharts);

  useEffect(() => {
    void refreshCharts();
  }, [refreshCharts]);

  const openDocument = (next: DiagramDocument) => {
    importDocument(next);
    setView('editor');
  };

  const handleNew = () => {
    resetDocument();
    setView('editor');
  };

  const handleUseTemplate = (template: FlowTemplate) => {
    openDocument(template.create());
    showToast(`Started from “${template.name}”`);
  };

  const handleDuplicate = async (chart: SavedDiagramRecord) => {
    const copy: DiagramDocument = {
      ...chart.document,
      meta: {
        ...chart.document.meta,
        id: createId('chart'),
        name: `${chart.name} copy`,
        updatedAt: new Date().toISOString(),
      },
    };
    await saveStoredDocument(copy);
    await refreshCharts();
    showToast('Diagram duplicated');
  };

  const handleDelete = async (chart: SavedDiagramRecord) => {
    if (!window.confirm(`Delete “${chart.name}”? This cannot be undone.`)) return;
    await deleteStoredDocument(chart.id);
    await refreshCharts();
    showToast('Diagram deleted');
  };

  const handleExit = async () => {
    try {
      await saveStoredDocument(document);
      await refreshCharts();
    } finally {
      setView('dashboard');
    }
  };

  return (
    <>
      {view === 'dashboard' ? (
        <Dashboard
          charts={charts}
          theme={theme}
          toggleTheme={toggleTheme}
          onNew={handleNew}
          onOpen={(chart) => openDocument(chart.document)}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onExport={(chart) => { downloadDocument(chart.document); showToast('Exported JSON file'); }}
          onUseTemplate={handleUseTemplate}
        />
      ) : (
        <Editor onExit={handleExit} theme={theme} toggleTheme={toggleTheme} showToast={showToast} />
      )}

      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </>
  );
}
