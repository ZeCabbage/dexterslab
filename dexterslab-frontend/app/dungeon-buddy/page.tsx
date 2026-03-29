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
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const baseUrl = isLocal ? 'http://localhost:8888' : '';
      const res = await fetch(`${baseUrl}/api/dungeon-buddy/characters`);
      
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

  const deleteCharacter = async (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Slay ${name || 'this hero'}? This cannot be undone.`)) return;
    try {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const baseUrl = isLocal ? 'http://localhost:8888' : '';
      const res = await fetch(`${baseUrl}/api/dungeon-buddy/characters/${id}`, { method: 'DELETE' });
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
        <Link href="/observer" className={styles.backLink}>← Return to Hub</Link>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading Chronicles...</div>
      ) : (
        <div className={styles.grid}>
          {characters.map((char) => (
            <Link href={`/dungeon-buddy/${char.id}`} key={char.id} className={styles.card}>
              <button
                className={styles.btnDelete}
                onClick={(e) => deleteCharacter(e, char.id, char.name)}
                title="Delete character"
              >×</button>
              <h2 className={styles.charName}>{char.name}</h2>
              <p className={styles.charDetails}>Level {char.level} {char.class}</p>
              
              <div style={{ marginTop: '20px', fontSize: '0.85rem', color: '#b4964f' }}>
                HP: {char.hp} / {char.maxHp}
              </div>
              <div className={styles.healthBar}>
                <div 
                  className={styles.healthFill} 
                  style={{ width: `${Math.min(100, Math.max(0, (char.hp / (char.maxHp || 1)) * 100))}%` }} 
                />
              </div>
            </Link>
          ))}

          <button onClick={createCharacter} className={`${styles.card} ${styles.btnNew}`}>
            + Forge New Hero
          </button>
        </div>
      )}
    </div>
  );
}
