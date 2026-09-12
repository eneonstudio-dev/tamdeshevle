# Alice live price implementation

`alice-bai-webhook` now resolves live retailer overlays first and only uses `prices.json` as an explicitly labelled simulator when no eligible live observations exist.

The resolver enforces source provenance, freshness, confidence, stock status, and full-coverage rules before calculating basket totals.
