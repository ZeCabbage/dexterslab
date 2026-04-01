'use client';

import { useCharacterStore } from '../lib/store';
import styles from '../[id]/page.module.css';
import { Attack } from '../lib/types';
import ResourceTracker from '../components/ResourceTracker';
import SpellCard from '../components/SpellCard';
import SpellBrowser from '../components/SpellBrowser';
import { useSpells } from '../hooks/useSpells';
import { useState } from 'react';

const CONDITIONS = ['Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious'];

export default function CombatTab() {
  const { char, updateField, updateNestedField, shortRest, longRest, expendResource, restoreResource, prepareSpell, unprepareSpell } = useCharacterStore();
  const [showShortRest, setShowShortRest] = useState(false);
  const [showLongRest, setShowLongRest] = useState(false);
  
  const [spentHitDice, setSpentHitDice] = useState(0);

  const [actionFilter, setActionFilter] = useState<'all' | 'action' | 'bonus_action' | 'reaction'>('all');

  const isPreparedCaster = ['cleric', 'druid', 'paladin', 'wizard'].includes(char?.class?.toLowerCase() || '');
  const combatSpells = isPreparedCaster ? (char?.preparedSpells || []) : (char?.knownSpells || []);
  
  // Map pure IDs to rich static metadata
  const combatSpellsData = useSpells(combatSpells, char?.customSpells);

  if (!char) return null;

  // Filter Spells
  const displayedSpells = combatSpellsData.filter(spell => {
    if (actionFilter === 'all') return true;
    return spell.actionCost === actionFilter;
  });

  // Filter Resources (Features/Magic tracking)
  const displayedResources = Object.entries(char.resources || {}).filter(([id, res]) => {
    if (actionFilter === 'all') return true;
    return res.actionCost === actionFilter;
  });

  // Filter Attacks (Equipped weapons logic + attack board)
  const displayedAttacks = (char.attacks || []).filter(atk => {
    if (actionFilter === 'all') return true;
    return (atk.actionCost || 'action') === actionFilter;
  });

  const handleShortRestConfirm = () => {
    // Basic short rest: we'll pass the HP healed
    const healedAmount = spentHitDice; // user inputs raw HP healed for simplicity
    shortRest(healedAmount);
    setShowShortRest(false);
    setSpentHitDice(0);
  };

  const handleLongRestConfirm = () => {
    longRest();
    setShowLongRest(false);
  };

  const addAttack = () => {
    updateField('attacks', [...(char.attacks || []), { id: `atk_${Date.now()}`, name: 'Weapon', bonus: '+0', damage: '1d6', type: 'Slashing' }]);
  };
  
  // Resource Adding (for demonstration/draft)
  const addResource = () => {
    const defaultRes = { name: 'Action Surge', max: 1, used: 0, recharge: 'short' as const };
    updateField('resources', { ...char.resources, [`res_${Date.now()}`]: defaultRes });
  };

  return (
    <div className={styles.combatTab}>
      <h2 className={styles.tabTitle}>Combat Dashboard</h2>

      {/* Action Economy Filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', position: 'sticky', top: '0', zIndex: 10, background: '#111', padding: '12px 0', borderBottom: '1px solid #333' }}>
        <button onClick={() => setActionFilter('all')} style={{ padding: '8px 16px', background: actionFilter === 'all' ? '#333' : 'transparent', color: actionFilter === 'all' ? '#fff' : '#888', border: `1px solid ${actionFilter === 'all' ? '#cfaa5e' : '#444'}`, borderRadius: '4px', cursor: 'pointer' }}>All</button>
        <button onClick={() => setActionFilter('action')} style={{ padding: '8px 16px', background: actionFilter === 'action' ? '#224422' : 'transparent', color: actionFilter === 'action' ? '#88ff88' : '#888', border: `1px solid ${actionFilter === 'action' ? '#44aa44' : '#444'}`, borderRadius: '4px', cursor: 'pointer' }}>Actions 🟢</button>
        <button onClick={() => setActionFilter('bonus_action')} style={{ padding: '8px 16px', background: actionFilter === 'bonus_action' ? '#442222' : 'transparent', color: actionFilter === 'bonus_action' ? '#ff8888' : '#888', border: `1px solid ${actionFilter === 'bonus_action' ? '#aa4444' : '#444'}`, borderRadius: '4px', cursor: 'pointer' }}>Bonus Actions 🔺</button>
        <button onClick={() => setActionFilter('reaction')} style={{ padding: '8px 16px', background: actionFilter === 'reaction' ? '#444422' : 'transparent', color: actionFilter === 'reaction' ? '#ffff88' : '#888', border: `1px solid ${actionFilter === 'reaction' ? '#aaaa44' : '#444'}`, borderRadius: '4px', cursor: 'pointer' }}>Reactions ⚡</button>
      </div>

      {/* Rests & Time Engine */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <button 
          onClick={() => setShowShortRest(true)}
          style={{ padding: '12px 24px', background: '#332211', border: '1px solid #cfaa5e', color: '#cfaa5e', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Cinzel, serif', fontSize: '16px' }}
        >
          Campfire (Short Rest)
        </button>
        <button 
          onClick={() => setShowLongRest(true)}
          style={{ padding: '12px 24px', background: '#112233', border: '1px solid #55aacc', color: '#55aacc', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Cinzel, serif', fontSize: '16px' }}
        >
          Slumber (Long Rest)
        </button>
      </div>

      {showShortRest && (
        <div style={{ padding: '16px', background: 'rgba(50,30,10,0.8)', border: '1px solid #cfaa5e', borderRadius: '8px', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#cfaa5e' }}>Short Rest Check</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#ccc' }}>How much HP did you heal from spending Hit Dice?</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
               type="number" 
               value={spentHitDice} 
               onChange={e => setSpentHitDice(parseInt(e.target.value) || 0)} 
               style={{ width: '80px', padding: '8px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '4px' }}
            />
            <button onClick={handleShortRestConfirm} style={{ padding: '8px 16px', background: '#cfaa5e', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Confirm</button>
            <button onClick={() => setShowShortRest(false)} style={{ padding: '8px 16px', background: 'transparent', color: '#888', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {showLongRest && (
        <div style={{ padding: '16px', background: 'rgba(10,30,50,0.8)', border: '1px solid #55aacc', borderRadius: '8px', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#55aacc' }}>Long Rest Recovery</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#ccc' }}><strong>WARNING:</strong> This will reset all HP, spell slots, and daily features. Are you sure you sleep safely?</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleLongRestConfirm} style={{ padding: '8px 16px', background: '#55aacc', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Sleep (Confirm)</button>
            <button onClick={() => setShowLongRest(false)} style={{ padding: '8px 16px', background: 'transparent', color: '#888', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Universal Trackers (Spells & Features) */}
      <h3 className={styles.sectionHeading} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Active Resources 
        <button onClick={addResource} style={{ background: 'transparent', color: '#cfaa5e', border: '1px dotted #cfaa5e', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}>+ Add Dummy Resource</button>
      </h3>
      <div className={styles.activeResources} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '16px', marginBottom: '32px' }}>
        {displayedResources.length === 0 && (
          <p style={{ color: '#666', fontSize: '14px' }}>No active resources tracked for this action type.</p>
        )}
        {displayedResources.map(([id, res]) => (
          <ResourceTracker 
            key={id}
            label={res.name}
            max={res.max}
            used={res.used}
            onExpend={() => expendResource(id)}
            onRestore={() => restoreResource(id)}
          />
        ))}
      </div>

      {/* The Grimoire (Prepared Spells) */}
      <div style={{ marginBottom: '32px' }}>
        <h3 className={styles.sectionHeading} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {isPreparedCaster ? 'Prepared Magic' : 'Active Magic'}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 350px), 1fr))', gap: '20px' }}>
          {displayedSpells.length === 0 && <p style={{ color: '#666', fontSize: '14px' }}>No spells active. Head to your Spells Tab to permanently learn or prepare magic.</p>}
          {displayedSpells.map(spell => {
            return (
              <SpellCard 
                key={spell.id}
                spell={spell}
                isPrepared={true}
                onPrepareToggle={undefined}
              />
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        {/* Death Saves */}
        <div>
          <h3 className={styles.sectionHeading}>Death Saves</h3>
          <div className={styles.deathSavesRow} style={{ marginTop: '0', background: 'transparent', padding: 0 }}>
            <div className={styles.deathSaveGroup}>
              <span className={styles.deathLabel}>Successes</span>
              <div className={styles.deathDots}>
                {[0,1,2].map(i => (
                  <span key={i} className={`${styles.deathDot} ${i < (char.deathSaves?.successes || 0) ? styles.deathSuccess : ''}`} 
                    onClick={() => updateNestedField('deathSaves', 'successes', (char.deathSaves?.successes || 0) === i+1 ? i : i+1)} />
                ))}
              </div>
            </div>
            <div className={styles.deathSaveGroup}>
              <span className={styles.deathLabel}>Failures</span>
              <div className={styles.deathDots}>
                {[0,1,2].map(i => (
                  <span key={i} className={`${styles.deathDot} ${i < (char.deathSaves?.failures || 0) ? styles.deathFail : ''}`} 
                    onClick={() => updateNestedField('deathSaves', 'failures', (char.deathSaves?.failures || 0) === i+1 ? i : i+1)} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Conditions */}
        <div>
          <h3 className={styles.sectionHeading}>Conditions</h3>
          <div className={styles.conditionChips}>
            {CONDITIONS.map(c => (
              <span key={c} className={`${styles.conditionChip} ${char.conditions?.includes(c) ? styles.conditionActive : ''}`}
                onClick={() => {
                  const conditions = char.conditions?.includes(c) ? char.conditions.filter(x => x !== c) : [...(char.conditions || []), c];
                  updateField('conditions', conditions);
                }}>{c}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Attacks */}
      <div className={styles.attacksSection} style={{ marginTop: '32px' }}>
        <h3 className={styles.sectionHeading}>Weapons & Unarmed <button className={styles.btnAdd} onClick={addAttack}>+</button></h3>
        
        {/* Dynamic Weapons from Equipped Slots */}
        {(actionFilter === 'all' || actionFilter === 'action') && char.equipped?.mainHand && (
          <div className={styles.attackRow} style={{ background: 'rgba(20,20,20,0.8)', padding: '12px', border: '1px solid #cfaa5e' }}>
            <span style={{ flex: 1, color: '#cfaa5e', fontWeight: 'bold' }}>{char.equipped.mainHand.name}</span>
            <span style={{ color: '#aaa', fontSize: '14px' }}>Main Hand (Action 🟢)</span>
          </div>
        )}
        {(actionFilter === 'all' || actionFilter === 'bonus_action') && char.equipped?.offHand && char.equipped.offHand.type === 'weapon' && (
          <div className={styles.attackRow} style={{ background: 'rgba(20,20,20,0.8)', padding: '12px', border: '1px solid #aa4444' }}>
            <span style={{ flex: 1, color: '#ff8888', fontWeight: 'bold' }}>{char.equipped.offHand.name}</span>
            <span style={{ color: '#aaa', fontSize: '14px' }}>Off Hand (Bonus Action 🔺)</span>
          </div>
        )}

        {displayedAttacks.length === 0 && (!char.equipped?.mainHand && !char.equipped?.offHand) && <p style={{ color: '#666' }}>No attacks available for this filter.</p>}

        {displayedAttacks.map((atk, i) => {
          // Find the actual index in the original array to safely mutate
          const trueIndex = char.attacks.findIndex(a => a.id === atk.id);
          return (
          <div key={atk.id} className={styles.attackRow}>
            <input className={styles.attackInput} value={atk.name} onChange={e => updateField('attacks', char.attacks.map((a, j) => j === i ? { ...a, name: e.target.value } : a))} placeholder="Name" />
            <input className={styles.attackInputSm} value={atk.bonus} onChange={e => updateField('attacks', char.attacks.map((a, j) => j === i ? { ...a, bonus: e.target.value } : a))} placeholder="+5" />
            <input className={styles.attackInputSm} value={atk.damage} onChange={e => updateField('attacks', char.attacks.map((a, j) => j === i ? { ...a, damage: e.target.value } : a))} placeholder="1d8+3" />
            <input className={styles.attackInputSm} value={atk.type} onChange={e => updateField('attacks', char.attacks.map((a, j) => j === i ? { ...a, type: e.target.value } : a))} placeholder="Slashing" />
            <button className={styles.btnRemove} onClick={() => updateField('attacks', char.attacks.filter((_, j) => j !== trueIndex))}>×</button>
          </div>
          );
        })}
      </div>

    </div>
  );
}
