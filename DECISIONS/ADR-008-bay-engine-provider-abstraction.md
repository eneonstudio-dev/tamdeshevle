# ADR-008 — Bay Engine provider abstraction

**Date:** 2026-09-15
**Status:** ACTIVE
**Owner approval required:** yes — approved 2026-09-15
**Related:** #468, `BAY_ENGINE_ARCHITECTURE.md`

## Context

Votonobay already contains bounded neural/provider components, deterministic shopping execution, trained-serving gates, persona, memory, observability and local/open-weight experiments. However, those responsibilities are spread across several runtime layers. Adding more vendors directly to those individual paths would increase vendor lock-in, duplicate safety logic and risk turning a model into an accidental source of shopping truth.

The product also requires a closed-beta path that can operate at zero or near-zero AI spend while preserving deterministic truth and graceful failure.

## Decision

Votonobay adopts a canonical **Bay Engine** orchestration boundary.

Bay is not identified with any LLM. Model providers are replaceable engines behind Votonobay-owned contracts.

The canonical control rule is:

> **The model proposes; Votonobay decides.**

Votonobay owns context selection, memory, shopping state, `UniversalBasket` / `StoreBasket` / `PurchasePlan`, product/truth evidence, validation, action execution, persona, provider routing, fallback, telemetry and budget policy.

LLMs may interpret language, propose bounded actions/tools, request clarification and explain already-verified results. They may not author or promote prices, availability, exact-store scope, discounts, savings, basket totals, coverage, freshness, provenance, retailer capabilities or proof of external actions.

Provider integration must use a capability-based adapter contract. The first implementation milestone is deliberately limited to **two provider adapters plus deterministic fallback**. A sophisticated multi-model router is not required until measured usage justifies it.

Provider-side conversation state is not canonical memory. Bay context is assembled by Votonobay on each request.

Persona is provider-independent. Any response-composition step receives verified facts as immutable inputs and may not change them.

Paid AI is fail-closed by default. Credentials alone are not permission to spend. Any paid route requires explicit enablement plus a hard budget ceiling. Closed beta targets 0 ₽ where practical.

Voice uses the same engine boundary: `STT -> Bay Engine -> TTS`.

The existing trained-model promotion/re-evaluation rules and deterministic safety fallback remain binding and are not superseded by this ADR.

## Why

This separates product identity from model vendor choice, permits zero-cost/local experimentation, reduces vendor lock-in and keeps truth/action safety in one deterministic system. It also allows future use of a self-hosted or Votonobay-trained model without rewriting the product around that model.

A smaller first milestone avoids creating a generic AI platform before there is evidence that such complexity is needed.

## Consequences

Required:

- consolidate existing AI/provider paths behind a canonical Bay Engine contract rather than create a parallel stack;
- benchmark providers against the same held-out Votonobay shopping scenarios;
- preserve deterministic validation and fallback for every provider;
- add provider/model latency, usage and cost observability;
- prevent paid-provider activation by credentials alone;
- keep persona/memory outside provider-owned state;
- prove provider switching does not change shopping business logic.

Forbidden:

- model-authored truth-critical shopping facts;
- provider-specific shopping rules embedded in product logic;
- silent paid API activation;
- large release-blocking rewrite for abstraction purity;
- foundation-model/GPU-platform work without separate evidence and approval.

## Supersedes / Superseded by

Does not supersede existing truth, trained-serving, Gate F or shopping-kernel decisions. It formalizes the provider-independent direction already present in the master roadmap and gives it a canonical implementation boundary.