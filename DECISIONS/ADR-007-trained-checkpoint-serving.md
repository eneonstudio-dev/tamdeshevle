# ADR-007 — Trained Bai checkpoint serving is pinned, staged and fail-closed

**Date:** 2026-09-14
**Status:** ACTIVE
**Owner approval required:** no
**Related:** PR #362; commit `4a00f58dc147cc9c597a1c05248d36a34537cf6e`; Supabase Edge Function `bai-trained-inference` v1

## Context

Votonobay can produce a trained Bai student checkpoint only after the held-out benchmark and promotion gate pass. The browser runtime already validates trained releases and preserves deterministic fallback, but a promoted PEFT adapter still needs a safe serving path. The GPU model must not be exposed directly to the browser, secrets must stay server-side, and a candidate must never become active merely because an endpoint exists.

The website user session is issued by the primary Supabase auth project, while Bai server-side functions live in the separate Bai Learning Backend project. Therefore the serving proxy must explicitly verify the primary-project bearer token rather than trusting a learning-project JWT verifier.

## Decision

A trained Bai release is served through this chain:

`browser trained runtime -> Bai Learning Backend / bai-trained-inference -> private GPU adapter server`

The following rules are mandatory:

1. A release may enter the serving path only if it is `kind: trained`, `status: promoted`, `promotion.pass: true`, uses `bai-actions-v1`, and has a pinned 64-hex checkpoint SHA.
2. Release binding is separate from activation. The binder always produces `enabled: false`; activation requires a later explicit verified step.
3. The browser never calls the GPU backend directly. It calls only the approved Supabase proxy origin and sends the existing TD user bearer token.
4. The proxy authenticates that bearer token against the primary auth project, rate-limits requests, and verifies the exact release triple: release id, checkpoint SHA, action contract.
5. The proxy forwards only a sanitized student-shaped request to the GPU backend. Backend access requires a server-side bearer secret and HTTPS.
6. The GPU server loads the promoted bundle, pinned base revision and adapter, uses the same student prompt contract, non-thinking mode and deterministic generation used by evaluation.
7. Both proxy and browser runtime reject model-owned dynamic truth such as price, availability, store, composition or quality. Deterministic/runtime truth validation remains authoritative.
8. Any missing pin, missing backend configuration, auth failure, timeout, response mismatch, unsafe output or invalid action fails closed. Safe deterministic rules remain the boot/default fallback.
9. Deploying the proxy is not deploying a model. Until a promoted release and private backend are explicitly bound, the proxy remains intentionally non-serving.

## Why

This preserves the existing Votonobay invariant: neural reasoning may propose shopping actions, but deterministic code owns safety, truth, constraints and execution. It also prevents a leaked or stale model endpoint from silently becoming production behavior and keeps backend credentials out of the public client.

A direct browser-to-GPU endpoint was rejected because it would expose the serving surface and complicate authentication, rate limiting, pin verification and secret isolation. Automatic activation after promotion was rejected because promotion proof and live-serving verification are separate operational risks.

## Consequences

- A successful future promotion can move quickly to staging without redesigning the runtime path.
- Serving requires a private HTTPS GPU backend and explicit environment binding for the promoted release.
- The browser registry remains disabled-by-default for generated trained releases.
- Rollback remains deterministic and local via `safe-rules-v1`.
- Cross-project auth logic must continue to be tested when Supabase auth/function behavior changes.
- No trained checkpoint is considered production merely because this serving infrastructure exists.

## Supersedes / Superseded by

None.
