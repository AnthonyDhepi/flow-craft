import dagre from '@dagrejs/dagre';
import type { FlowEdge, FlowNode, LayoutDirection } from '../types';

export function applyAutoLayout(nodes: FlowNode[], edges: FlowEdge[], direction: LayoutDirection): FlowNode[] {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: direction,
    nodesep: 70,
    ranksep: 90,
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach((node) => {
    const width = Number(node.style?.width) || 250;
    const height = Number(node.style?.height) || 140;
    graph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target);
  });

  dagre.layout(graph);

  return nodes.map((node) => {
    const positioned = graph.node(node.id);
    const width = Number(node.style?.width) || 250;
    const height = Number(node.style?.height) || 140;
    return {
      ...node,
      position: {
        x: positioned.x - width / 2,
        y: positioned.y - height / 2,
      },
    };
  });
}
