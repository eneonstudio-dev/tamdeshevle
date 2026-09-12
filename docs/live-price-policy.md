# Live price policy

Votonobay must never present a mixed simulated/live basket total as a real current price.

## Source order

1. Official retailer store-scoped catalog / page / API.
2. Public aggregator only as a secondary observation with visible provenance.
3. Educational `prices.json` only as an explicitly labelled simulator fallback when no live observation is available.

## Freshness

- official source: eligible up to 72 hours;
- public aggregator: eligible up to 24 hours;
- unknown source: eligible up to 12 hours;
- future-dated observations more than 10 minutes ahead are rejected.

## Confidence

Only matched records with `comparison_eligible !== false`, availability not `out_of_stock`, and confidence >= 0.75 are eligible.

## Basket totals

A live split total is produced only when every requested product has at least one eligible live quote.
A live one-store total is produced only when the same retailer has an eligible quote for every requested product.
If coverage is partial, Bai names the confirmed positions and the missing positions and does not produce a full live total.
