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
  const router = useRouter();

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
            <h3 className={styles.rosterTitle}>Heroes of the Realm</h3>
            
            {characters.map((char) => (
              <div key={char.id} className={styles.card}>
                <h2 className={styles.charName}>{char.name}</h2>
                <p className={styles.charDetails}>Level {char.level} {char.class}</p>
                
                <div style={{ fontSize: '0.85rem', color: '#b4964f', marginTop: '4px' }}>
                  HP: {char.hp} / {char.maxHp}
                </div>
                <div className={styles.healthBar}>
                  <div 
                    className={styles.healthFill} 
                    style={{ width: `${Math.min(100, Math.max(0, (char.hp / (char.maxHp || 1)) * 100))}%` }} 
                  />
                </div>

                <div className={styles.cardActions}>
                  <button className={styles.btnEnter} onClick={() => enterWorld(char.id)}>
                    ENTER WORLD
                  </button>
                  <button className={styles.btnDelete} onClick={() => deleteCharacter(char.id, char.name)} title="Permanently delete this character">
                    SLAY HERO
                  </button>
                </div>
              </div>
            ))}

            <button onClick={createCharacter} className={styles.btnNew}>
              + Forge New Hero
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
