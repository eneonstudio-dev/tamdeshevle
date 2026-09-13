# Votonobay Decisions / ADR

This directory stores durable architecture and product decisions that should not depend on chat memory.

## When to create an ADR

Create or update an ADR when a change affects one or more of:
- MVP scope or verticals;
- UniversalBasket / StoreBasket / PurchasePlan semantics;
- truth/rankability rules;
- Bay action or safety boundaries;
- provider/data-source policy;
- retailer integration capability;
- security/release policy;
- monetization invariants;
- approved product/brand direction.

Routine implementation details and temporary tasks do not need an ADR.

## Rules

1. Never rewrite history to make an old decision look as if it never existed.
2. If a decision changes, mark the old ADR `SUPERSEDED` and link the replacement.
3. Fundamental strategy changes require explicit owner approval before the ADR is marked `ACTIVE`.
4. Factual implementation status can be updated by the relevant owner role.
5. Every substantial ADR should reference the relevant PR/commit when available.

## Status values

- `PROPOSED`
- `ACTIVE`
- `SUPERSEDED`
- `REJECTED`

## File naming

`ADR-XXX-short-kebab-title.md`

Example: `ADR-007-multi-store-default-max-two.md`

## Template

```md
# ADR-XXX — Title

**Date:** YYYY-MM-DD
**Status:** PROPOSED | ACTIVE | SUPERSEDED | REJECTED
**Owner approval required:** yes | no
**Related:** PR/commit/issue links or identifiers

## Context
What problem or conflict forced this decision?

## Decision
What exactly is now the rule?

## Why
Why this option instead of alternatives?

## Consequences
What becomes easier, harder, forbidden, or required?

## Supersedes / Superseded by
If applicable.
```

The compact decision table in `VOTONOBAI_MASTER_ROADMAP.md` remains the index of foundational decisions. Detailed ADRs live here when more context is needed.
