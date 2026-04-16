'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

interface CharacterSummary {
  id: string;
  name: string;
  class: string;
  level: number;
  hp: number;
  maxHp: number;
  portrait?: string;
}

export default function DungeonBuddyLobby() {
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCharId, setSelectedCharId] = useState('');
  const router = useRouter();

  const selectedChar = characters.find(c => c.id === selectedCharId);

  useEffect(() => {
    fetchCharacters();
  }, []);

  const fetchCharacters = async () => {
    try {
      const res = await fetch(`/api/dungeon-buddy/characters`);
      if (res.ok) {
        const data = await res.json();
        setCharacters(data);
      }
    } catch (err) {
      console.error('Failed to load characters', err);
    } finally {
      setLoading(false);
    }
  };

  const createCharacter = () => {
    router.push('/dungeon-buddy/create');
  };

  const enterWorld = (id: string) => {
    router.push(`/dungeon-buddy/${id}`);
  };

  const deleteCharacter = async (id: string, name: string) => {
    if (!confirm(`Are you certain you wish to slay ${name || 'this hero'}? Their legend will be lost to the void.`)) return;
    try {
      const res = await fetch(`/api/dungeon-buddy/characters/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCharacters(prev => prev.filter(c => c.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete character', err);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dungeon Buddy</h1>
        <Link href="/observer" className={styles.backLink}>← Retreat to Hub</Link>
      </div>

      {loading ? (
        <div className={styles.loading}>Dusting off the Chronicles...</div>
      ) : (
        <div className={styles.layout}>
          {/* Main Cinematic Viewport goes here on the left (it sees the background image purely) */}
          <div style={{ flex: 1 }} />
          
          {/* Right-aligned Hero Roster Box */}
          <div className={styles.rosterArea}>
            <h3 className={styles.rosterTitle}>Select Existing Hero</h3>
            
            <div style={{ marginBottom: '24px', maxHeight: '200px', overflowY: 'auto', border: '1px solid #4a3b2a', borderRadius: '4px', background: 'rgba(0,0,0,0.5)', padding: '8px' }}>
              {characters.filter(c => c.id).length === 0 ? (
                 <div style={{ color: '#888', textAlign: 'center', padding: '12px', fontStyle: 'italic' }}>No heroes found. Forge one below!</div>
              ) : (
                characters.filter(c => c.id).map(c => (
                  <button 
                    key={c.id} 
                    onClick={() => setSelectedCharId(c.id)}
                    style={{
                      display: 'block', 
                      width: '100%', 
                      padding: '10px 12px', 
                      background: selectedCharId && selectedCharId === c.id ? '#cfaa5e' : 'transparent',
                      color: selectedCharId && selectedCharId === c.id ? '#000' : '#cfaa5e',
                      border: 'none',
                      borderBottom: '1px solid #332211',
                      textAlign: 'left',
                      fontFamily: 'Cinzel, serif',
                      fontSize: '14px',
                      cursor: 'pointer',
                      fontWeight: selectedCharId && selectedCharId === c.id ? 'bold' : 'normal',
                      transition: 'all 0.1s'
                    }}
                  >
                    {c.name || 'Unnamed Hero'} <span style={{ opacity: 0.7, fontSize: '12px', float: 'right' }}>Lvl {c.level || 1} {c.class || 'Unknown'}</span>
                  </button>
                ))
              )}
            </div>

            {selectedChar && (
              <div className={styles.card}>
                <h2 className={styles.charName}>{selectedChar.name}</h2>
                <p className={styles.charDetails}>Level {selectedChar.level} {selectedChar.class}</p>
                
                <div style={{ fontSize: '0.85rem', color: '#b4964f', marginTop: '4px' }}>
                  HP: {selectedChar.hp} / {selectedChar.maxHp}
                </div>
                <div className={styles.healthBar}>
                  <div 
                    className={styles.healthFill} 
                    style={{ width: `${Math.min(100, Math.max(0, (selectedChar.hp / (selectedChar.maxHp || 1)) * 100))}%` }} 
                  />
                </div>

                <div className={styles.cardActions} style={{ opacity: 1 }}>
                  <button className={styles.btnEnter} onClick={() => enterWorld(selectedChar.id)}>
                    ENTER WORLD
                  </button>
                  <button className={styles.btnDelete} onClick={() => deleteCharacter(selectedChar.id, selectedChar.name)} title="Permanently delete this character">
                    SLAY HERO
                  </button>
                </div>
              </div>
            )}

            <button onClick={createCharacter} className={styles.btnNew} style={{ marginTop: '16px' }}>
              + Forge New Hero
            </button>

            {/* Scribe Portal */}
            <div className={styles.card} style={{ marginTop: '32px', background: 'var(--color-bg-panel)', border: '1px solid #4a3b2a', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h2 className={styles.charName} style={{ color: '#d4af37' }}>The Session Scribe</h2>
              <p className={styles.charDetails} style={{ textAlign: 'center', marginBottom: '16px' }}>
                Live LLM Session Minutes & Semantic Transcription
              </p>
              <div className={styles.cardActions} style={{ width: '100%', justifyContent: 'center', opacity: 1 }}>
                <button className={styles.btnEnter} onClick={() => router.push('/dungeon-buddy/scribe')} style={{ background: '#3b2f2f', color: '#fff', border: '1px solid #5a4b4b' }}>
                  ENTER RECORDING LOBBY
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
