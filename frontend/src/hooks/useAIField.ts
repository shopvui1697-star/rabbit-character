/**
 * useAIField - Hook for registering a UI element with the AI system.
 * Bridge between React components and the AI's UIRegistry.
 */

import { useEffect, useRef, useCallback } from 'react';
import { UIRegistry, UIElement, UIElementType, UIAction } from '../ai/UIRegistry';

export interface UseAIFieldOptions {
  id: string;
  type: UIElementType;
  label: string;
  inputType?: string;
  aiHints?: string[];
  actions?: UIAction[];
  formId?: string;
  getValue?: () => string;
  setValue?: (value: string) => void;
  triggerAction?: (action: UIAction) => void;
  options?: Array<{ value: string; label: string }>;
  validation?: string;
  placeholder?: string;
  group?: string;
  isActive?: boolean;
}

const DEFAULT_ACTIONS: Record<string, UIAction[]> = {
  input: ['fill', 'clear'],
  textarea: ['fill', 'clear'],
  button: ['click'],
  select: ['select'],
  checkbox: ['toggle'],
  radio: ['toggle'],
  form: ['submit'],
};

function defaultHints(label: string): string[] {
  const lower = label.toLowerCase();
  const words = lower.split(/\s+/);
  return words.length > 1 ? [lower, ...words] : [lower];
}

export function useAIField(options: UseAIFieldOptions) {
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    const o = optsRef.current;
    // IMPORTANT: All callbacks read through optsRef.current so they always
    // use the latest closure from the most recent render. Without this,
    // callbacks like triggerAction would capture stale state (e.g. an old
    // handleSubmit that still sees empty username/password).
    const element: UIElement = {
      id: o.id,
      type: o.type,
      label: o.label,
      inputType: o.inputType,
      aiHints: o.aiHints || defaultHints(o.label),
      actions: o.actions || DEFAULT_ACTIONS[o.type] || [],
      getValue: () => (optsRef.current.getValue ?? (() => ''))(),
      setValue: (v) => optsRef.current.setValue?.(v),
      triggerAction: (a) => optsRef.current.triggerAction?.(a),
      isActive: () => optsRef.current.isActive !== false,
      formId: o.formId,
      validation: o.validation,
      placeholder: o.placeholder,
      options: o.options,
      group: o.group,
    };
    return UIRegistry.register(element);
  }, [options.id, options.type, options.label, options.formId, options.isActive]);

  useEffect(() => {
    UIRegistry.update(options.id, {
      options: options.options,
      placeholder: options.placeholder,
      validation: options.validation,
    });
  }, [options.id, options.options, options.placeholder, options.validation]);
}
