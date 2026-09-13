# Browser UX QA

`Validate UX in real browser` runs the static Votonobay app in headless Chrome at desktop (1440×1000) and Android-sized (412×915) viewports.

It walks `home → stores → catalog → cart → compare`, checks that the expected surface renders, blocks horizontal overflow, verifies the core mobile controls remain thumb-sized, and uploads screenshots plus `report.json` as a short-lived Actions artifact.

The check is intentionally UX-only. It does not change pricing, ranking, Bai, cart semantics, or retailer handoff logic.
