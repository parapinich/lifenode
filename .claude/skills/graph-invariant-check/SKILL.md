---
name: graph-invariant-check
description: Checklist for when a NodeKind or the graph model in lib/graph.ts changes. Use when adding/changing a node kind, editing computeGraph/computeSegments/computeOneSegment/validateGraph/worstCaseCallCount, or touching lib/schema.ts's NODE_KINDS.
---

# Graph invariant check

`lib/graph.ts` has several places that all assume the same set of node kinds
behaves consistently. Adding or changing a `NodeKind` (or its incoming/outgoing
wire rules) without touching all of these is how bugs like the `tunggu`/`if`
gapTahun mismatch and the unhandled 500 on schema violation happened.

Before considering a NodeKind change done, walk this list and confirm each one:

1. **`lib/schema.ts`**
   - `NODE_KINDS` includes the new kind.
   - `LifeNodeSchema`'s `superRefine` has the right required/forbidden fields
     for the new kind (label, lane, durasi, intensity as applicable).
   - If the change adds a field that should reach the LLM, `CabangSchema`
     (or `IfRequestSchema`) actually includes it, not just `LifeNodeSchema`.

2. **`lib/graph.ts` — `computeGraph`'s timing loop**
   - Does the new kind need its own branch, or does it correctly fall into
     the existing `start`/`merge`/else split? Check `durasi` is read only
     where it should be (see how `aksi` vs `tunggu` diverged here).

3. **`lib/graph.ts` — `computeSegments` (`segmentStartOf`, `syncEndByStart`)**
   - Is the new kind a sync point (stops `segmentStartOf`, like
     `start`/`merge`/`if`) or a pass-through (like `aksi`/`tunggu`)?
   - If it's a sync point, does it also need to be recognized as a valid
     `target.kind` in the two `syncEndByStart.set(...)` call sites?

4. **`lib/graph.ts` — `computeOneSegment`**
   - Same sync-point-vs-pass-through question as #3, but for the incremental
     walk used by real execution (`lib/runExecute.ts`). These two computations
     (static preview vs incremental) can drift if only one gets updated.

5. **`lib/graph.ts` — `validateGraph`**
   - Incoming/outgoing wire count rules for the new kind.
   - Any field-required checks specific to the kind.
   - If the kind can act as a sync point that costs an LLM call, does
     `worstCaseCallCount`'s weighting (`own = ...`) account for it?

6. **`lib/graph.ts` — `segmentCabang` / `chainEndId`**
   - If the kind can sit between a lane's decision node and the next sync
     point, does `chainEndId`'s walk (`next.kind !== 'tunggu'` today) need to
     recognize it too, or will it stop early and miscompute `gapTahun`?

7. **`lib/graph.ts` — `autoLayout`**
   - Does the new kind need its own Y-band logic, or is falling into the
     "no lane" branch correct?

8. **Server routes (`app/api/simulate/route.ts`, `app/api/branch/route.ts`)**
   - Any `.parse()` call on a schema built from graph computation should be
     `.safeParse()`, not `.parse()` — a schema mismatch here must return a
     clean 400, not crash to a raw 500.

9. **`lib/graph.test.ts`**
   - Add or update a test covering the new kind's timing and validation, the
     way `describe('node tunggu', ...)` and `describe('node if', ...)` do.

10. **`CLAUDE.md`**
    - Update the node-type table (§3), the skema block (§4), and §5's
      validation list if the new kind changes any of them. This file is
      gitignored in this repo (`git log -- CLAUDE.md` for context) so it
      won't show up in `git status` — don't forget it just because git did.
