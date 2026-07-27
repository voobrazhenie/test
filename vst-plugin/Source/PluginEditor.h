#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_audio_utils/juce_audio_utils.h>
#include "PluginProcessor.h"

// A hardware-panel-style button used for Quality/Extension/Mode toggles -
// deliberately plain (JUCE's default LookAndFeel) rather than a full skin,
// since the point of this plugin is the MIDI chord logic, not visual parity
// with the web app.
class ToggleTile : public juce::TextButton
{
public:
    using juce::TextButton::TextButton;
};

class InspirationMachineEditor : public juce::AudioProcessorEditor,
                                  private juce::Timer
{
public:
    explicit InspirationMachineEditor (InspirationMachineProcessor&);
    ~InspirationMachineEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    void timerCallback() override;
    void refreshQualityExtensionButtons();
    void refreshDisplay();

    InspirationMachineProcessor& processor;

    juce::Label titleLabel, chordNameLabel, chordNotesLabel;

    juce::OwnedArray<ToggleTile> qualityButtons;
    juce::OwnedArray<ToggleTile> slotButtons;
    ToggleTile nineButton { "9" };

    ToggleTile holdButton { "HOLD" }, bassButton { "BASS" }, octaveLockButton { "1 OCT" }, arpButton { "ARP" };
    std::unique_ptr<juce::AudioProcessorValueTreeState::ButtonAttachment> holdAttachment, bassAttachment, octaveLockAttachment, arpAttachment;

    juce::Label voicingLabel, octaveLabel;
    juce::TextButton voicingDown { "-" }, voicingUp { "+" }, octaveDown { "-" }, octaveUp { "+" };

    juce::MidiKeyboardComponent keyboardComponent;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (InspirationMachineEditor)
};
