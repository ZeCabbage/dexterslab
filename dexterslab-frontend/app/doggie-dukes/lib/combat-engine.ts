// ═══════════════════════════════════════════════════════════════
//  DOGGIE DUKES — Combat Engine
//  Tick-based auto-combat simulation with event logging
//  Stats drive all probabilities — this is the gambling heart
// ═══════════════════════════════════════════════════════════════

import { Dog, DogStats } from './dogs';

// ── Types ──

export type CombatEventType =
  | 'fight_start'
  | 'attack'
  | 'hit'
  | 'miss'
  | 'dodge'
  | 'combo'
  | 'counter'
  | 'critical'
  | 'knockback'
  | 'second_wind'
  | 'ko'
  | 'timeout_win'
  | 'round_start';

export interface CombatEvent {
  tick: number;
  type: CombatEventType;
  attacker: 0 | 1;           // Index of attacking dog
  defender: 0 | 1;
  damage: number;
  text: string;
  hp: [number, number];      // Current HP after event
  combo?: number;            // Current combo count
}

export interface FighterState {
  dog: Dog;
  hp: number;
  maxHP: number;
  x: number;                  // Position on arena (0-800)
  state: 'idle' | 'attacking' | 'hit' | 'dodging' | 'ko' | 'victory' | 'walking';
  stateTimer: number;         // Ticks remaining in current state
  facing: 1 | -1;             // 1 = right, -1 = left
  attackCooldown: number;     // Ticks until next attack allowed
  comboCounter: number;       // Current combo streak
  totalHitsLanded: number;
  totalDamageDone: number;
  totalDodges: number;
  totalCombos: number;
  biggestHit: number;
}

export interface CombatState {
  fighters: [FighterState, FighterState];
  tick: number;
  maxTicks: number;           // 90 seconds * 10 tps = 900 ticks
  events: CombatEvent[];
  winner: 0 | 1 | null;
  isFinished: boolean;
  roundTimer: number;         // Seconds remaining
}

// ── Constants ──

const TICKS_PER_SECOND = 10;
const FIGHT_DURATION_SECONDS = 90;
const MAX_TICKS = FIGHT_DURATION_SECONDS * TICKS_PER_SECOND;

const ARENA_LEFT = 100;
const ARENA_RIGHT = 700;
const FIGHT_DISTANCE = 80;       // Distance at which dogs can hit each other
const APPROACH_SPEED = 4;        // Pixels per tick when walking toward opponent

const BASE_ATTACK_COOLDOWN = 15; // Ticks between attacks (modified by agility)
const HIT_STUN_TICKS = 5;
const DODGE_TICKS = 4;
const ATTACK_TICKS = 4;
const KNOCKBACK_DISTANCE = 30;

// ── Combat Engine ──

export function initCombat(dog1: Dog, dog2: Dog): CombatState {
  const state: CombatState = {
    fighters: [
      {
        dog: dog1,
        hp: dog1.maxHP,
        maxHP: dog1.maxHP,
        x: ARENA_LEFT + 50,
        state: 'idle',
        stateTimer: 0,
        facing: 1,
        attackCooldown: 20 + Math.floor(Math.random() * 10), // Stagger first attacks
        comboCounter: 0,
        totalHitsLanded: 0,
        totalDamageDone: 0,
        totalDodges: 0,
        totalCombos: 0,
        biggestHit: 0,
      },
      {
        dog: dog2,
        hp: dog2.maxHP,
        maxHP: dog2.maxHP,
        x: ARENA_RIGHT - 50,
        state: 'idle',
        stateTimer: 0,
        facing: -1,
        attackCooldown: 25 + Math.floor(Math.random() * 10),
        comboCounter: 0,
        totalHitsLanded: 0,
        totalDamageDone: 0,
        totalDodges: 0,
        totalCombos: 0,
        biggestHit: 0,
      },
    ],
    tick: 0,
    maxTicks: MAX_TICKS,
    events: [],
    winner: null,
    isFinished: false,
    roundTimer: FIGHT_DURATION_SECONDS,
  };

  state.events.push({
    tick: 0,
    type: 'fight_start',
    attacker: 0,
    defender: 1,
    damage: 0,
    text: 'ROUND 1 — FIGHT!',
    hp: [state.fighters[0].hp, state.fighters[1].hp],
  });

  return state;
}

// ── Tick the combat forward one step ──

export function tickCombat(state: CombatState): CombatState {
  if (state.isFinished) return state;

  state.tick++;
  state.roundTimer = Math.max(0, FIGHT_DURATION_SECONDS - Math.floor(state.tick / TICKS_PER_SECOND));

  // Update state timers
  for (const fighter of state.fighters) {
    if (fighter.stateTimer > 0) {
      fighter.stateTimer--;
      if (fighter.stateTimer === 0 && fighter.state !== 'ko' && fighter.state !== 'victory') {
        fighter.state = 'idle';
      }
    }
    if (fighter.attackCooldown > 0) {
      fighter.attackCooldown--;
    }
  }

  // Move fighters toward each other if too far apart
  const distance = Math.abs(state.fighters[0].x - state.fighters[1].x);

  for (let i = 0; i < 2; i++) {
    const fighter = state.fighters[i];
    const opponent = state.fighters[1 - i];

    if (fighter.state === 'idle' && distance > FIGHT_DISTANCE) {
      const dir = opponent.x > fighter.x ? 1 : -1;
      fighter.x += dir * APPROACH_SPEED;
      fighter.x = Math.max(ARENA_LEFT, Math.min(ARENA_RIGHT, fighter.x));
      fighter.state = 'walking';
      fighter.stateTimer = 1;
    }
  }

  // Attack logic — each fighter tries to attack
  for (let i = 0; i < 2; i++) {
    const attackerIdx = i as 0 | 1;
    const defenderIdx = (1 - i) as 0 | 1;
    const attacker = state.fighters[attackerIdx];
    const defender = state.fighters[defenderIdx];

    // Can only attack if idle/walking, cooldown done, and in range
    if (
      (attacker.state === 'idle' || attacker.state === 'walking') &&
      attacker.attackCooldown <= 0 &&
      Math.abs(attacker.x - defender.x) <= FIGHT_DISTANCE &&
      defender.state !== 'ko'
    ) {
      attemptAttack(state, attackerIdx, defenderIdx);
    }
  }

  // Check for KO
  for (let i = 0; i < 2; i++) {
    if (state.fighters[i].hp <= 0 && state.fighters[i].state !== 'ko') {
      state.fighters[i].hp = 0;
      state.fighters[i].state = 'ko';
      state.fighters[i].stateTimer = 999;

      const winnerIdx = (1 - i) as 0 | 1;
      state.fighters[winnerIdx].state = 'victory';
      state.fighters[winnerIdx].stateTimer = 999;
      state.winner = winnerIdx;
      state.isFinished = true;

      state.events.push({
        tick: state.tick,
        type: 'ko',
        attacker: winnerIdx,
        defender: i as 0 | 1,
        damage: 0,
        text: `K.O.! ${state.fighters[winnerIdx].dog.name} WINS!`,
        hp: [state.fighters[0].hp, state.fighters[1].hp],
      });
    }
  }

  // Check timeout
  if (state.tick >= MAX_TICKS && !state.isFinished) {
    const hp0 = state.fighters[0].hp / state.fighters[0].maxHP;
    const hp1 = state.fighters[1].hp / state.fighters[1].maxHP;
    const winnerIdx: 0 | 1 = hp0 >= hp1 ? 0 : 1;

    state.winner = winnerIdx;
    state.isFinished = true;
    state.fighters[winnerIdx].state = 'victory';
    state.fighters[winnerIdx].stateTimer = 999;

    state.events.push({
      tick: state.tick,
      type: 'timeout_win',
      attacker: winnerIdx,
      defender: (1 - winnerIdx) as 0 | 1,
      damage: 0,
      text: `TIME! ${state.fighters[winnerIdx].dog.name} wins by decision!`,
      hp: [state.fighters[0].hp, state.fighters[1].hp],
    });
  }

  return state;
}

// ── Attack Resolution ──

function attemptAttack(state: CombatState, attackerIdx: 0 | 1, defenderIdx: 0 | 1): void {
  const attacker = state.fighters[attackerIdx];
  const defender = state.fighters[defenderIdx];
  const aStats = attacker.dog.stats;
  const dStats = defender.dog.stats;

  // Set attacker to attacking state
  attacker.state = 'attacking';
  attacker.stateTimer = ATTACK_TICKS;

  // Calculate cooldown (higher agility = faster attacks)
  attacker.attackCooldown = Math.max(6, BASE_ATTACK_COOLDOWN - Math.floor(aStats.agility / 12));

  // Personality modifier for attack speed
  if (attacker.dog.personality === 'Berserker') attacker.attackCooldown -= 2;
  if (attacker.dog.personality === 'Puppy Energy') attacker.attackCooldown -= 1;
  if (attacker.dog.personality === 'Old Veteran') attacker.attackCooldown += 2;

  // Dodge check
  const dodgeChance = dStats.agility / 250; // Max ~40% dodge rate
  const personalityDodgeBonus = defender.dog.personality === 'Coward' ? 0.1 : 0;

  if (Math.random() < dodgeChance + personalityDodgeBonus) {
    // Dodged!
    defender.state = 'dodging';
    defender.stateTimer = DODGE_TICKS;
    defender.totalDodges++;
    attacker.comboCounter = 0;

    state.events.push({
      tick: state.tick,
      type: 'dodge',
      attacker: attackerIdx,
      defender: defenderIdx,
      damage: 0,
      text: `${defender.dog.name} dodges!`,
      hp: [state.fighters[0].hp, state.fighters[1].hp],
    });

    // Counter-attack check (Fight IQ)
    const counterChance = dStats.fightIQ / 200;
    if (Math.random() < counterChance && defender.dog.personality !== 'Coward') {
      // Schedule a quick counter-attack
      defender.attackCooldown = 2;
      state.events.push({
        tick: state.tick,
        type: 'counter',
        attacker: defenderIdx,
        defender: attackerIdx,
        damage: 0,
        text: `${defender.dog.name} counters!`,
        hp: [state.fighters[0].hp, state.fighters[1].hp],
      });
    }

    return;
  }

  // Hit! Calculate damage
  let damage = Math.max(3, Math.floor(aStats.biteForce * (0.6 + Math.random() * 0.5)));

  // Thickness reduces damage
  const reduction = dStats.thickness / 200; // Max 50% reduction
  damage = Math.max(2, Math.floor(damage * (1 - reduction)));

  // Critical hit chance (Fight IQ)
  const critChance = aStats.fightIQ / 300;
  let isCrit = false;
  if (Math.random() < critChance) {
    damage = Math.floor(damage * 1.8);
    isCrit = true;
  }

  // Berserker bonus damage
  if (attacker.dog.personality === 'Berserker') {
    damage = Math.floor(damage * 1.15);
  }

  // Apply damage
  defender.hp -= damage;
  defender.state = 'hit';
  defender.stateTimer = HIT_STUN_TICKS;

  // Knockback
  const knockDir = defender.x > attacker.x ? 1 : -1;
  defender.x += knockDir * (isCrit ? KNOCKBACK_DISTANCE * 1.5 : KNOCKBACK_DISTANCE * 0.5);
  defender.x = Math.max(ARENA_LEFT, Math.min(ARENA_RIGHT, defender.x));

  // Combo tracking
  attacker.comboCounter++;
  attacker.totalHitsLanded++;
  attacker.totalDamageDone += damage;
  if (damage > attacker.biggestHit) attacker.biggestHit = damage;

  // Build event text
  let eventType: CombatEventType = isCrit ? 'critical' : 'hit';
  let text = '';

  if (isCrit) {
    text = `CRITICAL! ${attacker.dog.name} crushes ${defender.dog.name} for ${damage} damage!`;
  } else if (attacker.comboCounter >= 3) {
    eventType = 'combo';
    attacker.totalCombos++;
    text = `${attacker.comboCounter}-HIT COMBO! ${attacker.dog.name} is relentless! (${damage} dmg)`;
  } else {
    text = `${attacker.dog.name} bites ${defender.dog.name} for ${damage} damage!`;
  }

  state.events.push({
    tick: state.tick,
    type: eventType,
    attacker: attackerIdx,
    defender: defenderIdx,
    damage,
    text,
    hp: [state.fighters[0].hp, state.fighters[1].hp],
    combo: attacker.comboCounter,
  });

  // Second wind check (Heart stat) — when below 20% HP
  if (defender.hp > 0 && defender.hp < defender.maxHP * 0.2) {
    const secondWindChance = dStats.heart / 500;
    if (Math.random() < secondWindChance) {
      const healing = Math.floor(defender.maxHP * 0.1);
      defender.hp = Math.min(defender.maxHP, defender.hp + healing);
      state.events.push({
        tick: state.tick,
        type: 'second_wind',
        attacker: defenderIdx,
        defender: attackerIdx,
        damage: -healing,
        text: `${defender.dog.name} gets a SECOND WIND! (+${healing} HP)`,
        hp: [state.fighters[0].hp, state.fighters[1].hp],
      });
    }
  }
}

// ── Get fight highlights (top events) ──

export function getFightHighlights(events: CombatEvent[], count = 5): CombatEvent[] {
  const scoredEvents = events
    .filter(e => ['critical', 'combo', 'second_wind', 'ko', 'counter'].includes(e.type))
    .sort((a, b) => {
      // Prioritize KOs, then crits, then combos
      const priority: Record<string, number> = { ko: 100, critical: 50, combo: 40, second_wind: 30, counter: 20 };
      const scoreA = (priority[a.type] || 0) + a.damage;
      const scoreB = (priority[b.type] || 0) + b.damage;
      return scoreB - scoreA;
    });

  return scoredEvents.slice(0, count);
}

// ── Get fight statistics ──

export interface FightStats {
  duration: number;
  totalTicks: number;
  fighters: [{
    name: string;
    hitsLanded: number;
    damageDone: number;
    dodges: number;
    combos: number;
    biggestHit: number;
    finalHP: number;
    maxHP: number;
  }, {
    name: string;
    hitsLanded: number;
    damageDone: number;
    dodges: number;
    combos: number;
    biggestHit: number;
    finalHP: number;
    maxHP: number;
  }];
}

export function getFightStats(state: CombatState): FightStats {
  return {
    duration: Math.floor(state.tick / TICKS_PER_SECOND),
    totalTicks: state.tick,
    fighters: [
      {
        name: state.fighters[0].dog.name,
        hitsLanded: state.fighters[0].totalHitsLanded,
        damageDone: state.fighters[0].totalDamageDone,
        dodges: state.fighters[0].totalDodges,
        combos: state.fighters[0].totalCombos,
        biggestHit: state.fighters[0].biggestHit,
        finalHP: Math.max(0, state.fighters[0].hp),
        maxHP: state.fighters[0].maxHP,
      },
      {
        name: state.fighters[1].dog.name,
        hitsLanded: state.fighters[1].totalHitsLanded,
        damageDone: state.fighters[1].totalDamageDone,
        dodges: state.fighters[1].totalDodges,
        combos: state.fighters[1].totalCombos,
        biggestHit: state.fighters[1].biggestHit,
        finalHP: Math.max(0, state.fighters[1].hp),
        maxHP: state.fighters[1].maxHP,
      },
    ],
  };
}

export { TICKS_PER_SECOND, ARENA_LEFT, ARENA_RIGHT };
