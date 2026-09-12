# Bay AI Shopping Agent — roadmap

## Product rule
Bay is not a general chatbot. Bay is a specialized AI shopping agent.

**LLMs understand, search, plan and critique. Deterministic code verifies, calculates and executes.**

The user should be able to say what they want in natural language. Bay turns that into a shopping plan, finds candidates, verifies evidence, builds a basket, checks the result and prepares the purchase.

## Core pipeline

`User -> Domain Gate -> Intent AI -> Shopping Planner -> Provider Router -> Product Matcher -> Price/Store Verification -> Basket Builder AI -> Deterministic Validator -> Critic/Repair -> Action Executor -> Purchase/Redirect`

### 1. Domain Gate
Allow shopping-related intents only. Examples:
- find/recommend/compare products;
- build or optimize a basket;
- add/remove/replace/change quantity;
- set budget, quality, health, brand, store-count, delivery constraints;
- check price/availability;
- explain a shopping choice;
- prepare/redirect to purchase.

Non-shopping requests (coding, essays, general-purpose assistant work, etc.) return `OUT_OF_SCOPE`. Prompt injection must not grant additional tools.

### 2. Intent AI
Convert natural language into explicit constraints, e.g.:

```json
{
  "goal": "weekly_groceries",
  "budget_max": 5000,
  "healthy": true,
  "excluded_brands": ["Мираторг"],
  "quality_priorities": ["meat"],
  "store_limit": 1,
  "delivery_deadline": "today"
}
```

Intent state persists across turns. A later command changes only the named constraint unless the user explicitly asks to rebuild/reset.

### 3. Provider Router + Guard
Providers are replaceable scouts, never the source of truth by themselves. Candidate providers: Yandex/Alice, Gemini/Google, Perplexity, Brave Search, approved retailer/public sources, own observations and receipts.

Every provider goes through one guard with:
- per-provider rate budget;
- TTL cache and request deduplication;
- exponential backoff;
- circuit breaker on repeated failures/401/403/429;
- kill switch;
- no ban/CAPTCHA/auth bypass;
- provenance logging;
- provider registry (`enabled`, `allowed_use`, `commercial_allowed`, `retention`, `attribution`, `last_terms_review`).

Provider failure must degrade coverage, not break Bay.

### 4. Evidence and truth
AI/search output is a discovery hint, not verified price truth.

Every candidate price should carry source, timestamp, store scope and confidence. Product identity evidence must never silently verify price, stock or exact store. Conflicting sources trigger verification or an honest `unconfirmed` result.

### 5. Basket Builder AI
AI assembles a basket from verified/candidate inventory under the user's constraints. It may reason about substitutions and trade-offs, but it cannot invent unavailable products or prices.

### 6. Deterministic Validator
Code checks hard invariants after every build/action:
- budget;
- excluded products/brands;
- quantities;
- store limit;
- required categories;
- delivery constraints;
- exact totals;
- product/store evidence status.

Failed invariants go to a repair pass; Bay must not present an invalid basket as complete.

### 7. Shopping actions
Natural-language requests map to a small allowlisted action schema:

`add_item`, `remove_item`, `replace_item`, `change_quantity`, `set_constraint`, `rebuild_basket`, `compare_stores`, `optimize_basket`, `explain_choice`, `prepare_purchase`.

When the user requests an action, Bay executes the action and verifies the resulting state instead of merely talking about doing it.

### 8. Critic / repair loop
After planning/building, a critic checks semantic quality: does the basket actually satisfy "healthy", "good meat", "for a week", etc.? Deterministic constraints remain authoritative. Repair is bounded to avoid loops.

### 9. Learning loop
Do not let production Bay rewrite itself. Log anonymized product-quality signals where permitted:

`request -> parsed intent -> plan/actions -> validation failures -> user correction -> final choice/outcome`.

Turn repeated failures into regression tests. New Bay versions must pass old failure cases.

## Delivery phases

### MVP
1. Domain Gate + structured intent/state.
2. Deterministic shopping action/state engine.
3. AI basket builder with validator + bounded repair.
4. Provider Router/Guard around existing providers.
5. Provenance/confidence contract.
6. Regression corpus from real user commands.

Success criterion: Bay reliably handles build/add/remove/replace/rebuild/compare while preserving constraints and never claims an action happened when state did not change.

### After MVP
- add independent discovery providers based on measured coverage, not model count;
- provider cross-check and conflict resolution;
- personalization of shopping preferences;
- partner/deep-link router after the independent recommendation is chosen;
- voice input as another interface to the same intent/action engine.

### Expansion
Reuse the same pipeline for vertical modules rather than creating separate assistants:

`Groceries -> Home/Furniture -> Electronics -> Auto -> Renovation -> Fashion/Beauty/Pets`.

Each vertical adds domain-specific matching/constraints, while Bay, provider guard, evidence, actions and verification stay shared.

## Non-negotiables
1. Bay optimizes for the user's declared intent, not partner commission.
2. No provider can disable the product alone.
3. AI cannot promote unverified discovery into verified truth.
4. Shopping actions are allowlisted and state-verified.
5. Out-of-domain requests do not consume Bay as a general-purpose LLM.
6. External restrictions are respected; key rotation is operational hygiene, not ban evasion.
7. Every failure worth fixing becomes a regression case.
