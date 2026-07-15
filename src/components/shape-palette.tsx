import { Circle, Database, Diamond, Square } from 'lucide-react';
import { NODE_LIBRARY } from '../lib/diagram';
import { useEditorStore } from '../store/editor-store';
import type { NodeKind } from '../types';

const KIND_ICON: Record<NodeKind, typeof Square> = {
  start: Circle,
  process: Square,
  decision: Diamond,
  data: Database,
};

export function ShapePalette(): JSX.Element {
  const addNode = useEditorStore((state) => state.addNode);

  return (
    <div className="palette">
      <div className="palette__label">Add a step</div>
      <div className="palette__grid">
        {NODE_LIBRARY.map((item) => {
          const Icon = KIND_ICON[item.kind];
          return (
            <button
              key={item.kind}
              className="shape-chip"
              onClick={() => addNode(item.kind)}
              type="button"
              title={item.description}
            >
              <span className="shape-chip__icon" style={{ color: item.accent }}>
                <Icon size={18} />
              </span>
              <span className="shape-chip__text">
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          );
        })}
      </div>
      <p className="palette__hint">
        Click a shape to drop it on the canvas, then drag from its edges to connect steps.
      </p>
    </div>
  );
}
