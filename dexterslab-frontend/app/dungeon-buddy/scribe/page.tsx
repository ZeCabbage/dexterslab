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
  const [manualNotes, setManualNotes] = useState('');
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('text');
  const [loading, setLoading] = useState(false);
  const [minutes, setMinutes] = useState<ScribeMinutes | null>(null);
  
  // Archives State
  const [pastSessions, setPastSessions] = useState<ScribeMinutes[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  
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
        if (event.error === 'not-allowed' || event.error === 'audio-capture') {
          setIsRecording(false);
          isRecordingRef.current = false;
          alert(`Speech Engine Error: ${event.error}`);
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

  const toggleRecording = async () => {
    if (!recognitionRef.current) return alert('Speech recognition not supported on this browser.');

    if (isRecording) {
      setIsRecording(false);
      isRecordingRef.current = false;
      recognitionRef.current.stop();
    } else {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        return alert("Microphone access denied or entirely unavailable: " + (err as Error).message);
      }

      setIsRecording(true);
      isRecordingRef.current = true;
      try {
        recognitionRef.current.start();
      } catch (e: any) {
         console.error(e);
         alert("WebKit Speech Engine failure: " + e.message);
         setIsRecording(false);
         isRecordingRef.current = false;
      }
    }
  };

  const summarizeSession = async () => {
    // Build the full text from either mode
    let fullText = '';
    if (inputMode === 'voice') {
      if (transcriptLines.length === 0 && !livePartial) {
        return alert("The tape is entirely blank, Oracle says nope.");
      }
      if (isRecording) toggleRecording();
      fullText = transcriptLines.join(' ') + ' ' + livePartial;
    } else {
      if (!manualNotes.trim()) {
        return alert("Write some session notes first, scribe.");
      }
      fullText = manualNotes;
    }
    
    setLoading(true);

    try {
      const res = await fetch('/api/dungeon-buddy/scribe/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fullText })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'System failed to contact the Oracle backend.');
      }
      
      const payload = await res.json();
      setMinutes(payload);
      
      // MEMORY PURGE
      setTranscriptLines([]);
      setLivePartial('');
      // Keep manualNotes so user can see what they typed
      
      // Update archives
      await fetchSessions();
      
    } catch (err: any) {
      console.error(err);
      alert('The Oracle refused to answer: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Aggregation Logic for Archives Tab
  const aggregateList = (key: keyof ScribeMinutes) => {
    const list = pastSessions.map(s => (s[key] as string[]) || []).flat();
    return Array.from(new Set(list));
  };

  const allQuests = aggregateList('quests');
  const allNPCs = aggregateList('npcs');
  const allLocations = aggregateList('locations');
  const allLoot = aggregateList('loot');

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
            Campaign Archives ({pastSessions.length})
          </button>
        </div>

        <Link href="/dungeon-buddy" className={styles.backBtn}>← Back to Lobby</Link>
      </div>

      {activeTab === 'recording' && (
        <div className={styles.mainLayout}>
          {/* ═══ LEFT: Input Zone ═══ */}
          <div className={styles.transcriptionCol}>
            
            {/* Input Mode Toggle */}
            <div className={styles.controlsArea}>
              <div style={{ display: 'flex', gap: '2px', background: '#0a0a0a', borderRadius: '6px', border: '1px solid #332211', overflow: 'hidden' }}>
                <button 
                  onClick={() => setInputMode('text')}
                  style={{ 
                    padding: '10px 20px', border: 'none', cursor: 'pointer',
                    background: inputMode === 'text' ? '#332211' : 'transparent',
                    color: inputMode === 'text' ? '#e6cc80' : '#665544',
                    fontFamily: 'Georgia, serif', fontSize: '13px', fontWeight: 'bold',
                    transition: 'all 0.2s'
                  }}
                >
                  📝 Written Notes
                </button>
                <button 
                  onClick={() => setInputMode('voice')}
                  style={{ 
                    padding: '10px 20px', border: 'none', cursor: 'pointer',
                    background: inputMode === 'voice' ? '#332211' : 'transparent',
                    color: inputMode === 'voice' ? '#e6cc80' : '#665544',
                    fontFamily: 'Georgia, serif', fontSize: '13px', fontWeight: 'bold',
                    transition: 'all 0.2s'
                  }}
                >
                  🎙️ Voice Capture
                </button>
              </div>

              <button 
                className={styles.summarizeBtn} 
                onClick={summarizeSession}
                disabled={loading || (inputMode === 'voice' ? (isRecording || (transcriptLines.length === 0 && !livePartial)) : !manualNotes.trim())}
                style={{ 
                  opacity: loading ? 0.3 : 1,
                  marginLeft: 'auto'
                }}
              >
                {loading ? '⏳ Consulting...' : '📜 SCRIBE SESSION'}
              </button>
            </div>

            {/* Text Input Mode */}
            {inputMode === 'text' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <textarea 
                  className={styles.transcriptBox}
                  value={manualNotes}
                  onChange={e => setManualNotes(e.target.value)}
                  placeholder={"Paste or type your session notes here...\n\nExamples of what works well:\n• Stream-of-consciousness notes taken during play\n• Post-session memory dump of what happened\n• Copy-pasted Discord/chat recap\n• Voice-to-text transcription from your phone\n\nThe Oracle will extract structure from chaos."}
                  style={{ 
                    resize: 'none', 
                    fontFamily: "'Georgia', serif",
                    fontSize: '15px',
                    lineHeight: '1.8',
                    color: '#cfc2b6',
                    caretColor: '#e6cc80'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: '#554433' }}>
                  <span>{manualNotes.length} characters</span>
                  <span>{manualNotes.split(/\s+/).filter(Boolean).length} words</span>
                </div>
              </div>
            )}

            {/* Voice Input Mode */}
            {inputMode === 'voice' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    className={`${styles.recordBtn} ${isRecording ? styles.active : styles.idle}`}
                    onClick={toggleRecording}
                    style={{ flex: 1 }}
                  >
                    {isRecording ? '■ STOP SURVEILLANCE' : '▶ BEGIN RECORDING'}
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
            )}
          </div>

          {/* ═══ RIGHT: Chronicle Output ═══ */}
          <div className={styles.summaryCol}>
            {minutes ? (
              <div>
                 {/* Chronicle Header */}
                 <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                   <div style={{ fontSize: '11px', color: '#665544', textTransform: 'uppercase', letterSpacing: '3px', marginBottom: '8px' }}>Chronicle Entry</div>
                   <h2 className={styles.summaryHeader} style={{ textAlign: 'center', borderBottom: 'none', paddingBottom: 0, marginBottom: '4px' }}>{minutes.title}</h2>
                   {minutes.timestamp && (
                     <div style={{ fontSize: '12px', color: '#665544', fontFamily: 'Courier New, monospace' }}>
                       {new Date(minutes.timestamp).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                     </div>
                   )}
                   <div style={{ width: '120px', height: '2px', background: 'linear-gradient(90deg, transparent, #d4af37, transparent)', margin: '16px auto' }} />
                 </div>
                 
                 {/* Narrative */}
                 <h3 className={styles.sectionTitle}>
                   <span style={{ marginRight: '8px' }}>📖</span>Narrative Synopsis
                 </h3>
                 <p className={styles.narrativeText} style={{ whiteSpace: 'pre-line' }}>{minutes.summary}</p>
                 
                 {/* Structured Data Grid */}
                 <div className={styles.listGrid} style={{ marginTop: '24px' }}>
                   {minutes.quests.length > 0 && (
                     <div className={styles.listBlock}>
                       <h3 className={styles.sectionTitle} style={{ marginTop: 0, color: '#eebd45' }}>
                         <span style={{ marginRight: '6px' }}>⚔️</span>Quests & Tasks
                       </h3>
                       {minutes.quests.map((q, i) => <div key={i} className={styles.listItem}>{q}</div>)}
                     </div>
                   )}
                   
                   {minutes.loot.length > 0 && (
                     <div className={styles.listBlock}>
                       <h3 className={styles.sectionTitle} style={{ marginTop: 0, color: '#88cc88' }}>
                         <span style={{ marginRight: '6px' }}>💰</span>Acquired Loot
                       </h3>
                       {minutes.loot.map((l, i) => <div key={i} className={styles.listItem}>{l}</div>)}
                     </div>
                   )}
                   
                   {minutes.npcs.length > 0 && (
                     <div className={styles.listBlock}>
                       <h3 className={styles.sectionTitle} style={{ marginTop: 0, color: '#cc88cc' }}>
                         <span style={{ marginRight: '6px' }}>👤</span>Notable NPCs
                       </h3>
                       {minutes.npcs.map((n, i) => <div key={i} className={styles.listItem}>{n}</div>)}
                     </div>
                   )}

                   {minutes.locations.length > 0 && (
                     <div className={styles.listBlock}>
                       <h3 className={styles.sectionTitle} style={{ marginTop: 0, color: '#88aacc' }}>
                         <span style={{ marginRight: '6px' }}>🗺️</span>Locations
                       </h3>
                       {minutes.locations.map((loc, i) => <div key={i} className={styles.listItem}>{loc}</div>)}
                     </div>
                   )}
                 </div>
                 
                 {/* Actions */}
                 <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                   <button 
                     className={styles.summarizeBtn}
                     onClick={() => { setMinutes(null); setManualNotes(''); }}
                     style={{ flex: 1, background: '#332211', color: '#e6cc80', border: '1px solid #554433' }}
                   >
                     ✦ New Session
                   </button>
                   <button 
                     className={styles.summarizeBtn}
                     onClick={() => setActiveTab('archives')}
                     style={{ flex: 1 }}
                   >
                     📚 View Campaign Ledger
                   </button>
                 </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', opacity: 0.15, flexDirection: 'column', textAlign: 'center' }}>
                 <div style={{ fontSize: '72px', marginBottom: '16px' }}>📜</div>
                 <h2 style={{ fontSize: '20px', margin: '0 0 8px 0', color: '#e6cc80' }}>The Chronicle Awaits</h2>
                 <p style={{ fontSize: '13px', color: '#887766', maxWidth: '280px' }}>Write your notes, click "Scribe Session", and the Oracle will forge your chronicle.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ ARCHIVES TAB ═══ */}
      {activeTab === 'archives' && (
        <div className={styles.mainLayout} style={{ overflowY: 'auto' }}>
          <div className={styles.archiveLayout}>
            {/* Left: Chronological Session Logs */}
            <div className={styles.timeline}>
               <div className={styles.summaryHeader}>Historical Logbook</div>
               
               {pastSessions.map((session, idx) => {
                 const isExpanded = expandedSession === (session.id || String(idx));
                 return (
                  <div key={session.id || idx} className={styles.sessionCard} style={{ cursor: 'pointer' }} onClick={() => setExpandedSession(isExpanded ? null : (session.id || String(idx)))}>
                     <div className={styles.sessionCardTitle}>
                       {session.title}
                       <span className={styles.sessionDate}>
                         {session.timestamp ? new Date(session.timestamp).toLocaleDateString() : 'Unknown Date'}
                       </span>
                     </div>
                     <p className={styles.narrativeText} style={isExpanded ? {} : { 
                       display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any, 
                       overflow: 'hidden', textOverflow: 'ellipsis' 
                     }}>
                       {session.summary}
                     </p>
                     
                     {isExpanded && (
                       <div className={styles.listGrid} style={{ marginTop: '16px' }}>
                         {(session.quests?.length ?? 0) > 0 && (
                           <div className={styles.listBlock}>
                             <h3 className={styles.sectionTitle} style={{ marginTop: 0, color: '#eebd45', fontSize: '14px' }}>⚔️ Quests</h3>
                             {session.quests.map((q, i) => <div key={i} className={styles.listItem}>{q}</div>)}
                           </div>
                         )}
                         {(session.npcs?.length ?? 0) > 0 && (
                           <div className={styles.listBlock}>
                             <h3 className={styles.sectionTitle} style={{ marginTop: 0, color: '#cc88cc', fontSize: '14px' }}>👤 NPCs</h3>
                             {session.npcs.map((n, i) => <div key={i} className={styles.listItem}>{n}</div>)}
                           </div>
                         )}
                         {(session.locations?.length ?? 0) > 0 && (
                           <div className={styles.listBlock}>
                             <h3 className={styles.sectionTitle} style={{ marginTop: 0, color: '#88aacc', fontSize: '14px' }}>🗺️ Locations</h3>
                             {session.locations.map((loc, i) => <div key={i} className={styles.listItem}>{loc}</div>)}
                           </div>
                         )}
                         {(session.loot?.length ?? 0) > 0 && (
                           <div className={styles.listBlock}>
                             <h3 className={styles.sectionTitle} style={{ marginTop: 0, color: '#88cc88', fontSize: '14px' }}>💰 Loot</h3>
                             {session.loot.map((l, i) => <div key={i} className={styles.listItem}>{l}</div>)}
                           </div>
                         )}
                       </div>
                     )}
                     
                     <div style={{ fontSize: '11px', color: '#554433', marginTop: '8px', textAlign: 'center' }}>
                       {isExpanded ? '▲ Click to collapse' : '▼ Click to expand'}
                     </div>
                  </div>
                 );
               })}
               
               {pastSessions.length === 0 && (
                 <div style={{ opacity: 0.5, textAlign: 'center', padding: '60px 20px' }}>
                   <div style={{ fontSize: '48px', marginBottom: '12px' }}>📖</div>
                   <div>No sessions have been recorded in this campaign yet.</div>
                   <div style={{ fontSize: '12px', marginTop: '8px', color: '#554433' }}>Return to the Listening Room and scribe your first session.</div>
                 </div>
               )}
            </div>

            {/* Right: Aggregated Active Campaign Context */}
            <div className={styles.aggregateSidebar}>
               <div className={styles.summaryHeader}>Campaign Codex</div>
               
               <div className={styles.listBlock} style={{ background: 'rgba(238, 189, 69, 0.05)', borderColor: '#5a4b3a' }}>
                 <h3 className={styles.sectionTitle} style={{ marginTop: 0, color: '#eebd45' }}>⚔️ Master Quest Log</h3>
                 {allQuests.length > 0 ? allQuests.map((q, i) => (
                   <div key={i} className={styles.listItem}>{q}</div>
                 )) : <div style={{ fontSize: '13px', opacity: 0.5 }}>No active quests</div>}
               </div>

               <div className={styles.listBlock} style={{ background: 'rgba(204, 136, 204, 0.05)', borderColor: '#4a3b4a' }}>
                 <h3 className={styles.sectionTitle} style={{ marginTop: 0, color: '#cc88cc' }}>👤 Known Characters</h3>
                 {allNPCs.length > 0 ? allNPCs.map((npc, i) => (
                   <div key={i} className={styles.listItem}>{npc}</div>
                 )) : <div style={{ fontSize: '13px', opacity: 0.5 }}>No known NPCs</div>}
               </div>

               <div className={styles.listBlock} style={{ background: 'rgba(136, 170, 204, 0.05)', borderColor: '#3a3b4a' }}>
                 <h3 className={styles.sectionTitle} style={{ marginTop: 0, color: '#88aacc' }}>🗺️ Discovered Locations</h3>
                 {allLocations.length > 0 ? allLocations.map((loc, i) => (
                   <div key={i} className={styles.listItem}>{loc}</div>
                 )) : <div style={{ fontSize: '13px', opacity: 0.5 }}>No known locations</div>}
               </div>

               <div className={styles.listBlock} style={{ background: 'rgba(136, 204, 136, 0.05)', borderColor: '#3a4a3a' }}>
                 <h3 className={styles.sectionTitle} style={{ marginTop: 0, color: '#88cc88' }}>💰 Campaign Loot</h3>
                 {allLoot.length > 0 ? allLoot.map((l, i) => (
                   <div key={i} className={styles.listItem}>{l}</div>
                 )) : <div style={{ fontSize: '13px', opacity: 0.5 }}>No loot recorded</div>}
               </div>

               {/* Campaign Stats */}
               <div style={{ padding: '16px', background: '#111', border: '1px solid #332211', borderRadius: '8px' }}>
                 <h3 className={styles.sectionTitle} style={{ marginTop: 0, color: '#887766' }}>📊 Campaign Stats</h3>
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                   <div style={{ color: '#887766' }}>Sessions</div><div style={{ color: '#cfc2b6', textAlign: 'right' }}>{pastSessions.length}</div>
                   <div style={{ color: '#887766' }}>Quests</div><div style={{ color: '#cfc2b6', textAlign: 'right' }}>{allQuests.length}</div>
                   <div style={{ color: '#887766' }}>NPCs Met</div><div style={{ color: '#cfc2b6', textAlign: 'right' }}>{allNPCs.length}</div>
                   <div style={{ color: '#887766' }}>Locations</div><div style={{ color: '#cfc2b6', textAlign: 'right' }}>{allLocations.length}</div>
                   <div style={{ color: '#887766' }}>Loot Items</div><div style={{ color: '#cfc2b6', textAlign: 'right' }}>{allLoot.length}</div>
                 </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className={styles.loadingOverlay}>
          <div style={{ fontSize: '48px', marginBottom: '16px', animation: 'pulse 2s infinite' }}>📜</div>
          <div>The Chronicler is writing...</div>
          <div style={{ fontSize: '14px', opacity: 0.7, marginTop: '8px' }}>Extracting narrative structure from the session notes.</div>
        </div>
      )}
    </div>
  );
}
