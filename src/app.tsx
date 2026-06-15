import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, type ReactFlowInstance, type Viewport } from '@xyflow/react';
import { ArrowLeft, Braces, Clock3, Download, FolderOpen, House, ImageDown, LayoutTemplate, PenSquare, Plus, Redo2, RotateCcw, Save, Sparkles, Trash2, Undo2, Upload } from 'lucide-react';
import { FlowNodeCard } from './components/flow-node';
import { DOCUMENT_VERSION, NODE_LIBRARY, getDiagramMetrics } from './lib/diagram';
import { downloadDocument, exportCanvasToPng, listStoredDocuments, readDocumentFromFile, saveStoredDocument } from './lib/persistence';
import { useEditorStore } from './store/editor-store';
import type { EdgeRisk, FlowEdge, FlowNode, SavedDiagramRecord } from './types';

const nodeTypes = { flowNode: FlowNodeCard };

function usePrefersDarkMode(): boolean {
  const [prefersDarkMode, setPrefersDarkMode] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updatePreference = (event: MediaQueryListEvent) => {
      setPrefersDarkMode(event.matches);
    };

    setPrefersDarkMode(mediaQuery.matches);
    mediaQuery.addEventListener('change', updatePreference);
    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  return prefersDarkMode;
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
    const timer = window.setTimeout(() => {
      saveStoredDocument(document);
      setSaveStatus(`Saved at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      onSaved?.();
    }, 240);

    return () => window.clearTimeout(timer);
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
}: {
  charts: SavedDiagramRecord[];
  onCreateNew: () => void;
  onOpenChart: (chart: SavedDiagramRecord) => void;
}): JSX.Element {
  const latestChart = charts[0];
  const totalNodes = charts.reduce((sum, chart) => sum + chart.nodeCount, 0);
  const totalEdges = charts.reduce((sum, chart) => sum + chart.edgeCount, 0);
  const latestUpdatedAt = latestChart ? formatUpdatedAt(latestChart.updatedAt) : 'No saved edits yet';
  const workspaceHighlights = [
    {
      icon: Save,
      title: 'Local autosave',
      description: 'Keep working without manual checkpoints while your latest version stays ready to reopen.',
    },
    {
      icon: LayoutTemplate,
      title: 'Structured editing',
      description: 'Use layout tools, reusable node types, and inline properties to keep diagrams clean.',
    },
    {
      icon: ImageDown,
      title: 'Portable outputs',
      description: 'Export JSON for reuse or PNG for sharing updates with stakeholders and delivery teams.',
    },
  ];

  return (
    <div className="home-shell">
      <header className="home-hero">
        <div className="home-hero__copy">
          <p className="eyebrow">Workflow Studio</p>
          <h1>Design, revisit, and hand off polished flowcharts from one professional workspace.</h1>
          <p>
            Build from scratch, resume active diagrams, and keep local process maps ready for fast iteration, stakeholder review, and export.
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
            <strong>{latestChart?.name ?? 'Create your first workflow'}</strong>
            <p>{latestUpdatedAt}</p>
          </div>
          <div className="home-summary-grid">
            <div className="home-summary-stat">
              <span>Workspace</span>
              <strong>{charts.length}</strong>
              <p>Saved diagrams</p>
            </div>
            <div className="home-summary-stat">
              <span>Coverage</span>
              <strong>{totalNodes}</strong>
              <p>Total flow steps</p>
            </div>
            <div className="home-summary-stat">
              <span>Links</span>
              <strong>{totalEdges}</strong>
              <p>Connected paths</p>
            </div>
          </div>
        </aside>
      </header>

      <div className="home-layout">
        <section className="home-section">
          <div className="home-section__header">
            <div>
              <h2>Recent charts</h2>
              <p>Open any saved diagram and continue editing from where you left off.</p>
            </div>
            <span className="status-pill">{charts.length} saved</span>
          </div>

          {!charts.length ? (
            <div className="home-empty">
              <FolderOpen size={18} />
              <div>
                <strong>No saved charts yet</strong>
                <p>Create a new chart to start building your local workspace library.</p>
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
                    Edit chart
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="home-rail">
          <section className="home-section home-section--stacked">
            <div className="home-section__header">
              <div>
                <h2>Workspace standards</h2>
                <p>Everything you need to keep flowcharts polished and ready to share.</p>
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
          <span>Inspector</span>
          <Braces size={16} />
        </div>

        {!selectedNode && !selectedEdge && (
          <div className="empty-state">
            <h3>Select a node or connection</h3>
            <p>Use the canvas to edit labels, ownership, annotations, and risk details in place.</p>
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
    </aside>
  );
}

function Canvas({
  onReady,
  prefersDarkMode,
}: {
  onReady: (instance: ReactFlowInstance<FlowNode, FlowEdge>) => void;
  prefersDarkMode: boolean;
}): JSX.Element {
  const document = useEditorStore((state) => state.document);
  const onNodesChange = useEditorStore((state) => state.onNodesChange);
  const onEdgesChange = useEditorStore((state) => state.onEdgesChange);
  const connect = useEditorStore((state) => state.connect);
  const setViewport = useEditorStore((state) => state.setViewport);
  const syncSelection = useEditorStore((state) => state.syncSelection);
  const snapshotCurrent = useEditorStore((state) => state.snapshotCurrent);
  const canvasGridColor = prefersDarkMode ? '#2B2B2B' : '#E9ECEF';
  const minimapMaskColor = prefersDarkMode ? 'rgba(18, 18, 18, 0.72)' : 'rgba(248, 249, 250, 0.82)';

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
      colorMode={prefersDarkMode ? 'dark' : 'light'}
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

function FlowcraftApp(): JSX.Element {
  const prefersDarkMode = usePrefersDarkMode();
  const [screen, setScreen] = useState<'home' | 'editor'>('home');
  const [savedCharts, setSavedCharts] = useState<SavedDiagramRecord[]>(() => listStoredDocuments());
  const [reactFlow, setReactFlow] = useState<ReactFlowInstance<FlowNode, FlowEdge> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shouldFitView, setShouldFitView] = useState(false);

  const refreshSavedCharts = useCallback(() => {
    setSavedCharts(listStoredDocuments());
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
    saveStoredDocument(document);
    refreshSavedCharts();
    setScreen('home');
  };

  if (screen === 'home') {
    return <HomePage charts={savedCharts} onCreateNew={createNewChart} onOpenChart={openChart} />;
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-lockup__row">
            <button className="icon-button" onClick={goHome} type="button">
              <ArrowLeft size={16} />
            </button>
            <p className="eyebrow">Workflow Studio</p>
          </div>
          <p className="brand-lockup__subtitle">A calmer workspace for shaping process maps, annotations, and export-ready diagrams.</p>
          <input
            aria-label="Diagram name"
            className="diagram-title"
            onChange={(event) => renameDiagram(event.target.value)}
            value={document.meta.name}
          />
        </div>

        <div className="topbar__meta">
          <button className="status-pill status-pill--button" onClick={goHome} type="button">
            <House size={14} />
            Home
          </button>
          <span className="status-pill">{saveStatus}</span>
          <span className="status-pill">{metrics.totalNodes} steps</span>
          <span className="status-pill">{metrics.totalEdges} links</span>
          <span className="status-pill">Schema v{DOCUMENT_VERSION}</span>
          {notice ? <span className="status-pill status-pill--notice">{notice}</span> : null}
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar sidebar-left">
          <section className="panel">
            <div className="panel__header">
              <span>Building blocks</span>
              <Plus size={16} />
            </div>
            <p className="panel__intro">Choose a starting shape, then adjust the details from the inspector.</p>
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

          <section className="panel">
            <div className="panel__header">
              <span>Workspace tools</span>
              <LayoutTemplate size={16} />
            </div>
            <div className="action-grid">
              <button onClick={undo} disabled={!history.length} type="button"><Undo2 size={16} />Undo</button>
              <button onClick={redo} disabled={!future.length} type="button"><Redo2 size={16} />Redo</button>
              <button onClick={() => runAutoLayout('TB')} type="button"><LayoutTemplate size={16} />Stack layout</button>
              <button onClick={() => runAutoLayout('LR')} type="button"><LayoutTemplate size={16} />Side layout</button>
              <button onClick={() => reactFlow?.fitView({ padding: 0.18, duration: 300 })} type="button"><Sparkles size={16} />Fit canvas</button>
              <button onClick={resetDocument} type="button"><RotateCcw size={16} />Reset</button>
            </div>
          </section>

          <section className="panel panel--compact">
            <div className="panel__header">
              <span>Outputs</span>
              <Save size={16} />
            </div>
            <div className="action-grid action-grid--compact">
              <button onClick={() => {
                downloadDocument(document);
                setNotice('JSON exported');
              }} type="button"><Download size={16} />Export JSON</button>
              <button onClick={async () => {
                if (!canvasRef.current) return;
                await exportCanvasToPng(canvasRef.current, document);
                setNotice('PNG exported');
              }} type="button"><ImageDown size={16} />Export PNG</button>
              <button onClick={openImport} type="button"><Upload size={16} />Import JSON</button>
              <button onClick={async () => {
                await navigator.clipboard.writeText(JSON.stringify(document, null, 2));
                setNotice('JSON copied');
              }} type="button"><Braces size={16} />Copy JSON</button>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <span>Workspace notes</span>
              <Sparkles size={16} />
            </div>
            <p className="panel__note">
              Autosave stays local, exports remain portable, and the canvas is tuned for fast diagram edits without changing your workflow.
            </p>
          </section>
        </aside>

        <main className="canvas-shell">
          <div className="canvas-shell__chrome">
            <div>
              <strong>Canvas</strong>
              <p>Map handoffs, capture decisions, and keep the diagram readable as it grows.</p>
            </div>
            <button className="canvas-shell__delete" onClick={deleteSelection} type="button">
              <Trash2 size={16} />
              Delete selected
            </button>
          </div>
          <div className="canvas-frame" ref={canvasRef}>
            <ReactFlowProvider>
              <Canvas onReady={setReactFlow} prefersDarkMode={prefersDarkMode} />
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
          } catch {
            setNotice('Import failed: invalid diagram JSON');
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
  return <FlowcraftApp />;
}
