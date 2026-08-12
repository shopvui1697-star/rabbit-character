# Guided Mode - Step-by-Step Voice Assistant

This document explains how Guided Mode works when a user says **"guide me"**.

---

## Table of Contents

1. [Overview](#overview)
2. [User Experience](#user-experience)
3. [Complete Flow Diagram](#complete-flow-diagram)
4. [Architecture Deep Dive](#architecture-deep-dive)
5. [State Machine](#state-machine)
6. [Voice Commands](#voice-commands)
7. [Implementation Guide](#implementation-guide)
8. [Troubleshooting](#troubleshooting)

---

## Overview

**Guided Mode** is a step-by-step voice assistant that walks users through filling out forms. When the user says "guide me", the AI:

1. **Scans** all interactive elements on the page (inputs, checkboxes, buttons)
2. **Builds** a question sequence
3. **Asks** one question at a time
4. **Waits** for the user's answer
5. **Fills** the field with the answer
6. **Moves** to the next step
7. **Completes** when all steps are done

### Key Differences from Normal Mode

| Aspect          | Normal Mode          | Guided Mode           |
|-----------------|----------------------|-----------------------|
| **Input**       | "my name is Honda"   | Just "Honda"          |
| **Control**     | User drives          | AI drives             |
| **Parsing**     | Full NLU pipeline    | Direct answer capture |
| **Navigation**  | Jump to any field    | Step-by-step only     |
| **Visual**      | Standard UI          | Purple "GUIDED" badge |

---

## User Experience

### Example Conversation

```
👤 User clicks microphone
🤖 "Voice assistant enabled. Say 'guide me' for step-by-step help."

👤 "guide me"

🤖 "Starting guided mode. I will walk you through 2 fields.
     You can say 'skip' to skip a field, 'back' to go back,
     or 'cancel' to stop."

🧭 "Step 1 of 4. What is your Username?"
👤 "Honda"
🧭 "Got it! Username set to Honda."

🧭 "Step 2 of 4. What is your Password?"
👤 "one two three four"
🧭 "Got it! Password set to 4 characters."
     ↑ Passwords are masked in speech

🧭 "Step 3 of 4. Would you like to enable 'Remember me'?
     It is currently unchecked. Say yes or no."
👤 "no"
🧭 "Remember me left unchecked."

🧭 "Step 4 of 4. Would you like to click 'Login'?"
👤 "yes"
🧭 "Clicking Login."

🧭 "Guided mode complete! I filled 2 of 2 fields.
     You can continue using voice commands normally."
```

### Visual Indicators

When guided mode is active:

- **Voice panel**: Purple "GUIDED" badge appears
- **Mic button**: Turns purple with purple glow
- **Status text**: Shows "Guided Mode - Listening..."
- **Conversation bubbles**: Guided questions show with 🧭 icon

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER SAYS "GUIDE ME"                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NLU ENGINE                                    │
│  src/ai/NLUEngine.ts                                            │
│                                                                  │
│  Pattern matched:                                               │
│    /^(?:guide\s*me|guide\s*through|walk\s*me\s*through...)$/i  │
│                                                                  │
│  Returns:                                                        │
│    {                                                             │
│      intent: "guide",                                           │
│      confidence: 0.8,                                           │
│      entities: {}                                               │
│    }                                                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ACTION EXECUTOR                               │
│  src/ai/ActionExecutor.ts                                       │
│                                                                  │
│  execute(nluResult):                                            │
│    case 'guide':                                                │
│      // Special signal for AIProvider                           │
│      return {                                                    │
│        success: true,                                           │
│        message: "__START_GUIDED_MODE__",                        │
│        shouldSpeak: false                                       │
│      };                                                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI PROVIDER                                  │
│  src/ai/AIProvider.tsx                                          │
│                                                                 │
│  processUtterance(text):                                        │
│    const nluResult = await NLUEngine.parse(text);               │
│                                                                 │
│    // Check for guided mode signal                              │
│    if (nluResult.intent === 'guide') {                          │
│      await startGuidedMode();                                   │
│      return;                                                    │
│    }                                                            │
│    ...                                                          │
│                                                                 │
│  startGuidedMode():                                             │
│    setIsGuidedMode(true);                                       │
│    await GuidedMode.start();                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GUIDED MODE ENGINE                            │
│  src/ai/GuidedMode.ts                                           │
│                                                                  │
│  start():                                                        │
│    1. Scan UIRegistry for all elements                          │
│    2. Build step list (inputs → selects → checkboxes → btns)   │
│    3. Emit 'start' event                                        │
│    4. Speak welcome message                                     │
│    5. Ask first question                                        │
│                                                                  │
│  Step building order:                                           │
│    ┌─────────────────────────────────────────┐                 │
│    │ 1. Input/Textarea fields                │                 │
│    │    "What is your {label}?"              │                 │
│    ├─────────────────────────────────────────┤                 │
│    │ 2. Select dropdowns                     │                 │
│    │    "For {label}, which option? ..."     │                 │
│    ├─────────────────────────────────────────┤                 │
│    │ 3. Checkboxes/Radios                    │                 │
│    │    "Would you like to enable {label}?"  │                 │
│    ├─────────────────────────────────────────┤                 │
│    │ 4. Buttons (confirmation)               │                 │
│    │    "Would you like to click {label}?"   │                 │
│    └─────────────────────────────────────────┘                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ askCurrentQuestion()
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VOICE ENGINE (TTS)                            │
│                                                                  │
│  speak("Step 1 of 4. What is your Username?")                  │
│    - Mutes microphone                                           │
│    - Synthesizes speech                                         │
│    - Waits 1200ms cooldown                                      │
│    - Unmutes microphone                                         │
│                                                                  │
│  Status: waiting                                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ User answers
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VOICE RECOGNITION                             │
│                                                                  │
│  User speaks: "Honda"                                           │
│  Transcript: "Honda"                                            │
│  isFinal: true                                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI PROVIDER                                   │
│                                                                  │
│  onResult("Honda", true):                                       │
│    // *** KEY ROUTING DECISION ***                              │
│    if (GuidedMode.isActive()) {                                 │
│      // Route to guided mode instead of NLU!                    │
│      await processGuidedAnswer("Honda");                        │
│      return;                                                     │
│    }                                                             │
│    // Normal mode would go to NLU here                          │
│                                                                  │
│  processGuidedAnswer("Honda"):                                  │
│    addConversationEntry('user', "Honda");                       │
│    await GuidedMode.handleAnswer("Honda");                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GUIDED MODE ENGINE                            │
│                                                                  │
│  handleAnswer("Honda"):                                         │
│    const cleaned = "honda";                                     │
│                                                                  │
│    // Check for control commands                                │
│    if (CANCEL_WORDS.includes(cleaned)) {                        │
│      await cancel();                                            │
│      return;                                                     │
│    }                                                             │
│    if (SKIP_WORDS.includes(cleaned)) {                          │
│      await skipCurrent();                                       │
│      return;                                                     │
│    }                                                             │
│    if (BACK_WORDS.includes(cleaned)) {                          │
│      await goBack();                                            │
│      return;                                                     │
│    }                                                             │
│                                                                  │
│    // Process answer based on current step type                 │
│    const step = steps[currentStepIndex];                        │
│    switch (step.type) {                                         │
│      case 'fill':                                               │
│        await handleFillAnswer(step, "Honda");                   │
│        break;                                                    │
│      case 'toggle':                                             │
│        await handleToggleAnswer(step, cleaned);                 │
│        break;                                                    │
│      case 'confirm':                                            │
│        await handleConfirmAnswer(step, cleaned);                │
│        break;                                                    │
│    }                                                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    HANDLE FILL ANSWER                            │
│                                                                  │
│  handleFillAnswer(step, "Honda"):                               │
│    let value = "Honda";                                         │
│                                                                  │
│    // Clean up spaced numbers: "1 2 3 4" → "1234"              │
│    value = value.replace(/(\d)\s+(?=\d)/g, '$1');              │
│                                                                  │
│    // Set the value via UIRegistry                              │
│    step.element.setValue(value);  // Calls setUsername("Honda")│
│                                                                  │
│    // Mark step as completed                                    │
│    step.completed = true;                                       │
│    step.answer = value;                                         │
│                                                                  │
│    // Generate confirmation message                             │
│    const spokenValue = step.element.inputType === 'password'   │
│      ? `${value.length} characters`  // Mask passwords         │
│      : `"${value}"`;                                            │
│                                                                  │
│    const msg = `Got it! ${step.element.label} set to           │
│                 ${spokenValue}.`;                               │
│                                                                  │
│    // Emit event and speak                                      │
│    emit({ type: 'fill', step, message: msg });                 │
│    await VoiceEngine.speak(msg);                                │
│                                                                  │
│    // Move to next step                                         │
│    await moveToNextStep();                                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MOVE TO NEXT STEP                             │
│                                                                  │
│  moveToNextStep():                                              │
│    currentStepIndex++;                                          │
│                                                                  │
│    if (currentStepIndex >= steps.length) {                      │
│      await complete();  // All done!                            │
│      return;                                                     │
│    }                                                             │
│                                                                  │
│    await askCurrentQuestion();  // Ask next question            │
│                                                                  │
│  askCurrentQuestion():                                          │
│    const step = steps[currentStepIndex];                        │
│    const progress = `Step ${currentStepIndex + 1} of           │
│                      ${steps.length}.`;                         │
│    const question = `${progress} ${step.question}`;            │
│                                                                  │
│    emit({ type: 'ask', step, message: question });             │
│    await VoiceEngine.speak(question);                           │
│    status = 'waiting';  // Wait for user's answer               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture Deep Dive

### File Structure

```
src/ai/
├── GuidedMode.ts          ← NEW: State machine for guided flow
├── AIProvider.tsx         ← MODIFIED: Routes voice to GuidedMode
├── NLUEngine.ts           ← MODIFIED: Added "guide" intent
├── ActionExecutor.ts      ← MODIFIED: Returns __START_GUIDED_MODE__
├── VoiceEngine.ts         ← Unchanged (muting already works)
└── UIRegistry.ts          ← Unchanged (already scans elements)

src/components/
└── VoiceIndicator.tsx     ← MODIFIED: Shows guided mode state
```

### GuidedMode.ts - Core Engine

```typescript
// Types
export type GuidedStepType = 'fill' | 'toggle' | 'confirm';

export interface GuidedStep {
  element: UIElement;     // Reference to UI element
  type: GuidedStepType;   // What kind of question
  question: string;       // Generated question text
  completed: boolean;     // Has user answered?
  skipped: boolean;       // Did user skip?
  answer?: string;        // User's answer
}

// State
class GuidedModeClass {
  private steps: GuidedStep[] = [];
  private currentStepIndex = 0;
  private status: GuidedModeStatus = 'idle';
  private listeners = new Set<GuidedModeListener>();
  
  // Main methods
  async start() { ... }
  async handleAnswer(text: string) { ... }
  async cancel() { ... }
  
  // Step handlers
  private async handleFillAnswer(step, text) { ... }
  private async handleToggleAnswer(step, text) { ... }
  private async handleConfirmAnswer(step, text) { ... }
  
  // Navigation
  private async askCurrentQuestion() { ... }
  private async moveToNextStep() { ... }
  private async skipCurrent() { ... }
  private async goBack() { ... }
  private async complete() { ... }
}
```

---

## State Machine

### States

```
     ┌──────┐
     │ idle │  ← Default state, guided mode not active
     └───┬──┘
         │ start()
         ▼
    ┌─────────┐
    │ asking  │  ← Generating question, about to speak
    └────┬────┘
         │ VoiceEngine.speak() completes
         ▼
   ┌──────────┐
   │ waiting  │  ← Listening for user's answer
   └─────┬────┘
         │ handleAnswer() called
         ▼
  ┌────────────┐
  │ processing │  ← Filling field, preparing next step
  └──────┬─────┘
         │
         ├─ More steps? → back to 'asking'
         │
         └─ No more steps? → complete()
                ▼
           ┌──────────┐
           │ complete │  ← All steps done, reset to idle
           └──────────┘
```

### State Transitions

```typescript
// Normal flow
idle → asking → waiting → processing → asking → ... → complete → idle

// User says "skip"
waiting → processing (skipCurrent) → asking

// User says "back"
waiting → processing (goBack) → asking

// User says "cancel"
any state → idle (cancel)

// Error
any state → idle (emit error event)
```

---

## Voice Commands

### Control Commands

```typescript
const YES_WORDS = [
  'yes', 'yeah', 'yep', 'sure', 'ok', 'okay',
  'yea', 'affirmative', 'correct', 'right',
  'true', 'please', 'do it'
];

const NO_WORDS = [
  'no', 'nah', 'nope', "don't", 'negative',
  'false', 'skip it'
];

const SKIP_WORDS = [
  'skip', 'next', 'pass', 'skip it', 'next one'
];

const BACK_WORDS = [
  'back', 'previous', 'go back', 'undo', 'last one'
];

const CANCEL_WORDS = [
  'cancel', 'stop', 'quit', 'exit',
  'nevermind', 'never mind', 'stop guide', 'cancel guide'
];
```

### Answer Processing

```typescript
async handleAnswer(text: string) {
  const cleaned = text.trim().toLowerCase();
  
  // 1. Check for control commands first
  if (CANCEL_WORDS.some(w => cleaned === w)) {
    await this.cancel();
    return;
  }
  
  if (SKIP_WORDS.some(w => cleaned === w)) {
    await this.skipCurrent();
    return;
  }
  
  if (BACK_WORDS.some(w => cleaned === w)) {
    await this.goBack();
    return;
  }
  
  // 2. Process as answer based on step type
  const step = this.steps[this.currentStepIndex];
  
  switch (step.type) {
    case 'fill':
      // Any text is the value
      await this.handleFillAnswer(step, text);
      break;
      
    case 'toggle':
      // Must be yes/no
      const isYes = YES_WORDS.some(w => cleaned.startsWith(w));
      const isNo = NO_WORDS.some(w => cleaned.startsWith(w));
      
      if (!isYes && !isNo) {
        // Re-ask the question
        await VoiceEngine.speak("Please say yes or no.");
        return;
      }
      
      await this.handleToggleAnswer(step, cleaned);
      break;
      
    case 'confirm':
      // Must be yes/no
      await this.handleConfirmAnswer(step, cleaned);
      break;
  }
}
```

---

## Implementation Guide

### How to Make Your Form Guided-Mode Ready

Your form is automatically guided-mode ready if you use AI-aware components! No extra work needed.

```tsx
// This form works in both normal mode and guided mode
function MyForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subscribe, setSubscribe] = useState(false);
  
  return (
    <>
      <AIInput
        id="name"
        label="Full Name"
        value={name}
        onChange={setName}
        aiHints={["name", "full name", "my name"]}
      />
      
      <AIInput
        id="email"
        label="Email Address"
        type="email"
        value={email}
        onChange={setEmail}
        aiHints={["email", "email address", "my email"]}
      />
      
      <AICheckbox
        id="subscribe"
        label="Subscribe to newsletter"
        checked={subscribe}
        onChange={setSubscribe}
        aiHints={["subscribe", "newsletter"]}
      />
      
      <AIButton
        id="submit"
        label="Submit"
        onClick={handleSubmit}
        aiHints={["submit", "send", "ok"]}
      />
    </>
  );
}
```

**Guided mode will automatically:**
1. Ask for Full Name
2. Ask for Email Address
3. Ask about newsletter subscription
4. Ask to confirm Submit

### Customizing Question Text

You can customize questions by setting the element's properties:

```tsx
<AIInput
  id="phone"
  label="Phone Number"
  value={phone}
  onChange={setPhone}
  placeholder="555-1234"  // Used in guided question
  validation="10 digits"  // Mentioned in guided question
  aiHints={["phone", "phone number", "telephone"]}
/>

// Guided mode will ask:
// "What is your Phone Number? Please enter 10 digits."
```

### Controlling Step Order

Fields are asked in this order:
1. **Inputs/Textareas** (top to bottom in DOM)
2. **Selects** (top to bottom)
3. **Checkboxes** (top to bottom)
4. **Buttons** (top to bottom)

To change order, adjust your component order in JSX:

```tsx
// These will be asked in this order:
<AIInput id="first" ... />   // Step 1
<AIInput id="second" ... />  // Step 2
<AIInput id="third" ... />   // Step 3
```

### Skipping Fields in Guided Mode

Some fields should not be asked in guided mode:

```tsx
// Option 1: Conditional registration
const [showAdvanced, setShowAdvanced] = useState(false);

{showAdvanced && (
  <AIInput
    id="advanced-option"
    label="Advanced Option"
    isActive={showAdvanced}  // Won't be included in guided mode if false
    ...
  />
)}

// Option 2: Unregister during guided mode
useEffect(() => {
  if (isGuidedMode) {
    // Unregister happens automatically when component unmounts
    return;
  }
}, [isGuidedMode]);
```

---

## Troubleshooting

### Issue: "Starting guided mode. I will walk you through 0 fields."

**Cause:** No elements found in UIRegistry.

**Solutions:**
1. Ensure you're using AI-aware components (`AIInput`, `AIButton`, etc.)
2. Check that components have mounted (guided mode scans on start)
3. Verify `isActive` prop is not `false` on all components

```tsx
// BAD: Regular HTML
<input type="text" value={name} />

// GOOD: AI-aware
<AIInput id="name" label="Name" value={name} onChange={setName} />
```

---

### Issue: Guided mode asks about hidden fields

**Cause:** Hidden fields are still registered in UIRegistry.

**Solution:** Set `isActive={false}` or conditionally render:

```tsx
// Option 1: isActive prop
<AIInput
  id="field"
  label="Field"
  isActive={isVisible}  // Only included when true
  ...
/>

// Option 2: Conditional rendering
{isVisible && (
  <AIInput id="field" label="Field" ... />
)}
```

---

### Issue: "I didn't catch that" for yes/no questions

**Cause:** User said something other than yes/no words.

**Solution:** Add more yes/no variants or check transcription:

```typescript
// In GuidedMode.ts, add more words:
const YES_WORDS = [
  ...existing,
  'absolutely', 'definitely', 'of course'
];

const NO_WORDS = [
  ...existing,
  'nope', 'nada', 'not really'
];
```

---

### Issue: Password is spoken out loud

**Cause:** This shouldn't happen - passwords are masked.

**Check the code:**
```typescript
// In handleFillAnswer():
const spokenValue = step.element.inputType === 'password'
  ? `${value.length} characters`  // ← Should mask
  : `"${value}"`;
```

If still happening, ensure your `AIInput` has `type="password"`:
```tsx
<AIInput
  id="password"
  type="password"  // ← Must be set!
  ...
/>
```

---

### Issue: Can't exit guided mode

**Cause:** User doesn't know the cancel command.

**Solutions:**
1. Say "cancel", "stop", or "quit"
2. Click the microphone button (toggles voice off, which cancels guided mode)
3. Close/refresh the page

**Improvement:** Add a visible "Exit Guided Mode" button:
```tsx
{isGuidedMode && (
  <button onClick={() => {
    GuidedMode.cancel();
    setIsGuidedMode(false);
  }}>
    Exit Guided Mode
  </button>
)}
```

---

### Issue: Guided mode skips first field

**Cause:** Field might already have a value.

**Behavior:** If a field has a value, guided mode asks:
> "Username currently has 'Honda'. Would you like to change it? Say the new value, or say 'skip'."

If user says "skip", it moves to the next field.

**To change this:** Modify the question generation in `GuidedMode.start()`:
```typescript
// Current behavior:
const currentVal = el.getValue();
question: currentVal
  ? `${el.label} currently has "${currentVal}". Change it?`
  : `What is your ${el.label}?`,

// Always ask, ignore current value:
question: `What is your ${el.label}?`,
```

---

## Summary

### Key Design Decisions

1. **No NLU in guided mode** - Raw answers are the values
   - Simpler and faster
   - More natural ("Honda" vs "my name is Honda")

2. **Step order is automatic** - Based on UIRegistry scan
   - Inputs first (data entry)
   - Checkboxes next (options)
   - Buttons last (actions)

3. **Passwords are masked** - Never spoken out loud
   - "4 characters" instead of "1234"
   - Security best practice

4. **Control commands always work** - "skip", "back", "cancel"
   - Checked before processing answers
   - Gives user full control

5. **Visual feedback** - Purple theme for guided mode
   - Purple "GUIDED" badge
   - Purple mic button
   - Purple progress dots

### Performance

- **Start time:** ~50ms to scan UIRegistry and build steps
- **Question generation:** ~1ms per step
- **Answer processing:** ~1ms (no NLU needed)
- **Total overhead:** Negligible compared to TTS/STT delays

### Extensibility

Want to add features? Easy extension points:

```typescript
// Add custom step types
export type GuidedStepType = 'fill' | 'toggle' | 'confirm' | 'custom';

// Add custom questions
const step: GuidedStep = {
  element: element,
  type: 'custom',
  question: generateCustomQuestion(element),
  ...
};

// Add custom answer handlers
case 'custom':
  await this.handleCustomAnswer(step, text);
  break;
```

---

## Comparison Table

| Feature | Normal Mode | Guided Mode |
|---------|-------------|-------------|
| **Activation** | Always on when mic enabled | Say "guide me" |
| **Voice Input** | "my name is Honda" | Just "Honda" |
| **Field Selection** | User specifies field | AI asks in sequence |
| **Navigation** | Jump anywhere | Step-by-step only |
| **Control** | User-driven | AI-driven |
| **Best For** | Power users, quick edits | First-time users, complex forms |
| **Parallel Filling** | Yes (any field anytime) | No (one at a time) |
| **Undo** | Manual (say "clear name") | Built-in ("back") |
| **Visual Indicator** | None | Purple "GUIDED" badge |
| **Exit** | Mic off | "cancel" or mic off |

Both modes use the same underlying infrastructure (UIRegistry, VoiceEngine, ActionExecutor), just different orchestration logic.
