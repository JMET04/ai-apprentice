# Initial Generation Contract

## Contents

1. Input contract
2. Routing
3. Prompt structure
4. Domain requirements
5. Validation

## Input Contract

Provide a JSON object with a clear `task`. Add known fields when available:

- `domain`: `auto`, `packaging`, `cad_technical`, `product_visual`, `ecommerce`, `ui_web`, `architecture_interior`, `industrial_design`, or `general_image`.
- `subject`, `audience`, `outputType`, `locale`.
- `confirmedFacts`: teacher- or source-confirmed values only.
- `dimensions`: `{ length, width, height, unit }` when dimensions matter.
- `preserve`, `changes`, `constraints`, `exclusions`, and `referenceImages` as arrays.
- `composition`, `viewpoint`, `lighting`, `materials`, and `typography` as optional guidance.

Do not place guesses inside `confirmedFacts`.

## Routing

The compiler infers a domain when `domain=auto`. Override it only when the user's intended deliverable is clear. Existing specialist skills and tools still take precedence over generic generation.

The optional local library may improve examples, but the bundled compiler remains the baseline and must work without the library.

## Prompt Structure

The final prompt contains:

1. Task objective and deliverable.
2. Confirmed facts and exact dimensions.
3. Elements that must remain unchanged.
4. Requested changes and visual direction.
5. Composition, viewpoint, lighting, material, color, and typography.
6. Explicit exclusions and negative prompt.
7. Output quality and review boundary.

Keep the language concrete and observable. Replace vague words such as “高级” with material, spacing, lighting, hierarchy, and finish traits.

## Domain Requirements

### Packaging

- Prefer a clean orthographic review board or dieline-oriented view over a decorative mockup alone.
- Show structure, closure, folds, panels, and annotation zones clearly.
- Copy confirmed dimension text exactly; never derive values from pixels.
- Pixels are not dimension truth; the sample cannot authorize CAD values or production.
- Use Chinese labels unless the teacher requests another language.
- Block generation when product/box type or consequential dimensions are missing.

### CAD Technical

- Use flat orthographic or exploded technical presentation.
- State line types, units, labels, datum/origin, and required views.
- Treat the image as a communication sample, never as native CAD or manufacturing approval.

### Product, Ecommerce, UI, Architecture, Industrial Design

- Preserve the real product or spatial identity and list what may change.
- Define camera/viewpoint, lighting, materials, scale cues, and intended channel.
- For UI, specify viewport, hierarchy, states, density, and accessibility expectations.
- For architecture, preserve geometry and identify whether the output is concept, plan, elevation, or render.

## Validation

Before generation, confirm:

- required facts are present;
- confirmed facts and assumptions are separated;
- requested output and view are explicit;
- preservation and exclusion lists exist;
- language and typography policy are explicit;
- dimensions are copied only from authoritative inputs;
- no fake logo, watermark, approval stamp, or production claim is requested;
- review and correction remain open after generation.
