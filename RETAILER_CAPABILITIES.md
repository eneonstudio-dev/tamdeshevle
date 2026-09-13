# Votonobay — Retailer Capability Matrix

Capability ladder: `COMPARE_ONLY → REDIRECT → DEEP_LINK → PARTNER → API_CART → API_ORDER`.

This file is a product/truth contract, not a marketing wishlist. A capability moves right only after implementation and legal/technical basis are verified.

| Retailer/channel | Current safe capability | Cart/order automation | Notes / proof required before upgrade |
|---|---|---|---|
| Пятёрочка | REDIRECT | NO | Comparison may exist; do not promise cart transfer. Verify exact current source/store coverage separately. |
| Магнит | REDIRECT | NO | Public/collector price work does not equal consumer cart API permission. |
| Перекрёсток | REDIRECT | NO | Keep basket in Votonobay; retailer handoff is separate. |
| Лента | REDIRECT | NO | Do not infer API_CART from public catalog availability. |
| Дикси | REDIRECT | NO | Treat exact price/store scope according to evidence layer. |
| Яндекс Лавка | COMPARE_ONLY / REDIRECT when an approved destination exists | NO | No implied official integration. |
| Впрок | REDIRECT when an approved destination exists | NO | Do not promise automatic basket transfer. |
| Самокат | COMPARE_ONLY | NO | No verified public consumer basket API in current project evidence. Upgrade only after fresh legal/technical verification. |
| Ozon Fresh | COMPARE_ONLY | NO | Same rule: discovery/comparison is not cart API permission. |
| Купер | COMPARE_ONLY | NO | Partner/deep integration requires explicit verified basis. |

## Rules

- UniversalBasket always belongs to Votonobay; retailer capability only changes execution/handoff.
- `COMPARE_ONLY`: Bay may compare using lawful/verified evidence but does not promise an actionable retailer transfer.
- `REDIRECT`: user can be sent to an appropriate retailer destination; basket transfer is not implied.
- `DEEP_LINK`: only when the destination can be constructed through a permitted documented mechanism.
- `PARTNER`: only after an actual partner/affiliate relationship and its restrictions are recorded.
- `API_CART` / `API_ORDER`: only through a permitted supported integration with authentication, consent and failure handling.
- If evidence is uncertain, move left, never right.

Price/source truth remains governed by `SOURCE_PROVIDER_REGISTRY.md`; this matrix only describes handoff/integration capability.
