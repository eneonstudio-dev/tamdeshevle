# Sara 2 — design handoff

Fresh-read baseline for the current pass: `main` at `6642f2928019d711eead19d46dabed6551d3d356` on 2026-09-14.

Current design direction remains Bay-first and conclusion-first. The Roxy/Sara design series is established: Home, conversation panel, approved Bay visual/states, recommendation hierarchy, catalog hints, runtime states, motion polish, cold-start guard, verdict-to-purchase skeleton, truthful retailer handoff, verdict confidence, progressive long-basket disclosure, mobile composer hardening, and network recovery.

Purchase truth remains strict: Votonobay redirects rather than claiming automatic retailer-cart transfer, the retailer remains the authority for final price/availability, and user-marked completion is not proof of payment, order creation or delivery.

The mobile composer grows with longer requests up to a controlled cap, then scrolls internally; bottom actions keep minimum touch targets; the visual viewport is mirrored into the Bay shell for virtual-keyboard geometry; and viewport changes preserve a reader who intentionally scrolled up instead of always yanking the conversation to the newest result. When the user was already near the bottom, the latest Bay content remains anchored above the keyboard.

Network recovery keeps existing offline/error runtime cards as the authority while disconnected or failed. After a real offline→online transition, Bay acknowledges that the network is back, says the basket is still present, preserves the user's draft, and never repeats a shopping request automatically.

The current return-continuity pass handles a different lifecycle boundary: leaving Votonobay for an official retailer and then coming back, plus browser back/forward cache restores. Retailer return UI is armed only by a real outbound retailer link. On return it says that the local list is still present, asks the user to mark only what was actually added on the retailer side, and explicitly says price/availability were not refreshed automatically. A bfcache return inside an open Bay conversation can acknowledge a preserved basket or draft, but it never submits, re-optimizes, refreshes prices, or mutates shopping state. Ordinary first load stays quiet, and network-recovery UI takes precedence over generic return UI.

Next design work should continue from real supported product contracts and remaining mobile/adjacent states. Do not invent delivery/self-pickup/API-cart capabilities in UI ahead of verified retailer support. Preserve truth UX and conclusion-first hierarchy when adding any fulfillment surface.
