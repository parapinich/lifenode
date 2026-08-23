# Lifenode

Plan a life on a node canvas. Watch it fall apart.

Lifenode is a life-planning game built on a free-form node canvas, similar to n8n, except the nodes are life decisions instead of workflow steps. You don't pick one path: you pull several branches off a single point in time, and they all run *at once*, in the same body, competing for the same energy and money. Hit Execute and an LLM narrates how that plan actually plays out, in deadpan absurdist prose. Consequences follow logically from an absurd premise, and that contrast is the whole joke.

## Table of contents

- [The idea](#the-idea)
- [Node types](#node-types)
- [How to play](#how-to-play)
- [Canvas controls](#canvas-controls)
- [Validation rules](#validation-rules)
- [How a run actually executes](#how-a-run-actually-executes)
- [Running locally](#running-locally)
- [Scripts](#scripts)
- [Stack](#stack)
- [Project structure](#project-structure)

## The idea

A normal life-sim lets you pick one branching path through a story. Lifenode does the opposite: every branch you pull off a node runs in parallel, in the same single life. If you drag out a career track and a relationship track from the same point, both are happening to the same person at the same time, and they draw from the same pool of energy, money, and attention. The comedy comes from watching those tracks collide.

There is exactly one `LifeState` per run. Branches never fork the state itself, they just represent parallel activity that eventually the story has to reconcile.

## Node types

| Node | Incoming wires | Outgoing wires | What it does |
|---|---|---|---|
| Start | 0 | 1+ | The intake: starting age, funds, and a background note. Exactly one per graph. |
| Aksi (decision) | 1 | 0+ | A life decision: "Take an office job," "Break up," whatever you type. Always instant, it doesn't consume years by itself. |
| Tunggu (wait) | 1 | 1 | Pure elapsed time, like n8n's Wait node. Set a duration in years and drop it after a decision if that decision should actually take a while. A branch with no Wait node stays instant. |
| Merge | 2+ | 1+ | A sync point. All the branches feeding into it have been running in parallel; this is where the story catches them back up to the same age and triggers one LLM call to narrate what happened, including how much any shorter branch sat idle. |
| If | 1 | 2+ | A conditional fork. Each outgoing wire gets its own free-text condition label (e.g. "the shop turns a profit" vs. "the shop goes under"). When execution reaches an If node, the LLM picks exactly one branch to actually happen, based on the state so far. The branches that weren't picked are never executed, they're just marked as not taken and rendered dim on the canvas. |
| End | 1 | 0 | Triggers the closing summary card. Exactly one per graph. |

There's no separate Split node for parallel branching: pulling two wires out of any node is how you branch, same as n8n. Reach for an If node specifically when the branches are mutually exclusive (only one of them should ever have happened), not when they're meant to run side by side.

Decisions also carry a **lane** (`career`, `relationships`, `health`, or `chaos`) purely for color-coding and prompt context. Chaos is the deliberate outlet for anything absurd.

## How to play

1. **Fill in the intake form** in the header: age at intake, starting funds, and a background note. Stuck on the background note? Hit the dice button next to it for a random starting premise.
2. **Build your plan on the canvas.** Drag decisions from the *Decision Catalog* on the left, or write your own label, every field is free text. Wire nodes together by dragging from one node's handle to another.
3. **Add time where it matters.** A decision by itself is instant. If you want it to take years, drop a Wait node right after it and set the duration. Skip the Wait node entirely and that step just happens in the blink of an eye.
4. **Branch on purpose.** Pull multiple wires out of a node to run things in parallel (a career track and a relationship track happening at once). Use an If node when you want a fork where only one side can be true, and label each branch with the condition that would make it happen.
5. **Sync branches with a Merge node.** A Merge needs at least two incoming wires and marks the point where your parallel tracks catch back up with each other. If one branch took longer than the others, the shorter one sat idle for the difference, and the game will make that hurt in the narration.
6. **Add a description if it helps.** Every decision node has an optional Description field for extra context the LLM should know about (what job, who with, why), separate from the short label.
7. **Fix anything marked in red.** The canvas validates live: disconnected nodes, missing durations, a Merge with too few inputs, an If branch missing its condition label, a plan whose worst-case path would need more than six LLM calls. All of it gets flagged with a red outline and a specific message, mirrored in the errors panel under the header. Execute stays disabled until the graph is clean.
8. **Hit Execute.** The canvas locks and the plan runs one segment at a time. Edges animate while the segment they lead into is being processed, and settle into a solid line once that part of the story is resolved. Nodes get stamped *Pass*, *Partial*, or *Failed* as results come back. If an If node is reached mid-run, there's a brief extra beat while the LLM decides which branch actually happened, then the branches not taken dim out.
9. **Close the case.** Once the run finishes, generate the life summary card: a title, an epitaph, the three most decisive moments, and a verdict per lane. Download it as a PNG or share it.
10. **Check the history.** Every closed case gets filed automatically; reopen past cards from the History panel.

Toolbar extras: **Undo/Redo** (`Ctrl+Z` / `Ctrl+Shift+Z`) for canvas edits, a **template** button to drop in a worked example if the blank canvas is intimidating, and an **auto-layout** button to tidy up node positions by age.

## Canvas controls

- **Pan:** hold the middle mouse button and drag.
- **Select one node or edge:** left click it.
- **Select multiple nodes:** left click and drag on empty canvas to draw a selection box, then release. Anything the box touches gets selected.
- **Delete selected nodes:** press `Backspace` or `Delete`.
- **Connect two nodes:** drag from a node's output handle to another node's input handle.
- **Edit an If node's branch conditions:** click the If node itself and type directly into each branch's input, the condition text also shows read-only on the wire for context.

## Validation rules

The same validation function runs both in the browser (for instant feedback while you build) and on the server (which never trusts what the client sends). A graph is rejected, with the specific offending node or nodes flagged, if:

- There isn't exactly one Start node.
- There isn't exactly one End node.
- Any node isn't connected to Start, or has no path forward to End.
- The graph contains a cycle.
- A Merge has fewer than two incoming wires.
- An Aksi node is missing its label.
- A Wait node is missing a duration, or doesn't have exactly one incoming and one outgoing wire.
- An If node doesn't have exactly one incoming wire, has fewer than two outgoing branches, or has a branch with no condition label.
- The graph's worst-case path (the longest possible chain of Merge and If decisions from Start to End) would need more than six LLM calls in a single run. A Merge costs one call, an If costs two (the branch decision itself, plus the segment that follows whichever branch gets picked).

## How a run actually executes

A **segment** is the stretch of nodes between two sync points, where a sync point is Start, any Merge, any If, or End. Each segment is one LLM call. In a graph with no If nodes, that means the old, simple math still holds: N merges means N+1 segments means N+1 LLM calls, plus one more for the closing summary.

If nodes make this dynamic: the plan doesn't know in advance which branch of an If will actually get taken, so it can't precompute the full list of segments up front the way it used to. Instead, execution walks the graph incrementally. It computes and runs one segment at a time, and only when it reaches an If node does it make an extra call asking the LLM to pick a branch based on the state so far. Only the chosen branch is walked from that point forward, the alternatives are never executed and just get marked as skipped in the UI.

The LLM never holds state itself. The full `LifeState` is sent fresh with every segment, and the LLM only returns the delta plus narration for that piece of the story. This keeps segment 4 from forgetting something that happened back in segment 2.

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

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the Next.js dev server. |
| `npm run build` | Production build. |
| `npm run start` | Runs the production build. |
| `npm run test` | Runs the Vitest suite, mainly the graph engine (timing, segmenting, validation, the worst-case call budget). |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run lint` | ESLint. |

## Stack

- Next.js (App Router) with TypeScript
- React Flow for the canvas
- Zustand for graph state and run state
- Zod for validation at every boundary (player input, LLM output, request bodies)
- Tailwind for styling
- Google Gen AI SDK (`gemini-3.6-flash`) for the segment narration, branch decisions, and closing summary

## Project structure

```
app/
  page.tsx                    # main layout, intake form, toolbar
  api/simulate/route.ts       # one segment per request
  api/branch/route.ts         # the branch decision call for If nodes
  api/summary/route.ts        # the closing summary card
components/
  canvas/Board.tsx            # React Flow wrapper
  canvas/nodes/                 # Start, Aksi, Tunggu, Merge, If, End node components
  canvas/NodePalette.tsx
  canvas/edges/DeletableEdge.tsx
  result/                        # segment results, life card, run history
lib/
  schema.ts                   # Zod schemas and types, the single source of truth
  graph.ts                    # topological sort, timing, segmenting (static and incremental), validation, auto-layout
  prompts.ts                  # system prompts and message builders
  engine.ts                   # density calculation, applying deltas, ledger management
  store.ts                    # Zustand store for the graph itself, with undo/redo
  runStore.ts                 # Zustand store for run state
  runExecute.ts                # orchestrates the incremental run: simulate, branch, and summary calls
  historyStore.ts              # past runs, persisted to local storage
  nodeExamples.ts              # example text for the background-note randomize button
  llm.ts                      # shared LLM call helper with retry and schema validation
```

Everything is local-only for now: no accounts, no database, state lives in local storage. See `CLAUDE.md` for the full internal design notes and the rules that shape how the LLM narrates a run.
