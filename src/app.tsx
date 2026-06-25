import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, type ReactFlowInstance, type Viewport } from '@xyflow/react';
import { ArrowLeft, Braces, Clock3, Download, FolderOpen, House, ImageDown, LayoutTemplate, Moon, PenSquare, Plus, Redo2, RotateCcw, Save, Sparkles, Sun, Trash2, Undo2, Upload } from 'lucide-react';
import { FlowNodeCard } from './components/flow-node';
import { DOCUMENT_VERSION, NODE_LIBRARY, getDiagramMetrics } from './lib/diagram';
import { IMPORT_FORMAT_NOTE, getImportTemplate } from './lib/import';
import { downloadDocument, exportCanvasToPng, listStoredDocuments, readDocumentFromFile, saveStoredDocument } from './lib/persistence';
import { useEditorStore } from './store/editor-store';
import type { EdgeRisk, FlowEdge, FlowNode, SavedDiagramRecord } from './types';

const nodeTypes = { flowNode: FlowNodeCard };
const THEME_STORAGE_KEY = 'flowcraft.theme';
const APP_NAME = 'Reranga';
const APP_MEANING = 'Flow state in Te Reo.';
const DRAWER_MENU_ITEMS = ['File', 'Edit', 'View', 'Arrange', 'Extras', 'Help'] as const;
const PLACEHOLDER_FEATURES = [
  {
    label: 'Layers',
    description: 'Reserved for draw.io-style layer controls once multi-layer editing lands.',
  },
  {
    label: 'Comments',
    description: 'Kept visible in the layout as a placeholder for review threads and feedback pins.',
  },
  {
    label: 'Pages',
    description: 'Multi-page diagram navigation is represented here without pretending it already exists.',
  },
] as const;

type ThemeMode = 'dark' | 'light';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

function useThemeMode(): { themeMode: ThemeMode; toggleThemeMode: () => void } {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') {
      return 'light';
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.classList.toggle('dark', themeMode === 'dark');
    document.documentElement.dataset.theme = themeMode;
    document.documentElement.style.colorScheme = themeMode;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  return {
    themeMode,
    toggleThemeMode: () => {
      setThemeMode((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'));
    },
  };
}

function useAutosave(enabled: boolean, onSaved?: () => void): void {
  const document = useEditorStore((state) => state.document);
  const setSaveStatus = useEditorStore((state) => state.setSaveStatus);

  useEffect(() => {
    if (!enabled) {
      setSaveStatus('Autosave ready');
      return;
    }

    setSaveStatus('Saving changes...');
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          await saveStoredDocument(document);
          if (cancelled) return;
          setSaveStatus(`Saved at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
          onSaved?.();
        } catch {
          if (cancelled) return;
          setSaveStatus('Autosave failed');
        }
      })();
    }, 240);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [document, enabled, onSaved, setSaveStatus]);
}

function useKeyboardShortcuts(enabled: boolean): void {
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const deleteSelection = useEditorStore((state) => state.deleteSelection);
  const duplicateSelectedNode = useEditorStore((state) => state.duplicateSelectedNode);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }
      if (modifier && (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey))) {
        event.preventDefault();
        redo();
        return;
      }
      if (modifier && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateSelectedNode();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelection();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteSelection, duplicateSelectedNode, enabled, redo, undo]);
}

function MetricCard({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PlaceholderCard({ label, description }: { label: string; description: string }): JSX.Element {
  return (
    <article className="placeholder-card">
      <div className="placeholder-card__header">
        <strong>{label}</strong>
        <span className="status-pill">Placeholder</span>
      </div>
      <p>{description}</p>
    </article>
  );
}

function formatUpdatedAt(value: string): string {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function HomePage({
  charts,
  onCreateNew,
  onOpenChart,
  themeMode,
  onToggleTheme,
}: {
  charts: SavedDiagramRecord[];
  onCreateNew: () => void;
  onOpenChart: (chart: SavedDiagramRecord) => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
}): JSX.Element {
  const latestChart = charts[0];
  const totalNodes = charts.reduce((sum, chart) => sum + chart.nodeCount, 0);
  const totalEdges = charts.reduce((sum, chart) => sum + chart.edgeCount, 0);
  const latestUpdatedAt = latestChart ? formatUpdatedAt(latestChart.updatedAt) : 'No saved edits yet';
  const ThemeIcon = themeMode === 'dark' ? Sun : Moon;
  const workspaceHighlights = [
    {
      icon: Save,
      title: 'Local-first workspace',
      description: 'Stay in flow with autosave, quick reopen, and a cleaner launchpad for active diagrams.',
    },
    {
      icon: LayoutTemplate,
      title: 'Draw.io-inspired layout',
      description: 'Familiar chrome, clearer sidebars, and a stronger workspace hierarchy without leaving your color theme.',
    },
    {
      icon: ImageDown,
      title: 'Portable outputs',
      description: 'Export JSON or PNG from the same workspace you use to map and review the diagram.',
    },
  ];

  return (
    <div className="home-shell">
      <header className="surface-card surface-card--toolbar home-masthead">
        <div className="brand-lockup brand-lockup--home">
          <div className="brand-badge">
            <LayoutTemplate size={18} />
          </div>
          <div>
            <p className="eyebrow">{APP_NAME}</p>
            <strong className="brand-lockup__title">{APP_NAME}</strong>
            <p className="brand-lockup__subtitle">{APP_MEANING}</p>
          </div>
        </div>
        <button className="status-pill status-pill--button" onClick={onToggleTheme} type="button">
          <ThemeIcon size={14} />
          {themeMode === 'dark' ? 'Light theme' : 'Dark theme'}
        </button>
      </header>

      <section className="surface-card home-hero">
        <div className="home-hero__copy">
          <p className="eyebrow">Workflow studio</p>
          <h1>Reranga gives your team a draw.io-style workspace with a calmer flow state.</h1>
          <p>
            Build, reopen, and refine diagrams from a layout that feels familiar while staying aligned with your own visual
            theme.
          </p>
          <div className="home-hero__meta">
            <span className="status-pill">{charts.length} saved chart{charts.length === 1 ? '' : 's'}</span>
            <span className="status-pill">{totalNodes} mapped steps</span>
            <span className="status-pill">{totalEdges} connected paths</span>
          </div>
          <div className="home-hero__actions">
            <button className="hero-button hero-button--primary" onClick={onCreateNew} type="button">
              <Plus size={16} />
              New blank chart
            </button>
            {latestChart ? (
              <button className="hero-button" onClick={() => onOpenChart(latestChart)} type="button">
                <PenSquare size={16} />
                Continue latest chart
              </button>
            ) : null}
          </div>
        </div>

        <aside className="home-hero__summary">
          <div className="home-summary-card">
            <span className="home-summary-card__label">Latest activity</span>
            <strong>{latestChart?.name ?? 'Create your first reranga'}</strong>
            <p>{latestUpdatedAt}</p>
          </div>

          <div className="workspace-preview">
            <div className="workspace-preview__header">
              <strong>Workspace preview</strong>
              <span className="status-pill">Inspired by draw.io</span>
            </div>
            <div className="workspace-preview__layout">
              <div className="workspace-preview__rail">
                <span>Shapes</span>
                <span>Pages</span>
                <span>Notes</span>
              </div>
              <div className="workspace-preview__canvas">
                <span>Canvas</span>
                <div className="workspace-preview__grid" />
              </div>
              <div className="workspace-preview__rail workspace-preview__rail--right">
                <span>Overview</span>
                <span>Format</span>
                <span>Layers</span>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <div className="home-layout">
        <section className="surface-card home-section">
          <div className="section-header">
            <div>
              <h2>Recent charts</h2>
              <p>Resume where you left off from a cleaner, more workspace-driven dashboard.</p>
            </div>
            <span className="status-pill">{charts.length} saved</span>
          </div>

          {!charts.length ? (
            <div className="home-empty">
              <FolderOpen size={18} />
              <div>
                <strong>No saved charts yet</strong>
                <p>Create a new chart to start your first reranga.</p>
              </div>
            </div>
          ) : (
            <div className="home-grid">
              {charts.map((chart) => (
                <article key={chart.id} className="chart-card">
                  <div className="chart-card__header">
                    <div>
                      <h3>{chart.name}</h3>
                      <p>{formatUpdatedAt(chart.updatedAt)}</p>
                    </div>
                    <Clock3 size={16} />
                  </div>
                  <div className="chart-card__stats">
                    <span>{chart.nodeCount} steps</span>
                    <span>{chart.edgeCount} links</span>
                    <span>v{DOCUMENT_VERSION}</span>
                  </div>
                  <button className="chart-card__action" onClick={() => onOpenChart(chart)} type="button">
                    <PenSquare size={16} />
                    Open chart
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="home-rail">
          <section className="surface-card home-section">
            <div className="section-header">
              <div>
                <h2>Workspace standards</h2>
                <p>Every card and container now follows the same spacing, borders, and surface treatment.</p>
              </div>
              <Sparkles size={16} />
            </div>
            <div className="home-highlight-list">
              {workspaceHighlights.map(({ icon: Icon, title, description }) => (
                <article key={title} className="home-highlight-card">
                  <span className="home-highlight-card__icon">
                    <Icon size={16} />
                  </span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="surface-card home-section">
            <div className="section-header">
              <div>
                <h2>Placeholders</h2>
                <p>Draw.io features we do not support yet stay visible as clearly labeled placeholders.</p>
              </div>
              <Clock3 size={16} />
            </div>
            <div className="placeholder-list">
              {PLACEHOLDER_FEATURES.map((feature) => (
                <PlaceholderCard key={feature.label} label={feature.label} description={feature.description} />
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function PropertiesPanel(): JSX.Element {
  const document = useEditorStore((state) => state.document);
  const selection = useEditorStore((state) => state.selection);
  const updateSelectedNode = useEditorStore((state) => state.updateSelectedNode);
  const updateSelectedEdge = useEditorStore((state) => state.updateSelectedEdge);
  const duplicateSelectedNode = useEditorStore((state) => state.duplicateSelectedNode);
  const deleteSelection = useEditorStore((state) => state.deleteSelection);

  const selectedNode = document.nodes.find((node) => node.id === selection.nodeId);
  const selectedEdge = document.edges.find((edge) => edge.id === selection.edgeId);
  const metrics = useMemo(() => getDiagramMetrics(document), [document]);

  return (
    <aside className="sidebar sidebar-right">
      <section className="panel">
        <div className="panel__header">
          <span>Overview</span>
          <Sparkles size={16} />
        </div>
        <div className="metrics-grid">
          <MetricCard label="Nodes" value={metrics.totalNodes} />
          <MetricCard label="Connections" value={metrics.totalEdges} />
          <MetricCard label="Decisions" value={metrics.decisionNodes} />
          <MetricCard label="Terminals" value={metrics.terminalNodes} />
        </div>
        <p className="panel__note">
          {metrics.disconnectedNodes === 0
            ? 'No isolated steps detected.'
            : `${metrics.disconnectedNodes} step${metrics.disconnectedNodes === 1 ? '' : 's'} still need to be connected.`}
        </p>
      </section>

      <section className="panel">
        <div className="panel__header">
          <span>Format &amp; data</span>
          <Braces size={16} />
        </div>

        {!selectedNode && !selectedEdge && (
          <div className="empty-state">
            <h3>Select a node or connection</h3>
            <p>Use the canvas to adjust labels, ownership, notes, and connection details from this format panel.</p>
          </div>
        )}

        {selectedNode && (
          <div className="inspector-form">
            <label>
              Label
              <input value={selectedNode.data.label} onChange={(event) => updateSelectedNode({ label: event.target.value })} />
            </label>
            <label>
              Description
              <textarea value={selectedNode.data.description} onChange={(event) => updateSelectedNode({ description: event.target.value })} rows={4} />
            </label>
            <label>
              Owner
              <input value={selectedNode.data.owner} onChange={(event) => updateSelectedNode({ owner: event.target.value })} />
            </label>
            <label>
              Status
              <select value={selectedNode.data.status} onChange={(event) => updateSelectedNode({ status: event.target.value as FlowNode['data']['status'] })}>
                <option value="planned">Planned</option>
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
            </label>
            <label>
              Accent
              <input value={selectedNode.data.accent} onChange={(event) => updateSelectedNode({ accent: event.target.value })} />
            </label>
            <label>
              Notes
              <textarea value={selectedNode.data.notes} onChange={(event) => updateSelectedNode({ notes: event.target.value })} rows={3} />
            </label>
            <div className="panel-actions">
              <button className="secondary" onClick={duplicateSelectedNode} type="button">Duplicate</button>
              <button className="danger" onClick={deleteSelection} type="button">Delete</button>
            </div>
          </div>
        )}

        {selectedEdge && (
          <div className="inspector-form">
            <label>
              Label
              <input value={selectedEdge.data?.label ?? ''} onChange={(event) => updateSelectedEdge({ label: event.target.value })} />
            </label>
            <label>
              Condition
              <textarea value={selectedEdge.data?.condition ?? ''} onChange={(event) => updateSelectedEdge({ condition: event.target.value })} rows={3} />
            </label>
            <label>
              Risk
              <select value={selectedEdge.data?.risk ?? 'low'} onChange={(event) => updateSelectedEdge({ risk: event.target.value as EdgeRisk })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="checkbox">
              <input
                checked={selectedEdge.animated ?? false}
                onChange={(event) => updateSelectedEdge({ animated: event.target.checked })}
                type="checkbox"
              />
              Animate connection
            </label>
            <div className="panel-actions">
              <button className="danger" onClick={deleteSelection} type="button">Delete connection</button>
            </div>
          </div>
        )}
      </section>

      <section className="panel panel--compact">
        <div className="panel__header">
          <span>Draw.io placeholders</span>
          <Clock3 size={16} />
        </div>
        <div className="placeholder-list">
          {PLACEHOLDER_FEATURES.map((feature) => (
            <PlaceholderCard key={feature.label} label={feature.label} description={feature.description} />
          ))}
        </div>
      </section>
    </aside>
  );
}

function Canvas({
  onReady,
  themeMode,
}: {
  onReady: (instance: ReactFlowInstance<FlowNode, FlowEdge>) => void;
  themeMode: ThemeMode;
}): JSX.Element {
  const document = useEditorStore((state) => state.document);
  const onNodesChange = useEditorStore((state) => state.onNodesChange);
  const onEdgesChange = useEditorStore((state) => state.onEdgesChange);
  const connect = useEditorStore((state) => state.connect);
  const setViewport = useEditorStore((state) => state.setViewport);
  const syncSelection = useEditorStore((state) => state.syncSelection);
  const snapshotCurrent = useEditorStore((state) => state.snapshotCurrent);
  const isDarkTheme = themeMode === 'dark';
  const canvasGridColor = 'var(--canvas-grid)';
  const minimapMaskColor = 'var(--minimap-mask)';

  return (
    <ReactFlow
      nodes={document.nodes}
      edges={document.edges}
      viewport={document.viewport}
      onInit={onReady}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={connect}
      onMoveEnd={(_event, viewport: Viewport) => setViewport(viewport)}
      onSelectionChange={syncSelection}
      onNodeDragStart={snapshotCurrent}
      fitView
      minZoom={0.3}
      maxZoom={2.5}
      nodeTypes={nodeTypes}
      colorMode={isDarkTheme ? 'dark' : 'light'}
      defaultEdgeOptions={{ type: 'smoothstep', animated: false }}
    >
      <MiniMap
        pannable
        zoomable
        nodeColor={(node) => String(node.data?.accent ?? '#0D6EFD')}
        maskColor={minimapMaskColor}
      />
      <Controls showInteractive={false} />
      <Background color={canvasGridColor} gap={24} size={1.1} />
    </ReactFlow>
  );
}

function RerangaApp(): JSX.Element {
  const { themeMode, toggleThemeMode } = useThemeMode();
  const [screen, setScreen] = useState<'home' | 'editor'>('home');
  const [savedCharts, setSavedCharts] = useState<SavedDiagramRecord[]>([]);
  const [reactFlow, setReactFlow] = useState<ReactFlowInstance<FlowNode, FlowEdge> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shouldFitView, setShouldFitView] = useState(false);

  const refreshSavedCharts = useCallback(async () => {
    const charts = await listStoredDocuments();
    setSavedCharts(charts);
  }, []);

  useAutosave(screen === 'editor', refreshSavedCharts);
  useKeyboardShortcuts(screen === 'editor');

  const document = useEditorStore((state) => state.document);
  const saveStatus = useEditorStore((state) => state.saveStatus);
  const history = useEditorStore((state) => state.history);
  const future = useEditorStore((state) => state.future);
  const addNode = useEditorStore((state) => state.addNode);
  const autoLayout = useEditorStore((state) => state.autoLayout);
  const renameDiagram = useEditorStore((state) => state.renameDiagram);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const resetDocument = useEditorStore((state) => state.resetDocument);
  const importDocument = useEditorStore((state) => state.importDocument);
  const deleteSelection = useEditorStore((state) => state.deleteSelection);
  const ThemeIcon = themeMode === 'dark' ? Sun : Moon;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const metrics = useMemo(() => getDiagramMetrics(document), [document]);

  useEffect(() => {
    if (screen !== 'editor' || !reactFlow || !shouldFitView) return;
    window.requestAnimationFrame(() => {
      reactFlow.fitView({ padding: 0.18, duration: 300 });
      setShouldFitView(false);
    });
  }, [reactFlow, screen, shouldFitView]);

  useEffect(() => {
    void refreshSavedCharts();
  }, [refreshSavedCharts]);

  const runAutoLayout = (direction: 'TB' | 'LR') => {
    autoLayout(direction);
    window.requestAnimationFrame(() => {
      reactFlow?.fitView({ padding: 0.18, duration: 300 });
    });
  };

  const openImport = () => fileInputRef.current?.click();

  const openChart = (chart: SavedDiagramRecord) => {
    importDocument(chart.document);
    setNotice(null);
    setScreen('editor');
    setShouldFitView(true);
  };

  const createNewChart = () => {
    resetDocument();
    setNotice(null);
    setScreen('editor');
    setShouldFitView(true);
  };

  const goHome = () => {
    void (async () => {
      try {
        await saveStoredDocument(document);
        await refreshSavedCharts();
        setScreen('home');
      } catch (error) {
        setNotice(`Save failed: ${getErrorMessage(error)}`);
      }
    })();
  };

  if (screen === 'home') {
    return (
      <HomePage
        charts={savedCharts}
        onCreateNew={createNewChart}
        onOpenChart={openChart}
        themeMode={themeMode}
        onToggleTheme={toggleThemeMode}
      />
    );
  }

  return (
    <div className="editor-shell">
      <header className="surface-card surface-card--toolbar editor-menubar">
        <div className="editor-menubar__brand">
          <div className="brand-lockup">
            <div className="brand-badge">
              <LayoutTemplate size={18} />
            </div>
            <div>
              <p className="eyebrow">{APP_NAME}</p>
              <strong className="brand-lockup__title">{APP_NAME}</strong>
              <p className="brand-lockup__subtitle">{APP_MEANING}</p>
            </div>
          </div>
        </div>

        <nav aria-label="Workspace menu" className="editor-menu">
          {DRAWER_MENU_ITEMS.map((item) => (
            <span key={item} className="editor-menu__item">{item}</span>
          ))}
        </nav>

        <div className="editor-menubar__meta">
          <span className="status-pill">{saveStatus}</span>
          <span className="status-pill">{metrics.totalNodes} steps</span>
          <span className="status-pill">{metrics.totalEdges} links</span>
          {notice ? <span className="status-pill status-pill--notice">{notice}</span> : null}
        </div>
      </header>

      <div className="surface-card surface-card--toolbar editor-toolbar">
        <div className="editor-toolbar__group">
          <button className="toolbar-button" onClick={goHome} type="button">
            <ArrowLeft size={16} />
            Back
          </button>
          <button className="toolbar-button" onClick={toggleThemeMode} type="button">
            <ThemeIcon size={16} />
            {themeMode === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button className="toolbar-button" onClick={createNewChart} type="button">
            <House size={16} />
            New
          </button>
        </div>

        <div className="editor-toolbar__group">
          <button className="toolbar-button" disabled={!history.length} onClick={undo} type="button">
            <Undo2 size={16} />
            Undo
          </button>
          <button className="toolbar-button" disabled={!future.length} onClick={redo} type="button">
            <Redo2 size={16} />
            Redo
          </button>
          <button className="toolbar-button" onClick={resetDocument} type="button">
            <RotateCcw size={16} />
            Reset
          </button>
        </div>

        <div className="editor-toolbar__group">
          <button className="toolbar-button" onClick={() => runAutoLayout('TB')} type="button">
            <LayoutTemplate size={16} />
            Stack
          </button>
          <button className="toolbar-button" onClick={() => runAutoLayout('LR')} type="button">
            <LayoutTemplate size={16} />
            Side
          </button>
          <button className="toolbar-button" onClick={() => reactFlow?.fitView({ padding: 0.18, duration: 300 })} type="button">
            <Sparkles size={16} />
            Fit
          </button>
        </div>

        <div className="editor-toolbar__group">
          <button className="toolbar-button" onClick={() => {
            downloadDocument(document);
            setNotice('JSON exported');
          }} type="button">
            <Download size={16} />
            JSON
          </button>
          <button className="toolbar-button" onClick={async () => {
            if (!canvasRef.current) return;
            await exportCanvasToPng(canvasRef.current, document);
            setNotice('PNG exported');
          }} type="button">
            <ImageDown size={16} />
            PNG
          </button>
          <button className="toolbar-button" onClick={openImport} type="button">
            <Upload size={16} />
            Import
          </button>
          <button className="toolbar-button" onClick={async () => {
            await navigator.clipboard.writeText(getImportTemplate());
            setNotice('Import template copied');
          }} type="button">
            <Braces size={16} />
            Template
          </button>
        </div>

        <div className="editor-toolbar__group editor-toolbar__group--placeholder">
          {PLACEHOLDER_FEATURES.map((feature) => (
            <button key={feature.label} className="toolbar-button toolbar-button--placeholder" disabled type="button">
              {feature.label}
            </button>
          ))}
        </div>
      </div>

      <div className="workspace">
        <aside className="sidebar sidebar-left">
          <section className="panel">
            <div className="panel__header">
              <span>Shapes</span>
              <Plus size={16} />
            </div>
            <p className="panel__intro">Choose a starting block, then refine its details from the format panel.</p>
            <div className="library-list">
              {NODE_LIBRARY.map((item) => (
                <button key={item.kind} className="library-card" onClick={() => addNode(item.kind)} type="button">
                  <span className="library-card__dot" style={{ background: item.accent }} />
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="panel panel--compact">
            <div className="panel__header">
              <span>Pages</span>
              <Clock3 size={16} />
            </div>
            <div className="placeholder-list">
              <PlaceholderCard
                label="Single canvas"
                description="Multi-page navigation is still a placeholder, so the layout feels familiar without implying full support."
              />
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <span>Workspace notes</span>
              <Save size={16} />
            </div>
            <p className="panel__note">
              Autosave and saved diagrams stay in your browser&apos;s local database, while exports remain portable for handoff or backup.
            </p>
            <p className="panel__note">
              {IMPORT_FORMAT_NOTE} Use <strong>Template</strong> when you want a model to generate an import file that opens cleanly here.
            </p>
            <button className="toolbar-button toolbar-button--wide" onClick={async () => {
              await navigator.clipboard.writeText(JSON.stringify(document, null, 2));
              setNotice('JSON copied');
            }} type="button">
              <Braces size={16} />
              Copy JSON
            </button>
          </section>
        </aside>

        <main className="canvas-shell">
          <div className="canvas-shell__tabs">
            <span className="canvas-tab canvas-tab--active">{document.meta.name}</span>
            <span className="canvas-tab canvas-tab--placeholder">Layers placeholder</span>
            <span className="canvas-tab canvas-tab--placeholder">Comments placeholder</span>
          </div>

          <div className="canvas-shell__chrome">
            <div>
              <strong>Diagram canvas</strong>
              <p>Map handoffs, capture decisions, and keep the diagram readable as it grows.</p>
            </div>
            <div className="canvas-shell__actions">
              <span className="status-pill">Schema v{DOCUMENT_VERSION}</span>
              <button className="canvas-shell__delete" onClick={deleteSelection} type="button">
                <Trash2 size={16} />
                Delete selected
              </button>
            </div>
          </div>

          <div className="canvas-titlebar">
            <input
              aria-label="Diagram name"
              className="diagram-title"
              onChange={(event) => renameDiagram(event.target.value)}
              value={document.meta.name}
            />
          </div>

          <div className="canvas-frame" ref={canvasRef}>
            <ReactFlowProvider>
              <Canvas onReady={setReactFlow} themeMode={themeMode} />
            </ReactFlowProvider>
          </div>
        </main>

        <PropertiesPanel />
      </div>

      <input
        accept="application/json,.json"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            const next = await readDocumentFromFile(file);
            importDocument(next);
            setNotice('Diagram imported');
            setShouldFitView(true);
          } catch (error) {
            setNotice(`Import failed: ${getErrorMessage(error)}`);
          }
          event.currentTarget.value = '';
        }}
        ref={fileInputRef}
        type="file"
      />
    </div>
  );
}

export default function App(): JSX.Element {
  return <RerangaApp />;
}
