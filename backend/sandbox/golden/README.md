# The golden set

One JSON file per recorded clip. The clips themselves are in the drafts bucket, never in this repo
(`docs/decisions/2026-10-09-test-clips-are-recorded-by-the-team.md`). Run with `pnpm golden` in
`backend/`. Every run costs money, so it is run by hand.

Each file says where the clip is, what it is checked against, and the result each item should get:

```json
{
  "clip": "golden/code-said-correctly.mp4",
  "about": "The code GLOW20 is said clearly at about 0:40 and shown on screen.",
  "items": [
    { "id": "code-said", "name": "Say the code GLOW20", "kind": "said", "exact": "GLOW20" },
    { "id": "serum", "name": "Show the serum in use", "kind": "shown" }
  ],
  "expected": { "code-said": "passed", "serum": "passed" }
}
```

`kind` is one of said, shown_as_text, shown, timing. `expected` is passed, fix_needed or unsure.
