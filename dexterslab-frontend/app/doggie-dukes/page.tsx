'use client';

/**
 * Doggie Dukes — Main Game Page
 * Underground dog fighting betting simulation with personality-driven upsets.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import {
  Dog,
  MatchOdds,
  FightAction,
  FightResult,
  generateMatchup,
  calculateOdds,
  simulateFight,
  calculatePayout,
  fetchDogImage,
} from './gameLogic';

type GamePhase = 'betting' | 'fighting' | 'results';

interface BetHistoryItem {
  dog1Breed: string;
  dog2Breed: string;
  winnerBreed: string;
  betOn: string;
  amount: number;
  payout: number;
  won: boolean;
}

const INITIAL_CREDITS = 1000;
const BET_STEP = 25;
const MIN_BET = 25;

export default function Page() {
  // ── Game State ──
  const [credits, setCredits] = useState(INITIAL_CREDITS);
  const [phase, setPhase] = useState<GamePhase>('betting');
  const [matchNumber, setMatchNumber] = useState(1);

  // ── Match State ──
  const [dogs, setDogs] = useState<[Dog, Dog] | null>(null);
  const [odds, setOdds] = useState<MatchOdds | null>(null);

  // ── Bet State ──
  const [selectedDog, setSelectedDog] = useState<0 | 1 | null>(null);
  const [betAmount, setBetAmount] = useState(100);

  // ── Fight State ──
  const [fightResult, setFightResult] = useState<FightResult | null>(null);
  const [visibleActions, setVisibleActions] = useState<FightAction[]>([]);
  const [currentHp, setCurrentHp] = useState<[number, number]>([0, 0]);
  const [fightComplete, setFightComplete] = useState(false);

  // ── AI Gen State ──
  const [dogImages, setDogImages] = useState<[string, string]>(['', '']);
  const [isGeneratingFighters, setIsGeneratingFighters] = useState(false);
  const [isGeneratingAftermath, setIsGeneratingAftermath] = useState(false);

  // ── History ──
  const [history, setHistory] = useState<BetHistoryItem[]>([]);

  // ── Refs ──
  const logRef = useRef<HTMLDivElement>(null);
  const fightTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Initialize first match ──
  useEffect(() => {
    newMatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const newMatch = useCallback(() => {
    const [d1, d2] = generateMatchup();
    setDogs([d1, d2]);
    setOdds(calculateOdds(d1, d2));
    setPhase('betting');
    setSelectedDog(null);
    setBetAmount(Math.min(100, credits));
    setFightResult(null);
    setVisibleActions([]);
    setCurrentHp([d1.stats.maxHealth, d2.stats.maxHealth]);
    setFightComplete(false);
    setDogImages(['', '']);
    setIsGeneratingFighters(true);

    Promise.all([
      fetchDogImage(d1, 'pre-fight'),
      fetchDogImage(d2, 'pre-fight')
    ]).then(([img1, img2]) => {
      setDogImages([img1, img2]);
      setIsGeneratingFighters(false);
    }).catch(e => {
      console.error(e);
      setDogImages(['/dogs/dog_pitbull.png', '/dogs/dog_pitbull.png']);
      setIsGeneratingFighters(false);
    });
  }, [credits]);

  // ── Place Bet & Start Fight ──
  const placeBet = () => {
    if (selectedDog === null || !dogs || !odds) return;
    if (betAmount > credits || betAmount < MIN_BET) return;

    setCredits(prev => prev - betAmount);
    setPhase('fighting');

    // Run the fight simulation
    const result = simulateFight(dogs[0], dogs[1]);
    setFightResult(result);

    // Animate actions one at a time
    let actionIndex = 0;
    const playNext = () => {
      if (actionIndex < result.actions.length) {
        const action = result.actions[actionIndex];
        setVisibleActions(prev => [...prev, action]);

        // Update HP display
        const d1Hp = action.attacker === dogs[0].id ? action.attackerHp : action.defenderHp;
        const d2Hp = action.attacker === dogs[1].id ? action.attackerHp : action.defenderHp;
        setCurrentHp([d1Hp, d2Hp]);

        actionIndex++;
        fightTimerRef.current = setTimeout(playNext, 600 + Math.random() * 400);
      } else {
        finishFight(result);
      }
    };

    fightTimerRef.current = setTimeout(playNext, 800);
  };

  const finishFight = (result: FightResult) => {
    if (!dogs || !odds || selectedDog === null) return;

    setFightComplete(true);
    setPhase('results');

    const betOnDog = dogs[selectedDog];
    const won = result.winner.id === betOnDog.id;
    const selectedOdds = selectedDog === 0 ? odds.dog1Odds : odds.dog2Odds;
    const payout = won ? calculatePayout(betAmount, selectedOdds) : 0;

    if (won) {
      setCredits(prev => prev + payout);
    }

    setHistory(prev => [
      {
        dog1Breed: dogs[0].breed,
        dog2Breed: dogs[1].breed,
        winnerBreed: result.winner.breed,
        betOn: betOnDog.breed,
        amount: betAmount,
        payout: won ? payout : -betAmount,
        won,
      },
      ...prev,
    ].slice(0, 20));

    // Wait 1.5s for the initial win state to sink in, then generate Mathmath
    setTimeout(() => {
      setIsGeneratingAftermath(true);
      const s1 = result.winner.id === dogs[0].id ? 'winner-aftermath' : 'loser-aftermath';
      const s2 = result.winner.id === dogs[1].id ? 'winner-aftermath' : 'loser-aftermath';
      
      Promise.all([
        fetchDogImage(dogs[0], s1),
        fetchDogImage(dogs[1], s2)
      ]).then(([img1, img2]) => {
        setDogImages([img1, img2]);
        setIsGeneratingAftermath(false);
      }).catch(e => {
        console.error(e);
        setIsGeneratingAftermath(false);
      });
    }, 1500);
  };

  const skipFight = () => {
    if (fightTimerRef.current) clearTimeout(fightTimerRef.current);
    if (fightResult && dogs) {
      setVisibleActions(fightResult.actions);
      const lastAction = fightResult.actions[fightResult.actions.length - 1];
      if (lastAction) {
        const d1Hp = lastAction.attacker === dogs[0].id ? lastAction.attackerHp : lastAction.defenderHp;
        const d2Hp = lastAction.attacker === dogs[1].id ? lastAction.attackerHp : lastAction.defenderHp;
        setCurrentHp([d1Hp, d2Hp]);
      }
      finishFight(fightResult);
    }
  };

  const nextMatch = () => {
    setMatchNumber(prev => prev + 1);
    newMatch();
  };

  const restart = () => {
    setCredits(INITIAL_CREDITS);
    setMatchNumber(1);
    setHistory([]);
    newMatch();
  };

  // Auto-scroll fight log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [visibleActions]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (fightTimerRef.current) clearTimeout(fightTimerRef.current);
    };
  }, []);

  // ── Rendering Helpers ──
  const getStatColor = (value: number, max: number = 10) => {
    const pct = value / max;
    if (pct >= 0.8) return '#00ff88';
    if (pct >= 0.6) return '#44ddff';
    if (pct >= 0.4) return '#ffaa00';
    return '#ff4466';
  };

  const getHealthColor = (current: number, max: number) => {
    const pct = current / max;
    if (pct >= 0.6) return '#00ff88';
    if (pct >= 0.3) return '#ffaa00';
    return '#ff4466';
  };

  const renderStatBar = (label: string, value: number, max: number = 12) => {
    const pct = Math.min(100, (value / max) * 100);
    const color = getStatColor(value, max);
    return (
      <div className={styles.statRow} key={label}>
        <span className={styles.statName}>{label}</span>
        <div className={styles.statBarOuter}>
          <div
            className={styles.statBarInner}
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
        <span className={styles.statValue}>{value.toFixed(1)}</span>
      </div>
    );
  };

  const renderDogCard = (dog: Dog, index: 0 | 1) => {
    const isSelected = selectedDog === index;
    const isWinner = fightResult && fightResult.winner.id === dog.id;
    const isLoser = fightResult && fightResult.loser.id === dog.id;

    let cardClass = styles.dogCard;
    if (phase === 'results' && isWinner) cardClass += ` ${styles.dogCardWinner}`;
    if (phase === 'results' && isLoser) cardClass += ` ${styles.dogCardLoser}`;
    if (phase === 'betting' && isSelected) cardClass += ` ${styles.dogCardSelected}`;

    const dogOdds = odds ? (index === 0 ? odds.dog1Odds : odds.dog2Odds) : 0;

    return (
      <div className={cardClass}>
        <div className={styles.breedName}>{dog.breed}</div>
        <div className={styles.dogName}>
          {dog.name} &ldquo;{dog.nickname}&rdquo;
        </div>
        <div className={styles.dogNickname}>{dog.color} coat • {dog.size} build</div>

        <div className={styles.dogImageWrapper}>
          {isGeneratingFighters ? (
            <div className={styles.generatingOverlay}>
              <div className={styles.spinner}></div>
              <span>Constructing via GenAI...</span>
            </div>
          ) : dogImages[index] ? (
            <img src={dogImages[index]} alt={dog.breed} className={styles.dogImage} />
          ) : null}
          {isGeneratingAftermath && (
            <div className={styles.aftermathGeneratingOverlay}>
              <div className={styles.spinnerSmall}></div>
              <span>Updating Aftermath...</span>
            </div>
          )}
        </div>

        <div className={styles.dogMeta}>
          <span className={styles.metaTag}>{dog.age} yrs</span>
          <span className={styles.metaTag}>{dog.weight} lbs</span>
          <span className={styles.metaTag}>{dog.size}</span>
        </div>

        <div className={styles.personalityBadge}>
          <span>{dog.personality.emoji}</span>
          <span className={styles.personalityName}>{dog.personality.name}</span>
        </div>
        <div className={styles.personalityDesc}>{dog.personality.description}</div>

        <div className={styles.fightStyleLabel}>FIGHT STYLE</div>
        <div className={styles.fightStyle}>{dog.fightStyle}</div>

        <div className={styles.statsGrid}>
          {renderStatBar('POWER', dog.stats.power)}
          {renderStatBar('SPEED', dog.stats.speed)}
          {renderStatBar('DEFENSE', dog.stats.defense)}
          {renderStatBar('STAMINA', dog.stats.stamina)}
          {renderStatBar('AGGRO', dog.stats.aggression)}
        </div>

        <div className={styles.recordRow}>
          <span className={styles.recordWins}>W: {dog.record.wins}</span>
          <span className={styles.recordLosses}>L: {dog.record.losses}</span>
        </div>

        <div className={styles.oddsDisplay}>
          <span className={styles.oddsLabel}>ODDS:</span>
          <span className={styles.oddsValue}>{dogOdds.toFixed(2)}x</span>
        </div>
      </div>
    );
  };

  const getActionClass = (action: string) => {
    switch (action) {
      case 'crit': return styles.actionCrit;
      case 'dodge': return styles.actionDodge;
      case 'freeze': return styles.actionFreeze;
      case 'rally': return styles.actionRally;
      default: return '';
    }
  };

  // ── Loading check ──
  if (!dogs || !odds) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.loadingSpinner} />
          <span className={styles.loadingText}>GENERATING MATCHUP...</span>
        </div>
      </div>
    );
  }

  // ── Game Over ──
  if (credits <= 0 && phase !== 'fighting') {
    return (
      <div className={styles.container}>
        <div className={styles.container}>
          <div className={styles.content}>
            <header className={styles.header}>
              <Link href="/" className={styles.backLink}>← BACK TO LAB</Link>
              <div className={styles.titleRow}>
                <span className={styles.icon}>🐕</span>
                <h1 className={styles.title}>DOGGIE DUKES</h1>
              </div>
            </header>

            <div className={styles.gameOver}>
              <div className={styles.gameOverTitle}>BUSTED!</div>
              <p className={styles.gameOverSub}>
                You&apos;re out of credits. The house always wins... eventually.
              </p>
              <p className={styles.gameOverSub}>
                You lasted {matchNumber} matches with {history.filter(h => h.won).length} wins.
              </p>
              <button className={styles.restartBtn} onClick={restart}>
                BUY BACK IN — ${INITIAL_CREDITS}
              </button>
            </div>

            {history.length > 0 && (
              <div className={styles.historyPanel}>
                <div className={styles.historyTitle}>FIGHT HISTORY</div>
                {history.map((h, i) => (
                  <div key={i} className={styles.historyItem}>
                    <span className={styles.historyMatchup}>
                      {h.dog1Breed.split(' ').pop()} vs {h.dog2Breed.split(' ').pop()}
                    </span>
                    <span className={`${styles.historyResult} ${h.won ? styles.historyWin : styles.historyLoss}`}>
                      {h.won ? `+$${h.payout}` : `-$${h.amount}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* ── Header ── */}
        <header className={styles.header}>
          <Link href="/" className={styles.backLink}>← BACK TO LAB</Link>
          <div className={styles.titleRow}>
            <span className={styles.icon}>🐕</span>
            <h1 className={styles.title}>DOGGIE DUKES</h1>
          </div>
          <p className={styles.subtitle}>UNDERGROUND DOG BETTING SIMULATION</p>
        </header>

        {/* ── Credits Bar ── */}
        <div className={styles.creditsBar}>
          <span className={styles.creditsLabel}>CREDITS</span>
          <span className={styles.creditsAmount}>${credits.toLocaleString()}</span>
          <span className={styles.matchCount}>MATCH #{matchNumber}</span>
        </div>

        {/* ── Arena — Two Dog Cards ── */}
        <div className={styles.arena}>
          {renderDogCard(dogs[0], 0)}
          <div className={styles.vsColumn}>
            <span className={styles.vsText}>VS</span>
            {odds.upset && <span className={styles.upsetBadge}>⚡ TOSS-UP</span>}
          </div>
          {renderDogCard(dogs[1], 1)}
        </div>

        {/* ── Betting Panel (only in betting phase) ── */}
        {phase === 'betting' && (
          <div className={styles.bettingPanel}>
            <div className={styles.bettingTitle}>PLACE YOUR BET</div>

            <div className={styles.betSelection}>
              {[0, 1].map(i => (
                <button
                  key={i}
                  className={`${styles.betDogBtn} ${selectedDog === i ? styles.betDogBtnSelected : ''}`}
                  onClick={() => setSelectedDog(i as 0 | 1)}
                >
                  <div className={styles.betDogName}>{dogs[i].name}</div>
                  <div className={styles.betDogBreed}>{dogs[i].breed}</div>
                  <div className={styles.betDogOdds}>
                    {(i === 0 ? odds.dog1Odds : odds.dog2Odds).toFixed(2)}x
                  </div>
                </button>
              ))}
            </div>

            <div className={styles.betAmountSection}>
              <div className={styles.betAmountLabel}>BET AMOUNT</div>
              <div className={styles.betAmountControls}>
                <button
                  className={styles.betAmountBtn}
                  onClick={() => setBetAmount(prev => Math.max(MIN_BET, prev - BET_STEP))}
                  disabled={betAmount <= MIN_BET}
                >−</button>
                <span className={styles.betAmountDisplay}>${betAmount}</span>
                <button
                  className={styles.betAmountBtn}
                  onClick={() => setBetAmount(prev => Math.min(credits, prev + BET_STEP))}
                  disabled={betAmount >= credits}
                >+</button>
              </div>
              <div className={styles.betQuickBtns}>
                {[25, 50, 100, 250].map(amt => (
                  <button
                    key={amt}
                    className={styles.quickBtn}
                    onClick={() => setBetAmount(Math.min(amt, credits))}
                    disabled={amt > credits}
                  >${amt}</button>
                ))}
                <button
                  className={styles.quickBtn}
                  onClick={() => setBetAmount(credits)}
                >ALL IN</button>
              </div>
            </div>

            {selectedDog !== null && (
              <div className={styles.payoutPreview}>
                <div className={styles.payoutLabel}>POTENTIAL PAYOUT</div>
                <div className={styles.payoutAmount}>
                  ${calculatePayout(betAmount, selectedDog === 0 ? odds.dog1Odds : odds.dog2Odds).toLocaleString()}
                </div>
              </div>
            )}

            <button
              className={styles.placeBetBtn}
              onClick={placeBet}
              disabled={selectedDog === null || betAmount < MIN_BET || betAmount > credits}
            >
              {selectedDog === null ? 'SELECT A DOG' : `BET $${betAmount} ON ${dogs[selectedDog].name.toUpperCase()}`}
            </button>
          </div>
        )}

        {/* ── Fight View ── */}
        {(phase === 'fighting' || phase === 'results') && (
          <div className={styles.fightSection}>
            <div className={styles.fightHeader}>
              <span className={styles.fightTitle}>⚔ FIGHT IN PROGRESS</span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {visibleActions.length > 0 && (
                  <span className={styles.roundBadge}>
                    ROUND {visibleActions[visibleActions.length - 1].round}
                  </span>
                )}
                {phase === 'fighting' && !fightComplete && (
                  <button className={styles.skipBtn} onClick={skipFight}>SKIP →</button>
                )}
              </div>
            </div>

            {/* Health Bars */}
            <div className={styles.healthBars}>
              {[0, 1].map(i => {
                const dog = dogs[i];
                const hp = currentHp[i];
                const max = dog.stats.maxHealth;
                const pct = Math.max(0, (hp / max) * 100);
                const color = getHealthColor(hp, max);
                return (
                  <div key={i} className={styles.healthBarContainer}>
                    <div className={styles.healthBarLabel}>
                      <span className={styles.healthBarName}>{dog.name}</span>
                      <span className={styles.healthBarValue}>{Math.max(0, Math.round(hp))} / {max}</span>
                    </div>
                    <div className={styles.healthBarTrack}>
                      <div
                        className={`${styles.healthBarFill} ${phase === 'fighting' && !fightComplete ? styles.healthBarFillAnimating : ''}`}
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action Log */}
            <div className={styles.actionLog} ref={logRef}>
              {visibleActions.length === 0 ? (
                <div className={styles.hintText}>The dogs circle each other...</div>
              ) : (
                visibleActions.map((action, i) => (
                  <div key={i} className={styles.actionItem}>
                    <div className={styles.actionRound}>ROUND {action.round}</div>
                    <div className={`${styles.actionText} ${getActionClass(action.action)}`}>
                      {action.narrative}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {phase === 'results' && fightResult && selectedDog !== null && (
          <div className={styles.resultPanel}>
            {(() => {
              const betOnDog = dogs[selectedDog];
              const won = fightResult.winner.id === betOnDog.id;
              const selectedOdds = selectedDog === 0 ? odds.dog1Odds : odds.dog2Odds;
              const payout = won ? calculatePayout(betAmount, selectedOdds) : 0;

              return (
                <>
                  <div className={`${styles.resultTitle} ${won ? styles.resultWin : styles.resultLoss}`}>
                    {won ? '💰 YOU WIN!' : '💀 YOU LOSE'}
                  </div>
                  <div className={styles.resultWinner}>
                    {fightResult.winner.name} ({fightResult.winner.breed}) wins!
                  </div>
                  <div className={styles.resultMethod}>
                    {fightResult.ko ? 'KO' : 'Decision'} in Round {fightResult.rounds}
                  </div>
                  <div className={`${styles.resultPayout} ${won ? styles.resultPayoutWin : styles.resultPayoutLoss}`}>
                    <div className={styles.resultPayoutLabel}>{won ? 'PAYOUT' : 'LOST'}</div>
                    <div className={`${styles.resultPayoutAmount} ${won ? styles.resultPayoutAmountWin : styles.resultPayoutAmountLoss}`}>
                      {won ? `+$${payout.toLocaleString()}` : `-$${betAmount.toLocaleString()}`}
                    </div>
                  </div>
                  <br />
                  <button className={styles.nextMatchBtn} onClick={nextMatch}>
                    NEXT MATCH →
                  </button>
                </>
              );
            })()}
          </div>
        )}

        {/* ── Bet History ── */}
        {history.length > 0 && (
          <div className={styles.historyPanel}>
            <div className={styles.historyTitle}>
              FIGHT HISTORY — {history.filter(h => h.won).length}W / {history.filter(h => !h.won).length}L
            </div>
            {history.map((h, i) => (
              <div key={i} className={styles.historyItem}>
                <span className={styles.historyMatchup}>
                  {h.dog1Breed.split(' ').pop()} vs {h.dog2Breed.split(' ').pop()}
                </span>
                <span className={`${styles.historyResult} ${h.won ? styles.historyWin : styles.historyLoss}`}>
                  {h.won ? `+$${h.payout}` : `-$${h.amount}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
