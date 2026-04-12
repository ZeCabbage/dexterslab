'use client';

import { useCharacterStore } from '../lib/store';
import styles from '../[id]/page.module.css';

import { useState } from 'react';
import LevelUpModal from '../components/LevelUpModal';

const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
const calcMod = (score: number) => Math.floor((score - 10) / 2);

export default function ProfileTab() {
  const { char, updateField, updateHP } = useCharacterStore();
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [addXpAmount, setAddXpAmount] = useState('');

  if (!char) return null;

  const xpNext = XP_THRESHOLDS[char.level] || 999999;
  const xpPrev = XP_THRESHOLDS[char.level - 1] || 0;
  const xpProgress = Math.min(100, Math.max(0, ((char.xp - xpPrev) / (xpNext - xpPrev)) * 100));

  return (
    <div className={styles.profileTab}>
      <div className={styles.profileHeader} style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {char.portrait && (
          <div style={{ flexShrink: 0, width: '256px', height: '320px', borderRadius: '12px', border: '2px solid #cfaa5e', overflow: 'hidden', boxShadow: '0 0 20px rgba(207, 170, 94, 0.15)' }}>
             <img src={`data:image/png;base64,${char.portrait}`} alt={char.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        <div className={styles.profileInfo} style={{ flexGrow: 1 }}>
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" value={char.xp || 0} onChange={e => updateField('xp', parseInt(e.target.value) || 0)} style={{ width: '80px' }} />
                <form onSubmit={e => {
                  e.preventDefault();
                  if(addXpAmount) {
                    updateField('xp', (char.xp || 0) + parseInt(addXpAmount));
                    setAddXpAmount('');
                  }
                }} style={{ display: 'flex', gap: '4px' }}>
                  <input type="number" placeholder="+ Add XP" value={addXpAmount} onChange={e => setAddXpAmount(e.target.value)} style={{ width: '80px', background: 'rgba(200, 150, 50, 0.1)', border: '1px solid rgba(200, 150, 50, 0.5)' }} />
                  <button type="submit" style={{ background: '#cfaa5e', color: '#111', border: 'none', padding: '0 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Add</button>
                </form>
              </div>
            </div>
          </div>
          <button className={styles.btnLevelUp} onClick={() => setShowLevelUp(true)}>▲ Level Up to {char.level + 1}</button>
          {showLevelUp && <LevelUpModal onClose={() => setShowLevelUp(false)} />}
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
