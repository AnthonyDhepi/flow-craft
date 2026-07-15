import { useMemo, useState } from 'react';
import {
  Clock, Copy, Download, GitBranch, Moon, PanelsTopLeft, Plus, Search, Sun, Trash2, Waypoints,
} from 'lucide-react';
import type { ThemeMode } from '../hooks';
import { FLOW_TEMPLATES, type FlowTemplate } from '../lib/templates';
import type { SavedDiagramRecord } from '../types';

function formatUpdatedAt(value: string): string {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return 'Unknown';
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function Dashboard({
  charts,
  theme,
  toggleTheme,
  onNew,
  onOpen,
  onDuplicate,
  onDelete,
  onExport,
  onUseTemplate,
}: {
  charts: SavedDiagramRecord[];
  theme: ThemeMode;
  toggleTheme: () => void;
  onNew: () => void;
  onOpen: (chart: SavedDiagramRecord) => void;
  onDuplicate: (chart: SavedDiagramRecord) => void;
  onDelete: (chart: SavedDiagramRecord) => void;
  onExport: (chart: SavedDiagramRecord) => void;
  onUseTemplate: (template: FlowTemplate) => void;
}): JSX.Element {
  const [query, setQuery] = useState('');
  const ThemeIcon = theme === 'dark' ? Sun : Moon;

  const totals = useMemo(() => ({
    diagrams: charts.length,
    steps: charts.reduce((sum, chart) => sum + chart.nodeCount, 0),
    links: charts.reduce((sum, chart) => sum + chart.edgeCount, 0),
  }), [charts]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return charts;
    return charts.filter((chart) =>
      `${chart.name} ${chart.document.meta.description}`.toLowerCase().includes(needle),
    );
  }, [charts, query]);

  return (
    <div className="dashboard">
      <header className="dashboard__bar">
        <div className="brand">
          <span className="brand__mark"><PanelsTopLeft size={20} /></span>
          <div className="brand__text">
            <strong>FlowCraft</strong>
            <span>Flowchart studio</span>
          </div>
        </div>
        <div className="dashboard__bar-actions">
          <button className="icon-btn" onClick={toggleTheme} type="button" title="Toggle theme" aria-label="Toggle theme">
            <ThemeIcon size={18} />
          </button>
          <button className="btn btn--primary" onClick={onNew} type="button">
            <Plus size={16} /> New diagram
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero__copy">
          <h1>Design workflows that explain themselves.</h1>
          <p>
            Map processes, handoffs, and decision trees on an infinite canvas. Everything is saved
            locally in your browser and exports cleanly to JSON or PNG.
          </p>
          <div className="hero__stats">
            <div className="stat"><Waypoints size={16} /><strong>{totals.diagrams}</strong><span>diagram{totals.diagrams === 1 ? '' : 's'}</span></div>
            <div className="stat"><GitBranch size={16} /><strong>{totals.steps}</strong><span>steps</span></div>
            <div className="stat"><Clock size={16} /><strong>{totals.links}</strong><span>connections</span></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Start from a template</h2>
          <p>Fully editable starting points for common workflows.</p>
        </div>
        <div className="template-row">
          <button className="template-card template-card--blank" onClick={onNew} type="button">
            <span className="template-card__glyph"><Plus size={22} /></span>
            <strong>Blank canvas</strong>
            <small>Start from scratch</small>
          </button>
          {FLOW_TEMPLATES.map((template) => (
            <button key={template.id} className="template-card" onClick={() => onUseTemplate(template)} type="button">
              <span className="template-card__glyph" aria-hidden>{template.glyph}</span>
              <strong>{template.name}</strong>
              <small>{template.summary}</small>
              <span className="template-card__meta">{template.steps} steps</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section__head section__head--row">
          <div>
            <h2>Your diagrams</h2>
            <p>{charts.length} saved locally on this device.</p>
          </div>
          <label className="search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search diagrams…"
              aria-label="Search diagrams"
            />
          </label>
        </div>

        {charts.length === 0 ? (
          <div className="empty-card">
            <Waypoints size={22} />
            <div>
              <strong>No diagrams yet</strong>
              <p>Create a blank canvas or start from a template above.</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-card">
            <Search size={22} />
            <div>
              <strong>No matches</strong>
              <p>Nothing matches “{query}”.</p>
            </div>
          </div>
        ) : (
          <div className="diagram-grid">
            {filtered.map((chart) => (
              <article key={chart.id} className="diagram-card" onClick={() => onOpen(chart)}>
                <div className="diagram-card__preview" aria-hidden>
                  <span className="diagram-card__node" />
                  <span className="diagram-card__link" />
                  <span className="diagram-card__node diagram-card__node--alt" />
                </div>
                <div className="diagram-card__body">
                  <h3>{chart.name}</h3>
                  <p>{chart.document.meta.description || 'No description yet.'}</p>
                  <div className="diagram-card__foot">
                    <span>{chart.nodeCount} steps · {chart.edgeCount} links</span>
                    <span>{formatUpdatedAt(chart.updatedAt)}</span>
                  </div>
                </div>
                <div className="diagram-card__actions" onClick={(event) => event.stopPropagation()}>
                  <button className="icon-btn icon-btn--sm" onClick={() => onDuplicate(chart)} type="button" title="Duplicate" aria-label="Duplicate">
                    <Copy size={15} />
                  </button>
                  <button className="icon-btn icon-btn--sm" onClick={() => onExport(chart)} type="button" title="Export JSON" aria-label="Export JSON">
                    <Download size={15} />
                  </button>
                  <button className="icon-btn icon-btn--sm icon-btn--danger" onClick={() => onDelete(chart)} type="button" title="Delete" aria-label="Delete">
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="dashboard__footer">
        <span>FlowCraft · local-first flowchart studio</span>
      </footer>
    </div>
  );
}
