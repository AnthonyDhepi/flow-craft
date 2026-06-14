import { describe, expect, it } from 'vitest';
import { applyAutoLayout } from '../../src/lib/layout';
import { sanitizeDocument } from '../../src/lib/diagram';

describe('auto layout', () => {
  it('repositions nodes when layout is applied', () => {
    const document = sanitizeDocument({
      version: 3,
      meta: { name: 'Layout flow', version: 3, updatedAt: new Date().toISOString() },
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        { id: 'a', type: 'flowNode', position: { x: 0, y: 0 }, data: { kind: 'start', label: 'Start' } },
        { id: 'b', type: 'flowNode', position: { x: 0, y: 0 }, data: { kind: 'process', label: 'Middle' } },
      ],
      edges: [{ id: 'edge', source: 'a', target: 'b', type: 'smoothstep', data: { label: 'Next', risk: 'low', condition: '' } }],
    });

    const nodes = applyAutoLayout(document.nodes, document.edges, 'LR');

    expect(nodes[0].position.x).not.toBe(nodes[1].position.x);
    expect(nodes[0].position.y).toBeTypeOf('number');
  });
});
