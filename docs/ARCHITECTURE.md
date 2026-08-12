# Architecture: Dynamic AI Context System

This document explains the core architectural pattern that makes Rabbit V2 scalable and maintainable: **Dynamic AI Context Registration**.

---

## Table of Contents

1. [The Problem](#the-problem)
2. [The Solution](#the-solution)
3. [Core Architecture](#core-architecture)
4. [How It Works](#how-it-works)
5. [Implementation Examples](#implementation-examples)
6. [Benefits](#benefits)
7. [Extending the System](#extending-the-system)

---

## The Problem

### Initial Monolithic Approach

In the first iteration, all voice commands were hardcoded in `NLUEngine.ts` and `ActionExecutor.ts`:

```typescript
// NLUEngine.ts (OLD - monolithic)
const PATTERNS = [
  // Login patterns
  { intent: 'fill_field', patterns: [...] },
  { intent: 'click_button', patterns: [...] },
  
  // Movie patterns
  { intent: 'search', patterns: [...] },
  { intent: 'navigate', patterns: [...] },
  
  // Future: Products, Cart, Checkout, Profile, etc.
  { intent: 'add_to_cart', patterns: [...] },
  { intent: 'remove_from_cart', patterns: [...] },
  // ... hundreds more ...
];
```

```typescript
// ActionExecutor.ts (OLD - monolithic)
async execute(nluResult) {
  switch (nluResult.intent) {
    case 'fill_field': return this.handleFillField(nluResult.entities);
    case 'click_button': return this.handleClickButton(nluResult.entities);
    case 'search': return this.handleMovieSearch(nluResult.entities);
    case 'navigate': return this.handleMovieNavigate(nluResult.entities);
    case 'add_to_cart': return this.handleAddToCart(nluResult.entities);
    // ... hundreds more cases ...
  }
}
```

### Problems with This Approach

1. **Conflicts:** Login page has "search" intent, Movie page also has "search" intent → ambiguous
2. **Memory waste:** All patterns loaded even when irrelevant (e.g., cart patterns on login page)
3. **Maintenance nightmare:** Single 1000-line file with all intents for entire app
4. **No isolation:** Changes to Movie page risk breaking Login page patterns
5. **Poor scalability:** Adding 10 new pages = 10x more patterns in one file

---

## The Solution

### Dynamic Context Registration

Each page/component **registers its own AI context** when mounted, and **unregisters** when unmounted.

```typescript
// MovieSearch.tsx (NEW - dynamic)
useAIContext('movie-search', {
  patterns: [
    { intent: 'search', patterns: [...], extractEntities: ... },
    { intent: 'navigate', patterns: [...], extractEntities: ... },
  ],
  handlers: {
    search: (entities) => { /* movie-specific search logic */ },
    navigate: (entities) => { /* movie-specific nav logic */ },
  },
});
```

When user is on the **Login page**, only login patterns are active.  
When user navigates to **Movie page**, movie patterns are **added**.  
When user leaves Movie page, movie patterns are **removed**.

---

## Core Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      AIProvider.tsx                          │
│                  (orchestrates everything)                   │
└────────┬──────────────────────────────────────┬─────────────┘
         │                                      │
         ▼                                      ▼
┌──────────────────┐                  ┌──────────────────┐
│  VoiceEngine.ts  │                  │  UIRegistry.ts   │
│  (STT/TTS)       │                  │  (UI elements)   │
└────────┬─────────┘                  └────────┬─────────┘
         │                                      │
         │ transcript                           │ register/lookup
         │                                      │
         ▼                                      ▼
┌─────────────────────────────────────────────────────────────┐
│                      NLUEngine.ts                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ CORE_PATTERNS (always active)                         │  │
│  │  - fill_field, click, select, toggle, clear, etc.    │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ dynamicPatterns: Map<key, PatternDef[]>              │  │
│  │  - 'movie-search' → [search, navigate, read_details] │  │
│  │  - 'product-list' → [filter, sort, add_to_cart]      │  │
│  │  - (registered/unregistered dynamically)              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  parse(utterance):                                           │
│    1. Check dynamicPatterns first (page-specific)           │
│    2. Then check CORE_PATTERNS (universal)                  │
│    3. Return best match                                      │
└────────┬────────────────────────────────────────────────────┘
         │ { intent, entities }
         ▼
┌─────────────────────────────────────────────────────────────┐
│                   ActionExecutor.ts                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Core handlers (always active)                         │  │
│  │  - fill_field, click, select, toggle, etc.           │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ dynamicHandlers: Map<key, Map<intent, ActionHandler>>│  │
│  │  - 'movie-search' → { search: fn, navigate: fn }     │  │
│  │  - 'product-list' → { filter: fn, add_to_cart: fn }  │  │
│  │  - (registered/unregistered dynamically)              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  execute(nluResult):                                         │
│    1. Check dynamicHandlers first (page-specific)           │
│    2. Then check core handlers (universal)                  │
│    3. Execute handler and return result                     │
└─────────────────────────────────────────────────────────────┘
```

### Key Interfaces

```typescript
// NLUEngine.ts
export interface PatternDef {
  intent: string;
  patterns: RegExp[];
  extractEntities?: (matches: RegExpMatchArray, text: string) => Record<string, any>;
}

static registerPatterns(key: string, patterns: PatternDef[]): () => void {
  this.dynamicPatterns.set(key, patterns);
  return () => this.dynamicPatterns.delete(key); // cleanup function
}
```

```typescript
// ActionExecutor.ts
export type ActionHandler = (
  entities: Record<string, any>,
  nluResult: NLUResult
) => Promise<ActionResult> | ActionResult;

static registerHandlers(key: string, handlers: Record<string, ActionHandler>): () => void {
  const handlerMap = new Map(Object.entries(handlers));
  this.dynamicHandlers.set(key, handlerMap);
  return () => this.dynamicHandlers.delete(key); // cleanup function
}
```

```typescript
// useAIContext.ts
export interface AIContextOptions {
  patterns?: PatternDef[];
  handlers?: Record<string, ActionHandler>;
}

export function useAIContext(key: string, options: AIContextOptions) {
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    
    if (options.patterns?.length) {
      cleanups.push(NLUEngine.registerPatterns(key, options.patterns));
    }
    
    if (options.handlers && Object.keys(options.handlers).length) {
      cleanups.push(ActionExecutor.registerHandlers(key, options.handlers));
    }
    
    return () => cleanups.forEach(fn => fn()); // auto-cleanup on unmount
  }, [key]);
}
```

---

## How It Works

### 1. Component Mounts

```tsx
// MovieSearch.tsx renders
function MovieSearch() {
  // ... state setup ...
  
  useAIContext('movie-search', {
    patterns: [
      { intent: 'search', patterns: [/^search\s+(.+)/i], extractEntities: (m) => ({ value: m[1] }) },
      { intent: 'navigate', patterns: [/^next$/i, /^previous$/i], extractEntities: (m) => ({ direction: m[0] }) },
    ],
    handlers: {
      search: async (entities) => {
        const input = UIRegistry.getById('movie-query');
        const btn = UIRegistry.getById('search-btn');
        input?.setValue(entities.value || '');
        btn?.triggerAction?.('click');
        return ActionExecutor.reply(true, `Searching for ${entities.value}.`);
      },
      navigate: async (entities) => {
        const dir = entities.direction === 'next' ? 'next' : 'previous';
        const btn = UIRegistry.getById(`nav-${dir}`);
        btn?.triggerAction?.('click');
        return ActionExecutor.reply(true, dir === 'next' ? 'Next movie.' : 'Previous movie.');
      },
    },
  });
  
  return (/* ... JSX ... */);
}
```

**What happens:**

1. `useAIContext` calls `NLUEngine.registerPatterns('movie-search', patterns)`
2. `NLUEngine.dynamicPatterns.set('movie-search', [search patterns, navigate patterns])`
3. `useAIContext` calls `ActionExecutor.registerHandlers('movie-search', handlers)`
4. `ActionExecutor.dynamicHandlers.set('movie-search', { search: fn, navigate: fn })`
5. React returns cleanup functions for later

### 2. User Says "search matrix"

```
User speaks "search matrix"
  ↓
VoiceEngine (STT) → transcript: "search matrix"
  ↓
AIProvider.processUtterance("search matrix")
  ↓
NLUEngine.parse("search matrix")
  ↓
  • Check dynamicPatterns first
    - 'movie-search' → /^search\s+(.+)/i → MATCH!
    - Extracted: { value: "matrix" }
  • Return: { intent: 'search', entities: { value: 'matrix' } }
  ↓
ActionExecutor.execute({ intent: 'search', entities: { value: 'matrix' } })
  ↓
  • Check dynamicHandlers first
    - 'movie-search' → handlers.search → FOUND!
  • Call: handlers.search({ value: 'matrix' })
    - Sets movie-query input to "matrix"
    - Clicks search-btn
    - Returns: { success: true, message: 'Searching for matrix.' }
  ↓
VoiceEngine.speak("Searching for matrix.")
```

### 3. Component Unmounts

```tsx
// User navigates away from MovieSearch
// React calls cleanup functions returned by useEffect

cleanup() {
  NLUEngine.dynamicPatterns.delete('movie-search'); // Remove search/navigate patterns
  ActionExecutor.dynamicHandlers.delete('movie-search'); // Remove search/navigate handlers
}
```

Now if user says "search matrix" on the Welcome page, NLU won't find a match (because movie patterns are gone).

---

## Implementation Examples

### Example 1: Product Listing Page

```tsx
// ProductList.tsx
function ProductList() {
  const [products, setProducts] = useState([]);
  const [sortBy, setSortBy] = useState('name');
  
  const fetchProducts = async (query) => {
    const res = await fetch(`/api/products?q=${query}&sort=${sortBy}`);
    setProducts(await res.json());
  };
  
  const aiHandlers = useMemo(() => ({
    filter_products: async (entities) => {
      await fetchProducts(entities.category || '');
      return ActionExecutor.reply(true, `Filtered by ${entities.category}.`);
    },
    sort_products: async (entities) => {
      setSortBy(entities.sortBy || 'name');
      return ActionExecutor.reply(true, `Sorting by ${entities.sortBy}.`);
    },
    add_to_cart: async (entities) => {
      const productCard = UIRegistry.getAll().find(el => 
        el.type === 'button' && el.aiHints.includes(entities.productName?.toLowerCase())
      );
      productCard?.triggerAction?.('click');
      return ActionExecutor.reply(true, `Added ${entities.productName} to cart.`);
    },
  }), [fetchProducts, sortBy]);
  
  useAIContext('product-list', {
    patterns: [
      { intent: 'filter_products', patterns: [/^show\s+([\w\s]+)\s+products?$/i], extractEntities: (m) => ({ category: m[1] }) },
      { intent: 'sort_products', patterns: [/^sort\s+by\s+(\w+)/i], extractEntities: (m) => ({ sortBy: m[1] }) },
      { intent: 'add_to_cart', patterns: [/^add\s+(.+)\s+to\s+cart/i], extractEntities: (m) => ({ productName: m[1] }) },
    ],
    handlers: aiHandlers,
  });
  
  return (/* ... render products ... */);
}
```

**Voice commands on this page:**
- "show electronics products" → filter
- "sort by price" → sort
- "add laptop to cart" → add to cart

**When user leaves this page**, all these patterns/handlers are removed.

### Example 2: Shopping Cart Page

```tsx
// ShoppingCart.tsx
function ShoppingCart() {
  const [cart, setCart] = useState([]);
  
  const removeItem = (itemId) => {
    setCart(cart.filter(item => item.id !== itemId));
  };
  
  const updateQuantity = (itemId, qty) => {
    setCart(cart.map(item => item.id === itemId ? { ...item, quantity: qty } : item));
  };
  
  const aiHandlers = useMemo(() => ({
    remove_from_cart: (entities) => {
      const item = cart.find(i => i.name.toLowerCase().includes(entities.itemName?.toLowerCase()));
      if (item) removeItem(item.id);
      return ActionExecutor.reply(!!item, item ? `Removed ${item.name}.` : 'Item not found.');
    },
    update_quantity: (entities) => {
      const item = cart.find(i => i.name.toLowerCase().includes(entities.itemName?.toLowerCase()));
      if (item) updateQuantity(item.id, entities.quantity);
      return ActionExecutor.reply(!!item, item ? `Set ${item.name} to ${entities.quantity}.` : 'Item not found.');
    },
  }), [cart, removeItem, updateQuantity]);
  
  useAIContext('shopping-cart', {
    patterns: [
      { intent: 'remove_from_cart', patterns: [/^remove\s+(.+)\s+from\s+cart/i], extractEntities: (m) => ({ itemName: m[1] }) },
      { intent: 'update_quantity', patterns: [/^set\s+(.+)\s+(?:to|quantity)\s+(\d+)/i], extractEntities: (m) => ({ itemName: m[1], quantity: parseInt(m[2]) }) },
    ],
    handlers: aiHandlers,
  });
  
  return (/* ... render cart ... */);
}
```

**Voice commands on this page:**
- "remove laptop from cart"
- "set laptop quantity 2"

### Example 3: Multi-Language Support

```tsx
// MovieSearch.tsx (with language support)
function MovieSearch() {
  const { language } = useContext(LanguageContext); // 'en' or 'ja'
  
  const patterns = useMemo(() => {
    if (language === 'ja') {
      return [
        { intent: 'search', patterns: [/^(.+)を検索$/i], extractEntities: (m) => ({ value: m[1] }) },
        { intent: 'navigate', patterns: [/^次$/i, /^前$/i], extractEntities: (m) => ({ direction: m[0] === '次' ? 'next' : 'previous' }) },
      ];
    }
    return [
      { intent: 'search', patterns: [/^search\s+(.+)/i], extractEntities: (m) => ({ value: m[1] }) },
      { intent: 'navigate', patterns: [/^next$/i, /^previous$/i], extractEntities: (m) => ({ direction: m[0] }) },
    ];
  }, [language]);
  
  useAIContext('movie-search', { patterns, handlers: aiHandlers });
  
  return (/* ... */);
}
```

Now when `language` changes, the patterns automatically update.

---

## Benefits

### 1. Scalability

- Add 100 new pages → each registers 5-10 patterns → no conflicts, no monolithic files
- Total active patterns at any time ≈ 20-30 (core + current page)
- Not 500+ patterns loaded all the time

### 2. Maintainability

- Each page owns its voice commands (colocation)
- Changes to Movie page won't break Product page
- No 1000-line switch statement in ActionExecutor

### 3. Performance

- Only relevant patterns are checked during NLU parsing
- Faster regex matching (fewer patterns to check)

### 4. Isolation

- Intent name collisions are fine: Login's "search" vs Movie's "search"
- Dynamic handlers have priority over core handlers

### 5. Developer Experience

- New features don't require modifying core AI files
- Easy to test: mount component → patterns active, unmount → patterns gone
- Clear separation: UI logic in components, AI logic in `useAIContext`

---

## Extending the System

### Adding a New Page with Voice Commands

**Step 1:** Build your UI with AI components

```tsx
import { AIInput, AIButton } from './components/ai';
import { useAIContext } from '../hooks/useAIContext';

function CheckoutPage() {
  const [address, setAddress] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  
  return (
    <div>
      <AIInput id="address" label="Shipping Address" value={address} onChange={setAddress} />
      <AIInput id="card" label="Card Number" value={cardNumber} onChange={setCardNumber} />
      <AIButton id="pay-btn" label="Pay Now" onClick={handlePayment} />
    </div>
  );
}
```

**Step 2:** Define NLU patterns for this page

```tsx
const checkoutPatterns: PatternDef[] = [
  {
    intent: 'fill_address',
    patterns: [/^(?:my\s+)?address\s+(?:is\s+)?(.+)/i],
    extractEntities: (m) => ({ value: m[1]?.trim() }),
  },
  {
    intent: 'fill_card',
    patterns: [/^(?:card|credit\s+card)\s+(\d{4}\s?\d{4}\s?\d{4}\s?\d{4})/i],
    extractEntities: (m) => ({ value: m[1]?.replace(/\s/g, '') }),
  },
  {
    intent: 'checkout',
    patterns: [/^(?:pay|checkout|complete\s+order)$/i],
    extractEntities: () => ({}),
  },
];
```

**Step 3:** Implement action handlers

```tsx
const checkoutHandlers = useMemo(() => ({
  fill_address: (entities) => {
    const input = UIRegistry.getById('address');
    input?.setValue(entities.value || '');
    return ActionExecutor.reply(true, `Address set to ${entities.value}.`);
  },
  fill_card: (entities) => {
    const input = UIRegistry.getById('card');
    input?.setValue(entities.value || '');
    return ActionExecutor.reply(true, 'Card number entered.');
  },
  checkout: async () => {
    const btn = UIRegistry.getById('pay-btn');
    btn?.triggerAction?.('click');
    return ActionExecutor.reply(true, 'Processing payment...');
  },
}), []);
```

**Step 4:** Register with useAIContext

```tsx
useAIContext('checkout-page', {
  patterns: checkoutPatterns,
  handlers: checkoutHandlers,
});
```

**Done!** Users can now say:
- "my address is 123 Main St"
- "card 1234 5678 9012 3456"
- "pay"

### Core Patterns vs Dynamic Patterns

**Core Patterns** (`NLUEngine.CORE_PATTERNS`):
- Universal commands that work on every page
- Examples: "fill username", "click login", "check remember me", "guide me", "help"
- Should rarely be modified

**Dynamic Patterns** (page-specific):
- Page-specific commands that only make sense in certain contexts
- Examples: "search matrix", "next movie", "add to cart", "remove from cart"
- Each page registers its own

**Priority:** Dynamic patterns are checked **first**. If no match, core patterns are checked.

---

## Summary

The **Dynamic AI Context** architecture solves the scalability problem by:

1. **Decentralizing** NLU patterns and action handlers into individual pages/components
2. **Registering** them dynamically when components mount
3. **Unregistering** them automatically when components unmount
4. **Prioritizing** page-specific patterns over universal core patterns

This makes the system:
- **Scalable** (add 100 pages without conflicts)
- **Maintainable** (each page owns its AI logic)
- **Performant** (only relevant patterns active)
- **Flexible** (easy to support i18n, A/B testing, feature flags)

The `useAIContext` hook is the key enabler of this pattern, providing a simple React API for dynamic registration.
