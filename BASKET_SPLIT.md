# Two-store basket experiment

The split-basket optimizer compares the cheapest fully verified one-store shelf basket with the cheapest allocation across at most two physical stores.

Trust contract:

- every allocated product must have a retailer-backed, non-expired verified shelf price;
- regional catalog estimates and other unverified prices never participate;
- both stores must actually receive at least one basket line;
- the UI is hidden when a verified two-store option cannot beat the verified one-store option;
- routing, travel time and travel cost are intentionally not included yet and the UI says so explicitly.

This layer does not mutate collector output, store identifiers, price provenance, `scope_verified`, or the authoritative comparison engine.
