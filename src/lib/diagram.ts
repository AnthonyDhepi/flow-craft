import { MarkerType, type Edge, type XYPosition } from '@xyflow/react';
import type { DiagramDocument, DiagramMetrics, EdgeRisk, FlowEdge, FlowEdgeData, FlowNode, FlowNodeData, NodeKind, NodeStatus } from '../types';

export const DOCUMENT_VERSION = 3;
export const STORAGE_KEY = 'flowcraft.editor.document.v3';
export const LEGACY_STORAGE_KEY = 'flowcraft.live.state.v2';

const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 };

export const NODE_LIBRARY: Array<{ kind: NodeKind; label: string; description: string; accent: string }> = [
  { kind: 'start', label: 'Start / End', description: 'Entry points, exits, and handoff anchors.', accent: '#3b82f6' },
  { kind: 'process', label: 'Process step', description: 'Operational work, approvals, or automations.', accent: '#8b5cf6' },
  { kind: 'decision', label: 'Decision', description: 'Branching logic and policy checks.', accent: '#f59e0b' },
  { kind: 'data', label: 'Data / Input', description: 'Inputs, records, or integrations.', accent: '#14b8a6' },
];

type DefaultNodeData = {
  description: string;
  owner: string;
  status: NodeStatus;
  kind: NodeKind;
  accent: string;
  notes: string;
};

const DEFAULT_NODE_BY_KIND: Record<NodeKind, DefaultNodeData> = {
  start: { description: 'Define where the workflow starts or finishes.', owner: 'Ops', status: 'active', kind: 'start', accent: '#3b82f6', notes: '' },
  process: { description: 'Capture the core action or approval.', owner: 'Team lead', status: 'planned', kind: 'process', accent: '#8b5cf6', notes: '' },
  decision: { description: 'Document the rule that drives the branch.', owner: 'Policy', status: 'planned', kind: 'decision', accent: '#f59e0b', notes: '' },
  data: { description: 'Track systems, sources, or records.', owner: 'Platform', status: 'planned', kind: 'data', accent: '#14b8a6', notes: '' },
};

const DEFAULT_LABEL_BY_KIND: Record<NodeKind, string> = {
  start: 'Workflow start',
  process: 'Process step',
  decision: 'Decision point',
  data: 'Data handoff',
};

export function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampZoom(zoom: unknown): number {
  const parsed = Number(zoom);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(2.5, Math.max(0.3, parsed));
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStatus(value: unknown): NodeStatus {
  return ['planned', 'active', 'blocked', 'done'].includes(String(value)) ? (value as NodeStatus) : 'planned';
}

function asRisk(value: unknown): EdgeRisk {
  return ['low', 'medium', 'high'].includes(String(value)) ? (value as EdgeRisk) : 'low';
}

function asKind(value: unknown): NodeKind {
  return ['start', 'process', 'decision', 'data'].includes(String(value)) ? (value as NodeKind) : 'process';
}

function asPosition(value: unknown): XYPosition {
  const x = Number((value as { x?: number })?.x);
  const y = Number((value as { y?: number })?.y);
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
  };
}

function asDimension(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 40 ? parsed : fallback;
}

function createDefaultNodeData(kind: NodeKind, label = DEFAULT_LABEL_BY_KIND[kind]): FlowNodeData {
  const defaults = DEFAULT_NODE_BY_KIND[kind];
  return {
    label,
    description: defaults.description,
    owner: defaults.owner,
    status: defaults.status,
    kind: defaults.kind,
    accent: defaults.accent,
    notes: defaults.notes,
  };
}

function getNodeSize(kind: NodeKind): { width: number; height: number } {
  switch (kind) {
    case 'decision':
      return { width: 250, height: 164 };
    case 'data':
      return { width: 250, height: 150 };
    default:
      return { width: 250, height: 140 };
  }
}

function shapeToKind(shape: unknown): NodeKind {
  switch (shape) {
    case 'rounded':
      return 'start';
    case 'diamond':
      return 'decision';
    case 'parallelogram':
      return 'data';
    default:
      return 'process';
  }
}

function normalizeNode(raw: unknown, index: number): FlowNode {
  const record = raw as Partial<FlowNode>;
  const data = (record.data ?? {}) as Partial<FlowNodeData>;
  const kind = asKind(data.kind ?? shapeToKind((record as { shape?: string }).shape));
  const size = getNodeSize(kind);
  return {
    id: asString(record.id, `node-${index + 1}`),
    type: 'flowNode',
    position: asPosition(record.position ?? { x: (record as { x?: number }).x, y: (record as { y?: number }).y }),
    data: {
      ...createDefaultNodeData(kind, asString(data.label, asString((record as { label?: string }).label, DEFAULT_LABEL_BY_KIND[kind]))),
      description: asString(data.description),
      owner: asString(data.owner, DEFAULT_NODE_BY_KIND[kind].owner),
      status: asStatus(data.status),
      accent: asString(data.accent, asString((record as { stroke?: string }).stroke, DEFAULT_NODE_BY_KIND[kind].accent)),
      notes: asString(data.notes),
    },
    draggable: true,
    selectable: true,
    style: {
      width: asDimension(record.style?.width ?? (record as { w?: number }).w, size.width),
      height: asDimension(record.style?.height ?? (record as { h?: number }).h, size.height),
    },
    selected: Boolean(record.selected),
  };
}

function normalizeEdge(raw: unknown, index: number, nodeIds: Set<string>): FlowEdge | null {
  const record = raw as Partial<FlowEdge> & { from?: string; to?: string; fp?: string; tp?: string; label?: string; color?: string };
  const source = asString(record.source, asString(record.from));
  const target = asString(record.target, asString(record.to));
  if (!nodeIds.has(source) || !nodeIds.has(target) || source === target) {
    return null;
  }

  const data = (record.data ?? {}) as Partial<FlowEdgeData>;
  const label = asString(record.label, asString(data.label));
  return {
    id: asString(record.id, `edge-${index + 1}`),
    source,
    target,
    sourceHandle: asString(record.sourceHandle, asString(record.fp, 'bottom')),
    targetHandle: asString(record.targetHandle, asString(record.tp, 'top')),
    type: 'smoothstep',
    animated: Boolean(record.animated),
    label,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 18,
      height: 18,
      color: asString(record.style?.stroke, asString(record.color, '#6d8cff')),
    },
    style: {
      stroke: asString(record.style?.stroke, asString(record.color, '#6d8cff')),
      strokeWidth: 2,
      strokeDasharray: record.style?.strokeDasharray ?? ((record as { dashed?: boolean }).dashed ? '8 6' : undefined),
    },
    data: {
      label,
      condition: asString(data.condition),
      risk: asRisk(data.risk),
    },
    selected: Boolean(record.selected),
  };
}

function clearSelection<T extends DiagramDocument>(document: T): T {
  return {
    ...document,
    nodes: document.nodes.map((node) => ({ ...node, selected: false })),
    edges: document.edges.map((edge) => ({ ...edge, selected: false })),
  };
}

export function applySelection(document: DiagramDocument, selection: { nodeId?: string | null; edgeId?: string | null }): DiagramDocument {
  return {
    ...document,
    nodes: document.nodes.map((node) => ({ ...node, selected: node.id === selection.nodeId })),
    edges: document.edges.map((edge) => ({ ...edge, selected: edge.id === selection.edgeId })),
  };
}

export function createNode(kind: NodeKind, position: XYPosition): FlowNode {
  const size = getNodeSize(kind);
  return {
    id: createId('node'),
    type: 'flowNode',
    position,
    style: { width: size.width, height: size.height },
    data: createDefaultNodeData(kind),
  };
}

export function createEdge(connection: Pick<Edge, 'source' | 'target' | 'sourceHandle' | 'targetHandle'>): FlowEdge {
  return {
    id: createId('edge'),
    source: connection.source ?? '',
    target: connection.target ?? '',
    sourceHandle: connection.sourceHandle ?? 'right',
    targetHandle: connection.targetHandle ?? 'left',
    type: 'smoothstep',
    label: 'Next',
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 18,
      height: 18,
      color: '#8ba3ff',
    },
    style: {
      stroke: '#8ba3ff',
      strokeWidth: 2,
    },
    data: {
      label: 'Next',
      condition: '',
      risk: 'low',
    },
  };
}

export function createBlankDocument(name = 'Untitled flow'): DiagramDocument {
  return {
    version: DOCUMENT_VERSION,
    meta: {
      id: createId('chart'),
      name,
      version: DOCUMENT_VERSION,
      updatedAt: new Date().toISOString(),
    },
    viewport: { ...DEFAULT_VIEWPORT },
    nodes: [],
    edges: [],
  };
}

export function createSampleDocument(): DiagramDocument {
  const document: DiagramDocument = {
    version: DOCUMENT_VERSION,
    meta: {
      id: createId('chart'),
      name: 'Customer onboarding',
      version: DOCUMENT_VERSION,
      updatedAt: new Date().toISOString(),
    },
    viewport: { ...DEFAULT_VIEWPORT },
    nodes: [
      createNode('start', { x: 0, y: 0 }),
      createNode('process', { x: 360, y: 0 }),
      createNode('decision', { x: 720, y: 0 }),
      createNode('process', { x: 1080, y: -120 }),
      createNode('data', { x: 1080, y: 140 }),
    ],
    edges: [],
  };

  document.nodes[0].data = {
    ...document.nodes[0].data,
    label: 'Lead captured',
    description: 'Marketing or sales creates a new onboarding request.',
    owner: 'Revenue ops',
    status: 'done',
  };
  document.nodes[1].data = {
    ...document.nodes[1].data,
    label: 'Kickoff review',
    description: 'Validate scope, account tier, and delivery owner.',
    owner: 'CSM',
  };
  document.nodes[2].data = {
    ...document.nodes[2].data,
    label: 'Ready to provision?',
    description: 'Check contract, security, and environment prerequisites.',
    owner: 'Implementation',
    kind: 'decision',
    accent: '#f59e0b',
  };
  document.nodes[3].data = {
    ...document.nodes[3].data,
    label: 'Provision workspace',
    description: 'Create spaces, roles, and starter templates.',
    owner: 'Platform',
  };
  document.nodes[4].data = {
    ...document.nodes[4].data,
    label: 'Request missing inputs',
    description: 'Collect security contacts, SSO details, and imports.',
    owner: 'Delivery ops',
    kind: 'data',
    accent: '#14b8a6',
  };
  document.edges = [
    createEdge({ source: document.nodes[0].id, target: document.nodes[1].id, sourceHandle: 'right', targetHandle: 'left' }),
    createEdge({ source: document.nodes[1].id, target: document.nodes[2].id, sourceHandle: 'right', targetHandle: 'left' }),
    createEdge({ source: document.nodes[2].id, target: document.nodes[3].id, sourceHandle: 'right', targetHandle: 'left' }),
    createEdge({ source: document.nodes[2].id, target: document.nodes[4].id, sourceHandle: 'bottom', targetHandle: 'left' }),
  ];
  document.edges[2].label = 'Yes';
  document.edges[2].data = { label: 'Yes', condition: 'Scope approved', risk: 'low' };
  document.edges[3].label = 'Missing data';
  document.edges[3].data = { label: 'Missing data', condition: 'Requirements incomplete', risk: 'medium' };
  document.edges[3].style = { ...document.edges[3].style, stroke: '#f59e0b' };

  return document;
}

function normalizeViewport(raw: unknown): DiagramDocument['viewport'] {
  const record = raw as { x?: number; y?: number; zoom?: number; panX?: number; panY?: number } | undefined;
  return {
    x: Number(record?.x ?? record?.panX) || 0,
    y: Number(record?.y ?? record?.panY) || 0,
    zoom: clampZoom(record?.zoom),
  };
}

export function sanitizeDocument(raw: unknown): DiagramDocument {
  if (!raw || typeof raw !== 'object') {
    return createSampleDocument();
  }

  const record = raw as Partial<DiagramDocument>;
  const nodes = Array.isArray(record.nodes) ? record.nodes.map(normalizeNode) : [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(record.edges)
    ? record.edges.map((edge, index) => normalizeEdge(edge, index, nodeIds)).filter(Boolean) as FlowEdge[]
    : [];

  const legacyPan = (record as { pan?: { x?: number; y?: number } }).pan;
  const viewport = record.viewport
    ? normalizeViewport(record.viewport)
    : legacyPan
      ? normalizeViewport({ x: legacyPan.x, y: legacyPan.y, zoom: (record as { zoom?: number }).zoom })
      : DEFAULT_VIEWPORT;

  const meta = (record.meta ?? {}) as Partial<DiagramDocument['meta']>;
  return clearSelection({
    version: DOCUMENT_VERSION,
    meta: {
      id: asString(meta.id, createId('chart')),
      name: asString(meta.name, 'Untitled flow'),
      version: DOCUMENT_VERSION,
      updatedAt: asString(meta.updatedAt, new Date().toISOString()),
    },
    nodes,
    edges,
    viewport: {
      x: Number(viewport.x) || 0,
      y: Number(viewport.y) || 0,
      zoom: clampZoom(viewport.zoom),
    },
  });
}

export function serializeDocument(document: DiagramDocument): string {
  return JSON.stringify({
    ...clearSelection(document),
    meta: {
      ...document.meta,
      version: DOCUMENT_VERSION,
      updatedAt: new Date().toISOString(),
    },
  }, null, 2);
}

export function getNextNodePosition(nodes: FlowNode[]): XYPosition {
  if (!nodes.length) return { x: 40, y: 40 };
  const last = nodes[nodes.length - 1];
  return { x: last.position.x + 80, y: last.position.y + 80 };
}

export function getDiagramMetrics(document: DiagramDocument): DiagramMetrics {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();

  document.nodes.forEach((node) => {
    incoming.set(node.id, 0);
    outgoing.set(node.id, 0);
  });

  document.edges.forEach((edge) => {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
  });

  let terminalNodes = 0;
  let disconnectedNodes = 0;

  document.nodes.forEach((node) => {
    const inCount = incoming.get(node.id) ?? 0;
    const outCount = outgoing.get(node.id) ?? 0;
    if (outCount === 0) terminalNodes += 1;
    if (inCount === 0 && outCount === 0) disconnectedNodes += 1;
  });

  return {
    totalNodes: document.nodes.length,
    totalEdges: document.edges.length,
    decisionNodes: document.nodes.filter((node) => node.data.kind === 'decision').length,
    terminalNodes,
    disconnectedNodes,
  };
}
