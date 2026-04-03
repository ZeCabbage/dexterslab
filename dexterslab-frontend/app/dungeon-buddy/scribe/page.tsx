'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

interface ScribeMinutes {
  title: string;
  summary: string;
  locations: string[];
  npcs: string[];
  quests: string[];
  loot: string[];
}

export default function SessionScribe() {
  const [isRecording, setIsRecording] = useState(false);
  const [livePartial, setLivePartial] = useState('');
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [minutes, setMinutes] = useState<ScribeMinutes | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (interimTranscript) {
          setLivePartial(interimTranscript);
        }
        
        if (finalTranscript) {
          setLivePartial('');
          setTranscriptLines(prev => [...prev, finalTranscript.trim()]);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
          setIsRecording(false);
          isRecordingRef.current = false;
        }
      };

      recognition.onend = () => {
        // Automatically restart if we haven't officially hit "STOP"
        if (isRecordingRef.current) {
          try {
            recognition.start();
          } catch (e) {
             console.error('Failed to restart recognition automatically', e);
          }
        }
      };

      recognitionRef.current = recognition;
    } else {
      console.error('Speech Recognition API not supported in this browser.');
    }

    return () => {
      isRecordingRef.current = false;
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) return alert('Speech recognition not supported.');

    if (isRecording) {
      setIsRecording(false);
      isRecordingRef.current = false;
      recognitionRef.current.stop();
    } else {
      setIsRecording(true);
      isRecordingRef.current = true;
      try {
        recognitionRef.current.start();
      } catch (e) {
         // Might already be started
      }
    }
  };

  const summarizeSession = async () => {
    if (transcriptLines.length === 0 && !livePartial) {
      return alert("The tape is entirely blank, Oracle says nope.");
    }
    
    // Stop recording if active
    if (isRecording) toggleRecording();
    
    setLoading(true);
    
    const fullText = transcriptLines.join(' ') + ' ' + livePartial;

    try {
      const res = await fetch('/api/dungeon-buddy/scribe/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fullText })
      });

      if (!res.ok) throw new Error('Failed to summarize.');
      
      const payload = await res.json();
      setMinutes(payload);
      
    } catch (err) {
      console.error(err);
      alert('The Oracle refused to answer. See console.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>The Session Scribe</h1>
        <Link href="/dungeon-buddy" className={styles.backBtn}>← Back to Lobby</Link>
      </div>

      <div className={styles.mainLayout}>
        <div className={styles.transcriptionCol}>
          
          <div className={styles.controlsArea}>
            <button 
              className={`${styles.recordBtn} ${isRecording ? styles.active : styles.idle}`}
              onClick={toggleRecording}
            >
              {isRecording ? '■ STOP SURVEILLANCE' : '▶ BEGIN RECORDING'}
            </button>
            <button 
              className={styles.summarizeBtn} 
              onClick={summarizeSession}
              disabled={isRecording || (transcriptLines.length === 0 && !livePartial)}
              style={{ opacity: (isRecording || (transcriptLines.length === 0 && !livePartial)) ? 0.3 : 1 }}
            >
              CONSULT ORACLE
            </button>
          </div>

          <div className={styles.transcriptBox}>
            {transcriptLines.length === 0 && !livePartial && (
              <div style={{ textAlign: 'center', opacity: 0.5, marginTop: '100px' }}>
                * Audio will stream here live during the session *
              </div>
            )}
            
            {transcriptLines.map((line, i) => (
              <div key={i} className={styles.transcriptLine}>
                <span style={{ color: '#4a3b2a', fontSize: '11px', marginRight: '8px' }}>[{('0' + (i+1)).slice(-2)}]</span>
                {line}
              </div>
            ))}
            {livePartial && (
              <div style={{ fontStyle: 'italic', opacity: 0.6 }}>
                 <span style={{ color: '#4a3b2a', fontSize: '11px', marginRight: '8px' }}>[··]</span>
                 {livePartial}...
              </div>
            )}
          </div>

        </div>

        <div className={styles.summaryCol}>
          {minutes ? (
            <div>
               <h2 className={styles.summaryHeader}>{minutes.title}</h2>
               
               <h3 className={styles.sectionTitle}>Narrative Synopsis</h3>
               <p className={styles.narrativeText}>{minutes.summary}</p>
               
               <div className={styles.listGrid} style={{ marginTop: '24px' }}>
                 <div className={styles.listBlock}>
                   <h3 className={styles.sectionTitle} style={{ marginTop: 0 }}>Quests & Tasks</h3>
                   {minutes.quests.map((q, i) => <div key={i} className={styles.listItem}>{q}</div>)}
                 </div>
                 
                 <div className={styles.listBlock}>
                   <h3 className={styles.sectionTitle} style={{ marginTop: 0 }}>Acquired Loot</h3>
                   {minutes.loot.map((l, i) => <div key={i} className={styles.listItem}>{l}</div>)}
                 </div>
                 
                 <div className={styles.listBlock}>
                   <h3 className={styles.sectionTitle} style={{ marginTop: 0 }}>Notable NPCs</h3>
                   {minutes.npcs.map((n, i) => <div key={i} className={styles.listItem}>{n}</div>)}
                 </div>

                 <div className={styles.listBlock}>
                   <h3 className={styles.sectionTitle} style={{ marginTop: 0 }}>Locations</h3>
                   {minutes.locations.map((loc, i) => <div key={i} className={styles.listItem}>{loc}</div>)}
                 </div>
               </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', opacity: 0.2, flexDirection: 'column' }}>
               <h2 style={{ fontSize: '48px', margin: 0 }}>⏣</h2>
               <p>The Oracle awaits the session's end...</p>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className={styles.loadingOverlay}>
          <div>Interrogating the Oracle...</div>
          <div style={{ fontSize: '14px', opacity: 0.7, marginTop: '8px' }}>Extracting semantic minutes. This may take a minute based on session length.</div>
        </div>
      )}
    </div>
  );
}
