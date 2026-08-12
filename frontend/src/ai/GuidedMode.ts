/**
 * GuidedMode - Step-by-step voice-guided form filling
 *
 * When the user says "guide me", this module:
 * 1. Scans UIRegistry for interactive elements
 * 2. Builds a step list (inputs → selects → checkboxes → submit buttons)
 * 3. Asks a question for each step via TTS
 * 4. Waits for the user's answer and fills the value
 * 5. Repeats until all steps are done
 *
 * Navigation commands: "skip", "back", "cancel"
 */

import { UIRegistry, UIElement } from './UIRegistry';
import { VoiceEngine } from './VoiceEngine';

// ─── Types ──────────────────────────────────────────────────────────

export type GuidedStepType = 'fill' | 'toggle' | 'confirm';
export type GuidedModeStatus = 'idle' | 'asking' | 'waiting' | 'processing' | 'complete';

export interface GuidedStep {
  element: UIElement;
  type: GuidedStepType;
  question: string;
  completed: boolean;
  skipped: boolean;
  answer?: string;
}

export interface GuidedModeEvent {
  type: 'start' | 'ask' | 'answer' | 'fill' | 'skip' | 'back' | 'complete' | 'cancel' | 'error';
  step?: GuidedStep;
  stepIndex?: number;
  totalSteps?: number;
  message: string;
}

type GuidedModeListener = (event: GuidedModeEvent) => void;

// ─── Word lists ─────────────────────────────────────────────────────

const YES = ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'yea', 'correct', 'right', 'true', 'please', 'do it'];
const NO = ['no', 'nah', 'nope', "don't", 'negative', 'false', 'skip it'];
const SKIP = ['skip', 'next', 'pass'];
const BACK = ['back', 'previous', 'go back', 'undo'];
const CANCEL = ['cancel', 'stop', 'quit', 'exit', 'nevermind', 'never mind'];

function matchesAny(text: string, words: string[]): boolean {
  return words.some((w) => text === w || text.startsWith(w + ' '));
}

// ─── Engine ─────────────────────────────────────────────────────────

class GuidedModeClass {
  private steps: GuidedStep[] = [];
  private currentIdx = 0;
  private status: GuidedModeStatus = 'idle';
  private listeners = new Set<GuidedModeListener>();

  isActive(): boolean { return this.status !== 'idle' && this.status !== 'complete'; }
  getStatus(): GuidedModeStatus { return this.status; }

  getCurrentStep(): { step: GuidedStep; index: number; total: number } | null {
    if (!this.isActive() || this.currentIdx >= this.steps.length) return null;
    return { step: this.steps[this.currentIdx], index: this.currentIdx, total: this.steps.length };
  }

  async start(): Promise<void> {
    const elements = UIRegistry.getAll();
    if (elements.length === 0) {
      this.emit({ type: 'error', message: 'No interactive elements on screen.' });
      return;
    }

    this.steps = [
      ...this.buildSteps(elements, ['input', 'textarea'], 'fill'),
      ...this.buildSelectSteps(elements),
      ...this.buildToggleSteps(elements),
      ...this.buildConfirmSteps(elements),
    ];

    if (this.steps.length === 0) {
      this.emit({ type: 'error', message: 'No fields found to fill in.' });
      return;
    }

    this.currentIdx = 0;
    this.status = 'asking';

    const fieldCount = this.steps.filter((s) => s.type !== 'confirm').length;
    const msg = `Starting guided mode. ${fieldCount} field${fieldCount !== 1 ? 's' : ''} to fill. Say "skip", "back", or "cancel" at any time.`;
    this.emit({ type: 'start', message: msg, totalSteps: this.steps.length });
    await VoiceEngine.speak(msg);
    await this.askCurrent();
  }

  async handleAnswer(text: string): Promise<void> {
    if (!this.isActive()) return;
    const lower = text.trim().toLowerCase();

    if (matchesAny(lower, CANCEL)) { await this.cancel(); return; }
    if (matchesAny(lower, SKIP))   { await this.skipCurrent(); return; }
    if (matchesAny(lower, BACK))   { await this.goBack(); return; }

    const step = this.steps[this.currentIdx];
    if (!step) return;
    this.status = 'processing';

    switch (step.type) {
      case 'fill':    await this.handleFill(step, text); break;
      case 'toggle':  await this.handleToggle(step, lower); break;
      case 'confirm': await this.handleConfirm(step, lower); break;
    }
  }

  async cancel(): Promise<void> {
    this.reset();
    const msg = 'Guided mode cancelled.';
    this.emit({ type: 'cancel', message: msg });
    await VoiceEngine.speak(msg);
  }

  onEvent(listener: GuidedModeListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  // ─── Step Builders ────────────────────────────────────────────────

  private buildSteps(elements: UIElement[], types: string[], stepType: GuidedStepType): GuidedStep[] {
    return elements.filter((el) => types.includes(el.type)).map((el) => {
      const val = el.getValue();
      return {
        element: el, type: stepType, completed: false, skipped: false,
        question: val ? `${el.label} has "${val}". Say new value or "skip".` : `What is your ${el.label}?`,
      };
    });
  }

  private buildSelectSteps(elements: UIElement[]): GuidedStep[] {
    return elements.filter((el) => el.type === 'select').map((el) => {
      const opts = el.options?.map((o) => o.label).join(', ') || '';
      return {
        element: el, type: 'fill' as GuidedStepType, completed: false, skipped: false,
        question: opts ? `For ${el.label}, options are: ${opts}.` : `What for ${el.label}?`,
      };
    });
  }

  private buildToggleSteps(elements: UIElement[]): GuidedStep[] {
    return elements.filter((el) => el.type === 'checkbox' || el.type === 'radio').map((el) => ({
      element: el, type: 'toggle' as GuidedStepType, completed: false, skipped: false,
      question: `Enable "${el.label}"? Currently ${el.getValue() === 'checked' ? 'checked' : 'unchecked'}. Yes or no?`,
    }));
  }

  private buildConfirmSteps(elements: UIElement[]): GuidedStep[] {
    return elements.filter((el) => el.type === 'button').map((el) => ({
      element: el, type: 'confirm' as GuidedStepType, completed: false, skipped: false,
      question: `Click "${el.label}"?`,
    }));
  }

  // ─── Answer Handlers ──────────────────────────────────────────────

  private async handleFill(step: GuidedStep, raw: string): Promise<void> {
    const value = raw.trim().replace(/(\d)\s+(?=\d)/g, '$1');
    step.element.setValue?.(value);
    step.completed = true;
    step.answer = value;

    const display = step.element.inputType === 'password' ? `${value.length} characters` : `"${value}"`;
    const msg = `Got it! ${step.element.label} set to ${display}.`;
    this.emitStep('fill', step, msg);
    await VoiceEngine.speak(msg);
    await this.advance();
  }

  private async handleToggle(step: GuidedStep, answer: string): Promise<void> {
    const isYes = matchesAny(answer, YES);
    const isNo = matchesAny(answer, NO);

    if (!isYes && !isNo) {
      const msg = `Say yes or no for "${step.element.label}".`;
      this.emit({ type: 'ask', step, message: msg });
      this.status = 'waiting';
      await VoiceEngine.speak(msg);
      return;
    }

    const checked = step.element.getValue() === 'checked';
    if ((isYes && !checked) || (isNo && checked)) step.element.triggerAction?.('toggle');
    step.completed = true;
    step.answer = isYes ? 'yes' : 'no';

    const msg = `${step.element.label} ${isYes ? 'enabled' : 'left unchecked'}.`;
    this.emitStep('fill', step, msg);
    await VoiceEngine.speak(msg);
    await this.advance();
  }

  private async handleConfirm(step: GuidedStep, answer: string): Promise<void> {
    const isYes = matchesAny(answer, YES);
    const isNo = matchesAny(answer, NO);

    if (!isYes && !isNo) {
      const msg = `Click "${step.element.label}"? Say yes or no.`;
      this.emit({ type: 'ask', step, message: msg });
      this.status = 'waiting';
      await VoiceEngine.speak(msg);
      return;
    }

    if (isYes) {
      step.completed = true;
      step.answer = 'yes';
      const msg = `Clicking ${step.element.label}...`;
      this.emitStep('fill', step, msg);
      await VoiceEngine.speak(msg);

      step.element.triggerAction?.('click');

      // Wait for async action result (e.g. API error)
      const result = await this.waitForActionResult(5000);
      if (result) {
        const type = result.startsWith('Welcome') ? 'complete' : 'error';
        this.emit({ type, step, message: result, stepIndex: this.currentIdx, totalSteps: this.steps.length });
        await VoiceEngine.speak(result);
      }
    } else {
      step.skipped = true;
      step.answer = 'no';
      const msg = `Skipped ${step.element.label}.`;
      this.emitStep('skip', step, msg);
      await VoiceEngine.speak(msg);
    }

    await this.advance();
  }

  // ─── Navigation ───────────────────────────────────────────────────

  private async askCurrent(): Promise<void> {
    const step = this.steps[this.currentIdx];
    if (!step) { await this.complete(); return; }
    this.status = 'waiting';
    const msg = `Step ${this.currentIdx + 1} of ${this.steps.length}. ${step.question}`;
    this.emit({ type: 'ask', step, stepIndex: this.currentIdx, totalSteps: this.steps.length, message: msg });
    await VoiceEngine.speak(msg);
  }

  private async advance(): Promise<void> {
    this.currentIdx++;
    if (this.currentIdx >= this.steps.length) { await this.complete(); return; }
    await this.askCurrent();
  }

  private async skipCurrent(): Promise<void> {
    const step = this.steps[this.currentIdx];
    if (step) {
      step.skipped = true;
      const msg = `Skipped ${step.element.label}.`;
      this.emitStep('skip', step, msg);
      await VoiceEngine.speak(msg);
    }
    await this.advance();
  }

  private async goBack(): Promise<void> {
    if (this.currentIdx === 0) {
      await VoiceEngine.speak('Already at the first step.');
      await this.askCurrent();
      return;
    }
    this.currentIdx--;
    const step = this.steps[this.currentIdx];
    Object.assign(step, { completed: false, skipped: false, answer: undefined });
    const msg = `Going back to ${step.element.label}.`;
    this.emitStep('back', step, msg);
    await VoiceEngine.speak(msg);
    await this.askCurrent();
  }

  private async complete(): Promise<void> {
    const nonConfirm = this.steps.filter((s) => s.type !== 'confirm');
    const filled = nonConfirm.filter((s) => s.completed).length;
    const skipped = nonConfirm.filter((s) => s.skipped).length;
    let msg = `Guided mode complete! Filled ${filled} of ${nonConfirm.length} fields.`;
    if (skipped) msg += ` ${skipped} skipped.`;
    this.emit({ type: 'complete', message: msg, totalSteps: this.steps.length });
    await VoiceEngine.speak(msg);
    this.reset();
  }

  private reset(): void {
    this.status = 'idle';
    this.steps = [];
    this.currentIdx = 0;
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private waitForActionResult(timeoutMs: number): Promise<string | null> {
    return new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => { if (!done) { done = true; unsub(); resolve(null); } }, timeoutMs);
      const unsub = UIRegistry.onError((err) => {
        if (!done) { done = true; clearTimeout(timer); unsub(); resolve(err.message); }
      });
    });
  }

  private emitStep(type: GuidedModeEvent['type'], step: GuidedStep, message: string): void {
    this.emit({ type, step, stepIndex: this.currentIdx, totalSteps: this.steps.length, message });
  }

  private emit(event: GuidedModeEvent): void {
    this.listeners.forEach((fn) => fn(event));
  }
}

export const GuidedMode = new GuidedModeClass();
