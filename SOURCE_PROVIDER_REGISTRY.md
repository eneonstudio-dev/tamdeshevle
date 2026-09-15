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
| `truth_authority` | The highest truth layer this source is allowed to establish |
| `rankable` | Whether evidence from this source may directly affect ranked price/store results |
| `commercial_status` | `approved`, `conditional`, `blocked`, `unknown` |
| `auth_mode` | public / user-consent / API key / partner / none |
| `rate_policy` | Known quota/rate rule or `unknown` |
| `retention` | Data-retention/reuse constraints or `unknown` |
| `attribution` | Required attribution or `none/unknown` |
| `freshness` | Expected freshness / TTL policy |
| `zero_budget` | Whether the current path can operate without paid usage; it must never auto-upgrade to paid |
| `fallback` | What happens when source is unavailable |
| `last_terms_review` | YYYY-MM-DD or `pending` |
| `owner` | Responsible workstream |
| `enabled` | yes/no |

## Registry

| id | category | allowed_use | proves | does_not_prove | truth_authority | rankable | commercial_status | auth_mode | rate_policy | retention | attribution | freshness | zero_budget | fallback | last_terms_review | owner | enabled |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `open_food_facts` | identity | barcode/product identity + nutrition enrichment | identity/nutrition fields present in OFF with source uncertainty | current price, stock, exact store | identity-only | no | conditional | public | unknown | review ODbL obligations before broader reuse | ODbL/provenance required | enrichment cache allowed only per approved policy | yes for public/offline approved path | identity cascade fallback | pending | Price 2 | yes |
| `ru_barcode` | identity | none in production until license is confirmed | if later licensed, candidate barcode/name mappings from the upstream dataset | current identity freshness, price, stock, exact store, usage rights | blocked identity candidate only | no | blocked | public repository | n/a while blocked | production ingest/redistribution blocked pending license review | unknown pending license | known market period 2021–2022; stale for current truth | technically zero-cost but blocked | Open Food Facts / receipt / retailer identity evidence | pending | Price 2 / Reinhard | no |
| `user_receipt` | receipt | user-provided receipt/QR/photo ingestion; immutable price-history evidence after verification | purchase-time exact-store price observation and only line-item identity actually parsed/validated from the user artifact | facts absent from artifact; QR alone does not prove line items; another branch of the chain; **current availability/stock after the transaction** | exact-store purchase-price observation only after scope + proof verification; current StoreBasket ranking additionally requires independent current availability evidence | conditional | approved | user-consent | n/a | minimize + product privacy rules | none | receipt price observation is timestamp-bound and current verifier max age applies; freshness never manufactures current stock | yes | keep history-only/non-rankable for live store planning until current availability is independently verified | pending | Price 2 / Vi | yes |
| `retailer_public_catalog` | retailer | abstract contract template for lawful public retailer observations | only fields directly observed with explicit retailer/store/channel scope and timestamp | arbitrary exact-store stock if not scoped; future price | template only; concrete source entry required | conditional | unknown | public | retailer-specific | retailer-specific | retailer-specific | short TTL | conditional | degrade to unverified candidate | pending | Price 2 | no |
| `magnit_store_catalog` | retailer | low-frequency public catalog observation for the configured Magnit `shop_code`/address | rendered product price plus rendered availability signal for that configured catalog context at `checked_at`, after address-scope verification and matcher eligibility | checkout/final charged price, loyalty eligibility, future price, another Magnit branch, shelf stock beyond the rendered catalog signal | conditional exact-store catalog observation | conditional | conditional | public | once-daily workflow; bounded product count + delay; stop/fail on HTTP error | repository snapshot + provenance only; no credentials | source URL retained in observation | fresh ≤36h; stale ≤72h; expired afterwards under `TDDataQuality` | yes for current public collector; no paid fallback | keep previous snapshot only until normal TTL expires, then unverified/non-rankable | pending | Price 2 / Reinhard | yes |
| `perekrestok_regional_catalog` | retailer | indicative Moscow catalog from the public `promo.perekrestok.ru` surface | product/price text and product page/search provenance observed for the regional catalog snapshot | exact physical branch, branch stock, checkout/final charged price, loyalty eligibility, future price | regional discovery/estimate only | no | conditional | public | low-frequency/manual snapshot path; no private API | repository snapshot + provenance only | source URL retained per matched item | estimate only while `checked_at` is within TTL; exact-store rankability always blocked without store scope | yes for current public path; no paid fallback | suppress estimate when snapshot expires; use other sources or show unknown | pending | Price 2 / Reinhard | yes |
| `proshoper_regional_catalogs` | retailer | discovery/indicative regional promotional catalogs currently used for Пятёрочка, Лента and Дикси snapshots | product/price text plus parsed catalog validity period observed on the regional aggregator page | exact branch, exact-store price, stock, retailer-authoritative live availability, checkout/final charged price | regional discovery/estimate only | no | conditional | public | once-daily where automated; one regional page per configured source; stop/fail on HTTP, parser or date validation error | repository snapshot + provenance only | `proshoper.ru` + source URL retained | estimate only when `checked_at` remains within TTL and the source-market date is inside `valid_from..valid_to`; never exact-store truth | yes for current public collector/snapshots; no paid fallback | suppress expired/out-of-period estimates; keep historical evidence only as non-current provenance | pending | Price 2 / Reinhard | yes |
| `mistral_hosted_bay_engine` | llm | bounded language/reasoning proposals through Bay Engine after provider-switch acceptance; server-side transport only | model proposal only | price, availability, exact-store scope, totals, savings, provenance, authorization, retailer capability | none | no | conditional | server-side API key; browser credentials forbidden | provider-specific; bounded retry/circuit rules apply | privacy/retention review required before real-user enablement | none | request-scoped only; no canonical provider memory | no; paid route must remain fail-closed until separately enabled under hard budget authorization | Qwen local when accepted, otherwise deterministic Bay fallback | pending | Роуг / Арбитр / Reinhard | no |
| `qwen_local_bay_engine` | llm | bounded local/open-weight language/reasoning proposals through Bay Engine after local runtime + provider-switch acceptance | model proposal only | price, availability, exact-store scope, totals, savings, provenance, authorization, retailer capability | none | no | conditional | local runtime / none | device/runtime-specific | local-only runtime target; no cloud prompt retention by adapter | none | request-scoped only; no canonical provider memory | yes when a verified local runtime is present | deterministic Bay fallback | pending | Роуг / Арбитр / Reinhard | no |
| `search_engine_or_ai_scout` | search/llm | discovery, candidate URLs/products, independent cross-check | discovery lead only | verified price, exact stock, exact store, product equivalence | discovery-only | no | conditional | provider-specific | provider-specific | provider-specific | provider-specific | short cache | conditional; paid usage must stay disabled in zero-budget mode | disable/fallback to other scouts | pending | Provider Router | yes |
| `trained_bay_brain` | llm | intent/planning/repair/explanation inside bounded shopping actions | model proposal only | price truth, arithmetic truth, authorization, rankability | no external truth authority | no | approved | guarded runtime | local/runtime policy | no raw secret leakage | none | release-pinned | conditional on approved zero-cost runtime; never auto-spend | safe deterministic baseline | pending | Умняша / Vi | yes |

## Ranking rule

A source may influence a ranked purchase recommendation only if the downstream observation satisfies the current truth contract. Discovery-only sources must never be silently upgraded into price/store truth.

An abstract source class such as `retailer_public_catalog` is not sufficient by itself. Every concrete production source must have its own registry row, explicit scope semantics, truth authority, zero-budget behavior, and fallback.

## Provider Guard rules

- Stop on 401/403/429 instead of retry storms.
- Use cache/deduplication and bounded retries.
- Every provider can be disabled independently.
- Zero-budget mode must not auto-upgrade into paid usage.
- Track provenance through the final observation/decision path.
- If terms, technical behavior, or evidence quality becomes unclear, set `enabled=no` or downgrade to non-rankable until reviewed.

## Change protocol

When adding a source/provider, update this registry in the same PR whenever possible. A new provider without an explicit `allowed_use`, `proves`, `does_not_prove`, `truth_authority`, `rankable`, zero-budget policy, and fallback policy is not production-ready.
