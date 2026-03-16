'use client';

/**
 * RULES LAWYER — Board Game Rules Assistant
 *
 * LLM-powered (Gemini) board game rules expert with 32-bit pixel art character.
 * Two states:
 *   1. Game Selection — asks "what are we playing?"
 *   2. Active Session — character + chat panel, voice I/O
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import RulesLawyerCharacter, { CharacterTheme, CharacterMood } from './RulesLawyerCharacter';
import { useTTS } from '@/hooks/useTTS';
import { useVoice } from '../VoiceProvider';
import styles from './page.module.css';

// ── Default theme (before game is selected) ──
const DEFAULT_THEME: CharacterTheme = {
  hat: 'cap',
  accessory: 'glasses',
  palette: { primary: '#00ffe0', secondary: '#ffaa00', bg: '#06060e' },
  genre: 'default',
};

// ── Chat message type ──
interface ChatMessage {
  id: number;
  type: 'user' | 'bot' | 'greeting' | 'tip';
  text: string;
  ruleRef?: string;
}

export default function RulesLawyerPage() {
  const router = useRouter();
  const voice = useVoice();
  const tts = useTTS({ rate: 0.9, pitch: 1.05, preferredVoice: 'Daniel' });

  // ── State ──
  const [gameSession, setGameSession] = useState<{
    active: boolean;
    game: string;
    theme: CharacterTheme;
  }>({ active: false, game: '', theme: DEFAULT_THEME });

  const [gameInput, setGameInput] = useState('');
  const [mood, setMood] = useState<CharacterMood>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [questionInput, setQuestionInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [tip, setTip] = useState<string | null>(null);
  const msgIdRef = useRef(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const tipTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Auto-scroll chat ──
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // ── Add message helper ──
  const addMessage = useCallback((type: ChatMessage['type'], text: string, ruleRef?: string) => {
    msgIdRef.current++;
    setMessages(prev => [...prev, { id: msgIdRef.current, type, text, ruleRef }]);
  }, []);

  // ── Start game session ──
  const startGame = async (gameName: string) => {
    if (!gameName.trim() || isStarting) return;
    setIsStarting(true);
    setMood('excited');

    try {
      const res = await fetch('/api/rules-lawyer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', game: gameName.trim() }),
      });

      const data = await res.json();

      if (data.success || data.persona) {
        const theme: CharacterTheme = data.persona || DEFAULT_THEME;
        setGameSession({ active: true, game: data.game || gameName, theme });
        setMood(data.mood || 'smug');
        addMessage('greeting', data.greeting || `Ah, ${gameName}! Let's do this.`);
        tts.speak(data.greeting || `Ah, ${gameName}! Let's do this.`);
        // Start ambient tip timer
        startTipTimer();
      } else {
        setMood('confused');
        addMessage('greeting', data.error || 'Something went wrong. Try again!');
      }
    } catch {
      setMood('confused');
      setGameSession({ active: true, game: gameName, theme: DEFAULT_THEME });
      addMessage('greeting', `Ah, ${gameName}! I'm ready — though my brain link seems a bit fuzzy.`);
    }
    setIsStarting(false);
  };

  // ── Ask question ──
  const askQuestion = async (question: string) => {
    if (!question.trim() || isLoading) return;

    addMessage('user', question);
    setQuestionInput('');
    setIsLoading(true);
    setMood('thinking');

    try {
      const res = await fetch('/api/rules-lawyer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ask', question: question.trim() }),
      });

      const data = await res.json();

      setMood(data.mood || 'confident');
      addMessage('bot', data.answer || 'Hmm, I seem to have lost my train of thought.', data.rule_reference);

      // Speak the answer
      tts.speak(data.answer || 'Hmm, I seem to have lost my train of thought.');

      // Reset mood after a delay
      setTimeout(() => {
        setMood('idle');
      }, 5000);
    } catch {
      setMood('confused');
      addMessage('bot', 'My brain glitched! Check my connection and try again.');
    }

    setIsLoading(false);
  };

  // ── Ambient tip timer ──
  const startTipTimer = () => {
    if (tipTimerRef.current) clearInterval(tipTimerRef.current);
    tipTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/rules-lawyer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'suggest' }),
        });
        const data = await res.json();
        if (data.tip) {
          setTip(data.tip);
          setMood(data.mood || 'smug');
          // Clear tip after 10s
          setTimeout(() => setTip(null), 10000);
          // Reset mood
          setTimeout(() => setMood('idle'), 6000);
        }
      } catch {}
    }, 45000); // Every 45 seconds
  };

  // ── Cleanup timers ──
  useEffect(() => {
    return () => {
      if (tipTimerRef.current) clearInterval(tipTimerRef.current);
    };
  }, []);

  // ── End session ──
  const endSession = async () => {
    tts.stop();
    if (tipTimerRef.current) clearInterval(tipTimerRef.current);
    try {
      await fetch('/api/rules-lawyer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end' }),
      });
    } catch {}
    setGameSession({ active: false, game: '', theme: DEFAULT_THEME });
    setMessages([]);
    setMood('idle');
    setTip(null);
  };

  // ── Voice input handling ──
  useEffect(() => {
    if (!voice.lastFinal) return;
    const text = voice.lastFinal.trim().toLowerCase();

    // If we're in game select mode, treat voice input as game name
    if (!gameSession.active) {
      // Filter out navigation commands
      if (text.includes('launch') || text.includes('kill') || text.includes('home') || text.includes('hub')) return;
      if (text.length > 2) {
        setGameInput(text);
        startGame(text);
      }
      return;
    }

    // In active session, treat as question (filter out short/command-like speech)
    if (text.length > 5 && !text.includes('kill') && !text.includes('home') && !text.includes('hub')) {
      askQuestion(text);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.lastFinal]);

  // ── Speaking state drives character ──
  useEffect(() => {
    if (tts.isSpeaking) {
      setMood('speaking');
    }
  }, [tts.isSpeaking]);

  // ═══ RENDER: Game Selection ═══
  if (!gameSession.active) {
    return (
      <div className={styles.container}>
        <Link href="/observer" className={styles.backLink}>← HUB</Link>

        <div className={styles.circleFrame}>
          <div className={styles.ringInner} />
          <div className={styles.ringMid} />
          <div className={styles.crtOverlay} />
          <div className={styles.vignette} />

          <div className={styles.selectScreen}>
            <div className={styles.selectCharacter}>
              <RulesLawyerCharacter
                theme={DEFAULT_THEME}
                mood={isStarting ? 'excited' : 'idle'}
                isSpeaking={false}
                width={200}
                height={250}
              />
            </div>

            <h1 className={styles.selectTitle}>RULES LAWYER</h1>
            <p className={styles.selectSubtitle}>What are we playing today?</p>

            <form
              className={styles.gameInputRow}
              onSubmit={(e) => {
                e.preventDefault();
                startGame(gameInput);
              }}
            >
              <input
                id="game-input"
                type="text"
                className={styles.gameInput}
                placeholder="Type a game name..."
                value={gameInput}
                onChange={(e) => setGameInput(e.target.value)}
                autoFocus
                autoComplete="off"
                disabled={isStarting}
              />
              <button
                type="submit"
                className={styles.goBtn}
                disabled={!gameInput.trim() || isStarting}
              >
                {isStarting ? 'LOADING...' : 'LET\'S GO'}
              </button>
            </form>

            <p className={styles.voiceHintSmall}>
              or just say the game name aloud
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ═══ RENDER: Active Session ═══
  return (
    <div className={styles.container}>
      <Link href="/observer" className={styles.backLink}>← HUB</Link>

      <div className={styles.circleFrame}>
        <div className={styles.ringInner} />
        <div className={styles.ringMid} />
        <div className={styles.crtOverlay} />
        <div className={styles.vignette} />

        <div className={styles.sessionScreen}>
          {/* Header */}
          <div className={styles.sessionHeader}>
            <span className={styles.sessionGameName}>
              🎲 {gameSession.game.toUpperCase()}
            </span>
            <span className={styles.sessionStatus}>
              <span className={styles.statusDot} />
              ACTIVE
            </span>
            <button onClick={endSession} className={styles.endBtn}>
              ■ END
            </button>
          </div>

          {/* Character */}
          <div className={styles.characterArea}>
            <div className={styles.characterCanvas}>
              <RulesLawyerCharacter
                theme={gameSession.theme}
                mood={mood}
                isSpeaking={tts.isSpeaking}
                width={280}
                height={340}
              />
            </div>
            <div className={styles.moodLabel}>{mood.toUpperCase()}</div>
          </div>

          {/* Chat */}
          <div className={styles.chatArea}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`${styles.chatMessage} ${
                  msg.type === 'user' ? styles.chatMessageUser
                  : msg.type === 'greeting' ? styles.chatMessageGreeting
                  : styles.chatMessageBot
                }`}
              >
                {msg.text}
                {msg.ruleRef && (
                  <div className={styles.chatMessageRef}>
                    📖 {msg.ruleRef}
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className={styles.chatLoading}>
                Consulting the rulebook...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Ambient Tip */}
          {tip && (
            <div className={styles.tipBanner}>
              <span className={styles.tipIcon}>💡</span>
              {tip}
            </div>
          )}

          {/* Input Bar */}
          <div className={styles.inputBar}>
            <form
              style={{ display: 'contents' }}
              onSubmit={(e) => {
                e.preventDefault();
                askQuestion(questionInput);
              }}
            >
              <input
                id="question-input"
                type="text"
                className={styles.questionInput}
                placeholder="Ask a rules question..."
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                disabled={isLoading}
                autoComplete="off"
              />
              <button
                type="submit"
                className={styles.askBtn}
                disabled={!questionInput.trim() || isLoading}
              >
                ASK
              </button>
            </form>
            {tts.isSpeaking && (
              <div className={styles.speakingIndicator}>
                <span className={styles.speakingDot} />
                SPEAKING
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
