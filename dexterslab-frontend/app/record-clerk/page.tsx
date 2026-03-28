'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

interface ClerkState {
  emotion: 'smiling' | 'talking' | 'thinking' | 'sad';
  mouthState: 'closed' | 'open';
  overlayText: string;
  isListening: boolean;
}

export default function RecordClerkPage() {
  const [state, setState] = useState<ClerkState>({
    emotion: 'smiling',
    mouthState: 'closed',
    overlayText: 'Hello! Welcome to Dandelion Records. Show me a record or ask me a question!',
    isListening: false,
  });
  
  const [connState, setConnState] = useState<'connecting'|'connected'|'disconnected'>('connecting');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      setConnState('connecting');
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const wsUrl = isLocal 
          ? 'ws://localhost:8888/ws/recordclerk'
          : `ws://${window.location.hostname}:8888/ws/recordclerk`;

      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🌼 Connected to Record Clerk Engine');
        setConnState('connected');
      };

      ws.onmessage = (event) => {
        try {
          const packet: ClerkState = JSON.parse(event.data);
          setState(packet);
        } catch (e) {
          console.error(e);
        }
      };

      ws.onclose = () => {
        setConnState('disconnected');
        reconnectTimer = setTimeout(connect, 3000);
      };
      
      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

  // Determine face classes based on state
  const isTalking = state.emotion === 'talking';
  const isThinking = state.emotion === 'thinking';
  const isSad = state.emotion === 'sad';

  return (
    <div className={styles.container}>
      <Link href="/observer" className={styles.backLink}>← HUB</Link>

      {connState !== 'connected' && (
        <div className={styles.connStatus}>
          SYSTEM {connState.toUpperCase()}
        </div>
      )}

      <div className={styles.faceContainer}>
        <div className={`${styles.dandelionHead} ${isThinking ? styles.spin : ''}`}>
          {/* Petals */}
          {[...Array(12)].map((_, i) => (
            <div key={i} className={styles.petal} style={{ transform: `rotate(${i * 30}deg) translateY(-140px)` }} />
          ))}
          
          <div className={styles.faceBody}>
            {/* Eyes */}
            <div className={styles.eyes}>
              <div className={`${styles.eye} ${isSad ? styles.eyeSad : ''} ${isThinking ? styles.eyeThinking : ''}`}>
                <div className={styles.pupil} />
              </div>
              <div className={`${styles.eye} ${isSad ? styles.eyeSad : ''} ${isThinking ? styles.eyeThinking : ''}`}>
                <div className={styles.pupil} />
              </div>
            </div>
            
            {/* Mouth */}
            <div className={`${styles.mouth} ${
              isTalking ? styles.mouthTalking : 
              isSad ? styles.mouthSad : 
              state.mouthState === 'open' ? styles.mouthOpen : ''
            }`} />
          </div>
        </div>
      </div>

      {state.overlayText && (
        <div className={styles.subtitleBox}>
          <span className={styles.subtitleText}>{state.overlayText}</span>
        </div>
      )}
    </div>
  );
}
