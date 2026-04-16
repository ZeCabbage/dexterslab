'use client';

import { useCharacterStore } from '../lib/store';
import styles from '../[id]/page.module.css';
import DungeonCard, { DungeonCardData, CardActionCost } from '../components/DungeonCard';
import { useSpells } from '../hooks/useSpells';
import { useState, useMemo } from 'react';
import { getSpellDamage, calculateIncomingDamage } from '../lib/compute-stats';
import { resolveModifiers, matchesCondition, CardMatchContext, getModifiedSpellDamage, resolveStagedModifierCost } from '../lib/resolve-modifiers';
import { SpellData, StagedModifier, Companion, CompanionAttack, ExternalEffect, ModifierEffect, EffectDuration } from '../lib/types';
import { getValidResourcePools } from '../lib/magic-system';
import { calculateAC } from '../lib/ac';
import ModifierBuilder from '../components/ModifierBuilder';

// ═══════════════════════════════════════════════════════════════
//  PHASE 5: PENDING EVENT — Interrupt Engine Types
// ═══════════════════════════════════════════════════════════════

interface PendingEvent {
  type: 'incoming_attack' | 'incoming_damage' | 'outgoing_roll';
  value: number;                // Attack roll total, or damage total
  damageType?: string;          // For incoming_damage: fire, cold, etc.
  isMagical?: boolean;          // For incoming_damage: magical source?
  reactionsUsed: string[];      // Track which reactions have been applied in this resolution
}

interface AvailableReaction {
  id: string;
  name: string;
  description: string;
  slotLevel?: number;           // If spell, the slot level needed
  resourceId?: string;          // Resource to deduct
  effectDescription: string;    // What happens mechanically
  execute: () => void;          // Apply the reaction
}

const DAMAGE_TYPES = ['acid','bludgeoning','cold','fire','force','lightning','necrotic','piercing','poison','psychic','radiant','slashing','thunder'];

const CONDITIONS = ['Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious'];

export default function CombatTab() {
  const { char, updateField, updateNestedField, shortRest, longRest, expendResource, restoreResource, addLog, activateOneShot, toggleCombatState, stageModifier, clearStagedModifier, addExternalEffect, removeExternalEffect } = useCharacterStore();
  const [showShortRest, setShowShortRest] = useState(false);
  const [showLongRest, setShowLongRest] = useState(false);
  const [showEffectModal, setShowEffectModal] = useState(false);
  const [effectModalTab, setEffectModalTab] = useState<'quick' | 'custom'>('quick');
  const [customEffectName, setCustomEffectName] = useState('');
  const [customEffectSource, setCustomEffectSource] = useState('');
  const [customEffectDuration, setCustomEffectDuration] = useState<EffectDuration>('1_minute');
  const [customEffectModifiers, setCustomEffectModifiers] = useState<ModifierEffect[]>([]);

  // ── Phase 5: Interrupt Engine State ──
  const [pendingEvent, setPendingEvent] = useState<PendingEvent | null>(null);
  const [incomingAttackInput, setIncomingAttackInput] = useState('');
  const [incomingDamageInput, setIncomingDamageInput] = useState('');
  const [incomingDamageType, setIncomingDamageType] = useState('slashing');
  const [incomingMagical, setIncomingMagical] = useState(false);
  
  const [spentHitDice, setSpentHitDice] = useState(0);
  const [hpRolled, setHpRolled] = useState(0);

  const [actionFilter, setActionFilter] = useState<'all' | 'action' | 'bonus_action' | 'reaction'>('all');

  // Turn Tracker
  const [turn, setTurn] = useState({ action: 1, bonus_action: 1, reaction: 1 });
  const [basicActionOpt, setBasicActionOpt] = useState('Dash (Move x2)');
  const [basicBonusOpt, setBasicBonusOpt] = useState('Two-Weapon Fighting');

  const useTurnResource = (type: CardActionCost) => {
    if (type === 'action' || type === 'bonus_action' || type === 'reaction') {
       if (turn[type] > 0) setTurn({ ...turn, [type]: turn[type] - 1 });
    }
  };

  const isPreparedCaster = ['cleric', 'druid', 'paladin', 'wizard'].includes(char?.class?.toLowerCase() || '');
  const combatSpells = isPreparedCaster ? (char?.preparedSpells || []) : (char?.knownSpells || []);
  
  // Map pure IDs to rich static metadata
  const combatSpellsData = useSpells(combatSpells, char?.customSpells);

  if (!char) return null;

  // Resolve all modifier effects from features
  const resolved = useMemo(() => resolveModifiers(char), [char]);
  const activeModifiers = char.activeModifiers || [];

  const calcMod = (score: number) => Math.floor(((score || 10) - 10) / 2);
  const strMod = calcMod(char.stats?.str);
  const dexMod = calcMod(char.stats?.dex);
  const conMod = calcMod(char.stats?.con);
  const profBonus = Math.ceil((char.level || 1) / 4) + 1;

  // Hit Die math for Short Rest
  const hitDieSize = typeof char.hitDie === 'string' ? parseInt(char.hitDie) || 8 : char.hitDie || 8;
  const hitDiceAvailable = (char.hitDiceTotal || 1) - (char.hitDiceUsed || 0);
  const avgHitDieRoll = Math.ceil(hitDieSize / 2) + 1;

  const handleRollHitDie = () => {
    if (spentHitDice >= hitDiceAvailable) return;
    const roll = Math.floor(Math.random() * hitDieSize) + 1;
    const totalGain = Math.max(1, roll + conMod); // Min 1 HP per die
    setSpentHitDice(prev => prev + 1);
    setHpRolled(prev => prev + totalGain);
  };

  const handleAvgHitDie = () => {
    if (spentHitDice >= hitDiceAvailable) return;
    const totalGain = Math.max(1, avgHitDieRoll + conMod);
    setSpentHitDice(prev => prev + 1);
    setHpRolled(prev => prev + totalGain);
  };

  // Short rest resources preview
  const shortRestResources = Object.entries(char.resources || {})
    .filter(([_, res]) => res.recharge === 'short' && res.used > 0)
    .map(([_, res]) => res.name);

  // Long rest resources preview
  const longRestResources = Object.entries(char.resources || {})
    .filter(([_, res]) => (res.recharge === 'short' || res.recharge === 'long') && res.used > 0)
    .map(([_, res]) => res.name);
  const longRestHpGain = char.maxHp - char.currentHp;
  const longRestDiceRecovery = Math.min(char.hitDiceUsed || 0, Math.max(1, Math.floor((char.hitDiceTotal || 1) / 2)));

  const handleShortRestConfirm = () => {
    shortRest(spentHitDice, hpRolled);
    setShowShortRest(false);
    setSpentHitDice(0);
    setHpRolled(0);
  };

  const handleLongRestConfirm = () => {
    longRest();
    setShowLongRest(false);
  };

  const handleRoll = (name: string, diceString: string, bonus: number, isAttack: boolean = false) => {
    const split = diceString.toLowerCase().split('d');
    const count = parseInt(split[0]) || 1;
    const sides = parseInt(split[1]) || 20;

    let rollSum = 0;
    const individualRolls: number[] = [];
    for (let i = 0; i < count; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      individualRolls.push(roll);
      rollSum += roll;
    }
    const total = rollSum + bonus;
    const sign = bonus >= 0 ? '+' : '';

    // ── Crit Range Detection (Phase 4a) ──
    // For attack rolls (1d20), check against resolved.critRange (default 20, Champion 19/18)
    if (isAttack && sides === 20 && count === 1) {
      const natRoll = individualRolls[0];
      const critMin = resolved.critRange || 20;

      if (natRoll === 1) {
        const desc = `💀 CRITICAL MISS! ${name}: Natural 1 ${sign}${bonus} = ${total}`;
        alert(desc);
        addLog('roll', desc);
        return;
      }
      if (natRoll >= critMin) {
        const desc = `⚔️ CRITICAL HIT! ${name}: Natural ${natRoll} ${sign}${bonus} = ${total}${critMin < 20 ? ` (Crit on ${critMin}+)` : ''}`;
        alert(desc);
        addLog('roll', desc);
        return;
      }
    }

    const rollType = isAttack ? 'Attack' : 'Damage';
    const desc = `Rolled ${name} ${rollType}: ${rollSum} (${diceString}) ${sign}${bonus} = ${total}`;
    alert(desc);
    addLog('roll', desc);
  };

  const getWeaponStats = (weapon: any) => {
    let isFinesse = weapon.properties?.includes('finesse');
    let isRanged = weapon.properties?.some((p: string) => p.includes('range') && !p.includes('thrown')) || ['Shortbow', 'Longbow', 'Light Crossbow'].some(n => weapon.name.includes(n));
    let baseMod = strMod;
    if (isRanged || (isFinesse && dexMod > strMod)) {
      baseMod = dexMod;
    }

    let isProficient = false;
    const profs = (char.weaponProficiencies || []).map(p => p.toLowerCase());
    if (weapon.weaponCategory === 'simple' && profs.some(p => p.includes('simple'))) isProficient = true;
    if (weapon.weaponCategory === 'martial' && profs.some(p => p.includes('martial'))) isProficient = true;
    if (profs.some(p => weapon.name.toLowerCase().includes(p))) isProficient = true;

    let atkBonus = baseMod + (isProficient ? profBonus : 0);
    return { atkBonus, dmgBonus: baseMod, isFinesse, isRanged, isProficient };
  };

  // Compile the Unified Dungeon Cards Hand
  const combatDeck: DungeonCardData[] = [];

  // 1. Map Spells
  combatSpellsData.forEach(spell => {
    if (actionFilter !== 'all' && (spell.actionCost || 'action') !== actionFilter) return;

    let resMax, resUsed;
    let expend: (() => void) | undefined;
    let restore: (() => void) | undefined;
    const slotId = spell.level > 0 ? `spell_slot_${spell.level}` : '';
    if (spell.level > 0 && char.resources) {
        if (char.resources[slotId]) {
            resMax = char.resources[slotId].max;
            resUsed = char.resources[slotId].used;
            expend = () => expendResource(slotId);
            restore = () => restoreResource(slotId);
        }
    }

    // Phase 3: Compute valid resource pools for this spell's slot cost
    const poolOptions = spell.level > 0
      ? getValidResourcePools(char, slotId, spell.level)
      : [];

    // Helper: execute cast with a specific pool
    const executeCast = (poolId?: string) => {
       // Phase 4c: Staged Modifier Cost Deduction
       if (char.stagedModifier) {
         const staged = char.stagedModifier;
         const spellLevel = spell.level;
         const actualCost = staged.cost === 'spell_level'
           ? Math.max(1, spellLevel)
           : (typeof staged.cost === 'number' ? staged.cost : 0);

         const resource = char.resources?.[staged.costResourceId];
         if (resource) {
           const remaining = resource.max - resource.used;
           if (remaining < actualCost) {
             alert(`❌ Not enough ${staged.costResourceId.replace(/_/g, ' ')}! Need ${actualCost}, have ${remaining}.`);
             return;
           }
           expendResource(staged.costResourceId);
           for (let i = 1; i < actualCost; i++) {
             expendResource(staged.costResourceId);
           }
           addLog('action', `${staged.name} applied to ${spell.name} (cost: ${actualCost} ${staged.costResourceId.replace(/_/g, ' ')})`);
         }
         clearStagedModifier();
       }

       useTurnResource(spell.actionCost as CardActionCost || 'action');

       // Expend the chosen pool
       if (poolId) {
         expendResource(poolId);
         const poolName = char.resources?.[poolId]?.name || poolId;
         addLog('spell', `Casted ${spell.name} (used ${poolName})`);
       } else if (expend) {
         expend();
         addLog('spell', `Casted ${spell.name}`);
       } else {
         addLog('spell', `Casted ${spell.name}`);
       }
       alert(`Casting ${spell.name}`);
    };

    combatDeck.push({
      id: spell.id,
      name: spell.name,
      type: 'spell',
      actionCost: (spell.actionCost as CardActionCost) || 'action',
      description: spell.description,
      primaryStat: spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`,
      damageString: getSpellDamage(char, spell),
      resourceMax: resMax,
      resourceUsed: resUsed,
      onExpend: expend,
      onRestore: restore,
      playLabel: char.stagedModifier ? `⚡ CAST (${char.stagedModifier.name})` : 'CAST',
      onPlay: () => {
        // If only one pool (or cantrip), execute directly
        if (poolOptions.length <= 1) {
          executeCast(poolOptions.length === 1 ? poolOptions[0].id : undefined);
        }
        // If multiple pools, the DungeonCard will show the picker
        // and call onPoolSelected instead
      },
      // Phase 3: Pass pool options to the card for multi-pool UI
      resourcePoolOptions: poolOptions.length > 1 ? poolOptions : undefined,
      onPoolSelected: poolOptions.length > 1 ? (poolId: string) => {
        executeCast(poolId);
      } : undefined,
      secondaryLabel: spell.damage ? 'ROLL DMG' : undefined,
      onSecondaryPlay: spell.damage ? () => {
         const computedDmg = getSpellDamage(char, spell);
         let bonus = 0;
         if (computedDmg.includes('+')) {
            bonus = parseInt(computedDmg.split('+')[1]) || 0;
         } else if (computedDmg.includes('-')) {
            bonus = -1 * (parseInt(computedDmg.split('-')[1]) || 0);
         }
         handleRoll(spell.name, computedDmg.split(' ')[0], bonus, false);
      } : undefined
    });
  });

  // 2. Map Features (Resources)
  Object.entries(char.resources || {}).forEach(([id, res]) => {
    // Skip internal spell slots
    if (id.startsWith('spell_slot_')) return;
    if (actionFilter !== 'all' && (res.actionCost || 'action') !== actionFilter) return;

    const isUnlimited = res.max >= 99 || res.recharge === 'none';
    combatDeck.push({
      id,
      name: res.name,
      type: 'feature',
      actionCost: (res.actionCost as CardActionCost) || 'action',
      description: res.description || undefined,
      primaryStat: res.die ? `Feature (${res.die})` : 'Feature',
      resourceMax: isUnlimited ? undefined : res.max,
      resourceUsed: isUnlimited ? undefined : res.used,
      onExpend: isUnlimited ? undefined : () => expendResource(id),
      onRestore: isUnlimited ? undefined : () => restoreResource(id),
      playLabel: 'USE',
      onPlay: () => {
         useTurnResource(res.actionCost as CardActionCost || 'action');
         if (!isUnlimited) expendResource(id);
         addLog('feature', `Used ${res.name}`);
      }
    });
  });

  // 3. Map Equipped Weapons
  // Collect spell slot resources for post-hit smite UI
  const spellSlotResources: Record<string, any> = {};
  Object.entries(char.resources || {}).forEach(([id, res]) => {
    if (id.startsWith('spell_slot_')) spellSlotResources[id] = res;
  });

  ['mainHand', 'offHand'].forEach((slotName) => {
    const cost = slotName === 'mainHand' ? 'action' : 'bonus_action';
    if (actionFilter !== 'all' && cost !== actionFilter) return;
    const w = (char.equipped as any)?.[slotName];
    if (w && w.type === 'weapon') {
      const { atkBonus, dmgBonus, isProficient } = getWeaponStats(w);
      combatDeck.push({
        id: `w_${slotName}`,
        name: w.name,
        type: 'weapon',
        actionCost: cost,
        description: (w.description || w.properties?.join(', ')) + (!isProficient ? ' (⚠ Not Proficient: No Attack Bonus)' : ''),
        primaryStat: 'Weapon' + (!isProficient ? ' ⚠' : ''),
        damageString: `${w.damage || '1d4'} ${dmgBonus >= 0 ? '+' : ''}${dmgBonus}`,
        playLabel: `ROLL ATK (${atkBonus >= 0 ? '+' : ''}${atkBonus})`,
        onPlay: () => {
          useTurnResource(cost);
          handleRoll(w.name, '1d20', atkBonus, true);
        },
        secondaryLabel: 'ROLL DMG',
        onSecondaryPlay: () => handleRoll(w.name, w.damage || '1d4', dmgBonus, false),
        // ── Post-Hit Modifiers (Divine Smite pattern) ──
        postHitModifiers: resolved.postHitModifiers.length > 0 ? resolved.postHitModifiers : undefined,
        spellSlotResources: resolved.postHitModifiers.length > 0 ? spellSlotResources : undefined,
        onSmite: resolved.postHitModifiers.length > 0 ? (modName: string, slotLevel: number, totalDice: string, damageType: string) => {
          const slotId = `spell_slot_${slotLevel}`;
          expendResource(slotId);
          // Roll the smite damage
          const diceParts = totalDice.toLowerCase().split('d');
          const diceCount = parseInt(diceParts[0]) || 2;
          const diceSides = parseInt(diceParts[1]) || 8;
          let smiteTotal = 0;
          for (let i = 0; i < diceCount; i++) {
            smiteTotal += Math.floor(Math.random() * diceSides) + 1;
          }
          const ordinal = slotLevel === 1 ? '1st' : slotLevel === 2 ? '2nd' : slotLevel === 3 ? '3rd' : `${slotLevel}th`;
          const desc = `✦ ${modName} (${ordinal} Level Slot): ${smiteTotal} (${totalDice}) ${damageType} damage!`;
          alert(desc);
          addLog('roll', desc);
        } : undefined,
      });
    }
  });

  // 4. Map Manual Attacks
  (char.attacks || []).forEach(atk => {
     if (actionFilter !== 'all' && (atk.actionCost || 'action') !== actionFilter) return;
     let atkBonusInt = parseInt((atk.bonus || '0').replace('+', '')) || 0;
     combatDeck.push({
       id: atk.id,
       name: atk.name,
       type: 'weapon',
       actionCost: (atk.actionCost as CardActionCost) || 'action',
       primaryStat: atk.type,
       damageString: atk.damage || '1d4',
       playLabel: `ROLL ATK (${atk.bonus})`,
       onPlay: () => {
         useTurnResource(atk.actionCost as CardActionCost || 'action');
         handleRoll(atk.name, '1d20', atkBonusInt, true);
       },
       secondaryLabel: 'ROLL DMG',
       onSecondaryPlay: () => handleRoll(atk.name, atk.damage || '1d4', 0, false)
     });
  });

  // ── 4.5 UNIVERSAL UNARMED STRIKE ──
  // PHB p.195: "Instead of using a weapon to make a melee weapon attack,
  // you can use an unarmed strike: a punch, kick, head-butt, or similar
  // forceful blow. On a hit, an unarmed strike deals bludgeoning damage
  // equal to 1 + your Strength modifier."
  //
  // Override logic:
  //   - If modify_unarmed_strike modifiers exist (Monk Martial Arts,
  //     Tavern Brawler), use the highest damage die provided.
  //   - If useDexterity is true on ANY override, use Math.max(STR, DEX)
  //     for attack and damage (Monk finesse-like behavior).
  if (actionFilter === 'all' || actionFilter === 'action') {
    let unarmedDie = '';          // Empty = flat "1" damage (base PHB unarmed)
    let unarmedUseDex = false;
    let unarmedSource = 'Base';

    // Walk resolved unarmed strike overrides and pick the best
    if (resolved.unarmedStrikeOverrides.length > 0) {
      // Parse die sizes to find the highest (e.g., "1d6" > "1d4")
      let bestDieSize = 0;
      for (const override of resolved.unarmedStrikeOverrides) {
        const dieSize = parseInt(override.damageDie.split('d')[1]) || 0;
        if (dieSize > bestDieSize) {
          bestDieSize = dieSize;
          unarmedDie = override.damageDie;
          unarmedSource = override.source;
        }
        if (override.useDexterity) unarmedUseDex = true;
      }
    }

    const unarmedAbilityMod = unarmedUseDex ? Math.max(strMod, dexMod) : strMod;
    const unarmedAtkBonus = unarmedAbilityMod + profBonus;
    const unarmedDmgString = unarmedDie
      ? `${unarmedDie} ${unarmedAbilityMod >= 0 ? '+' : ''}${unarmedAbilityMod}`
      : `1 ${unarmedAbilityMod >= 0 ? '+' : ''}${unarmedAbilityMod}`;

    combatDeck.push({
      id: 'unarmed_strike',
      name: 'Unarmed Strike',
      type: 'weapon',
      actionCost: 'action',
      description: unarmedDie
        ? `${unarmedSource} · ${unarmedUseDex ? 'Uses STR or DEX (whichever is higher)' : 'Uses STR'} · Bludgeoning`
        : 'A punch, kick, or head-butt. Uses STR for attack and damage. Bludgeoning.',
      primaryStat: unarmedDie ? `Martial (${unarmedDie})` : 'Weapon',
      damageString: unarmedDmgString,
      playLabel: `ROLL ATK (${unarmedAtkBonus >= 0 ? '+' : ''}${unarmedAtkBonus})`,
      onPlay: () => {
        useTurnResource('action');
        handleRoll('Unarmed Strike', '1d20', unarmedAtkBonus, true);
      },
      secondaryLabel: 'ROLL DMG',
      onSecondaryPlay: () => {
        if (unarmedDie) {
          handleRoll('Unarmed Strike', unarmedDie, unarmedAbilityMod, false);
        } else {
          // Base unarmed: flat 1 + STR mod (no dice roll)
          const total = 1 + unarmedAbilityMod;
          const desc = `Unarmed Strike Damage: 1 + ${unarmedAbilityMod} = ${total} bludgeoning`;
          alert(desc);
          addLog('roll', desc);
        }
      },
      // Post-hit smite support for unarmed (Paladins can smite on unarmed strikes)
      postHitModifiers: resolved.postHitModifiers.length > 0 ? resolved.postHitModifiers : undefined,
      spellSlotResources: resolved.postHitModifiers.length > 0 ? spellSlotResources : undefined,
      onSmite: resolved.postHitModifiers.length > 0 ? (modName: string, slotLevel: number, totalDice: string, damageType: string) => {
        const slotId = `spell_slot_${slotLevel}`;
        expendResource(slotId);
        const diceParts = totalDice.toLowerCase().split('d');
        const diceCount = parseInt(diceParts[0]) || 2;
        const diceSides = parseInt(diceParts[1]) || 8;
        let smiteTotal = 0;
        for (let i = 0; i < diceCount; i++) {
          smiteTotal += Math.floor(Math.random() * diceSides) + 1;
        }
        const ordinal = slotLevel === 1 ? '1st' : slotLevel === 2 ? '2nd' : slotLevel === 3 ? '3rd' : `${slotLevel}th`;
        alert(`✦ ${modName} (${ordinal} Level Slot): ${smiteTotal} (${totalDice}) ${damageType} damage!`);
        addLog('roll', `✦ ${modName} on Unarmed Strike: ${smiteTotal} ${damageType}`);
      } : undefined,
    });
  }

  // ── 4.6 NATURAL WEAPONS ──
  // Convert resolved.naturalWeapons into standard weapon cards.
  // These come from racial traits (Tabaxi Claws, Minotaur Horns,
  // Lizardfolk Bite), Wild Shape enhancements, or homebrew features.
  for (const nw of resolved.naturalWeapons) {
    if (actionFilter !== 'all' && actionFilter !== 'action') continue;

    const nwUseDex = nw.useDexterity ?? false;
    const nwAbilityMod = nwUseDex ? Math.max(strMod, dexMod) : strMod;
    const nwAtkBonus = nwAbilityMod + profBonus;
    const nwDmgString = `${nw.damageDie} ${nwAbilityMod >= 0 ? '+' : ''}${nwAbilityMod}`;

    combatDeck.push({
      id: `natural_${nw.name.toLowerCase().replace(/\s+/g, '_')}`,
      name: nw.name,
      type: 'weapon',
      actionCost: 'action',
      description: `${nw.source} · ${nw.damageType} · ${nwUseDex ? 'Finesse (STR or DEX)' : 'STR'}${nw.properties?.length ? ' · ' + nw.properties.join(', ') : ''}`,
      primaryStat: 'Natural Weapon',
      damageString: nwDmgString,
      playLabel: `ROLL ATK (${nwAtkBonus >= 0 ? '+' : ''}${nwAtkBonus})`,
      onPlay: () => {
        useTurnResource('action');
        handleRoll(nw.name, '1d20', nwAtkBonus, true);
      },
      secondaryLabel: 'ROLL DMG',
      onSecondaryPlay: () => handleRoll(nw.name, nw.damageDie, nwAbilityMod, false),
    });
  }

  // 5. Map Companion Attacks (Phase 4b)
  (char.companions || []).forEach((companion: Companion) => {
    if (!companion.isActive) return;
    companion.attacks.forEach((atk: CompanionAttack, atkIdx: number) => {
      if (actionFilter !== 'all' && (atk.actionCost || 'action') !== actionFilter) return;
      let atkBonusNum = 0;
      const bonusStr = atk.bonus || '+0';
      if (bonusStr.includes('prof')) {
        atkBonusNum = profBonus;
        if (bonusStr.includes('wis')) atkBonusNum += Math.floor(((companion.stats?.wis || 10) - 10) / 2);
        else if (bonusStr.includes('str')) atkBonusNum += Math.floor(((companion.stats?.str || 10) - 10) / 2);
        else if (bonusStr.includes('dex')) atkBonusNum += Math.floor(((companion.stats?.dex || 10) - 10) / 2);
      } else {
        atkBonusNum = parseInt(bonusStr.replace('+', '')) || 0;
      }
      combatDeck.push({
        id: `companion_${companion.id}_${atkIdx}`,
        name: `${companion.name}: ${atk.name}`,
        type: 'weapon',
        actionCost: (atk.actionCost as CardActionCost) || 'action',
        description: `${companion.type.charAt(0).toUpperCase() + companion.type.slice(1)} companion · ${atk.range || '5 ft.'}${atk.description ? ' · ' + atk.description : ''}`,
        primaryStat: `${companion.name} (AC ${companion.ac}, HP ${companion.currentHp}/${companion.maxHp})`,
        damageString: `${atk.damage} ${atk.damageType}`,
        playLabel: `ROLL ATK (${atkBonusNum >= 0 ? '+' : ''}${atkBonusNum})`,
        onPlay: () => {
          useTurnResource(atk.actionCost as CardActionCost || 'action');
          handleRoll(`${companion.name}: ${atk.name}`, '1d20', atkBonusNum, true);
        },
        secondaryLabel: 'ROLL DMG',
        onSecondaryPlay: () => {
          const dmgParts = atk.damage.split('+').map(s => s.trim());
          handleRoll(`${companion.name}: ${atk.name}`, dmgParts[0], dmgParts.length > 1 ? (parseInt(dmgParts[1]) || 0) : 0, false);
        }
      });
    });
    companion.features.forEach((feat, featIdx) => {
      if (!feat.actionCost) return;
      if (actionFilter !== 'all' && feat.actionCost !== actionFilter) return;
      combatDeck.push({
        id: `companion_feat_${companion.id}_${featIdx}`,
        name: `${companion.name}: ${feat.name}`,
        type: 'feature',
        actionCost: (feat.actionCost as CardActionCost) || 'action',
        description: feat.description,
        primaryStat: `${companion.name} Feature`,
        resourceMax: feat.usesPerRest,
        resourceUsed: feat.usesPerRest ? (feat.usesPerRest - (feat.usesRemaining ?? feat.usesPerRest)) : undefined,
        playLabel: 'USE',
        onPlay: () => {
          useTurnResource(feat.actionCost as CardActionCost || 'action');
          addLog('feature', `${companion.name} used ${feat.name}`);
        }
      });
    });
  });

  // 6. Build Generic Native Actions
  if (actionFilter === 'all' || actionFilter === 'action') {
    combatDeck.push({
      id: 'basic_action',
      name: 'Standard Action',
      type: 'feature',
      actionCost: 'action',
      primaryStat: 'Core',
      options: ['Dash (Move x2)', 'Disengage (Safe Escape)', 'Dodge (Disadvantage to attackers)', 'Help (+Advantage)', 'Hide (Stealth Check)'],
      selectedOption: basicActionOpt,
      onOptionChange: setBasicActionOpt,
      playLabel: 'EXECUTE',
      onPlay: () => {
        useTurnResource('action');
        addLog('feature', `Performed ${basicActionOpt}`);
      }
    });
  }

  if (actionFilter === 'all' || actionFilter === 'bonus_action') {
    combatDeck.push({
      id: 'basic_bonus',
      name: 'Standard Bonus',
      type: 'feature',
      actionCost: 'bonus_action',
      primaryStat: 'Core',
      options: ['Two-Weapon Fighting (Off-hand)', 'Cunning Action (Rogue)', 'Drink Potion'],
      selectedOption: basicBonusOpt,
      onOptionChange: setBasicBonusOpt,
      playLabel: 'EXECUTE',
      onPlay: () => {
        useTurnResource('bonus_action');
        addLog('feature', `Performed ${basicBonusOpt}`);
      }
    });
  }

  // Sort deck: Actions -> Bonus Actions -> Reactions
  const costOrder = { action: 1, bonus_action: 2, reaction: 3, special: 4, none: 5 };
  combatDeck.sort((a, b) => costOrder[a.actionCost] - costOrder[b.actionCost]);

  // ═══════════════════════════════════════════════════════
  // INTERCEPTOR PIPELINE (Phase 4)
  // Walk the resolved modifiers and mutate each card's
  // damageString to inject subclass/toggle bonuses.
  // ═══════════════════════════════════════════════════════
  const interceptCard = (card: DungeonCardData, spellData?: SpellData): DungeonCardData => {
    if (!card.damageString) return card;

    const ctx: CardMatchContext = {
      cardType: card.type === 'spell' ? 'spell' : card.type === 'weapon' ? 'weapon' : 'feature',
      spellLevel: spellData?.level,
      spellSchool: spellData?.school,
      spellName: spellData?.name,
      damageType: spellData?.damageType,
      isRanged: card.description?.toLowerCase().includes('range') || false,
      activeToggleIds: resolved.activeToggleIds,
    };

    let bonusFlat = 0;
    const bonusDice: string[] = [];
    const bonusTags: string[] = [];

    // 1. Named-target bonusDamage (exact spell/weapon name match)
    const namedBonuses = resolved.bonusDamage[card.name.toLowerCase()] || [];
    for (const b of namedBonuses) {
      if (b.targetCondition && !matchesCondition(b.targetCondition, ctx)) continue;
      bonusFlat += b.flat;
      if (b.dice) bonusDice.push(b.dice);
    }

    // 2. Category-target bonusDamage (__spell__, __melee__, __all__)
    const categories = ['__all__'];
    if (card.type === 'spell') categories.push('__spell__');
    if (card.type === 'weapon') categories.push('__melee__', '__weapon__');
    for (const cat of categories) {
      for (const b of (resolved.bonusDamage[cat] || [])) {
        if (b.targetCondition && !matchesCondition(b.targetCondition, ctx)) continue;
        bonusFlat += b.flat;
        if (b.dice) bonusDice.push(b.dice);
      }
    }

    // 3. Conditional damage entries (structured matching)
    for (const cd of resolved.conditionalDamage) {
      // Check broad target match
      if (cd.target === 'melee' && card.type !== 'weapon') continue;
      if (cd.target === 'spell' && card.type !== 'spell') continue;
      // Check structured condition
      if (cd.targetCondition && !matchesCondition(cd.targetCondition, ctx)) continue;
      bonusDice.push(`${cd.dice} ${cd.damageType}`);
      if (cd.condition) bonusTags.push(cd.condition);
    }

    // 4. Staged modifier bonus (if one is staged and matches this card)
    if (char.stagedModifier) {
      const staged = char.stagedModifier;
      if (!staged.targetCondition || matchesCondition(staged.targetCondition, ctx)) {
        if (staged.bonusDice) bonusDice.push(staged.bonusDice);
        bonusTags.push(`⚡ ${staged.name}`);
      }
    }

    // Build final damage string
    if (bonusFlat === 0 && bonusDice.length === 0) return card;

    let newDmg = card.damageString;
    if (bonusDice.length > 0) newDmg += ` + ${bonusDice.join(' + ')}`;
    if (bonusFlat > 0) newDmg += ` + ${bonusFlat}`;
    else if (bonusFlat < 0) newDmg += ` - ${Math.abs(bonusFlat)}`;

    const newDesc = bonusTags.length > 0
      ? `${card.description || ''}\n\n✦ ${bonusTags.join(' | ')}`
      : card.description;

    return { ...card, damageString: newDmg, description: newDesc };
  };

  // Build a spell lookup for the interceptor
  const spellLookup = useMemo(() => {
    const map: Record<string, SpellData> = {};
    combatSpellsData.forEach(s => { map[s.id] = s as SpellData; });
    return map;
  }, [combatSpellsData]);

  // Apply interceptor to every card
  const interceptedDeck = combatDeck.map(card => {
    const spellData = card.type === 'spell' ? spellLookup[card.id] : undefined;
    return interceptCard(card, spellData);
  });



  const addResource = () => {
    const defaultRes = { name: 'Action Surge', max: 1, used: 0, recharge: 'short' as const };
    updateField('resources', { ...char.resources, [`res_${Date.now()}`]: defaultRes });
  };

  return (
    <div className={styles.combatTab}>
      <h2 className={styles.tabTitle}>Combat UI</h2>

      {/* Active Modifier Toggles (Metamagic / Maneuver one-shots) */}
      {activeModifiers.length > 0 && (
        <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(185, 153, 170, 0.08)', border: '1px solid #333', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#b9a', fontFamily: 'Cinzel, serif', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            ⚡ Active Modifiers (One-Shot Per Rest)
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {activeModifiers.map(mod => (
              <button
                key={mod.modifierId}
                onClick={() => {
                  if (!mod.isSpent) {
                    activateOneShot(mod.modifierId, mod.name, mod.recharge);
                    addLog('action', `Activated ${mod.name}`);
                  }
                }}
                disabled={mod.isSpent}
                style={{
                  padding: '8px 14px', borderRadius: '6px', cursor: mod.isSpent ? 'not-allowed' : 'pointer',
                  background: mod.isSpent ? '#1a1a1a' : 'rgba(185, 153, 170, 0.2)',
                  border: `1px solid ${mod.isSpent ? '#333' : '#b9a'}`,
                  color: mod.isSpent ? '#555' : '#ddd', fontSize: '12px', fontFamily: 'Cinzel, serif',
                  textDecoration: mod.isSpent ? 'line-through' : 'none',
                  opacity: mod.isSpent ? 0.5 : 1, transition: 'all 0.2s'
                }}
              >
                {mod.isSpent ? '✗ ' : '⚡ '}{mod.name}
                <span style={{ fontSize: '10px', marginLeft: '6px', color: '#888' }}>({mod.recharge} rest)</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ ACTIVE COMBAT TOGGLES (Rage, Bladesong, Symbiotic Entity, etc.) ═══ */}
      {(char.activeCombatToggles || []).length > 0 && (
        <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(200, 120, 60, 0.06)', border: '1px solid #533', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#e94', fontFamily: 'Cinzel, serif', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            🔥 Combat State Toggles
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {(char.activeCombatToggles || []).map(toggle => {
              const resource = char.resources?.[toggle.resourceId];
              const remaining = resource ? resource.max - resource.used : 0;
              const canActivate = !toggle.isActive && remaining > 0;

              return (
                <button
                  key={toggle.id}
                  onClick={() => {
                    if (toggle.isActive || canActivate) {
                      toggleCombatState(toggle.id);
                      addLog('action', toggle.isActive ? `Deactivated ${toggle.name}` : `Activated ${toggle.name}`);
                    }
                  }}
                  disabled={!toggle.isActive && !canActivate}
                  style={{
                    padding: '10px 16px', borderRadius: '8px', cursor: (!toggle.isActive && !canActivate) ? 'not-allowed' : 'pointer',
                    background: toggle.isActive
                      ? 'linear-gradient(135deg, rgba(233, 150, 68, 0.3), rgba(200, 80, 30, 0.2))'
                      : 'rgba(40, 30, 20, 0.5)',
                    border: `2px solid ${toggle.isActive ? '#e94' : '#444'}`,
                    color: toggle.isActive ? '#ffcc88' : '#888',
                    fontSize: '13px', fontFamily: 'Cinzel, serif', fontWeight: 'bold',
                    boxShadow: toggle.isActive ? '0 0 12px rgba(233, 150, 68, 0.3), inset 0 0 8px rgba(233, 150, 68, 0.1)' : 'none',
                    transition: 'all 0.3s ease',
                    opacity: (!toggle.isActive && !canActivate) ? 0.4 : 1,
                  }}
                >
                  {toggle.isActive ? '🔥 ' : '○ '}{toggle.name}
                  <span style={{ fontSize: '10px', marginLeft: '8px', color: toggle.isActive ? '#ffaa66' : '#666' }}>
                    {toggle.isActive ? 'ACTIVE' : `${remaining} left`}
                  </span>
                  {toggle.duration && (
                    <span style={{ fontSize: '9px', display: 'block', color: '#777', marginTop: '2px' }}>{toggle.duration}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ STAGED MODIFIER BANNER ═══ */}
      {char.stagedModifier && (
        <div style={{
          marginBottom: '16px', padding: '12px 16px',
          background: 'linear-gradient(90deg, rgba(100, 60, 200, 0.15), rgba(60, 30, 120, 0.08))',
          border: '1px solid #86e', borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <span style={{ color: '#c9f', fontFamily: 'Cinzel, serif', fontSize: '13px', fontWeight: 'bold' }}>
              ⚡ STAGED: {char.stagedModifier.name}
            </span>
            <span style={{ color: '#a8d', fontSize: '11px', marginLeft: '12px' }}>
              {char.stagedModifier.effect}
            </span>
            <span style={{ color: '#888', fontSize: '10px', marginLeft: '8px' }}>
              (Cost: {char.stagedModifier.cost === 'spell_level' ? 'spell level' : char.stagedModifier.cost} {char.stagedModifier.costResourceId.replace('_', ' ')})
            </span>
          </div>
          <button
            onClick={() => { clearStagedModifier(); addLog('action', `Cancelled staged ${char.stagedModifier?.name}`); }}
            style={{
              padding: '4px 10px', background: 'rgba(200, 60, 60, 0.2)', border: '1px solid #a44',
              color: '#f88', borderRadius: '4px', cursor: 'pointer', fontSize: '11px',
            }}
          >
            ✕ Cancel
          </button>
        </div>
      )}

      {/* Resolved Immunities / Resistances */}
      {(resolved.grantedResistances.length > 0 || resolved.grantedImmunities.length > 0) && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {resolved.grantedResistances.length > 0 && (
            <div style={{ padding: '6px 12px', background: 'rgba(100,150,200,0.1)', border: '1px solid #456', borderRadius: '4px', fontSize: '11px', color: '#8bd' }}>
              <strong>Resistances:</strong> {resolved.grantedResistances.join(', ')}
            </div>
          )}
          {resolved.grantedImmunities.length > 0 && (
            <div style={{ padding: '6px 12px', background: 'rgba(200,200,100,0.1)', border: '1px solid #664', borderRadius: '4px', fontSize: '11px', color: '#dd8' }}>
              <strong>Immunities:</strong> {resolved.grantedImmunities.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Rests & Time Engine */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button 
            onClick={() => setShowShortRest(true)}
            style={{ padding: '8px 16px', background: '#332211', border: '1px solid #cfaa5e', color: '#cfaa5e', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Cinzel, serif', fontSize: '14px' }}
          >
            Campfire
          </button>
          <button 
            onClick={() => setShowLongRest(true)}
            style={{ padding: '8px 16px', background: '#112233', border: '1px solid #55aacc', color: '#55aacc', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Cinzel, serif', fontSize: '14px' }}
          >
            Slumber
          </button>
        </div>
        <button onClick={addResource} style={{ background: 'transparent', color: '#cfaa5e', border: '1px dotted #cfaa5e', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>+ Manual Feature</button>
      </div>

      {/* ═══ PHASE 5: DM INTERFACE — Incoming Events ═══ */}
      <div style={{ 
        background: '#111', padding: '16px', borderRadius: '8px', 
        border: '1px solid #f97316', marginBottom: '24px',
      }}>
        <h3 className={styles.sectionHeading} style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#f97316' }}>
          🎯 DM Interface — Incoming Events
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '12px' }}>
          {/* Incoming Attack Roll */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', background: 'rgba(249, 115, 22, 0.06)', border: '1px solid #f9731644', borderRadius: '6px' }}>
            <label style={{ fontSize: '10px', color: '#f97316', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Incoming Attack Roll</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="number"
                placeholder="e.g. 16"
                value={incomingAttackInput}
                onChange={e => setIncomingAttackInput(e.target.value)}
                style={{ flex: 1, padding: '8px', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '4px', fontSize: '14px', fontFamily: 'Cinzel, serif' }}
              />
              <button
                onClick={() => {
                  const val = parseInt(incomingAttackInput);
                  if (isNaN(val)) return;
                  setPendingEvent({ type: 'incoming_attack', value: val, reactionsUsed: [] });
                  setIncomingAttackInput('');
                }}
                disabled={!incomingAttackInput}
                style={{
                  padding: '8px 16px', fontWeight: 'bold', fontSize: '12px',
                  background: incomingAttackInput ? 'linear-gradient(135deg, #f97316, #ea580c)' : '#1a1a1a',
                  color: incomingAttackInput ? '#fff' : '#555',
                  border: 'none', borderRadius: '4px', cursor: incomingAttackInput ? 'pointer' : 'not-allowed',
                }}
              >⚔️ Roll</button>
            </div>
          </div>

          {/* Incoming Damage */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', background: 'rgba(239, 68, 68, 0.06)', border: '1px solid #ef444444', borderRadius: '6px' }}>
            <label style={{ fontSize: '10px', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Incoming Damage</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="number"
                placeholder="e.g. 12"
                value={incomingDamageInput}
                onChange={e => setIncomingDamageInput(e.target.value)}
                style={{ width: '70px', padding: '8px', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '4px', fontSize: '14px', fontFamily: 'Cinzel, serif' }}
              />
              <select
                value={incomingDamageType}
                onChange={e => setIncomingDamageType(e.target.value)}
                style={{ flex: 1, padding: '8px', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '4px', fontSize: '12px' }}
              >
                {DAMAGE_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#888', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={incomingMagical} onChange={e => setIncomingMagical(e.target.checked)} />
                Magic
              </label>
              <button
                onClick={() => {
                  const val = parseInt(incomingDamageInput);
                  if (isNaN(val) || val <= 0) return;
                  setPendingEvent({ type: 'incoming_damage', value: val, damageType: incomingDamageType, isMagical: incomingMagical, reactionsUsed: [] });
                  setIncomingDamageInput('');
                }}
                disabled={!incomingDamageInput}
                style={{
                  padding: '8px 16px', fontWeight: 'bold', fontSize: '12px',
                  background: incomingDamageInput ? 'linear-gradient(135deg, #ef4444, #dc2626)' : '#1a1a1a',
                  color: incomingDamageInput ? '#fff' : '#555',
                  border: 'none', borderRadius: '4px', cursor: incomingDamageInput ? 'pointer' : 'not-allowed',
                }}
              >💥 Take</button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ PHASE 5: RESOLUTION STAGING MODAL ═══ */}
      {pendingEvent && (() => {
        // Recalculate AC live (picks up any reactions already applied)
        const currentAC = calculateAC(char, resolved);
        const isHit = pendingEvent.type === 'incoming_attack' ? pendingEvent.value >= currentAC : null;

        // \u2500\u2500 Reaction Scanner \u2500\u2500
        // Scan known/prepared spells and features for valid reactions
        const availableReactions: AvailableReaction[] = [];
        const spellIds = new Set([...(char.knownSpells || []), ...(char.preparedSpells || [])]);

        // Check available spell slots
        const hasSlotAvailable = (minLevel: number): string | null => {
          for (let lvl = minLevel; lvl <= 9; lvl++) {
            const slot = char.resources?.[`spell_slot_${lvl}`];
            if (slot && slot.used < slot.max) return `spell_slot_${lvl}`;
          }
          // Also check pact magic
          const pact = char.resources?.['pact_magic'];
          if (pact && pact.used < pact.max) {
            const pactMatch = pact.name.match(/Lv\.(\d+)/);
            const pactLevel = pactMatch ? parseInt(pactMatch[1]) : 1;
            if (pactLevel >= minLevel) return 'pact_magic';
          }
          return null;
        };

        // Shield: +5 AC until start of next turn (reaction to incoming attack)
        if (pendingEvent.type === 'incoming_attack' && !pendingEvent.reactionsUsed.includes('shield')) {
          const hasShield = spellIds.has('shield') || combatSpellsData.some(s => s.name.toLowerCase() === 'shield');
          const slotId = hasShield ? hasSlotAvailable(1) : null;
          if (hasShield && slotId && turn.reaction > 0) {
            availableReactions.push({
              id: 'shield',
              name: '🛡️ Shield',
              description: 'Reaction spell: +5 AC until start of your next turn',
              slotLevel: 1,
              resourceId: slotId,
              effectDescription: `AC: ${currentAC} → ${currentAC + 5}`,
              execute: () => {
                expendResource(slotId);
                addExternalEffect({
                  id: `eff_shield_${Date.now()}`, name: 'Shield (Reaction)', source: 'Self',
                  duration: '1_round', description: '+5 AC until start of your next turn',
                  modifiers: [{ type: 'modify_ac', bonus: 5 }],
                });
                setTurn(prev => ({ ...prev, reaction: prev.reaction - 1 }));
                setPendingEvent(prev => prev ? { ...prev, reactionsUsed: [...prev.reactionsUsed, 'shield'] } : null);
                addLog('action', `⚡ REACTION: Cast Shield (+5 AC, used ${slotId.replace(/_/g, ' ')})`);
              },
            });
          }
        }

        // Absorb Elements: resistance to triggering damage type, +1d6 on next melee
        if (pendingEvent.type === 'incoming_damage' && !pendingEvent.reactionsUsed.includes('absorb_elements')) {
          const triggerDamageType = pendingEvent.damageType || '';
          const elementalTypes = ['acid', 'cold', 'fire', 'lightning', 'thunder'];
          if (elementalTypes.includes(triggerDamageType.toLowerCase())) {
            const hasAbsorb = spellIds.has('absorb_elements') || spellIds.has('absorb-elements') || combatSpellsData.some(s => s.name.toLowerCase().includes('absorb element'));
            const slotId = hasAbsorb ? hasSlotAvailable(1) : null;
            if (hasAbsorb && slotId && turn.reaction > 0) {
              availableReactions.push({
                id: 'absorb_elements',
                name: `🌀 Absorb Elements (${triggerDamageType})`,
                description: `Reaction: Gain resistance to ${triggerDamageType}, +1d6 ${triggerDamageType} on next melee hit`,
                slotLevel: 1,
                resourceId: slotId,
                effectDescription: `Halves ${triggerDamageType} damage this hit`,
                execute: () => {
                  expendResource(slotId);
                  addExternalEffect({
                    id: `eff_absorb_${Date.now()}`, name: `Absorb Elements (${triggerDamageType})`, source: 'Self',
                    duration: '1_round', description: `Resistance to ${triggerDamageType}, +1d6 ${triggerDamageType} on next melee`,
                    modifiers: [
                      { type: 'grant_resistance', damageType: triggerDamageType },
                    ],
                  });
                  setTurn(prev => ({ ...prev, reaction: prev.reaction - 1 }));
                  setPendingEvent(prev => prev ? { ...prev, reactionsUsed: [...prev.reactionsUsed, 'absorb_elements'] } : null);
                  addLog('action', `⚡ REACTION: Absorb Elements (${triggerDamageType} resistance, used ${slotId.replace(/_/g, ' ')})`);
                },
              });
            }
          }
        }

        // Silvery Barbs: reaction to incoming attack (force reroll)
        if (pendingEvent.type === 'incoming_attack' && !pendingEvent.reactionsUsed.includes('silvery_barbs')) {
          const hasSilvery = spellIds.has('silvery_barbs') || spellIds.has('silvery-barbs') || combatSpellsData.some(s => s.name.toLowerCase().includes('silvery barb'));
          const slotId = hasSilvery ? hasSlotAvailable(1) : null;
          if (hasSilvery && slotId && turn.reaction > 0) {
            availableReactions.push({
              id: 'silvery_barbs',
              name: '✨ Silvery Barbs',
              description: 'Reaction: Force attacker to reroll, grant advantage to an ally',
              slotLevel: 1,
              resourceId: slotId,
              effectDescription: 'Attacker must reroll (enter new value)',
              execute: () => {
                expendResource(slotId);
                setTurn(prev => ({ ...prev, reaction: prev.reaction - 1 }));
                const newRoll = prompt('DM: Enter the new attack roll after Silvery Barbs reroll:');
                const newVal = parseInt(newRoll || '0');
                setPendingEvent(prev => prev ? { ...prev, value: newVal || prev.value, reactionsUsed: [...prev.reactionsUsed, 'silvery_barbs'] } : null);
                addLog('action', `⚡ REACTION: Silvery Barbs (forced reroll → ${newVal}, used ${slotId.replace(/_/g, ' ')})`);
              },
            });
          }
        }

        // Deflect Missiles (Monk, Level 3+): reaction to ranged attack damage
        if (pendingEvent.type === 'incoming_damage' && !pendingEvent.reactionsUsed.includes('deflect_missiles')) {
          const hasDeflect = (char.features || []).some(f => f.name.toLowerCase().includes('deflect missile'));
          if (hasDeflect && turn.reaction > 0) {
            const monkLevel = char.level || 1;
            const dexMod = Math.floor(((char.stats?.dex || 10) - 10) / 2);
            const reduction = Math.floor(Math.random() * 10) + 1 + dexMod + monkLevel;
            availableReactions.push({
              id: 'deflect_missiles',
              name: '🥋 Deflect Missiles',
              description: `Reaction: Reduce ranged weapon damage by 1d10+${dexMod}+${monkLevel}`,
              effectDescription: `Reduce damage by ${reduction}`,
              execute: () => {
                const newDamage = Math.max(0, pendingEvent.value - reduction);
                setTurn(prev => ({ ...prev, reaction: prev.reaction - 1 }));
                setPendingEvent(prev => prev ? { ...prev, value: newDamage, reactionsUsed: [...prev.reactionsUsed, 'deflect_missiles'] } : null);
                addLog('action', `⚡ REACTION: Deflect Missiles (reduced by ${reduction}, ${newDamage} remaining)`);
              },
            });
          }
        }

        // Compute final damage after pipeline (for display)
        const pipelineDamage = pendingEvent.type === 'incoming_damage'
          ? calculateIncomingDamage(pendingEvent.value, pendingEvent.damageType || 'untyped', resolved, pendingEvent.isMagical || false)
          : 0;

        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}>
            <div style={{
              width: 'min(480px, 90vw)', maxHeight: '85vh', overflow: 'auto',
              background: 'linear-gradient(180deg, #1a1a1a, #111)',
              border: `2px solid ${pendingEvent.type === 'incoming_attack' ? '#f97316' : '#ef4444'}`,
              borderRadius: '12px', padding: '24px',
              boxShadow: `0 0 40px ${pendingEvent.type === 'incoming_attack' ? 'rgba(249,115,22,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>
                  ⚡ Resolution Staging
                </div>
                <div style={{ fontSize: '24px', fontFamily: 'Cinzel, serif', fontWeight: 'bold', color: pendingEvent.type === 'incoming_attack' ? '#f97316' : '#ef4444' }}>
                  {pendingEvent.type === 'incoming_attack' ? '⚔️ Incoming Attack' : '💥 Incoming Damage'}
                </div>
              </div>

              {/* Status Banner */}
              {pendingEvent.type === 'incoming_attack' && (
                <div style={{
                  padding: '16px', borderRadius: '8px', textAlign: 'center', marginBottom: '16px',
                  background: isHit ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)',
                  border: `2px solid ${isHit ? '#ef4444' : '#22c55e'}`,
                }}>
                  <div style={{ fontSize: '32px', fontFamily: 'Cinzel, serif', fontWeight: 'bold', color: isHit ? '#ef4444' : '#22c55e' }}>
                    {isHit ? '💀 HIT!' : '🛡️ MISS!'}
                  </div>
                  <div style={{ fontSize: '14px', color: '#ccc', marginTop: '4px' }}>
                    <span style={{ color: '#f97316', fontWeight: 'bold' }}>{pendingEvent.value}</span>
                    {' vs '}
                    <span style={{ color: '#55aacc', fontWeight: 'bold' }}>{currentAC} AC</span>
                  </div>
                  {pendingEvent.reactionsUsed.length > 0 && (
                    <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
                      Reactions used: {pendingEvent.reactionsUsed.join(', ')}
                    </div>
                  )}
                </div>
              )}

              {pendingEvent.type === 'incoming_damage' && (
                <div style={{
                  padding: '16px', borderRadius: '8px', textAlign: 'center', marginBottom: '16px',
                  background: 'rgba(239, 68, 68, 0.12)', border: '2px solid #ef4444',
                }}>
                  <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '4px' }}>Incoming</div>
                  <div style={{ fontSize: '36px', fontFamily: 'Cinzel, serif', fontWeight: 'bold', color: '#ef4444' }}>
                    {pendingEvent.value} {pendingEvent.damageType}
                  </div>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                    After pipeline: <span style={{ color: pipelineDamage < pendingEvent.value ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>{pipelineDamage}</span>
                    {pipelineDamage < pendingEvent.value && ` (${pendingEvent.value - pipelineDamage} reduced)`}
                  </div>
                  {pendingEvent.isMagical && <div style={{ fontSize: '10px', color: '#a855f7', marginTop: '2px' }}>✦ Magical Source</div>}
                </div>
              )}

              {/* Available Reactions */}
              {availableReactions.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#aaaa44', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 'bold' }}>
                    ⚡ Available Reactions
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {availableReactions.map(reaction => (
                      <button
                        key={reaction.id}
                        onClick={reaction.execute}
                        style={{
                          padding: '12px', textAlign: 'left',
                          background: 'rgba(170, 170, 68, 0.08)', border: '1px solid #aaaa4466',
                          borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s',
                        }}
                        onMouseOver={e => { e.currentTarget.style.background = 'rgba(170, 170, 68, 0.2)'; e.currentTarget.style.borderColor = '#aaaa44'; }}
                        onMouseOut={e => { e.currentTarget.style.background = 'rgba(170, 170, 68, 0.08)'; e.currentTarget.style.borderColor = '#aaaa4466'; }}
                      >
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#eeee88', fontFamily: 'Cinzel, serif' }}>
                          {reaction.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                          {reaction.description}
                        </div>
                        <div style={{ fontSize: '11px', color: '#aaaa44', marginTop: '2px', fontWeight: 'bold' }}>
                          → {reaction.effectDescription}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {turn.reaction === 0 && availableReactions.length === 0 && (
                <div style={{ fontSize: '11px', color: '#666', textAlign: 'center', fontStyle: 'italic', marginBottom: '16px' }}>
                  No reaction available (reaction already used this round).
                </div>
              )}

              {/* Final Resolution Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    if (pendingEvent.type === 'incoming_attack') {
                      const status = isHit ? 'HIT' : 'MISS';
                      addLog('action', `⚔️ Incoming Attack: ${pendingEvent.value} vs ${currentAC} AC → ${status}${pendingEvent.reactionsUsed.length > 0 ? ` (reactions: ${pendingEvent.reactionsUsed.join(', ')})` : ''}`);
                    } else if (pendingEvent.type === 'incoming_damage') {
                      // Route through Phase 1 damage pipeline
                      const finalDamage = calculateIncomingDamage(pendingEvent.value, pendingEvent.damageType || 'untyped', resolved, pendingEvent.isMagical || false);
                      const newHp = Math.max(0, char.currentHp - finalDamage);
                      updateField('currentHp', newHp);
                      addLog('action', `💥 Took ${finalDamage} ${pendingEvent.damageType || ''} damage (${pendingEvent.value} raw → ${finalDamage} after pipeline). HP: ${char.currentHp} → ${newHp}${pendingEvent.reactionsUsed.length > 0 ? ` (reactions: ${pendingEvent.reactionsUsed.join(', ')})` : ''}`);
                    }
                    setPendingEvent(null);
                  }}
                  style={{
                    flex: 1, padding: '12px', fontWeight: 'bold', fontSize: '14px',
                    background: `linear-gradient(135deg, ${pendingEvent.type === 'incoming_attack' ? '#f97316, #ea580c' : '#ef4444, #dc2626'})`,
                    color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer',
                    fontFamily: 'Cinzel, serif',
                  }}
                >
                  {pendingEvent.type === 'incoming_attack' 
                    ? `✓ Resolve (${isHit ? 'HIT' : 'MISS'})` 
                    : `✓ Apply ${pipelineDamage} Damage`}
                </button>
                <button
                  onClick={() => setPendingEvent(null)}
                  style={{ padding: '12px 20px', background: 'transparent', color: '#888', border: '1px solid #555', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                >Dismiss</button>
              </div>
            </div>
          </div>
        );
      })()}

      {showShortRest && (
        <div style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(50,30,10,0.95), rgba(30,20,8,0.95))', border: '1px solid #cfaa5e', borderRadius: '12px', marginBottom: '24px', boxShadow: '0 0 20px rgba(207,170,94,0.15)' }}>
           <h3 style={{ margin: '0 0 4px 0', color: '#cfaa5e', fontFamily: 'Cinzel, serif', fontSize: '18px' }}>🏕️ Short Rest</h3>
           <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#888' }}>Spend Hit Dice to recover HP. Short-rest resources will be restored.</p>
           
           {/* Hit Dice Status */}
           <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid #333' }}>
             <div style={{ flex: 1 }}>
               <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Hit Dice Available</div>
               <div style={{ fontSize: '24px', fontFamily: 'Cinzel, serif', color: hitDiceAvailable > 0 ? '#cfaa5e' : '#666' }}>
                 {hitDiceAvailable - spentHitDice} <span style={{ fontSize: '14px', color: '#666' }}>/ {char.hitDiceTotal} (d{hitDieSize})</span>
               </div>
             </div>
             <div style={{ display: 'flex', gap: '8px' }}>
               <button 
                 onClick={handleRollHitDie}
                 disabled={spentHitDice >= hitDiceAvailable}
                 style={{ padding: '10px 16px', background: spentHitDice >= hitDiceAvailable ? '#1a1a1a' : '#332211', border: `1px solid ${spentHitDice >= hitDiceAvailable ? '#333' : '#cfaa5e'}`, color: spentHitDice >= hitDiceAvailable ? '#555' : '#cfaa5e', borderRadius: '6px', cursor: spentHitDice >= hitDiceAvailable ? 'not-allowed' : 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold', fontSize: '13px' }}
               >
                 🎲 Roll d{hitDieSize}
               </button>
               <button 
                 onClick={handleAvgHitDie}
                 disabled={spentHitDice >= hitDiceAvailable}
                 style={{ padding: '10px 16px', background: spentHitDice >= hitDiceAvailable ? '#1a1a1a' : '#222', border: `1px solid ${spentHitDice >= hitDiceAvailable ? '#333' : '#666'}`, color: spentHitDice >= hitDiceAvailable ? '#555' : '#aaa', borderRadius: '6px', cursor: spentHitDice >= hitDiceAvailable ? 'not-allowed' : 'pointer', fontSize: '12px' }}
               >
                 Avg ({Math.max(1, avgHitDieRoll + conMod)})
               </button>
             </div>
           </div>

           {/* HP Recovery Preview */}
           {spentHitDice > 0 && (
             <div style={{ padding: '12px', background: 'rgba(50, 200, 50, 0.08)', border: '1px solid #3c5', borderRadius: '8px', marginBottom: '16px', textAlign: 'center' }}>
               <div style={{ fontSize: '12px', color: '#8c8', marginBottom: '4px' }}>HP to Recover</div>
               <div style={{ fontSize: '28px', fontFamily: 'Cinzel, serif', color: '#5f5', fontWeight: 'bold' }}>+{hpRolled}</div>
               <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>From {spentHitDice} Hit {spentHitDice === 1 ? 'Die' : 'Dice'} (CON {conMod >= 0 ? '+' : ''}{conMod} per die)</div>
             </div>
           )}

           {/* Resources that will recover */}
           {shortRestResources.length > 0 && (
             <div style={{ padding: '8px 12px', background: 'rgba(207,170,94,0.08)', border: '1px solid #443', borderRadius: '6px', marginBottom: '16px' }}>
               <div style={{ fontSize: '10px', color: '#cfaa5e', textTransform: 'uppercase', marginBottom: '4px' }}>Resources Restoring</div>
               <div style={{ fontSize: '12px', color: '#aaa' }}>{shortRestResources.join(' · ')}</div>
             </div>
           )}

           <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
             <button onClick={() => { setShowShortRest(false); setSpentHitDice(0); setHpRolled(0); }} style={{ padding: '10px 20px', background: 'transparent', color: '#cfaa5e', border: '1px solid #cfaa5e', borderRadius: '6px', cursor: 'pointer', fontFamily: 'Cinzel, serif' }}>Cancel</button>
             <button onClick={handleShortRestConfirm} style={{ padding: '10px 24px', background: '#cfaa5e', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold', boxShadow: '0 0 10px rgba(207,170,94,0.3)' }}>Rest by the Fire</button>
           </div>
        </div>
      )}

      {showLongRest && (
        <div style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(10,30,50,0.95), rgba(5,15,30,0.95))', border: '1px solid #55aacc', borderRadius: '12px', marginBottom: '24px', boxShadow: '0 0 20px rgba(85,170,204,0.15)' }}>
           <h3 style={{ margin: '0 0 4px 0', color: '#55aacc', fontFamily: 'Cinzel, serif', fontSize: '18px' }}>🌙 Long Rest</h3>
           <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#888' }}>8 hours of sleep. Fully restores HP, spell slots, and all daily resources.</p>
           
           {/* Recovery Preview */}
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
             <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid #333', textAlign: 'center' }}>
               <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>HP Restored</div>
               <div style={{ fontSize: '20px', fontFamily: 'Cinzel, serif', color: longRestHpGain > 0 ? '#5f5' : '#555' }}>+{longRestHpGain}</div>
             </div>
             <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid #333', textAlign: 'center' }}>
               <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Hit Dice Back</div>
               <div style={{ fontSize: '20px', fontFamily: 'Cinzel, serif', color: longRestDiceRecovery > 0 ? '#cfaa5e' : '#555' }}>+{longRestDiceRecovery}</div>
             </div>
             <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid #333', textAlign: 'center' }}>
               <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Resources</div>
               <div style={{ fontSize: '20px', fontFamily: 'Cinzel, serif', color: longRestResources.length > 0 ? '#55aacc' : '#555' }}>{longRestResources.length}</div>
             </div>
           </div>

           {/* Resources that will recover */}
           {longRestResources.length > 0 && (
             <div style={{ padding: '8px 12px', background: 'rgba(85,170,204,0.08)', border: '1px solid #234', borderRadius: '6px', marginBottom: '16px' }}>
               <div style={{ fontSize: '10px', color: '#55aacc', textTransform: 'uppercase', marginBottom: '4px' }}>Restoring</div>
               <div style={{ fontSize: '12px', color: '#aaa' }}>{longRestResources.join(' · ')}</div>
             </div>
           )}

           {(char.deathSaves?.successes > 0 || char.deathSaves?.failures > 0) && (
             <div style={{ padding: '8px 12px', background: 'rgba(200,100,100,0.08)', border: '1px solid #433', borderRadius: '6px', marginBottom: '16px', fontSize: '12px', color: '#c88' }}>
               ✦ Death saves will be cleared
             </div>
           )}

           <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
             <button onClick={() => setShowLongRest(false)} style={{ padding: '10px 20px', background: 'transparent', color: '#55aacc', border: '1px solid #55aacc', borderRadius: '6px', cursor: 'pointer', fontFamily: 'Cinzel, serif' }}>Cancel</button>
             <button onClick={handleLongRestConfirm} style={{ padding: '10px 24px', background: '#55aacc', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold', boxShadow: '0 0 10px rgba(85,170,204,0.3)' }}>Sleep Under the Stars</button>
           </div>
        </div>
      )}

      <div className={styles.twoColumnMobileWrap} style={{ marginBottom: '24px' }}>
        {/* Death Saves */}
        <div style={{ background: '#111', padding: '12px', borderRadius: '8px', border: '1px solid #333' }}>
          <h3 className={styles.sectionHeading} style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Death Saves</h3>
          <div className={styles.deathSavesRow} style={{ marginTop: '0', background: 'transparent', padding: 0 }}>
            <div className={styles.deathSaveGroup}>
              <span className={styles.deathLabel}>Successes</span>
              <div className={styles.deathDots}>
                {[0,1,2].map(i => (
                  <span key={i} className={`${styles.deathDot} ${i < (char.deathSaves?.successes || 0) ? styles.deathSuccess : ''}`} 
                    onClick={() => updateNestedField('deathSaves', 'successes', (char.deathSaves?.successes || 0) === i+1 ? i : i+1)} />
                ))}
              </div>
            </div>
            <div className={styles.deathSaveGroup}>
              <span className={styles.deathLabel}>Failures</span>
              <div className={styles.deathDots}>
                {[0,1,2].map(i => (
                  <span key={i} className={`${styles.deathDot} ${i < (char.deathSaves?.failures || 0) ? styles.deathFail : ''}`} 
                    onClick={() => updateNestedField('deathSaves', 'failures', (char.deathSaves?.failures || 0) === i+1 ? i : i+1)} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Spell Slots */}
        {Object.entries(char.resources || {}).some(([k]) => k.startsWith('spell_slot_')) && (
          <div style={{ background: '#111', padding: '12px', borderRadius: '8px', border: '1px solid #333', gridColumn: '1 / -1' }}>
            <h3 className={styles.sectionHeading} style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#55aacc' }}>Spell Slots</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Object.entries(char.resources || {})
                .filter(([k]) => k.startsWith('spell_slot_'))
                .sort((a,b) => parseInt(a[0].split('_').pop() || '0') - parseInt(b[0].split('_').pop() || '0'))
                .map(([id, res]) => {
                  const level = id.split('_').pop();
                  return (
                    <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#222', padding: '8px', borderRadius: '6px', border: '1px solid #444', minWidth: '60px' }}>
                      <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Level {level}</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {Array.from({ length: res.max }).map((_, i) => (
                           <div 
                             key={i} 
                             onClick={() => {
                               const newlyUsed = res.used === i+1 ? i : i+1;
                               updateField('resources', { ...char.resources, [id]: { ...res, used: newlyUsed }});
                             }}
                             style={{
                               width: '12px', height: '12px', borderRadius: '50%',
                               background: i < res.used ? '#111' : '#55aacc',
                               border: `1px solid ${i < res.used ? '#444' : '#55aacc'}`,
                               cursor: 'pointer',
                               boxShadow: i < res.used ? 'none' : '0 0 5px rgba(85, 170, 204, 0.4)'
                             }} 
                           />
                        ))}
                      </div>
                    </div>
                  )
                })
              }
            </div>
          </div>
        )}

        {/* ═══ FONT OF MAGIC — Sorcery Point Conversion (Phase 3) ═══ */}
        {char.resources?.['sorcery_points'] && Object.entries(char.resources || {}).some(([k]) => k.startsWith('spell_slot_')) && (
          <div style={{ background: '#111', padding: '12px', borderRadius: '8px', border: '1px solid #a855f7', gridColumn: '1 / -1' }}>
            <h3 className={styles.sectionHeading} style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#a855f7' }}>⚗️ Font of Magic</h3>
            
            {/* Current Sorcery Points Display */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', padding: '8px', background: 'rgba(168, 85, 247, 0.08)', borderRadius: '6px', border: '1px solid #a855f744' }}>
              <span style={{ fontSize: '11px', color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 'bold' }}>Sorcery Points</span>
              <span style={{ fontSize: '20px', fontFamily: 'Cinzel, serif', color: '#c9aaff', fontWeight: 'bold' }}>
                {char.resources['sorcery_points'].max - char.resources['sorcery_points'].used}
              </span>
              <span style={{ fontSize: '11px', color: '#666' }}>/ {char.resources['sorcery_points'].max}</span>
            </div>

            {/* Conversion: Burn Slot → Gain SP */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Burn Spell Slot → Gain SP</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {Object.entries(char.resources || {})
                  .filter(([k, r]) => k.startsWith('spell_slot_') && r.used < r.max)
                  .sort((a,b) => parseInt(a[0].split('_').pop() || '0') - parseInt(b[0].split('_').pop() || '0'))
                  .map(([id, res]) => {
                    const slotLevel = parseInt(id.split('_').pop() || '0');
                    const spGain = slotLevel; // RAW: 1 SP per slot level
                    const spResource = char.resources!['sorcery_points'];
                    const spRemaining = spResource.max - spResource.used;
                    const canConvert = spRemaining < spResource.max; // Can only gain if not full
                    return (
                      <button
                        key={`burn_${id}`}
                        disabled={!canConvert}
                        onClick={() => {
                          expendResource(id);
                          // Restore sorcery points (reduce used count)
                          const newUsed = Math.max(0, spResource.used - spGain);
                          updateField('resources', {
                            ...char.resources,
                            sorcery_points: { ...spResource, used: newUsed }
                          });
                          addLog('action', `Font of Magic: Burned Lv.${slotLevel} slot → gained ${spGain} SP`);
                        }}
                        style={{
                          padding: '6px 10px', fontSize: '11px', fontWeight: 'bold',
                          background: canConvert ? 'rgba(168, 85, 247, 0.12)' : '#1a1a1a',
                          border: `1px solid ${canConvert ? '#a855f7' : '#333'}`,
                          color: canConvert ? '#c9aaff' : '#555',
                          borderRadius: '4px', cursor: canConvert ? 'pointer' : 'not-allowed',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        Lv.{slotLevel} → +{spGain} SP
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Conversion: Burn SP → Create Slot */}
            <div>
              <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Burn SP → Create Spell Slot</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {[1, 2, 3, 4, 5].map(targetLevel => {
                  // PHB conversion costs: 1→2, 2→3, 3→5, 4→6, 5→7
                  const spCosts: Record<number, number> = { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7 };
                  const cost = spCosts[targetLevel];
                  const spResource = char.resources!['sorcery_points'];
                  const spAvailable = spResource.max - spResource.used;
                  const slotId = `spell_slot_${targetLevel}`;
                  const hasSlotType = char.resources?.[slotId];
                  const canAfford = spAvailable >= cost;
                  return (
                    <button
                      key={`create_${targetLevel}`}
                      disabled={!canAfford}
                      onClick={() => {
                        // Spend sorcery points
                        const newSpUsed = spResource.used + cost;
                        const newResources: Record<string, typeof spResource> = {
                          ...char.resources,
                          sorcery_points: { ...spResource, used: newSpUsed }
                        };
                        // Add/restore a slot
                        if (hasSlotType) {
                          const slot = char.resources![slotId];
                          // Restore one used slot (or create one extra)
                          if (slot.used > 0) {
                            newResources[slotId] = { ...slot, used: slot.used - 1 };
                          } else {
                            // Already full, temporarily bump max by 1
                            newResources[slotId] = { ...slot, max: slot.max + 1 };
                          }
                        } else {
                          // No slots of this level exist, create one
                          newResources[slotId] = {
                            name: `Level ${targetLevel} Spell Slot`,
                            max: 1, used: 0,
                            recharge: 'long' as const,
                            description: 'Created via Font of Magic'
                          };
                        }
                        updateField('resources', newResources);
                        addLog('action', `Font of Magic: Spent ${cost} SP → created Lv.${targetLevel} slot`);
                      }}
                      style={{
                        padding: '6px 10px', fontSize: '11px', fontWeight: 'bold',
                        background: canAfford ? 'rgba(85, 170, 204, 0.12)' : '#1a1a1a',
                        border: `1px solid ${canAfford ? '#55aacc' : '#333'}`,
                        color: canAfford ? '#8bd' : '#555',
                        borderRadius: '4px', cursor: canAfford ? 'pointer' : 'not-allowed',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {cost} SP → Lv.{targetLevel}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Conditions */}
        <div style={{ background: '#111', padding: '12px', borderRadius: '8px', border: '1px solid #333' }}>
          <h3 className={styles.sectionHeading} style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Conditions</h3>
          <div className={styles.conditionChips}>
            {CONDITIONS.map(c => (
              <span key={c} className={`${styles.conditionChip} ${char.conditions?.includes(c) ? styles.conditionActive : ''}`}
                onClick={() => {
                  const conditions = char.conditions?.includes(c) ? char.conditions.filter(x => x !== c) : [...(char.conditions || []), c];
                  updateField('conditions', conditions);
                }}>{c}</span>
            ))}
          </div>
        </div>

        {/* ═══ ACTIVE EFFECTS & FLOATING MODIFIERS (Phase 4) ═══ */}
        <div style={{ background: '#111', padding: '12px', borderRadius: '8px', border: '1px solid #3b82f6', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className={styles.sectionHeading} style={{ margin: 0, fontSize: '14px', color: '#3b82f6' }}>✨ Active Effects</h3>
            <button
              onClick={() => setShowEffectModal(!showEffectModal)}
              style={{
                padding: '6px 14px', fontSize: '11px', fontWeight: 'bold',
                background: showEffectModal ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                border: '1px solid #3b82f6', color: '#7db4ff',
                borderRadius: '4px', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {showEffectModal ? '✕ Close' : '+ Add Effect'}
            </button>
          </div>

          {/* Active Effect Badges */}
          {(char.externalEffects || []).length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: showEffectModal ? '16px' : '0' }}>
              {(char.externalEffects || []).map(effect => {
                const durationLabels: Record<string, string> = {
                  '1_round': '1 Rnd', '1_minute': '1 Min', '10_minutes': '10 Min',
                  '1_hour': '1 Hr', '8_hours': '8 Hr',
                  'until_short_rest': 'Until SR', 'until_long_rest': 'Until LR', 'permanent': '∞'
                };
                return (
                  <div key={effect.id} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(30, 60, 120, 0.08))',
                    border: '1px solid #3b82f688', borderRadius: '6px',
                    transition: 'all 0.2s ease',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#7db4ff', fontFamily: 'Cinzel, serif' }}>
                        {effect.name}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                        <span style={{ fontSize: '10px', color: '#888' }}>from {effect.source}</span>
                        <span style={{
                          fontSize: '9px', padding: '1px 6px',
                          background: effect.duration === 'permanent' ? '#2d2' : '#3b82f644',
                          color: effect.duration === 'permanent' ? '#afa' : '#7db4ff',
                          borderRadius: '8px', textTransform: 'uppercase', letterSpacing: '0.5px',
                        }}>
                          {durationLabels[effect.duration] || effect.duration}
                        </span>
                      </div>
                      {effect.description && (
                        <div style={{ fontSize: '10px', color: '#666', marginTop: '2px', fontStyle: 'italic' }}>
                          {effect.description}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        removeExternalEffect(effect.id);
                        addLog('action', `[Buff] ${effect.name} removed (from ${effect.source})`);
                      }}
                      style={{
                        width: '22px', height: '22px', borderRadius: '50%',
                        background: 'rgba(255, 60, 60, 0.15)', border: '1px solid #f44',
                        color: '#f66', cursor: 'pointer', fontSize: '12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, transition: 'all 0.15s',
                      }}
                      title="Remove effect (lost concentration?)"
                    >✕</button>
                  </div>
                );
              })}
            </div>
          ) : (
            !showEffectModal && (
              <div style={{ fontSize: '11px', color: '#555', fontStyle: 'italic' }}>
                No active buffs or debuffs. Click "+ Add Effect" to apply party spells or environmental effects.
              </div>
            )
          )}

          {/* ═══ ADD EFFECT MODAL ═══ */}
          {showEffectModal && (
            <div style={{
              background: 'rgba(0,0,0,0.4)', border: '1px solid #3b82f644',
              borderRadius: '8px', padding: '16px',
            }}>
              {/* Tab Switcher */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #333', paddingBottom: '8px' }}>
                <button
                  onClick={() => setEffectModalTab('quick')}
                  style={{
                    padding: '8px 16px', fontSize: '12px', fontWeight: 'bold', fontFamily: 'Cinzel, serif',
                    background: effectModalTab === 'quick' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    color: effectModalTab === 'quick' ? '#7db4ff' : '#666',
                    border: `1px solid ${effectModalTab === 'quick' ? '#3b82f6' : 'transparent'}`,
                    borderRadius: '4px', cursor: 'pointer',
                  }}
                >⚡ Quick Buffs</button>
                <button
                  onClick={() => setEffectModalTab('custom')}
                  style={{
                    padding: '8px 16px', fontSize: '12px', fontWeight: 'bold', fontFamily: 'Cinzel, serif',
                    background: effectModalTab === 'custom' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                    color: effectModalTab === 'custom' ? '#c9aaff' : '#666',
                    border: `1px solid ${effectModalTab === 'custom' ? '#a855f7' : 'transparent'}`,
                    borderRadius: '4px', cursor: 'pointer',
                  }}
                >🔮 Custom Effect</button>
              </div>

              {/* TAB 1: Quick Buffs */}
              {effectModalTab === 'quick' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: '8px' }}>
                  {/* Shield of Faith: +2 AC */}
                  <button
                    onClick={() => {
                      const effect: ExternalEffect = {
                        id: `eff_sof_${Date.now()}`, name: 'Shield of Faith', source: 'Cleric',
                        duration: '10_minutes', description: '+2 AC (concentration, 10 min)',
                        modifiers: [{ type: 'modify_ac', bonus: 2 }],
                      };
                      addExternalEffect(effect);
                      addLog('action', `[Buff] Shield of Faith applied (+2 AC)`);
                      setShowEffectModal(false);
                    }}
                    style={{
                      padding: '12px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid #3b82f644',
                      borderRadius: '6px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'; e.currentTarget.style.borderColor = '#3b82f6'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)'; e.currentTarget.style.borderColor = '#3b82f644'; }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#7db4ff', fontFamily: 'Cinzel, serif' }}>🛡️ Shield of Faith</div>
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>+2 AC · Concentration · 10 min</div>
                  </button>

                  {/* Bless: +1d4 to attacks and saves */}
                  <button
                    onClick={() => {
                      const effect: ExternalEffect = {
                        id: `eff_bless_${Date.now()}`, name: 'Bless', source: 'Cleric',
                        duration: '1_minute', description: '+1d4 to attack rolls and saving throws',
                        modifiers: [{ type: 'passive', description: '+1d4 to attack rolls and saving throws (Bless)' }],
                      };
                      addExternalEffect(effect);
                      addLog('action', `[Buff] Bless applied (+1d4 attacks/saves)`);
                      setShowEffectModal(false);
                    }}
                    style={{
                      padding: '12px', background: 'rgba(255, 215, 0, 0.06)', border: '1px solid #ffd70044',
                      borderRadius: '6px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = 'rgba(255, 215, 0, 0.15)'; e.currentTarget.style.borderColor = '#ffd700'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'rgba(255, 215, 0, 0.06)'; e.currentTarget.style.borderColor = '#ffd70044'; }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#ffd700', fontFamily: 'Cinzel, serif' }}>✝️ Bless</div>
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>+1d4 ATK & Saves · Conc. · 1 min</div>
                  </button>

                  {/* Haste: +2 AC, double speed, advantage on DEX saves */}
                  <button
                    onClick={() => {
                      const effect: ExternalEffect = {
                        id: `eff_haste_${Date.now()}`, name: 'Haste', source: 'Wizard',
                        duration: '1_minute', description: '+2 AC, doubled speed, advantage on DEX saves, +1 action (attack/dash/disengage/hide/use object)',
                        modifiers: [
                          { type: 'modify_ac', bonus: 2 },
                          { type: 'grant_speed', value: (char.speed || 30) }, // Double speed
                        ],
                      };
                      addExternalEffect(effect);
                      addLog('action', `[Buff] Haste applied (+2 AC, x2 speed, +1 action)`);
                      setShowEffectModal(false);
                    }}
                    style={{
                      padding: '12px', background: 'rgba(0, 255, 126, 0.06)', border: '1px solid #00ff7e44',
                      borderRadius: '6px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = 'rgba(0, 255, 126, 0.15)'; e.currentTarget.style.borderColor = '#00ff7e'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'rgba(0, 255, 126, 0.06)'; e.currentTarget.style.borderColor = '#00ff7e44'; }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#00ff7e', fontFamily: 'Cinzel, serif' }}>⚡ Haste</div>
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>+2 AC · x2 Speed · Conc. · 1 min</div>
                  </button>

                  {/* Bane: -1d4 to attacks and saves */}
                  <button
                    onClick={() => {
                      const effect: ExternalEffect = {
                        id: `eff_bane_${Date.now()}`, name: 'Bane', source: 'Enemy',
                        duration: '1_minute', description: '-1d4 to attack rolls and saving throws',
                        modifiers: [{ type: 'passive', description: '-1d4 to attack rolls and saving throws (Bane)' }],
                      };
                      addExternalEffect(effect);
                      addLog('action', `[Debuff] Bane applied (-1d4 attacks/saves)`);
                      setShowEffectModal(false);
                    }}
                    style={{
                      padding: '12px', background: 'rgba(255, 60, 60, 0.06)', border: '1px solid #ff3c3c44',
                      borderRadius: '6px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = 'rgba(255, 60, 60, 0.15)'; e.currentTarget.style.borderColor = '#ff3c3c'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'rgba(255, 60, 60, 0.06)'; e.currentTarget.style.borderColor = '#ff3c3c44'; }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#ff6666', fontFamily: 'Cinzel, serif' }}>💀 Bane</div>
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>-1d4 ATK & Saves · Conc. · 1 min</div>
                  </button>
                </div>
              )}

              {/* TAB 2: Custom Effect Builder */}
              {effectModalTab === 'custom' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                    <input
                      placeholder="Effect Name (e.g. Guidance)"
                      value={customEffectName}
                      onChange={e => setCustomEffectName(e.target.value)}
                      style={{ padding: '8px', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '4px', fontSize: '12px' }}
                    />
                    <input
                      placeholder="Source (e.g. Druid, Potion)"
                      value={customEffectSource}
                      onChange={e => setCustomEffectSource(e.target.value)}
                      style={{ padding: '8px', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '4px', fontSize: '12px' }}
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>Duration</label>
                    <select
                      value={customEffectDuration}
                      onChange={e => setCustomEffectDuration(e.target.value as EffectDuration)}
                      style={{ padding: '8px', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '4px', fontSize: '12px', width: '100%' }}
                    >
                      <option value="1_round">1 Round</option>
                      <option value="1_minute">1 Minute (10 rounds)</option>
                      <option value="10_minutes">10 Minutes</option>
                      <option value="1_hour">1 Hour</option>
                      <option value="8_hours">8 Hours</option>
                      <option value="until_short_rest">Until Short Rest</option>
                      <option value="until_long_rest">Until Long Rest</option>
                      <option value="permanent">Permanent</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <ModifierBuilder value={customEffectModifiers} onChange={setCustomEffectModifiers} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => {
                        if (!customEffectName || customEffectModifiers.length === 0) {
                          alert('Please provide a name and at least one modifier.');
                          return;
                        }
                        const effect: ExternalEffect = {
                          id: `eff_custom_${Date.now()}`,
                          name: customEffectName,
                          source: customEffectSource || 'Unknown',
                          duration: customEffectDuration,
                          modifiers: customEffectModifiers,
                        };
                        addExternalEffect(effect);
                        addLog('action', `[Buff] ${customEffectName} applied (custom, from ${customEffectSource || 'Unknown'})`);
                        setCustomEffectName('');
                        setCustomEffectSource('');
                        setCustomEffectModifiers([]);
                        setShowEffectModal(false);
                      }}
                      style={{
                        flex: 1, padding: '10px', fontWeight: 'bold',
                        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                        color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer',
                        fontFamily: 'Cinzel, serif', fontSize: '13px',
                      }}
                    >✨ Apply Effect</button>
                    <button
                      onClick={() => { setShowEffectModal(false); setCustomEffectModifiers([]); }}
                      style={{ padding: '10px 16px', background: 'transparent', color: '#888', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                    >Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>


      {/* DYNAMIC COMBAT DECK */}
      <h3 className={styles.sectionHeading} style={{ borderBottom: '1px solid #cfaa5e', paddingBottom: '8px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Action Hand
        
        {/* TURN ECONOMY HUD */}
        <div style={{ display: 'flex', gap: '16px', background: 'rgba(20,20,20,0.8)', padding: '6px 12px', border: '1px solid #cfaa5e', borderRadius: '8px' }}>
           <div onClick={() => turn.action === 0 ? setTurn({...turn, action: 1}) : null} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: turn.action === 0 ? 'pointer' : 'default' }}>
             <span style={{ color: '#44aa44', fontSize: '10px', textTransform: 'uppercase' }}>Action</span>
             <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: turn.action > 0 ? '#44aa44' : 'transparent', border: '1px solid #44aa44' }} />
           </div>
           <div onClick={() => turn.bonus_action === 0 ? setTurn({...turn, bonus_action: 1}) : null} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: turn.bonus_action === 0 ? 'pointer' : 'default' }}>
             <span style={{ color: '#aa4444', fontSize: '10px', textTransform: 'uppercase' }}>Bonus</span>
             <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: turn.bonus_action > 0 ? '#aa4444' : 'transparent', border: '1px solid #aa4444' }} />
           </div>
           <div onClick={() => turn.reaction === 0 ? setTurn({...turn, reaction: 1}) : null} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: turn.reaction === 0 ? 'pointer' : 'default' }}>
             <span style={{ color: '#aaaa44', fontSize: '10px', textTransform: 'uppercase' }}>Reaction</span>
             <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: turn.reaction > 0 ? '#aaaa44' : 'transparent', border: '1px solid #aaaa44' }} />
           </div>
           
           <button onClick={() => setTurn({action: 1, bonus_action: 1, reaction: 1})} style={{ marginLeft: '12px', padding: '4px 8px', background: '#331111', color: '#ffaaaa', border: '1px solid #aa4444', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }}>
             RESET TURN
           </button>
        </div>
      </h3>
      
      {/* Action Economy Filter strictly for the Deck */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px', position: 'sticky', top: '0', zIndex: 10, background: 'rgba(10,10,10,0.95)', padding: '12px 0', backdropFilter: 'blur(4px)' }}>
        <button onClick={() => setActionFilter('all')} style={{ padding: '8px 16px', background: actionFilter === 'all' ? '#333' : 'transparent', color: actionFilter === 'all' ? '#fff' : '#888', border: `1px solid ${actionFilter === 'all' ? '#cfaa5e' : '#444'}`, borderRadius: '4px', cursor: 'pointer', fontFamily: 'Cinzel', fontWeight: 'bold' }}>THE DECK</button>
        <button onClick={() => setActionFilter('action')} style={{ padding: '8px 16px', background: actionFilter === 'action' ? '#224422' : 'transparent', color: actionFilter === 'action' ? '#88ff88' : '#888', border: `1px solid ${actionFilter === 'action' ? '#44aa44' : '#444'}`, borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Actions</button>
        <button onClick={() => setActionFilter('bonus_action')} style={{ padding: '8px 16px', background: actionFilter === 'bonus_action' ? '#442222' : 'transparent', color: actionFilter === 'bonus_action' ? '#ff8888' : '#888', border: `1px solid ${actionFilter === 'bonus_action' ? '#aa4444' : '#444'}`, borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Bonus Actions</button>
        <button onClick={() => setActionFilter('reaction')} style={{ padding: '8px 16px', background: actionFilter === 'reaction' ? '#444422' : 'transparent', color: actionFilter === 'reaction' ? '#ffff88' : '#888', border: `1px solid ${actionFilter === 'reaction' ? '#aaaa44' : '#444'}`, borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Reactions</button>
      </div>

      <div style={{ 
         display: 'flex', 
         flexWrap: 'wrap', 
         gap: '16px', 
         justifyContent: 'flex-start',
         alignItems: 'flex-start'
      }}>
         {interceptedDeck.length === 0 && (
            <div style={{ width: '100%', textAlign: 'center', padding: '40px', background: '#111', border: '1px dashed #444', color: '#666', borderRadius: '8px' }}>
              No Action Cards in hand for this filter. Equip weapons or prepare magic to build your deck!
            </div>
          )}
          {interceptedDeck.map(card => (
             <DungeonCard key={`${card.id}-${card.name}`} card={card} />
          ))}
      </div>

    </div>
  );
}
