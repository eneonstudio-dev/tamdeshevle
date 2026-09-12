# Alice live price status — 2026-09-12

The Alice webhook now checks retailer price overlays before the educational simulator.

Current verified observations used by the test basket:
- milk: Lenta, 99.99 RUB, official public catalog overlay;
- eggs C1: Magnit, 75.89 RUB, official store-scoped catalog overlay;
- bread: no eligible fresh live quote in the current overlays;
- chicken fillet: no eligible fresh live quote in the current overlays.

The webhook therefore reports 2/4 live coverage and refuses to calculate a fake full live basket total.
