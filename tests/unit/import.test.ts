import { describe, expect, it } from 'vitest';
import { parseImportedDocument } from '../../src/lib/import';

describe('import parser', () => {
  it('builds a diagram from outline JSON', () => {
    const document = parseImportedDocument(JSON.stringify({
      title: 'Incident triage',
      direction: 'TB',
      steps: [
        {
          id: 'alert',
          kind: 'start',
          label: 'Alert received',
          next: ['assess'],
        },
        {
          id: 'assess',
          kind: 'decision',
          label: 'Customer impact?',
          next: [
            { to: 'escalate', label: 'Yes', risk: 'high' },
            { to: 'resolve', label: 'No' },
          ],
        },
        { id: 'escalate', kind: 'process', label: 'Escalate incident' },
        { id: 'resolve', kind: 'process', label: 'Resolve quietly' },
      ],
    }));

    expect(document.meta.name).toBe('Incident triage');
    expect(document.nodes).toHaveLength(4);
    expect(document.edges).toHaveLength(3);
    expect(document.nodes[0].data.label).toBe('Alert received');
    expect(document.edges.find((edge) => edge.target === 'escalate')?.data?.risk).toBe('high');
    expect(document.edges.every((edge) => edge.sourceHandle === 'bottom')).toBe(true);
  });

  it('rejects outline imports that reference missing targets', () => {
    expect(() => parseImportedDocument(JSON.stringify({
      title: 'Broken flow',
      steps: [
        { id: 'start', kind: 'start', label: 'Start', next: ['missing-step'] },
      ],
    }))).toThrow(/missing target/i);
  });
});
