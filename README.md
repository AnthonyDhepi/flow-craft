# FlowCraft

FlowCraft is a Vercel-ready internal workflow editor for mapping processes, handoffs, and decision trees.

## What changed

- Rebuilt the app as **React + TypeScript + Vite**
- Replaced the bespoke SVG editor with **React Flow**
- Added **autosave, import/export, auto-layout, metrics, and a richer inspector**
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

## Deploy to Vercel

1. Push this folder to a Git repository.
2. Import the repository into Vercel.
3. Keep the default settings or use:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Output directory:** `dist`

No server runtime is required.
