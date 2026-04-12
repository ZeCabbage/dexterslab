'use client';

import { useCharacterStore } from '../lib/store';
import styles from '../[id]/page.module.css';
import DungeonCard, { DungeonCardData, CardActionCost } from '../components/DungeonCard';
import { useSpells } from '../hooks/useSpells';
import { useState, useMemo } from 'react';
import { getSpellDamage } from '../lib/compute-stats';
import { resolveModifiers, matchesCondition, CardMatchContext, getModifiedSpellDamage, resolveStagedModifierCost } from '../lib/resolve-modifiers';
import { SpellData, StagedModifier, Companion, CompanionAttack } from '../lib/types';

const CONDITIONS = ['Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious'];

export default function CombatTab() {
  const { char, updateField, updateNestedField, shortRest, longRest, expendResource, restoreResource, addLog, activateOneShot, toggleCombatState, stageModifier, clearStagedModifier } = useCharacterStore();
  const [showShortRest, setShowShortRest] = useState(false);
  const [showLongRest, setShowLongRest] = useState(false);
  
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
    if (spell.level > 0 && char.resources) {
        const slotId = `spell_slot_${spell.level}`;
        if (char.resources[slotId]) {
            resMax = char.resources[slotId].max;
            resUsed = char.resources[slotId].used;
            expend = () => expendResource(slotId);
            restore = () => restoreResource(slotId);
        }
    }

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
         // ── Phase 4c: Staged Modifier Cost Deduction ──
         if (char.stagedModifier) {
           const staged = char.stagedModifier;
           const spellLevel = spell.level;
           const actualCost = staged.cost === 'spell_level'
             ? Math.max(1, spellLevel)  // Cantrips cost 1, leveled spells cost their level
             : (typeof staged.cost === 'number' ? staged.cost : 0);

           const resource = char.resources?.[staged.costResourceId];
           if (resource) {
             const remaining = resource.max - resource.used;
             if (remaining < actualCost) {
               alert(`❌ Not enough ${staged.costResourceId.replace(/_/g, ' ')}! Need ${actualCost}, have ${remaining}.`);
               return; // Block the cast
             }
             // Deduct the cost
             expendResource(staged.costResourceId);
             // For costs > 1, deduct additional charges
             for (let i = 1; i < actualCost; i++) {
               expendResource(staged.costResourceId);
             }
             addLog('action', `${staged.name} applied to ${spell.name} (cost: ${actualCost} ${staged.costResourceId.replace(/_/g, ' ')})`);
           }
           clearStagedModifier();
         }

         useTurnResource(spell.actionCost as CardActionCost || 'action');
         if (expend) expend();
         addLog('spell', `Casted ${spell.name}`);
         alert(`Casting ${spell.name}`);
      },
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
