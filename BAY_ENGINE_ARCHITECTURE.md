# Votonobay — Bay Engine / Model Abstraction

**Status:** approved architecture track
**Owner:** Rouk V3 (operational sequencing)
**Technical strategy:** Arbiter
**Related:** #468

## Goal

Bay is a Votonobay product system, not a wrapper around one LLM. Models are replaceable reasoning engines behind a stable orchestration boundary. Votonobay continues to own shopping state, memory, truth, validation, persona, actions, fallback and release policy.

Closed-beta default is **zero-budget first**. Paid model access must remain disabled unless explicitly enabled under a separately capped budget policy.

## Current AI contour on main

This track is consolidation, not greenfield work. Current main already contains the following relevant pieces:

| Concern | Current component(s) | Current role |
|---|---|---|
| Provider output safety | `bai-provider-contract.js` | Normalizes provider operations and rejects invalid actions |
| Brain routing / trained serving | `bai-brain-runtime.js` | Release-pinned trained runtime, timeout, circuit breaker, hard-context and forbidden-fact validation |
| Brain release selection | `bai-brain-registry.js` | Promoted-release registry with deterministic safe baseline |
| Runtime fallback | `runtime-bridge.js` + planner/execution contracts | Falls back to deterministic planning/execution and verifies effects |
| Shopping authority | `bai-shopping-agent-kernel.js` + execution/state contracts | Owns deterministic shopping actions and state mutations |
| Persona | `bai-character.js` + canonical system prompt | Owns Bay tone/behaviour independently of a specific model |
| Memory/context | `bai-memory.js`, `bai-goal-memory.js`, shopping state | Votonobay-owned context, not provider-owned conversation state |
| Observability | `bai-observability.js` | Kernel/provider outcome telemetry and latency |
| Remote agent | `backend/bai-agent-core.ts` | Bounded shopping agent with safe tools and rate limits |
| Local / zero-budget experiments | Qwen/Gemma browser/local routing docs and runtime pieces | Optional local/open-weight reasoning; deterministic rules remain fallback |
| Voice | `bai-voice.js` | Existing voice boundary to preserve behind the same Bay Engine |

The problem is therefore fragmentation: provider/runtime concepts exist at several layers and need one canonical ownership contract before adding more vendors.

## Canonical flow

```text
User / Voice STT
    ↓
Bay Input Layer
    ↓
Context Builder (Votonobay memory + current shopping state)
    ↓
Intent / Task Classification
    ↓
Bay Engine Orchestrator
    ├─ deterministic path when truth/action safety requires it
    └─ Model Router
          ↓
       Provider Adapter
          ↓
       LLM / open-weight model
          ↓
       Proposed intent / actions / explanation
    ↓
Provider Contract Normalization
    ↓
Shopping Kernel + Truth Layer + Action Validation
    ↓
Verified Result / PurchasePlan / safe state mutation
    ↓
Bay Response Composer (persona; immutable facts stay immutable)
    ↓
Text / Voice TTS
```

**Rule:** the model proposes; Votonobay decides.

## Ownership boundaries

### Votonobay owns

- `ShoppingIntent`, constraints and current session state;
- `UniversalBasket`, `StoreBasket`, `PurchasePlan`;
- product identity and matching rules;
- exact-store/channel scope;
- price, availability, discount, saving, totals, coverage, freshness, provenance and confidence;
- retailer capability and handoff authority;
- memory/context selection;
- action validation and execution;
- Bay persona and response-policy rules;
- provider routing policy, budget policy and fallback;
- telemetry and release gates.

### Model may do

- interpret natural-language shopping requests;
- classify intent within the allowed domain;
- propose bounded tool/action calls;
- identify when a clarification is necessary;
- explain an already verified result;
- produce wording compatible with Bay persona constraints.

### Model may never author as truth

- prices or unit prices;
- stock/availability;
- retailer/store/exact-store identity as verified scope;
- discounts/promo eligibility;
- basket totals or line totals;
- savings;
- basket coverage;
- freshness/timestamps;
- provenance/confidence upgrades;
- retailer integration capability;
- proof that an external action occurred.

Any provider payload containing authoritative truth-critical fields must be rejected or stripped before execution. `unknown` must never be promoted to verified truth.

## Provider interface v1

The first Bay Engine provider abstraction is deliberately capability-based. Providers are not forced to pretend they support identical features.

```ts
interface BayProvider {
  id: string;

  capabilities(): {
    streaming: boolean;
    tools: boolean;
    structuredOutput: boolean;
    local: boolean;
    paid: boolean;
  };

  generate(request: BayModelRequest, options?: GenerateOptions): Promise<BayProviderResult>;
  stream?(request: BayModelRequest, options?: GenerateOptions): AsyncIterable<BayStreamEvent>;
  healthCheck(): Promise<BayProviderHealth>;
  estimateCost?(usage: BayUsageEstimate): BayCostEstimate;
}
```

`toolCall()` is not a separate source of authority. Tool proposals are part of the provider result and always pass through the same provider contract and deterministic shopping/action validation.

`BayModelRequest` must contain only bounded Votonobay-selected context. Providers must not rely on hidden provider-side conversation memory for product correctness.

## Router v1 — intentionally small

Do **not** build a generic multi-model platform in the first iteration.

Initial routing contract:

1. Use deterministic code directly for truth-critical calculations and mutations that do not require a model.
2. Use one configured primary provider for bounded language/reasoning tasks.
3. On timeout/health/circuit failure, attempt one configured fallback provider when available.
4. If no safe provider succeeds, return the deterministic/rules fallback or a graceful clarification/error response.
5. Paid providers are not eligible unless the explicit paid-AI gate and budget ceiling both allow them.

First implementation milestone = **two provider adapters + deterministic fallback**.

More granular cheap/strong routing is a later optimization and must be justified by measured cost/quality data.

## Persona contract

Persona does not belong to a provider.

Canonical Bay persona remains defined by Votonobay-owned rules/prompts/examples, including tone, vocabulary, humour limits, seriousness mode, uncertainty behaviour and response length.

Persona composition must never alter validated facts. In particular, a post-validation wording step may not recalculate or invent prices, totals, savings, store scope, availability or provenance. Verified values are immutable inputs to the response composer.

## Memory contract

Memory is Votonobay-owned. Provider session/thread history is never canonical memory.

For each request the Context Builder selects only the context needed for that turn, subject to:

- explicit size/token limits;
- privacy/local-only closed-beta restrictions;
- relevance trimming;
- no provider-side state assumption;
- reproducible request construction where practical.

This permits provider switching without losing Bay identity or product state.

## Zero-budget / cost policy

Closed-beta target: **0 ₽ AI spend by default**.

Order of preference:

1. deterministic rules/kernel when sufficient;
2. free/local/browser/open-weight provider where it meets acceptance;
3. free-tier remote provider where policy permits;
4. explicitly enabled low-cost remote provider under a hard ceiling;
5. strong paid model only for a justified bounded route, never silently.

Required controls before paid routing becomes eligible:

- per-request token/output limits;
- context trimming;
- cache where semantically safe;
- per-user rate limits;
- global/monthly budget ceiling;
- provider/model usage telemetry;
- latency and estimated/actual cost telemetry where available;
- fail-closed paid-provider switch.

Credentials alone must never imply permission to spend money.

## Reliability contract

Provider adapters must support a common reliability envelope even if model capabilities differ:

- bounded timeout;
- at most one controlled retry for retryable failure classes;
- fallback provider when configured;
- circuit breaker;
- deterministic/graceful fallback;
- no duplicate state mutation after retry/fallback;
- idempotency/correlation identifiers where remote execution can have side effects;
- provider failure must not weaken truth/action validation.

## Voice boundary

Voice is transport, not a separate brain:

```text
STT → text → Bay Engine → text → TTS
```

Closed beta may use system/free STT/TTS. A branded paid voice is explicitly later work. Text and voice must reach the same orchestration/truth/action boundaries.

## Minimal rollout plan

### PR 0 — architecture contract

- map current AI contour;
- adopt this canonical ownership boundary;
- add ADR;
- no live provider/runtime behaviour change.

### PR 1 — provider adapter contract

- expose a stable provider interface over the existing contract;
- capability declaration;
- provider result normalization;
- contract tests proving truth-critical fields/actions cannot bypass validation.

### PR 2 — router/fallback shell

- primary + fallback + deterministic baseline;
- timeout/circuit behaviour;
- no model-specific business logic in router;
- paid routes fail closed by default.

### PR 3 — first two adapters

Prefer zero-cost candidates for the proof. Reuse an existing local/open-weight path where viable and add one independent second adapter. Exact providers are selected only after a current benchmark/cost/privacy comparison.

### PR 4 — observability + cost guard

- provider/model/latency/token/cost dimensions;
- user/global limits;
- budget ceiling;
- no raw private prompt logging by default.

### PR 5 — provider-switch acceptance

Run the same frozen shopping scenarios through both adapters and deterministic fallback. Verify persona stability, action equivalence where expected, truth rejection and graceful failure.

Voice implementation and sophisticated task-to-model routing remain later tracks unless a release blocker proves otherwise.

## Acceptance criteria

Bay Engine v1 is accepted when all are true:

1. Two independent provider adapters can be selected without modifying shopping kernel/product logic.
2. The same canonical Bay persona policy applies across both.
3. Provider output cannot create or promote truth-critical prices/store/savings/availability/coverage/provenance.
4. Provider-proposed mutations pass existing deterministic validation/execution contracts.
5. Primary timeout/outage leads to fallback or a graceful deterministic response.
6. No retry/fallback can duplicate a basket mutation.
7. Provider/model, latency and usage are observable; token/cost telemetry exists where the provider exposes enough data.
8. Paid routing remains off by default and obeys a hard budget ceiling when enabled.
9. Existing golden shopping, truth, security and browser release suites remain green.
10. No large rewrite is required to adopt the engine.

## Non-goals

Not part of Bay Engine v1:

- training a foundation model;
- building GPU infrastructure;
- moving the product to Rust;
- fine-tuning without measured need;
- a generic AI platform or marketplace of models;
- allowing an LLM to own truth, shopping state or retailer actions;
- changing the binding trained-model promotion/re-evaluation rules.

## Provider selection work still required

Provider names are intentionally **not** selected by this architecture document. DeepSeek, Gemini, OpenAI, Mistral, Qwen/open-weight and other candidates must be compared using current official pricing/free-tier/tool/streaming/context/privacy information and then benchmarked on the same held-out Votonobay shopping scenarios.

Selection criteria, in order:

1. safety/contract compliance;
2. shopping-task quality and Russian quality;
3. deterministic structured/tool behaviour;
4. zero/low cost;
5. latency and availability;
6. privacy/data-policy fit;
7. vendor lock-in risk.

A famous model name is not acceptance evidence.