# Inspiration Machine — MIDI (VST3 plugin)

A MIDI-effect version of the [Inspiration Machine](../orchid.html) web app: the
same "hold a chord quality, tap a key" chord engine, but instead of
synthesizing sound, it turns an incoming MIDI note into a full chord's worth
of MIDI notes for whatever instrument you put after it in your DAW. It
generates no audio at all — insert it before an instrument track (or a
sampler/synth plugin) in Ableton Live and it drives that instrument.

Compared to the web app, this version drops everything that only makes sense
in a browser: the SOUND section (E.PIANO/SYNTH/PAD/PLUCK — there's nothing to
synthesize), the MIDI OUT section (your DAW's own routing replaces the
virtual MIDI port dance), and BPM/PLAY/MIDI-export/Volume/Reverb (the host
transport and mixer already do all of that). ARP now follows your **host's
tempo** automatically instead of a manual BPM control.

## What's kept

- Chord Quality (Major/Minor/Sus/Dim) and Extensions (6/m7/M7/9) — click to
  select, exactly the same 32-chord-name theory as the web app (same tables,
  ported 1:1 into `Source/ChordEngine.h`).
- Voicing (Close/Inv 1/Inv 2/Drop 2/Oct Up/Low Root/Wide) and Octave steppers.
- HOLD (latch the chord so it keeps ringing after you release the key),
  BASS (add a low root note), 1 OCT (fold the chord into one octave span),
  ARP (arpeggiate the chord's notes instead of triggering them together,
  timed to your host's BPM; monophonic — playing a new note stops whatever's
  still ringing, just like the web version).
- An on-screen keyboard so you can play chords directly in the plugin window
  even with no MIDI track feeding it.

## How it works

This is a **MIDI effect** plugin (`isMidiEffect`), not an instrument — it has
no audio inputs or outputs. Feed it a note (from a MIDI clip, a connected
keyboard, or its own on-screen keyboard) and it substitutes that single note
for the full chord on the way out, using whichever Quality/Extension/Voicing/
Octave/mode buttons are currently engaged in its UI. Releasing the note
releases the chord (or latches it, if HOLD is on).

## Building it

You'll need [CMake](https://cmake.org) 3.22+ and a C++ toolchain. The build
fetches [JUCE](https://github.com/juce-framework/JUCE) automatically via
CMake's `FetchContent` — no manual framework download needed, just network
access on first configure.

```sh
cd vst-plugin
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j
```

This produces both a VST3 plugin and a Standalone app (handy for auditioning
the chord engine without opening a DAW at all):

- **macOS**: `build/InspirationMachineMIDI_artefacts/Release/VST3/Inspiration Machine MIDI.vst3`
- **Windows**: `build\InspirationMachineMIDI_artefacts\Release\VST3\Inspiration Machine MIDI.vst3`

Copy the `.vst3` bundle into your system's VST3 folder if CMake/your IDE
didn't already install it there:

- **macOS**: `~/Library/Audio/Plug-Ins/VST3/` (or `/Library/Audio/Plug-Ins/VST3/` for all users)
- **Windows**: `C:\Program Files\Common Files\VST3\`

Then in Ableton Live: rescan plugins (Preferences → Plug-Ins) and drag
**Inspiration Machine MIDI** onto a MIDI track, *before* an instrument (Live
11+ supports VST3 MIDI effects as ordinary devices in the MIDI effects
section of the device chain).

### Xcode / Visual Studio

`cmake -B build` also accepts a generator, e.g. `-G Xcode` or
`-G "Visual Studio 17 2022"`, if you'd rather open a project and build/debug
from the IDE instead of the command line.

## Verified so far

The chord engine (`ChordEngine.h`) is unit-tested against the same 32 chord
names as the web app (all pass) plus interval/voicing/bass/1-OCT sanity
checks. The full plugin (VST3 + Standalone) was built and smoke-tested in
Linux CI here to confirm the JUCE integration, UI layout, and MIDI scheduling
all compile and run without crashing — but it hasn't been tested inside
Ableton itself (this environment can't run Ableton or produce a macOS/Windows
binary), so please treat first use in Live as a first real-world test, and
report back anything that doesn't behave as expected.
