---
name: packaging-design-apprentice
description: Use when the user asks AI Apprentice to design packaging, generate a packaging sample with Image2, accept visual mask corrections, locally edit the result, or hand a reviewed packaging design to AICAD for engineering drawings.
---

# Packaging Design Apprentice

Use this skill for packaging design work. The workflow is deliberately staged; never skip directly from a request or Image2 sample to final delivery or CAD.

## Teacher Communication

Use the bundled `warm-human-communication` skill throughout this workflow. During clarification, say what is already understood and ask only the smallest missing data group that blocks safe design. During failure, name the failed stage, preserve any intact sample or mask, and give the smallest recovery step. During correction, acknowledge the exact region or engineering boundary that was misread and apply it without changelog or customer-service language. Keep manufacturing risks and review gates explicit even when the tone is warm.

## Required Sequence

1. **Clarify requirements.** Ask for the product type, packaging/box type, confirmed internal or product dimensions (`L x W x H` plus unit), material/thickness, weight and transport needs, closure, printing/finish, references, and required output formats. Ask only the smallest useful set of questions at once. Never invent a missing consequential dimension.
2. **Form a deep implementation plan and compile the first prompt.** Select a packaging template, identify all dimension sources and assumptions, and define structural constraints and manufacturing risks. Then invoke the bundled `image2-prompt-optimizer`; `record-plan` automatically writes `image2-initial-prompt-guidance.json`. Show a public structured trace, not private chain-of-thought.
3. **Generate one Image2 sample from the guidance packet.** Read and follow the compiled prompt packet before calling the Image2/image generation tool. Preserve the packet and original image. The sample is not deliverable and its pixels are not dimension truth. Never generate while `readyForGeneration=false`.
4. **Self-check before teacher review.** Check all eight items in `transparent_ai_apprentice_packaging_sample_self_check_v1`: dimension completeness, unit consistency, panel/shape topology, cut/crease/slot conflicts, closure clearances, manufacturing feasibility, annotation legibility, and confirmation that Image2 pixels were not used as dimensions. Record failures honestly.
5. **Open the Chinese mask workbench.** Use `create-transparent-sketch-overlay-kit.mjs --backdrop <sample image>` and show the self-check issues beside the sample. Wait for the teacher to submit marks or text. Do not infer approval from opening or closing the mask.
6. **Apply Image2 local editing.** Send the original sample, submitted mask, teacher text, and self-check issues to Image2 as a local edit. Preserve before/after evidence. Do not regenerate unrelated regions.
7. **Hand off to AICAD.** Only after the local edit exists, run `packaging-design-workflow.mjs --action prepare-cad-handoff`. Use the integrated `aicad-agent` plugin to create the parametric plan and CAD outputs. Confirmed teacher/engineering dimensions outrank standards, mask semantics, and Image2 appearance in that order. Never measure CAD dimensions from Image2 pixels.
8. **Final teacher review.** Show CAD outputs, native annotations, preview, validation report, error root causes, and any new prevention rules. Keep the decision review-only; do not claim technology acceptance or production readiness.

## Session Commands

Create or clarify a session:

```bash
node plugins/transparent-ai-apprentice/scripts/packaging-design-workflow.mjs \
  --action create \
  --request "teacher request" \
  --product-type "product and package type" \
  --length 200 --width 120 --height 60 --unit mm
```

Advance only with real artifacts:

```bash
node plugins/transparent-ai-apprentice/scripts/packaging-design-workflow.mjs --action record-plan --session <session.json> --artifact <solution-plan.json>
# record-plan automatically creates image2-initial-prompt-guidance.json
node plugins/transparent-ai-apprentice/scripts/packaging-design-workflow.mjs --action record-sample --session <session.json> --artifact <image2-sample.png>
node plugins/transparent-ai-apprentice/scripts/packaging-design-workflow.mjs --action record-self-check --session <session.json> --artifact <self-check.json>
node plugins/transparent-ai-apprentice/scripts/packaging-design-workflow.mjs --action record-correction --session <session.json> --artifact <transparent-sketch-packet.json>
node plugins/transparent-ai-apprentice/scripts/packaging-design-workflow.mjs --action record-local-edit --session <session.json> --artifact <image2-local-edit.png>
node plugins/transparent-ai-apprentice/scripts/packaging-design-workflow.mjs --action prepare-cad-handoff --session <session.json>
node plugins/transparent-ai-apprentice/scripts/packaging-design-workflow.mjs --action record-cad-result --session <session.json> --artifact <cad-result-manifest.json>
```

The script rejects stage skipping. Every session and handoff must keep `reviewOnly=true`, `accepted=false`, `technologyAccepted=false`, `ruleEnabled=false`, and `packagingGated=true`.

## Image2 Prompt Contract

Every generation or local-edit prompt must state:

- Chinese labels and annotations unless the teacher explicitly requests another language;
- the selected packaging template and confirmed dimensions;
- visual composition and typography requirements;
- which regions may change and which must remain untouched during local edits;
- that dimension text must match confirmed engineering data;
- no invented measurements, logos, watermarks, fake approval stamps, or production claims;
- one clean orthographic dieline/sample view suitable for review, not a decorative product mockup alone.

The first generation must additionally use `transparent_ai_apprentice_image2_initial_prompt_guidance_v1`, preserve its provenance back to the integrated `image2-prompt-optimizer` skill, and pass every non-review blocking check before Image2 is called.

## Locks

This skill produces teacher-review evidence. It must never automatically enable a learned rule, persist acceptance, unlock packaging, or claim that Image2/CAD output is manufacturing-approved.
