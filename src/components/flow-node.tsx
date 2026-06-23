import { useLayoutEffect, useRef } from 'react';
import { Database, Diamond, Flag, Play, User } from 'lucide-react';
import { Handle, NodeResizer, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { EMPTY_NODE_DESCRIPTION, getAutoSizedNodeStyle } from '../lib/diagram';
import { useEditorStore } from '../store/editor-store';
import type { FlowNode } from '../types';

const ICONS = {
  start: Play,
  process: Flag,
  decision: Diamond,
  data: Database,
} as const;

export function FlowNodeCard({ id, data, selected }: NodeProps<FlowNode>): JSX.Element {
  const Icon = ICONS[data.kind];
  const surfaceRef = useRef<HTMLDivElement>(null);
  const syncNodeSize = useEditorStore((state) => state.syncNodeSize);
  const snapshotCurrent = useEditorStore((state) => state.snapshotCurrent);
  const updateNodeInternals = useUpdateNodeInternals();
  const minSize = getAutoSizedNodeStyle(data.kind, data);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || typeof window === 'undefined') {
      return;
    }

    let frameId = 0;
    const measure = () => {
      syncNodeSize(id, {
        width: surface.offsetWidth,
        height: surface.scrollHeight,
      });
      updateNodeInternals(id);
    };

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => scheduleMeasure());

    resizeObserver?.observe(surface);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
    };
  }, [data.description, data.kind, data.label, data.owner, data.status, id, syncNodeSize, updateNodeInternals]);

  return (
    <div
      className={`flow-node flow-node--${data.kind} ${selected ? 'selected' : ''}`}
      style={{ ['--node-accent' as string]: data.accent }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={minSize.width}
        minHeight={minSize.height}
        color={data.accent}
        handleClassName="flow-node__resizer-handle"
        lineClassName="flow-node__resizer-line"
        onResizeStart={() => snapshotCurrent()}
      />
      <Handle className="flow-handle" id="top" type="target" position={Position.Top} />
      <Handle className="flow-handle" id="left" type="target" position={Position.Left} />
      <Handle className="flow-handle" id="right" type="source" position={Position.Right} />
      <Handle className="flow-handle" id="bottom" type="source" position={Position.Bottom} />

      <div ref={surfaceRef} className="flow-node__surface">
        <div className="flow-node__accent" />
        <div className="flow-node__header">
          <span className="flow-node__kind">
            <span className="flow-node__icon">
              <Icon size={14} />
            </span>
            {data.kind}
          </span>
          <span className={`flow-node__status ${data.status}`}>{data.status}</span>
        </div>

        <div className="flow-node__body">
          <h3>{data.label}</h3>
          <p>{data.description || EMPTY_NODE_DESCRIPTION}</p>
        </div>

        <div className="flow-node__footer">
          <span>
            <User size={12} />
            {data.owner || 'Unassigned'}
          </span>
        </div>
      </div>
    </div>
  );
}
