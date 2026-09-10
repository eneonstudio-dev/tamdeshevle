# Basket equivalence and source status

Comparison prices represent one complete basket package. A semantically compatible retailer item is not automatically an equivalent purchase.

The overlay builder requires the same amount and unit as the basket definition, confirmed stock, and a positive finite price. Different packs are retained in `alternatives`, with source and requested quantities, rather than entering `prices`. Special pasta varieties do not match ordinary pasta. Recognized retailer IDs still pass composition and pack checks. Multipacks without an explicit quantity contract are excluded.

This deliberately does not prorate a 900 ml bottle into a purchasable litre or treat the displayed per-kg price of a 700 g bag as the checkout price. Supporting alternate pack sizes requires a quantity-dependent purchase plan, rounding up whole packages and displaying the excess quantity. That flow is not implemented by this patch.

Runtime retailer trust additionally requires explicit verified scope, comparison eligibility, confirmed stock and fresh/stale status. Missing fees are unknown, including null and empty strings. Empty baskets, unknown product IDs and fractional/infinite package counts cannot produce a verified complete basket. Money is accumulated in kopecks. Delivery savings use the origin store's delivery channel.

Magnit URL discovery now distributes its bounded request budget across configured categories and normalizes multiword keywords consistently. This changes selection, not store verification.

## Observed source status on 2026-09-10

- Local live Magnit collector request returned HTTP 403 on the first catalogue page. No new observation timestamp was written.
- Rebuilding the existing Magnit snapshot leaves one exact basket SKU (C1 eggs). The former milk match is 900 ml vs 1 litre; the former pasta match is buckwheat pasta vs ordinary pasta. These cannot establish a complete basket.
- Existing Perekrestok, Pyaterochka, Lenta and Dixy snapshots are regional and remain unverified for a specific store.
- A live, verified two-store comparison of 10–15 products remains blocked on obtaining equivalent store-scoped offers. Passing tests does not resolve that source requirement.
