const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../dexterslab-frontend/app/dungeon-buddy/data/srd.ts');
let srd = fs.readFileSync(targetFile, 'utf8');

const FULL_SUBCLASSES = {
  Barbarian: [
    { id: 'path_of_the_ancestral_guardian', name: 'Path of the Ancestral Guardian', description: 'Draw on the spirits of your ancestors to protect your allies.' },
    { id: 'path_of_the_battlerager', name: 'Path of the Battlerager', description: 'Dwarven path focusing on spiked armor and relentless assault.' },
    { id: 'path_of_the_beast', name: 'Path of the Beast', description: 'Manifest a bestial spark and natural weapons when you rage.' },
    { id: 'path_of_the_berserker', name: 'Path of the Berserker', description: 'A glorious path of untrammeled fury and frenzied attacks.' },
    { id: 'path_of_the_giant', name: 'Path of the Giant', description: 'Draw power from giants, growing in size and throwing enemies.' },
    { id: 'path_of_the_storm_herald', name: 'Path of the Storm Herald', description: 'Emanate a stormy aura of sea, desert, or tundra.' },
    { id: 'path_of_the_totem_warrior', name: 'Path of the Totem Warrior', description: 'Accept a spirit animal as a guide and protector.' },
    { id: 'path_of_wild_magic', name: 'Path of Wild Magic', description: 'Rage triggers chaotic surges of wild magic.' },
    { id: 'path_of_the_zealot', name: 'Path of the Zealot', description: 'Channel divine power to destroy enemies, shrugging off death.' }
  ],
  Bard: [
    { id: 'college_of_creation', name: 'College of Creation', description: 'Sing the song of creation to manipulate matter and animate objects.' },
    { id: 'college_of_eloquence', name: 'College of Eloquence', description: 'Master the art of persuasion and unsettled debate.' },
    { id: 'college_of_glamour', name: 'College of Glamour', description: 'Weave the magic of the Feywild to charm and command.' },
    { id: 'college_of_lore', name: 'College of Lore', description: 'Collect knowledge from every source to outwit opponents.' },
    { id: 'college_of_spirits', name: 'College of Spirits', description: 'Channel spirits to weave terrifying and powerful tales.' },
    { id: 'college_of_swords', name: 'College of Swords', description: 'Highly trained blades and agile acrobats.' },
    { id: 'college_of_valor', name: 'College of Valor', description: 'Skalds who sing of great deeds and fight on the front lines.' },
    { id: 'college_of_whispers', name: 'College of Whispers', description: 'Use knowledge and secrets to extort and strike fear.' }
  ],
  Cleric: [
    { id: 'arcana_domain', name: 'Arcana Domain', description: 'Magic is an energy to be studied and harnessed.' },
    { id: 'blood_domain', name: 'Blood Domain', description: 'Control the vital fluid of life and death.' },
    { id: 'death_domain', name: 'Death Domain', description: 'Focus on the forces of necromancy and negative energy.' },
    { id: 'forge_domain', name: 'Forge Domain', description: 'Gods of the forge bless your armor and weapons.' },
    { id: 'grave_domain', name: 'Grave Domain', description: 'Watchers over the line between life and death.' },
    { id: 'knowledge_domain', name: 'Knowledge Domain', description: 'Value learning and understanding above all.' },
    { id: 'life_domain', name: 'Life Domain', description: 'Focus on vibrant positive energy and potent healing.' },
    { id: 'light_domain', name: 'Light Domain', description: 'Burn away the darkness with fire and radiant light.' },
    { id: 'nature_domain', name: 'Nature Domain', description: 'Revere nature and command beasts and plants.' },
    { id: 'order_domain', name: 'Order Domain', description: 'Enforce law, order, and commanding authority.' },
    { id: 'peace_domain', name: 'Peace Domain', description: 'Forge bonds between allies to share burdens.' },
    { id: 'tempest_domain', name: 'Tempest Domain', description: 'Command the terrifying power of the storm.' },
    { id: 'trickery_domain', name: 'Trickery Domain', description: 'Mischief, deception, and illusion.' },
    { id: 'twilight_domain', name: 'Twilight Domain', description: 'Guard against the horrors of the dark with comforting twilight.' },
    { id: 'war_domain', name: 'War Domain', description: 'Deliver the gods\' judgment through martial supremacy.' }
  ],
  Druid: [
    { id: 'circle_of_dreams', name: 'Circle of Dreams', description: 'Tied to the Feywild, offering healing and respite.' },
    { id: 'circle_of_the_land', name: 'Circle of the Land', description: 'A mystic rooted to a specific biome\'s magic.' },
    { id: 'circle_of_the_moon', name: 'Circle of the Moon', description: 'The fierce protectors who master robust Wild Shapes.' },
    { id: 'circle_of_the_shepherd', name: 'Circle of the Shepherd', description: 'Commune with spirits and summon beasts.' },
    { id: 'circle_of_spores', name: 'Circle of Spores', description: 'Find beauty in decay, using fungal spores to deal damage.' },
    { id: 'circle_of_stars', name: 'Circle of Stars', description: 'Draw on the power of starlight and constellations.' },
    { id: 'circle_of_wildfire', name: 'Circle of Wildfire', description: 'Bond with a wildfire spirit to burn and heal.' }
  ],
  Fighter: [
    { id: 'arcane_archer', name: 'Arcane Archer', description: 'Elven methods of weaving magic into arrows.' },
    { id: 'banneret', name: 'Banneret', description: 'Inspiring leaders known as Purple Dragon Knights.' },
    { id: 'battle_master', name: 'Battle Master', description: 'Masters of tactical combat maneuvers.' },
    { id: 'cavalier', name: 'Cavalier', description: 'Mounted combatants and steadfast protectors.' },
    { id: 'champion', name: 'Champion', description: 'Focuses on raw physical perfection and devastating criticals.' },
    { id: 'echo_knight', name: 'Echo Knight', description: 'Clone time-shifted echoes of yourself to fight.' },
    { id: 'eldritch_knight', name: 'Eldritch Knight', description: 'Combine martial mastery with abjuration and evocation magic.' },
    { id: 'psi_warrior', name: 'Psi Warrior', description: 'Unleash psionic power to enhance strikes and barriers.' },
    { id: 'rune_knight', name: 'Rune Knight', description: 'Use ancient giant runes to enlarge and empower.' },
    { id: 'samurai', name: 'Samurai', description: 'Unbreakable resolve and relentless, elegant strikes.' }
  ],
  Monk: [
    { id: 'way_of_the_ascendant_dragon', name: 'Way of the Ascendant Dragon', description: 'Channel the breath and wings of dragons.' },
    { id: 'way_of_the_astral_self', name: 'Way of the Astral Self', description: 'Summon astral arms to strike from afar.' },
    { id: 'way_of_the_drunken_master', name: 'Way of the Drunken Master', description: 'Erratic and unpredictable movements.' },
    { id: 'way_of_the_four_elements', name: 'Way of the Four Elements', description: 'Harness chi to manipulate fire, air, earth, and water.' },
    { id: 'way_of_the_kensei', name: 'Way of the Kensei', description: 'Mastery over martial weapons as extensions of the body.' },
    { id: 'way_of_the_long_death', name: 'Way of the Long Death', description: 'Obsess over the mechanics of dying to harvest temporary vitality.' },
    { id: 'way_of_mercy', name: 'Way of Mercy', description: 'Manipulate the life force of others to heal or harm.' },
    { id: 'way_of_the_open_hand', name: 'Way of the Open Hand', description: 'The ultimate masters of unarmed martial arts.' },
    { id: 'way_of_shadow', name: 'Way of Shadow', description: 'Ninja-like spies and assassins who step through shadows.' },
    { id: 'way_of_the_sun_soul', name: 'Way of the Sun Soul', description: 'Project chi as searing bolts of radiant light.' }
  ],
  Paladin: [
    { id: 'oath_of_the_ancients', name: 'Oath of the Ancients', description: 'Preserve the light, joy, and beauty of the natural world.' },
    { id: 'oath_of_conquest', name: 'Oath of Conquest', description: 'Crush the forces of chaos and rule with an iron fist.' },
    { id: 'oath_of_the_crown', name: 'Oath of the Crown', description: 'Sworn to the ideals of civilization, loyalty, and law.' },
    { id: 'oath_of_devotion', name: 'Oath of Devotion', description: 'The classic knight in shining armor, bound to justice.' },
    { id: 'oath_of_glory', name: 'Oath of Glory', description: 'Destined to achieve heroism and inspire allies.' },
    { id: 'oathbreaker', name: 'Oathbreaker', description: 'A fallen paladin pursuing dark ambitions.' },
    { id: 'oath_of_redemption', name: 'Oath of Redemption', description: 'Offering peace to enemies before delivering violence.' },
    { id: 'oath_of_vengeance', name: 'Oath of Vengeance', description: 'Punish those who have committed grievous sins.' },
    { id: 'oath_of_the_watchers', name: 'Oath of the Watchers', description: 'Protect the mortal realm from extraplanar threats.' }
  ],
  Ranger: [
    { id: 'beast_master', name: 'Beast Master', description: 'Forge a magical bond with a loyal beast companion.' },
    { id: 'drakewarden', name: 'Drakewarden', description: 'Bond with a draconic spirit that grows into a mighty drake.' },
    { id: 'fey_wanderer', name: 'Fey Wanderer', description: 'Wield the mirthful and terrifying magic of the Feywild.' },
    { id: 'gloom_stalker', name: 'Gloom Stalker', description: 'Master of the dark, striking fear from the shadows.' },
    { id: 'horizon_walker', name: 'Horizon Walker', description: 'Guard the world against threats from the multiverse.' },
    { id: 'hunter', name: 'Hunter', description: 'Specialized in fighting massive hordes or giant beasts.' },
    { id: 'monster_slayer', name: 'Monster Slayer', description: 'Hunt down creatures of the night and thwart their magic.' },
    { id: 'swarmkeeper', name: 'Swarmkeeper', description: 'Bind yourself to a swarm of nature spirits.' }
  ],
  Rogue: [
    { id: 'arcane_trickster', name: 'Arcane Trickster', description: 'Enhance stealth and agility with illusion and enchantment.' },
    { id: 'assassin', name: 'Assassin', description: 'Masters of poison, disguise, and deadly strikes.' },
    { id: 'inquisitive', name: 'Inquisitive', description: 'Root out secrets and read the intent of creatures.' },
    { id: 'mastermind', name: 'Mastermind', description: 'Focus on people, influence, and cooperative tactics.' },
    { id: 'phantom', name: 'Phantom', description: 'Walk the line of death, gaining knowledge from spirits.' },
    { id: 'scout', name: 'Scout', description: 'Skilled in survival and highly mobile.' },
    { id: 'soulknife', name: 'Soulknife', description: 'Manifest deadly blades of psionic energy.' },
    { id: 'swashbuckler', name: 'Swashbuckler', description: 'Focus on speed, elegance, and charm in combat.' },
    { id: 'thief', name: 'Thief', description: 'Experts in burglary, traps, and rooftop acrobatics.' }
  ],
  Sorcerer: [
    { id: 'aberrant_mind', name: 'Aberrant Mind', description: 'Alien psionic magic touches your mind.' },
    { id: 'clockwork_soul', name: 'Clockwork Soul', description: 'The absolute order of Mechanus fuels your powers.' },
    { id: 'divine_soul', name: 'Divine Soul', description: 'Your magic comes from a divine spark.' },
    { id: 'draconic_bloodline', name: 'Draconic Bloodline', description: 'The magic of dragons flows through your veins.' },
    { id: 'lunar_sorcery', name: 'Lunar Sorcery', description: 'Power drawn from the phases of the moon.' },
    { id: 'shadow_magic', name: 'Shadow Magic', description: 'The dark magic of the Shadowfell sustains you.' },
    { id: 'storm_sorcery', name: 'Storm Sorcery', description: 'You harness the chaotic power of the storm.' },
    { id: 'wild_magic', name: 'Wild Magic', description: 'Your magic comes from the chaotic forces of creation.' }
  ],
  Warlock: [
    { id: 'the_archfey', name: 'The Archfey', description: 'A whimsical and terrifying lord from the Feywild.' },
    { id: 'the_celestial', name: 'The Celestial', description: 'A being of the Upper Planes granting healing and light.' },
    { id: 'the_fathomless', name: 'The Fathomless', description: 'Entities of the deep ocean offering watery power.' },
    { id: 'the_fiend', name: 'The Fiend', description: 'A destructive pact with a devil or demon.' },
    { id: 'the_genie', name: 'The Genie', description: 'A noble genie granting wishes and elemental magic.' },
    { id: 'the_great_old_one', name: 'The Great Old One', description: 'An unfathomable entity from the Far Realm.' },
    { id: 'the_hexblade', name: 'The Hexblade', description: 'A sentient weapon from the Shadowfell grants martial prowess.' },
    { id: 'the_undead', name: 'The Undead', description: 'Power drawn from an immortal, deathless entity.' },
    { id: 'the_undying', name: 'The Undying', description: 'A patron who has achieved true immortality.' }
  ],
  Wizard: [
    { id: 'school_of_abjuration', name: 'School of Abjuration', description: 'Protective wards and neutralizing magic.' },
    { id: 'school_of_bladesinging', name: 'Bladesinging', description: 'An elven tradition blending swordplay and magic.' },
    { id: 'school_of_chronurgy', name: 'Chronurgy Magic', description: 'Manipulate the flow of time and probability.' },
    { id: 'school_of_conjuration', name: 'School of Conjuration', description: 'Summon creatures and objects from thin air.' },
    { id: 'school_of_divination', name: 'School of Divination', description: 'Pierce the veil of space and time.' },
    { id: 'school_of_enchantment', name: 'School of Enchantment', description: 'Beguile and control the minds of others.' },
    { id: 'school_of_evocation', name: 'School of Evocation', description: 'Create powerful elemental explosions.' },
    { id: 'school_of_graviturgy', name: 'Graviturgy Magic', description: 'Bend the forces of gravity to your whim.' },
    { id: 'school_of_illusion', name: 'School of Illusion', description: 'Dazzle the senses and befuddle the mind.' },
    { id: 'school_of_necromancy', name: 'School of Necromancy', description: 'Manipulate the forces of life and death.' },
    { id: 'order_of_scribes', name: 'Order of Scribes', description: 'The ultimate bookish wizard with an awakened spellbook.' },
    { id: 'school_of_transmutation', name: 'School of Transmutation', description: 'Modify energy and matter at will.' },
    { id: 'school_of_war_magic', name: 'War Magic', description: 'Blend evocation and abjuration for battle supremacy.' }
  ]
};

// Map each base class regex block and replace the subclass array
let updatedSrd = srd;

for (const [className, subclasses] of Object.entries(FULL_SUBCLASSES)) {
  const blockRegex = new RegExp(`{ name: '${className}',\\s*hitDie:.*?subclassLabel:.*?,\\s*subclassLevel:.*?,\\s*subclasses:\\s*\\[.*?\\]`, 'gs');
  
  // Format the subclass JSON perfectly
  const stringifiedSubclasses = subclasses.map(sc => `{ id: '${sc.id}', name: '${sc.name.replace(/'/g, "\\'")}', description: '${sc.description.replace(/'/g, "\\'")}', features: [] }`).join(',\\n        ');
  
  updatedSrd = updatedSrd.replace(blockRegex, (match) => {
    // Regex inside the match to replace the subclasses array
    return match.replace(/subclasses:\s*\[.*?\]/s, `subclasses: [\n        ${stringifiedSubclasses}\n      ]`);
  });
}

fs.writeFileSync(targetFile, updatedSrd, 'utf8');
console.log('✅ Successfully rebuilt srd.ts with all 115 5E Canonical Subclasses!');
