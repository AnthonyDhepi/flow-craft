import { beforeEach, describe, expect, it } from 'vitest';
import { createBlankDocument, createNode, getAutoSizedNodeStyle } from '../../src/lib/diagram';
import { useEditorStore } from '../../src/store/editor-store';

describe('editor store node resizing', () => {
  beforeEach(() => {
    const document = createBlankDocument('Resize test');
    const node = createNode('process', { x: 0, y: 0 });
    document.nodes = [node];
    document.edges = [];

    useEditorStore.setState({
      document,
      selection: { nodeId: node.id, edgeId: null },
      history: [],
      future: [],
      saveStatus: 'Autosave ready',
    });
  });

  it('persists manually resized node dimensions in node style', () => {
    const state = useEditorStore.getState();
    const node = state.document.nodes[0];
    const baseStyle = getAutoSizedNodeStyle(node.data.kind, node.data);

    state.onNodesChange([
      {
        id: node.id,
        type: 'dimensions',
        dimensions: {
          width: baseStyle.width + 96,
          height: baseStyle.height + 48,
        },
        setAttributes: true,
      },
    ]);

    const resizedNode = useEditorStore.getState().document.nodes[0];

    expect(Number(resizedNode.style?.width)).toBe(baseStyle.width + 96);
    expect(Number(resizedNode.style?.height)).toBe(baseStyle.height + 48);
  });

  it('keeps manual resize as the floor for later content edits', () => {
    const state = useEditorStore.getState();
    const node = state.document.nodes[0];
    const baseStyle = getAutoSizedNodeStyle(node.data.kind, node.data);
    const resizedWidth = baseStyle.width + 120;
    const resizedHeight = baseStyle.height + 60;

    state.onNodesChange([
      {
        id: node.id,
        type: 'dimensions',
        dimensions: {
          width: resizedWidth,
          height: resizedHeight,
        },
        setAttributes: true,
      },
    ]);

    useEditorStore.getState().updateSelectedNode({
      label: 'Publish validated release updates to every downstream regional delivery environment',
    });

    const updatedNode = useEditorStore.getState().document.nodes[0];

    expect(Number(updatedNode.style?.width)).toBeGreaterThanOrEqual(resizedWidth);
    expect(Number(updatedNode.style?.height)).toBeGreaterThanOrEqual(resizedHeight);
  });

  it('does not let manual resize shrink below the content minimum', () => {
    const state = useEditorStore.getState();
    const node = state.document.nodes[0];
    const baseStyle = getAutoSizedNodeStyle(node.data.kind, node.data);

    state.onNodesChange([
      {
        id: node.id,
        type: 'dimensions',
        dimensions: {
          width: baseStyle.width - 80,
          height: baseStyle.height - 40,
        },
        setAttributes: true,
      },
    ]);

    const resizedNode = useEditorStore.getState().document.nodes[0];

    expect(Number(resizedNode.style?.width)).toBe(baseStyle.width);
    expect(Number(resizedNode.style?.height)).toBe(baseStyle.height);
  });
});
