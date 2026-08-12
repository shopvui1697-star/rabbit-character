/**
 * ActionExecutor - Maps NLU intents to UI actions and generates responses.
 *
 * ARCHITECTURE:
 * - Core handlers are built-in (fill, click, toggle, clear, read, guide, help)
 * - Page-specific handlers are registered dynamically via registerHandler()
 * - Dynamic handlers override core handlers for their intents
 * - When a component unmounts, its handlers are automatically removed
 */

import { UIRegistry } from './UIRegistry';
import { NLUResult } from './NLUEngine';
import { VoiceEngine } from './VoiceEngine';

export interface ActionResult {
  success: boolean;
  message: string;
  shouldSpeak: boolean;
}

export type ActionHandler = (entities: NLUResult['entities'], nluResult: NLUResult) => ActionResult | Promise<ActionResult>;

class ActionExecutorClass {
  /** Dynamic handlers registered by components */
  private dynamicHandlers = new Map<string, Map<string, ActionHandler>>();

  /**
   * Register page-specific action handlers. Returns unregister function.
   * Dynamic handlers take priority over core handlers.
   */
  registerHandlers(key: string, handlers: Record<string, ActionHandler>): () => void {
    this.dynamicHandlers.set(key, new Map(Object.entries(handlers)));
    return () => { this.dynamicHandlers.delete(key); };
  }

  async execute(nluResult: NLUResult): Promise<ActionResult> {
    const { intent, entities } = nluResult;

    // Check dynamic handlers first (page-specific)
    for (const handlers of this.dynamicHandlers.values()) {
      const handler = handlers.get(intent);
      if (handler) return handler(entities, nluResult);
    }

    // Core handlers
    switch (intent) {
      case 'fill_field':    return this.fill(entities);
      case 'click_button':  return this.click(entities);
      case 'select_option': return this.select(entities);
      case 'toggle':        return this.toggle(entities);
      case 'clear_field':   return this.clear(entities);
      case 'read_field':    return this.read(entities);
      case 'guide':         return { success: true, message: '__START_GUIDED_MODE__', shouldSpeak: false };
      case 'help':          return this.help();
      default:
        return this.reply(false, this.unknownMessage());
    }
  }

  async executeAndSpeak(nluResult: NLUResult): Promise<ActionResult> {
    const result = await this.execute(nluResult);
    if (result.shouldSpeak) {
      try { await VoiceEngine.speak(result.message); } catch { /* ignore */ }
    }
    return result;
  }

  /** Helper for building ActionResult (public so pages can use it) */
  reply(success: boolean, message: string): ActionResult {
    return { success, message, shouldSpeak: true };
  }

  // ─── Core Handlers ────────────────────────────────────────────────

  private fill(e: NLUResult['entities']): ActionResult {
    if (!e.element) return this.reply(false, `I couldn't find "${e.field || 'unknown'}". ${this.listFields()}`);
    if (!e.element.setValue) return this.reply(false, `"${e.element.label}" cannot be edited.`);
    e.element.setValue(e.value || '');
    return this.reply(true, `Set ${e.element.label} to "${e.value}".`);
  }

  private click(e: NLUResult['entities']): ActionResult {
    if (!e.element) {
      const buttons = UIRegistry.findByAction('click');
      if (buttons.length === 1) {
        buttons[0].triggerAction?.('click');
        return this.reply(true, `Clicked ${buttons[0].label}.`);
      }
      return this.reply(false, `I couldn't find "${e.field || 'unknown'}". ${this.listButtons()}`);
    }
    e.element.triggerAction?.('click');
    return this.reply(true, `Clicked ${e.element.label}.`);
  }

  private select(e: NLUResult['entities']): ActionResult {
    if (!e.element) return this.reply(false, `I couldn't find dropdown "${e.field || 'unknown'}".`);
    if (!e.value) {
      const opts = e.element.options?.map((o) => o.label).join(', ') || 'none';
      return this.reply(false, `Which option for ${e.element.label}? Options: ${opts}`);
    }
    if (e.element.options) {
      const lower = e.value.toLowerCase();
      const match = e.element.options.find((o) =>
        o.label.toLowerCase().includes(lower) || o.value.toLowerCase().includes(lower));
      if (match) { e.element.setValue?.(match.value); return this.reply(true, `Selected "${match.label}" for ${e.element.label}.`); }
    }
    e.element.setValue?.(e.value);
    return this.reply(true, `Set ${e.element.label} to "${e.value}".`);
  }

  private toggle(e: NLUResult['entities']): ActionResult {
    if (!e.element) return this.reply(false, `I couldn't find "${e.field || 'unknown'}" to toggle.`);
    e.element.triggerAction?.('toggle');
    return this.reply(true, `${e.action === 'uncheck' ? 'Unchecked' : 'Checked'} ${e.element.label}.`);
  }

  private clear(e: NLUResult['entities']): ActionResult {
    if (!e.element) return this.reply(false, `I couldn't find "${e.field || 'unknown'}" to clear.`);
    e.element.setValue?.('');
    return this.reply(true, `Cleared ${e.element.label}.`);
  }

  private read(e: NLUResult['entities']): ActionResult {
    if (!e.element) return this.reply(false, `I couldn't find "${e.field || 'unknown'}".`);
    const val = e.element.getValue();
    return this.reply(true, val ? `${e.element.label} is "${val}".` : `${e.element.label} is empty.`);
  }

  private help(): ActionResult {
    const elements = UIRegistry.getAll();
    if (elements.length === 0) return this.reply(true, 'There are no interactive elements on screen right now.');
    const fields = elements.filter((el) => el.type === 'input' || el.type === 'textarea').map((el) => el.label);
    const buttons = elements.filter((el) => el.type === 'button').map((el) => el.label);
    let msg = 'Here is what you can do. ';
    if (fields.length) msg += `Fill in: ${fields.join(', ')}. `;
    if (buttons.length) msg += `Click: ${buttons.join(', ')}. Just say the button name. `;
    if (fields.length) msg += 'Say "guide me" for step-by-step help.';
    return this.reply(true, msg);
  }

  private unknownMessage(): string {
    const elements = UIRegistry.getAll();
    if (elements.length === 0) return 'There are no interactive elements on screen right now.';
    const buttons = elements.filter((el) => el.type === 'button').map((el) => el.label);
    const fields = elements.filter((el) => el.type === 'input' || el.type === 'textarea').map((el) => el.label);
    let msg = 'I didn\'t understand that. ';
    if (buttons.length) msg += `You can say "${buttons[0]}". `;
    if (fields.length) msg += `You can fill fields like "${fields[0]}". `;
    if (fields.length) msg += 'Or say "help" for all options.';
    else msg += 'Say "help" for options.';
    return msg;
  }

  private listFields(): string {
    const f = UIRegistry.findByAction('fill');
    return f.length ? `Available: ${f.map((x) => x.label).join(', ')}.` : '';
  }

  private listButtons(): string {
    const b = UIRegistry.findByAction('click');
    return b.length ? `Available: ${b.map((x) => x.label).join(', ')}.` : '';
  }
}

export const ActionExecutor = new ActionExecutorClass();
