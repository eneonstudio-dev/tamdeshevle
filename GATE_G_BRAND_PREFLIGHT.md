# Gate G — Public Brand / Launch Preflight

**Status:** OPEN  
**Canonical brand contract:** `BRAND_CANON.md`  
**Purpose:** separate proven repository facts from trademark/domain/launch decisions before public launch.

This document is evidence for `RELEASE_GATE.md`. It is deliberately fail-closed: an unresolved item stays unresolved rather than being guessed from search results.

## Owner brand lock — RESOLVED

The owner decision predates this Gate G pass and is now recorded canonically in `BRAND_CANON.md`:

- primary Latin brand: **VOTONOBAI**;
- canonical Russian rendering: **Вотонобай**;
- assistant / character: **Бай**;
- `Votonobay` is a superseded spelling;
- former «Там дешевле / Там Дешевле / Тамдешевле» identity is not the product name and may survive only as ordinary descriptive/advertising language where semantically appropriate;
- the product promise is broader than “cheapest”: VOTONOBAI helps find the best option for the user's conditions.

This resolves the owner-choice part of Gate G. It does **not** automatically normalize legacy browser strings and does not prove trademark/domain/social availability.

## Proven from current public surfaces

### Legacy public naming debt still exists

The browser-visible release still contains legacy forms that now conflict with the locked canon:

- `index.html` title: **Votonobay — как лучше собрать корзину**;
- `index.html` description starts with **Votonobay**;
- `manifest.json` `name` and `short_name`: **Votonobay**;
- `app.js` Home header: **Тамдешевле**;
- `app.js` sale easter egg: **Там Дешевле продаётся**.

PR #497 automated the broader inventory across browser-loaded files. Its guard scanned 66 browser-loaded public files and found:

- `Votonobay` in 11 browser surfaces;
- `Тамдешевле` in 3;
- `Там Дешевле` in `app.js`.

These are migration debt, not alternate approved brands. Public-launch consistency remains incomplete until the browser surfaces are normalized and manually replayed against `BRAND_CANON.md`.

### Retailer-partnership claim

Current inspected public surfaces do not contain a positive claim that VOTONOBAI is an official retailer partner.

Permanent guard:

```bash
node scripts/test-public-brand-gate.mjs
```

The guard follows local browser `<script src>` files from `index.html`, scans those browser-loaded surfaces plus `index.html`, `app.js` and `manifest.json`, and fails on positive official-partnership wording. It also prints the public brand-token inventory.

The guard does **not** prove a commercial/legal relationship.

### Current hosting boundary

`.github/workflows/pages.yml` deploys the repository root to GitHub Pages and takes the environment URL from the GitHub Pages deployment output.

At this snapshot:

- no repository `CNAME` file has been established as public-domain evidence;
- the repository metadata did not provide a configured homepage during Rogue preflight;
- GitHub Pages deployment success is proven by CI, but the final public custom domain / legacy URL decision is not.

Do not infer domain ownership or availability from this repository state.

## Still unresolved — required before public launch

### 1. Public-surface normalization

Normalize browser-visible legacy brand tokens to the owner-approved canon through reviewed changes with regression coverage. Do not blind-replace descriptive uses of “там дешевле” where the words are ordinary language rather than a product identity.

Acceptance requires a fresh-main browser/manual replay showing metadata/PWA name and visible product identity are consistent with `BRAND_CANON.md`.

### 2. Trademark / existing-brand clearance

A preliminary web search is not legal clearance.

Before public launch, record evidence from the relevant authoritative trademark registries / professional review appropriate to launch jurisdictions. Similar marks, transliterations and relevant Nice classes matter; exact-string search alone is insufficient.

### 3. Domain and social handles

Record the selected domain and social handles only after availability/control is actually verified. Search-engine absence is not evidence that a domain or handle is available.

### 4. Legacy public URL

The repository is still named `tamdeshevle`. Decide explicitly whether the GitHub Pages legacy URL is:

- closed-beta-only and intentionally temporary; or
- replaced/redirected before public launch.

Repository naming is not the final public brand architecture.

## Gate G acceptance evidence

Gate G can be marked PASS only when all of the following are recorded:

- owner-approved canonical public spelling / brand relationship — **DONE via `BRAND_CANON.md`**;
- public browser surfaces normalized and manually verified against the canon;
- authoritative trademark/existing-brand preflight evidence for intended launch scope;
- verified control/availability of the selected public domain and required social handles;
- intentional decision for the legacy `tamdeshevle` URL;
- public partnership-claim guard green on fresh `main`.

## Non-goals

This preflight does not change runtime shopping behavior, truth/ranking, retailer capability, security scope, training/checkpoint status or the current controlled closed-beta decision.

**Public launch remains NOT APPROVED until Gate G is fully closed with evidence.**
