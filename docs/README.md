# Rabbit V2 - AI Voice-Controlled PWA

A Progressive Web App with local AI voice interaction. Control UI elements entirely by voice using Web Speech API (no external services needed).

## Features

- **Voice-Controlled UI** - Fill forms, click buttons, navigate pages via voice
- **Local AI** - No cloud services, runs entirely in browser
- **Dynamic AI Context** - Each page registers its own voice commands
- **Smart NLU** - Understands natural language with pattern matching
- **Guided Mode** - Step-by-step voice walkthrough for forms
- **Feedback Loop Protection** - 3-layer guard system prevents mic from hearing its own TTS
- **PWA** - Installable, works offline
- **Real Backend API** - Express server for authentication and movie search

## Quick Start

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Start Servers

```bash
# Terminal 1 - Backend (http://localhost:3001)
cd backend
npm run dev

# Terminal 2 - Frontend (http://localhost:5173)
cd frontend
npm run dev
```

### 3. Open Browser

Navigate to **http://localhost:5173** and click the microphone button.

## Voice Commands

### Login Page

| Say | Result |
|-----|--------|
| "Guide me" | Step-by-step walkthrough |
| "My name is Honda" | Fills username with "Honda" |
| "My name Honda" | Fills username with "Honda" (no "is" needed) |
| "Password 1234" | Fills password with "1234" |
| "Password 1 2 3 4" | Fills password with "1234" (spaces removed) |
| "Check remember me" | Toggles "Remember me" checkbox |
| "Login" / "OK" / "Submit" | Submits the form |

**Valid Credentials:** Honda / 1234

### Welcome Page

| Say | Result |
|-----|--------|
| "Browse movies" | Navigate to movie search |
| "Logout" | Return to login |

### Movie Search Page

| Say | Result |
|-----|--------|
| "Search matrix" | Search for "matrix" |
| "Search sci-fi" | Search for "sci-fi" genre |
| "Select matrix" | Select The Matrix card |
| "Select number 3" | Select card #3 |
| "Next" / "Previous" | Navigate between selected cards |
| "Tell me about this" | Read selected movie details aloud |
| "Back" | Return to welcome page |

## Architecture

### Frontend (`frontend/`)

```
src/
├── ai/
│   ├── AIProvider.tsx       # React context for AI system
│   ├── UIRegistry.ts        # Central registry (components register here)
│   ├── VoiceEngine.ts       # Web Speech API (STT + TTS)
│   ├── NLUEngine.ts         # Intent parsing (dynamic pattern registration)
│   ├── ActionExecutor.ts    # Maps intents → UI actions (dynamic handlers)
│   └── GuidedMode.ts        # Step-by-step form filling
├── components/
│   ├── ai/
│   │   ├── AIInput.tsx      # Voice-enabled input
│   │   ├── AIButton.tsx     # Voice-enabled button
│   │   ├── AISelect.tsx     # Voice-enabled select
│   │   └── AICheckbox.tsx   # Voice-enabled checkbox
│   ├── LoginForm.tsx        # Login page
│   ├── MovieSearch.tsx      # Movie search page (registers own AI context)
│   ├── MovieCard.tsx        # AI-aware selectable movie card
│   └── VoiceIndicator.tsx   # Voice status panel + conversation log
└── hooks/
    ├── useAIField.ts        # Register UI elements with AI
    └── useAIContext.ts      # Register page-specific NLU patterns + handlers
```

### Backend (`backend/`)

Simple Express API:
- `POST /api/login` - Authenticates user (Honda/1234)
- `GET /api/movies?q=matrix` - Search movies (18 dummy movies)
- `GET /api/movies/:id` - Get movie by ID
- `GET /api/health` - Health check

## How It Works

### 1. Component Registration

Every AI-aware component registers itself with semantic metadata:

```tsx
<AIInput
  id="username"
  label="Username"
  value={username}
  onChange={setUsername}
  aiHints={["name", "username", "my name"]}
/>
```

The `useAIField` hook registers this in the `UIRegistry` with:
- Label: "Username"
- Hints: ["name", "username", "my name"]
- Actions: [fill, clear]
- getValue/setValue callbacks (always fresh via ref)

### 2. Page-Specific AI Context

Each page registers its own NLU patterns and action handlers:

```tsx
// In MovieSearch.tsx
useAIContext('movie-search', {
  patterns: [
    { intent: 'search', patterns: [/^search\s+(.+)/i], extractEntities: ... },
    { intent: 'navigate', patterns: [/^next$/i, /^previous$/i], extractEntities: ... },
  ],
  handlers: {
    search: (entities) => { /* fill search box, click search button */ },
    navigate: (entities) => { /* click next/prev button */ },
  },
});
```

When MovieSearch **unmounts**, its patterns and handlers are automatically removed.

### 3. Voice Recognition Flow

```
User speaks → STT → NLUEngine → ActionExecutor → TTS response
                      │              │
                      ▼              ▼
              Dynamic patterns   Dynamic handlers (page-specific)
                   then              then
              Core patterns      Core handlers (universal)
```

**Example:**
1. User says: "search matrix"
2. STT transcribes: "search matrix"
3. NLU checks dynamic patterns first → matches MovieSearch's `search` intent
4. ActionExecutor checks dynamic handlers → calls MovieSearch's `search` handler
5. Handler fills search input with "matrix" and clicks search button
6. TTS speaks: "Searching for matrix"

### 4. Feedback Loop Prevention

**The Problem:** Microphone hears AI's TTS output → processes it as new input → infinite loop

**The Solution:** 3-layer mute system

**Layer 1 - VoiceEngine:**
- Before TTS: `isMuted = true` + `recognition.abort()`
- During TTS: all `onresult` callbacks are dropped
- After TTS: 1200ms cooldown before unmuting

**Layer 2 - AIProvider:**
- `busy` ref prevents re-entrant processing
- Blocks all voice input during speech

**Layer 3 - onResult callback:**
- Triple-checks: `busy` OR `VoiceEngine.getIsMuted()` → drop result

## Creating New Pages with Voice Control

### Step 1: Build your page with AI components

```tsx
import { AIInput, AIButton } from './components/ai';
import { useAIContext } from '../hooks/useAIContext';

function ProductSearch() {
  const [query, setQuery] = useState('');
  
  return (
    <div>
      <AIInput id="product-query" label="Search" value={query} onChange={setQuery} />
      <AIButton id="search-btn" label="Search" onClick={handleSearch} />
    </div>
  );
}
```

### Step 2: Register page-specific AI context

```tsx
useAIContext('product-search', {
  patterns: [
    {
      intent: 'search_product',
      patterns: [/^(?:search|find)\s+product\s+(.+)/i],
      extractEntities: (m) => ({ value: m[1]?.trim() }),
    },
  ],
  handlers: {
    search_product: (entities) => {
      const input = UIRegistry.getById('product-query');
      const btn = UIRegistry.getById('search-btn');
      input?.setValue(entities.value || '');
      btn?.triggerAction?.('click');
      return ActionExecutor.reply(true, `Searching for ${entities.value}.`);
    },
  },
});
```

### Step 3: Done

Users can now say "search product laptop" on this page. When they navigate away, the patterns/handlers are auto-removed.

## Guided Mode

Say **"guide me"** on any form to activate step-by-step voice walkthrough. The AI will:

1. Scan all form fields (inputs → selects → checkboxes → buttons)
2. Ask a question for each field
3. Fill the value with your voice answer
4. Confirm before clicking submit buttons

Commands during guided mode:
- Answer normally (e.g., "Honda")
- "Skip" - skip current field
- "Back" - go to previous field
- "Cancel" - exit guided mode

See [GUIDED_MODE.md](./GUIDED_MODE.md) for details.

## Browser Support

- **Chrome/Edge:** Full support (Web Speech API)
- **Safari:** Partial support (TTS works, STT limited)
- **Firefox:** No support (Web Speech API not implemented)

## Internationalization (i18n)

Currently optimized for **English only**. For other languages:

1. **STT/TTS:** Web Speech API supports many languages (set `language="ja-JP"` in `App.tsx`)
2. **NLU Patterns:** Requires language-specific regex patterns (e.g., Japanese doesn't use spaces)
3. **Response Strings:** Requires i18n system for all spoken messages

The dynamic `useAIContext` architecture makes multi-language easier - each page can register patterns for multiple languages based on active language setting.

## Troubleshooting

### Microphone Not Working

1. Check browser permissions (allow microphone access)
2. Use Chrome/Edge (best support)
3. Check console for errors

### Feedback Loop (AI keeps talking)

This should be fixed with the 3-layer mute system. If it still happens:
1. Increase `COOLDOWN_MS` in `VoiceEngine.ts`
2. Check console logs for dropped results

### Voice Commands Not Recognized

1. Speak clearly and wait for the AI to finish speaking
2. Check the conversation log (bottom panel) to see what was transcribed
3. Try typing the command in the text input box to test NLU
4. Add more `aiHints` to your component

### Stale Closures (AI actions fail after state update)

If voice commands work on initial load but fail after filling fields (e.g., "Login" button doesn't see the filled username/password), the issue is stale closures.

**Root cause:** Callbacks registered in `useAIField` captured old state.

**Fix:** Already implemented - all callbacks in `useAIField` now read through `optsRef.current`, ensuring they always use the latest closure from the most recent render.

## Documentation

- [HOW_IT_WORKS.md](./HOW_IT_WORKS.md) - Detailed flow of "my name is Honda"
- [GUIDED_MODE.md](./GUIDED_MODE.md) - How "guide me" works
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Dynamic AI context system

## License

MIT
