import { Database, Diamond, Flag, Play, User } from 'lucide-react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowNode } from '../types';

const ICONS = {
  start: Play,
  process: Flag,
  decision: Diamond,
  data: Database,
} as const;

export function FlowNodeCard({ data, selected }: NodeProps<FlowNode>): JSX.Element {
  const Icon = ICONS[data.kind];

  return (
    <div
      className={`flow-node flow-node--${data.kind} ${selected ? 'selected' : ''}`}
      style={{ ['--node-accent' as string]: data.accent }}
    >
      <Handle className="flow-handle" id="top" type="target" position={Position.Top} />
      <Handle className="flow-handle" id="left" type="target" position={Position.Left} />
      <Handle className="flow-handle" id="right" type="source" position={Position.Right} />
      <Handle className="flow-handle" id="bottom" type="source" position={Position.Bottom} />

      <div className="flow-node__surface">
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
          <p>{data.description || 'Add context so the next reviewer understands the step.'}</p>
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
