'use client';

import { useState, useEffect } from 'react';
import styles from '../page.module.css';
import { Dog, calculateOdds, getBankroll, PERSONALITY_DESCRIPTIONS } from '../lib/dogs';

interface BettingScreenProps {
  dog1: Dog;
  dog2: Dog;
  onFight: (betAmount: number, betOnDog: 0 | 1) => void;
}

// Stat bar color based on value
function statColor(val: number): string {
  if (val >= 80) return '#00FF88';
  if (val >= 60) return '#00CCE0';
  if (val >= 40) return '#FFD700';
  if (val >= 20) return '#FF8800';
  return '#FF4444';
}

const STAT_DEFS = [
  { key: 'biteForce' as const, icon: '🦷', label: 'BITE' },
  { key: 'agility' as const,   icon: '🐾', label: 'AGIL' },
  { key: 'thickness' as const, icon: '🛡️', label: 'THICK' },
  { key: 'heart' as const,     icon: '❤️', label: 'HEART' },
  { key: 'fightIQ' as const,   icon: '🧠', label: 'IQ' },
];

export default function BettingScreen({ dog1, dog2, onFight }: BettingScreenProps) {
  const [betAmount, setBetAmount] = useState(50);
  const [betOnDog, setBetOnDog] = useState<0 | 1 | null>(null);
  const [bankroll, setBankroll] = useState(1000);
  const [portraits, setPortraits] = useState<[string | null, string | null]>([null, null]);
  const [loadingPortraits, setLoadingPortraits] = useState<[boolean, boolean]>([true, true]);

  const odds = calculateOdds(dog1, dog2);

  useEffect(() => {
    setBankroll(getBankroll());
  }, []);

  // Fetch AI portraits
  useEffect(() => {
    const fetchPortrait = async (dog: Dog, idx: 0 | 1) => {
      try {
        setLoadingPortraits(prev => {
          const next = [...prev] as [boolean, boolean];
          next[idx] = true;
          return next;
        });
        const res = await fetch('/api/generate-dog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            breed: dog.breed,
            color: dog.color,
            personality: dog.personality,
            name: dog.name,
          }),
        });
        const data = await res.json();
        if (data.success && data.image) {
          setPortraits(prev => {
            const next = [...prev] as [string | null, string | null];
            next[idx] = data.image;
            return next;
          });
        }
      } catch (err) {
        console.error(`[Doggie Dukes] Portrait failed for ${dog.name}:`, err);
      } finally {
        setLoadingPortraits(prev => {
          const next = [...prev] as [boolean, boolean];
          next[idx] = false;
          return next;
        });
      }
    };

    fetchPortrait(dog1, 0);
    fetchPortrait(dog2, 1);
  }, [dog1, dog2]);

  const canFight = betOnDog !== null && betAmount > 0 && betAmount <= bankroll;

  const renderFighterPanel = (dog: Dog, idx: 0 | 1) => (
    <div
      className={`${styles.fighterPanel} ${betOnDog === idx ? styles.fighterSelected : ''}`}
      onClick={() => setBetOnDog(idx)}
      style={{ cursor: 'pointer' }}
    >
      <div className={styles.portraitFrame}>
        {loadingPortraits[idx] ? (
          <span className={styles.portraitLoading}>GENERATING...</span>
        ) : portraits[idx] ? (
          <img src={portraits[idx]!} alt={dog.name} className={styles.portrait} />
        ) : (
          <span className={styles.portraitLoading}>NO SIGNAL</span>
        )}
      </div>

      <div className={styles.fighterInfo}>
        <div className={styles.fighterName}>{dog.name.toUpperCase()}</div>
        <div className={styles.fighterBreed}>{dog.breed.toUpperCase()}</div>

        <div className={styles.personalityBadge}>
          {dog.personality.toUpperCase()}
        </div>

        <ul className={styles.statsList}>
          {STAT_DEFS.map(stat => (
            <li key={stat.key} className={styles.statRow}>
              <span className={styles.statIcon}>{stat.icon}</span>
              <span className={styles.statLabel}>{stat.label}</span>
              <div className={styles.statBarBg}>
                <div
                  className={styles.statBarFill}
                  style={{
                    width: `${dog.stats[stat.key]}%`,
                    background: `linear-gradient(90deg, ${statColor(dog.stats[stat.key])}, ${statColor(dog.stats[stat.key])}88)`,
                  }}
                />
              </div>
              <span className={styles.statValue}>{dog.stats[stat.key]}</span>
            </li>
          ))}
        </ul>

        <div className={styles.oddsDisplay}>
          {odds[idx]}x
        </div>

        {betOnDog === idx && (
          <div className={styles.yourPick}>
            ▶ YOUR PICK ◀
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={styles.bettingScreen}>
      <div className={styles.bettingHeader}>
        <div className={styles.bettingTitle}>DOGGIE DUKES</div>
        <div className={styles.bettingSubtitle}>UNDERGROUND FIGHT CLUB</div>
      </div>

      <div className={styles.fightCard}>
        {renderFighterPanel(dog1, 0)}

        <div className={styles.vsBlock}>
          <div className={styles.vsLightning} />
          <span className={styles.vsText}>VS</span>
        </div>

        {renderFighterPanel(dog2, 1)}
      </div>

      {betOnDog === null && (
        <div className={styles.selectPrompt}>
          ▸ SELECT YOUR FIGHTER TO PLACE A BET ◂
        </div>
      )}

      <div className={styles.bettingControls}>
        <div className={styles.bankrollDisplay}>
          <div style={{ marginBottom: '4px' }}>BANKROLL</div>
          <div className={styles.bankrollAmount}>{bankroll}cr</div>
        </div>

        <div className={styles.betSection}>
          <span className={styles.betLabel}>WAGER:</span>
          <input
            type="number"
            className={styles.betInput}
            value={betAmount}
            onChange={e => setBetAmount(Math.max(0, Math.min(bankroll, parseInt(e.target.value) || 0)))}
            min={10}
            max={bankroll}
          />

          <button className={styles.betQuickBtn} onClick={() => setBetAmount(Math.min(50, bankroll))}>50</button>
          <button className={styles.betQuickBtn} onClick={() => setBetAmount(Math.min(100, bankroll))}>100</button>
          <button className={styles.betQuickBtn} onClick={() => setBetAmount(Math.min(250, bankroll))}>250</button>
          <button className={styles.betQuickBtn} onClick={() => setBetAmount(bankroll)}>ALL IN</button>
        </div>

        <button
          className={styles.fightButton}
          disabled={!canFight}
          onClick={() => betOnDog !== null && onFight(betAmount, betOnDog)}
        >
          FIGHT!
        </button>
      </div>
    </div>
  );
}
