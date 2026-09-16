# Gate G — Public Brand / Launch Preflight

**Status:** OPEN  
**Snapshot base:** `b44f25f5ce2e89eb55c2c396cb82b2ee336f453b`  
**Purpose:** separate repository facts from owner/legal/domain decisions before public launch.

This document is evidence for `RELEASE_GATE.md`. It is deliberately fail-closed: an unresolved item stays unresolved rather than being guessed from search results or project history.

## Proven from current public surfaces

### Public naming is not yet canonical

The browser-visible release currently contains multiple product/brand forms:

- `index.html` title: **Votonobay — как лучше собрать корзину**;
- `index.html` description starts with **Votonobay**;
- `manifest.json` `name` and `short_name`: **Votonobay**;
- `app.js` Home header: **Тамдешевле**;
- `app.js` sale easter egg: **Там Дешевле продаётся**.

This is evidence of an unresolved public-brand lock, not permission for an agent to choose one spelling automatically.

### Retailer-partnership claim

Current inspected public surfaces do not contain a positive claim that Votonobay / «Там Дешевле» is an official retailer partner.

Permanent guard:

```bash
node scripts/test-public-brand-gate.mjs
```

The guard follows local browser `<script src>` files from `index.html`, scans those browser-loaded surfaces plus `index.html`, `app.js` and `manifest.json`, and fails on positive official-partnership wording. It also prints the public brand-token inventory.

The guard does **not** prove a commercial/legal relationship and does **not** choose a canonical brand spelling.

### Current hosting boundary

`.github/workflows/pages.yml` deploys the repository root to GitHub Pages and takes the environment URL from the GitHub Pages deployment output.

At this snapshot:

- no repository `CNAME` file has been established as public-domain evidence;
- the repository metadata did not provide a configured homepage during Rogue preflight;
- GitHub Pages deployment success is proven by CI, but the final public custom domain / legacy URL decision is not.

Do not infer domain ownership or availability from this repository state.

## Still unresolved — required before public launch

### 1. Owner brand lock

Owner must explicitly approve the canonical public relationship among:

- **Votonobay**;
- **VOTONOBAI**;
- **Там Дешевле / Тамдешевле**.

The decision should answer whether «Там Дешевле» is the product name, descriptor/tagline, legacy name, or a separate consumer-facing layer under Votonobay.

Until then, agents must not mass-rename public files merely to make spelling consistent.

### 2. Trademark / existing-brand clearance

A preliminary web search is not legal clearance.

Before public brand lock, record evidence from the relevant authoritative trademark registries / professional review appropriate to launch jurisdictions. Similar marks, transliterations and relevant Nice classes matter; exact-string search alone is insufficient.

### 3. Domain and social handles

Record the selected domain and social handles only after availability/control is actually verified. Search-engine absence is not evidence that a domain or handle is available.

### 4. Legacy public URL

The repository is still named `tamdeshevle`. Decide explicitly whether the GitHub Pages legacy URL is:

- closed-beta-only and intentionally temporary; or
- replaced/redirected before public launch.

No agent should silently treat repository naming as the final public brand architecture.

## Gate G acceptance evidence

Gate G can be marked PASS only when all of the following are recorded:

- owner-approved canonical public spelling / brand relationship;
- authoritative trademark/existing-brand preflight evidence for intended launch scope;
- verified control/availability of the selected public domain and required social handles;
- intentional decision for the legacy `tamdeshevle` URL;
- public partnership-claim guard green on fresh `main`;
- public copy/manual walkthrough consistent with the locked brand decision.

## Non-goals

This preflight does not change runtime shopping behavior, truth/ranking, retailer capability, security scope, training/checkpoint status or the current controlled closed-beta decision.

**Public launch remains NOT APPROVED until Gate G is fully closed with evidence.**
