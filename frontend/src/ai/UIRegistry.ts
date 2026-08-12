/**
 * UIRegistry - Central registry for AI-aware UI components.
 *
 * Components register here with semantic metadata so the AI
 * can understand and interact with the current UI.
 */

export type UIElementType = 'input' | 'button' | 'select' | 'checkbox' | 'radio' | 'textarea' | 'form';
export type UIAction = 'fill' | 'click' | 'select' | 'toggle' | 'submit' | 'clear';

export interface UIElement {
  id: string;
  type: UIElementType;
  label: string;
  inputType?: string;
  aiHints: string[];
  actions: UIAction[];
  getValue: () => string;
  setValue?: (value: string) => void;
  triggerAction?: (action: UIAction) => void;
  isActive: () => boolean;
  formId?: string;
  validation?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  group?: string;
}

export interface FormError {
  fieldId?: string;
  message: string;
  timestamp: number;
}

type ErrorListener = (error: FormError) => void;

class UIRegistryClass {
  private elements = new Map<string, UIElement>();
  private errorListeners = new Set<ErrorListener>();

  register(element: UIElement): () => void {
    this.elements.set(element.id, element);
    return () => { this.elements.delete(element.id); };
  }

  update(id: string, updates: Partial<UIElement>): void {
    const existing = this.elements.get(id);
    if (existing) this.elements.set(id, { ...existing, ...updates });
  }

  getAll(): UIElement[] {
    return Array.from(this.elements.values()).filter((el) => el.isActive());
  }

  getById(id: string): UIElement | undefined {
    return this.elements.get(id);
  }

  findByQuery(query: string): UIElement[] {
    const q = query.toLowerCase().trim();
    const scored: Array<{ element: UIElement; score: number }> = [];

    for (const element of this.getAll()) {
      let best = 0;
      best = Math.max(best, this.fuzzyMatch(q, element.label.toLowerCase()));
      for (const hint of element.aiHints) {
        best = Math.max(best, this.fuzzyMatch(q, hint.toLowerCase()));
      }
      best = Math.max(best, this.fuzzyMatch(q, element.id.toLowerCase()) * 0.5);
      if (best > 0.3) scored.push({ element, score: best });
    }

    return scored.sort((a, b) => b.score - a.score).map((r) => r.element);
  }

  findByAction(action: UIAction): UIElement[] {
    return this.getAll().filter((el) => el.actions.includes(action));
  }

  reportError(error: FormError): void {
    this.errorListeners.forEach((listener) => listener(error));
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => { this.errorListeners.delete(listener); };
  }

  private fuzzyMatch(query: string, target: string): number {
    if (query === target) return 1;
    if (target.includes(query)) return 0.9;
    if (query.includes(target)) return 0.7;

    const queryWords = query.split(/\s+/);
    const targetWords = target.split(/\s+/);
    let matched = 0;
    for (const qw of queryWords) {
      if (targetWords.some((tw) => tw.includes(qw) || qw.includes(tw))) matched++;
    }
    return queryWords.length > 0 ? (matched / queryWords.length) * 0.8 : 0;
  }
}

export const UIRegistry = new UIRegistryClass();
