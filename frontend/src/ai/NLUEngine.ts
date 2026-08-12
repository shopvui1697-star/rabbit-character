/**
 * NLUEngine - Natural Language Understanding
 *
 * Parses user utterances into structured intents and entities.
 * 
 * ARCHITECTURE:
 * - Core patterns are built-in (fill, click, toggle, clear, guide, help, read)
 * - Page-specific patterns are registered dynamically via registerPatterns()
 * - Dynamic patterns are checked FIRST (higher priority, more specific)
 * - When a component unmounts, its patterns are automatically removed
 */

import { UIRegistry, UIElement } from './UIRegistry';

export interface NLUResult {
  intent: string;
  confidence: number;
  entities: {
    field?: string;
    value?: string;
    action?: string;
    element?: UIElement;
  };
  rawText: string;
}

export interface PatternDef {
  intent: string;
  patterns: RegExp[];
  extractEntities: (match: RegExpMatchArray, text: string) => NLUResult['entities'];
}

/** Clean up spaced digits: "1 2 3 4" → "1234" */
function cleanDigits(value: string | undefined): string | undefined {
  return value?.replace(/(\d)\s+(?=\d)/g, '$1');
}

// ─── Core patterns (always available) ────────────────────────────────

const CORE_PATTERNS: PatternDef[] = [
  // Fill field
  {
    intent: 'fill_field',
    patterns: [
      /(?:my\s+)?(\w+(?:\s+\w+)?)\s+(?:is|=)\s+(.+)/i,
      /(?:set|put|type|enter|write|fill(?:\s+in)?)\s+(?:the\s+)?(\w+(?:\s+\w+)?)\s+(?:to|as|with|=)\s+(.+)/i,
      /(?:set|put|type|enter|write|fill(?:\s+in)?)\s+(.+?)\s+(?:in|into|for|on)\s+(?:the\s+)?(\w+(?:\s+\w+)?)/i,
      /(?:the\s+)?(\w+(?:\s+\w+)?)\s+(?:should be|would be|will be)\s+(.+)/i,
      /(?:for\s+)?(?:the\s+)?(\w+(?:\s+\w+)?)\s*[,:]\s+(.+)/i,
      /^(?:my\s+)?(name|username|user|password|pass|email)\s+(.+)$/i,
    ],
    extractEntities: (match) => {
      if (match[0].match(/(?:in|into|for|on)\s+(?:the\s+)?/i)) {
        return { value: cleanDigits(match[1]?.trim()), field: match[2]?.trim() };
      }
      return { field: match[1]?.trim(), value: cleanDigits(match[2]?.trim()) };
    },
  },

  // Click/Submit
  {
    intent: 'click_button',
    patterns: [
      /^(?:click|press|tap|hit|push|open)\s+(?:the\s+)?(?:on\s+)?(.+)/i,
      /^(?:select|pick|choose)\s+(?:number\s+)?(\d+)/i,
      /^(?:select|pick|choose)\s+(?:the\s+)?(.+)/i,
      /^(?:go|do it|ok|okay|submit|send|login|log\s*in|sign\s*in|sign\s*up|register|confirm|cancel|close|save|delete|reset|logout|log\s*out|sign\s*out)$/i,
    ],
    extractEntities: (match, text) => ({
      field: match[1]?.trim() || text.trim(),
      action: 'click',
    }),
  },

  // Select option
  {
    intent: 'select_option',
    patterns: [
      /(?:select|choose|pick)\s+(.+?)\s+(?:for|in|from|on)\s+(?:the\s+)?(\w+(?:\s+\w+)?)/i,
    ],
    extractEntities: (match) => ({
      value: match[1]?.trim(),
      field: match[2]?.trim(),
    }),
  },

  // Toggle
  {
    intent: 'toggle',
    patterns: [
      /(?:check|tick|enable|turn\s+on)\s+(?:the\s+)?(.+)/i,
      /(?:uncheck|untick|disable|turn\s+off)\s+(?:the\s+)?(.+)/i,
    ],
    extractEntities: (match) => ({
      field: match[1]?.trim(),
      action: match[0].match(/^(?:un|dis|turn\s+off)/i) ? 'uncheck' : 'check',
    }),
  },

  // Clear
  {
    intent: 'clear_field',
    patterns: [
      /(?:clear|erase|empty|remove|delete)\s+(?:the\s+)?(\w+(?:\s+\w+)?)/i,
    ],
    extractEntities: (match) => ({ field: match[1]?.trim() }),
  },

  // Guide (MUST be before read_field)
  {
    intent: 'guide',
    patterns: [
      /^(?:guide\s*me|guide\s*through|walk\s*me\s*through|help\s*me\s*fill|step\s*by\s*step|fill\s*(?:the\s+)?form|guided?\s*mode)$/i,
      /^(?:start\s+)?guid(?:e|ed|ing)$/i,
    ],
    extractEntities: () => ({}),
  },

  // Help
  {
    intent: 'help',
    patterns: [
      /^(?:help|what can (?:i|you) do|commands|options|assist)/i,
    ],
    extractEntities: () => ({}),
  },

  // Read field (MUST be last)
  {
    intent: 'read_field',
    patterns: [
      /(?:what(?:'s|\s+is))\s+(?:my\s+|the\s+)?(\w+(?:\s+\w+)?)\s*\??\s*$/i,
      /(?:read|tell\s+me|show\s+me)\s+(?:the\s+)?(\w+(?:\s+\w+)?)/i,
    ],
    extractEntities: (match) => ({ field: match[1]?.trim() }),
  },
];

// ─── NLU Engine ──────────────────────────────────────────────────────

class NLUEngineClass {
  /** Dynamic patterns registered by components (checked FIRST) */
  private dynamicPatterns = new Map<string, PatternDef[]>();

  /**
   * Register page-specific patterns. Returns unregister function.
   * Dynamic patterns are checked before core patterns (higher priority).
   */
  registerPatterns(key: string, patterns: PatternDef[]): () => void {
    this.dynamicPatterns.set(key, patterns);
    return () => { this.dynamicPatterns.delete(key); };
  }

  async parse(text: string): Promise<NLUResult> {
    const cleaned = text.trim();
    if (!cleaned) {
      return { intent: 'unknown', confidence: 0, entities: {}, rawText: text };
    }

    // Dynamic patterns first (page-specific, higher priority)
    const dynamicResult = this.matchPatterns(cleaned, this.getDynamicPatterns());
    if (dynamicResult && dynamicResult.confidence >= 0.6) {
      dynamicResult.entities.element = this.resolveElement(dynamicResult);
      return dynamicResult;
    }

    // Core patterns second
    const coreResult = this.matchPatterns(cleaned, CORE_PATTERNS);
    if (coreResult && coreResult.confidence >= 0.6) {
      coreResult.entities.element = this.resolveElement(coreResult);
      return coreResult;
    }

    // Heuristic matching (button labels)
    const heuristicResult = this.heuristicMatch(cleaned);
    if (heuristicResult && heuristicResult.confidence >= 0.5) {
      return heuristicResult;
    }

    // Return best partial result or unknown
    const best = dynamicResult || coreResult;
    if (best) {
      best.entities.element = this.resolveElement(best);
      return best;
    }

    return { intent: 'unknown', confidence: 0.1, entities: {}, rawText: text };
  }

  private getDynamicPatterns(): PatternDef[] {
    const all: PatternDef[] = [];
    for (const patterns of this.dynamicPatterns.values()) {
      all.push(...patterns);
    }
    return all;
  }

  private matchPatterns(text: string, patterns: PatternDef[]): NLUResult | null {
    for (const pattern of patterns) {
      for (const regex of pattern.patterns) {
        const match = text.match(regex);
        if (match) {
          return {
            intent: pattern.intent,
            confidence: 0.8,
            entities: pattern.extractEntities(match, text),
            rawText: text,
          };
        }
      }
    }
    return null;
  }

  private heuristicMatch(text: string): NLUResult | null {
    const elements = UIRegistry.getAll();
    const lower = text.toLowerCase();

    for (const btn of elements.filter((el) => el.type === 'button')) {
      const label = btn.label.toLowerCase();
      if (label.includes(lower) || lower.includes(label) ||
          btn.aiHints.some((h) => h.toLowerCase().includes(lower) || lower.includes(h.toLowerCase()))) {
        return {
          intent: 'click_button',
          confidence: 0.7,
          entities: { field: btn.label, element: btn, action: 'click' },
          rawText: text,
        };
      }
    }

    return null;
  }

  private resolveElement(result: NLUResult): UIElement | undefined {
    if (result.entities.element) return result.entities.element;
    if (!result.entities.field) return undefined;

    const matches = UIRegistry.findByQuery(result.entities.field);
    if (matches.length === 0) return undefined;

    const typeMap: Record<string, string[]> = {
      fill_field:    ['input', 'textarea'],
      clear_field:   ['input', 'textarea'],
      click_button:  ['button'],
      select_option: ['select'],
      toggle:        ['checkbox', 'radio'],
    };

    const preferredTypes = typeMap[result.intent];
    if (preferredTypes) {
      const typed = matches.filter((m) => preferredTypes.includes(m.type));
      if (typed.length > 0) return typed[0];
    }

    return matches[0];
  }
}

export const NLUEngine = new NLUEngineClass();
