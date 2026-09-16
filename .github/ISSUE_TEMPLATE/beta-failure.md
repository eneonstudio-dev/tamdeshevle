---
name: Controlled beta failure
description: Reproducible user-facing failure from the VOTONOBAI controlled beta
labels: []
---

## Beta Failure Intake

**REQUEST / USER ACTION:**  
<!-- Preserve the user's actual wording when possible. -->

**STARTING STATE:**  
<!-- Fresh storage / existing basket / selected store / previous Bay turn / connectivity state. -->

**EXPECTED:**  
<!-- Observable state/action result, not just preferred wording. -->

**ACTUAL:**  

**VISIBLE IMPACT:**  
<!-- What could the user not do, misunderstand, overpay for, or trust incorrectly? -->

**REPRODUCIBLE:** yes / no  

**DEVICE / VIEWPORT:**  
<!-- If relevant: Android/browser/desktop width. -->

**EVIDENCE:**  
<!-- Screenshot, trace, exact state, test, CI/log reference. Avoid secrets/personal data. -->

## Triage

**SEVERITY:** P0 / P1 / P2 / P3 / unclassified  
**LIKELY OWNER:** Rogue / Fixer / Vi / Tali / Sara-Roxy / Reinhard / Umnyasha / unknown  

### Why this severity?
<!-- P0: unusable/data lie/critical security; P1: wrong core behavior or completion blocker; P2/P3: non-blocking. -->

## Guardrails

- [ ] No secret, credential, private receipt/account/session data is pasted here.
- [ ] This report describes observed behavior, not a speculative redesign.
- [ ] If P0/P1 is reproduced, convert it into a permanent regression when practical.
- [ ] Do not weaken truth/budget/security/capability rules merely to make the failure disappear.
