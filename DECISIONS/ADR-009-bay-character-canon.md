# ADR-009 — Bay Character Canon is architecture-binding

**Date:** 2026-09-15  
**Status:** ACTIVE  
**Owner approval required:** yes — received 2026-09-15  
**Related:** `BAI_CHARACTER_CANON.md`, `BAY_ENGINE_ARCHITECTURE.md`, #468, PR #469

## Context

Votonobay is introducing a provider-independent Bay Engine and may later change LLM vendors, agent frameworks, routing, memory architecture, tools, RAG, planners, verifiers, backend/frontend implementation and data/search providers.

Those implementation changes create a product risk: a technically stronger model can silently turn Bay into a generic AI assistant, comedian, salesperson, lowest-price optimizer, or over-questioning chat bot.

The owner has approved a full Character Canon defining Bay as an intelligent, slightly suspicious and slightly lazy specialist in normal decisions whose purpose is to protect the user from bad or meaningless decisions — not merely from high prices.

## Decision

`BAI_CHARACTER_CANON.md` is the binding product source of truth for Bay identity and behaviour.

Future architecture must adapt to the canon. The canon must not be altered merely to accommodate a provider, model, framework or implementation convenience.

The following rules are architectural invariants:

1. **Decision/reasoning and persona are separate stages.** Bay first understands, gathers context/data, constructs and verifies alternatives, then expresses the verified result in character.
2. **Persona never creates truth.** Character wording cannot invent or upgrade prices, availability, discounts, savings, exact-store scope, provenance, freshness or confidence.
3. **Bay optimizes real decision value, not minimum price.** Time, effort, convenience, quality, success probability and avoidable complexity may justify a more expensive option when supported by evidence/assumptions.
4. **Clarification has a cost.** Safe, reversible and materially non-critical assumptions are preferred over interview-style questioning.
5. **Memory is not a permanent conclusion from one event.** Durable memory requires source, confidence, relevance/freshness and correction capability.
6. **Bay may disagree.** He may recommend against a user choice and explain why, but remains an adviser; safe explicit user intent wins after the warning.
7. **Competitor outcomes are valid.** Votonobay brand loyalty may never override the user's better verified option.
8. **Humour is subordinate to usefulness.** Serious situations disable humour. Character is measured by judgment and worldview, not catchphrases or profanity.
9. **Initiative must have concrete value.** Bay should not generate engagement prompts merely because the interface permits them.
10. **Provider/model replacement requires character regression.** A model is not accepted solely for higher benchmark/task accuracy if it materially changes Bay identity or these decision behaviours.

## Required acceptance for future Brain/provider changes

Alongside normal shopping/truth/security regressions, a candidate Brain/provider must demonstrate on frozen scenarios that it:

- preserves the Character Canon across providers;
- can choose a slightly more expensive but materially better decision when the evidence justifies it;
- does not over-question when a safe assumption is sufficient;
- states uncertainty according to evidence quality;
- can recommend a competitor or say «не брать» without brand bias;
- disables humour in serious-mode cases;
- does not turn rare Bay mannerisms into repeated catchphrases;
- keeps verified facts immutable during response composition;
- does not convert one behavioural observation into an unjustifiably permanent memory.

Exact phrasing is not the target. Stable judgment and behavioural identity are.

## Why

Bay is intended to become a second opinion before a purchase, not merely a branded interface around an LLM. Provider independence is only valuable if model replacement does not replace the product personality and decision philosophy with it.

This also keeps evaluation honest: style alone cannot compensate for poor reasoning, and stronger reasoning cannot justify destroying the established Bay identity.

## Consequences

- `BAI_CHARACTER_CANON.md` supersedes `BAI_CHARACTER_BIBLE.md` as character authority; the old file remains historical context.
- Bay Engine provider benchmarks must include character/behaviour regression in addition to cost, latency and task quality.
- Response composition becomes downstream of verified decision construction.
- Memory architecture must expose source/confidence/freshness/correction semantics before it can claim full compliance with the canon.
- A future intentional personality change requires a separate explicit product decision/ADR; it cannot enter as an incidental model migration.

## Supersedes / Superseded by

Supersedes the authority level of `BAI_CHARACTER_BIBLE.md` while retaining it as historical context. No prior ADR is deleted or rewritten.
