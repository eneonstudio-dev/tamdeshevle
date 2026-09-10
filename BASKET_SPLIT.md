# Smart Assembly — two-store plan

The optimizer compares a fully verified one-store basket with the cheapest allocation across at most two stores in the selected mode: `Сходить` or `Привезти`.

Trust contract:

- every allocated product must have a retailer-backed, non-expired verified shelf price;
- regional catalog estimates and other unverified prices never participate;
- both stores must actually receive at least one basket line;
- delivery plans include each network delivery fee only when it is known;
- a known minimum order is enforced for each delivery part; an unknown minimum means that only a potential, not a net, saving can be shown;
- every calculation is accumulated in kopecks and rounded only for display;
- the UI is hidden when a verified two-store option cannot beat the verified one-store option, and its disclosure shows every basket line and destination;
- routing, travel time and travel cost are intentionally not invented. Until the user gives an address and a route source, the UI says so explicitly.

This layer does not mutate collector output, store identifiers, price provenance, `scope_verified`, or the authoritative comparison engine.
