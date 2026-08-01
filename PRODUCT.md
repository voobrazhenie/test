# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: a songwriter working at a desk, away from a DAW. They are exploring
chord progressions by ear — hunting for something that feels right rather than
executing a progression they already know — and capturing it into a project
afterwards.

Secondary (observed in the build, not confirmed by the user): the same person
later in a DAW session, where the plugin sibling in `vst-plugin/` drives an
instrument track directly.

## Product Purpose

Turn "I need a progression" into a captured progression quickly. The user plays
chords by ear, keeps what works in a short history strip, and takes it away as
MIDI — either as a dragged/downloaded `.mid` file or streamed live to a DAW over
Web MIDI. Success is the round trip from idea to captured MIDI being fast enough
that it does not interrupt writing.

## Positioning

Speed from idea to MIDI. The differentiator is not the sound engine and not the
chord theory — it is that a whole voiced chord is one gesture away, and that
anything worth keeping is already in a form a DAW accepts. Neighbouring products
either make you voice chords note by note, or generate progressions for you
rather than letting you find one.

## Operating Context

- Used at a desk, on a computer, with a mouse and/or a computer keyboard.
- Frequently used alongside a DAW; live MIDI out requires a virtual MIDI port
  (LoopBe / loopMIDI on Windows, IAC on macOS), which is a third-party setup step
  outside this product.
- Also installable as an offline PWA and runnable with no network at all.
- Sessions are short and interruptive — the user is writing, not operating a tool.

## Capabilities and Constraints

Confirmed capabilities:
- Chord model: 4 qualities (major / minor / sus / dim) × a shared seventh slot
  (6 / m7 / M7) × an independent 9, giving 32 named chords. Gesture is
  hold-a-quality, tap-a-key; a mouse click latches instead of holding.
- 7 voicings, ±2 octaves, HOLD / BASS / 1 OCT / ARP modes, 4 sound engines.
- Strum plate, 4-slot chord history with per-chord inversion controls, replay at
  a settable BPM.
- Live MIDI out with port selection and persistence; drag-out / download `.mid`
  export.
- Six selectable skins, persisted to localStorage.

Binding constraints (user-confirmed):
- The whole instrument stays visible without scrolling at 1080p and 1440p.
- Must keep working installed and offline as a PWA; no runtime network dependency.
- Live MIDI out and `.mid` export both stay.

Current implementation facts (not user-pinned as binding):
- Ships as a single self-contained `orchid.html` with no build step and no
  external dependencies. This is also what the claude.ai artifact CSP requires,
  so it is effectively load-bearing even though it was not named a commitment.

Undecided: whether the VST sibling and the web app should stay behaviourally
identical over time.

## Brand Commitments

Name: "Inspiration Machine". No logo, wordmark, typeface, or palette has been
declared binding. Earlier references to the hardware that inspired the gesture
model were deliberately removed and must not return.

## Evidence on Hand

- The working application: `orchid.html`.
- A MIDI-only VST3 port sharing the chord engine: `vst-plugin/`.
- A dual-agent design critique with measured evidence:
  `.impeccable/critique/2026-08-01T22-50-52Z__orchid-html.md` (22/40; two P0s —
  keyboard/AT operability and inverted selection state; contrast failing in four
  of five skins; 26px mobile touch targets).

No users, testimonials, usage data, benchmarks, or press exist. None may be
fabricated.

## Product Principles

1. A chord is one gesture. Anything that adds a step between intent and sound is
   a regression.
2. What you played is already captured. The user should never have to re-perform
   an idea to keep it.
3. Leaving with the idea is part of the product, not an export feature bolted on.
4. Short, interrupted sessions. State must survive being walked away from.
5. Findings over generation. The product helps the user *find* a progression; it
   does not compose one for them.

## Accessibility & Inclusion

No standard was named by the user. The critique established measured gaps that
future work should not deepen: most controls are not keyboard-operable, the
piano keys are not in the accessibility tree, there are no focus styles, and text
contrast fails WCAG AA in four of five skins.
