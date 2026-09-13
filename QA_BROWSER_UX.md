# Browser UX QA

`Validate UX in real browser` runs the static Votonobay app in headless Chrome at desktop (1440×1000) and Android-sized (412×915) viewports.

It walks `home → stores → catalog → cart → compare`, checks that the expected surface renders, blocks horizontal overflow, verifies the core mobile controls remain thumb-sized, and uploads screenshots plus `report.json` as a short-lived Actions artifact.

Dedicated Roxy browser contracts additionally verify the conclusion-first decision hierarchy, the non-floating self-service catalog hint, and Bay's `empty / loading / error / offline` runtime states. Runtime-state QA checks the approved Bay reaction asset and label, panel synchronization, mobile touch targets, horizontal geometry, return to normal state, and `prefers-reduced-motion` behavior on both viewports.

The checks are intentionally UX-only. They do not change pricing, ranking, Bay reasoning, cart semantics, provider truth, or retailer handoff logic.