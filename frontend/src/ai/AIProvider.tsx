/**
 * AIProvider - React Context for the AI Voice System
 *
 * Provides: voice state, NLU pipeline, guided mode, action execution,
 * error reporting, conversation log.
 *
 * Feedback loop prevention:
 *  Layer 1: VoiceEngine mutes mic during TTS + cooldown
 *  Layer 2: processingRef prevents re-entrant processing
 *  Layer 3: speakingRef rejects voice results during speech
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { VoiceEngine, VoiceStatus } from './VoiceEngine';
import { NLUEngine, NLUResult } from './NLUEngine';
import { ActionExecutor, ActionResult } from './ActionExecutor';
import { UIRegistry, FormError } from './UIRegistry';
import { GuidedMode, GuidedModeEvent, GuidedModeStatus } from './GuidedMode';

// ─── Types ──────────────────────────────────────────────────────────

export interface ConversationEntry {
  id: string;
  type: 'user' | 'ai' | 'error' | 'system' | 'guide';
  text: string;
  timestamp: number;
  nluResult?: NLUResult;
  actionResult?: ActionResult;
}

export interface AIContextType {
  voiceStatus: VoiceStatus;
  isVoiceEnabled: boolean;
  toggleVoice: () => void;
  conversation: ConversationEntry[];
  interimTranscript: string;
  processTextInput: (text: string) => Promise<void>;
  isReady: boolean;
  lastError: string | null;
  clearConversation: () => void;
  isProcessing: boolean;
  isGuidedMode: boolean;
  guidedModeStatus: GuidedModeStatus;
}

const AIContext = createContext<AIContextType | null>(null);

export function useAI(): AIContextType {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error('useAI must be used within an AIProvider');
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────────────

export function AIProvider({ children, language = 'en-US' }: { children: React.ReactNode; language?: string }) {
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGuidedMode, setIsGuidedMode] = useState(false);
  const [guidedModeStatus, setGuidedModeStatus] = useState<GuidedModeStatus>('idle');

  const busy = useRef(false);   // processing or speaking guard
  const idRef = useRef(0);

  // ─── Helpers ────────────────────────────────────────────────────

  const addEntry = useCallback(
    (type: ConversationEntry['type'], text: string, extra?: Partial<ConversationEntry>) => {
      setConversation((prev) => [...prev.slice(-50), {
        id: `e-${++idRef.current}`, type, text, timestamp: Date.now(), ...extra,
      }]);
    }, [],
  );

  const syncGuidedState = useCallback(() => {
    setIsGuidedMode(GuidedMode.isActive());
    setGuidedModeStatus(GuidedMode.getStatus());
  }, []);

  // ─── Guided Mode Events → Conversation Log ─────────────────────

  useEffect(() => {
    return GuidedMode.onEvent((ev: GuidedModeEvent) => {
      syncGuidedState();
      addEntry(ev.type === 'cancel' ? 'system' : ev.type === 'error' ? 'error' : 'guide', ev.message);
    });
  }, [addEntry, syncGuidedState]);

  // ─── Form Error Listener (non-guided only) ─────────────────────

  useEffect(() => {
    return UIRegistry.onError((err: FormError) => {
      addEntry('error', err.message);
      if (!GuidedMode.isActive()) {
        busy.current = true;
        VoiceEngine.speak(err.message).finally(() => { busy.current = false; });
      }
    });
  }, [addEntry]);

  // ─── Process Guided Answer ─────────────────────────────────────

  const processGuidedAnswer = useCallback(async (text: string) => {
    if (busy.current) return;
    busy.current = true;
    setIsProcessing(true);
    try {
      addEntry('user', text);
      await GuidedMode.handleAnswer(text);
      syncGuidedState();
    } catch (e: any) {
      addEntry('error', e.message || 'Error');
    } finally {
      busy.current = false;
      setIsProcessing(false);
    }
  }, [addEntry, syncGuidedState]);

  // ─── Start Guided Mode ─────────────────────────────────────────

  const startGuidedMode = useCallback(async () => {
    busy.current = true;
    setIsProcessing(true);
    try {
      setIsGuidedMode(true);
      setGuidedModeStatus('asking');
      await GuidedMode.start();
      syncGuidedState();
    } catch (e: any) {
      addEntry('error', e.message || 'Failed to start guided mode');
      setIsGuidedMode(false);
      setGuidedModeStatus('idle');
    } finally {
      busy.current = false;
      setIsProcessing(false);
    }
  }, [addEntry, syncGuidedState]);

  // ─── Process Utterance ─────────────────────────────────────────

  const processUtterance = useCallback(async (text: string, fromVoice = false) => {
    if (fromVoice && busy.current) return;
    if (busy.current) return;

    if (GuidedMode.isActive()) { await processGuidedAnswer(text); return; }

    busy.current = true;
    setIsProcessing(true);
    try {
      addEntry('user', text);
      const nlu = await NLUEngine.parse(text);

      if (nlu.intent === 'guide') {
        busy.current = false;
        setIsProcessing(false);
        await startGuidedMode();
        return;
      }

      const result = await ActionExecutor.executeAndSpeak(nlu);
      addEntry('ai', result.message, { nluResult: nlu, actionResult: result });
    } catch (e: any) {
      addEntry('error', e.message || 'Error');
      setLastError(e.message);
    } finally {
      busy.current = false;
      setIsProcessing(false);
    }
  }, [addEntry, processGuidedAnswer, startGuidedMode]);

  // ─── Init Voice Engine ─────────────────────────────────────────

  useEffect(() => {
    VoiceEngine.init({
      language,
      continuous: true,
      interimResults: true,
      onResult: (transcript, isFinal) => {
        if (busy.current || VoiceEngine.getIsMuted()) return;
        if (isFinal) { setInterimTranscript(''); processUtterance(transcript, true); }
        else if (!busy.current) setInterimTranscript(transcript);
      },
      onStatusChange: setVoiceStatus,
      onError: (error) => { setLastError(error); addEntry('error', `Voice error: ${error}`); },
    });
    setIsReady(true);
  }, [language, processUtterance, addEntry]);

  // ─── Toggle Voice ──────────────────────────────────────────────

  const toggleVoice = useCallback(() => {
    if (isVoiceEnabled) {
      if (GuidedMode.isActive()) { GuidedMode.cancel(); setIsGuidedMode(false); setGuidedModeStatus('idle'); }
      VoiceEngine.stopListening();
      setIsVoiceEnabled(false);
      addEntry('system', 'Voice assistant disabled.');
    } else {
      setIsVoiceEnabled(true);
      addEntry('system', 'Voice assistant enabled. Say "guide me" for step-by-step help.');
      busy.current = true;
      VoiceEngine.speak('Voice assistant enabled.').then(() => {
        busy.current = false;
        VoiceEngine.startListening();
      });
    }
  }, [isVoiceEnabled, addEntry]);

  // ─── Context ───────────────────────────────────────────────────

  return (
    <AIContext.Provider value={{
      voiceStatus, isVoiceEnabled, toggleVoice, conversation, interimTranscript,
      processTextInput: useCallback((t: string) => processUtterance(t, false), [processUtterance]),
      isReady, lastError, clearConversation: useCallback(() => setConversation([]), []),
      isProcessing, isGuidedMode, guidedModeStatus,
    }}>
      {children}
    </AIContext.Provider>
  );
}
