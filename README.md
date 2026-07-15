# FlowCraft

**A local-first flowchart studio for mapping processes, handoffs, and decision trees.**

FlowCraft is a browser-based diagram editor. Sketch a workflow on an infinite canvas,
give every step an owner and a status, branch on decisions, and export the result to
JSON or PNG. Everything is stored locally in your browser — no account, no server.

> This is version 4 — an end-to-end redesign of the previous "Reranga" build. The
> tested logic layer (document schema, auto-layout, import parsing, persistence) was
> kept and hardened; the entire experience on top of it was rebuilt. See
> [`docs/redesign.md`](docs/redesign.md) for the design rationale.

## Highlights

- **Dashboard** — a real project home: searchable library of saved diagrams with
  duplicate, export, and delete, plus live stats. First-run **templates** spin up
  fully-editable starter flows (customer onboarding, incident response, content
  approval, bug triage).
- **Studio editor** — a focused three-pane workspace: a shape palette, an infinite
  canvas, and a contextual inspector that switches between the selected **element**
  and the **diagram** as a whole.
- **Command palette (⌘K / Ctrl+K)** — every action is one fuzzy search away: add
  shapes, auto-layout, undo/redo, export, import, switch theme.
- **Expressive nodes** — start/end, process, decision, and data shapes with owner,
  status, notes, and a per-node accent color. Nodes auto-size to their content and can
  be resized by hand.
- **Smart connections** — drag between nodes to connect them; label edges, attach a
  condition, mark risk (low/medium/high, color-coded), and optionally animate.
- **Auto-layout** — one click re-flows the graph vertically or horizontally (Dagre).
- **Local-first persistence** — autosave to IndexedDB with a `localStorage` fallback,
  so your work survives refreshes and offline use.
- **Portable exports** — download a diagram as clean JSON or a high-resolution PNG,
  and re-import either the native JSON or a simple **outline JSON** format.
- **Light & dark themes** that follow your system preference by default.

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL. The app opens on the dashboard — pick a template or
**New diagram** to start editing.

## Quality checks

```bash
npm run lint     # eslint
npm run test     # vitest unit tests
npm run test:e2e # playwright end-to-end tests
npm run build    # type-check + production build
npm run check    # lint + unit tests + build
```

## Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| Command palette | `⌘K` / `Ctrl+K` |
| Undo / Redo | `⌘Z` / `⌘⇧Z` (or `⌘Y`) |
| Duplicate selected step | `⌘D` |
| Delete selection | `Delete` / `Backspace` |

## Import format

FlowCraft imports two shapes of JSON:

1. **Native FlowCraft JSON** — exactly what the export button produces.
2. **Outline JSON** — a compact, model-friendly format that auto-lays-out on import.

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
      "next": ["ready-to-provision"]
    },
    {
      "id": "ready-to-provision",
      "kind": "decision",
      "label": "Ready to provision?",
      "next": [
        { "to": "provision-workspace", "label": "Yes" },
        { "to": "request-inputs", "label": "Missing data", "condition": "Requirements incomplete", "risk": "medium" }
      ]
    }
  ]
}
```

`kind` is one of `start`, `process`, `decision`, or `data`. Each `next` entry is either
a target step id (string) or an object with `to`, `label`, and optional `condition` and
`risk`. Use the editor's **Copy import template** command to grab a working example.

## Architecture

```
src/
  app.tsx                 # top-level router: dashboard <-> editor, theme, persistence wiring
  hooks.ts                # theme, autosave, editor shortcuts, toasts
  types.ts                # document / node / edge model
  lib/
    diagram.ts            # document schema, node/edge factories, sanitizing, metrics
    layout.ts             # Dagre auto-layout
    import.ts             # native + outline JSON import parser
    persistence.ts        # IndexedDB + localStorage, export/delete, PNG export
    templates.ts          # prebuilt starter flows
  store/
    editor-store.ts       # Zustand store: nodes, edges, selection, history/undo
  components/
    dashboard.tsx         # home: library, templates, stats
    editor.tsx            # editor shell: top bar, rails, toolbar, command wiring
    canvas.tsx            # React Flow canvas
    flow-node.tsx         # custom node renderer with auto-sizing
    shape-palette.tsx     # left rail shape picker
    inspector.tsx         # right rail element/diagram inspector
    command-palette.tsx   # ⌘K launcher
```

**Stack:** React 18 · TypeScript · Vite · [React Flow](https://reactflow.dev) ·
[Zustand](https://github.com/pmndrs/zustand) · [Dagre](https://github.com/dagrejs/dagre).

## Deploy

The app is a fully static SPA. On Vercel, use the Vite preset (build `npm run build`,
output `dist`). Any static host works — no server runtime is required.
