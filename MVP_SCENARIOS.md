# Votonobay — Canonical MVP Scenarios

These scenarios are product acceptance cases. They should progressively become automated regressions. Expected behavior is more important than exact wording.

| ID | User request / sequence | Critical expected behavior |
|---|---|---|
| MVP-001 | «Собери продукты на неделю до 5000 ₽» | Build a realistic grocery intent/basket; budget is a hard constraint unless user accepts compromise. |
| MVP-002 | After MVP-001: «Убери молочку» | Modify current basket; preserve unrelated constraints/context. |
| MVP-003 | «Замени курицу на индейку» | Replace only relevant item(s), preserve quantities/other basket state. |
| MVP-004 | «Сделай подешевле, но мясо оставь хорошее» | Treat savings as soft/global goal and meat quality as explicit preference; explain trade-off. |
| MVP-005 | «Всё из одного магазина» | Enforce max_store_count=1; compare feasible single-store plans. |
| MVP-006 | «Можно из двух, если реально выгоднее» | Consider max 2 stores; use net charged cost/fees and explain extra fulfillment. |
| MVP-007 | Split saves 100 ₽ but adds 250 ₽ delivery | Reject nominally cheaper split as worse total plan. |
| MVP-008 | Split saves materially after all known fees | Recommend split and show net savings vs best feasible single store. |
| MVP-009 | One product has no verified price | Do not treat missing price as 0 or present full total as verified. |
| MVP-010 | Cheapest candidate is wrong size/variant | Matching/equivalence guard prevents false cheap substitution. |
| MVP-011 | «Мне ПП и без сахара» | Interpret shopping constraints; candidates must satisfy hard dietary request when product evidence supports it. |
| MVP-012 | «Побыстрее, цена не главное» | Speed/convenience outranks minor savings; truth rules still apply. |
| MVP-013 | «Только Магнит» | Restrict retailer set; do not silently compare/use another retailer. |
| MVP-014 | «Не Магнит» | Exclude retailer while preserving basket intent. |
| MVP-015 | «Собери то же самое в Перекрёстке» | Re-project UniversalBasket into retailer StoreBasket; do not rebuild user intent from scratch. |
| MVP-016 | User refreshes/returns | Persistent basket/constraints survive according to product persistence contract. |
| MVP-017 | Network/provider failure during search | Fail safely, retain basket, disclose incomplete verification, allow retry/fallback. |
| MVP-018 | Provider returns an attractive unsupported price | Discovery cannot become rankable truth without required evidence. |
| MVP-019 | «Напиши мне сайт на React» | Domain Gate rejects as out of shopping scope; no coding tool/action exposed. |
| MVP-020 | «Какой ноутбук лучше для программирования?» | Shopping intent is conceptually in-domain, but current MVP vertical boundary should explain that this category is not supported yet rather than becoming a general assistant. |
| MVP-021 | «Добавь две пачки макарон» | Quantity is explicit and deterministic; totals use quantity correctly. |
| MVP-022 | «Удали одну пачку макарон» after quantity 2 | Decrement according to explicit semantics; do not delete unrelated items. |
| MVP-023 | «Бюджет теперь 4000» | Change only budget dimension and repair/re-optimize basket as needed. |
| MVP-024 | «Бренды не важны» | Relax brand preference only; keep other constraints. |
| MVP-025 | Exact store price is stale/ambiguous | Downgrade confidence/rankability according to truth policy; do not present as fresh exact-store fact. |
| MVP-026 | Store has minimum order above assigned basket | Plan is infeasible or requires explicit extra spend/items; do not hide as arbitrary penalty. |
| MVP-027 | Promo requires loyalty eligibility not known | Do not count promo as guaranteed final cost. |
| MVP-028 | One item unavailable in otherwise best store | Handle coverage/substitution explicitly; do not silently drop item. |
| MVP-029 | Bay suggests two plans with same charged cost | Deterministic tie-break uses coverage/evidence/convenience rules; output stable. |
| MVP-030 | User asks «Почему этот вариант?» | Explain decision from actual constraints/evidence/trade-offs, not invented reasoning.

## Promotion rule

A production regression should have: stable ID, fixture/setup, expected structured outcome, truth invariants, test reference and last passing commit/run. Important failures found in beta are added to `REGRESSION_BANK.md` and should become executable tests where practical.
