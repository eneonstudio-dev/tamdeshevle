# Bai Food Knowledge — source map

Bai does **not** call external food APIs at shopping time. The runtime knowledge base is local and deterministic so the MVP remains fast and 0 ₽.

## Sources used as models / future enrichment inputs

- **FoodOn** — generic food-product hierarchy and facets. Useful for category/role normalization and future ontology expansion. FoodOn exposes thousands of generic food-product categories and facet-style descriptions.
- **Open Food Facts** — product/category/ingredient/allergen taxonomy model. We do not treat crowd-sourced fields as unquestionable truth; future imports should keep provenance and confidence.
- **USDA FoodData Central** — intended source for numeric nutrient enrichment. FDC data is CC0. Numeric nutrient values are deliberately *not* invented in the current MVP.
- **TheMealDB** — recipe/ingredient relationship model and development-time recipe discovery. Runtime does not depend on TheMealDB; public production usage should respect its production/supporter terms.

## Current local schema

`product -> category -> roles -> meal slots -> pairings -> preparation effort -> substitutions`

The first version only covers product IDs that already exist in the Tam Deshevle MVP catalog. This avoids pretending Bai knows products that the optimizer cannot actually buy.

## Design rules

1. Prices always come from Tam Deshevle store adapters/optimizer, never from food knowledge.
2. Numeric nutrition is added only when sourced; no guessed calories/macros.
3. External data should be normalized into our own compact schema and cached locally, not fetched on every user request.
4. The planner may use food knowledge to rank/explain strategies, but explicit user requirements remain hard constraints.
5. Every future imported record should keep `source`, `sourceId` (when available), `license`, and `updatedAt` metadata.
