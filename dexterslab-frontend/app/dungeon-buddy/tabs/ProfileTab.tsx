'use client';

import { useCharacterStore } from '../lib/store';
import styles from '../[id]/page.module.css';

const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
const calcMod = (score: number) => Math.floor((score - 10) / 2);

export default function ProfileTab() {
  const { char, updateField, updateHP } = useCharacterStore();

  if (!char) return null;

  const xpNext = XP_THRESHOLDS[char.level] || 999999;
  const xpPrev = XP_THRESHOLDS[char.level - 1] || 0;
  const xpProgress = Math.min(100, Math.max(0, ((char.xp - xpPrev) / (xpNext - xpPrev)) * 100));

  const levelUp = () => {
    const hitDieVal = parseInt(char.hitDie?.replace('d', '') || '8');
    const conMod = calcMod(char.stats.con);
    const hpGain = Math.max(1, Math.floor(hitDieVal / 2) + 1 + conMod);
    
    // Using simple updateField for now, complex leveling can be a reducer action later if needed
    updateField('level', char.level + 1);
    updateField('maxHp', char.maxHp + hpGain);
    updateHP(hpGain);
  };

  return (
    <div className={styles.profileTab}>
      <div className={styles.profileHeader}>
        <div className={styles.profileInfo}>
          <input className={styles.nameInputLarge} value={char.name} onChange={e => updateField('name', e.target.value)} placeholder="Character Name" />
          <div className={styles.profileMeta}>
            <span className={styles.metaBadge}>Level {char.level}</span>
            <span className={styles.metaBadge}>{char.race}</span>
            <span className={styles.metaBadge}>{char.class}</span>
            <span className={styles.metaBadge}>{char.background}</span>
          </div>
          <div className={styles.xpBar}>
            <div className={styles.xpFill} style={{ width: `${xpProgress}%` }} />
            <span className={styles.xpText}>{char.xp} / {xpNext} XP</span>
          </div>
          <div className={styles.profileRow}>
            <div className={styles.inlineField}>
              <label>Alignment</label>
              <input value={char.alignment || ''} onChange={e => updateField('alignment', e.target.value)} placeholder="e.g. Chaotic Good" />
            </div>
            <div className={styles.inlineField}>
              <label>XP</label>
              <input type="number" value={char.xp || 0} onChange={e => updateField('xp', parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <button className={styles.btnLevelUp} onClick={levelUp}>▲ Level Up to {char.level + 1}</button>
        </div>
      </div>

      <div className={styles.personalityGrid}>
        <div className={styles.personalityBox}>
          <label>Personality Traits</label>
          <textarea value={char.personalityTraits || ''} onChange={e => updateField('personalityTraits', e.target.value)} placeholder="I am always polite and respectful..." />
        </div>
        <div className={styles.personalityBox}>
          <label>Ideals</label>
          <textarea value={char.ideals || ''} onChange={e => updateField('ideals', e.target.value)} placeholder="Greater good..." />
        </div>
        <div className={styles.personalityBox}>
          <label>Bonds</label>
          <textarea value={char.bonds || ''} onChange={e => updateField('bonds', e.target.value)} placeholder="I will protect my family..." />
        </div>
        <div className={styles.personalityBox}>
          <label>Flaws</label>
          <textarea value={char.flaws || ''} onChange={e => updateField('flaws', e.target.value)} placeholder="I am slow to trust..." />
        </div>
      </div>
    </div>
  );
}
