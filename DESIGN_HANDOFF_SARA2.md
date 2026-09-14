# Sara 2 — design handoff

Fresh-read baseline for the current pass: `main` at `7a7c3a3dfa771fae955c208ccaa63312b4100acf` on 2026-09-14.

Current design direction remains Bay-first and conclusion-first. The Roxy/Sara design series is established: Home, conversation panel, approved Bay visual/states, recommendation hierarchy, catalog hints, runtime states, motion polish, cold-start guard, verdict-to-purchase skeleton, truthful retailer handoff, verdict confidence, progressive long-basket disclosure, and mobile composer hardening.

Purchase truth remains strict: Votonobay redirects rather than claiming automatic retailer-cart transfer, the retailer remains the authority for final price/availability, and user-marked completion is not proof of payment, order creation or delivery.

The mobile composer grows with longer requests up to a controlled cap, then scrolls internally; bottom actions keep minimum touch targets; the visual viewport is mirrored into the Bay shell for virtual-keyboard geometry; and viewport changes preserve a reader who intentionally scrolled up instead of always yanking the conversation to the newest result. When the user was already near the bottom, the latest Bay content remains anchored above the keyboard.

The current network-recovery pass closes an adjacent reliability gap without changing shopping semantics. Existing offline/error runtime cards remain the authority while disconnected or failed. After a real offline→online transition, Bay now acknowledges that the network is back, explicitly says the basket is still present, and says that no shopping request is repeated automatically. The recovery notice preserves the user's draft, does not submit or mutate the basket, and offers only a safe “Продолжить” action that returns focus to the composer. This keeps reconnect behavior honest and reversible while allowing fresh-price/store work again only on a user command.

Next design work should continue from real supported product contracts and remaining mobile/adjacent states. Do not invent delivery/self-pickup/API-cart capabilities in UI ahead of verified retailer support. Preserve truth UX and conclusion-first hierarchy when adding any fulfillment surface.
