# Receipt observation contract

Receipt data is evidence, not an immediately rankable price source.

Lifecycle:

1. Capture a receipt from OCR, manual entry or future barcode-assisted flow.
2. Normalize it with `TDReceiptObservations.create()`.
3. Preserve exact store identity (`chain_id`, retailer `store_id`, external point id, address, verified match method/confidence), purchase timestamp and proof references. A typed address alone never verifies scope.
4. Match receipt lines to canonical products using barcode first, then SKU/name matching.
5. Emit non-rankable price candidates with `toPriceCandidates()`.
6. A separate verification/promotion pipeline may later decide whether an observation is safe to ingest into retailer-backed price history/ranking.

Invariant: `TDReceiptObservations` never mutates `scope_verified`, retailer overlays, collectors, `TDCompare`, or ranking state. Even exact-store receipt evidence is emitted with `rankable:false` until explicitly promoted by another trust layer.

Minimal schema:

`receipt -> store -> observed_at -> items -> barcode/product match -> price -> proof -> verification`

This keeps future OCR, manual receipt entry, barcode scan and community proof compatible with one evidence model.
