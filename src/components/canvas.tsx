import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, type ReactFlowInstance, type Viewport } from '@xyflow/react';
import { FlowNodeCard } from './flow-node';
import { useEditorStore } from '../store/editor-store';
import type { ThemeMode } from '../hooks';
import type { FlowEdge, FlowNode } from '../types';

const nodeTypes = { flowNode: FlowNodeCard };

export function Canvas({
  onReady,
  theme,
}: {
  onReady: (instance: ReactFlowInstance<FlowNode, FlowEdge>) => void;
  theme: ThemeMode;
}): JSX.Element {
  const document = useEditorStore((state) => state.document);
  const onNodesChange = useEditorStore((state) => state.onNodesChange);
  const onEdgesChange = useEditorStore((state) => state.onEdgesChange);
  const connect = useEditorStore((state) => state.connect);
  const setViewport = useEditorStore((state) => state.setViewport);
  const syncSelection = useEditorStore((state) => state.syncSelection);
  const snapshotCurrent = useEditorStore((state) => state.snapshotCurrent);

  return (
    <ReactFlow
      nodes={document.nodes}
      edges={document.edges}
      viewport={document.viewport}
      onInit={onReady}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={connect}
      onMoveEnd={(_event, viewport: Viewport) => setViewport(viewport)}
      onSelectionChange={syncSelection}
      onNodeDragStart={snapshotCurrent}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.25}
      maxZoom={2.5}
      nodeTypes={nodeTypes}
      colorMode={theme}
      proOptions={{ hideAttribution: true }}
      defaultEdgeOptions={{ type: 'smoothstep', animated: false }}
    >
      <Background variant={BackgroundVariant.Dots} color="var(--canvas-grid)" gap={22} size={1.4} />
      <MiniMap
        pannable
        zoomable
        nodeColor={(node) => String(node.data?.accent ?? 'var(--accent)')}
        maskColor="var(--minimap-mask)"
        bgColor="var(--minimap-bg)"
      />
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  );
}
