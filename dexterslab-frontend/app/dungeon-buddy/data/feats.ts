import { FeatData } from '../lib/types';

// A subset of standard 5e SRD/common feats to provide immediate utility
export const STANDARD_FEATS: FeatData[] = [
  {
    id: 'feat_tough',
    name: 'Tough',
    description: 'Your hit point maximum increases by an amount equal to twice your level when you gain this feat. Whenever you gain a level thereafter, your hit point maximum increases by an additional 2 hit points.',
  },
  {
    id: 'feat_mobile',
    name: 'Mobile',
    description: 'Your speed increases by 10 feet. When you use the Dash action, difficult terrain doesn\'t cost you extra movement on that turn. When you make a melee attack against a creature, you don\'t provoke opportunity attacks from that creature for the rest of the turn, whether you hit or not.',
  },
  {
    id: 'feat_alert',
    name: 'Alert',
    description: 'You gain a +5 bonus to initiative. You can\'t be surprised while you are conscious. Other creatures don\'t gain advantage on attack rolls against you as a result of being unseen by you.',
  },
  {
    id: 'feat_keen_mind',
    name: 'Keen Mind',
    description: 'You have a mind that can track time, direction, and detail with uncanny precision. You always know which way is north. You always know the number of hours left before the next sunrise or sunset. You can accurately recall anything you have seen or heard within the past month.',
    abilityIncrease: { int: 1 },
  },
  {
    id: 'feat_resilient_con',
    name: 'Resilient (Constitution)',
    description: 'You gain proficiency in Constitution saving throws.',
    abilityIncrease: { con: 1 },
  },
  {
    id: 'feat_war_caster',
    name: 'War Caster',
    description: 'You have advantage on Constitution saving throws that you make to maintain your concentration on a spell when you take damage. You can perform the somatic components of spells even when you have weapons or a shield in one or both hands. When a hostile creature\'s movement provokes an opportunity attack from you, you can use your reaction to cast a spell at the creature, rather than making an opportunity attack.',
    prerequisite: 'The ability to cast at least one spell',
  },
  {
    id: 'feat_sharpshooter',
    name: 'Sharpshooter',
    description: 'Attacking at long range doesn\'t impose disadvantage on your ranged weapon attack rolls. Your ranged weapon attacks ignore half cover and three-quarters cover. Before you make an attack with a ranged weapon that you are proficient with, you can choose to take a -5 penalty to the attack roll. If the attack hits, you add +10 to the attack\'s damage.',
  },
  {
    id: 'feat_great_weapon_master',
    name: 'Great Weapon Master',
    description: 'On your turn, when you score a critical hit with a melee weapon or reduce a creature to 0 hit points with one, you can make one melee weapon attack as a bonus action. Before you make a melee attack with a heavy weapon that you are proficient with, you can choose to take a -5 penalty to the attack roll. If the attack hits, you add +10 to the attack\'s damage.',
  }
];
