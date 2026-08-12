# How Voice Commands Work

This document explains the complete flow when a user says **"my name is Honda"** and how the system fills the input field.

---

## Table of Contents

1. [Overview](#overview)
2. [Complete Flow Diagram](#complete-flow-diagram)
3. [Step-by-Step Breakdown](#step-by-step-breakdown)
4. [Component Architecture](#component-architecture)
5. [Pattern Matching Details](#pattern-matching-details)
6. [Troubleshooting](#troubleshooting)

---

## Overview

When a user says **"my name is Honda"**, the system:

1. **Captures** the audio via Web Speech API (STT)
2. **Parses** the text into structured intent + entities (NLU)
3. **Resolves** which UI element to target (UIRegistry lookup)
4. **Executes** the action (fills the input)
5. **Responds** via text-to-speech (TTS)

All of this happens **locally in the browser** - no cloud services needed.

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER SPEAKS                              │
│                    "my name is Honda"                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WEB SPEECH API (STT)                          │
│  Browser's built-in speech recognition                           │
│  - Continuous listening mode                                     │
│  - Returns interim + final transcripts                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ transcript: "my name is Honda"
                         │ isFinal: true
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VOICE ENGINE                                  │
│  src/ai/VoiceEngine.ts                                          │
│                                                                  │
│  onresult callback:                                             │
│    if (isMuted) return; // Drop if AI is speaking              │
│    if (isFinal) {                                               │
│      options.onResult(transcript, true);                        │
│    }                                                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ onResult("my name is Honda", true)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI PROVIDER                                   │
│  src/ai/AIProvider.tsx                                          │
│                                                                  │
│  onResult handler:                                              │
│    // Guard against feedback loop                               │
│    if (busy.current || VoiceEngine.getIsMuted()) return;       │
│                                                                  │
│    // Check if guided mode is active                            │
│    if (GuidedMode.isActive()) {                                 │
│      → route to GuidedMode.handleAnswer()                       │
│    } else {                                                      │
│      → processUtterance(transcript)                             │
│    }                                                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ processUtterance("my name is Honda")
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NLU ENGINE                                    │
│  src/ai/NLUEngine.ts                                            │
│                                                                  │
│  parse("my name is Honda"):                                     │
│    1. Check dynamicPatterns first (page-specific)               │
│    2. Then check CORE_PATTERNS (universal)                      │
│    3. Try heuristic matching if no pattern match                │
│    4. Return best result or unknown                             │
│                                                                  │
│  Pattern matched (from CORE_PATTERNS):                          │
│    /(?:my\s+)?(\w+(?:\s+\w+)?)\s+(?:is|=)\s+(.+)/i            │
│         ↑ optional "my"                                         │
│              ↑ field name (1-2 words)                           │
│                        ↑ "is" or "="                            │
│                                 ↑ value (rest of text)          │
│                                                                  │
│  Extracted:                                                      │
│    field: "name"                                                │
│    value: "Honda"                                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ NLUResult {
                         │   intent: "fill_field",
                         │   confidence: 0.8,
                         │   entities: {
                         │     field: "name",
                         │     value: "Honda"
                         │   }
                         │ }
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    UI REGISTRY LOOKUP                            │
│  src/ai/UIRegistry.ts                                           │
│                                                                  │
│  findByQuery("name"):                                           │
│    - Search all registered elements                             │
│    - Match against:                                             │
│      • element.label (e.g., "Username")                         │
│      • element.aiHints (e.g., ["name", "username", "user"])    │
│      • element.id                                               │
│                                                                  │
│  Fuzzy matching algorithm:                                      │
│    - Exact match: score 1.0                                     │
│    - Contains: score 0.9                                        │
│    - Word-level match: score 0.8                                │
│                                                                  │
│  Best match found:                                              │
│    AIInput {                                                    │
│      id: "username",                                            │
│      label: "Username",                                         │
│      aiHints: ["name", "username", "my name"],                 │
│      type: "input",                                             │
│      getValue: () => currentValue,                             │
│      setValue: (val) => setUsername(val)                       │
│    }                                                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ element: AIInput (username)
                         │ value: "Honda"
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ACTION EXECUTOR                               │
│  src/ai/ActionExecutor.ts                                       │
│                                                                  │
│  execute(nluResult):                                            │
│    1. Check dynamicHandlers first (page-specific)               │
│    2. Then check core handlers (universal)                      │
│    3. Execute matched handler                                   │
│                                                                  │
│  Core handler for 'fill_field':                                 │
│    const element = entities.element;  // AIInput               │
│    const value = entities.value;      // "Honda"               │
│                                                                  │
│    // Call the setValue callback                                │
│    element.setValue(value);                                     │
│                                                                  │
│    return {                                                      │
│      success: true,                                             │
│      message: "Set Username to \"Honda\".",                     │
│      shouldSpeak: true                                          │
│    };                                                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ setValue("Honda") is called
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI INPUT COMPONENT                            │
│  src/components/ai/AIInput.tsx                                  │
│                                                                  │
│  setValue callback:                                             │
│    const setValue = (newValue) => {                             │
│      onChange(newValue);  // Update React state                │
│                                                                  │
│      // Also update DOM directly for React's synthetic events   │
│      if (inputRef.current) {                                    │
│        const nativeSetter = Object.getOwnPropertyDescriptor(    │
│          HTMLInputElement.prototype, 'value'                    │
│        )?.set;                                                   │
│        nativeSetter?.call(inputRef.current, newValue);          │
│        inputRef.current.dispatchEvent(                          │
│          new Event('input', { bubbles: true })                  │
│        );                                                        │
│      }                                                           │
│    };                                                            │
│                                                                  │
│  Result:                                                         │
│    - React state updated: username = "Honda"                    │
│    - DOM input updated: <input value="Honda">                   │
│    - Visual highlight animation triggered                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ UI updated, now speak response
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VOICE ENGINE (TTS)                            │
│  src/ai/VoiceEngine.ts                                          │
│                                                                  │
│  speak("Set Username to Honda"):                                │
│    1. muteRecognition()                                         │
│       - Set isMuted = true                                      │
│       - recognition.abort() (force stop mic)                    │
│       - Block all onresult callbacks                            │
│                                                                  │
│    2. synthesize(text)                                          │
│       - Create SpeechSynthesisUtterance                         │
│       - synthesis.speak(utterance)                              │
│       - Wait for utterance.onend                                │
│                                                                  │
│    3. cooldownThenUnmute()                                      │
│       - Wait 1200ms (prevents mic from hearing TTS tail)        │
│       - Set isMuted = false                                     │
│       - recognition.start() (restart mic)                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ TTS: "Set Username to Honda"
                         │ (user hears the confirmation)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CONVERSATION LOG                              │
│  src/components/VoiceIndicator.tsx                              │
│                                                                  │
│  Display in UI:                                                 │
│    🗣️ my name is Honda                                         │
│    🤖 Set Username to "Honda".                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Breakdown

### Step 1: Voice Capture (Web Speech API)

**File:** Browser's built-in `SpeechRecognition` API

**What happens:**
```javascript
// VoiceEngine initializes recognition
recognition.continuous = true;
recognition.interimResults = true;
recognition.lang = 'en-US';

// User speaks
recognition.onresult = (event) => {
  const transcript = event.results[i][0].transcript; // "my name is Honda"
  const isFinal = event.results[i].isFinal;          // true
  
  if (isFinal) {
    options.onResult(transcript, true);
  }
};
```

**Key points:**
- Continuous mode: mic stays on, doesn't stop after each utterance
- Interim results: shows what you're saying in real-time
- Final result: triggers the processing pipeline

---

### Step 2: Pattern Matching (NLU Engine)

**File:** `src/ai/NLUEngine.ts`

**What happens:**
```javascript
// Input: "my name is Honda"
const text = "my name is Honda";

// 1. Check dynamicPatterns first (page-specific)
// (none registered for this command on login page)

// 2. Check CORE_PATTERNS (universal)
const pattern = /(?:my\s+)?(\w+(?:\s+\w+)?)\s+(?:is|=)\s+(.+)/i;

// Match result
const match = text.match(pattern);
// match[0] = "my name is Honda"  (full match)
// match[1] = "name"              (field)
// match[2] = "Honda"             (value)

// Extract entities
const entities = {
  field: match[1].trim(),  // "name"
  value: match[2].trim()   // "Honda"
};

// Return structured result
return {
  intent: 'fill_field',
  confidence: 0.8,
  entities: entities,
  rawText: text
};
```

**Patterns supported:**
```javascript
// All of these work:
"my name is Honda"        → field: "name", value: "Honda"
"name is Honda"           → field: "name", value: "Honda"
"my name Honda"           → field: "name", value: "Honda"
"set name to Honda"       → field: "name", value: "Honda"
"username is Honda"       → field: "username", value: "Honda"
"password 1 2 3 4"        → field: "password", value: "1234" (spaces removed)
```

---

### Step 3: UI Element Resolution (UIRegistry)

**File:** `src/ai/UIRegistry.ts`

**What happens:**
```javascript
// Input: field = "name"
const query = "name";

// Search all registered elements
const elements = UIRegistry.getAll();
// [
//   { id: "username", label: "Username", aiHints: ["name", "username", "my name"], ... },
//   { id: "password", label: "Password", aiHints: ["password", "pass"], ... },
//   { id: "remember-me", label: "Remember me", ... }
// ]

// Fuzzy matching algorithm
for (const element of elements) {
  let bestScore = 0;
  
  // Check label: "Username" vs "name"
  if (element.label.toLowerCase().includes(query)) {
    bestScore = 0.9; // Contains match
  }
  
  // Check AI hints: ["name", "username", "my name"]
  for (const hint of element.aiHints) {
    if (hint === query) {
      bestScore = 1.0; // Exact match!
      break;
    }
  }
  
  if (bestScore > 0.3) {
    results.push({ element, score: bestScore });
  }
}

// Sort by score, return best match
results.sort((a, b) => b.score - a.score);
return results[0].element; // AIInput with id="username"
```

**How components register:**
```javascript
// In AIInput component
useAIField({
  id: "username",
  type: "input",
  label: "Username",
  aiHints: ["name", "username", "user name", "my name"],
  getValue: () => username,
  setValue: (val) => setUsername(val)
});
```

---

### Step 4: Action Execution

**File:** `src/ai/ActionExecutor.ts`

**What happens:**
```javascript
// Input: nluResult with intent="fill_field"
async execute(nluResult) {
  // 1. Check dynamicHandlers first (page-specific)
  const dynamicHandler = this.findDynamicHandler(nluResult.intent);
  if (dynamicHandler) {
    return dynamicHandler(nluResult.entities, nluResult);
  }
  
  // 2. Then check core handlers (universal)
  if (nluResult.intent === 'fill_field') {
    return this.executeFill(nluResult.entities);
  }
  // ... other core handlers ...
}

async executeFill(entities) {
  const element = entities.element;  // AIInput (username)
  const value = entities.value;      // "Honda"
  
  // Validate element exists
  if (!element) {
    return {
      success: false,
      message: "I couldn't find the field 'name'.",
      shouldSpeak: true
    };
  }
  
  // Call the setValue callback (always fresh via optsRef)
  element.setValue(value);
  
  // Generate response
  return {
    success: true,
    message: `Set ${element.label} to "${value}".`,
    shouldSpeak: true
  };
}
```

---

### Step 5: React State Update

**File:** `src/components/ai/AIInput.tsx` + `src/hooks/useAIField.ts`

**What happens:**
```javascript
// In useAIField.ts - callbacks always read through optsRef.current
const element = {
  // ...
  setValue: (v) => optsRef.current.setValue?.(v),  // Fresh callback!
  // ...
};

// In AIInput.tsx
const setValue = useCallback((newValue: string) => {
  // 1. Update React state
  onChange(newValue);  // Calls setUsername("Honda")
  
  // 2. Update DOM directly (for React's synthetic events)
  if (inputRef.current) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;
    nativeInputValueSetter?.call(inputRef.current, newValue);
    
    // Dispatch input event so React sees the change
    inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
  }
}, [onChange]);

// Result:
// - React state: username = "Honda"
// - DOM: <input value="Honda" />
// - Visual: highlight animation plays
```

**Why optsRef.current?**
- Prevents stale closures when React state updates
- Ensures callbacks always use the latest values from most recent render
- Critical for guided mode and multi-step interactions

**Why update DOM directly?**
- React controlled inputs need the native `input` event to trigger properly
- This ensures onChange handlers fire correctly
- Prevents React from overwriting the value

---

### Step 6: Text-to-Speech Response

**File:** `src/ai/VoiceEngine.ts`

**What happens:**
```javascript
async speak(text: string) {
  // 1. MUTE microphone (critical for feedback loop prevention)
  this.muteRecognition();
  // - Set isMuted = true
  // - recognition.abort() (force stop)
  // - All onresult callbacks will be dropped
  
  // 2. SPEAK via TTS
  await this.synthesize(text);
  // - Create SpeechSynthesisUtterance("Set Username to Honda")
  // - synthesis.speak(utterance)
  // - Wait for utterance.onend
  
  // 3. COOLDOWN (1200ms)
  await this.cooldownThenUnmute();
  // - Wait 1200ms to ensure TTS audio has fully stopped
  // - This prevents mic from hearing the tail end of TTS
  // - Set isMuted = false
  // - recognition.start() (restart mic)
}
```

**Why the cooldown?**
- Without it, the mic hears the AI's own voice
- This creates an infinite feedback loop:
  ```
  AI speaks → mic hears → processes as new command → AI speaks again → loop forever
  ```
- 1200ms is enough for TTS audio to fully dissipate

---

## Component Architecture

### Component Registration Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    LoginForm.tsx                              │
│                                                               │
│  <AIInput                                                     │
│    id="username"                                              │
│    label="Username"                                           │
│    value={username}                                           │
│    onChange={setUsername}                                     │
│    aiHints={["name", "username", "my name"]}                 │
│  />                                                            │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ Renders
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    AIInput.tsx                                │
│                                                               │
│  useAIField({                                                 │
│    id: "username",                                            │
│    type: "input",                                             │
│    label: "Username",                                         │
│    aiHints: ["name", "username", "my name"],                 │
│    getValue: () => username,                                  │
│    setValue: (val) => setUsername(val)                       │
│  });                                                           │
│                                                               │
│  return <input value={username} onChange={...} />            │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ Registers
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    useAIField.ts                              │
│                                                               │
│  // Store options in ref for fresh callbacks                  │
│  const optsRef = useRef(options);                             │
│  optsRef.current = options;                                   │
│                                                               │
│  useEffect(() => {                                            │
│    const element: UIElement = {                               │
│      id: "username",                                          │
│      type: "input",                                           │
│      label: "Username",                                       │
│      aiHints: ["name", "username", "my name"],               │
│      actions: ["fill", "clear"],                             │
│      getValue: () => optsRef.current.getValue?.() ?? '',     │
│      setValue: (v) => optsRef.current.setValue?.(v),         │
│      triggerAction: (a) => optsRef.current.triggerAction?.(a)│
│      isActive: () => true                                     │
│    };                                                          │
│                                                               │
│    const unregister = UIRegistry.register(element);          │
│    return unregister; // Cleanup on unmount                   │
│  }, [id, type, label]);                                       │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ Stored in
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    UIRegistry.ts                              │
│                                                               │
│  private elements = new Map<string, UIElement>();            │
│                                                               │
│  register(element: UIElement) {                               │
│    this.elements.set(element.id, element);                   │
│    return () => this.elements.delete(element.id);            │
│  }                                                             │
│                                                               │
│  findByQuery(query: string): UIElement[] {                    │
│    // Fuzzy match against labels and hints                    │
│    // Return sorted by relevance score                        │
│  }                                                             │
└──────────────────────────────────────────────────────────────┘
```

### Page-Specific AI Context Registration

```
┌──────────────────────────────────────────────────────────────┐
│                    MovieSearch.tsx                            │
│                                                               │
│  useAIContext('movie-search', {                               │
│    patterns: [                                                │
│      { intent: 'search', patterns: [/^search\s+(.+)/i], ... }│
│      { intent: 'navigate', patterns: [/^next$/i], ... }      │
│    ],                                                          │
│    handlers: {                                                │
│      search: (entities) => { /* search logic */ },           │
│      navigate: (entities) => { /* nav logic */ }             │
│    }                                                           │
│  });                                                           │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ On mount
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    useAIContext.ts                            │
│                                                               │
│  useEffect(() => {                                            │
│    const cleanups = [];                                       │
│    if (options.patterns) {                                    │
│      cleanups.push(                                           │
│        NLUEngine.registerPatterns(key, options.patterns)     │
│      );                                                        │
│    }                                                           │
│    if (options.handlers) {                                    │
│      cleanups.push(                                           │
│        ActionExecutor.registerHandlers(key, options.handlers)│
│      );                                                        │
│    }                                                           │
│    return () => cleanups.forEach(fn => fn());                │
│  }, [key]);                                                    │
└────────────┬──────────────────────────┬────────────────────────┘
             │                          │
             │ patterns                 │ handlers
             ▼                          ▼
┌──────────────────────┐    ┌──────────────────────┐
│   NLUEngine.ts       │    │ ActionExecutor.ts    │
│                      │    │                      │
│ dynamicPatterns:     │    │ dynamicHandlers:     │
│ Map<key, patterns[]> │    │ Map<key, handlers>   │
│                      │    │                      │
│ 'movie-search' →     │    │ 'movie-search' →     │
│   [search, navigate] │    │   {search, navigate} │
└──────────────────────┘    └──────────────────────┘
```

---

## Pattern Matching Details

### All Supported Patterns for "fill_field"

```javascript
// Pattern 1: "field is value"
/(?:my\s+)?(\w+(?:\s+\w+)?)\s+(?:is|=)\s+(.+)/i
Examples:
  "my name is Honda"     → field: "name", value: "Honda"
  "name is Honda"        → field: "name", value: "Honda"
  "username is Honda"    → field: "username", value: "Honda"
  "email is test@x.com"  → field: "email", value: "test@x.com"

// Pattern 2: "set field to value"
/(?:set|put|type|enter|write|fill(?:\s+in)?)\s+(?:the\s+)?(\w+(?:\s+\w+)?)\s+(?:to|as|with|=)\s+(.+)/i
Examples:
  "set name to Honda"    → field: "name", value: "Honda"
  "enter password as 1234" → field: "password", value: "1234"
  "type Honda into name" → field: "name", value: "Honda"

// Pattern 3: "fill value into field"
/(?:set|put|type|enter|write|fill(?:\s+in)?)\s+(.+?)\s+(?:in|into|for|on)\s+(?:the\s+)?(\w+(?:\s+\w+)?)/i
Examples:
  "fill Honda into name" → field: "name", value: "Honda"
  "put 1234 in password" → field: "password", value: "1234"

// Pattern 4: "field should be value"
/(?:the\s+)?(\w+(?:\s+\w+)?)\s+(?:should be|would be|will be)\s+(.+)/i
Examples:
  "name should be Honda" → field: "name", value: "Honda"

// Pattern 5: "field: value" or "field, value"
/(?:for\s+)?(?:the\s+)?(\w+(?:\s+\w+)?)\s*[,:]\s+(.+)/i
Examples:
  "name: Honda"          → field: "name", value: "Honda"
  "username, Honda"      → field: "username", value: "Honda"

// Pattern 6: "my field value" (no "is")
/^(?:my\s+)?(name|username|user|password|pass|email)\s+(.+)$/i
Examples:
  "my name Honda"        → field: "name", value: "Honda"
  "password 1234"        → field: "password", value: "1234"
```

### Number Cleanup

When users say digits separately, they're automatically cleaned:

```javascript
// In extractEntities:
if (value) {
  value = value.replace(/(\d)\s+(?=\d)/g, '$1');
}

// Examples:
"password 1 2 3 4"      → value: "1234"
"password 1 2 3 4 5"    → value: "12345"
"phone 5 5 5 1 2 3 4"   → value: "5551234"
```

---

## Troubleshooting

### Issue: "I couldn't find the field 'name'"

**Cause:** UIRegistry couldn't match the field name to any registered element.

**Solutions:**
1. Check the `aiHints` array in your AIInput component
2. Add more keywords that users might say
3. Check the conversation log to see what was transcribed

```javascript
// BAD: Limited hints
<AIInput
  id="username"
  label="Username"
  aiHints={["username"]}  // Only matches "username"
/>

// GOOD: Comprehensive hints
<AIInput
  id="username"
  label="Username"
  aiHints={["username", "name", "user", "user name", "my name", "login name"]}
/>
```

---

### Issue: Field fills but React state doesn't update

**Cause:** The setValue callback isn't updating React state properly.

**Solution:** Ensure setValue calls the onChange prop:

```javascript
const setValue = useCallback((newValue: string) => {
  onChange(newValue);  // Must call this!
  
  // Also update DOM for React's synthetic events
  if (inputRef.current) {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;
    nativeSetter?.call(inputRef.current, newValue);
    inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
  }
}, [onChange]);
```

---

### Issue: AI keeps talking in a loop

**Cause:** Microphone is hearing the AI's TTS output.

**Solution:** This should be fixed with the 3-layer mute system. If it still happens:

1. Increase `COOLDOWN_AFTER_SPEAK_MS` in `VoiceEngine.ts` (default: 1200ms)
2. Check console logs for "Dropping result while muted" messages
3. Ensure you're using the latest code with the mute system

---

### Issue: Voice command not recognized

**Cause:** Pattern doesn't match or confidence too low.

**Debug steps:**
1. Check the conversation log - what was transcribed?
2. Try typing the command in the text box to test NLU
3. Add a new pattern to `NLUEngine.ts` if needed

```javascript
// Example: Add support for "give me" pattern
{
  intent: 'fill_field',
  patterns: [
    // ... existing patterns ...
    /give\s+me\s+(\w+)\s+(.+)/i,  // "give me name Honda"
  ],
  extractEntities: (match) => ({
    field: match[1]?.trim(),
    value: match[2]?.trim()
  })
}
```

---

## Summary

The complete flow from **"my name is Honda"** to filling the input takes ~100-200ms:

1. **Web Speech API** (0ms): Captures audio, returns transcript
2. **NLU Pattern Match** (~1ms): Check dynamic patterns → core patterns (regex is very fast)
3. **UIRegistry Lookup** (~1ms): Map lookup + fuzzy scoring
4. **Action Execution** (~1ms): Check dynamic handlers → core handlers, call setValue
5. **React Update** (~10ms): State update + re-render (with fresh callbacks via optsRef)
6. **TTS Response** (~1000ms): Speak confirmation

Total: **~1 second** from speaking to hearing the confirmation.

The system is designed to be:
- **Fast**: Pattern matching instead of ML models
- **Local**: No cloud API calls
- **Reliable**: 3-layer feedback loop protection + stale closure prevention
- **Extensible**: Dynamic AI context per page via `useAIContext`
- **Scalable**: Only relevant patterns/handlers active at any time

For more details on the dynamic architecture, see [ARCHITECTURE.md](./ARCHITECTURE.md).
