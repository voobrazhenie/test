#include "PluginProcessor.h"
#include "PluginEditor.h"

namespace
{
    juce::AudioProcessorValueTreeState::ParameterLayout createLayout()
    {
        using namespace juce;
        std::vector<std::unique_ptr<RangedAudioParameter>> params;

        StringArray voicingChoices;
        for (auto* n : ChordEngine::voicingNames)
            voicingChoices.add (n);
        params.push_back (std::make_unique<AudioParameterChoice> (
            ParameterID { "voicing", 1 }, "Voicing", voicingChoices, 0));

        params.push_back (std::make_unique<AudioParameterInt> (
            ParameterID { "octave", 1 }, "Octave", -2, 2, 0));

        params.push_back (std::make_unique<AudioParameterBool> (
            ParameterID { "hold", 1 }, "Hold", false));
        params.push_back (std::make_unique<AudioParameterBool> (
            ParameterID { "bass", 1 }, "Bass", false));
        params.push_back (std::make_unique<AudioParameterBool> (
            ParameterID { "octaveLock", 1 }, "1 Oct", false));
        params.push_back (std::make_unique<AudioParameterBool> (
            ParameterID { "arp", 1 }, "Arp", false));

        return { params.begin(), params.end() };
    }
}

InspirationMachineProcessor::InspirationMachineProcessor()
    : AudioProcessor (BusesProperties()) // no audio buses - MIDI effect only
    , apvts (*this, nullptr, "PARAMS", createLayout())
{
}

void InspirationMachineProcessor::prepareToPlay (double sampleRate, int)
{
    currentSampleRate = sampleRate;
    samplesElapsed = 0;
    pending.clear();
    activeChords.clear();
    hasLatched = false;
    latchedNotes.clear();
    keyboardState.reset();
}

ChordEngine::Params InspirationMachineProcessor::currentParams() const
{
    ChordEngine::Params p;
    p.quality = currentQuality;
    p.slot = currentSlot;
    p.nine = currentNine;
    p.voicing = (int) apvts.getRawParameterValue ("voicing")->load();
    p.octave = (int) apvts.getRawParameterValue ("octave")->load();
    p.bass = apvts.getRawParameterValue ("bass")->load() > 0.5f;
    p.octaveLock = apvts.getRawParameterValue ("octaveLock")->load() > 0.5f;
    return p;
}

void InspirationMachineProcessor::setQuality (ChordEngine::Quality q)
{
    currentQuality = q;
}
void InspirationMachineProcessor::setSlot (ChordEngine::Slot s)
{
    currentSlot = s;
}
void InspirationMachineProcessor::setNine (bool on)
{
    currentNine = on;
}

double InspirationMachineProcessor::hostBpm() const
{
    if (auto* ph = getPlayHead())
    {
        if (auto pos = ph->getPosition())
            if (auto bpm = pos->getBpm())
                return *bpm;
    }
    return 120.0;
}

void InspirationMachineProcessor::scheduleNoteOn (int note, juce::uint8 velocity, int channel, juce::int64 atSample)
{
    if (note < 0 || note > 127)
        return;
    pending.push_back ({ atSample, note, true, velocity, channel });
}

void InspirationMachineProcessor::scheduleNoteOff (int note, int channel, juce::int64 atSample)
{
    if (note < 0 || note > 127)
        return;
    pending.push_back ({ atSample, note, false, 0, channel });
}

// Stops everything currently ringing (sounding notes get an immediate
// note-off; not-yet-fired ARP-staggered notes are cancelled outright rather
// than being allowed to fire and then instantly cut - the MIDI equivalent
// of the "silence before onset" fix in the web version's audio engine).
void InspirationMachineProcessor::stopAllRinging (int channel, juce::int64 atSample)
{
    auto cancelOrRelease = [&] (const std::vector<int>& notes)
    {
        for (int n : notes)
        {
            auto it = std::find_if (pending.begin(), pending.end(), [&] (const PendingEvent& e) {
                return e.isOn && e.note == n && e.channel == channel;
            });
            if (it != pending.end())
                pending.erase (it); // never fired - just cancel it
            else
                scheduleNoteOff (n, channel, atSample); // already sounding - release it now
        }
    };
    for (auto& kv : activeChords)
        cancelOrRelease (kv.second);
    activeChords.clear();
    if (hasLatched)
        cancelOrRelease (latchedNotes);
    hasLatched = false;
    latchedNotes.clear();
}

void InspirationMachineProcessor::triggerChord (int rootNote, juce::uint8 velocity, int channel, juce::int64 atSample)
{
    auto params = currentParams();
    bool arpOn = apvts.getRawParameterValue ("arp")->load() > 0.5f;
    bool holdOn = apvts.getRawParameterValue ("hold")->load() > 0.5f;

    if (arpOn)
        stopAllRinging (channel, atSample); // monophonic: new note steals from whatever's ringing
    else if (holdOn && hasLatched)
    {
        for (int n : latchedNotes)
            scheduleNoteOff (n, channel, atSample);
        hasLatched = false;
        latchedNotes.clear();
    }

    auto chord = ChordEngine::build (rootNote, params);
    lastChordName = chord.name;
    lastChordNotes = chord.notes;

    double stepSeconds = arpOn ? (60.0 / juce::jmax (20.0, hostBpm()) / 4.0) : 0.0;
    juce::int64 stepSamples = (juce::int64) std::llround (stepSeconds * currentSampleRate);

    for (size_t i = 0; i < chord.notes.size(); ++i)
        scheduleNoteOn (chord.notes[i], velocity, channel, atSample + (juce::int64) i * stepSamples);

    activeChords[rootNote] = chord.notes;
}

void InspirationMachineProcessor::releaseInputNote (int rootNote, int channel, juce::int64 atSample)
{
    auto it = activeChords.find (rootNote);
    if (it == activeChords.end())
        return;
    auto notes = it->second;
    activeChords.erase (it);

    bool holdOn = apvts.getRawParameterValue ("hold")->load() > 0.5f;
    if (holdOn)
    {
        // Keep ringing; releaseLatched (on the next note-on) or a manual
        // stop will end it later - matches the web app's HOLD behavior.
        latchedNotes = notes;
        hasLatched = true;
        return;
    }
    for (int n : notes)
        scheduleNoteOff (n, channel, atSample);
}

void InspirationMachineProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    juce::ScopedNoDenormals noDenormals;
    buffer.clear(); // no audio; MIDI-only

    const int numSamples = buffer.getNumSamples();

    // Let the on-screen keyboard inject notes exactly as if they arrived
    // from the host, merged into the same buffer we're about to scan.
    keyboardState.processNextMidiBuffer (midiMessages, 0, numSamples, true);

    juce::MidiBuffer output;

    for (const auto metadata : midiMessages)
    {
        auto msg = metadata.getMessage();
        auto atSample = samplesElapsed + metadata.samplePosition;

        if (msg.isNoteOn())
            triggerChord (msg.getNoteNumber(), msg.getVelocity(), msg.getChannel(), atSample);
        else if (msg.isNoteOff())
            releaseInputNote (msg.getNoteNumber(), msg.getChannel(), atSample);
        else
            output.addEvent (msg, metadata.samplePosition); // pass through CC/pitchbend/etc.
    }

    // Drain any pending (possibly ARP-staggered) events that land in this block.
    const juce::int64 blockStart = samplesElapsed;
    const juce::int64 blockEnd = samplesElapsed + numSamples;
    for (auto pIt = pending.begin(); pIt != pending.end(); )
    {
        if (pIt->sampleTime < blockEnd)
        {
            int pos = (int) juce::jlimit<juce::int64> (0, numSamples - 1, pIt->sampleTime - blockStart);
            if (pIt->isOn)
                output.addEvent (juce::MidiMessage::noteOn (pIt->channel, pIt->note, pIt->velocity), pos);
            else
                output.addEvent (juce::MidiMessage::noteOff (pIt->channel, pIt->note), pos);
            pIt = pending.erase (pIt);
        }
        else
        {
            ++pIt;
        }
    }

    midiMessages.swapWith (output);
    samplesElapsed += numSamples;
}

void InspirationMachineProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();
    state.setProperty ("quality", (int) currentQuality, nullptr);
    state.setProperty ("slot", (int) currentSlot, nullptr);
    state.setProperty ("nine", currentNine, nullptr);
    if (auto xml = state.createXml())
        copyXmlToBinary (*xml, destData);
}

void InspirationMachineProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    if (auto xml = getXmlFromBinary (data, sizeInBytes))
    {
        auto state = juce::ValueTree::fromXml (*xml);
        if (state.isValid())
        {
            apvts.replaceState (state);
            currentQuality = (ChordEngine::Quality) (int) state.getProperty ("quality", 0);
            currentSlot = (ChordEngine::Slot) (int) state.getProperty ("slot", 0);
            currentNine = (bool) state.getProperty ("nine", false);
        }
    }
}

juce::AudioProcessorEditor* InspirationMachineProcessor::createEditor()
{
    return new InspirationMachineEditor (*this);
}

// This creates the instances of the plugin.
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new InspirationMachineProcessor();
}
