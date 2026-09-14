# Sara 2 — design handoff

Fresh-read baseline for the current pass: `main` at `cc6a79798cd911f6c537e2b502aaceb963824099` on 2026-09-14.

Current design direction remains Bay-first and conclusion-first. The Roxy/Sara design series is established: Home, conversation panel, approved Bay visual/states, recommendation hierarchy, catalog hints, runtime states, motion polish, cold-start guard, verdict-to-purchase skeleton, truthful retailer handoff, verdict confidence, and progressive long-basket disclosure.

Purchase truth remains strict: Votonobay redirects rather than claiming automatic retailer-cart transfer, the retailer remains the authority for final price/availability, and user-marked completion is not proof of payment, order creation or delivery.

The current mobile-compose pass hardens the Bay conversation on phones without changing shopping semantics. The composer now grows with longer requests up to a controlled cap, then scrolls internally; bottom actions keep minimum touch targets; the visual viewport is mirrored into the Bay shell for virtual-keyboard geometry; and viewport changes preserve a reader who intentionally scrolled up instead of always yanking the conversation to the newest result. When the user was already near the bottom, the latest Bay content remains anchored above the keyboard.

Next design work should continue from real supported product contracts and remaining mobile/adjacent states. Do not invent delivery/self-pickup/API-cart capabilities in UI ahead of verified retailer support. Preserve truth UX and conclusion-first hierarchy when adding any fulfillment surface.
