# FlowCraft v4 — redesign notes

Version 4 is a ground-up redesign of the workflow editor that previously shipped as
"Reranga". The brief was to reimagine and rebuild the application end to end while
keeping its intended purpose: a tool for mapping processes, handoffs, and decision
trees.

## What we kept

The previous build had a genuinely solid, well-tested logic layer. Rewriting it would
have thrown away working code and test coverage for no benefit, so it was preserved and
extended rather than replaced:

- **Document model & sanitizing** (`lib/diagram.ts`) — including legacy-schema
  migration, so diagrams saved by older versions still open.
- **Auto-layout** (`lib/layout.ts`) — Dagre-based vertical/horizontal re-flow.
- **Import parser** (`lib/import.ts`) — native + outline JSON, with validation.
- **Persistence** (`lib/persistence.ts`) — IndexedDB with a `localStorage` fallback.
- **Editor store** (`store/editor-store.ts`) — Zustand state with undo/redo history
  and content-aware node auto-sizing.

All existing unit tests for these modules still pass unchanged.

## What we changed, and why

The old UI was the weak point. It leaned on a draw.io pastiche and filled the layout
with **non-functional placeholders** ("Layers", "Comments", "Pages") that were
explicitly labelled as things the app *couldn't* do. The home page was marketing copy
wrapped around a fake "workspace preview". There was also a real functional gap: no way
to delete or manage saved diagrams.

The redesign replaces apology with capability.

### Rebrand: Reranga → FlowCraft

Reclaimed the repository's own namesake. The product now states what it is — a
flowchart studio — instead of describing what it imitates.

### Dashboard instead of a landing page

The home screen is now a working project home:

- A searchable **library** of saved diagrams, each card showing a mini preview,
  description, counts, and last-edited time, with inline **duplicate / export /
  delete** actions (delete was previously impossible).
- A **template gallery** that instantiates fully-editable starter flows. Templates are
  authored as outline JSON and materialised through the existing import parser — one
  code path, no duplication.
- Live stats derived from the real library, not hard-coded.

### A focused three-pane editor

- **Left rail** — a shape palette (start/end, process, decision, data).
- **Center** — the infinite canvas with a floating action toolbar and minimap.
- **Right rail** — a contextual inspector that switches between the selected
  **Element** (node or edge properties, including a per-node accent picker) and the
  **Diagram** as a whole (name, description, health metrics).

### Command palette

A `⌘K` launcher exposes every action — shapes, layout, edit, export, view — behind a
fuzzy search with keyboard navigation. It replaces the old flat wall of toolbar
buttons as the primary way to drive the app.

### New design system

`styles.css` was rewritten as a token-driven, dark-first system: layered neutral
surfaces, a single indigo accent, Inter for UI type, consistent radii and shadows, and
a light theme that mirrors it. Themes follow the system preference by default.

## Additions to the logic layer

The redesign only needed small, additive changes to the preserved layer:

- `deleteStoredDocument(id)` in `persistence.ts` — remove a diagram from IndexedDB, the
  legacy library, and the active-document slot.
- `lib/templates.ts` — the starter-flow catalog.
- An optional `description` on `DiagramMeta`, plus an `updateDiagramMeta` store action,
  so diagrams can carry a summary shown on dashboard cards and in the inspector.

## Testing

- **Unit** (`tests/unit/`, Vitest) — unchanged; still cover diagram utilities, layout,
  import parsing, and store node-resizing.
- **End-to-end** (`tests/e2e/`, Playwright) — rewritten for the new UI: opening a blank
  editor from the dashboard, adding a node and seeing the diagram metrics update, and
  starting a diagram from a template.
