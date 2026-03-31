import { SpellData } from '../types';

export const SPELL_DATABASE: Record<string, SpellData> = {
  // Cantrips (Level 0)
  "spell_firebolt_00": {
    id: "spell_firebolt_00", name: "Fire Bolt", level: 0, school: "Evocation",
    castingTime: "1 action", range: "120 feet", components: "V, S", duration: "Instantaneous",
    description: "You hurl a mote of fire at a creature or object within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 fire damage.",
    damage: "1d10 Fire", actionCost: "action", classes: ['Sorcerer', 'Wizard', 'Artificer']
  },
  "spell_eldritchblast_00": {
    id: "spell_eldritchblast_00", name: "Eldritch Blast", level: 0, school: "Evocation",
    castingTime: "1 action", range: "120 feet", components: "V, S", duration: "Instantaneous",
    description: "A beam of crackling energy streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 force damage.",
    damage: "1d10 Force", actionCost: "action", classes: ['Warlock']
  },
  "spell_viciousmockery_00": {
    id: "spell_viciousmockery_00", name: "Vicious Mockery", level: 0, school: "Enchantment",
    castingTime: "1 action", range: "60 feet", components: "V", duration: "Instantaneous",
    description: "You unleash a string of insults laced with subtle enchantments at a creature you can see. If it fails a WIS save, it takes 1d4 psychic damage and has disadvantage on its next attack roll.",
    damage: "1d4 Psychic", actionCost: "action", classes: ['Bard']
  },
  "spell_magehand_00": {
    id: "spell_magehand_00", name: "Mage Hand", level: 0, school: "Conjuration",
    castingTime: "1 action", range: "30 feet", components: "V, S", duration: "1 minute",
    description: "A spectral, floating hand appears at a point you choose. You can use your action to control the hand to manipulate an object, open an unlocked door, or stow/retrieve an item.",
    actionCost: "action", classes: ['Bard', 'Sorcerer', 'Warlock', 'Wizard', 'Artificer']
  },
  "spell_guidance_00": {
    id: "spell_guidance_00", name: "Guidance", level: 0, school: "Divination",
    castingTime: "1 action", range: "Touch", components: "V, S", duration: "Concentration, up to 1 minute",
    description: "You touch one willing creature. Once before the spell ends, the target can roll a d4 and add the number rolled to one ability check of its choice.",
    actionCost: "action", classes: ['Cleric', 'Druid', 'Artificer']
  },
  "spell_sacredflame_00": {
    id: "spell_sacredflame_00", name: "Sacred Flame", level: 0, school: "Evocation",
    castingTime: "1 action", range: "60 feet", components: "V, S", duration: "Instantaneous",
    description: "Flame-like radiance descends on a creature that you can see. It must succeed on a DEX save or take 1d8 radiant damage.",
    damage: "1d8 Radiant", actionCost: "action", classes: ['Cleric']
  },

  // Level 1
  "spell_shield_01": {
    id: "spell_shield_01", name: "Shield", level: 1, school: "Abjuration",
    castingTime: "1 reaction", range: "Self", components: "V, S", duration: "1 round",
    description: "An invisible barrier of magical force appears and protects you. Until the start of your next turn, you gain +5 AC.",
    actionCost: "reaction", classes: ['Sorcerer', 'Wizard']
  },
  "spell_magicmissile_01": {
    id: "spell_magicmissile_01", name: "Magic Missile", level: 1, school: "Evocation",
    castingTime: "1 action", range: "120 feet", components: "V, S", duration: "Instantaneous",
    description: "You create three glowing darts of magical force. Each dart hits a creature and deals 1d4+1 force damage. The darts all strike simultaneously.",
    damage: "1d4+1 Force (x3)", actionCost: "action", classes: ['Sorcerer', 'Wizard']
  },
  "spell_curewounds_01": {
    id: "spell_curewounds_01", name: "Cure Wounds", level: 1, school: "Evocation",
    castingTime: "1 action", range: "Touch", components: "V, S", duration: "Instantaneous",
    description: "A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier.",
    damage: "1d8 + Mod Healing", actionCost: "action", classes: ['Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger', 'Artificer']
  },
  "spell_healingword_01": {
    id: "spell_healingword_01", name: "Healing Word", level: 1, school: "Evocation",
    castingTime: "1 bonus action", range: "60 feet", components: "V", duration: "Instantaneous",
    description: "A creature of your choice that you can see within range regains hit points equal to 1d4 + your spellcasting ability modifier.",
    damage: "1d4 + Mod Healing", actionCost: "bonus_action", classes: ['Bard', 'Cleric', 'Druid']
  },
  "spell_guidingbolt_01": {
    id: "spell_guidingbolt_01", name: "Guiding Bolt", level: 1, school: "Evocation",
    castingTime: "1 action", range: "120 feet", components: "V, S", duration: "1 round",
    description: "A flash of light streaks toward a creature of your choice. Make a ranged spell attack. On a hit, it takes 4d6 radiant damage, and the next attack roll made against it has advantage.",
    damage: "4d6 Radiant", actionCost: "action", classes: ['Cleric']
  },
  "spell_magearmor_01": {
    id: "spell_magearmor_01", name: "Mage Armor", level: 1, school: "Abjuration",
    castingTime: "1 action", range: "Touch", components: "V, S, M", duration: "8 hours",
    description: "You touch a willing creature who isn't wearing armor, and a protective magical force surrounds it until the spell ends. The target's base AC becomes 13 + its Dexterity modifier.",
    actionCost: "action", classes: ['Sorcerer', 'Wizard']
  },
  "spell_hex_01": {
    id: "spell_hex_01", name: "Hex", level: 1, school: "Enchantment",
    castingTime: "1 bonus action", range: "90 feet", components: "V, S, M", duration: "1 hour, Concentration",
    description: "You place a curse on a creature. You deal an extra 1d6 necrotic damage to the target whenever you hit it with an attack. Choose one ability; the target has disadvantage on checks of that ability.",
    damage: "1d6 Necrotic", actionCost: "bonus_action", classes: ['Warlock']
  },
  "spell_bless_01": {
    id: "spell_bless_01", name: "Bless", level: 1, school: "Enchantment",
    castingTime: "1 action", range: "30 feet", components: "V, S, M", duration: "1 minute, Concentration",
    description: "You bless up to three creatures of your choice within range. Whenever a target makes an attack roll or a saving throw before the spell ends, the target can roll a d4 and add the number rolled to the attack roll or saving throw.",
    actionCost: "action", classes: ['Cleric', 'Paladin']
  },

  // Level 2
  "spell_mistystep_02": {
    id: "spell_mistystep_02", name: "Misty Step", level: 2, school: "Conjuration",
    castingTime: "1 bonus action", range: "Self", components: "V", duration: "Instantaneous",
    description: "Briefly surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space that you can see.",
    actionCost: "bonus_action", classes: ['Sorcerer', 'Warlock', 'Wizard']
  },
  "spell_invisibility_02": {
    id: "spell_invisibility_02", name: "Invisibility", level: 2, school: "Illusion",
    castingTime: "1 action", range: "Touch", components: "V, S, M", duration: "1 hour, Concentration",
    description: "A creature you touch becomes invisible until the spell ends. The spell ends for a target that attacks or casts a spell.",
    actionCost: "action", classes: ['Bard', 'Sorcerer', 'Warlock', 'Wizard', 'Artificer']
  },
  "spell_scorchingray_02": {
    id: "spell_scorchingray_02", name: "Scorching Ray", level: 2, school: "Evocation",
    castingTime: "1 action", range: "120 feet", components: "V, S", duration: "Instantaneous",
    description: "You create three rays of fire and hurl them at targets within range. Make a ranged spell attack for each ray. On a hit, the target takes 2d6 fire damage.",
    damage: "2d6 Fire (x3)", actionCost: "action", classes: ['Sorcerer', 'Wizard']
  },
  "spell_spiritualweapon_02": {
    id: "spell_spiritualweapon_02", name: "Spiritual Weapon", level: 2, school: "Evocation",
    castingTime: "1 bonus action", range: "60 feet", components: "V, S", duration: "1 minute",
    description: "You create a floating, spectral weapon within range. Melee spell attack on cast, and as a bonus action on subsequent turns, deals 1d8 + Mod force damage.",
    damage: "1d8 + Mod Force", actionCost: "bonus_action", classes: ['Cleric']
  },
  "spell_holdperson_02": {
    id: "spell_holdperson_02", name: "Hold Person", level: 2, school: "Enchantment",
    castingTime: "1 action", range: "60 feet", components: "V, S, M", duration: "1 minute, Concentration",
    description: "Choose a humanoid that you can see within range. The target must succeed on a WIS save or be paralyzed for the duration.",
    actionCost: "action", classes: ['Bard', 'Cleric', 'Druid', 'Sorcerer', 'Warlock', 'Wizard']
  },
  "spell_shatter_02": {
    id: "spell_shatter_02", name: "Shatter", level: 2, school: "Evocation",
    castingTime: "1 action", range: "60 feet", components: "V, S, M", duration: "Instantaneous",
    description: "A sudden loud ringing noise, painfully intense, erupts from a point of your choice. Creatures in a 10-foot radius sphere take 3d8 thunder damage on a failed CON save, or half on a success.",
    damage: "3d8 Thunder", actionCost: "action", classes: ['Bard', 'Sorcerer', 'Warlock', 'Wizard']
  },

  // Level 3
  "spell_fireball_03": {
    id: "spell_fireball_03", name: "Fireball", level: 3, school: "Evocation",
    castingTime: "1 action", range: "150 feet", components: "V, S, M", duration: "Instantaneous",
    description: "A bright streak flashes from your finger and erupts. Each creature in a 20-foot-radius sphere must make a DEX save, taking 8d6 fire damage on a failure, or half on a success.",
    damage: "8d6 Fire", actionCost: "action", classes: ['Sorcerer', 'Wizard']
  },
  "spell_counterspell_03": {
    id: "spell_counterspell_03", name: "Counterspell", level: 3, school: "Abjuration",
    castingTime: "1 reaction", range: "60 feet", components: "S", duration: "Instantaneous",
    description: "You attempt to interrupt a creature in the process of casting a spell. If the creature is casting a spell of 3rd level or lower, its spell fails and has no effect.",
    actionCost: "reaction", classes: ['Sorcerer', 'Warlock', 'Wizard']
  },
  "spell_haste_03": {
    id: "spell_haste_03", name: "Haste", level: 3, school: "Transmutation",
    castingTime: "1 action", range: "30 feet", components: "V, S, M", duration: "1 minute, Concentration",
    description: "Choose a willing creature. Its speed defaults, it gains +2 AC, advantage on DEX saves, and an additional action to Attack (one weapon attack only), Dash, Disengage, Hide, or Use an Object.",
    actionCost: "action", classes: ['Sorcerer', 'Wizard', 'Artificer']
  },
  "spell_fly_03": {
    id: "spell_fly_03", name: "Fly", level: 3, school: "Transmutation",
    castingTime: "1 action", range: "Touch", components: "V, S, M", duration: "10 minutes, Concentration",
    description: "You touch a willing creature. The target gains a flying speed of 60 feet for the duration.",
    actionCost: "action", classes: ['Sorcerer', 'Warlock', 'Wizard', 'Artificer']
  },
  "spell_spiritguardians_03": {
    id: "spell_spiritguardians_03", name: "Spirit Guardians", level: 3, school: "Conjuration",
    castingTime: "1 action", range: "Self (15-foot radius)", components: "V, S, M", duration: "10 minutes, Concentration",
    description: "Spirits flit around you 15 ft out. Enemies' speed is halved, and they take 3d8 radiant or necrotic damage on a failed WIS save when entering or starting their turn in the area.",
    damage: "3d8 Radiant/Necrotic", actionCost: "action", classes: ['Cleric']
  },
  "spell_revivify_03": {
    id: "spell_revivify_03", name: "Revivify", level: 3, school: "Necromancy",
    castingTime: "1 action", range: "Touch", components: "V, S, M (diamonds worth 300 gp)", duration: "Instantaneous",
    description: "You touch a creature that has died within the last minute. That creature returns to life with 1 hit point.",
    actionCost: "action", classes: ['Artificer', 'Cleric', 'Paladin', 'Ranger']
  },

  // Level 4
  "spell_dimensiondoor_04": {
    id: "spell_dimensiondoor_04", name: "Dimension Door", level: 4, school: "Conjuration",
    castingTime: "1 action", range: "500 feet", components: "V", duration: "Instantaneous",
    description: "You teleport yourself and one willing creature of your size or smaller to any location within range that you can visualize.",
    actionCost: "action", classes: ['Bard', 'Sorcerer', 'Warlock', 'Wizard']
  },
  "spell_polymorph_04": {
    id: "spell_polymorph_04", name: "Polymorph", level: 4, school: "Transmutation",
    castingTime: "1 action", range: "60 feet", components: "V, S, M", duration: "1 hour, Concentration",
    description: "This spell transforms a creature that you can see into a new form (Beast of CR lower or equal to target's level). Target must succeed on a WIS save if unwilling.",
    actionCost: "action", classes: ['Bard', 'Druid', 'Sorcerer', 'Wizard']
  },
  "spell_banishment_04": {
    id: "spell_banishment_04", name: "Banishment", level: 4, school: "Abjuration",
    castingTime: "1 action", range: "60 feet", components: "V, S, M", duration: "1 minute, Concentration",
    description: "You attempt to send one creature you can see to another plane of existence. Target must succeed on a CHA save or be banished.",
    actionCost: "action", classes: ['Cleric', 'Paladin', 'Sorcerer', 'Warlock', 'Wizard']
  },
  "spell_walloffire_04": {
    id: "spell_walloffire_04", name: "Wall of Fire", level: 4, school: "Evocation",
    castingTime: "1 action", range: "120 feet", components: "V, S, M", duration: "1 minute, Concentration",
    description: "You create a wall of fire on a solid surface. Creatures ending a turn in its heat take 5d8 fire damage unless they succeed on a DEX save.",
    damage: "5d8 Fire", actionCost: "action", classes: ['Druid', 'Sorcerer', 'Wizard']
  },

  // Level 5
  "spell_coneofcold_05": {
    id: "spell_coneofcold_05", name: "Cone of Cold", level: 5, school: "Evocation",
    castingTime: "1 action", range: "Self (60-foot cone)", components: "V, S, M", duration: "Instantaneous",
    description: "A blast of cold air erupts from your hands. Each creature in a 60-foot cone must make a CON saving throw, taking 8d8 cold damage on failure, or half on success.",
    damage: "8d8 Cold", actionCost: "action", classes: ['Sorcerer', 'Wizard']
  },
  "spell_masscurewounds_05": {
    id: "spell_masscurewounds_05", name: "Mass Cure Wounds", level: 5, school: "Evocation",
    castingTime: "1 action", range: "60 feet", components: "V, S", duration: "Instantaneous",
    description: "A wave of healing energy washes out from a point of your choice. Up to six creatures in a 30-foot-radius sphere regain 3d8 + your spellcasting ability modifier HP.",
    damage: "3d8 + Mod Healing", actionCost: "action", classes: ['Bard', 'Cleric', 'Druid']
  },
  "spell_greaterrestoration_05": {
    id: "spell_greaterrestoration_05", name: "Greater Restoration", level: 5, school: "Abjuration",
    castingTime: "1 action", range: "Touch", components: "V, S, M (diamond dust worth 100 gp)", duration: "Instantaneous",
    description: "You imbue a creature you touch with positive energy to undo a debilitating effect. You can reduce exhaustion by one level, end one charm/petrification, or restore one cursed trait.",
    actionCost: "action", classes: ['Bard', 'Cleric', 'Druid', 'Artificer']
  },
  "spell_wallofforce_05": {
    id: "spell_wallofforce_05", name: "Wall of Force", level: 5, school: "Evocation",
    castingTime: "1 action", range: "120 feet", components: "V, S, M", duration: "10 minutes, Concentration",
    description: "An invisible wall of force springs into existence. Nothing can physically pass through it, and it is immune to all damage. It can only be destroyed by Disintegrate.",
    actionCost: "action", classes: ['Wizard']
  }
};
