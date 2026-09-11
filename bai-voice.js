(() => {
  "use strict";

  const KEY = "td:bai-voice-enabled";
  const synth = window.speechSynthesis;
  if (!synth || typeof window.SpeechSynthesisUtterance === "undefined") return;

  let enabled = localStorage.getItem(KEY) !== "0";
  let speaking = false;
  let chosenVoice = null;
  let transcriptTimer = null;
  const nativeSpeak = synth.speak.bind(synth);
  const nativeCancel = synth.cancel.bind(synth);

  function scoreVoice(v) {
    const lang = String(v.lang || "").toLowerCase();
    const name = String(v.name || "").toLowerCase();
    let score = 0;
    if (lang === "ru-ru") score += 100;
    else if (lang.startsWith("ru")) score += 80;
    if (v.localService) score += 10;
    if (/google|microsoft|yandex|milena|dmitry|irina|alena|russian/.test(name)) score += 8;
    if (/female|жен/.test(name)) score += 2;
    return score;
  }

  function refreshVoice() {
    const voices = synth.getVoices ? synth.getVoices() : [];
    chosenVoice = [...voices].sort((a,b) => scoreVoice(b) - scoreVoice(a))[0] || null;
    return chosenVoice;
  }

  function assistantRoot() { return document.querySelector(".td-ai"); }
  function voiceButton() { return document.querySelector("[data-bai-voice-toggle]"); }

  function dedupeTranscript(text) {
    const tokens = String(text || "").trim().split(/\s+/).filter(Boolean);
    if (tokens.length < 2) return tokens.join(" ");
    const out = [];
    for (const token of tokens) {
      if (out.length && out[out.length - 1].toLowerCase() === token.toLowerCase()) continue;
      out.push(token);
      let changed = true;
      while (changed) {
        changed = false;
        const max = Math.min(14, Math.floor(out.length / 2));
        for (let len = max; len >= 2; len--) {
          const a = out.slice(out.length - len * 2, out.length - len).join(" ").toLowerCase();
          const b = out.slice(out.length - len).join(" ").toLowerCase();
          if (a === b) {
            out.splice(out.length - len, len);
            changed = true;
            break;
          }
        }
      }
    }
    return out.join(" ");
  }

  function cleanTranscript() {
    const root = assistantRoot();
    const area = root?.querySelector("textarea");
    if (!area || !area.value) return;
    const clean = dedupeTranscript(area.value);
    if (clean !== area.value.trim()) {
      area.value = clean;
      try { area.selectionStart = area.selectionEnd = area.value.length; } catch {}
    }
  }

  function keepTranscriptClean() {
    clearInterval(transcriptTimer);
    transcriptTimer = setInterval(() => {
      const mic = assistantRoot()?.querySelector("[data-ai-mic]");
      if (!mic?.classList.contains("listening")) return;
      cleanTranscript();
    }, 140);
  }

  function updateUI() {
    const root = assistantRoot();
    const button = voiceButton();
    if (root) root.classList.toggle("td-bai-speaking", speaking);
    if (!button) return;
    button.classList.toggle("off", !enabled);
    button.classList.toggle("speaking", speaking);
    button.textContent = speaking ? "■" : (enabled ? "🔊" : "🔇");
    button.setAttribute("aria-label", speaking ? "Остановить голос Бая" : (enabled ? "Выключить голос Бая" : "Включить голос Бая"));
    button.title = speaking ? "Замолчать" : (enabled ? "Голос Бая включён" : "Голос Бая выключен");
  }

  function stopSpeaking() {
    nativeCancel();
    speaking = false;
    updateUI();
  }

  function toggleVoice() {
    if (speaking || synth.speaking) {
      stopSpeaking();
      return;
    }
    enabled = !enabled;
    localStorage.setItem(KEY, enabled ? "1" : "0");
    if (!enabled) stopSpeaking();
    updateUI();
  }

  function attachButton() {
    const head = document.querySelector(".td-ai-head");
    if (!head || head.querySelector("[data-bai-voice-toggle]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "td-ai-voice-toggle";
    button.setAttribute("data-bai-voice-toggle", "");
    button.onclick = toggleVoice;
    const newButton = head.querySelector("[data-ai-new]");
    head.insertBefore(button, newButton || null);
    updateUI();
  }

  synth.speak = function(utterance) {
    if (!enabled || !utterance) return;
    refreshVoice();
    if (chosenVoice) utterance.voice = chosenVoice;
    utterance.lang = chosenVoice?.lang || "ru-RU";
    utterance.rate = Math.min(1.08, Math.max(0.9, Number(utterance.rate) || 1));
    utterance.pitch = 0.94;
    const onstart = utterance.onstart;
    const onend = utterance.onend;
    const onerror = utterance.onerror;
    utterance.onstart = e => {
      speaking = true;
      updateUI();
      try { onstart?.call(utterance, e); } catch {}
    };
    utterance.onend = e => {
      speaking = false;
      updateUI();
      try { onend?.call(utterance, e); } catch {}
    };
    utterance.onerror = e => {
      speaking = false;
      updateUI();
      try { onerror?.call(utterance, e); } catch {}
    };
    nativeCancel();
    nativeSpeak(utterance);
  };

  synth.cancel = function() {
    nativeCancel();
    speaking = false;
    updateUI();
  };

  document.addEventListener("click", e => {
    if (e.target?.closest?.("[data-ai-mic]")) {
      stopSpeaking();
      keepTranscriptClean();
      setTimeout(cleanTranscript, 80);
      setTimeout(cleanTranscript, 260);
    }
    if (e.target?.closest?.("[data-ai-send]")) cleanTranscript();
  }, true);

  document.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey && e.target?.closest?.(".td-ai textarea")) cleanTranscript();
  }, true);

  const style = document.createElement("style");
  style.textContent = `
    .td-ai-head .td-ai-voice-toggle{width:38px;height:38px;flex:0 0 38px;border:1px solid rgba(39,223,131,.22);background:rgba(39,223,131,.08);font-size:16px}
    .td-ai-head .td-ai-voice-toggle.off{opacity:.55;filter:saturate(.4)}
    .td-ai-head .td-ai-voice-toggle.speaking{background:#27df83;color:#062014;animation:td-bai-voice-pulse 1s ease-in-out infinite}
    .td-bai-speaking [data-ai-bai]{animation:td-bai-talk .38s ease-in-out infinite alternate;transform-origin:50% 80%}
    .td-bai-speaking .td-ai-bai:after{content:"говорю";display:inline-block;margin-top:5px;padding:4px 8px;border-radius:999px;background:rgba(39,223,131,.1);color:#9ef4c7;font:800 10px Manrope,sans-serif;letter-spacing:.04em}
    @keyframes td-bai-talk{from{transform:translateY(0) rotate(-1deg)}to{transform:translateY(-3px) rotate(1deg)}}
    @keyframes td-bai-voice-pulse{50%{box-shadow:0 0 0 7px rgba(39,223,131,.1)}}
    @media(max-width:820px){.td-ai-head .td-ai-voice-toggle{width:36px;height:36px;flex-basis:36px}}
  `;
  document.head.appendChild(style);

  refreshVoice();
  if (typeof synth.addEventListener === "function") synth.addEventListener("voiceschanged", refreshVoice);
  else synth.onvoiceschanged = refreshVoice;

  const observer = new MutationObserver(attachButton);
  observer.observe(document.documentElement, {childList:true, subtree:true});
  attachButton();
  keepTranscriptClean();

  window.TDBaiVoice = {
    isEnabled: () => enabled,
    setEnabled(value) { enabled = Boolean(value); localStorage.setItem(KEY, enabled ? "1" : "0"); if (!enabled) stopSpeaking(); updateUI(); },
    stop: stopSpeaking,
    voice: () => chosenVoice ? {name:chosenVoice.name, lang:chosenVoice.lang, localService:chosenVoice.localService} : null,
    refresh: refreshVoice,
    cleanTranscript,
    dedupeTranscript
  };
})();
