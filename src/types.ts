import type { Edge, Node, Viewport } from '@xyflow/react';

export type NodeKind = 'start' | 'process' | 'decision' | 'data';
export type NodeStatus = 'planned' | 'active' | 'blocked' | 'done';
export type EdgeRisk = 'low' | 'medium' | 'high';
export type LayoutDirection = 'TB' | 'LR';

export interface FlowNodeData extends Record<string, unknown> {
  label: string;
  description: string;
  owner: string;
  status: NodeStatus;
  kind: NodeKind;
  accent: string;
  notes: string;
}

export interface FlowEdgeData extends Record<string, unknown> {
  label: string;
  condition: string;
  risk: EdgeRisk;
}

export type FlowNode = Node<FlowNodeData, 'flowNode'>;
export type FlowEdge = Edge<FlowEdgeData>;

export interface DiagramMeta {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
}

export interface DiagramDocument {
  version: number;
  meta: DiagramMeta;
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: Viewport;
}

export interface DiagramMetrics {
  totalNodes: number;
  totalEdges: number;
  decisionNodes: number;
  terminalNodes: number;
  disconnectedNodes: number;
}

export interface SavedDiagramRecord {
  id: string;
  name: string;
  updatedAt: string;
  nodeCount: number;
  edgeCount: number;
  document: DiagramDocument;
}
