'use client';

import { useCharacterStore } from '../lib/store';
import styles from '../[id]/page.module.css';

const SPELL_SCHOOLS = ['Abjuration','Conjuration','Divination','Enchantment','Evocation','Illusion','Necromancy','Transmutation'];
const calcMod = (score: number) => Math.floor((score - 10) / 2);

export default function SpellsTab() {
  const { char, updateField } = useCharacterStore();

  if (!char) return null;

  const profBonus = Math.ceil((char.level || 1) / 4) + 1;
  const spellAbility = char.spellcastingAbility || 'cha';
  const spellMod = calcMod(char.stats[spellAbility as keyof typeof char.stats] || 10);
  const spellDC = 8 + profBonus + spellMod;
  const spellAttack = profBonus + spellMod;

  const addSpell = () => {
    updateField('spells', [...(char.spells || []), { name: 'New Spell', level: 0, school: 'Evocation', prepared: false, description: '' }]);
  };
  const updateSpell = (idx: number, changes: any) => {
    const spells = [...(char.spells || [])];
    spells[idx] = { ...spells[idx], ...changes };
    updateField('spells', spells);
  };
  const removeSpell = (idx: number) => {
    updateField('spells', (char.spells || []).filter((_, i) => i !== idx));
  };

  return (
    <div className={styles.spellsTab}>
      <h2 className={styles.tabTitle}>Spellcasting</h2>
      {!char.spellcaster && <p className={styles.tabSubtitle} style={{ color: '#666' }}>This character is not a spellcaster. You can still add spells manually.</p>}

      <div className={styles.spellHeader}>
        <div className={styles.spellStat}>
          <div className={styles.spellStatLabel}>Ability</div>
          <div className={styles.spellStatValue}>{spellAbility.toUpperCase()}</div>
        </div>
        <div className={styles.spellStat}>
          <div className={styles.spellStatLabel}>Spell DC</div>
          <div className={styles.spellStatValue}>{spellDC}</div>
        </div>
        <div className={styles.spellStat}>
          <div className={styles.spellStatLabel}>Spell Attack</div>
          <div className={styles.spellStatValue}>+{spellAttack}</div>
        </div>
      </div>

      <p style={{background: 'rgba(20,20,20,0.5)', padding: '10px', borderRadius: '4px', border: '1px solid #333', fontSize: '13px', color: '#888', fontStyle: 'italic'}}>
        Spell Slots are now tracked as generic resources in the <strong>Combat</strong> tab.
      </p>

      {/* Spell List */}
      <div className={styles.spellListSection}>
        <h3 className={styles.sectionHeading}>Known Spells <button className={styles.btnAdd} onClick={addSpell}>+ Add</button></h3>
        {(char.spells || []).length === 0 && <p className={styles.emptyText}>No spells yet. Click + Add to begin.</p>}
        {(char.spells || []).map((spell, i) => (
          <div key={i} className={`${styles.spellCard} ${spell.prepared ? styles.spellPrepared : ''}`}>
            <div className={styles.spellCardTop}>
              <span className={`${styles.profDot} ${spell.prepared ? styles.profActive : ''}`} onClick={() => updateSpell(i, { prepared: !spell.prepared })} title="Toggle prepared">●</span>
              <input className={styles.spellNameInput} value={spell.name} onChange={e => updateSpell(i, { name: e.target.value })} />
              <select value={spell.level} onChange={e => updateSpell(i, { level: parseInt(e.target.value) })}>
                <option value={0}>Cantrip</option>
                {[1,2,3,4,5,6,7,8,9].map(l => <option key={l} value={l}>Level {l}</option>)}
              </select>
              <select value={spell.school} onChange={e => updateSpell(i, { school: e.target.value })}>
                {SPELL_SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className={styles.btnRemove} onClick={() => removeSpell(i)}>×</button>
            </div>
            <textarea className={styles.spellDesc} value={spell.description} onChange={e => updateSpell(i, { description: e.target.value })} placeholder="Spell description..." />
          </div>
        ))}
      </div>
    </div>
  );
}
