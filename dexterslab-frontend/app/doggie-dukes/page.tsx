'use client';

import { useState, useCallback } from 'react';
import styles from './page.module.css';
import { Dog, generateFightPair, getBankroll, rescueBankroll } from './lib/dogs';
import { CombatState } from './lib/combat-engine';
import BettingScreen from './components/BettingScreen';
import CombatArena from './components/CombatArena';
import ResultsScreen from './components/ResultsScreen';

type GamePhase = 'betting' | 'combat' | 'results';

export default function DoggiesDukesPage() {
  const [phase, setPhase] = useState<GamePhase>('betting');
  const [fighters, setFighters] = useState<[Dog, Dog]>(() => generateFightPair());
  const [betAmount, setBetAmount] = useState(0);
  const [betOnDog, setBetOnDog] = useState<0 | 1>(0);
  const [combatResult, setCombatResult] = useState<CombatState | null>(null);
  const [gameOver, setGameOver] = useState(false);

  const handleFight = useCallback((amount: number, dog: 0 | 1) => {
    setBetAmount(amount);
    setBetOnDog(dog);
    setPhase('combat');
  }, []);

  const handleCombatFinished = useCallback((state: CombatState) => {
    setCombatResult(state);
    setPhase('results');

    // Check for game over after bankroll update
    setTimeout(() => {
      const bankroll = getBankroll();
      const won = state.winner === betOnDog;
      const newBankroll = won
        ? bankroll // Already updated in ResultsScreen
        : bankroll;
      if (newBankroll <= 0) {
        setGameOver(true);
      }
    }, 100);
  }, [betOnDog]);

  const handleNextFight = useCallback(() => {
    const bankroll = getBankroll();
    if (bankroll <= 0) {
      setGameOver(true);
      return;
    }
    setFighters(generateFightPair());
    setCombatResult(null);
    setPhase('betting');
  }, []);

  const handleFreeCredits = useCallback(() => {
    rescueBankroll();
    setGameOver(false);
    setFighters(generateFightPair());
    setCombatResult(null);
    setPhase('betting');
  }, []);

  return (
    <div className={styles.container}>
      {phase === 'betting' && (
        <BettingScreen
          dog1={fighters[0]}
          dog2={fighters[1]}
          onFight={handleFight}
        />
      )}

      {phase === 'combat' && (
        <CombatArena
          dog1={fighters[0]}
          dog2={fighters[1]}
          onFinished={handleCombatFinished}
        />
      )}

      {phase === 'results' && combatResult && (
        <ResultsScreen
          combatState={combatResult}
          dog1={fighters[0]}
          dog2={fighters[1]}
          betAmount={betAmount}
          betOnDog={betOnDog}
          onNextFight={handleNextFight}
        />
      )}

      {gameOver && (
        <div className={styles.gameOverOverlay}>
          <div className={styles.gameOverText}>GAME OVER</div>
          <div style={{ fontSize: '8px', color: '#888', letterSpacing: '2px' }}>
            YOU&apos;RE BROKE, PAL
          </div>
          <button className={styles.freeCreditsBtn} onClick={handleFreeCredits}>
            FREE 500 CREDITS
          </button>
        </div>
      )}
    </div>
  );
}
