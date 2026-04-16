import { create } from 'zustand';
import { LiveCharacter, EquipSlot, InventoryItem, ModifierEffect, ActiveModifierState, ActiveCombatToggle, StagedModifier, CustomItem, CustomSpell, CustomFeature, HomebrewRegistry, ExternalEffect } from './types';
import { getResourceScaling } from '../data/resource-scaling';
import { THIRD_CASTER_SLOTS } from '../data/resource-scaling';

interface CharacterState {
  char: LiveCharacter | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  // Basic lifecycle
  setChar: (char: LiveCharacter) => void;
  setSaveStatus: (status: CharacterState['saveStatus']) => void;
  updateField: (field: keyof LiveCharacter, value: any) => void;
  updateNestedField: (parentKey: 'stats' | 'deathSaves', childKey: string, value: any) => void;

  // Assembly Line State
  draftGearSelections: Record<string, string[]>;
  setDraftGearChoice: (choiceId: string, itemIds: string[]) => void;
  
  // Live Vitals
  updateHP: (amount: number) => void;
  updateTempHP: (amount: number) => void; // absolute set or increment? Let's say we just use updateField for absolute
  
  // Resources (Spells & Features)
  expendResource: (id: string) => void;
  restoreResource: (id: string) => void;
  
  // Spells
  learnSpell: (id: string) => void;
  unlearnSpell: (id: string) => void;
  prepareSpell: (id: string) => void;
  unprepareSpell: (id: string) => void;
  equipItem: (itemId: string, slot: EquipSlot) => void;
  unequipSlot: (slot: EquipSlot) => void;
  updateCurrency: (gold: number, silver: number, copper: number) => void;
  
  // Rests
  shortRest: (hitDiceSpent: number, hpRecovered: number) => void;
  longRest: () => void;

  // Logs
  addLog: (type: 'creation' | 'level_up' | 'manual_edit' | 'item' | 'spell' | 'note' | 'rest' | 'roll' | 'feature' | 'action', description: string) => void;

  // Level Up
  completeLevelUp: (payload: any) => void;

  // Modifier Toggles (Metamagic / Maneuver one-shot buttons)
  activateOneShot: (modifierId: string, name: string, recharge: 'short' | 'long') => void;
  resetModifiers: (rechargeType: 'short' | 'long') => void;

  // ── Active Combat Toggles (Rage, Bladesong, etc.) ──
  toggleCombatState: (toggleId: string) => void;
  deactivateAllToggles: () => void;

  // ── Staged Modifier (Metamagic / Maneuver two-step staging) ──
  stageModifier: (modifier: StagedModifier) => void;
  clearStagedModifier: () => void;

  // ── Universal Homebrew Engine ──
  addHomebrewItem: (item: Partial<CustomItem>) => void;
  addHomebrewSpell: (spell: Partial<CustomSpell>) => void;
  addHomebrewFeature: (feature: Partial<CustomFeature>) => void;
  removeHomebrewItem: (id: string) => void;
  removeHomebrewSpell: (id: string) => void;
  removeHomebrewFeature: (id: string) => void;

  // ── External Effects (Phase 4: Floating Modifiers) ──
  addExternalEffect: (effect: ExternalEffect) => void;
  removeExternalEffect: (id: string) => void;
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  char: null,
  saveStatus: 'idle',
  draftGearSelections: {},

  setDraftGearChoice: (choiceId, itemIds) => set((state) => ({ 
    draftGearSelections: { ...state.draftGearSelections, [choiceId]: itemIds } 
  })),

  setChar: (char) => set({ char }),
  setSaveStatus: (status) => set({ saveStatus: status }),

  updateField: (field, value) => {
    const { char } = get();
    if (!char) return;
    set({ char: { ...char, [field]: value } });
  },

  updateNestedField: (parentKey, childKey, value) => {
    const { char } = get();
    if (!char) return;
    const parent = char[parentKey] as any;
    set({
      char: {
        ...char,
        [parentKey]: {
          ...parent,
          [childKey]: value
        }
      }
    });
  },

  updateHP: (amount: number) => {
    const { char } = get();
    if (!char) return;
    set({
      char: {
        ...char,
        currentHp: Math.max(0, Math.min(char.maxHp, char.currentHp + amount))
      }
    });
  },

  updateTempHP: (amount: number) => {
    const { char } = get();
    if (!char) return;
    set({
      char: {
        ...char,
        tempHp: amount > 0 ? amount : 0
      }
    });
  },

  expendResource: (id: string) => {
    const { char } = get();
    if (!char || !char.resources) return;
    const resList = char.resources;
    const res = resList[id];
    if (!res) return;

    set({
      char: {
        ...char,
        resources: {
          ...resList,
          [id]: { ...res, used: Math.min(res.max, res.used + 1) }
        }
      }
    });
  },

  restoreResource: (id: string) => {
    const { char } = get();
    if (!char || !char.resources) return;
    const resList = char.resources;
    const res = resList[id];
    if (!res) return;

    set({
      char: {
        ...char,
        resources: {
          ...resList,
          [id]: { ...res, used: Math.max(0, res.used - 1) }
        }
      }
    });
  },

  learnSpell: (id: string) => {
    const { char } = get();
    if (!char || !char.knownSpells) return;
    if (char.knownSpells.includes(id)) return;
    set({ char: { ...char, knownSpells: [...char.knownSpells, id] } });
  },

  unlearnSpell: (id: string) => {
    const { char } = get();
    if (!char || !char.knownSpells) return;
    set({ 
      char: { 
        ...char, 
        knownSpells: char.knownSpells.filter(s => s !== id),
        preparedSpells: char.preparedSpells.filter(s => s !== id) 
      } 
    });
  },

  prepareSpell: (id: string) => {
    const { char } = get();
    if (!char || !char.preparedSpells) return;
    if (char.preparedSpells.includes(id)) return;
    set({ char: { ...char, preparedSpells: [...char.preparedSpells, id] } });
  },

  unprepareSpell: (id: string) => {
    const { char } = get();
    if (!char || !char.preparedSpells) return;
    set({ char: { ...char, preparedSpells: char.preparedSpells.filter(s => s !== id) } });
  },

  equipItem: (itemId: string, slot: EquipSlot) => {
    const { char } = get();
    if (!char || !char.inventory) return;
    
    const itemToEquip = char.inventory.find(i => i.id === itemId);
    if (!itemToEquip) return;

    // ── Directive 4: Slot Validation ──
    // Enforce that only valid item types can occupy each slot.
    const SLOT_VALID_TYPES: Record<EquipSlot, { types: string[]; armorCategory?: string[] }> = {
      head:     { types: ['armor', 'gear'] },
      chest:    { types: ['armor'], armorCategory: ['light', 'medium', 'heavy'] },
      cloak:    { types: ['armor', 'gear'] },
      mainHand: { types: ['weapon'] },
      offHand:  { types: ['weapon', 'armor'], armorCategory: ['shield'] },
      gloves:   { types: ['armor', 'gear'] },
      ring1:    { types: ['gear'] },
      ring2:    { types: ['gear'] },
      boots:    { types: ['armor', 'gear'] },
      amulet:   { types: ['gear'] },
    };

    const slotRules = SLOT_VALID_TYPES[slot];
    if (slotRules) {
      const typeOk = slotRules.types.includes(itemToEquip.type);
      // For chest slot, also check armorCategory is not shield
      if (slot === 'chest' && itemToEquip.armorCategory === 'shield') return;
      // For offHand armor, must be shield
      if (slot === 'offHand' && itemToEquip.type === 'armor' && itemToEquip.armorCategory !== 'shield') return;
      if (!typeOk) return;
    }

    const currentEquippedItem = char.equipped?.[slot];
    let newInventory = char.inventory.filter(i => i.id !== itemId);
    
    // Put current item back in inventory if it exists
    if (currentEquippedItem) {
      newInventory.push(currentEquippedItem);
    }

    set({
      char: {
        ...char,
        inventory: newInventory,
        equipped: {
          ...char.equipped,
          [slot]: itemToEquip
        }
      }
    });
  },

  unequipSlot: (slot: EquipSlot) => {
    const { char } = get();
    if (!char || !char.equipped) return;
    
    const currentEquippedItem = char.equipped[slot];
    if (!currentEquippedItem) return;

    set({
      char: {
        ...char,
        inventory: [...char.inventory, currentEquippedItem],
        equipped: {
          ...char.equipped,
          [slot]: null
        }
      }
    });
  },

  updateCurrency: (gold: number, silver: number, copper: number) => {
    const { char } = get();
    if (!char) return;
    set({ char: { ...char, gold, silver, copper } });
  },

  shortRest: (hitDiceSpent: number, hpRecovered: number) => {
    const { char } = get();
    if (!char) return;

    let newChar = { ...char };
    const recoveredItems: string[] = [];

    // 1. Spend Hit Dice and Heal
    if (hitDiceSpent > 0 && hpRecovered > 0) {
      const actualSpent = Math.min(hitDiceSpent, newChar.hitDiceTotal - newChar.hitDiceUsed);
      newChar.hitDiceUsed = newChar.hitDiceUsed + actualSpent;
      const prevHp = newChar.currentHp;
      newChar.currentHp = Math.min(newChar.maxHp, newChar.currentHp + hpRecovered);
      const actualHealed = newChar.currentHp - prevHp;
      if (actualHealed > 0) recoveredItems.push(`Healed ${actualHealed} HP (spent ${actualSpent} Hit ${actualSpent === 1 ? 'Die' : 'Dice'})`);
    }

    // 2. Reset Short Rest resources
    if (newChar.resources) {
      const resetRes = { ...newChar.resources };
      for (const id in resetRes) {
        if (resetRes[id].recharge === 'short' && resetRes[id].used > 0) {
          recoveredItems.push(`${resetRes[id].name}: ${resetRes[id].used} charge${resetRes[id].used !== 1 ? 's' : ''} restored`);
          resetRes[id] = { ...resetRes[id], used: 0 };
        }
      }
      newChar.resources = resetRes;
    }

    // 3. Reset short-rest activeModifiers (Metamagic/Maneuver one-shots)
    if (newChar.activeModifiers) {
      newChar.activeModifiers = newChar.activeModifiers.map(m =>
        m.recharge === 'short' ? { ...m, isSpent: false } : m
      );
    }

    // 4. Deactivate all combat toggles tied to short-rest resources
    if (newChar.activeCombatToggles) {
      newChar.activeCombatToggles = newChar.activeCombatToggles.map(t => {
        if (t.isActive) {
          recoveredItems.push(`${t.name} faded`);
          return { ...t, isActive: false };
        }
        return t;
      });
    }

    // 5. Clear staged modifier
    if (newChar.stagedModifier) {
      recoveredItems.push(`Staged ${newChar.stagedModifier.name} cleared`);
      newChar.stagedModifier = null;
    }

    // 6. Clear external effects that expire on short rest
    if (newChar.externalEffects && newChar.externalEffects.length > 0) {
      const expiring = newChar.externalEffects.filter(e => e.duration === 'until_short_rest' || e.duration === '1_round' || e.duration === '1_minute' || e.duration === '10_minutes');
      if (expiring.length > 0) {
        for (const e of expiring) recoveredItems.push(`[Buff] ${e.name} faded`);
        newChar.externalEffects = newChar.externalEffects.filter(e => e.duration !== 'until_short_rest' && e.duration !== '1_round' && e.duration !== '1_minute' && e.duration !== '10_minutes');
      }
    }

    // 6. Log the event with flavor text
    const summary = recoveredItems.length > 0
      ? recoveredItems.join('. ') + '.'
      : 'No resources recovered.';
    newChar.logbook = [
      {
        id: 'log_' + Date.now(),
        timestamp: Date.now(),
        type: 'rest',
        description: `🏕️ Short Rest: ${char.name} took a moment by the campfire. ${summary}`,
        previousState: null
      },
      ...(newChar.logbook || [])
    ];

    set({ char: newChar });
  },

  longRest: () => {
    const { char } = get();
    if (!char) return;

    let newChar = { ...char };
    const recoveredItems: string[] = [];

    // 1. Restore HP
    const hpRecovered = newChar.maxHp - newChar.currentHp;
    newChar.currentHp = newChar.maxHp;
    if (hpRecovered > 0) recoveredItems.push(`Restored ${hpRecovered} HP to full`);
    if (newChar.tempHp > 0) {
      recoveredItems.push(`${newChar.tempHp} Temp HP cleared`);
      newChar.tempHp = 0;
    }

    // 2. Recover half Hit Dice (minimum 1)
    const halfDice = Math.max(1, Math.floor(newChar.hitDiceTotal / 2));
    const diceRecovered = Math.min(newChar.hitDiceUsed, halfDice);
    newChar.hitDiceUsed = Math.max(0, newChar.hitDiceUsed - halfDice);
    if (diceRecovered > 0) recoveredItems.push(`Recovered ${diceRecovered} Hit ${diceRecovered === 1 ? 'Die' : 'Dice'}`);

    // 3. Reset all non-none resources
    if (newChar.resources) {
      const resetRes = { ...newChar.resources };
      for (const id in resetRes) {
        if ((resetRes[id].recharge === 'long' || resetRes[id].recharge === 'short') && resetRes[id].used > 0) {
          recoveredItems.push(`${resetRes[id].name} fully restored`);
          resetRes[id] = { ...resetRes[id], used: 0 };
        }
      }
      newChar.resources = resetRes;
    }

    // 4. Reset ALL activeModifiers on long rest
    if (newChar.activeModifiers) {
      newChar.activeModifiers = newChar.activeModifiers.map(m => ({ ...m, isSpent: false }));
    }

    // 5. Deactivate ALL combat toggles
    if (newChar.activeCombatToggles) {
      newChar.activeCombatToggles = newChar.activeCombatToggles.map(t => {
        if (t.isActive) recoveredItems.push(`${t.name} faded`);
        return { ...t, isActive: false };
      });
    }

    // 6. Clear staged modifier and death saves
    if (newChar.stagedModifier) newChar.stagedModifier = null;
    if (newChar.deathSaves?.successes > 0 || newChar.deathSaves?.failures > 0) {
      recoveredItems.push('Death saves cleared');
      newChar.deathSaves = { successes: 0, failures: 0 };
    }

    // 7. Clear ALL non-permanent external effects
    if (newChar.externalEffects && newChar.externalEffects.length > 0) {
      const expiring = newChar.externalEffects.filter(e => e.duration !== 'permanent');
      if (expiring.length > 0) {
        for (const e of expiring) recoveredItems.push(`[Buff] ${e.name} faded`);
        newChar.externalEffects = newChar.externalEffects.filter(e => e.duration === 'permanent');
      }
    }

    // 7. Log the event with flavor text
    const summary = recoveredItems.length > 0
      ? recoveredItems.join('. ') + '.'
      : 'Already at full strength.';
    newChar.logbook = [
      {
        id: 'log_' + Date.now(),
        timestamp: Date.now(),
        type: 'rest',
        description: `🌙 Long Rest: ${char.name} settled into a deep slumber under the stars. ${summary}`,
        previousState: null
      },
      ...(newChar.logbook || [])
    ];

    set({ char: newChar });
  },

  addLog: (type, description) => {
    const { char } = get();
    if (!char) return;
    set({
      char: {
        ...char,
        logbook: [
          {
            id: 'log_' + Date.now() + Math.random().toString(36).substring(7),
            timestamp: Date.now(),
            type,
            description,
            previousState: null
          },
          ...Math.abs(char.logbook?.length ?? 0) ? char.logbook : []
        ]
      }
    });
  },

  completeLevelUp: (payload: any) => {
    const { char } = get();
    if (!char) return;

    let newChar = { ...char };
    
    newChar.level = payload.newLevel; // Total level
    
    // Multi-class tracking
    if (payload.targetClass) {
       newChar.classes = newChar.classes || { [newChar.class]: newChar.level - 1 };
       newChar.classes[payload.targetClass] = (newChar.classes[payload.targetClass] || 0) + 1;
    }

    const targetClassLevel = newChar.classes?.[payload.targetClass] || newChar.level;

    newChar.maxHp += payload.hpIncrease;
    newChar.currentHp += payload.hpIncrease;
    newChar.hitDiceTotal += 1;

    if (payload.subclassChoice && payload.targetClass) {
      newChar.subclasses = newChar.subclasses || {};
      newChar.subclasses[payload.targetClass] = payload.subclassChoice;
      if (payload.targetClass === newChar.class) {
        newChar.subclass = payload.subclassChoice;
      }
    }

    // Store subclass-specific choices (Totem animal, Draconic Ancestry, etc.)
    if (payload.subclassChoicesUpdate) {
      newChar.subclassChoices = { ...(newChar.subclassChoices || {}), ...payload.subclassChoicesUpdate };
    }

    if (payload.asiChoice) {
      newChar.stats = {
        str: newChar.stats.str + (payload.asiChoice.str || 0),
        dex: newChar.stats.dex + (payload.asiChoice.dex || 0),
        con: newChar.stats.con + (payload.asiChoice.con || 0),
        int: newChar.stats.int + (payload.asiChoice.int || 0),
        wis: newChar.stats.wis + (payload.asiChoice.wis || 0),
        cha: newChar.stats.cha + (payload.asiChoice.cha || 0),
      };
    }

    if (payload.featChoice) {
      newChar.feats = [...(newChar.feats || []), payload.featChoice];
      if (payload.featChoice.abilityIncrease) {
        for (const [key, val] of Object.entries(payload.featChoice.abilityIncrease)) {
          newChar.stats[key as keyof typeof newChar.stats] += (val as number);
        }
      }
    }

    if (payload.addedFeatures && payload.addedFeatures.length > 0) {
      newChar.features = [...(newChar.features || []), ...payload.addedFeatures];
    }

    // ══════════════════════════════════════════════
    // MODIFIER PROCESSING ENGINE
    // Walk all added features and apply their modifiers to the character sheet
    // ══════════════════════════════════════════════
    newChar.resources = { ...(newChar.resources || {}) };
    for (const feature of (payload.addedFeatures || [])) {
      if (!feature.modifiers) continue;
      for (const mod of feature.modifiers) {
        switch (mod.type) {
          case 'add_resource':
            newChar.resources[mod.resourceId] = {
              name: mod.name, max: mod.max, used: 0,
              recharge: mod.recharge, actionCost: mod.actionCost,
              description: mod.description, die: undefined
            };
            break;
          case 'scale_resource': {
            const existing = newChar.resources[mod.resourceId];
            if (existing) {
              // Resolve formula
              let newMax = existing.max;
              const profBonus = Math.ceil((newChar.level || 1) / 4) + 1;
              const calcMod = (s: number) => Math.floor(((s || 10) - 10) / 2);
              switch (mod.maxFormula) {
                case 'prof_bonus': newMax = profBonus; break;
                case 'class_level': newMax = targetClassLevel; break;
                case 'half_class_level': newMax = Math.floor(targetClassLevel / 2); break;
                case 'wis_mod': newMax = Math.max(1, calcMod(newChar.stats?.wis || 10)); break;
                case 'cha_mod': newMax = Math.max(1, calcMod(newChar.stats?.cha || 10)); break;
                case 'int_mod': newMax = Math.max(1, calcMod(newChar.stats?.int || 10)); break;
              }
              newChar.resources[mod.resourceId] = { ...existing, max: newMax };
            }
            break;
          }
          case 'upgrade_resource_die': {
            const ex = newChar.resources[mod.resourceId];
            if (ex) newChar.resources[mod.resourceId] = { ...ex, die: mod.newDie };
            break;
          }
          case 'grant_proficiency':
            if (mod.category === 'armor') {
              newChar.armorProficiencies = [...new Set([...(newChar.armorProficiencies || []), mod.value])];
            } else if (mod.category === 'weapon') {
              newChar.weaponProficiencies = [...new Set([...(newChar.weaponProficiencies || []), mod.value])];
            }
            break;
          case 'grant_spells_always_prepared':
            newChar.preparedSpells = [...new Set([...(newChar.preparedSpells || []), ...mod.spells])];
            newChar.knownSpells = [...new Set([...(newChar.knownSpells || []), ...mod.spells])];
            break;
          case 'grant_cantrip':
            newChar.cantrips = [...new Set([...(newChar.cantrips || []), mod.cantrip])];
            break;
          case 'grant_skill':
            if (mod.target !== '__choice__') {
              newChar.skills = [...new Set([...(newChar.skills || []), mod.target])];
            }
            break;
          case 'grant_extra_hp':
            // +1 HP per level-up (e.g. Draconic Resilience)
            // This is the ONLY place grant_extra_hp is processed (store-only, per Amendment 5)
            newChar.maxHp += 1;
            newChar.currentHp += 1;
            break;
          // ═══ DERIVED-STATE ONLY (resolved by resolveModifiers) ═══
          // extraAttacks and critRange are no longer baked into the store.
          // Legacy values on char.extraAttacks / char.critRange are kept for backward compat
          // but the CombatTab now reads from resolved.extraAttacks / resolved.critRange.
          case 'grant_extra_attack':
          case 'expand_crit_range':
            // Intentional no-op: these are now derived by resolveModifiers()
            break;
          case 'grant_third_caster': {
            newChar.spellcaster = true;
            newChar.spellcastingAbility = mod.spellList === 'Wizard' ? 'int' : 'cha';
            // Inject third-caster spell slots
            const tcSlots = THIRD_CASTER_SLOTS[targetClassLevel];
            if (tcSlots) {
              tcSlots.forEach((count: number, idx: number) => {
                const sLevel = idx + 1;
                const key = `spell_slot_${sLevel}`;
                newChar.resources[key] = {
                  name: `Level ${sLevel} Spell Slots`,
                  max: count, used: 0, recharge: 'long'
                };
              });
            }
            break;
          }
          case 'metamagic_option':
            // Store as an activeModifier entry so combat tab can render buttons
            newChar.activeModifiers = newChar.activeModifiers || [];
            if (!newChar.activeModifiers.find(m => m.modifierId === mod.optionId)) {
              newChar.activeModifiers.push({
                modifierId: mod.optionId, name: mod.name,
                isSpent: false, recharge: 'long'
              });
            }
            break;
          case 'maneuver_option':
            newChar.activeModifiers = newChar.activeModifiers || [];
            if (!newChar.activeModifiers.find(m => m.modifierId === mod.optionId)) {
              newChar.activeModifiers.push({
                modifierId: mod.optionId, name: mod.name,
                isSpent: false, recharge: 'short'
              });
            }
            break;
          // Passive / display-only types: no state mutation needed
          default: break;
        }
      }
    }

    // ══════════════════════════════════════════════
    // RESOURCE SCALING PASS
    // Check scaling tables and update/CREATE resource maxes
    // If a resource should exist according to scaling tables but doesn't, auto-create it
    // ══════════════════════════════════════════════
    const RESOURCE_META: Record<string, { name: string; recharge: 'short' | 'long' | 'none'; actionCost?: string; description?: string }> = {
      'rage': { name: 'Rage', recharge: 'long', actionCost: 'bonus_action', description: 'Enter a primal fury. Advantage on STR checks/saves, bonus melee damage, resistance to bludgeoning/piercing/slashing.' },
      'ki_points': { name: 'Ki Points', recharge: 'short', description: 'Channel mystical energy. Spend ki to fuel special actions.' },
      'sorcery_points': { name: 'Sorcery Points', recharge: 'long', description: 'Fuel your metamagic and convert to/from spell slots.' },
      'channel_divinity': { name: 'Channel Divinity', recharge: 'short', actionCost: 'action', description: 'Channel divine power for domain-specific effects.' },
      'action_surge': { name: 'Action Surge', recharge: 'short', actionCost: 'special', description: 'Take one additional action on your turn.' },
      'superiority_dice': { name: 'Superiority Dice', recharge: 'short', description: 'Fuel your combat maneuvers.' },
      'indomitable': { name: 'Indomitable', recharge: 'long', actionCost: 'special', description: 'Reroll a failed saving throw.' },
      'wild_shape': { name: 'Wild Shape', recharge: 'short', actionCost: 'action', description: 'Magically assume the shape of a beast.' },
      'lay_on_hands': { name: 'Lay on Hands', recharge: 'long', actionCost: 'action', description: 'Heal with a touch from a pool of HP.' },
      'bardic_inspiration': { name: 'Bardic Inspiration', recharge: 'long', actionCost: 'bonus_action', description: 'Grant a creature an Inspiration die to add to ability check, attack, or save.' },
      'second_wind': { name: 'Second Wind', recharge: 'short', actionCost: 'bonus_action', description: 'Regain 1d10 + fighter level HP.' },
    };
    const scalableResources = ['rage', 'ki_points', 'sorcery_points', 'channel_divinity',
      'action_surge', 'superiority_dice', 'indomitable', 'wild_shape',
      'lay_on_hands', 'bardic_inspiration', 'second_wind'];
    for (const resId of scalableResources) {
      const scaled = getResourceScaling(payload.targetClass, resId, targetClassLevel);
      if (scaled && scaled.max > 0) {
        const meta = RESOURCE_META[resId];
        if (newChar.resources[resId]) {
          // Update existing resource
          newChar.resources[resId] = {
            ...newChar.resources[resId],
            max: scaled.max,
            ...(scaled.die ? { die: scaled.die } : {})
          };
        } else if (meta) {
          // CREATE resource that should exist but wasn't created at character creation
          newChar.resources[resId] = {
            name: meta.name,
            max: scaled.max,
            used: 0,
            recharge: meta.recharge,
            actionCost: meta.actionCost as any,
            description: meta.description,
            ...(scaled.die ? { die: scaled.die } : {})
          };
        }
      }
    }

    // BG3 Unified Spell Slots Full Override
    if (payload.overrideSpellSlots) {
      newChar.resources = { ...newChar.resources, ...payload.overrideSpellSlots };
    }

    // Seamless Spells / Homebrew
    if (payload.learnedSpells) {
      newChar.knownSpells = Array.from(new Set([...(newChar.knownSpells || []), ...payload.learnedSpells]));
    }
    if (payload.addedCustomSpells && payload.addedCustomSpells.length > 0) {
      newChar.customSpells = [...(newChar.customSpells || []), ...payload.addedCustomSpells];
      newChar.knownSpells = Array.from(new Set([...(newChar.knownSpells || []), ...payload.addedCustomSpells.map((cs:any)=>cs.id)]));
    }

    newChar.logbook = [
      {
        id: 'log_' + Date.now(),
        timestamp: Date.now(),
        type: 'level_up',
        description: `Leveled up to ${newChar.level} (${payload.targetClass})! Max HP increased by ${payload.hpIncrease}.`,
        previousState: null
      },
      ...(newChar.logbook || [])
    ];

    set({ char: newChar });
  },

  activateOneShot: (modifierId: string, name: string, recharge: 'short' | 'long') => {
    const { char } = get();
    if (!char) return;
    const mods = char.activeModifiers || [];
    const existing = mods.find(m => m.modifierId === modifierId);
    if (existing) {
      set({
        char: {
          ...char,
          activeModifiers: mods.map(m =>
            m.modifierId === modifierId ? { ...m, isSpent: true } : m
          )
        }
      });
    }
  },

  resetModifiers: (rechargeType: 'short' | 'long') => {
    const { char } = get();
    if (!char || !char.activeModifiers) return;
    set({
      char: {
        ...char,
        activeModifiers: char.activeModifiers.map(m =>
          (rechargeType === 'long' || m.recharge === rechargeType)
            ? { ...m, isSpent: false } : m
        )
      }
    });
  },

  // ══════════════════════════════════════════════
  // ACTIVE COMBAT TOGGLES (Rage, Bladesong, etc.)
  // Flips isActive and deducts 1 use from the associated resource.
  // ══════════════════════════════════════════════
  toggleCombatState: (toggleId: string) => {
    const { char } = get();
    if (!char) return;

    const toggles = char.activeCombatToggles || [];
    const toggle = toggles.find(t => t.id === toggleId);
    if (!toggle) return;

    const newActive = !toggle.isActive;
    let newResources = { ...char.resources };

    // Deduct resource on activation (not on deactivation)
    if (newActive && toggle.resourceId && newResources[toggle.resourceId]) {
      const res = newResources[toggle.resourceId];
      if (res.used >= res.max) return; // No charges remaining
      newResources[toggle.resourceId] = { ...res, used: res.used + 1 };
    }

    set({
      char: {
        ...char,
        resources: newResources,
        activeCombatToggles: toggles.map(t =>
          t.id === toggleId ? { ...t, isActive: newActive } : t
        )
      }
    });
  },

  deactivateAllToggles: () => {
    const { char } = get();
    if (!char || !char.activeCombatToggles) return;
    set({
      char: {
        ...char,
        activeCombatToggles: char.activeCombatToggles.map(t => ({ ...t, isActive: false }))
      }
    });
  },

  // ══════════════════════════════════════════════
  // STAGED MODIFIER (Metamagic / Maneuver two-step)
  // Stage a modifier to be applied to the next qualifying spell/attack.
  // ══════════════════════════════════════════════
  stageModifier: (modifier: StagedModifier) => {
    const { char } = get();
    if (!char) return;
    set({ char: { ...char, stagedModifier: modifier } });
  },

  clearStagedModifier: () => {
    const { char } = get();
    if (!char) return;
    set({ char: { ...char, stagedModifier: null } });
  },

  // ══════════════════════════════════════════════
  // UNIVERSAL HOMEBREW ENGINE CRUD
  // ══════════════════════════════════════════════

  addHomebrewItem: (item: Partial<CustomItem>) => {
    const { char } = get();
    if (!char) return;
    const hb: HomebrewRegistry = char.homebrew || { spells: [], items: [], features: [], subclasses: [] };
    const newItem: CustomItem = {
      id: item.id || `hb_item_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      name: item.name || 'Unnamed Item',
      qty: item.qty || 1,
      weight: item.weight || 0,
      attuned: item.attuned || false,
      description: item.description || '',
      type: item.type || 'gear',
      slot: item.slot,
      damage: item.damage,
      damageType: item.damageType,
      properties: item.properties,
      weaponCategory: item.weaponCategory,
      armorClass: item.armorClass,
      armorCategory: item.armorCategory,
      actionCost: item.actionCost,
      modifiers: item.modifiers,
      rarity: item.rarity,
      requiresAttunement: item.requiresAttunement,
      isHomebrew: true,
      createdAt: Date.now(),
    };
    // Also push into inventory so it appears in the backpack
    set({
      char: {
        ...char,
        homebrew: { ...hb, items: [...hb.items, newItem] },
        inventory: [...(char.inventory || []), newItem],
      }
    });
  },

  addHomebrewSpell: (spell: Partial<CustomSpell>) => {
    const { char } = get();
    if (!char) return;
    const hb: HomebrewRegistry = char.homebrew || { spells: [], items: [], features: [], subclasses: [] };
    const newSpell: CustomSpell = {
      id: spell.id || `hb_spell_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      name: spell.name || 'Unnamed Spell',
      level: spell.level || 0,
      school: spell.school || 'Evocation',
      castingTime: spell.castingTime || '1 action',
      range: spell.range || 'Self',
      components: spell.components || 'V, S',
      duration: spell.duration || 'Instantaneous',
      description: spell.description || '',
      damage: spell.damage,
      damageType: spell.damageType,
      actionCost: spell.actionCost || 'action',
      classes: spell.classes || [char.class],
      modifiers: spell.modifiers,
      isHomebrew: true,
      createdAt: Date.now(),
    };
    // Also add to knownSpells and customSpells so it shows in the Grimoire
    set({
      char: {
        ...char,
        homebrew: { ...hb, spells: [...hb.spells, newSpell] },
        customSpells: [...(char.customSpells || []), newSpell],
        knownSpells: [...(char.knownSpells || []), newSpell.id],
      }
    });
  },

  addHomebrewFeature: (feature: Partial<CustomFeature>) => {
    const { char } = get();
    if (!char) return;
    const hb: HomebrewRegistry = char.homebrew || { spells: [], items: [], features: [], subclasses: [] };
    const newFeature: CustomFeature = {
      id: feature.id || `hb_feat_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      name: feature.name || 'Unnamed Feature',
      description: feature.description || '',
      level: feature.level || char.level,
      source: feature.source || 'Homebrew',
      modifiers: feature.modifiers,
      isActive: feature.isActive !== undefined ? feature.isActive : true,
      isHomebrew: true,
      createdAt: Date.now(),
    };
    set({
      char: {
        ...char,
        homebrew: { ...hb, features: [...hb.features, newFeature] },
      }
    });
  },

  removeHomebrewItem: (id: string) => {
    const { char } = get();
    if (!char) return;
    const hb = char.homebrew || { spells: [], items: [], features: [], subclasses: [] };
    set({
      char: {
        ...char,
        homebrew: { ...hb, items: hb.items.filter(i => i.id !== id) },
        inventory: (char.inventory || []).filter(i => i.id !== id),
      }
    });
  },

  removeHomebrewSpell: (id: string) => {
    const { char } = get();
    if (!char) return;
    const hb = char.homebrew || { spells: [], items: [], features: [], subclasses: [] };
    set({
      char: {
        ...char,
        homebrew: { ...hb, spells: hb.spells.filter(s => s.id !== id) },
        customSpells: (char.customSpells || []).filter(s => s.id !== id),
        knownSpells: (char.knownSpells || []).filter(s => s !== id),
        preparedSpells: (char.preparedSpells || []).filter(s => s !== id),
      }
    });
  },

  removeHomebrewFeature: (id: string) => {
    const { char } = get();
    if (!char) return;
    const hb = char.homebrew || { spells: [], items: [], features: [], subclasses: [] };
    set({
      char: {
        ...char,
        homebrew: { ...hb, features: hb.features.filter(f => f.id !== id) },
      }
    });
  },

  // ═══════════════════════════════════════════════════════════════
  //  EXTERNAL EFFECTS — Phase 4: Floating Modifiers
  // ═══════════════════════════════════════════════════════════════

  addExternalEffect: (effect: ExternalEffect) => {
    const { char } = get();
    if (!char) return;
    set({
      char: {
        ...char,
        externalEffects: [...(char.externalEffects || []), effect],
      }
    });
  },

  removeExternalEffect: (id: string) => {
    const { char } = get();
    if (!char) return;
    set({
      char: {
        ...char,
        externalEffects: (char.externalEffects || []).filter(e => e.id !== id),
      }
    });
  },
}));

