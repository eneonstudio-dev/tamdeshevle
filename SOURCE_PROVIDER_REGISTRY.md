# Votonobay — Source / Provider Registry

**Purpose:** one place to decide what each external source may be used for, what it proves, whether it can affect ranking, and how Bay should fail when it disappears.

A source is not trusted merely because it is reachable. Every source/provider must have an explicit capability and evidence contract.

## Required fields

| Field | Meaning |
|---|---|
| `id` | Stable internal source/provider identifier |
| `category` | `retailer`, `receipt`, `identity`, `search`, `llm`, `map`, `other` |
| `allowed_use` | What Votonobay is allowed to use it for |
| `proves` | What facts this source can actually establish |
| `does_not_prove` | Explicit negative boundary |
| `rankable` | Whether evidence from this source may directly affect ranked price/store results |
| `commercial_status` | `approved`, `conditional`, `blocked`, `unknown` |
| `auth_mode` | public / user-consent / API key / partner / none |
| `rate_policy` | Known quota/rate rule or `unknown` |
| `retention` | Data-retention/reuse constraints or `unknown` |
| `attribution` | Required attribution or `none/unknown` |
| `freshness` | Expected freshness / TTL policy |
| `fallback` | What happens when source is unavailable |
| `last_terms_review` | YYYY-MM-DD or `pending` |
| `owner` | Responsible workstream |
| `enabled` | yes/no |

## Registry

| id | category | allowed_use | proves | does_not_prove | rankable | commercial_status | auth_mode | rate_policy | retention | attribution | freshness | fallback | last_terms_review | owner | enabled |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `open_food_facts` | identity | barcode/product identity + nutrition enrichment | identity/nutrition fields present in OFF with source uncertainty | current price, stock, exact store | no | conditional | public | unknown | review license before broader reuse | license-dependent | enrichment cache allowed only per approved policy | identity cascade fallback | pending | Price 2 | yes |
| `user_receipt` | receipt | user-provided receipt/QR/photo ingestion | only evidence actually parsed and validated from user-provided artifact | facts absent from artifact; QR alone does not prove line items | conditional | approved-by-user-flow | user-consent | n/a | minimize + product privacy rules | none | observation timestamp bound | keep non-rankable when incomplete | pending | Price 2 / Vi | yes |
| `retailer_public_catalog` | retailer | candidate product/price discovery where lawful | only fields directly observed with retailer/store/channel scope and timestamp | arbitrary exact-store stock if not scoped; future price | conditional | unknown-per-retailer | public | retailer-specific | retailer-specific | retailer-specific | short TTL | degrade to unverified candidate | pending | Price 2 | conditional |
| `search_engine_or_ai_scout` | search/llm | discovery, candidate URLs/products, independent cross-check | discovery lead only | verified price, exact stock, exact store, product equivalence | no | provider-specific | provider-specific | provider-specific | provider-specific | provider-specific | short cache | disable/fallback to other scouts | pending | Provider Router | conditional |
| `trained_bay_brain` | llm | intent/planning/repair/explanation inside bounded shopping actions | model proposal only | price truth, arithmetic truth, authorization, rankability | no | internal | guarded runtime | local/runtime policy | no raw secret leakage | none | release-pinned | safe deterministic baseline | pending | Умняша / Vi | conditional |

## Ranking rule

A source may influence a ranked purchase recommendation only if the downstream observation satisfies the current truth contract. Discovery-only sources must never be silently upgraded into price/store truth.

## Provider Guard rules

- Stop on 401/403/429 instead of retry storms.
- Use cache/deduplication and bounded retries.
- Every provider can be disabled independently.
- Zero-budget mode must not auto-upgrade into paid usage.
- Track provenance through the final observation/decision path.
- If terms, technical behavior, or evidence quality becomes unclear, set `enabled=no` or downgrade to non-rankable until reviewed.

## Change protocol

When adding a source/provider, update this registry in the same PR whenever possible. A new provider without an explicit `allowed_use`, `proves`, `does_not_prove`, `rankable`, and fallback policy is not production-ready.
