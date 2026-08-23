# Lifenode

Plan a life on a node canvas. Watch it fall apart.

Lifenode is a life-planning game built on a free-form node canvas, like n8n — except the nodes are life decisions instead of workflow steps. You don't pick one path: you pull several branches off a single point in time and they all run *at once*, in the same body, competing for the same energy and money. Hit Execute and an LLM narrates how that plan actually plays out, in deadpan absurdist prose. Consequences follow logically from an absurd premise — that's the whole joke.

## How to play

1. **Fill in the intake form** in the header: age at intake, starting funds, a background note.
2. **Build your plan on the canvas.** Drag decisions from the *Decision Catalog* on the left (or write your own — every label is free text). Wire them together by dragging from one node's edge to another. One node can have several outgoing wires — that's how you branch into parallel tracks (career, relationships, health, or pure chaos).
3. **Sync branches with a Merge node.** A Merge needs at least two incoming wires and marks a point where your parallel tracks catch back up with each other. If one branch took longer than the others, the short one just sat idle for the difference — and the game will make that hurt.
4. **Fix anything marked in red.** The canvas validates live: disconnected nodes, missing durations, a Merge with too few inputs — all flagged with a red outline and a message, same as the errors panel under the header. Execute stays disabled until it's clean.
5. **Hit Execute.** The graph runs segment by segment (bounded by Start, each Merge, and End) — one LLM call per segment. Nodes light up as their results come back: a stamped *Pass*, *Partial*, or *Failed*. The canvas locks while a run is in progress.
6. **Close the case.** Once the run finishes, generate the life summary card — a title, an epitaph, the three most decisive moments, and a verdict per lane. Download it as a PNG or share it.
7. **Check the history.** Every closed case gets filed automatically; reopen past cards from the History panel.

Toolbar extras: **Undo/Redo** (`Ctrl+Z` / `Ctrl+Shift+Z`) for canvas edits, a **template** button to drop in a worked example if the blank canvas is intimidating, and an **auto-layout** button to tidy up node positions by age.

## Running locally

```bash
npm install
```

Create `.env.local` with a Gemini API key:

```
GEMINI_API_KEY=your-key-here
```

Then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Other scripts: `npm run test` (Vitest, covers the graph engine), `npm run typecheck`, `npm run lint`.

## Stack

Next.js (App Router) + TypeScript, React Flow for the canvas, Zustand for state, Zod for validation at every boundary, Tailwind, and the Google Gen AI SDK (`gemini-3.6-flash`) for the narration and life-summary calls.
