# Bai Teacher Lab v0.1

Teacher Lab builds legally traceable training/evaluation data for a future independent Bai Shopping Brain.

Rules:
- default deny: unknown sources never enter training data;
- every sample has provenance and a source id;
- only sources marked `training_allowed` may contribute model-generated training targets;
- `evaluation_only` sources may score Bai but their outputs may not enter training datasets;
- personal data must be removed before ingestion;
- raw chain-of-thought/reasoning is never stored; only structured shopping targets are kept;
- exact model/version/license must be pinned before large-scale generation;
- this registry is an engineering control, not a substitute for legal review.

Pipeline:
`source -> provenance firewall -> structured gold candidate -> validator/review -> gold dataset -> benchmark/train export`

No external model is called by CI. Teacher execution will be added separately after a source is approved and explicitly configured.
