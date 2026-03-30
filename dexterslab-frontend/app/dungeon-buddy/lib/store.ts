import { create } from 'zustand';
import { LiveCharacter, EquipSlot, InventoryItem } from './types';

interface CharacterState {
  char: LiveCharacter | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  
  // Basic lifecycle
  setChar: (char: LiveCharacter) => void;
  setSaveStatus: (status: CharacterState['saveStatus']) => void;
  updateField: (field: keyof LiveCharacter, value: any) => void;
  updateNestedField: (parentKey: 'stats' | 'deathSaves', childKey: string, value: any) => void;
  
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
  shortRest: (hitDiceRoll: number) => void;
  longRest: () => void;
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  char: null,
  saveStatus: 'idle',

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

  shortRest: (hitDiceRoll: number) => {
    const { char } = get();
    if (!char) return;

    let newChar = { ...char };

    // Spend a Hit Die and Heal if requested
    if (hitDiceRoll > 0 && newChar.hitDiceUsed < newChar.hitDiceTotal) {
      newChar.hitDiceUsed += 1;
      newChar.currentHp = Math.min(newChar.maxHp, newChar.currentHp + hitDiceRoll);
    }

    // Reset Short Rest features
    if (newChar.resources) {
      const resetRes = { ...newChar.resources };
      for (const id in resetRes) {
        if (resetRes[id].recharge === 'short') {
          resetRes[id] = { ...resetRes[id], used: 0 };
        }
      }
      newChar.resources = resetRes;
    }

    // Log the event
    newChar.logbook = [
      {
        id: 'log_' + Date.now(),
        timestamp: Date.now(),
        type: 'rest',
        description: `Took a Short Rest. Healed for ${hitDiceRoll} HP. Spent 1 Hit Die.`,
        previousState: null
      },
      ...Math.abs(newChar.logbook?.length ?? 0) ? newChar.logbook : []
    ];

    set({ char: newChar });
  },

  longRest: () => {
    const { char } = get();
    if (!char) return;

    let newChar = { ...char };

    // Restore HP
    newChar.currentHp = newChar.maxHp;
    newChar.tempHp = 0;

    // Restore Half Hit Dice
    const halfDice = Math.max(1, Math.floor(newChar.hitDiceTotal / 2));
    newChar.hitDiceUsed = Math.max(0, newChar.hitDiceUsed - halfDice);

    // Reset all non-none resources
    if (newChar.resources) {
      const resetRes = { ...newChar.resources };
      for (const id in resetRes) {
        if (resetRes[id].recharge === 'long' || resetRes[id].recharge === 'short') {
          resetRes[id] = { ...resetRes[id], used: 0 };
        }
      }
      newChar.resources = resetRes;
    }

    // Clear death saves
    newChar.deathSaves = { successes: 0, failures: 0 };

    newChar.logbook = [
      {
        id: 'log_' + Date.now(),
        timestamp: Date.now(),
        type: 'rest',
        description: `Took a Long Rest. Restored all HP and spell slots.`,
        previousState: null
      },
      ...Math.abs(newChar.logbook?.length ?? 0) ? newChar.logbook : []
    ];

    set({ char: newChar });
  }
}));
