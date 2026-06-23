import { describe, expect, it } from 'vitest';
import { getDiagramMetrics, sanitizeDocument } from '../../src/lib/diagram';

describe('diagram utilities', () => {
  it('migrates legacy nodes and edges into the new document schema', () => {
    const document = sanitizeDocument({
      version: 2,
      viewport: { panX: 20, panY: 30, zoom: 1.3 },
      nodes: [
        { id: 'a', x: 0, y: 0, shape: 'rounded', label: 'Start' },
        { id: 'b', x: 320, y: 0, shape: 'diamond', label: 'Approved?' },
      ],
      edges: [{ id: 'e1', from: 'a', to: 'b', fp: 'right', tp: 'left', label: 'Next' }],
    });

    expect(document.nodes[0].data.kind).toBe('start');
    expect(document.nodes[1].data.kind).toBe('decision');
    expect(document.edges[0].source).toBe('a');
    expect(document.edges[0].targetHandle).toBe('left');
  });

  it('computes health metrics for connected and disconnected nodes', () => {
    const document = sanitizeDocument({
      version: 3,
      meta: { name: 'Test flow', version: 3, updatedAt: new Date().toISOString() },
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        { id: 'a', type: 'flowNode', position: { x: 0, y: 0 }, data: { kind: 'process', label: 'A' } },
        { id: 'b', type: 'flowNode', position: { x: 220, y: 0 }, data: { kind: 'decision', label: 'B' } },
        { id: 'c', type: 'flowNode', position: { x: 440, y: 0 }, data: { kind: 'process', label: 'C' } },
      ],
      edges: [{ id: 'edge', source: 'a', target: 'b', type: 'smoothstep', data: { label: 'Next', risk: 'low', condition: '' } }],
    });

    const metrics = getDiagramMetrics(document);

    expect(metrics.totalNodes).toBe(3);
    expect(metrics.decisionNodes).toBe(1);
    expect(metrics.disconnectedNodes).toBe(1);
    expect(metrics.terminalNodes).toBe(2);
  });

  it('expands node dimensions when text would be clipped', () => {
    const document = sanitizeDocument({
      version: 3,
      meta: { name: 'Verbose flow', version: 3, updatedAt: new Date().toISOString() },
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        {
          id: 'verbose',
          type: 'flowNode',
          position: { x: 0, y: 0 },
          data: {
            kind: 'process',
            label: 'Publish to delivery endpoints for every downstream environment',
            description: 'Coordinate the release handoff with validation, regional rollout sequencing, incident checkpoints, and stakeholder notifications so the final step remains readable on the canvas.',
            owner: 'Delivery Enablement Platform Team',
          },
        },
      ],
      edges: [],
    });

    expect(Number(document.nodes[0].style?.width)).toBeGreaterThan(250);
    expect(Number(document.nodes[0].style?.height)).toBeGreaterThan(140);
  });
});
