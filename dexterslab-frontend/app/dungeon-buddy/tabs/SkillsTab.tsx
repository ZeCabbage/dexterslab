'use client';

import { useCharacterStore } from '../lib/store';
import styles from '../[id]/page.module.css';

const SKILL_MAP: { name: string; ability: string; key: string; }[] = [
  { name: 'Acrobatics', ability: 'dex', key: 'acrobatics' },
  { name: 'Animal Handling', ability: 'wis', key: 'animal_handling' },
  { name: 'Arcana', ability: 'int', key: 'arcana' },
  { name: 'Athletics', ability: 'str', key: 'athletics' },
  { name: 'Deception', ability: 'cha', key: 'deception' },
  { name: 'History', ability: 'int', key: 'history' },
  { name: 'Insight', ability: 'wis', key: 'insight' },
  { name: 'Intimidation', ability: 'cha', key: 'intimidation' },
  { name: 'Investigation', ability: 'int', key: 'investigation' },
  { name: 'Medicine', ability: 'wis', key: 'medicine' },
  { name: 'Nature', ability: 'int', key: 'nature' },
  { name: 'Perception', ability: 'wis', key: 'perception' },
  { name: 'Performance', ability: 'cha', key: 'performance' },
  { name: 'Persuasion', ability: 'cha', key: 'persuasion' },
  { name: 'Religion', ability: 'int', key: 'religion' },
  { name: 'Sleight of Hand', ability: 'dex', key: 'sleight_of_hand' },
  { name: 'Stealth', ability: 'dex', key: 'stealth' },
  { name: 'Survival', ability: 'wis', key: 'survival' },
];

const calcMod = (score: number) => Math.floor((score - 10) / 2);

export default function SkillsTab() {
  const { char, updateField } = useCharacterStore();

  if (!char) return null;

  const profBonus = Math.ceil((char.level || 1) / 4) + 1;

  return (
    <div className={styles.skillsTab}>
      <h2 className={styles.tabTitle}>Skills</h2>
      <p className={styles.tabSubtitle}>Click the dot to toggle proficiency. Modifiers auto-calculate.</p>
      <div className={styles.skillsList}>
        {SKILL_MAP.map(skill => {
          const isProficient = char.skills?.includes(skill.key);
          const abilityMod = calcMod(char.stats[skill.ability as keyof typeof char.stats] || 10);
          const total = abilityMod + (isProficient ? profBonus : 0);
          return (
            <div key={skill.key} className={`${styles.skillRow} ${isProficient ? styles.skillProficient : ''}`}>
              <span className={`${styles.profDot} ${isProficient ? styles.profActive : ''}`} onClick={() => {
                const skills = isProficient ? char.skills.filter(s => s !== skill.key) : [...char.skills, skill.key];
                updateField('skills', skills);
              }}>●</span>
              <span className={styles.skillMod}>{total >= 0 ? '+' : ''}{total}</span>
              <span className={styles.skillName}>{skill.name}</span>
              <span className={styles.skillAbility}>{skill.ability.toUpperCase()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
