# Sber price intelligence for Bai

Bai can optionally add Sber ecosystem signals to the existing live-price layer without replacing the current retailer sources.

## Architecture

`Alice/Bai -> live-price-source -> current retailer overlays + Kuper partner feed -> optional GigaChat verification -> deterministic basket comparison`

Kuper is treated as a price/data source. GigaChat is treated as a verifier of product-offer matching; it is never allowed to invent a price.

If Sber credentials are absent, the provider returns no quotes and the existing price flow behaves exactly as before.

## Environment variables

### Kuper

- `KUPER_PRICE_FEED_URL` — server-side authorized endpoint/proxy returning current Kuper offers for `{ city, products }`. Required to enable Kuper.
- `KUPER_API_TOKEN` — optional bearer token for that endpoint.

The feed may return arrays under `offers`, `products`, `items`, `results`, or `data`. Offers are normalized to Bai's canonical product IDs. Stale partner quotes older than 6 hours are rejected by the live-price layer.

Do not scrape Kuper consumer pages. Connect this variable only to an authorized partner/API integration.

### GigaChat

Two auth modes are supported:

1. `GIGACHAT_ACCESS_TOKEN` — direct access token; useful for short-lived testing.
2. `GIGACHAT_AUTHORIZATION_KEY` — long-lived project authorization key. Bai exchanges it for a 30-minute access token via OAuth and caches the result.

Optional:

- `GIGACHAT_SCOPE` — defaults to `GIGACHAT_API_PERS`; use the scope appropriate for the account (`GIGACHAT_API_B2B` / `GIGACHAT_API_CORP` when applicable).
- `GIGACHAT_MODEL` — defaults to `GigaChat-2-Pro`.
- `GIGACHAT_API_URL` — defaults to `https://api.giga.chat/v1/chat/completions`.
- `GIGACHAT_OAUTH_URL` — defaults to `https://ngw.devices.sberbank.ru:9443/api/v2/oauth`.

If GigaChat is unavailable or times out, Kuper quotes remain deterministic and are not discarded solely because the verifier is offline. If GigaChat returns a valid verdict, rejected matches are removed and accepted ones receive a small confidence boost.

## Trust gates

- Kuper quotes use `sourceKind = partner` and `sourceProvider = kuper`.
- Partner quote confidence must be at least `0.80`.
- Partner quote age must be no more than 6 hours.
- Product matching is deterministic before any LLM call: pack size, category exclusions, city and availability are checked first.
- Existing official/aggregator source rules remain unchanged.
- Live and training prices are never mixed into one claimed live total.

## Current status

Code integration is ready. Production activation still requires authorized Kuper access and/or GigaChat credentials to be stored as Edge Function secrets. No credentials are committed to Git.
