# Receipt entry UI

This vertical slice collects a local receipt draft without promoting it into price ranking.

- Exact store address and purchase time are required.
- A local photo selection is never treated as durable proof.
- Drafts stay in localStorage and never call the receipt price adapter.
- A name-only match remains weak; barcode can be captured for later strong identity verification.
- The UI is wired after the receipt observation, verification and adapter modules.

Future backend upload must replace local-only photo handling with authenticated durable storage before any receipt can become trusted evidence.
