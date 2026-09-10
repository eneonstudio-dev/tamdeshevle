# Receipt price observations

This layer stores receipt evidence separately from production retailer prices.

## Lifecycle

1. OCR, manual entry or barcode-assisted capture produces raw receipt fields.
2. `TDReceiptObservations.create()` normalizes them into `td.receipt_observation` v1.
3. `validate()` checks the structural contract.
4. `toPriceCandidates()` emits non-rankable price candidates only.
5. `TDReceiptVerification.verifyObservation()` checks freshness, exact-store scope and attached proof.
6. `TDReceiptVerification.promote()` marks valid observations as eligible for price history and separately decides whether each item has strong enough identity (`barcode`/`sku`) to be eligible for a future ranking adapter.
7. A future explicit adapter may write accepted receipt observations into the runtime price model. Until that adapter exists, all receipt candidates remain `rankable:false` and cannot bypass `TDCompare`.

## Trust rules

A receipt is evidence, not an automatic production price.

To pass the observation gate it must:

- have a valid v1 receipt contract;
- identify an exact store using a selected verified point (`store_id`, external point id, address, match method and confidence ≥ 0.75); a typed address alone is never sufficient;
- include receipt proof (`image_ref`, fiscal sign or raw-text reference);
- be within the freshness window (24 hours by default).

To be eligible for a future ranking adapter, an individual line must additionally have a strong product match (`barcode` or `sku`). Name-only matching is useful evidence but is deliberately insufficient for ranking.

This is intentionally independent of retailer collectors, overlays, `scope_verified`, and the current `TDCompare` retailer-only ranking invariant.
