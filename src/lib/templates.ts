import { parseImportedDocument } from './import';
import type { DiagramDocument, LayoutDirection } from '../types';

export interface FlowTemplate {
  id: string;
  name: string;
  summary: string;
  /** Emoji glyph used on the template card. */
  glyph: string;
  steps: number;
  /** Builds a fresh document instance from the template outline. */
  create: () => DiagramDocument;
}

interface TemplateOutline {
  title: string;
  description?: string;
  direction?: LayoutDirection;
  steps: Array<Record<string, unknown>>;
}

function template(
  id: string,
  glyph: string,
  summary: string,
  outline: TemplateOutline,
): FlowTemplate {
  return {
    id,
    name: outline.title,
    summary,
    glyph,
    steps: outline.steps.length,
    create: () => {
      const document = parseImportedDocument(JSON.stringify(outline));
      document.meta.description = outline.description ?? summary;
      return document;
    },
  };
}

export const FLOW_TEMPLATES: FlowTemplate[] = [
  template('customer-onboarding', '🚀', 'Lead capture through to a provisioned workspace.', {
    title: 'Customer onboarding',
    description: 'How a new customer moves from captured lead to a provisioned workspace.',
    direction: 'LR',
    steps: [
      { id: 'lead-captured', kind: 'start', label: 'Lead captured', owner: 'Revenue ops', status: 'done', description: 'Marketing or sales creates a new onboarding request.', next: ['kickoff-review'] },
      { id: 'kickoff-review', kind: 'process', label: 'Kickoff review', owner: 'CSM', status: 'active', description: 'Validate scope, account tier, and delivery owner.', next: ['ready-to-provision'] },
      { id: 'ready-to-provision', kind: 'decision', label: 'Ready to provision?', owner: 'Implementation', description: 'Check contract, security, and environment prerequisites.', next: [
        { to: 'provision-workspace', label: 'Yes' },
        { to: 'request-missing-inputs', label: 'Missing data', condition: 'Requirements incomplete', risk: 'medium' },
      ] },
      { id: 'provision-workspace', kind: 'process', label: 'Provision workspace', owner: 'Platform', description: 'Create spaces, roles, and starter templates.', next: ['welcome-sent'] },
      { id: 'request-missing-inputs', kind: 'data', label: 'Request missing inputs', owner: 'Delivery ops', description: 'Collect security contacts, SSO details, and imports.', next: ['ready-to-provision'] },
      { id: 'welcome-sent', kind: 'start', label: 'Onboarding complete', owner: 'CSM', status: 'planned', description: 'Send the welcome kit and hand off to the success team.' },
    ],
  }),

  template('incident-response', '🚨', 'Triage an alert and route it to resolution.', {
    title: 'Incident response',
    description: 'On-call triage from first alert through post-incident review.',
    direction: 'TB',
    steps: [
      { id: 'alert', kind: 'start', label: 'Alert received', owner: 'On-call', status: 'active', description: 'Monitoring or a customer report opens an incident.', next: ['assess'] },
      { id: 'assess', kind: 'decision', label: 'Customer impact?', owner: 'On-call', description: 'Gauge blast radius and severity.', next: [
        { to: 'escalate', label: 'Yes', condition: 'Users affected', risk: 'high' },
        { to: 'investigate', label: 'No', risk: 'low' },
      ] },
      { id: 'escalate', kind: 'process', label: 'Page incident commander', owner: 'On-call', status: 'blocked', description: 'Open a war room and assign roles.', next: ['investigate'] },
      { id: 'investigate', kind: 'process', label: 'Investigate & mitigate', owner: 'Engineering', description: 'Find the cause and apply a fix or rollback.', next: ['resolved'] },
      { id: 'resolved', kind: 'decision', label: 'Service restored?', owner: 'Engineering', next: [
        { to: 'postmortem', label: 'Yes' },
        { to: 'investigate', label: 'Not yet', risk: 'medium' },
      ] },
      { id: 'postmortem', kind: 'data', label: 'Write post-incident review', owner: 'IC', status: 'planned', description: 'Capture timeline, causes, and action items.' },
    ],
  }),

  template('content-approval', '✍️', 'Draft, review, and publish content with sign-off.', {
    title: 'Content approval',
    description: 'A review pipeline that keeps drafts moving toward publish.',
    direction: 'LR',
    steps: [
      { id: 'brief', kind: 'start', label: 'Brief accepted', owner: 'Editor', status: 'done', description: 'Scope, audience, and deadline are agreed.', next: ['draft'] },
      { id: 'draft', kind: 'process', label: 'Write draft', owner: 'Writer', status: 'active', description: 'Produce the first full draft.', next: ['review'] },
      { id: 'review', kind: 'decision', label: 'Editorial review', owner: 'Editor', description: 'Check accuracy, tone, and structure.', next: [
        { to: 'legal', label: 'Approved' },
        { to: 'draft', label: 'Revisions', condition: 'Changes requested', risk: 'medium' },
      ] },
      { id: 'legal', kind: 'decision', label: 'Compliance check', owner: 'Legal', description: 'Clear claims, quotes, and disclosures.', next: [
        { to: 'publish', label: 'Cleared' },
        { to: 'draft', label: 'Flagged', condition: 'Legal risk', risk: 'high' },
      ] },
      { id: 'publish', kind: 'start', label: 'Publish', owner: 'Editor', status: 'planned', description: 'Schedule and ship the final piece.' },
    ],
  }),

  template('bug-triage', '🐞', 'Route incoming bug reports to the right outcome.', {
    title: 'Bug triage',
    description: 'From a new report to a prioritized, assigned fix.',
    direction: 'TB',
    steps: [
      { id: 'report', kind: 'data', label: 'Bug reported', owner: 'Support', status: 'active', description: 'A customer or teammate files a new issue.', next: ['reproduce'] },
      { id: 'reproduce', kind: 'decision', label: 'Reproducible?', owner: 'Triage', next: [
        { to: 'severity', label: 'Yes' },
        { to: 'need-info', label: 'No', condition: 'Cannot reproduce', risk: 'medium' },
      ] },
      { id: 'need-info', kind: 'process', label: 'Request more info', owner: 'Support', description: 'Ask for steps, logs, or environment details.', next: ['reproduce'] },
      { id: 'severity', kind: 'decision', label: 'Severity?', owner: 'Triage', next: [
        { to: 'hotfix', label: 'Critical', risk: 'high' },
        { to: 'backlog', label: 'Normal' },
      ] },
      { id: 'hotfix', kind: 'process', label: 'Ship hotfix', owner: 'Engineering', status: 'blocked', description: 'Patch, verify, and deploy immediately.' },
      { id: 'backlog', kind: 'start', label: 'Add to backlog', owner: 'Product', status: 'planned', description: 'Prioritize into an upcoming sprint.' },
    ],
  }),
];
