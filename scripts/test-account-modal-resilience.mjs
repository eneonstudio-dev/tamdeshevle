import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync("account-auth-ui.js","utf8");

assert.match(source,/const FOCUSABLE=/,"account/auth layer should define a focusable contract");
assert.match(source,/function trapTab\(/,"account/auth dialogs should trap Tab navigation");
assert.match(source,/aria-modal/,"dialogs should expose modal semantics");
assert.match(source,/aria-labelledby/,"dialogs should use labelled titles");
assert.match(source,/safeFocus\(/,"dialogs should restore focus safely");
assert.match(source,/event\.key==='Escape'/,"Escape should close the active account/auth layer");

assert.match(source,/tdAccount:true/,"account opening should create browser history state");
assert.match(source,/tdAuth:true/,"auth opening should create nested browser history state");
assert.match(source,/addEventListener\('popstate'/,"Android/browser Back should close nested account layers");
assert.match(source,/history\.back\(\)/,"manual close should reconcile browser history");
assert.match(source,/history\.replaceState\(next,''\)/,"stale dialog history should be cleared on a fresh page");

assert.match(source,/--td-vvh/,"account/auth surfaces should use visual viewport height");
assert.match(source,/safe-area-inset-bottom/,"auth modal should respect mobile safe areas");
assert.match(source,/data-td-keyboard-open/,"auth modal should react to Android keyboard state");
assert.match(source,/overscroll-behavior:contain/,"account/auth overlays should contain overscroll");

assert.match(source,/cloudUiBusy/,"cloud actions should have an immediate UI busy guard");
assert.match(source,/authActionBusy/,"sign-out should be protected against duplicate taps");
assert.match(source,/aria-busy/,"busy account operations should be exposed accessibly");
assert.match(source,/Не удалось выйти из аккаунта/,"sign-out failure should be visible to the user");
assert.match(source,/cloud\.status==='error'\?'alert':'status'/,"cloud errors should be announced as alerts");

assert.match(source,/pagehide.*observer\.disconnect/s,"observer should stop on pagehide");
assert.match(source,/pageshow.*observer\.observe/s,"observer should recover after BFCache restore");
assert.doesNotMatch(source,/TDBai/,"account/auth resilience layer must not modify or depend on Bai");

console.log("Account modal resilience passed: nested Back, focus, Android viewport, busy/error and Bai isolation are guarded.");
