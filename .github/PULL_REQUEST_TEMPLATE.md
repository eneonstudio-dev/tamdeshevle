## Task Envelope

> Keep this compact. Delete guidance text before requesting acceptance.

**TASK_ID:** issue/PR/stable id  
**OWNER_ROLE:** one owning role  
**PRIORITY:** P0 / P1 / P2 / P3  

### User / release problem
<!-- Observable problem this PR resolves. One paragraph max. Do not retell project history. -->

### Success
<!-- What must be true when this PR is DONE? Prefer observable state/action outcome. -->

### Evidence required
<!-- Exact tests, browser replay, data/source proof, security proof or eval evidence required for acceptance. -->

### Allowed scope
<!-- Files/layers this task is allowed to change. -->

### No-touch
<!-- Layers/contracts explicitly forbidden for this task. -->

### Stop if
<!-- Concrete conditions that require Rogue/owner/Reinhard/Tali escalation instead of scope expansion. -->

## Delta

### What changed
<!-- Only the implementation/research delta. -->

### Why this is the smallest safe change
<!-- Explain why this does not open a broader track. -->

### Residual limits
<!-- Known limits that remain after merge. `None` is acceptable when true. -->

## Acceptance evidence

- [ ] Exact intended scenario/research question is answered.
- [ ] Relevant automated checks are green.
- [ ] Adjacent critical behavior was checked where applicable.
- [ ] Truth/security/capability boundaries were not weakened.
- [ ] P0/P1 caused by this change is not knowingly hidden.
- [ ] Material regression/source/status documentation was updated only if needed.
- [ ] Final delta handoff will be posted to #474 after merge/fresh-main verification.

### Evidence links / runs / SHA
<!-- Link or name exact runs, regression cases, screenshots, sources or eval artifacts. -->
