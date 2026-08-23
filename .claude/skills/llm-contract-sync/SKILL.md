---
name: llm-contract-sync
description: Checklist for keeping the LLM request/response contract in sync when a field is added to LifeNode, LifeState, or a node kind. Use when a new field needs to reach the LLM prompt, or when adding a new kind of LLM call (like the If branch-decision call).
---

# LLM contract sync

The LLM contract is defined in three places that have to agree, plus a fourth
that documents it. A field can exist in the data model and still never reach
the LLM if only some of these are updated (this happened with `note`: it was
in `LifeNodeSchema` but missing from `CabangSchema` until a review caught it).

When a field needs to reach the LLM (or a new LLM call type is added), check
all four:

1. **`lib/schema.ts`** — the request/response Zod schemas
   (`CabangSchema`, `SegmentRequestSchema`, `SegmentResponseSchema`,
   `IfRequestSchema`, `IfResponseSchema`, `RingkasanRequestSchema`,
   `RingkasanResponseSchema`). Does the field actually appear in the schema
   that gets serialized and sent, not just on `LifeNode`/`LifeState`?

2. **`lib/graph.ts`** — the functions that build the request payload from raw
   graph data (`segmentCabang` for segments, the request-building code in
   `app/api/branch/route.ts` for If). Does the mapping from `LifeNode`/`Edge`
   fields into the request object actually carry the new field through?

3. **`lib/prompts.ts`** — the system prompts. Any free-text field written by
   the player (label, note, edge condition label) needs the same treatment
   the existing ones get: wrapped in a delimiter tag, and the system prompt
   explicitly told to treat it as player data, never as an instruction. If
   the field is new, does an existing "treat X as data" sentence cover it, or
   does the prompt need an explicit mention?

4. **`CLAUDE.md` §7** (or §6 for a new call type) — the "yang dikirim" /
   "yang harus dibalikin" JSON examples. These are meant to be an accurate,
   copy-pasteable picture of the real wire format. Update the example JSON,
   not just the prose. This file is gitignored, so a clean `git status` after
   a code change doesn't mean the docs were touched too.

For a genuinely new call type (like `/api/branch` for If), also check:

- Does `app/api/*/route.ts` validate the graph server-side before building
  the request (never trust segment/branch data computed by the client)?
- Does the route validate the LLM's response against the *offered* options,
  not just against the schema shape (see how `/api/branch` checks the
  returned `edgeId` is one of the `pilihan` it sent)?
- Is the `.parse()` vs `.safeParse()` choice deliberate — a malformed request
  built from bad graph data should 400, not crash to a raw 500.
