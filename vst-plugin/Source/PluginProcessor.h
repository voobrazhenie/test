#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_audio_utils/juce_audio_utils.h>
#include "ChordEngine.h"

// A MIDI effect: no audio in/out, just transforms incoming note-on/off into
// full chord voicings on the way out, mirroring the "hold a quality, tap a
// key" model of the web app (orchid.html) but driven by real MIDI notes
// instead of clicks, and timed to the host's tempo for ARP instead of a
// manual BPM control.
class InspirationMachineProcessor : public juce::AudioProcessor
{
public:
    InspirationMachineProcessor();
    ~InspirationMachineProcessor() override = default;

    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override {}
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    bool isMidiEffect() const override { return true; }
    bool acceptsMidi() const override { return true; }
    bool producesMidi() const override { return true; }

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return "Inspiration Machine"; }
    double getTailLengthSeconds() const override { return 0.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    // --- Chord shape, exposed as automatable/saveable parameters ---
    juce::AudioProcessorValueTreeState apvts;

    // --- Toggle key state driven directly by the UI (momentary hold /
    //     click-latch, matching the web app's quality & extension buttons).
    void setQuality (ChordEngine::Quality q);
    void setSlot (ChordEngine::Slot s);
    void setNine (bool on);
    ChordEngine::Quality getQuality() const { return currentQuality; }
    ChordEngine::Slot getSlot() const { return currentSlot; }
    bool getNine() const { return currentNine; }

    // For the editor's live display (last chord this processor generated).
    juce::String getLastChordName() const { return lastChordName; }
    std::vector<int> getLastChordNotes() const { return lastChordNotes; }

    // Lets the editor's on-screen keyboard inject notes exactly like an
    // external MIDI source would (used when there's no MIDI track feeding
    // this device, e.g. testing standalone or auditioning in the plugin UI).
    juce::MidiKeyboardState keyboardState;

private:
    ChordEngine::Params currentParams() const;

    ChordEngine::Quality currentQuality = ChordEngine::Quality::None;
    ChordEngine::Slot currentSlot = ChordEngine::Slot::None;
    bool currentNine = false;

    // input MIDI note number -> the output notes it's currently sounding.
    std::map<int, std::vector<int>> activeChords;
    // The single latched chord while HOLD is on (kept ringing after release).
    std::vector<int> latchedNotes;
    bool hasLatched = false;

    struct PendingEvent
    {
        juce::int64 sampleTime;
        int note;
        bool isOn;
        juce::uint8 velocity;
        int channel;
    };
    std::vector<PendingEvent> pending;
    juce::int64 samplesElapsed = 0;
    double currentSampleRate = 44100.0;

    juce::String lastChordName = "-";
    std::vector<int> lastChordNotes;

    void triggerChord (int rootNote, juce::uint8 velocity, int channel, juce::int64 atSample);
    void releaseInputNote (int rootNote, int channel, juce::int64 atSample);
    void stopAllRinging (int channel, juce::int64 atSample);
    void scheduleNoteOn (int note, juce::uint8 velocity, int channel, juce::int64 atSample);
    void scheduleNoteOff (int note, int channel, juce::int64 atSample);
    double hostBpm() const;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (InspirationMachineProcessor)
};
