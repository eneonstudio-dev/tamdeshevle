# Sara 2 — design handoff

Fresh-read baseline for this pass: `main` at `68a361fa8c67312463d59ddac2cf16d6a69e7437` on 2026-09-14.

Current design direction remains Bay-first and conclusion-first. The Roxy/Sara design series is established: Home, conversation panel, approved Bay visual/states, recommendation hierarchy, catalog hints, runtime states, motion polish, cold-start guard, verdict-to-purchase skeleton, truthful retailer handoff, verdict confidence, progressive long-basket disclosure, mobile composer hardening, network recovery, and return continuity.

Purchase truth remains strict: Votonobay redirects rather than claiming automatic retailer-cart transfer, the retailer remains the authority for final price/availability, and user-marked completion is not proof of payment, order creation or delivery.

The mobile composer grows with longer requests up to a controlled cap, then scrolls internally; bottom actions keep minimum touch targets; the visual viewport is mirrored into the Bay shell for virtual-keyboard geometry; and viewport changes preserve a reader who intentionally scrolled up instead of always yanking the conversation to the newest result. When the user was already near the bottom, the latest Bay content remains anchored above the keyboard.

Network recovery keeps existing offline/error runtime cards as the authority while disconnected or failed. After a real offline→online transition, Bay acknowledges that the network is back, says the basket is still present, preserves the user's draft, and never repeats a shopping request automatically.

Return continuity covers leaving Votonobay for an official retailer and then coming back, plus browser back/forward cache restores. It preserves local state, does not auto-submit/re-optimize/refresh, and keeps network recovery as the higher-priority authority.

The current split-decision pass follows the hardened REG-004 optimizer semantics merged in PR #370. When two stores look cheaper on item prices but real extra-stop friction is unknown, the comparison screen no longer goes silent: Bay explicitly says it will not call the nominal difference a real saving. When known second-stop cost consumes the item-price difference, Bay explicitly says one store wins overall. This is a presentation layer only: it reads `TDBasketSplit` output and does not alter ranking, arithmetic, basket state, retailer scope or truth semantics. The existing positive split card and truthful two-store handoff remain untouched.

Next design work should continue from real supported product contracts and remaining mobile/adjacent states. Do not invent delivery/self-pickup/API-cart capabilities in UI ahead of verified retailer support. Preserve truth UX and conclusion-first hierarchy when adding any fulfillment surface.
