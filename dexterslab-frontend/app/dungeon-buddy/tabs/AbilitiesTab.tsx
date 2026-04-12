'use client';

import { useCharacterStore } from '../lib/store';
import styles from '../[id]/page.module.css';
import D20Icon from '../components/D20Icon';

const ABILITY_LABELS: Record<string, string> = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
const calcMod = (score: number) => Math.floor((score - 10) / 2);

export default function AbilitiesTab() {
  const { char, updateNestedField, updateField, addLog } = useCharacterStore();

  if (!char) return null;

  const profBonus = Math.ceil((char.level || 1) / 4) + 1;

  const handleRoll = (name: string, bonus: number) => {
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + bonus;
    const sign = bonus >= 0 ? '+' : '';
    const desc = `Rolled ${name}: ${roll} (1d20) ${sign} ${bonus} = ${total}`;
    alert(desc);
    addLog('roll', desc);
  };


  return (
    <div className={styles.abilitiesTab}>
      <h2 className={styles.tabTitle}>Ability Scores</h2>
      <div className={styles.abilityScoresGrid}>
        {Object.entries(char.stats).map(([key, val]) => {
          const mod = calcMod(val as number);
          const isSave = char.savingThrows?.includes(key);
          return (
            <div key={key} className={styles.abilityCard}>
              <div className={styles.abilityName}>{ABILITY_LABELS[key]}</div>
              <div className={styles.abilityScoreCircle}>
                <input type="number" value={val as number} onChange={e => updateNestedField('stats', key, parseInt(e.target.value) || 0)} className={styles.abilityScoreInput} />
              </div>
              <div className={styles.abilityModifier}>
                {mod >= 0 ? '+' : ''}{mod}
                <button className={styles.rollBtn} onClick={() => handleRoll(`${ABILITY_LABELS[key]} Check`, mod)} title="Roll Ability Check"><D20Icon /></button>
              </div>
              <div className={styles.savingThrow}>
                <span className={`${styles.profDot} ${isSave ? styles.profActive : ''}`} onClick={() => {
                  const saves = isSave ? char.savingThrows.filter(s => s !== key) : [...char.savingThrows, key];
                  updateField('savingThrows', saves);
                }}>●</span>
                <span className={styles.saveLabel}>
                  Save {isSave ? (mod + profBonus >= 0 ? '+' : '') + (mod + profBonus) : (mod >= 0 ? '+' : '') + mod}
                  <button className={styles.rollBtn} onClick={() => handleRoll(`${ABILITY_LABELS[key]} Save`, isSave ? mod + profBonus : mod)} title="Roll Saving Throw"><D20Icon /></button>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.passivesRow}>
        <div className={styles.passiveBox}>
          <div className={styles.passiveLabel}>Proficiency Bonus</div>
          <div className={styles.passiveValue}>+{profBonus}</div>
        </div>
        <div className={styles.passiveBox}>
          <div className={styles.passiveLabel}>Passive Perception</div>
          <div className={styles.passiveValue}>{10 + calcMod(char.stats.wis) + (char.skills?.includes('perception') ? profBonus : 0)}</div>
        </div>
        <div className={styles.passiveBox}>
          <div className={styles.passiveLabel}>Passive Investigation</div>
          <div className={styles.passiveValue}>{10 + calcMod(char.stats.int) + (char.skills?.includes('investigation') ? profBonus : 0)}</div>
        </div>
        <div className={styles.passiveBox}>
          <div className={styles.passiveLabel}>Passive Insight</div>
          <div className={styles.passiveValue}>{10 + calcMod(char.stats.wis) + (char.skills?.includes('insight') ? profBonus : 0)}</div>
        </div>
      </div>
    </div>
  );
}
