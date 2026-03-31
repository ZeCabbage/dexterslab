export interface EquipmentChoice {
  id: string;
  name: string;
  options: string[][]; // Array of permutations, where permutation is an array of Item IDs
}

export const STARTING_EQUIPMENT_DB: Record<string, EquipmentChoice[]> = {
  barbarian: [
    {
      id: "barbarian_weapon_1",
      name: "Primary Martial Weapon",
      options: [ ["item_greataxe"], ["item_greatsword"] ]
    },
    {
      id: "barbarian_weapon_2",
      name: "Secondary Weapons",
      options: [ ["item_handaxe", "item_handaxe"], ["item_mace"] ]
    },
    {
      id: "barbarian_base",
      name: "Class Basics",
      options: [ ["item_explorers_pack", "item_javelin_4"] ]
    }
  ],
  bard: [
    {
      id: "bard_weapon",
      name: "Primary Weapon",
      options: [ ["item_rapier"], ["item_longsword"], ["item_dagger"] ]
    },
    {
      id: "bard_pack",
      name: "Adventuring Pack",
      options: [ ["item_diplomats_pack"], ["item_entertainers_pack"] ]
    },
    {
      id: "bard_instrument",
      name: "Musical Instrument",
      options: [ ["item_lute"], ["item_flute"] ]
    },
    {
      id: "bard_base",
      name: "Class Basics",
      options: [ ["item_leather", "item_dagger"] ]
    }
  ],
  cleric: [
    {
      id: "cleric_weapon",
      name: "Primary Weapon",
      options: [ ["item_mace"], ["item_warhammer"] ]
    },
    {
      id: "cleric_armor",
      name: "Armor",
      options: [ ["item_scalemail"], ["item_leather"], ["item_chainmail"] ]
    },
    {
      id: "cleric_secondary",
      name: "Ranged or Simple Weapon",
      options: [ ["item_light_crossbow", "item_crossbow_bolts_20"], ["item_spear"] ]
    },
    {
      id: "cleric_pack",
      name: "Adventuring Pack",
      options: [ ["item_priests_pack"], ["item_explorers_pack"] ]
    },
    {
      id: "cleric_base",
      name: "Class Basics",
      options: [ ["item_shield", "item_holy_symbol"] ]
    }
  ],
  druid: [
    {
      id: "druid_offhand",
      name: "Shield or Simple Weapon",
      options: [ ["item_wooden_shield"], ["item_quarterstaff"] ]
    },
    {
      id: "druid_mainhand",
      name: "Melee Weapon",
      options: [ ["item_scimitar"], ["item_dagger"] ]
    },
    {
      id: "druid_base",
      name: "Class Basics",
      options: [ ["item_leather", "item_explorers_pack", "item_druidic_focus"] ]
    }
  ],
  fighter: [
    { 
      id: "fighter_armor", 
      name: "Armor & Ranged setup",
      options: [ 
        ["item_chainmail"], 
        ["item_leather", "item_longbow", "item_arrows_20"] 
      ] 
    },
    { 
      id: "fighter_weapons_1", 
      name: "Primary Combat Style",
      options: [ 
        ["item_longsword", "item_shield"], 
        ["item_longsword", "item_shortsword"] 
      ] 
    },
    { 
      id: "fighter_weapons_2", 
      name: "Secondary Weapons",
      options: [ 
        ["item_light_crossbow", "item_crossbow_bolts_20"], 
        ["item_handaxe", "item_handaxe"] 
      ] 
    },
    {
      id: "fighter_pack",
      name: "Adventuring Pack",
      options: [ ["item_dungeoneers_pack"], ["item_explorers_pack"] ]
    }
  ],
  monk: [
    {
      id: "monk_weapon",
      name: "Primary Weapon",
      options: [ ["item_shortsword"], ["item_quarterstaff"] ]
    },
    {
      id: "monk_pack",
      name: "Adventuring Pack",
      options: [ ["item_dungeoneers_pack"], ["item_explorers_pack"] ]
    },
    {
      id: "monk_base",
      name: "Class Basics",
      options: [ ["item_dart_10"] ]
    }
  ],
  paladin: [
    {
      id: "paladin_weapon_1",
      name: "Primary Combat Style",
      options: [ ["item_longsword", "item_shield"], ["item_longsword", "item_shortsword"] ]
    },
    {
      id: "paladin_weapon_2",
      name: "Secondary Weapons",
      options: [ ["item_javelin_5"], ["item_mace"] ]
    },
    {
      id: "paladin_pack",
      name: "Adventuring Pack",
      options: [ ["item_priests_pack"], ["item_explorers_pack"] ]
    },
    {
      id: "paladin_base",
      name: "Class Basics",
      options: [ ["item_chainmail", "item_holy_symbol"] ]
    }
  ],
  ranger: [
    {
      id: "ranger_armor",
      name: "Armor",
      options: [ ["item_scalemail"], ["item_leather"] ]
    },
    {
      id: "ranger_weapons",
      name: "Melee Weapons",
      options: [ ["item_shortsword", "item_shortsword"], ["item_handaxe", "item_handaxe"] ]
    },
    {
      id: "ranger_pack",
      name: "Adventuring Pack",
      options: [ ["item_dungeoneers_pack"], ["item_explorers_pack"] ]
    },
    {
      id: "ranger_base",
      name: "Class Basics",
      options: [ ["item_longbow", "item_arrows_20"] ]
    }
  ],
  rogue: [
    {
      id: "rogue_weapon_1",
      name: "Primary Weapon",
      options: [ ["item_rapier"], ["item_shortsword"] ]
    },
    {
      id: "rogue_weapon_2",
      name: "Secondary Weapon",
      options: [ ["item_shortbow", "item_arrows_20"], ["item_shortsword"] ]
    },
    {
      id: "rogue_pack",
      name: "Adventuring Pack",
      options: [ ["item_burglars_pack"], ["item_dungeoneers_pack"], ["item_explorers_pack"] ]
    },
    {
      id: "rogue_base",
      name: "Class Basics",
      options: [ ["item_leather", "item_dagger", "item_dagger", "item_thieves_tools"] ]
    }
  ],
  sorcerer: [
    {
      id: "sorcerer_weapon",
      name: "Weapon",
      options: [ ["item_light_crossbow", "item_crossbow_bolts_20"], ["item_dagger"] ]
    },
    {
      id: "sorcerer_focus",
      name: "Spellcasting Focus",
      options: [ ["item_component_pouch"], ["item_arcane_focus"] ]
    },
    {
      id: "sorcerer_pack",
      name: "Adventuring Pack",
      options: [ ["item_dungeoneers_pack"], ["item_explorers_pack"] ]
    },
    {
      id: "sorcerer_base",
      name: "Class Basics",
      options: [ ["item_dagger", "item_dagger"] ]
    }
  ],
  warlock: [
    {
      id: "warlock_weapon",
      name: "Ranged Weapon",
      options: [ ["item_light_crossbow", "item_crossbow_bolts_20"], ["item_dagger"] ]
    },
    {
      id: "warlock_focus",
      name: "Spellcasting Focus",
      options: [ ["item_component_pouch"], ["item_arcane_focus"] ]
    },
    {
      id: "warlock_pack",
      name: "Adventuring Pack",
      options: [ ["item_scholars_pack"], ["item_dungeoneers_pack"] ]
    },
    {
      id: "warlock_base",
      name: "Class Basics",
      options: [ ["item_leather", "item_quarterstaff", "item_dagger", "item_dagger"] ]
    }
  ],
  wizard: [
    {
      id: "wizard_weapon",
      name: "Weapon",
      options: [ ["item_quarterstaff"], ["item_dagger"] ]
    },
    {
      id: "wizard_focus",
      name: "Spellcasting Focus",
      options: [ ["item_component_pouch"], ["item_arcane_focus"] ]
    },
    {
      id: "wizard_pack",
      name: "Adventuring Pack",
      options: [ ["item_scholars_pack"], ["item_explorers_pack"] ]
    },
    {
      id: "wizard_spellbook",
      name: "Class Basics",
      options: [ ["item_spellbook"] ]
    }
  ]
};
