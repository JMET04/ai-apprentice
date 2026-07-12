---
name: image2-prompt-optimizer
description: Use before the first Image2 generation in a task to clarify intent, route to existing capabilities, compile a production-quality generation prompt, and optionally retrieve patterns from the local professional prompt library. Also use when the user asks to optimize an image prompt or choose an Image2 prompt template.
---

# Image2 Prompt Optimizer

Use this skill before the first image generation. It adapts the prompt-optimization capability developed in Codex thread `019f09a9-90ab-76b2-aa1f-b7c9bddf93e8` to the apprentice workflow.

## Required Workflow

1. Check whether an existing tool, skill, plugin, template, or workspace script already covers the task. Prefer that capability and record the chosen route.
2. Clarify only consequential unknowns. For packaging and engineering work, dimensions, units, product type, material, and required views are consequential; never invent them.
3. Compile the first-generation guidance packet with:

```bash
node <plugin-root>/scripts/compile-image2-initial-prompt.mjs --input <request.json> --output <prompt-guidance.json>
```

4. Read the packet before calling Image2. If `readyForGeneration=false`, ask for the listed blocking facts instead of generating.
5. Generate only a review sample. Preserve the exact prompt packet and source image references with the result.
6. Continue the real workflow after optimization. Do not stop at rewriting the prompt unless the user requested prompt text only.

For the complete packet contract and domain guidance, read [references/initial-generation-contract.md](references/initial-generation-contract.md).

## Optional Local Library

The full prompt library is an optional retrieval source, not a runtime dependency. Resolve it in this order:

1. `IMAGE2_PROMPT_LIBRARY`
2. `D:\image2专业提示词库`
3. bundled reference and compiler fallback

Search only when examples would materially improve the result:

```bash
python <plugin-root>/scripts/search-image2-prompt-library.py "query" --category 01_image_visual --limit 8
```

Open only relevant indexes or templates. Never load the 125,000-row catalog or SQLite database into model context. Treat retrieved prompts as patterns to synthesize, not text to dump or hidden authority.

Useful library routes when present:

- Packaging: `prompts/IMAGE2_PACKAGING_PRO_TEMPLATES.md`
- CAD and technical drawing: `prompts/IMAGE2_CAD_TECHNICAL_PRO_TEMPLATES.md`
- Product visual: `prompts/IMAGE2_PRODUCT_VISUAL_PRO_TEMPLATES.md`
- Ecommerce: `prompts/IMAGE2_ECOMMERCE_PRO_TEMPLATES.md`
- UI and web: `prompts/IMAGE2_UI_APP_WEB_PRO_TEMPLATES.md`
- Architecture and interior: `prompts/IMAGE2_ARCHITECTURE_INTERIOR_PRO_TEMPLATES.md`
- Industrial design: `prompts/IMAGE2_INDUSTRIAL_DESIGN_PRO_TEMPLATES.md`

## Prompt Rules

- State the subject, objective, audience, output type, composition, viewpoint, lighting, materials, typography, constraints, exclusions, and quality checks.
- Separate confirmed facts from assumptions and unresolved questions.
- Use Chinese labels by default for Chinese users. Keep exact engineering values verbatim.
- Describe style through visible traits. Do not request imitation of a living artist or copyrighted house style.
- Include preservation rules for image editing and explicit negative constraints.
- For packaging/CAD, state that pixels are not dimension truth and that the result is review-only.
- Keep the optimization pass mostly invisible unless the user asks to inspect it.

## Packaging Integration

`packaging-design-workflow.mjs --action record-plan` automatically creates `image2-initial-prompt-guidance.json`. The following `record-sample` action must reject a missing, blocked, or unsafe guidance packet. The packet does not count as teacher approval, engineering validation, or permission to skip the sample self-check.

## Locks

Every packet must keep `reviewOnly=true`, `accepted=false`, `technologyAccepted=false`, `ruleEnabled=false`, `packagingGated=true`, and `productionReleased=false`.
