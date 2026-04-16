'use client';

import { useState, useEffect } from 'react';
import styles from '../page.module.css';
import { Dog, calculateOdds, getBankroll, setBankroll } from '../lib/dogs';
import { CombatState, getFightHighlights, getFightStats, FightStats } from '../lib/combat-engine';

interface ResultsScreenProps {
  combatState: CombatState;
  dog1: Dog;
  dog2: Dog;
  betAmount: number;
  betOnDog: 0 | 1;
  onNextFight: () => void;
}

export default function ResultsScreen({
  combatState,
  dog1,
  dog2,
  betAmount,
  betOnDog,
  onNextFight,
}: ResultsScreenProps) {
  const [winnerPortrait, setWinnerPortrait] = useState<string | null>(null);
  const [loserPortrait, setLoserPortrait] = useState<string | null>(null);
  const [loadingPortraits, setLoadingPortraits] = useState(true);

  const winner = combatState.winner;
  const dogs = [dog1, dog2];
  const winnerDog = winner !== null ? dogs[winner] : null;
  const loserDog = winner !== null ? dogs[1 - winner] : null;

  const odds = calculateOdds(dog1, dog2);
  const playerWon = winner === betOnDog;
  const payout = playerWon ? Math.floor(betAmount * odds[betOnDog]) : 0;
  const netResult = playerWon ? payout - betAmount : -betAmount;

  const stats: FightStats = getFightStats(combatState);
  const highlights = getFightHighlights(combatState.events);

  // Update bankroll
  useEffect(() => {
    const currentBankroll = getBankroll();
    const newBankroll = currentBankroll + netResult;
    setBankroll(newBankroll);
  }, [netResult]);

  // Fetch aftermath portraits
  useEffect(() => {
    const fetchPortrait = async (dog: Dog, status: string, setter: (v: string) => void) => {
      try {
        const res = await fetch('/api/generate-dog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            breed: dog.breed,
            color: dog.color,
            personality: dog.personality,
            name: dog.name,
            status,
          }),
        });
        const data = await res.json();
        if (data.success && data.image) {
          setter(data.image);
        }
      } catch (err) {
        console.error(`[Doggie Dukes] Aftermath portrait failed:`, err);
      }
    };

    if (winnerDog && loserDog) {
      Promise.all([
        fetchPortrait(winnerDog, 'winner-aftermath', setWinnerPortrait),
        fetchPortrait(loserDog, 'loser-aftermath', setLoserPortrait),
      ]).finally(() => setLoadingPortraits(false));
    }
  }, [winnerDog, loserDog]);

  const newBankroll = getBankroll() + netResult;

  return (
    <div className={styles.resultsScreen}>
      <div className={styles.resultsTitle}>
        {combatState.events.find(e => e.type === 'ko') ? 'K.O.!' : 'TIME!'}
      </div>

      {winnerDog && (
        <div className={styles.winnerName}>
          {winnerDog.name.toUpperCase()} WINS!
        </div>
      )}

      {/* Payout Section */}
      <div className={styles.payoutSection}>
        <div className={styles.payoutBox}>
          <div className={styles.payoutLabel}>YOUR BET</div>
          <div style={{ fontSize: '12px', color: '#CCC' }}>
            {betAmount}cr on {dogs[betOnDog].name}
          </div>
        </div>

        <div className={styles.payoutBox}>
          <div className={styles.payoutLabel}>RESULT</div>
          {playerWon ? (
            <div className={styles.payoutWin}>+{payout}cr</div>
          ) : (
            <div className={styles.payoutLoss}>-{betAmount}cr</div>
          )}
        </div>

        <div className={styles.payoutBox}>
          <div className={styles.payoutLabel}>BANKROLL</div>
          <div className={styles.payoutNewTotal}>
            {Math.max(0, newBankroll)}cr
          </div>
        </div>
      </div>

      {/* Fight Stats */}
      <table className={styles.statsTable}>
        <thead>
          <tr>
            <th></th>
            <th style={{ color: '#00FFE0' }}>{stats.fighters[0].name.toUpperCase()}</th>
            <th style={{ color: '#FF2D95' }}>{stats.fighters[1].name.toUpperCase()}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>HITS LANDED</td>
            <td>{stats.fighters[0].hitsLanded}</td>
            <td>{stats.fighters[1].hitsLanded}</td>
          </tr>
          <tr>
            <td>DAMAGE DONE</td>
            <td>{stats.fighters[0].damageDone}</td>
            <td>{stats.fighters[1].damageDone}</td>
          </tr>
          <tr>
            <td>DODGES</td>
            <td>{stats.fighters[0].dodges}</td>
            <td>{stats.fighters[1].dodges}</td>
          </tr>
          <tr>
            <td>COMBOS</td>
            <td>{stats.fighters[0].combos}</td>
            <td>{stats.fighters[1].combos}</td>
          </tr>
          <tr>
            <td>BIGGEST HIT</td>
            <td>{stats.fighters[0].biggestHit}</td>
            <td>{stats.fighters[1].biggestHit}</td>
          </tr>
          <tr>
            <td>FINAL HP</td>
            <td>{stats.fighters[0].finalHP}/{stats.fighters[0].maxHP}</td>
            <td>{stats.fighters[1].finalHP}/{stats.fighters[1].maxHP}</td>
          </tr>
        </tbody>
      </table>

      {/* Highlights */}
      {highlights.length > 0 && (
        <div className={styles.highlightsBox}>
          <div className={styles.highlightsTitle}>▸ FIGHT HIGHLIGHTS</div>
          {highlights.map((event, i) => (
            <div key={i} className={styles.highlightItem}>
              {event.text}
            </div>
          ))}
        </div>
      )}

      {/* Aftermath Portraits */}
      <div className={styles.aftermathPortraits}>
        {winnerDog && (
          <div className={styles.aftermathCard}>
            <div className={`${styles.aftermathLabel} ${styles.aftermathWinner}`}>
              ★ WINNER ★
            </div>
            <div className={styles.aftermathFrame}>
              {winnerPortrait ? (
                <img src={winnerPortrait} alt={winnerDog.name} className={styles.aftermathImg} />
              ) : (
                <span className={styles.portraitLoading}>
                  {loadingPortraits ? 'GENERATING...' : 'NO SIGNAL'}
                </span>
              )}
            </div>
            <div style={{ fontSize: '8px', color: '#00FF88', marginTop: '4px' }}>
              {winnerDog.name.toUpperCase()}
            </div>
          </div>
        )}

        {loserDog && (
          <div className={styles.aftermathCard}>
            <div className={`${styles.aftermathLabel} ${styles.aftermathLoser}`}>
              ✕ LOSER ✕
            </div>
            <div className={styles.aftermathFrame}>
              {loserPortrait ? (
                <img src={loserPortrait} alt={loserDog.name} className={styles.aftermathImg} />
              ) : (
                <span className={styles.portraitLoading}>
                  {loadingPortraits ? 'GENERATING...' : 'NO SIGNAL'}
                </span>
              )}
            </div>
            <div style={{ fontSize: '8px', color: '#FF4444', marginTop: '4px' }}>
              {loserDog.name.toUpperCase()}
            </div>
          </div>
        )}
      </div>

      <div style={{ fontSize: '7px', color: '#555', marginTop: '4px' }}>
        FIGHT DURATION: {stats.duration}s
      </div>

      <div className={styles.resultButtons}>
        <button className={styles.nextFightBtn} onClick={onNextFight}>
          NEXT FIGHT
        </button>
      </div>
    </div>
  );
}
