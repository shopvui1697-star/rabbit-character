/**
 * LoginForm - Example form demonstrating AI voice interaction
 *
 * This is a standard login form built with AI-aware components.
 * Every field and button is voice-controllable:
 *
 * Voice commands:
 *   "my name is Honda"        → fills username
 *   "password is 12345"       → fills password
 *   "check remember me"       → toggles checkbox
 *   "login" / "ok" / "submit" → submits form
 *
 * When login fails, the AI will speak the error message.
 */

import React, { useState, useCallback } from 'react';
import { AIInput, AIButton, AICheckbox } from './ai';
import { UIRegistry } from '../ai/UIRegistry';

interface LoginFormProps {
  onLoginSuccess?: (user: string) => void;
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!username.trim()) {
      errors.username = 'Username is required';
    }
    if (!password.trim()) {
      errors.password = 'Password is required';
    } else if (password.length < 4) {
      errors.password = 'Password must be at least 4 characters';
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      // Report errors to AI system
      const errorMessages = Object.values(errors).join('. ');
      UIRegistry.reportError({
        message: `Form validation failed: ${errorMessages}`,
        timestamp: Date.now(),
      });
      return false;
    }

    return true;
  }, [username, password]);

  const handleSubmit = useCallback(async () => {
    setError('');

    if (!validate()) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        setIsLoading(false);
        onLoginSuccess?.(data.user?.username || username);
        UIRegistry.reportError({
          message: data.message || `Welcome back, ${username}!`,
          timestamp: Date.now(),
        });
      } else {
        setIsLoading(false);
        const errorMsg = data.message || 'Invalid username or password.';
        setError(errorMsg);
        UIRegistry.reportError({
          fieldId: 'login-form',
          message: errorMsg,
          timestamp: Date.now(),
        });
      }
    } catch (err: any) {
      setIsLoading(false);
      const errorMsg = 'Cannot connect to server. Please try again later.';
      setError(errorMsg);
      UIRegistry.reportError({
        fieldId: 'login-form',
        message: errorMsg,
        timestamp: Date.now(),
      });
    }
  }, [username, password, validate, onLoginSuccess]);

  return (
    <div className="login-form">
      <div className="login-form__header">
        <div className="login-form__logo">
          <svg width="48" height="48" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="#e94560" />
            <path d="M30 45 Q50 25 70 45 Q50 70 30 45Z" fill="white" opacity="0.9" />
            <circle cx="42" cy="42" r="4" fill="#1a1a2e" />
            <circle cx="58" cy="42" r="4" fill="#1a1a2e" />
          </svg>
        </div>
        <h1 className="login-form__title">Rabbit V2</h1>
        <p className="login-form__subtitle">Voice-Powered Login</p>
      </div>

      {error && (
        <div className="login-form__error-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
          {error}
        </div>
      )}

      <div className="login-form__fields">
        <AIInput
          id="username"
          label="Username"
          value={username}
          onChange={(val) => {
            setUsername(val);
            setFieldErrors((prev) => ({ ...prev, username: '' }));
          }}
          aiHints={['name', 'username', 'user name', 'my name', 'user', 'login name']}
          formId="login"
          placeholder="Enter your username"
          error={fieldErrors.username}
          autoComplete="username"
        />

        <AIInput
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={(val) => {
            setPassword(val);
            setFieldErrors((prev) => ({ ...prev, password: '' }));
          }}
          aiHints={['password', 'pass', 'secret', 'pin', 'passcode']}
          formId="login"
          placeholder="Enter your password"
          validation="Minimum 4 characters"
          error={fieldErrors.password}
          autoComplete="current-password"
        />

        <AICheckbox
          id="remember-me"
          label="Remember me"
          checked={rememberMe}
          onChange={setRememberMe}
          aiHints={['remember', 'remember me', 'keep logged in', 'stay signed in']}
          formId="login"
        />
      </div>

      <div className="login-form__actions">
        <AIButton
          id="login-btn"
          label="Login"
          onClick={handleSubmit}
          aiHints={['login', 'log in', 'sign in', 'signin', 'submit', 'ok', 'okay', 'go', 'enter', 'do it', 'continue']}
          formId="login"
          loading={isLoading}
          variant="primary"
        />
      </div>

      <div className="login-form__hint">
        <p>
          <strong>Try voice commands:</strong>
        </p>
        <ul>
          <li><strong>"Guide me"</strong> - step-by-step help</li>
          <li>"My name is Honda"</li>
          <li>"Password is 1234"</li>
          <li>"Check remember me"</li>
          <li>"Login" or "OK"</li>
        </ul>
      </div>
    </div>
  );
}
