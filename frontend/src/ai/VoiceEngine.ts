/**
 * VoiceEngine - Speech recognition (STT) and synthesis (TTS)
 *
 * Uses Web Speech API. Has a mute system to prevent feedback loops:
 * 1. Before TTS → mute mic, abort recognition
 * 2. During TTS → all recognition results are dropped
 * 3. After TTS → cooldown, then unmute and restart recognition
 */

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export interface VoiceEngineOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onStatusChange?: (status: VoiceStatus) => void;
  onError?: (error: string) => void;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

const COOLDOWN_MS = 1200;

class VoiceEngineClass {
  private recognition: any = null;
  private synthesis: SpeechSynthesis | null = null;
  private status: VoiceStatus = 'idle';
  private options: VoiceEngineOptions = {};
  private isSupported = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private cooldownTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldBeListening = false;
  private isMuted = false;
  private intentionallyStopped = false;

  constructor() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.synthesis = window.speechSynthesis || null;
    this.isSupported = !!SR;
    if (SR) this.recognition = new SR();
  }

  init(options: VoiceEngineOptions): void {
    this.options = options;
    if (!this.recognition) {
      options.onError?.('Speech Recognition is not supported in this browser');
      return;
    }

    const r = this.recognition;
    r.lang = options.language || 'en-US';
    r.continuous = options.continuous ?? true;
    r.interimResults = options.interimResults ?? true;

    r.onresult = (e: SpeechRecognitionEvent) => {
      if (this.isMuted) return;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (this.isMuted) return;
        const transcript = e.results[i][0].transcript.trim();
        if (transcript) options.onResult?.(transcript, e.results[i].isFinal);
      }
    };

    r.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'no-speech' || e.error === 'aborted') {
        if (this.shouldBeListening && !this.isMuted && !this.intentionallyStopped) {
          this.scheduleRestart();
        }
        return;
      }
      this.setStatus('error');
      options.onError?.(e.error);
    };

    r.onend = () => {
      if (this.intentionallyStopped) { this.intentionallyStopped = false; return; }
      if (this.shouldBeListening && !this.isMuted) this.scheduleRestart();
      else if (!this.shouldBeListening) this.setStatus('idle');
    };

    r.onstart = () => { if (!this.isMuted) this.setStatus('listening'); };
  }

  startListening(): void {
    if (!this.recognition) { this.options.onError?.('Speech Recognition not supported'); return; }
    this.shouldBeListening = true;
    this.isMuted = false;
    this.intentionallyStopped = false;
    try { this.recognition.start(); this.setStatus('listening'); }
    catch (e: any) { if (!e.message?.includes('already started')) this.options.onError?.(e.message); }
  }

  stopListening(): void {
    this.shouldBeListening = false;
    this.isMuted = false;
    this.clearTimers();
    if (this.recognition) {
      this.intentionallyStopped = true;
      try { this.recognition.abort(); } catch { /* ok */ }
    }
    this.setStatus('idle');
  }

  /**
   * Speak text: mute mic → TTS → cooldown → unmute mic
   */
  async speak(text: string, opts?: { rate?: number; pitch?: number; volume?: number }): Promise<void> {
    this.mute();
    try { await this.synthesize(text, opts); } catch { /* ok */ }
    await this.cooldownAndUnmute();
  }

  getIsMuted(): boolean { return this.isMuted; }
  getStatus(): VoiceStatus { return this.status; }
  getIsSupported(): boolean { return this.isSupported; }

  // ─── Private ──────────────────────────────────────────────────────

  private mute(): void {
    this.isMuted = true;
    this.clearTimers();
    if (this.recognition) {
      this.intentionallyStopped = true;
      try { this.recognition.abort(); } catch { /* ok */ }
    }
    this.setStatus('speaking');
  }

  private cooldownAndUnmute(): Promise<void> {
    return new Promise((resolve) => {
      this.cooldownTimer = setTimeout(() => {
        this.cooldownTimer = null;
        this.isMuted = false;
        this.intentionallyStopped = false;
        if (this.shouldBeListening) {
          try { this.recognition?.start(); } catch { /* ok */ }
          this.setStatus('listening');
        } else {
          this.setStatus('idle');
        }
        resolve();
      }, COOLDOWN_MS);
    });
  }

  private synthesize(text: string, opts?: { rate?: number; pitch?: number; volume?: number }): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synthesis) { resolve(); return; }
      this.synthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = opts?.rate ?? 1.0;
      u.pitch = opts?.pitch ?? 1.0;
      u.volume = opts?.volume ?? 0.8;
      u.lang = this.options.language || 'en-US';
      const voices = this.synthesis.getVoices();
      const voice = voices.find((v) => v.lang.startsWith('en') && v.name.includes('Google'))
                 || voices.find((v) => v.lang.startsWith('en'));
      if (voice) u.voice = voice;
      u.onend = () => resolve();
      u.onerror = (e) => reject(new Error(e.error));
      this.synthesis.speak(u);
    });
  }

  private scheduleRestart(delay = 300): void {
    if (this.isMuted) return;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (this.shouldBeListening && !this.isMuted) {
        try { this.recognition?.start(); } catch { /* ok */ }
      }
    }, delay);
  }

  private clearTimers(): void {
    if (this.restartTimer) { clearTimeout(this.restartTimer); this.restartTimer = null; }
    if (this.cooldownTimer) { clearTimeout(this.cooldownTimer); this.cooldownTimer = null; }
  }

  private setStatus(s: VoiceStatus): void {
    if (this.status !== s) { this.status = s; this.options.onStatusChange?.(s); }
  }
}

export const VoiceEngine = new VoiceEngineClass();
