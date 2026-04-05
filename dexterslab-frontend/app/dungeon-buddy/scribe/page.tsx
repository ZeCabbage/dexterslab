'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

interface ScribeMinutes {
  id?: string;
  timestamp?: number;
  title: string;
  summary: string;
  locations: string[];
  npcs: string[];
  quests: string[];
  loot: string[];
}

export default function SessionScribe() {
  const [activeTab, setActiveTab] = useState<'recording' | 'archives'>('recording');
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [livePartial, setLivePartial] = useState('');
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [minutes, setMinutes] = useState<ScribeMinutes | null>(null);
  
  // Archives State
  const [pastSessions, setPastSessions] = useState<ScribeMinutes[]>([]);
  
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);

  // Initialize Speech Recognition
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

  // Fetch Archives
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/dungeon-buddy/sessions');
      if (res.ok) {
        const data = await res.json();
        setPastSessions(data);
      }
    } catch (e) {
      console.error('Failed to fetch session archives', e);
    }
  };

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
      } catch (e) {}
    }
  };

  const summarizeSession = async () => {
    if (transcriptLines.length === 0 && !livePartial) {
      return alert("The tape is entirely blank, Oracle says nope.");
    }
    
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
      
      // MEMORY PURGE: Clear the raw DOM arrays to save memory footprint!
      setTranscriptLines([]);
      setLivePartial('');
      
      // Update archives with new session silently
      await fetchSessions();
      
    } catch (err) {
      console.error(err);
      alert('The Oracle refused to answer. See console.');
    } finally {
      setLoading(false);
    }
  };

  // Aggregation Logic for Archives Tab
  const aggregateList = (key: keyof ScribeMinutes) => {
    const list = pastSessions.map(s => (s[key] as string[]) || []).flat();
    return Array.from(new Set(list)); // Deduplicate
  };

  const allQuests = aggregateList('quests');
  const allNPCs = aggregateList('npcs');
  const allLocations = aggregateList('locations');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>The Session Scribe</h1>
        
        <div className={styles.tabBar}>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'recording' ? styles.active : ''}`}
            onClick={() => setActiveTab('recording')}
          >
            The Listening Room
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'archives' ? styles.active : ''}`}
            onClick={() => setActiveTab('archives')}
          >
            Campaign Archives
          </button>
        </div>

        <Link href="/dungeon-buddy" className={styles.backBtn}>← Back to Lobby</Link>
      </div>

      {activeTab === 'recording' && (
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
                 
                 <button className={styles.btnUndo} style={{marginTop: '24px', width: '100%'}} onClick={() => setActiveTab('archives')}>View Campaign Ledger</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', opacity: 0.2, flexDirection: 'column' }}>
                 <h2 style={{ fontSize: '48px', margin: 0 }}>⏣</h2>
                 <p>The Oracle awaits the session's end...</p>
                 <p style={{ fontSize: '12px', marginTop: '16px' }}>(Memory array will be purged automatically upon aggregation)</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'archives' && (
        <div className={styles.mainLayout} style={{ overflowY: 'auto' }}>
          <div className={styles.archiveLayout}>
            {/* Left: Chronological Session Logs */}
            <div className={styles.timeline}>
               <div className={styles.summaryHeader}>Historical Logbook</div>
               
               {pastSessions.map((session, idx) => (
                 <div key={session.id || idx} className={styles.sessionCard}>
                    <div className={styles.sessionCardTitle}>
                      {session.title}
                      <span className={styles.sessionDate}>
                        {session.timestamp ? new Date(session.timestamp).toLocaleDateString() : 'Unknown Date'}
                      </span>
                    </div>
                    <p className={styles.narrativeText}>{session.summary}</p>
                 </div>
               ))}
               
               {pastSessions.length === 0 && (
                 <div style={{ opacity: 0.5 }}>No sessions have been recorded in this campaign yet.</div>
               )}
            </div>

            {/* Right: Aggregated Active Campaign Context */}
            <div className={styles.aggregateSidebar}>
               <div className={styles.summaryHeader}>Campaign Meta</div>
               
               <div className={styles.listBlock} style={{ background: '#111' }}>
                 <h3 className={styles.sectionTitle} style={{ marginTop: 0, color: '#eebd45' }}>Master Quest List</h3>
                 {allQuests.length > 0 ? allQuests.map((q, i) => (
                   <div key={i} className={styles.listItem}>{q}</div>
                 )) : <div style={{ fontSize: '13px', opacity: 0.5 }}>No active quests</div>}
               </div>

               <div className={styles.listBlock}>
                 <h3 className={styles.sectionTitle} style={{ marginTop: 0 }}>Known Characters</h3>
                 {allNPCs.length > 0 ? allNPCs.map((npc, i) => (
                   <div key={i} className={styles.listItem}>{npc}</div>
                 )) : <div style={{ fontSize: '13px', opacity: 0.5 }}>No known NPCs</div>}
               </div>

               <div className={styles.listBlock}>
                 <h3 className={styles.sectionTitle} style={{ marginTop: 0 }}>Discovered Locations</h3>
                 {allLocations.length > 0 ? allLocations.map((loc, i) => (
                   <div key={i} className={styles.listItem}>{loc}</div>
                 )) : <div style={{ fontSize: '13px', opacity: 0.5 }}>No known locations</div>}
               </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className={styles.loadingOverlay}>
          <div>Interrogating the Oracle...</div>
          <div style={{ fontSize: '14px', opacity: 0.7, marginTop: '8px' }}>Extracting semantic minutes. Audio memory will be purged upon completion.</div>
        </div>
      )}
    </div>
  );
}
