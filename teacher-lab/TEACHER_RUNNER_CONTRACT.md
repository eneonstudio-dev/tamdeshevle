# Bai Teacher Runner Contract v0.1

Teacher runners are offline-development components, not production dependencies.

Rules:

- teacher endpoints must be loopback-only by default;
- a runner returns structured shopping fields only;
- candidates enter the dataset with review status `candidate`;
- candidates are never trainable until a human or approved review process promotes them;
- source provenance is mandatory;
- source status is checked against `sources.json`;
- price, availability and quality confidence must remain unknown unless supported by input evidence;
- production Bai never depends on a teacher being available.

The first supported transport is an OpenAI-compatible local HTTP server at `/v1/chat/completions`, which can be backed by a self-hosted model such as a pinned DeepSeek-R1 or Qwen3 checkpoint.
