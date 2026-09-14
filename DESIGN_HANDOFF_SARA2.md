# Sara 2 — design handoff

Fresh-read baseline: `main` at `e48666abe4588ea0ccf71959bbd1d1b171fed1bb` on 2026-09-14.

Current design direction remains Bay-first and conclusion-first. The prior Roxy series through PR #361 is treated as established: Home, conversation panel, approved Bay visual/states, recommendation hierarchy, catalog hints, runtime states, motion polish, cold-start guard, and the verdict-to-purchase skeleton.

This pass continues the next purchase-stage UX without changing retailer capability or shopping truth semantics. The store handoff now explicitly says that Votonobay redirects rather than auto-transfers carts, keeps the retailer as the authority for final price/availability, decorates each store step consistently, and shows a Bay success state only after the user marks all items complete. The success copy explicitly says this is not proof of payment.

Next design work should continue from the actual post-plan handoff and fulfillment surfaces only when the underlying product contracts exist. Do not invent delivery/self-pickup/API-cart capabilities in UI ahead of verified retailer support.
