# Votonobay — Known Limitations

This file prevents agents and UI copy from inventing capabilities that the current MVP has not proved. Update it when a limitation is removed or a new one is discovered.

## Data / coverage

- Votonobay does not yet have universal fresh exact-store price/stock coverage across Russian grocery retail.
- Product identity enrichment is not proof of current price, availability or exact store.
- Search engines and external AI/provider output are discovery/check signals, not rankable price truth by themselves.
- Receipt QR fiscal metadata alone is not a full line-item receipt.
- Public retailer catalog availability does not automatically mean exact physical-store scope.
- Promotions, loyalty prices and coupons cannot be counted as guaranteed unless eligibility and terms are verified for the user/plan.

## Basket / optimizer

- UniversalBasket → StoreBasket mapping and deterministic Multi-Store PurchasePlan optimization remain critical MVP work until verified end to end.
- Multi-store should default to at most 2 stores; broader combinatorial splitting is not an MVP promise.
- Unknown/nonlinear delivery/service fees can make a plan incomplete; Bay must disclose uncertainty rather than invent totals.

## Retailer execution

- Votonobay does not currently promise universal automatic retailer cart filling or ordering.
- Capability is retailer-specific and governed by `RETAILER_CAPABILITIES.md`.
- Redirect/comparison must not be presented as official partnership or API integration.

## Bay intelligence

- Training/evaluation infrastructure exists, but a successfully promoted trained checkpoint must be proven through the promotion gate before being described as the production brain.
- Bay is intentionally shopping-only and current MVP verticals are grocery/FMCG + online grocery/delivery.
- Neural reasoning never overrides deterministic truth/action/constraint checks.

## Providers / cost

- External providers may change terms, quotas, availability and pricing.
- Zero-budget mode means exhaustion/failure should degrade/fallback rather than silently spend money.
- Ordinary consumer AI interfaces are not assumed to be commercial backend APIs.

## Brand / launch

- `Votonobay` / `VOTONOBAI` is the working master brand, not yet final legal clearance.
- Trademark, existing-brand, domain and social-handle checks are required before public brand lock.
- Current GitHub Pages URL still contains legacy `tamdeshevle` and is not the intended final public URL.

## Rule

A limitation may be removed only after the underlying implementation/evidence is verified in current `main`. Never remove a limitation merely because a feature is planned or a PR exists.
