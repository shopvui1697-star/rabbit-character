/**
 * AIButton - AI-aware button component.
 * Can be triggered via voice commands like "login", "submit", "ok".
 */

import React from 'react';
import { useAIField } from '../../hooks/useAIField';

export interface AIButtonProps {
  id: string;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  aiHints?: string[];
  formId?: string;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  children?: React.ReactNode;
}

export function AIButton({
  id, label, onClick, variant = 'primary', aiHints, formId,
  disabled = false, loading = false, type = 'button', className = '', children,
}: AIButtonProps) {
  useAIField({
    id,
    type: 'button',
    label,
    aiHints: aiHints || [label.toLowerCase()],
    formId,
    isActive: !disabled && !loading,
    getValue: () => label,
    triggerAction: () => { if (!disabled && !loading) onClick(); },
  });

  return (
    <button
      id={id}
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`ai-button ai-button--${variant} ${loading ? 'ai-button--loading' : ''} ${className}`}
      aria-label={label}
    >
      {loading && <span className="ai-button__spinner" />}
      <span className="ai-button__text">{children || label}</span>
    </button>
  );
}
