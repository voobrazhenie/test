---
name: Inspiration Machine
description: One skinnable chord instrument; six worlds over one custom-property contract, documented here through its Chord Chart realisation.
colors:
  ink: "#12120f"
  plate-blue: "#1f35c4"
  plate-blue-deep: "#16279a"
  paper: "#f2f0ea"
  paper-bright: "#fbfaf6"
  graphite: "#3b3a33"
  pencil-grey: "#6b6a61"
  rule-hair: "#c8c4b8"
  blank-cell: "#b5b1a5"
  wall-ultramarine: "#1c30b0"
  fault-red: "#b3261e"
typography:
  display:
    fontFamily: "IM Chart Condensed, Arial Narrow, Helvetica, Arial, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "IM Chart Condensed, Arial Narrow, Helvetica, Arial, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "0.01em"
  label:
    fontFamily: "IM Chart Condensed, Arial Narrow, Helvetica, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    letterSpacing: "0.08em"
  label-dense:
    fontFamily: "IM Chart Condensed, Arial Narrow, Helvetica, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.03em"
  caption:
    fontFamily: "IM Chart Condensed, Arial Narrow, Helvetica, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "0.16em"
  micro:
    fontFamily: "IM Chart Condensed, Arial Narrow, Helvetica, Arial, sans-serif"
    fontSize: "10.5px"
    fontWeight: 700
    letterSpacing: "0.13em"
  body:
    fontFamily: "Helvetica, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    letterSpacing: "normal"
rounded:
  none: "0px"
  sheet: "2px"
spacing:
  hair: "3px"
  xs: "6px"
  sm: "8px"
  md: "10px"
  lg: "14px"
  xl: "20px"
  gutter: "22px"
components:
  cell-control:
    backgroundColor: "{colors.paper-bright}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "8px 0"
  cell-control-engaged:
    backgroundColor: "{colors.plate-blue}"
    textColor: "{colors.paper-bright}"
  cell-control-dense:
    typography: "{typography.label-dense}"
    padding: "8px 0"
  header-cell:
    backgroundColor: "{colors.paper-bright}"
    textColor: "{colors.ink}"
    typography: "{typography.display}"
    rounded: "{rounded.none}"
    padding: "8px 14px"
  history-cell:
    backgroundColor: "{colors.paper-bright}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "7px 10px"
  history-cell-empty:
    textColor: "{colors.blank-cell}"
  small-control:
    backgroundColor: "{colors.paper-bright}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
  small-control-engaged:
    backgroundColor: "{colors.plate-blue}"
    textColor: "{colors.paper-bright}"
  sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "16px 22px 18px"
    width: "min(920px, 100%)"
---

# Design System: Inspiration Machine

## Overview

**Creative North Star: "The Two-Plate Chord Chart"**

The Inspiration Machine is one instrument that can wear six worlds. That is the
system's real shape, and it has two layers. The lower layer is a **custom-property
contract**: a single `:root` block declares every colour role, radius and shadow
tint the instrument consumes, and a skin is nothing but a `:root[data-skin="…"]`
block that reassigns those roles plus a `[data-skin="…"]` rule set that changes
material behaviour (borders, shadows, faces, corner marks). No component in the
build reads a literal colour; every component reads a role. That indirection is
what makes a sixth world a stylesheet block rather than a rewrite, and it is the
part of this document that binds all future work.

The upper layer is a **realised world**. This file documents one of them in full:
`chart`, the Chord Chart. Its thesis is that the instrument is a working chart you
play, not a device you operate — refusing both the category's near-black-plus-neon
rack panel and the cream/serif/terracotta that two incumbent skins already spend.
The world is a two-plate instructional print off a music-shop chord poster: black
ink rules and condensed caps on cool stock, one saturated ultramarine as the second
plate, chord tones as filled dots. There is no shadow, no glow and no gradient
anywhere in it, because a two-plate press cannot print a blurred penumbra. Depth is
carried by rule weight alone.

The organising rule of the chart world inverts the usual device grammar: **engaged
always means more ink, never less.** A rest-state control is paper inside a rule; an
engaged control is a flood of the second plate with its label knocked out to paper.
Nothing translates, scales, or lights up on press. The five other shipped skins
(`classic`, `vintage`, `lofi`, `fieldunit`, `brutal`) are alternate realisations of
the same contract with their own materials — they are not documented here beyond the
contract they prove.

**Key Characteristics:**
- One token contract, six interchangeable worlds, selected at runtime and applied before first paint.
- Chart world: two inks only — black and ultramarine — on two papers.
- Zero shadow, zero glow, zero gradient; rule weight is the entire depth vocabulary.
- Condensed caps everywhere a machine speaks; the display face ships inside the file.
- Every control is a ruled cell in a grid, not a button on a panel.
- The whole instrument fits one screen without scrolling at 1920×1080, 1440×900 and 390×844.

## Colors

Two plates on cool stock: everything is black ink, one ultramarine, or the paper
between them — with a small set of greys reserved for structure that must recede.

### Primary
- **Plate Blue** (`{colors.plate-blue}`): the second plate. It is the *only* saturated
  colour in the world and it means exactly one thing: engaged. Flooded cells, lit strum
  segments, slider thumbs, chord-tone dots, active history names, the selected skin card.
  Never decorative, never a background, never a border on a resting element.
- **Plate Blue Deep** (`{colors.plate-blue-deep}`): the pressed-state variant of the flood,
  bound to the shared `--on-top` / `--on-bot` roles. Used only where the contract asks for a
  darker engaged tone; it never appears as a standalone accent.

### Neutral
- **Ink** (`{colors.ink}`): the first plate. Every rule, border, label, key name, corner mark
  and icon mask. Black keys are solid ink; there is no separate "black key" colour.
- **Paper** (`{colors.paper}`): the sheet itself and the panel surfaces sitting on it.
- **Bright Paper** (`{colors.paper-bright}`): the stock inside a cell — header cell, keybed,
  strum, history, control cells. One step brighter than the sheet, which is how a cell reads
  as a cell without needing a fill or a shadow.
- **Graphite** (`{colors.graphite}`): secondary printed text — the chord's note list, history
  hints. Full legibility, lower voice.
- **Pencil Grey** (`{colors.pencil-grey}`): the keyboard-hint layer on white keys. The quietest
  text in the world that is still text.
- **Hairline** (`{colors.rule-hair}`): internal dashed divisions inside the history strip, and the
  keybed shade. Structure, never text.
- **Blank Cell** (`{colors.blank-cell}`): the placeholder mark in an unfilled history cell.
  It is intentionally below text contrast because it is a ruled blank waiting to be filled.
- **Wall Ultramarine** (`{colors.wall-ultramarine}`): the page behind the sheet. The chart is
  pinned to a wall; the wall is the one place saturation is allowed to cover area.

### Tertiary
- **Fault Red** (`{colors.fault-red}`): the MIDI status dot in an error state. Nothing else.

### Named Rules
**The Two-Plate Rule.** The chart world prints in exactly two inks. Any new surface uses ink,
plate blue, or paper — a third hue is a new plate and the press does not have one.

**The More-Ink Rule.** Engaged is always *more* ink than rest, never less and never merely
different. A control at rest is paper inside a rule; a control engaged is a solid flood of the
second plate with its label knocked out to paper. If a proposed state reads as "dimmer", it is wrong.

**The Role-Not-Value Rule.** No component may hard-code a colour. Components consume the
`:root` role tokens; skins reassign the roles. A literal hex inside a component rule breaks all
six worlds at once.

## Typography

**Display Font:** IM Chart Condensed — DejaVu Sans Condensed Bold, subset to this UI's glyphs
(~5KB), woff2, embedded as a base64 data URI (with `Arial Narrow`, Helvetica, Arial fallbacks)
**Body Font:** Helvetica / Arial

**Character:** Condensed bold caps, tightly tracked at display size and widely tracked at label
size — the lettering of a printed instructional poster, where every word is set to be read across
a shop. The body face is a plain grotesque doing nothing but carrying prose.

### Hierarchy
- **Display** (700, `{typography.display}`, tight tracking): the chord name in the header cell.
  The single largest mark in the first viewport, set beside the keyboard diagram at hero scale
  in a 44% / 1fr grid — never stacked above a thumbnail.
- **Title** (700, `{typography.title}`, uppercase): the wordmark in the header.
- **Caption** (700, `{typography.caption}`, wide tracking): the chord's note list, directly under
  the chord name.
- **Label** (700, `{typography.label}`): control-cell labels. Reduced to `{typography.label-dense}`
  in the eight-cell engine row, which is the only row whose labels reach the corner mark.
- **Micro** (700, `{typography.micro}`, widest tracking): section headings and the printed footer
  line.

### Named Rules
**The Shipped-Face Rule.** The display face is self-hosted and embedded in the file. The product
must install and run offline as a PWA and ships under an artifact CSP that forbids external
subresources, so no future face may be loaded from a network or assumed present on the machine.
Changing the face means subsetting a new one and re-embedding it, or the world silently degrades
to `Arial Narrow`.

**The Ruled-Heading Rule.** Every section heading sits *on* the rule it labels: the label, a 9px
gap, then a 2px rule running to the end of the row. A heading floating free of its rule is not a
heading in this world.

## Layout

The instrument is a single sheet of `min(920px, 100%)` — up to 920px wide, padded
`16px 22px 18px` — centred on the wall, with the page itself padded `12px 12px 10px`. Everything
inside is a stack of ruled bands: header cell, labelled control rows, keybed, strum plate,
history strip, footer rule. Control rows are flex rows with a 10px gutter; the spacing rhythm is
coarse and small (3 / 6 / 8 / 10 / 14 / 20 / 22px), because a chart is dense by nature.

**The no-scroll constraint is binding and product-confirmed:** the whole instrument must be
visible without scrolling at 1920×1080, 1440×900 and 390×844. Any new element must be paid for
by removing height elsewhere.

A single `@media (max-width: 640px)` compact layout serves the phone: the wordmark is hidden,
page padding drops to `10px 6px 14px`, the quality / extension / engine rows each reflow to a
4-wide grid (`flex: 1 1 calc(25% - 6px)`), keyboard hints are hidden, and — in the chart world
specifically — the sheet keeps its square corners (the shared mobile rule rounds it to 20px, so
the skin re-asserts 2px), control cells shrink to 11.5px (10px in the engine row), the corner
marks shrink to 6px so they stop touching the labels, and the chord diagram drops to 52px tall.

**Skin selection is a documented mechanism, not an implementation detail.** The active world is
`document.documentElement.dataset.skin`, persisted to `localStorage` under `im-skin`, and applied
by an inline `<script>` in `<head>` before first paint so no skin ever flashes over another. A new
skin must work through this path; nothing may select a world after render.

### Named Rules
**The Ruled-Band Rule.** The layout is bands separated by rules, not cards separated by space.
Add a band, not a floating panel.

## Elevation & Depth

**This world has no elevation.** Not "flat by default" — flat absolutely. `box-shadow: none` is
asserted on the sheet, every cell, every key, every small control, both key-down states and the
skin swatches; `--key-white-shadow`, `--key-black-shadow` and `--btn-gray-shadow` are all set to
`transparent`; `text-shadow: none` is asserted everywhere text appears. A two-plate press cannot
print a blurred penumbra, so it does not.

Depth is carried entirely by **rule weight**, a three-step ladder:
- **Heavy rule** (3px, `--rule-heavy`): the sheet's own edge and the edges of the major cells —
  header, keybed, strum, history, panels. Also the focus outline.
- **Standard rule** (2px, `--rule-w`): control-cell borders, key seams, the heading rule, the
  footer rule, slider tracks and thumbs.
- **Hairline** (1–1.5px): the diagram's internal key seams, the dashed divisions inside the
  history strip, small-control borders.

The sheet is pinned by **registration crop marks** — eight 13px ink strokes inset 7px at the four
corners — in the place a drop shadow would otherwise sit. That is this world's entire lift-off-the-
page device.

### Named Rules
**The No-Penumbra Rule.** No shadow, no glow, no gradient, no blur, no `filter` in the chart world.
If an element needs to separate from its neighbour, give it a rule; if it needs to separate from
the sheet, give it a heavier rule.

## Shapes

Square. `--radius-md` and `--radius-sm` are both `0`, and the sheet's `--radius-lg` is `2px` — a
cut edge, not a rounded one. Every cell, key, slider track, slider thumb, status dot, skin swatch
and panel is a right-angled rectangle. The keybed zeroes its padding and gaps so white-key seams
fall on exact sevenths of the width, which makes the keyboard read as a ruled diagram rather than
a stack of objects.

The one recurring non-rectangular form is the **corner mark**, a 9px shape inset 6px from a control
cell's top-right corner, and it is load-bearing rather than decorative — see Components.

Icons are authored SVG at a single stroke weight, applied as CSS masks over `--rule` so they take
ink colour and knock out to paper when their cell floods. No icon font, no unicode glyphs.

### Named Rules
**The Right-Angle Rule.** Radius is 0 everywhere except the sheet's 2px cut corner. A rounded
control is a different world's control.

## Components

### Control Cells (the primary button)
The workhorse: a labelled cell in a ruled row.
- **Shape:** perfectly square corners (0), 2px ink border.
- **Rest:** bright paper ground, ink label in condensed caps, `8px 0` padding, no shadow.
- **Engaged** (`:active` / `.pressed` / `.active`): the cell floods with plate blue and the label
  knocks out to bright paper. `transform: none` and `box-shadow: none` are asserted explicitly —
  the cell does not move, sink, or glow. Transition is `background 0.06s, color 0.06s`.
- **Corner mark:** every cell carries a 9px hollow mark inset 6px, and its shape encodes the
  control's kind — a **hollow ring for radio behaviour** (the engine choice) and a **hollow square
  for latch behaviour** (modes, qualities, extensions). On engage the mark floods to bright paper,
  border included. The square variant is applied by row scope (`#qualityRow`, `#extRow`, and the
  non-gray cells of `#engineRow`).
- **Keyboard hints** inside a cell are full-opacity and inherit the cell's colour, so they invert
  with the flood instead of disappearing into it.

### Header Cell (signature component)
The first viewport's hero, and the composition the world is built around.
- A `minmax(0, 44%) 1fr` grid with areas `"name keys" / "notes keys"`: the chord name set at
  display size on the left with the note list beneath it, and the keyboard diagram filling the
  full right column at figure scale.
- 3px ink border, bright paper ground, `8px 14px` padding, square, no shadow.

### Chord Diagram
- A 64px-tall framed figure (2px ink border), white keys divided by 1.5px ink seams, black keys as
  solid ink blocks at 6.5% width and 58% height.
- **A chord tone is a printed dot, not a lit key.** An active white key gets a 5px plate-blue dot
  via `radial-gradient` at 50%/78% — low in the key, clear of the black-key overlay. An active
  black key inverts: plate-blue ground with a 3.5px paper dot knocked out at 50%/68%.

### Keybed
- Zero padding and zero gaps (`--keybed-pad: 0px`), so white keys are separated only by 2px ink
  seams and the last seam is suppressed. Key names and hints are set in the display face.
- Pressed keys flood plate blue with names knocked out to bright paper; both key-down shadows are
  removed.
- **The black-key registration trap:** the shared `BLACK_POS` constants are tuned for the padded
  layout and print ~4% off once padding and gaps are zeroed, so this skin overrides both rows —
  *with two different sets of numbers*. `.mkey.black` carries `translateX(-50%)`, so a plain seam
  fraction centres it (14.2857 / 28.5714 / 57.1429 / 71.4286 / 85.7143%). `.key.black` does not, so
  it needs the seam minus half its 7.5% width (10.5357 / 24.8214 / 53.3929 / 67.6786 / 81.9643%).
  Any future skin that changes keybed padding or gaps inherits this trap and must supply both sets.

### Strum Plate
- Segments are cells: bright paper, 2px ink right-border (suppressed on the last), display-face
  caps at 0.1em tracking, no radius, no shadow.
- Lit segment floods plate blue with paper text; `filter: none` and `transform: none` are asserted
  so the shared skins' lift-and-glow never leaks in.

### History Strip
- Four cells inside one 3px-ruled band, divided by **1px dashed hairlines** — the only dashed rule
  in the system, and the thing that makes an empty strip read as a blank chart waiting to be
  filled rather than a void.
- Filled cells set the chord name in the display face; the current/hovered cell turns plate blue
  with `text-shadow: none`.
- Inversion controls are transparent 1.5px-ruled boxes carrying masked SVG chevrons; on hover they
  flood plate blue with the mark knocked out to paper.

### Small Controls (steppers, transport, MIDI, install)
- Printed boxes, never chrome: bright paper, 2px ink border, square, display face, no shadow.
- `:active` and latched states (`#playBtn.on`, `#midiOutBtn.active`) flood plate blue with paper
  content, with `transform: none`.
- The MIDI export control keeps its word and adds a drawn mark: a `::before` reading "MIDI" in
  10px display caps plus an 11px masked download arrow.

### Sliders
- Track: 12px tall, bright paper, 2px ink border, square. Thumb: 14×20px, square, 2px ink border,
  plate-blue fill. Specified for both WebKit and Gecko pseudo-elements.

### Focus
- **The chart world is the only skin with a focus treatment.** `:focus-visible` draws a 3px ink
  outline at `+2px` offset outside the cell.
- On a flooded control (`.obtn.active`, `.obtn.pressed`, `#playBtn.on`, `#midiOutBtn.active`) the
  ring inverts: bright paper at `-6px` offset, drawn *inside* the cell — because a plate-blue ring
  on a plate-blue flood is no ring at all.

### Named Rules
**The Knock-Out Rule.** When a surface floods, everything on it — label, corner mark, icon, focus
ring — inverts to paper. Never leave a mark in ink on a flooded cell and never let a ring share the
colour of the ground it sits on.

**The Corner-Mark Rule.** The corner mark states the control's kind before the user touches it:
ring = one-of-many, square = on/off. Do not use a corner mark decoratively and do not ship a control
whose mark contradicts its behaviour.

## Do's and Don'ts

### Do:
- **Do** add new colours as `:root` role tokens and consume them via `var(--role)`, so all six
  worlds stay overridable from one block.
- **Do** express a new world as a `:root[data-skin="…"]` role reassignment plus a `[data-skin="…"]`
  material block — and register it through `dataset.skin` + `localStorage["im-skin"]` + the inline
  pre-paint head script.
- **Do** make engaged states *more* ink: flood the plate and knock out the label.
- **Do** separate elements with rules on the 3px / 2px / 1–1.5px ladder.
- **Do** carry the display face inside the file (subset, woff2, data URI); the offline-PWA
  requirement and the artifact CSP both forbid a network font.
- **Do** supply both black-key position sets whenever a skin changes keybed padding or gaps —
  `.mkey.black` is translate-centred and `.key.black` is not.
- **Do** draw icons as authored SVG at one stroke weight, applied as a mask over the ink role so
  they invert with their cell.
- **Do** give a new skin a real `:focus-visible` treatment, and invert it to paper inside any
  surface that floods with the accent.
- **Do** hold the no-scroll budget at 1920×1080, 1440×900 and 390×844, and keep the ≤640px compact
  layout working for every new element.

### Don't:
- **Don't** introduce a shadow, glow, gradient, blur, or `filter` into the chart world. If depth is
  needed, use a heavier rule.
- **Don't** move anything on press in the chart world — no `transform`, no sink, no lift.
- **Don't** add a third ink. Ink, plate blue, and paper are the whole palette.
- **Don't** round a corner. Radius is 0 everywhere except the sheet's 2px cut edge.
- **Don't** hard-code a hex inside a component rule; it silently breaks the other five worlds.
- **Don't** use unicode glyphs or an icon font as an icon.
- **Don't** use Blank Cell grey for anything a user has to read. It is a ruled placeholder mark and
  sits deliberately below text contrast; real text uses Ink, Graphite, or Pencil Grey.
- **Don't** treat plate blue as decoration. It appears only where something is engaged, lit,
  selected, or sounding.
- **Don't** copy the other five skins' palettes as a contrast reference — four of the five fail
  WCAG AA on body text per the recorded critique, and that is a defect the contract permits, not a
  standard the contract sets.

<!-- Open, unfixed at the time of writing: the product-wide keyboard and
     assistive-technology gaps recorded in
     .impeccable/critique/2026-08-01T22-50-52Z__orchid-html.md (most controls are
     not keyboard-operable; the piano keys are not in the accessibility tree) are
     shared by all six skins and are not addressed here. The chart skin adds a
     :focus-visible treatment; the other five still have none. These are known
     defects the build carries, not properties of the design system. -->
