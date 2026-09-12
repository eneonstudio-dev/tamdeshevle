import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const js=await readFile(new URL("../ai-shopping-assistant.js",import.meta.url),"utf8");
const css=await readFile(new URL("../ai-shopping-assistant.css",import.meta.url),"utf8");

assert.match(js,/busy=false,requestSeq=0/,"chat runtime must keep explicit busy and request generation state");
assert.match(js,/if\(busy\)return false;const chosen=/,"strategy double-clicks must be ignored while busy");
assert.match(js,/async function submit\(text\)\{\s*if\(busy\)return false;/,"message double-submit must be ignored while busy");
assert.match(js,/const seq=\+\+requestSeq/,"async chat work must use a request generation token");
assert.match(js,/seq!==requestSeq\|\|!root/,"stale async results must be discarded after close or reset");
assert.match(js,/function newSession\(\)\{requestSeq\+\+;/,"new session must invalidate in-flight replies");
assert.match(js,/\[data-ai-close\].*requestSeq\+\+/s,"closing Bai must invalidate in-flight replies");
assert.match(js,/finally\{if\(seq===requestSeq\)setBusy\(false\)\}/,"busy state must always be released for the active request");
assert.match(js,/navigator\.onLine!==false/,"network state must be surfaced explicitly");
assert.match(js,/Офлайн · базовые команды и корзина работают локально\./,"offline mode must explain the local fallback");
assert.match(js,/window\.visualViewport/,"Android keyboard handling must follow VisualViewport when available");
assert.match(js,/--td-ai-vvh/,"visual viewport height must be passed to CSS");
assert.match(js,/data-keyboard-open/,"keyboard-open state must be exposed to the UI");
assert.match(js,/enterkeyhint="send"/,"mobile keyboard should expose a send action");
assert.match(js,/!e\.isComposing/,"Enter must not submit while an IME composition is active");
assert.match(js,/data-ai-runtime-status aria-live="polite"/,"loading and offline state must be announced accessibly");
assert.match(js,/isBusy:\(\)=>busy/,"runtime busy state must be inspectable for integrations");

assert.match(css,/top:var\(--td-ai-vvtop,0px\)/,"mobile Bai must follow VisualViewport top offset");
assert.match(css,/height:var\(--td-ai-vvh,100dvh\)/,"mobile Bai must use VisualViewport height");
assert.match(css,/\.td-ai\[data-keyboard-open\] \.td-ai-bai\{display:none\}/,"keyboard mode must reclaim vertical space from the mascot");
assert.match(css,/\.td-ai-compose textarea\{font-size:16px;/,"mobile composer must use a keyboard-safe input font size");
assert.match(css,/env\(safe-area-inset-bottom\)/,"composer must respect the bottom safe area");
assert.match(css,/prefers-reduced-motion:reduce/,"busy/listening animation must respect reduced motion");

console.log("Bai chat runtime contract passed: duplicate submits, stale replies, offline state and Android keyboard handling are guarded.");
