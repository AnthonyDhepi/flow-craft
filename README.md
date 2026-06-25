# Reranga

Reranga is a Vercel-ready internal workflow editor for mapping processes, handoffs, and decision trees.

## What changed

- Rebuilt the app as **React + TypeScript + Vite**
- Replaced the bespoke SVG editor with **React Flow**
- Added **autosave, import/export, auto-layout, drag resizing, metrics, and a richer inspector**
- Added a **production build pipeline**, updated tests, and Vercel deployment config

## Local development

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run lint
npm run test
npm run build
```

## Import format

Nodes auto-size to fit their content, and selected nodes can also be resized directly on the canvas by dragging the visible resize handles.

Reranga accepts two JSON import formats:

1. **Native Reranga JSON** from the built-in export button.
2. **Outline JSON** for model-generated imports.

```json
{
  "title": "Customer onboarding",
  "direction": "LR",
  "steps": [
    {
      "id": "lead-captured",
      "kind": "start",
      "label": "Lead captured",
      "owner": "Revenue ops",
      "description": "Marketing or sales creates a new onboarding request.",
      "next": ["kickoff-review"]
    },
    {
      "id": "kickoff-review",
      "kind": "process",
      "label": "Kickoff review",
      "owner": "CSM",
      "description": "Validate scope, account tier, and delivery owner.",
      "next": ["ready-to-provision"]
    },
    {
      "id": "ready-to-provision",
      "kind": "decision",
      "label": "Ready to provision?",
      "next": [
        { "to": "provision-workspace", "label": "Yes" },
        { "to": "request-missing-inputs", "label": "Missing data", "condition": "Requirements incomplete", "risk": "medium" }
      ]
    }
  ]
}
```

Use `kind` values of `start`, `process`, `decision`, or `data`. Each `next` entry can be either a target step id string or an object with `to`, `label`, optional `condition`, and optional `risk`.

## Deploy to Vercel

1. Push this folder to a Git repository.
2. Import the repository into Vercel.
3. Keep the default settings or use:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Output directory:** `dist`

No server runtime is required.
