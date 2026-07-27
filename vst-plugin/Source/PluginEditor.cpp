#include "PluginEditor.h"

namespace
{
    constexpr int qualityCount = 4;
    const char* qualityLabels[qualityCount] = { "MAJOR", "MINOR", "SUS", "DIM" };
    const ChordEngine::Quality qualityValues[qualityCount] = {
        ChordEngine::Quality::Maj, ChordEngine::Quality::Min, ChordEngine::Quality::Sus, ChordEngine::Quality::Dim
    };

    constexpr int slotCount = 3;
    const char* slotLabels[slotCount] = { "6", "m7", "M7" };
    const ChordEngine::Slot slotValues[slotCount] = {
        ChordEngine::Slot::Six, ChordEngine::Slot::Min7, ChordEngine::Slot::Maj7
    };
}

InspirationMachineEditor::InspirationMachineEditor (InspirationMachineProcessor& p)
    : AudioProcessorEditor (&p), processor (p),
      keyboardComponent (p.keyboardState, juce::MidiKeyboardComponent::horizontalKeyboard)
{
    titleLabel.setText ("INSPIRATION MACHINE - MIDI", juce::dontSendNotification);
    titleLabel.setFont (juce::Font (16.0f, juce::Font::bold));
    addAndMakeVisible (titleLabel);

    chordNameLabel.setFont (juce::Font (26.0f, juce::Font::bold));
    chordNameLabel.setJustificationType (juce::Justification::centredLeft);
    addAndMakeVisible (chordNameLabel);

    chordNotesLabel.setFont (juce::Font (13.0f));
    chordNotesLabel.setJustificationType (juce::Justification::centredLeft);
    addAndMakeVisible (chordNotesLabel);

    for (int i = 0; i < qualityCount; ++i)
    {
        auto* b = qualityButtons.add (new ToggleTile (qualityLabels[i]));
        addAndMakeVisible (b);
        b->onClick = [this, i]
        {
            auto q = processor.getQuality() == qualityValues[i] ? ChordEngine::Quality::None : qualityValues[i];
            processor.setQuality (q);
            refreshQualityExtensionButtons();
        };
    }

    for (int i = 0; i < slotCount; ++i)
    {
        auto* b = slotButtons.add (new ToggleTile (slotLabels[i]));
        addAndMakeVisible (b);
        b->onClick = [this, i]
        {
            auto s = processor.getSlot() == slotValues[i] ? ChordEngine::Slot::None : slotValues[i];
            processor.setSlot (s);
            refreshQualityExtensionButtons();
        };
    }

    addAndMakeVisible (nineButton);
    nineButton.onClick = [this]
    {
        processor.setNine (! processor.getNine());
        refreshQualityExtensionButtons();
    };

    auto& apvts = processor.apvts;
    for (auto* b : { &holdButton, &bassButton, &octaveLockButton, &arpButton })
        addAndMakeVisible (b);
    holdAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ButtonAttachment> (apvts, "hold", holdButton);
    bassAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ButtonAttachment> (apvts, "bass", bassButton);
    octaveLockAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ButtonAttachment> (apvts, "octaveLock", octaveLockButton);
    arpAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ButtonAttachment> (apvts, "arp", arpButton);

    voicingLabel.setJustificationType (juce::Justification::centred);
    octaveLabel.setJustificationType (juce::Justification::centred);
    addAndMakeVisible (voicingLabel);
    addAndMakeVisible (octaveLabel);
    for (auto* b : { &voicingDown, &voicingUp, &octaveDown, &octaveUp })
        addAndMakeVisible (b);

    voicingDown.onClick = [this]
    {
        if (auto* param = dynamic_cast<juce::AudioParameterChoice*> (processor.apvts.getParameter ("voicing")))
            *param = juce::jmax (0, param->getIndex() - 1);
    };
    voicingUp.onClick = [this]
    {
        if (auto* param = dynamic_cast<juce::AudioParameterChoice*> (processor.apvts.getParameter ("voicing")))
            *param = juce::jmin ((int) ChordEngine::voicingNames.size() - 1, param->getIndex() + 1);
    };
    octaveDown.onClick = [this]
    {
        if (auto* param = dynamic_cast<juce::AudioParameterInt*> (processor.apvts.getParameter ("octave")))
            *param = juce::jmax (-2, param->get() - 1);
    };
    octaveUp.onClick = [this]
    {
        if (auto* param = dynamic_cast<juce::AudioParameterInt*> (processor.apvts.getParameter ("octave")))
            *param = juce::jmin (2, param->get() + 1);
    };

    addAndMakeVisible (keyboardComponent);
    keyboardComponent.setAvailableRange (36, 96);
    keyboardComponent.setOctaveForMiddleC (4);

    refreshQualityExtensionButtons();
    refreshDisplay();
    setSize (760, 480);
    startTimerHz (15);
}

InspirationMachineEditor::~InspirationMachineEditor()
{
    stopTimer();
}

void InspirationMachineEditor::refreshQualityExtensionButtons()
{
    for (int i = 0; i < qualityCount; ++i)
        qualityButtons[i]->setToggleState (processor.getQuality() == qualityValues[i], juce::dontSendNotification);
    for (int i = 0; i < slotCount; ++i)
        slotButtons[i]->setToggleState (processor.getSlot() == slotValues[i], juce::dontSendNotification);
    nineButton.setToggleState (processor.getNine(), juce::dontSendNotification);
}

void InspirationMachineEditor::refreshDisplay()
{
    chordNameLabel.setText (processor.getLastChordName(), juce::dontSendNotification);

    auto notes = processor.getLastChordNotes();
    juce::String notesStr;
    for (int n : notes)
    {
        if (notesStr.isNotEmpty())
            notesStr << " ";
        notesStr << ChordEngine::noteName (n % 12) << juce::String (n / 12 - 1);
    }
    chordNotesLabel.setText (notesStr, juce::dontSendNotification);

    if (auto* param = dynamic_cast<juce::AudioParameterChoice*> (processor.apvts.getParameter ("voicing")))
        voicingLabel.setText (param->getCurrentChoiceName(), juce::dontSendNotification);
    if (auto* param = dynamic_cast<juce::AudioParameterInt*> (processor.apvts.getParameter ("octave")))
        octaveLabel.setText (juce::String (param->get()), juce::dontSendNotification);
}

void InspirationMachineEditor::timerCallback()
{
    refreshDisplay();
}

void InspirationMachineEditor::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colour (0xff211f1a));
}

void InspirationMachineEditor::resized()
{
    auto r = getLocalBounds().reduced (16);

    titleLabel.setBounds (r.removeFromTop (24));
    r.removeFromTop (8);

    auto display = r.removeFromTop (56);
    chordNameLabel.setBounds (display.removeFromTop (32));
    chordNotesLabel.setBounds (display);
    r.removeFromTop (10);

    auto qualityRow = r.removeFromTop (36);
    for (int i = 0; i < qualityButtons.size(); ++i)
    {
        qualityButtons[i]->setBounds (qualityRow.removeFromLeft (qualityRow.getWidth() / (qualityButtons.size() - i)));
        qualityRow.removeFromLeft (6);
    }
    r.removeFromTop (8);

    auto slotRow = r.removeFromTop (36);
    int slotAndNine = slotCount + 1;
    for (int i = 0; i < slotCount; ++i)
    {
        slotButtons[i]->setBounds (slotRow.removeFromLeft (slotRow.getWidth() / (slotAndNine - i)));
        slotRow.removeFromLeft (6);
    }
    nineButton.setBounds (slotRow);
    r.removeFromTop (8);

    auto modeRow = r.removeFromTop (36);
    juce::Array<juce::Component*> modeButtons { &holdButton, &bassButton, &octaveLockButton, &arpButton };
    for (int i = 0; i < modeButtons.size(); ++i)
    {
        modeButtons[i]->setBounds (modeRow.removeFromLeft (modeRow.getWidth() / (modeButtons.size() - i)));
        modeRow.removeFromLeft (6);
    }
    r.removeFromTop (8);

    auto stepperRow = r.removeFromTop (32);
    auto voicingBlock = stepperRow.removeFromLeft (stepperRow.getWidth() / 2 - 6);
    stepperRow.removeFromLeft (12);
    auto octaveBlock = stepperRow;

    voicingDown.setBounds (voicingBlock.removeFromLeft (32));
    voicingUp.setBounds (voicingBlock.removeFromRight (32));
    voicingLabel.setBounds (voicingBlock);

    octaveDown.setBounds (octaveBlock.removeFromLeft (32));
    octaveUp.setBounds (octaveBlock.removeFromRight (32));
    octaveLabel.setBounds (octaveBlock);

    r.removeFromTop (12);
    keyboardComponent.setBounds (r.removeFromTop (juce::jmin (120, r.getHeight())));
}
