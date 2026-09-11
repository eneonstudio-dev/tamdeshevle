# Qwen 0 ₽ для Бая

У Бая есть три режима понимания команд:

1. **Rules** — встроенный локальный парсер. Ничего не скачивает и всегда остаётся fallback.
2. **Browser Qwen** — `Qwen3-0.6B` запускается прямо в браузере через WebGPU. Сервер и API-ключ не нужны. Модель скачивается на устройство только после явного включения пользователем.
3. **Ollama Qwen** — усиленный локальный режим для ПК с `qwen3:4b` через `http://127.0.0.1:11434/v1/chat/completions`.

## Browser Qwen

Требуется браузер с WebGPU. В коде используется `onnx-community/Qwen3-0.6B-ONNX` и Transformers.js. Если WebGPU недоступен, загрузка модели не начинается, а Бай остаётся на Rules.

Из консоли разработчика:

```js
TDQwenRouter.enableBrowser()
TDQwenRouter.status()
TDQwenRouter.disable()
```

## Ollama Qwen

Установить Ollama и загрузить модель:

```bash
ollama run qwen3:4b
```

После этого включить в браузере:

```js
TDQwenRouter.enableOllama({ model: "qwen3:4b" })
```

Для GitHub Pages origin может понадобиться добавить домен сайта в `OLLAMA_ORIGINS`; локальный API Ollama не требует API-ключа.

## Безопасность бюджета

Ни один режим не использует платный API. Если Qwen не отвечает, не поддерживается или ломается, `TDQwenRouter.route()` возвращает управление встроенному rule-based parser. Цены, итог корзины и сравнение магазинов по-прежнему считаются кодом «Там дешевле», а не моделью.
