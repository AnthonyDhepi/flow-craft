import { useMemo, useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { getDiagramMetrics } from '../lib/diagram';
import { useEditorStore } from '../store/editor-store';
import type { EdgeRisk, FlowNode } from '../types';

const ACCENT_SWATCHES = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#64748b'];

type Tab = 'element' | 'diagram';

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
    </label>
  );
}

function NodeForm(): JSX.Element {
  const selection = useEditorStore((state) => state.selection);
  const node = useEditorStore((state) => state.document.nodes.find((entry) => entry.id === state.selection.nodeId));
  const updateSelectedNode = useEditorStore((state) => state.updateSelectedNode);
  const duplicateSelectedNode = useEditorStore((state) => state.duplicateSelectedNode);
  const deleteSelection = useEditorStore((state) => state.deleteSelection);

  if (!node || !selection.nodeId) return <></>;

  return (
    <div className="inspector__form">
      <Field label="Label">
        <input value={node.data.label} onChange={(event) => updateSelectedNode({ label: event.target.value })} />
      </Field>
      <Field label="Description">
        <textarea rows={3} value={node.data.description} onChange={(event) => updateSelectedNode({ description: event.target.value })} />
      </Field>
      <div className="field-row">
        <Field label="Owner">
          <input value={node.data.owner} onChange={(event) => updateSelectedNode({ owner: event.target.value })} />
        </Field>
        <Field label="Status">
          <select
            value={node.data.status}
            onChange={(event) => updateSelectedNode({ status: event.target.value as FlowNode['data']['status'] })}
          >
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
          </select>
        </Field>
      </div>
      <Field label="Accent">
        <div className="swatches">
          {ACCENT_SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              className={`swatch ${node.data.accent.toLowerCase() === color ? 'swatch--active' : ''}`}
              style={{ background: color }}
              aria-label={`Accent ${color}`}
              onClick={() => updateSelectedNode({ accent: color })}
            />
          ))}
          <input
            className="swatch-input"
            type="color"
            value={node.data.accent}
            onChange={(event) => updateSelectedNode({ accent: event.target.value })}
            aria-label="Custom accent"
          />
        </div>
      </Field>
      <Field label="Notes">
        <textarea rows={2} value={node.data.notes} onChange={(event) => updateSelectedNode({ notes: event.target.value })} />
      </Field>
      <div className="inspector__actions">
        <button className="btn btn--ghost" onClick={duplicateSelectedNode} type="button">
          <Copy size={15} /> Duplicate
        </button>
        <button className="btn btn--danger" onClick={deleteSelection} type="button">
          <Trash2 size={15} /> Delete
        </button>
      </div>
    </div>
  );
}

function EdgeForm(): JSX.Element {
  const selection = useEditorStore((state) => state.selection);
  const edge = useEditorStore((state) => state.document.edges.find((entry) => entry.id === state.selection.edgeId));
  const updateSelectedEdge = useEditorStore((state) => state.updateSelectedEdge);
  const deleteSelection = useEditorStore((state) => state.deleteSelection);

  if (!edge || !selection.edgeId) return <></>;

  return (
    <div className="inspector__form">
      <Field label="Label">
        <input value={edge.data?.label ?? ''} onChange={(event) => updateSelectedEdge({ label: event.target.value })} />
      </Field>
      <Field label="Condition">
        <textarea rows={2} value={edge.data?.condition ?? ''} onChange={(event) => updateSelectedEdge({ condition: event.target.value })} />
      </Field>
      <Field label="Risk">
        <select value={edge.data?.risk ?? 'low'} onChange={(event) => updateSelectedEdge({ risk: event.target.value as EdgeRisk })}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </Field>
      <label className="toggle">
        <input
          type="checkbox"
          checked={edge.animated ?? false}
          onChange={(event) => updateSelectedEdge({ animated: event.target.checked })}
        />
        <span>Animate connection</span>
      </label>
      <div className="inspector__actions">
        <button className="btn btn--danger" onClick={deleteSelection} type="button">
          <Trash2 size={15} /> Delete connection
        </button>
      </div>
    </div>
  );
}

function DiagramForm(): JSX.Element {
  const document = useEditorStore((state) => state.document);
  const updateDiagramMeta = useEditorStore((state) => state.updateDiagramMeta);
  const metrics = useMemo(() => getDiagramMetrics(document), [document]);

  return (
    <div className="inspector__form">
      <Field label="Name">
        <input value={document.meta.name} onChange={(event) => updateDiagramMeta({ name: event.target.value })} />
      </Field>
      <Field label="Description">
        <textarea
          rows={3}
          placeholder="What does this flow describe?"
          value={document.meta.description}
          onChange={(event) => updateDiagramMeta({ description: event.target.value })}
        />
      </Field>
      <div className="metric-grid">
        <div className="metric"><span>Steps</span><strong>{metrics.totalNodes}</strong></div>
        <div className="metric"><span>Connections</span><strong>{metrics.totalEdges}</strong></div>
        <div className="metric"><span>Decisions</span><strong>{metrics.decisionNodes}</strong></div>
        <div className="metric"><span>Endpoints</span><strong>{metrics.terminalNodes}</strong></div>
      </div>
      <div className={`health ${metrics.disconnectedNodes ? 'health--warn' : 'health--ok'}`}>
        {metrics.disconnectedNodes === 0
          ? 'Every step is connected.'
          : `${metrics.disconnectedNodes} step${metrics.disconnectedNodes === 1 ? '' : 's'} not yet connected.`}
      </div>
    </div>
  );
}

export function Inspector(): JSX.Element {
  const selection = useEditorStore((state) => state.selection);
  const hasSelection = Boolean(selection.nodeId || selection.edgeId);
  const [manualTab, setManualTab] = useState<Tab | null>(null);
  const tab: Tab = manualTab ?? (hasSelection ? 'element' : 'diagram');

  return (
    <aside className="inspector">
      <div className="inspector__tabs">
        <button
          className={`inspector__tab ${tab === 'element' ? 'is-active' : ''}`}
          onClick={() => setManualTab('element')}
          type="button"
        >
          Element
        </button>
        <button
          className={`inspector__tab ${tab === 'diagram' ? 'is-active' : ''}`}
          onClick={() => setManualTab('diagram')}
          type="button"
        >
          Diagram
        </button>
      </div>

      <div className="inspector__body">
        {tab === 'element' ? (
          selection.nodeId ? (
            <NodeForm />
          ) : selection.edgeId ? (
            <EdgeForm />
          ) : (
            <div className="inspector__empty">
              <h3>Nothing selected</h3>
              <p>Pick a step or connection on the canvas to edit its details here.</p>
            </div>
          )
        ) : (
          <DiagramForm />
        )}
      </div>
    </aside>
  );
}
