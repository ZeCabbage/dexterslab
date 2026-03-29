'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import styles from './page.module.css';

interface LogEntry {
  id: string;
  timestamp: number;
  type: 'level_up' | 'manual_edit';
  description: string;
  previousState: any; // snapshot of stats/hp before change
}

interface Character {
  id: string;
  name: string;
  class: string;
  level: number;
  maxHp: number;
  currentHp: number;
  ac: number;
  stats: {
    str: number; dex: number; con: number; int: number; wis: number; cha: number;
  };
  logbook: LogEntry[];
}

export default function DeepCharacterSheet() {
  const params = useParams();
  const charId = params.id as string;
  
  const [char, setChar] = useState<Character | null>(null);
  const [activeTab, setActiveTab] = useState<'core' | 'combat' | 'logbook'>('core');
  const [saveStatus, setSaveStatus] = useState<string>('');

  useEffect(() => {
    fetchCharacter();
  }, [charId]);

  const fetchCharacter = async () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocal ? 'http://localhost:8888' : '';
    const res = await fetch(`${baseUrl}/api/dungeon-buddy/characters/${charId}`);
    if (res.ok) {
      const data = await res.json();
      if (!data.stats) data.stats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
      if (!data.ac) data.ac = 10;
      setChar(data);
    }
  };

  const saveCharacter = useCallback(async (updatedChar: Character) => {
    setSaveStatus('Saving...');
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocal ? 'http://localhost:8888' : '';
    
    await fetch(`${baseUrl}/api/dungeon-buddy/characters/${charId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedChar)
    });
    setSaveStatus('Saved');
    setTimeout(() => setSaveStatus(''), 2000);
  }, [charId]);

  const updateField = (field: keyof Character, value: any) => {
    if (!char) return;
    const updated = { ...char, [field]: value };
    setChar(updated);
    saveCharacter(updated);
  };

  const updateStat = (statName: keyof Character['stats'], value: number) => {
    if (!char) return;
    const updated = {
      ...char,
      stats: { ...char.stats, [statName]: value }
    };
    setChar(updated);
    saveCharacter(updated);
  };

  const levelUp = () => {
    if (!char) return;
    // Assume average HP gain based on level (simplified to +6 for demo)
    const hpGain = 6; 
    
    // Create snapshot
    const snapshot = {
      level: char.level,
      maxHp: char.maxHp,
      currentHp: char.currentHp,
    };

    const newLog: LogEntry = {
      id: "log_" + Date.now(),
      timestamp: Date.now(),
      type: 'level_up',
      description: `Leveled up to ${char.level + 1}. Max HP increased by ${hpGain}.`,
      previousState: snapshot
    };

    const updated = {
      ...char,
      level: char.level + 1,
      maxHp: char.maxHp + hpGain,
      currentHp: char.currentHp + hpGain,
      logbook: [newLog, ...(char.logbook || [])]
    };

    setChar(updated);
    saveCharacter(updated);
  };

  const undoLogEntry = (logId: string) => {
    if (!char || !char.logbook) return;
    
    const logIndex = char.logbook.findIndex(l => l.id === logId);
    if (logIndex === -1) return;

    const entryToUndo = char.logbook[logIndex];
    if (entryToUndo.type === 'level_up' && entryToUndo.previousState) {
        // Rollback state
        const updated = {
            ...char,
            ...entryToUndo.previousState,
            logbook: char.logbook.filter(l => l.id !== logId)
        };
        setChar(updated);
        saveCharacter(updated);
    }
  };

  const doRest = (type: 'short' | 'long') => {
    if (!char) return;
    if (type === 'long') {
      updateField('currentHp', char.maxHp);
    }
  };

  if (!char) return <div className={styles.container}>Loading Chronicle...</div>;

  const calculateModifier = (score: number) => Math.floor((score - 10) / 2);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.flexHeader}>
          <input 
            className={styles.nameInput}
            value={char.name}
            onChange={e => updateField('name', e.target.value)}
          />
          <span className={styles.classLevel}>Level {char.level} {char.class}</span>
        </div>
        <div>
          <span className={styles.saveStatus}>{saveStatus}</span>
          <Link href="/dungeon-buddy" className={styles.backLink}>← Roster</Link>
        </div>
      </div>

      <div className={styles.tabs}>
        <div className={`${styles.tab} ${activeTab === 'core' ? styles.active : ''}`} onClick={() => setActiveTab('core')}>Core Stats</div>
        <div className={`${styles.tab} ${activeTab === 'combat' ? styles.active : ''}`} onClick={() => setActiveTab('combat')}>Combat & Vitals</div>
        <div className={`${styles.tab} ${activeTab === 'logbook' ? styles.active : ''}`} onClick={() => setActiveTab('logbook')}>Logbook (Undo)</div>
      </div>

      <div className={styles.panel}>
        {/* LEFT COLUMN: Main Viewing Area based on Tab */}
        <div className={styles.card}>
          {activeTab === 'core' && (
            <>
              <h3 className={styles.cardTitle}>Ability Scores</h3>
              <div className={styles.statsGrid}>
                {Object.entries(char.stats).map(([stat, val]) => (
                  <div key={stat} className={styles.statBox}>
                    <div className={styles.statLabel}>{stat.toUpperCase()}</div>
                    <input 
                      type="number"
                      className={styles.statInput}
                      value={val || 10}
                      onChange={e => updateStat(stat as keyof Character['stats'], parseInt(e.target.value) || 0)}
                    />
                    <div style={{ color: '#4b6f8f', fontSize: '1.2rem', fontFamily: 'Cinzel, serif' }}>
                      {calculateModifier(val as number) >= 0 ? '+' : ''}{calculateModifier(val as number)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'combat' && (
            <>
              <h3 className={styles.cardTitle}>Vitals</h3>
              <div className={styles.vitalsGrid}>
                <div className={styles.vitalBox}>
                  <div className={styles.vitalLabel}>Current HP</div>
                  <input 
                    type="number"
                    className={styles.vitalInput}
                    value={char.currentHp}
                    onChange={e => updateField('currentHp', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className={styles.vitalBox} style={{ borderColor: '#333', background: 'rgba(0,0,0,0.5)' }}>
                  <div className={styles.vitalLabel} style={{ color: '#666' }}>Max HP</div>
                  <input 
                    type="number"
                    className={styles.vitalInput}
                    value={char.maxHp}
                    onChange={e => updateField('maxHp', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className={styles.vitalBox} style={{ borderColor: '#4b6f8f', background: 'rgba(75,111,143,0.1)' }}>
                  <div className={styles.vitalLabel} style={{ color: '#4b6f8f' }}>Armor Class</div>
                  <input 
                    type="number"
                    className={styles.vitalInput}
                    value={char.ac}
                    onChange={e => updateField('ac', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className={styles.btnAction} onClick={() => doRest('short')}>Short Rest</button>
                <button className={styles.btnAction} onClick={() => doRest('long')}>Long Rest (Max HP)</button>
              </div>
            </>
          )}

          {activeTab === 'logbook' && (
            <>
              <h3 className={styles.cardTitle}>The Ledger (History)</h3>
              <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '20px' }}>
                Track changes and carefully un-weave reality if mistakes were made.
              </p>
              {(!char.logbook || char.logbook.length === 0) ? (
                <div style={{ color: '#555' }}>No major events recorded yet.</div>
              ) : (
                <ul className={styles.logbook}>
                  {char.logbook.map(log => (
                    <li key={log.id} className={styles.logItem}>
                      <div className={styles.logTime}>{new Date(log.timestamp).toLocaleString()}</div>
                      <div className={styles.logText}>{log.description}</div>
                      {log.type === 'level_up' && (
                        <button className={styles.btnUndo} onClick={() => undoLogEntry(log.id)}>
                          ↶ Undo specific step
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* RIGHT COLUMN: Quick Actions / Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className={styles.card} style={{ borderColor: '#4b6f8f' }}>
            <h3 className={styles.cardTitle}>Progression</h3>
            <p style={{ color: '#a0a0a0', fontSize: '0.9rem', marginBottom: '20px' }}>
               Current Level: {char.level}. Ready to advance your journey?
            </p>
            <button className={styles.btnLevelUp} style={{ width: '100%' }} onClick={levelUp}>
              ▲ Level Up
            </button>
          </div>
          
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Identity</h3>
            <div className={styles.inputGroup}>
              <label>Class</label>
              <input value={char.class} onChange={e => updateField('class', e.target.value)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
