import { MarkerType, addEdge, applyEdgeChanges, applyNodeChanges, type Connection, type EdgeChange, type NodeChange, type OnSelectionChangeParams, type Viewport } from '@xyflow/react';
import { create } from 'zustand';
import { applyAutoLayout } from '../lib/layout';
import { applySelection, createBlankDocument, createEdge, createNode, getAutoSizedNodeStyle, getEdgeStrokeForRisk, getNextNodePosition, sanitizeDocument } from '../lib/diagram';
import { loadStoredDocument } from '../lib/persistence';
import type { DiagramDocument, FlowEdge, FlowEdgeData, FlowNode, FlowNodeData, LayoutDirection, NodeKind } from '../types';

const MAX_HISTORY = 100;

type SelectionState = {
  nodeId: string | null;
  edgeId: string | null;
};

type EditorState = {
  document: DiagramDocument;
  selection: SelectionState;
  history: DiagramDocument[];
  future: DiagramDocument[];
  saveStatus: string;
  snapshotCurrent: () => void;
  setSaveStatus: (status: string) => void;
  setViewport: (viewport: Viewport) => void;
  syncSelection: (selection: OnSelectionChangeParams<FlowNode, FlowEdge>) => void;
  syncNodeSize: (nodeId: string, size: { width: number; height: number }) => void;
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  addNode: (kind: NodeKind) => void;
  duplicateSelectedNode: () => void;
  deleteSelection: () => void;
  updateSelectedNode: (changes: Partial<FlowNodeData>) => void;
  updateSelectedEdge: (changes: Partial<FlowEdgeData> & { animated?: boolean }) => void;
  connect: (connection: Connection) => void;
  renameDiagram: (name: string) => void;
  updateDiagramMeta: (changes: { name?: string; description?: string }) => void;
  importDocument: (document: DiagramDocument) => void;
  resetDocument: () => void;
  autoLayout: (direction: LayoutDirection) => void;
  undo: () => void;
  redo: () => void;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function pushHistory(history: DiagramDocument[], document: DiagramDocument): DiagramDocument[] {
  const next = [...history, clone(document)];
  if (next.length > MAX_HISTORY) next.shift();
  return next;
}

function applyDocumentMutation(
  state: EditorState,
  mutate: (document: DiagramDocument) => DiagramDocument,
  selection?: SelectionState,
): Pick<EditorState, 'document' | 'history' | 'future' | 'selection'> {
  const nextDocument = mutate(clone(state.document));
  return {
    document: nextDocument,
    history: pushHistory(state.history, state.document),
    future: [],
    selection: selection ?? state.selection,
  };
}

const initialDocument = loadStoredDocument();

export const useEditorStore = create<EditorState>((set, get) => ({
  document: initialDocument,
  selection: { nodeId: null, edgeId: null },
  history: [],
  future: [],
  saveStatus: 'Autosave ready',
  snapshotCurrent: () => {
    const state = get();
    set({
      history: pushHistory(state.history, state.document),
      future: [],
    });
  },
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setViewport: (viewport) => set((state) => ({
    document: {
      ...state.document,
      viewport,
    },
  })),
  syncSelection: ({ nodes, edges }) => set((state) => {
    const nodeId = nodes[0]?.id ?? null;
    const edgeId = nodeId ? null : (edges[0]?.id ?? null);
    return {
      selection: { nodeId, edgeId },
      document: applySelection(state.document, { nodeId, edgeId }),
    };
  }),
  syncNodeSize: (nodeId, size) => set((state) => {
    const node = state.document.nodes.find((entry) => entry.id === nodeId);
    if (!node) return {};

    const baseStyle = getAutoSizedNodeStyle(node.data.kind, node.data);
    const width = Math.max(baseStyle.width, Math.ceil(size.width));
    const height = Math.max(baseStyle.height, Math.ceil(size.height));
    const currentWidth = Number(node.style?.width) || baseStyle.width;
    const currentHeight = Number(node.style?.height) || baseStyle.height;

    if (currentWidth === width && currentHeight === height) {
      return {};
    }

    return {
      document: {
        ...state.document,
        nodes: state.document.nodes.map((entry) => (
          entry.id === nodeId
            ? {
                ...entry,
                style: {
                  ...entry.style,
                  width,
                  height,
                },
              }
            : entry
        )),
      },
    };
  }),
  onNodesChange: (changes) => set((state) => {
    const resizedNodeDimensions = new Map(
      changes.flatMap((change) => (
        change.type === 'dimensions' && change.dimensions
          ? [[change.id, change.dimensions] as const]
          : []
      )),
    );
    const nodes = applyNodeChanges<FlowNode>(changes, state.document.nodes).map((node) => {
      const resizedDimensions = resizedNodeDimensions.get(node.id);
      if (!resizedDimensions) return node;
      return {
        ...node,
        style: getAutoSizedNodeStyle(node.data.kind, node.data, resizedDimensions),
      };
    });
    return {
      document: {
        ...state.document,
        nodes,
      },
    };
  }),
  onEdgesChange: (changes) => set((state) => {
    const edges = applyEdgeChanges<FlowEdge>(changes, state.document.edges);
    return {
      document: {
        ...state.document,
        edges,
      },
    };
  }),
  addNode: (kind) => set((state) => {
    const node = createNode(kind, getNextNodePosition(state.document.nodes));
    const next = applyDocumentMutation(state, (document) => ({
      ...document,
      nodes: [...document.nodes, node],
    }), { nodeId: node.id, edgeId: null });
    return {
      ...next,
      document: applySelection(next.document, { nodeId: node.id, edgeId: null }),
    };
  }),
  duplicateSelectedNode: () => set((state) => {
    const source = state.document.nodes.find((node) => node.id === state.selection.nodeId);
    if (!source) return {};
    const duplicate = createNode(source.data.kind, {
      x: source.position.x + 60,
      y: source.position.y + 60,
    });
    duplicate.data = {
      ...source.data,
      label: `${source.data.label} copy`,
    };
    duplicate.style = getAutoSizedNodeStyle(source.data.kind, duplicate.data, source.style);
    const next = applyDocumentMutation(state, (document) => ({
      ...document,
      nodes: [...document.nodes, duplicate],
    }), { nodeId: duplicate.id, edgeId: null });
    return {
      ...next,
      document: applySelection(next.document, { nodeId: duplicate.id, edgeId: null }),
    };
  }),
  deleteSelection: () => set((state) => {
    if (state.selection.nodeId) {
      return {
        ...applyDocumentMutation(state, (document) => ({
          ...document,
          nodes: document.nodes.filter((node) => node.id !== state.selection.nodeId),
          edges: document.edges.filter((edge) => edge.source !== state.selection.nodeId && edge.target !== state.selection.nodeId),
        }), { nodeId: null, edgeId: null }),
      };
    }

    if (state.selection.edgeId) {
      return {
        ...applyDocumentMutation(state, (document) => ({
          ...document,
          edges: document.edges.filter((edge) => edge.id !== state.selection.edgeId),
        }), { nodeId: null, edgeId: null }),
      };
    }

    return {};
  }),
  updateSelectedNode: (changes) => set((state) => {
    if (!state.selection.nodeId) return {};
    const next = applyDocumentMutation(state, (document) => ({
      ...document,
      nodes: document.nodes.map((node) => (
        node.id === state.selection.nodeId
          ? (() => {
              const data = { ...node.data, ...changes };
              return {
                ...node,
                data,
                style: getAutoSizedNodeStyle(data.kind, data, node.style),
              };
            })()
          : node
      )),
    }));
    return {
      ...next,
      document: applySelection(next.document, state.selection),
    };
  }),
  updateSelectedEdge: (changes) => set((state) => {
    if (!state.selection.edgeId) return {};
    const next = applyDocumentMutation(state, (document) => ({
      ...document,
      edges: document.edges.map((edge) => (
        edge.id === state.selection.edgeId
          ? (() => {
              const risk = changes.risk ?? edge.data?.risk ?? 'low';
              const label = changes.label ?? edge.data?.label ?? '';
              const stroke = getEdgeStrokeForRisk(risk);
              return {
                ...edge,
                animated: changes.animated ?? edge.animated,
                label,
                data: {
                  label,
                  condition: changes.condition ?? edge.data?.condition ?? '',
                  risk,
                },
                style: {
                  ...edge.style,
                  stroke,
                },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  width: 18,
                  height: 18,
                  color: stroke,
                },
              };
            })()
          : edge
      )),
    }));
    return {
      ...next,
      document: applySelection(next.document, state.selection),
    };
  }),
  connect: (connection) => set((state) => {
    if (!connection.source || !connection.target) return {};
    const edge = createEdge(connection);
    const next = applyDocumentMutation(state, (document) => ({
      ...document,
      edges: addEdge<FlowEdge>(edge, document.edges),
    }), { nodeId: null, edgeId: edge.id });
    return {
      ...next,
      document: applySelection(next.document, { nodeId: null, edgeId: edge.id }),
    };
  }),
  renameDiagram: (name) => set((state) => ({
    document: {
      ...state.document,
      meta: {
        ...state.document.meta,
        name: name.trim() || 'Untitled flow',
      },
    },
  })),
  updateDiagramMeta: (changes) => set((state) => ({
    document: {
      ...state.document,
      meta: {
        ...state.document.meta,
        ...(changes.name !== undefined ? { name: changes.name.trim() || 'Untitled flow' } : {}),
        ...(changes.description !== undefined ? { description: changes.description } : {}),
      },
    },
  })),
  importDocument: (document) => set({
    document: applySelection(sanitizeDocument(document), { nodeId: null, edgeId: null }),
    selection: { nodeId: null, edgeId: null },
    history: [],
    future: [],
  }),
  resetDocument: () => set({
    document: createBlankDocument(),
    selection: { nodeId: null, edgeId: null },
    history: [],
    future: [],
  }),
  autoLayout: (direction) => set((state) => {
    const next = applyDocumentMutation(state, (document) => ({
      ...document,
      nodes: applyAutoLayout(document.nodes, document.edges, direction),
    }));
    return {
      ...next,
      document: applySelection(next.document, state.selection),
    };
  }),
  undo: () => set((state) => {
    if (!state.history.length) return {};
    const previous = state.history[state.history.length - 1];
    return {
      document: applySelection(previous, { nodeId: null, edgeId: null }),
      history: state.history.slice(0, -1),
      future: [clone(state.document), ...state.future],
      selection: { nodeId: null, edgeId: null },
    };
  }),
  redo: () => set((state) => {
    if (!state.future.length) return {};
    const [next, ...rest] = state.future;
    return {
      document: applySelection(next, { nodeId: null, edgeId: null }),
      history: pushHistory(state.history, state.document),
      future: rest,
      selection: { nodeId: null, edgeId: null },
    };
  }),
}));
