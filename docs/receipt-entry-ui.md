# Receipt entry UI

This vertical slice collects a local receipt draft and can submit a private proof to the authenticated review queue without promoting it into price ranking.

- Exact store address and purchase time are required.
- A local photo selection is never treated as durable proof until the signed-in user explicitly submits it.
- Submitted photos go to the private `receipt-proofs/<user-id>/…` bucket and a RLS-protected `receipt_submissions` queue. Drafts remain local as a fallback.
- Neither the browser upload nor the queue calls the receipt price adapter.
- A name-only match remains weak; barcode can be captured for later strong identity verification.
- The UI is wired after the receipt observation, verification and adapter modules.

Future backend upload must replace local-only photo handling with authenticated durable storage before any receipt can become trusted evidence.
