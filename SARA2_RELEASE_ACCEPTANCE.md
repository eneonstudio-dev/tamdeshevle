# Sara 2 — release acceptance evidence

Date: 2026-09-14  
Fresh-main baseline: `35afd8a984fc7ad3deafdd82c0b4aee8b8ea5e33`

This pass follows Rouk's current delivery direction: stop non-blocking design expansion and contribute acceptance evidence for the real MVP loop. It does not change optimizer arithmetic, ranking, basket semantics, retailer capability, price truth, provider behavior or backend execution.

## Scope accepted from the design / UX side

### Gate D — honest retailer handoff

The currently enabled direct handoff set in `real-store-integration-v1.js` is Пятёрочка, Магнит, Перекрёсток, Лента and Дикси. Each is declared `REDIRECT / NO cart automation` in `RETAILER_CAPABILITIES.md`.

The handoff UI:
- keeps retailer identity explicit in titles and links;
- allows only HTTPS destinations on allowlisted retailer hosts;
- tells the user to add products manually on the retailer side;
- states that Votonobay does not read the retailer basket;
- leaves price, availability and actual cart state to the retailer;
- fails closed on automatic/deep cart transfer claims.

Executable guard: `scripts/test-sara2-release-acceptance.mjs`.
Existing adjacent coverage: `scripts/test-bai-handoff-e2e.mjs`, `scripts/test-roxy-handoff.py`, `scripts/test-basket-split-ui.mjs`.

This is acceptance evidence for the implemented redirect contract. It is not a claim of API_CART/API_ORDER, partnership, universal deep links or live retailer uptime.

### Gate E — reliability / UX evidence already in the required browser gate

The required `Validate UX in real browser` workflow continues to execute:
- `scripts/test-ux-browser.py` — primary browser/mobile smoke;
- `scripts/test-roxy-handoff.py` — purchase handoff surface;
- `scripts/test-roxy-network-recovery.py` — offline → online recovery without auto-submit;
- `scripts/test-roxy-return-continuity.py` — refresh/back/retailer-return continuity;
- `scripts/test-roxy-purchase-proof.py` — explicit actual-paid truth and mobile-safe dialog.

The golden shopping gate also keeps `scripts/test-mobile-bay-first-e2e.mjs` and the end-to-end Bay handoff contract.

## Canonical scenario contribution

Relevant already-guarded acceptance paths for Sara 2 are:
- MVP-006 / MVP-008 — one-vs-two-store trade-off presentation follows existing optimizer output and does not manufacture net savings;
- MVP-009 — uncertain totals remain visually approximate rather than exact;
- MVP-016 — return/back continuity preserves local shopping context without silent mutation;
- MVP-017 — network recovery preserves basket/draft and does not auto-repeat shopping actions;
- MVP-028 — exact-store out-of-stock truth is now guarded upstream by PR #384 / REG-015; design must not visually turn that state back into a normal priced candidate;
- MVP-030 — Bay decision hierarchy and rejected-split explanation remain conclusion-first and tied to actual plan output.

## Boundary for next Sara work

Until Rouk changes priority, Sara 2 should not add cosmetic flows merely because there is room to polish them. The active contribution is acceptance replay, release evidence and fixing only reproduced P0/P1 UX/truth defects on the golden loop. Any arithmetic, ranking, StoreBasket/PurchasePlan semantics or source-truth change stays with the owning workstream.
