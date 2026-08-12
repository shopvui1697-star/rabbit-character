/**
 * useAIContext - Register page-specific NLU patterns and action handlers.
 *
 * When a component mounts, its patterns and handlers become active.
 * When it unmounts, they are automatically removed.
 *
 * Usage:
 *   useAIContext('movie-search', {
 *     patterns: [
 *       { intent: 'search', patterns: [/^search\s+(.+)/i], extractEntities: (m) => ({ value: m[1] }) },
 *     ],
 *     handlers: {
 *       search: (entities) => { ... return { success, message, shouldSpeak } },
 *     },
 *   });
 */

import { useEffect, useRef } from 'react';
import { NLUEngine, PatternDef } from '../ai/NLUEngine';
import { ActionExecutor, ActionHandler } from '../ai/ActionExecutor';

export interface AIContextOptions {
  /** NLU patterns specific to this page/component */
  patterns?: PatternDef[];
  /** Action handlers specific to this page/component */
  handlers?: Record<string, ActionHandler>;
}

export function useAIContext(key: string, options: AIContextOptions) {
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    const cleanups: (() => void)[] = [];

    if (optsRef.current.patterns?.length) {
      cleanups.push(NLUEngine.registerPatterns(key, optsRef.current.patterns));
    }

    if (optsRef.current.handlers && Object.keys(optsRef.current.handlers).length) {
      cleanups.push(ActionExecutor.registerHandlers(key, optsRef.current.handlers));
    }

    return () => { cleanups.forEach((fn) => fn()); };
  }, [key]);

  // Update registrations when options change (without re-mounting)
  useEffect(() => {
    if (options.patterns?.length) {
      NLUEngine.registerPatterns(key, options.patterns);
    }
    if (options.handlers && Object.keys(options.handlers).length) {
      ActionExecutor.registerHandlers(key, options.handlers);
    }
  });
}
