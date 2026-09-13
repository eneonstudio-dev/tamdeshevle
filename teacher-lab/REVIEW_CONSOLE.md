# Bai Teacher Review Console

После teacher-run и `prepare_review.mjs` в review-директории должны быть:

- `left-candidates.jsonl`
- `right-candidates.jsonl`
- `review-queue.json`

Собрать локальную страницу ревью:

```bash
node teacher-lab/review-console.mjs /path/to/review /path/to/bai-review.html
```

Открой `bai-review.html` в браузере. Для каждого кейса видны исходный запрос, session context, flags/conflicts и два structured teacher-output.

Выборы: `approve_left`, `approve_right`, `approve_edited`, `reject`. Экспорт требует reviewer name и создаёт `decisions.json`. Даже полное agreement не подтверждается автоматически.

Сырые reasoning-поля не встраиваются в HTML. Экспортированные решения затем обрабатываются `review-decision.mjs` / Gold pipeline и повторно проходят provenance firewall.
