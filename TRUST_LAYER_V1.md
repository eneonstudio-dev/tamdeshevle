# Trust Layer v1

Trust Layer is a lightweight UI layer for the Bai comparison result.

It does not create prices and does not change ranking. It only explains the quality of price data already present in the project.

## Signals

- **Свежая** — retailer price metadata exists and `TDDataQuality` considers its timestamp fresh.
- **Давно проверялась** — retailer metadata exists but is outside the fresh window while still usable.
- **Оценочная** — only regional/estimated metadata is available, or the optimizer marks the line as estimated.
- **Не подтверждена** — no usable source metadata is available.

When metadata exposes `checkedAt`, `retailerName`, and `sourceUrl`, the comparison screen shows them. Risky lines are surfaced separately so the user can see what is worth checking before buying.

Runtime cost: 0 ₽. No new API calls.