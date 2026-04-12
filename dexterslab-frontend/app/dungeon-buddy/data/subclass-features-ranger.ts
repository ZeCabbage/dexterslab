import { SubclassFeatureSet } from './subclass-features';

export const RANGER_SUBCLASSES: SubclassFeatureSet[] = [
  {
    id: 'hunter', name: 'Hunter', className: 'Ranger',
    description: 'Masters of deadly combat against specific types of prey.',
    features: [
      { name: "Hunter's Prey", description: 'Choose Colossus Slayer (+1d8 damage to injured target), Giant Killer (reaction attack when large creature attacks you), or Horde Breaker (extra attack vs adjacent target).', level: 3, source: 'Hunter', choiceType: 'totem', choiceCount: 1, modifiers: [{ type: 'passive', description: "Hunter's Prey choice." }] },
      { name: 'Defensive Tactics', description: 'Choose Escape the Horde (opportunity attacks at disadvantage), Multiattack Defense (+4 AC vs subsequent attacks from same creature), or Steel Will (adv vs frightened).', level: 7, source: 'Hunter', choiceType: 'totem', choiceCount: 1, modifiers: [{ type: 'passive', description: 'Defensive Tactics choice.' }] },
      { name: 'Multiattack', description: 'Choose Volley (ranged attack vs all within 10ft of point) or Whirlwind Attack (melee attack vs all within 5ft).', level: 11, source: 'Hunter', choiceType: 'totem', choiceCount: 1, modifiers: [{ type: 'passive', description: 'Multiattack choice.' }] },
      { name: "Superior Hunter's Defense", description: 'Choose Evasion, Stand Against the Tide (redirect missed melee attack), or Uncanny Dodge (reaction to halve attack damage).', level: 15, source: 'Hunter', choiceType: 'totem', choiceCount: 1, modifiers: [{ type: 'passive', description: "Superior Hunter's Defense choice." }] }
    ]
  },
  {
    id: 'beast_master', name: 'Beast Master', className: 'Ranger',
    description: 'Bond with an animal companion.',
    features: [
      { name: "Ranger's Companion", description: 'Gain a beast companion (CR 1/4 or lower, Medium or smaller). It acts on your initiative., uses your prof bonus for AC, attacks, damage, saves, skills. Use action to command it to attack.', level: 3, source: 'Beast Master', modifiers: [{ type: 'summon_companion', templateId: 'beast_companion' }] },
      { name: 'Exceptional Training', description: 'Command beast to Dash, Disengage, or Help as a bonus action on your turn. Beast attacks count as magical.', level: 7, source: 'Beast Master', modifiers: [{ type: 'passive', description: 'Bonus action to command beast Dash/Disengage/Help. Attacks are magical.' }] },
      { name: 'Bestial Fury', description: 'When you command the beast to take the Attack action, it can make two attacks.', level: 11, source: 'Beast Master', modifiers: [{ type: 'passive', description: 'Beast makes two attacks.' }] },
      { name: 'Share Spells', description: 'When you cast a spell targeting yourself, you can also affect your beast if within 30 ft.', level: 15, source: 'Beast Master', modifiers: [{ type: 'passive', description: 'Share self-targeting spells with beast.' }] }
    ]
  },
  {
    id: 'gloom_stalker', name: 'Gloom Stalker', className: 'Ranger',
    description: 'At home in the darkest places, striking unseen.',
    features: [
      { name: 'Gloom Stalker Magic', description: 'Learn disguise self.', level: 3, source: 'Gloom Stalker', modifiers: [{ type: 'grant_spells_always_prepared', spells: ['disguise_self'] }] },
      { name: 'Dread Ambusher', description: 'Add WIS mod to initiative. First turn of combat: +10 speed, extra attack that deals +1d8 damage.', level: 3, source: 'Gloom Stalker', modifiers: [{ type: 'passive', description: 'Add WIS mod to initiative. First turn speed and extra attack.' }] },
      { name: 'Umbral Sight', description: 'Gain 60ft darkvision (or add 30ft). Invisible to creatures relying on darkvision in darkness.', level: 3, source: 'Gloom Stalker', modifiers: [{ type: 'passive', description: 'Darkvision enhancement, invisible in darkness to darkvision.' }, { type: 'grant_darkvision', range: 60 }] },
      { name: 'Iron Mind', description: 'Proficiency in Wisdom saves (or INT/CHA if you already have WIS).', level: 7, source: 'Gloom Stalker', modifiers: [{ type: 'grant_proficiency', category: 'save', value: 'wis' }] },
      { name: 'Stalker\'s Flurry', description: 'Once per turn when you miss with an attack, you can make another attack as part of the same action.', level: 11, source: 'Gloom Stalker', modifiers: [{ type: 'passive', description: 'Free reroll/attack on miss once per turn.' }] },
      { name: 'Shadowy Dodge', description: 'Reaction to impose disadvantage on an attack against you if you don\'t have disadvantage.', level: 15, source: 'Gloom Stalker', modifiers: [{ type: 'passive', description: 'Reaction to impose disadvantage on attacker.' }] }
    ]
  }
];
