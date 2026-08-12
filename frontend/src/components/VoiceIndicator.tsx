/**
 * VoiceIndicator - Shows voice status, conversation log, and text input
 *
 * This is the main AI interaction panel that shows:
 * - Microphone toggle button with status animation
 * - Guided mode indicator (when active)
 * - Conversation log (user utterances + AI responses + guided steps)
 * - Text input fallback (for typing commands)
 * - Interim transcript display
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAI, ConversationEntry } from '../ai/AIProvider';

export function VoiceIndicator() {
  const {
    voiceStatus,
    isVoiceEnabled,
    toggleVoice,
    conversation,
    interimTranscript,
    processTextInput,
    isProcessing,
    isGuidedMode,
  } = useAI();

  const [textInput, setTextInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll conversation log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [conversation, interimTranscript]);

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    await processTextInput(textInput.trim());
    setTextInput('');
  };

  const getStatusText = () => {
    if (isGuidedMode) {
      switch (voiceStatus) {
        case 'listening':
          return 'Guided Mode - Listening...';
        case 'speaking':
          return 'Guided Mode - Speaking...';
        default:
          return 'Guided Mode';
      }
    }
    switch (voiceStatus) {
      case 'listening':
        return 'Listening...';
      case 'processing':
        return 'Processing...';
      case 'speaking':
        return 'Speaking...';
      case 'error':
        return 'Error';
      default:
        return isVoiceEnabled ? 'Ready' : 'Voice Off';
    }
  };

  const getStatusColor = () => {
    if (isGuidedMode) return '#a78bfa'; // Purple for guided mode
    switch (voiceStatus) {
      case 'listening':
        return '#4ade80';
      case 'processing':
        return '#fbbf24';
      case 'speaking':
        return '#60a5fa';
      case 'error':
        return '#f87171';
      default:
        return '#6b7280';
    }
  };

  return (
    <div className={`voice-indicator ${isExpanded ? 'voice-indicator--expanded' : ''} ${isGuidedMode ? 'voice-indicator--guided' : ''}`}>
      {/* Header */}
      <div className="voice-indicator__header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="voice-indicator__status">
          <div
            className={`voice-indicator__dot ${voiceStatus === 'listening' ? 'voice-indicator__dot--pulse' : ''} ${isGuidedMode ? 'voice-indicator__dot--guided' : ''}`}
            style={{ backgroundColor: getStatusColor() }}
          />
          <span className="voice-indicator__status-text">{getStatusText()}</span>
          {isGuidedMode && (
            <span className="voice-indicator__guided-badge">GUIDED</span>
          )}
        </div>
        <div className="voice-indicator__actions">
          <button
            className={`voice-indicator__mic-btn ${isVoiceEnabled ? 'voice-indicator__mic-btn--active' : ''} ${isGuidedMode ? 'voice-indicator__mic-btn--guided' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleVoice();
            }}
            title={isVoiceEnabled ? 'Disable voice' : 'Enable voice'}
          >
            {isVoiceEnabled ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
              </svg>
            )}
          </button>
          <button
            className="voice-indicator__toggle-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? '\u25BC' : '\u25B2'}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <>
          {/* Conversation Log */}
          <div className="voice-indicator__log" ref={logRef}>
            {conversation.length === 0 && (
              <div className="voice-indicator__empty">
                Click the microphone to start voice control, or type a command below.
                <br />
                <small>Try: "my name is Honda", "password is 1234", or "guide me"</small>
              </div>
            )}
            {conversation.map((entry) => (
              <ConversationBubble key={entry.id} entry={entry} />
            ))}
            {interimTranscript && (
              <div className="voice-indicator__interim">
                <span className="voice-indicator__interim-dot" /> {interimTranscript}
              </div>
            )}
            {isProcessing && (
              <div className="voice-indicator__processing">
                <span className="voice-indicator__spinner" /> Processing...
              </div>
            )}
          </div>

          {/* Text Input Fallback */}
          <form className="voice-indicator__input-form" onSubmit={handleTextSubmit}>
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={isGuidedMode ? 'Type your answer...' : 'Type a command (e.g., "guide me")'}
              className="voice-indicator__text-input"
            />
            <button type="submit" className="voice-indicator__send-btn" disabled={!textInput.trim()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </form>
        </>
      )}
    </div>
  );
}

function ConversationBubble({ entry }: { entry: ConversationEntry }) {
  const getIcon = () => {
    switch (entry.type) {
      case 'user':
        return '\uD83D\uDDE3\uFE0F';
      case 'ai':
        return '\uD83E\uDD16';
      case 'guide':
        return '\uD83E\uDDED';
      case 'error':
        return '\u26A0\uFE0F';
      case 'system':
        return '\u2139\uFE0F';
    }
  };

  return (
    <div className={`conversation-bubble conversation-bubble--${entry.type}`}>
      <span className="conversation-bubble__icon">{getIcon()}</span>
      <span className="conversation-bubble__text">{entry.text}</span>
    </div>
  );
}
