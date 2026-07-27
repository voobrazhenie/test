#pragma once
#include <algorithm>
#include <array>
#include <cmath>
#include <map>
#include <set>
#include <string>
#include <vector>

// Chord theory, ported 1:1 from the web app's orchid.html (QUALITY_BASE,
// SLOT_ADD, NINE_ADD, CHORD_NAMES, chordSuffix, chordIntervals,
// applyVoicing, foldToOneOctave) so this plugin produces exactly the same
// chords as the browser version. Keep the two in sync if either changes.
namespace ChordEngine
{
    enum class Quality { None, Maj, Min, Sus, Dim };
    enum class Slot { None, Six, Min7, Maj7 };

    inline std::string noteName (int pitchClass)
    {
        static const std::array<const char*, 12> names {
            "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
        };
        return names[(size_t) ((pitchClass % 12 + 12) % 12)];
    }

    inline const std::vector<int>& qualityTriad (Quality q)
    {
        static const std::vector<int> maj { 0, 4, 7 };
        static const std::vector<int> min { 0, 3, 7 };
        static const std::vector<int> sus { 0, 5, 7 };
        static const std::vector<int> dim { 0, 3, 6 };
        static const std::vector<int> none {};
        switch (q)
        {
            case Quality::Maj: return maj;
            case Quality::Min: return min;
            case Quality::Sus: return sus;
            case Quality::Dim: return dim;
            default:           return none;
        }
    }

    inline std::vector<int> slotAdd (Slot s)
    {
        switch (s)
        {
            case Slot::Six:  return { 9 };
            case Slot::Min7: return { 10 };
            case Slot::Maj7: return { 11 };
            default:         return {};
        }
    }

    constexpr int nineAdd = 14;

    // Suffix names taken verbatim from the product brief where it documents a
    // combination. A few combinations the brief leaves undocumented (minor/
    // sus/dim + 6 + 9, and sus/dim + M7 + 9) extend the brief's own pattern
    // for the cases it does name in the same family (6+9 -> ".../9"; M7+9 ->
    // trailing "7" becomes "9").
    inline std::string chordSuffix (Quality quality, Slot slot, bool nineOn)
    {
        // key: "", "6", "m7", "M7", "+9", "6+9", "m7+9", "M7+9"
        auto slotKey = [&]() -> std::string
        {
            switch (slot)
            {
                case Slot::Six:  return "6";
                case Slot::Min7: return "m7";
                case Slot::Maj7: return "M7";
                default:         return "";
            }
        }();
        std::string key = nineOn ? (slotKey.empty() ? "+9" : slotKey + "+9") : slotKey;

        static const std::map<Quality, std::map<std::string, std::string>> names {
            { Quality::Maj, { {"", ""}, {"6", "6"}, {"m7", "7"}, {"M7", "maj7"},
                              {"+9", "add9"}, {"6+9", "6/9"}, {"m7+9", "9"}, {"M7+9", "maj9"} } },
            { Quality::Min, { {"", "m"}, {"6", "m6"}, {"m7", "m7"}, {"M7", "mmaj7"},
                              {"+9", "madd9"}, {"6+9", "m6/9"}, {"m7+9", "m9"}, {"M7+9", "mmaj9"} } },
            { Quality::Sus, { {"", "sus4"}, {"6", "sus6"}, {"m7", "sus7"}, {"M7", "susmaj7"},
                              {"+9", "sus4add9"}, {"6+9", "sus6/9"}, {"m7+9", "9sus4"}, {"M7+9", "susmaj9"} } },
            { Quality::Dim, { {"", "dim"}, {"6", "dim6"}, {"m7", "m7b5"}, {"M7", "dimmaj7"},
                              {"+9", "dimadd9"}, {"6+9", "dim6/9"}, {"m7+9", "m7b5add9"}, {"M7+9", "dimmaj9"} } },
        };
        if (quality == Quality::None)
            return "";
        return names.at (quality).at (key);
    }

    inline std::vector<int> chordIntervals (Quality quality, Slot slot, bool nineOn)
    {
        auto add = slotAdd (slot);
        if (nineOn)
            add.push_back (nineAdd);
        auto out = qualityTriad (quality);
        out.insert (out.end(), add.begin(), add.end());
        return out;
    }

    // 0=Close 1=Inv1 2=Inv2 3=Drop2 4=OctUp(doubled root) 5=LowRoot 6=Wide
    inline const std::array<const char*, 7> voicingNames {
        "CLOSE", "INV 1", "INV 2", "DROP 2", "OCT UP", "LOW RT", "WIDE"
    };

    inline std::vector<int> applyVoicing (std::vector<int> notes, int voicing)
    {
        std::sort (notes.begin(), notes.end());
        if (notes.empty())
            return notes;
        int root = notes.front();
        switch (voicing)
        {
            case 0: break; // closed
            case 1: if (notes.size() > 1) notes[0] += 12; break;
            case 2: if (notes.size() > 2) { notes[0] += 12; notes[1] += 12; } break;
            case 3: if (notes.size() > 2) notes[notes.size() - 2] -= 12; break;
            case 4: notes.push_back (root + 12); break;
            case 5: notes.insert (notes.begin(), root - 12); break;
            case 6:
                if (notes.size() > 2) notes[notes.size() - 2] -= 12;
                notes.push_back (root + 12);
                break;
            default: break;
        }
        return notes;
    }

    // 1 OCT mode: shift every note by whole octaves until it falls in the same
    // labeled octave (the same C-to-B span) as the anchor (root) note.
    inline std::vector<int> foldToOneOctave (const std::vector<int>& notes, int anchor)
    {
        auto floorDiv = [] (int a, int b) { return (int) std::floor ((double) a / (double) b); };
        int targetOct = floorDiv (anchor, 12);
        std::set<int> uniq;
        std::vector<int> out;
        for (int n : notes)
        {
            int folded = n + (targetOct - floorDiv (n, 12)) * 12;
            if (uniq.insert (folded).second)
                out.push_back (folded);
        }
        return out;
    }

    struct Chord
    {
        std::string name;
        std::vector<int> notes; // MIDI note numbers, ascending
    };

    struct Params
    {
        Quality quality = Quality::None;
        Slot slot = Slot::None;
        bool nine = false;
        int voicing = 0;      // 0..6
        int octave = 0;       // -2..2
        bool bass = false;
        bool octaveLock = false;
    };

    // rootNote: the incoming MIDI note number that triggered this chord.
    inline Chord build (int rootNote, const Params& p)
    {
        Chord chord;
        int rootMidi = rootNote + p.octave * 12;
        std::vector<int> notes;
        if (p.quality != Quality::None)
        {
            auto suffix = chordSuffix (p.quality, p.slot, p.nine);
            for (int iv : chordIntervals (p.quality, p.slot, p.nine))
                notes.push_back (rootMidi + iv);
            notes = applyVoicing (notes, p.voicing);
            if (p.octaveLock)
                notes = foldToOneOctave (notes, rootMidi);
            chord.name = noteName (rootNote % 12) + suffix;
        }
        else
        {
            notes = { rootMidi };
            chord.name = noteName (rootNote % 12);
        }
        if (p.bass)
        {
            int low = rootMidi - 12;
            if (std::find (notes.begin(), notes.end(), low) == notes.end())
                notes.insert (notes.begin(), low);
        }
        std::sort (notes.begin(), notes.end());
        // Clamp to the valid MIDI note range so extreme octave/voicing
        // combinations can't produce an out-of-range note number.
        std::vector<int> clamped;
        for (int n : notes)
            if (n >= 0 && n <= 127)
                clamped.push_back (n);
        chord.notes = clamped;
        return chord;
    }
}
