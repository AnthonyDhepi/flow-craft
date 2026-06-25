import { MarkerType } from '@xyflow/react';
import { createBlankDocument, createNode, getEdgeStrokeForRisk, sanitizeDocument } from './diagram';
import { applyAutoLayout } from './layout';
import type { DiagramDocument, EdgeRisk, FlowEdge, LayoutDirection, NodeKind, NodeStatus } from '../types';

type OutlineLink = string | {
  to?: unknown;
  label?: unknown;
  condition?: unknown;
  risk?: unknown;
};

type OutlineStep = {
  id?: unknown;
  kind?: unknown;
  label?: unknown;
  description?: unknown;
  owner?: unknown;
  status?: unknown;
  accent?: unknown;
  notes?: unknown;
  next?: unknown;
};

type OutlineDocument = {
  title?: unknown;
  name?: unknown;
  direction?: unknown;
  steps?: unknown;
};

const DEFAULT_IMPORT_TEMPLATE = {
  title: 'Customer onboarding',
  direction: 'LR',
  steps: [
    {
      id: 'lead-captured',
      kind: 'start',
      label: 'Lead captured',
      owner: 'Revenue ops',
      status: 'done',
      description: 'Marketing or sales creates a new onboarding request.',
      next: ['kickoff-review'],
    },
    {
      id: 'kickoff-review',
      kind: 'process',
      label: 'Kickoff review',
      owner: 'CSM',
      description: 'Validate scope, account tier, and delivery owner.',
      next: ['ready-to-provision'],
    },
    {
      id: 'ready-to-provision',
      kind: 'decision',
      label: 'Ready to provision?',
      owner: 'Implementation',
      description: 'Check contract, security, and environment prerequisites.',
      next: [
        { to: 'provision-workspace', label: 'Yes' },
        { to: 'request-missing-inputs', label: 'Missing data', condition: 'Requirements incomplete', risk: 'medium' },
      ],
    },
    {
      id: 'provision-workspace',
      kind: 'process',
      label: 'Provision workspace',
      owner: 'Platform',
      description: 'Create spaces, roles, and starter templates.',
    },
    {
      id: 'request-missing-inputs',
      kind: 'data',
      label: 'Request missing inputs',
      owner: 'Delivery ops',
      description: 'Collect security contacts, SSO details, and imports.',
    },
  ],
} as const;

export const IMPORT_FORMAT_NOTE = 'Import either exported Reranga JSON or outline JSON with `title`, optional `direction`, and a `steps` array.';

export function getImportTemplate(): string {
  return JSON.stringify(DEFAULT_IMPORT_TEMPLATE, null, 2);
}

export async function readImportedDocument(file: File): Promise<DiagramDocument> {
  const text = await file.text();
  return parseImportedDocument(text);
}

export function parseImportedDocument(text: string): DiagramDocument {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Import files must be valid JSON.');
  }

  if (isNativeDocument(parsed)) {
    return sanitizeDocument(parsed);
  }

  if (isOutlineDocument(parsed)) {
    return buildDocumentFromOutline(parsed);
  }

  throw new Error('Unsupported import format. Use exported Reranga JSON or outline JSON with a `steps` array.');
}

function isNativeDocument(value: unknown): value is Partial<DiagramDocument> {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<DiagramDocument>;
  return Array.isArray(record.nodes) && Array.isArray(record.edges);
}

function isOutlineDocument(value: unknown): value is OutlineDocument {
  if (!value || typeof value !== 'object') return false;
  return Array.isArray((value as OutlineDocument).steps);
}

function buildDocumentFromOutline(raw: OutlineDocument): DiagramDocument {
  const steps = Array.isArray(raw.steps) ? raw.steps : [];
  if (!steps.length) {
    throw new Error('Outline imports require at least one entry in `steps`.');
  }

  const title = asString(raw.title, asString(raw.name, 'Imported flow'));
  const direction = asLayoutDirection(raw.direction);
  const document = createBlankDocument(title);
  const usedNodeIds = new Set<string>();
  const nodes = steps.map((step, index) => buildNode(step, index, usedNodeIds));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = steps.flatMap((step, index) => buildEdges(step, index, nodes[index].id, nodeIds, direction));

  return sanitizeDocument({
    ...document,
    meta: {
      ...document.meta,
      name: title,
    },
    nodes: applyAutoLayout(nodes, edges, direction),
    edges,
  });
}

function buildNode(raw: unknown, index: number, usedIds: Set<string>) {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Outline step ${index + 1} must be an object.`);
  }

  const step = raw as OutlineStep;
  const kind = asNodeKind(step.kind);
  const label = asString(step.label, `Step ${index + 1}`);
  const node = createNode(kind, { x: index * 320, y: 0 });

  node.id = createOutlineId(step.id, label, index, usedIds);
  node.data = {
    ...node.data,
    label,
    description: asString(step.description, node.data.description),
    owner: asString(step.owner, node.data.owner),
    status: asNodeStatus(step.status, node.data.status),
    accent: asString(step.accent, node.data.accent),
    notes: asString(step.notes, node.data.notes),
  };

  return node;
}

function buildEdges(
  raw: unknown,
  index: number,
  sourceId: string,
  nodeIds: Set<string>,
  direction: LayoutDirection,
): FlowEdge[] {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Outline step ${index + 1} must be an object.`);
  }

  const step = raw as OutlineStep;
  return normalizeLinks(step.next).map((link, linkIndex) => {
    const rawTargetId = typeof link === 'string' ? link : asString(link.to);
    const targetId = slugify(rawTargetId) || rawTargetId;
    if (!targetId) {
      throw new Error(`Outline step "${sourceId}" has a connection without a target.`);
    }
    if (!nodeIds.has(targetId)) {
      throw new Error(`Outline step "${sourceId}" references missing target "${targetId}".`);
    }

    const risk = typeof link === 'string' ? 'low' : asEdgeRisk(link.risk);
    const label = typeof link === 'string' ? 'Next' : asString(link.label, 'Next');
    const condition = typeof link === 'string' ? '' : asString(link.condition);
    const stroke = getEdgeStrokeForRisk(risk);

    return {
      id: `${sourceId}-${targetId}-${linkIndex + 1}`,
      source: sourceId,
      target: targetId,
      sourceHandle: direction === 'TB' ? 'bottom' : 'right',
      targetHandle: direction === 'TB' ? 'top' : 'left',
      type: 'smoothstep',
      animated: false,
      label,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: stroke,
      },
      style: {
        stroke,
        strokeWidth: 1.5,
      },
      data: {
        label,
        condition,
        risk,
      },
      selected: false,
    };
  });
}

function createOutlineId(rawId: unknown, label: string, index: number, usedIds: Set<string>): string {
  const preferred = slugify(asString(rawId, label)) || `step-${index + 1}`;
  let candidate = preferred;
  let suffix = 2;

  while (usedIds.has(candidate)) {
    candidate = `${preferred}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(candidate);
  return candidate;
}

function normalizeLinks(value: unknown): OutlineLink[] {
  if (typeof value === 'string') return [value];
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === 'string') return [entry];
    if (entry && typeof entry === 'object') return [entry as OutlineLink];
    return [];
  });
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asLayoutDirection(value: unknown): LayoutDirection {
  return value === 'TB' ? 'TB' : 'LR';
}

function asNodeKind(value: unknown): NodeKind {
  return ['start', 'process', 'decision', 'data'].includes(String(value)) ? value as NodeKind : 'process';
}

function asNodeStatus(value: unknown, fallback: NodeStatus): NodeStatus {
  return ['planned', 'active', 'blocked', 'done'].includes(String(value)) ? value as NodeStatus : fallback;
}

function asEdgeRisk(value: unknown): EdgeRisk {
  return ['low', 'medium', 'high'].includes(String(value)) ? value as EdgeRisk : 'low';
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
