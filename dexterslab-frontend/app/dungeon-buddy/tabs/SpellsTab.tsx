'use client';

import { useState } from 'react';
import { useCharacterStore } from '../lib/store';
import { useSpells } from '../hooks/useSpells';
import SpellCard from '../components/SpellCard';
import SpellBrowser from '../components/SpellBrowser';
import { SpellData, ActionCost, ModifierEffect } from '../lib/types';
import styles from '../[id]/page.module.css';
import ModifierBuilder from '../components/ModifierBuilder';

const SPELL_SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];
const calcMod = (score: number) => Math.floor((score - 10) / 2);

export default function SpellsTab() {
  const { char, updateField, prepareSpell, unprepareSpell, addHomebrewSpell, removeHomebrewSpell } = useCharacterStore();
  const [activeSubTab, setActiveSubTab] = useState<'mine' | 'grimoire'>('mine');
  
  // Custom spell form state
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customDraft, setCustomDraft] = useState<Partial<SpellData>>({
    name: '', level: 0, school: 'Evocation', castingTime: '1 action',
    range: '60 feet', components: 'V, S', duration: 'Instantaneous',
    description: '', damage: '', damageType: '', actionCost: 'action'
  });
  const [spellModifiers, setSpellModifiers] = useState<ModifierEffect[]>([]);

  const knownSpellsData = useSpells(char?.knownSpells, char?.customSpells);

  if (!char) return null;

  const profBonus = Math.ceil((char.level || 1) / 4) + 1;
  const spellAbility = char.spellcastingAbility || 'cha';
  const spellMod = calcMod(char.stats[spellAbility as keyof typeof char.stats] || 10);
  const spellDC = 8 + profBonus + spellMod;
  const spellAttack = profBonus + spellMod;

  const saveCustomSpell = () => {
    if (!customDraft.name || !customDraft.description) return;
    
    addHomebrewSpell({
      name: customDraft.name || 'Unknown Spell',
      level: customDraft.level || 0,
      school: customDraft.school || 'Evocation',
      castingTime: customDraft.castingTime || '1 action',
      range: customDraft.range || 'Self',
      components: customDraft.components || 'V, S',
      duration: customDraft.duration || 'Instantaneous',
      description: customDraft.description || '',
      damage: customDraft.damage,
      damageType: customDraft.damageType,
      actionCost: (customDraft.actionCost || 'action') as ActionCost,
      classes: [char.class],
      modifiers: spellModifiers.length > 0 ? spellModifiers : undefined,
    });
    
    setIsAddingCustom(false);
    setSpellModifiers([]);
    setCustomDraft({
      name: '', level: 0, school: 'Evocation', castingTime: '1 action',
      range: '60 feet', components: 'V, S', duration: 'Instantaneous',
      description: '', damage: '', damageType: '', actionCost: 'action'
    });
  };

  const removeCustomSpell = (id: string) => {
    // Use homebrew-aware removal if it's a homebrew spell, else legacy
    if (id.startsWith('hb_spell_')) {
      removeHomebrewSpell(id);
    } else {
      updateField('customSpells', (char.customSpells || []).filter(s => s.id !== id));
      updateField('knownSpells', (char.knownSpells || []).filter(s => s !== id));
      updateField('preparedSpells', (char.preparedSpells || []).filter(s => s !== id));
    }
  };

  return (
    <div className={styles.spellsTab}>
      <h2 className={styles.tabTitle}>The Grimoire</h2>
      {!char.spellcaster && <p className={styles.tabSubtitle} style={{ color: '#666' }}>This character is not a primary spellcaster. You can still learn spells.</p>}

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

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #333', paddingBottom: '12px' }}>
        <button 
          onClick={() => setActiveSubTab('mine')}
          style={{ padding: '8px 16px', background: activeSubTab === 'mine' ? '#332211' : 'transparent', color: activeSubTab === 'mine' ? '#cfaa5e' : '#888', border: `1px solid ${activeSubTab === 'mine' ? '#cfaa5e' : 'transparent'}`, borderRadius: '4px', cursor: 'pointer', fontFamily: 'Cinzel, serif' }}
        >
          My Spellbook
        </button>
        <button 
          onClick={() => setActiveSubTab('grimoire')}
          style={{ padding: '8px 16px', background: activeSubTab === 'grimoire' ? '#112233' : 'transparent', color: activeSubTab === 'grimoire' ? '#55aacc' : '#888', border: `1px solid ${activeSubTab === 'grimoire' ? '#55aacc' : 'transparent'}`, borderRadius: '4px', cursor: 'pointer', fontFamily: 'Cinzel, serif' }}
        >
          The Grimoire Archive
        </button>
      </div>

      {activeSubTab === 'mine' ? (
        <>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
            <button 
              onClick={() => setIsAddingCustom(true)}
              style={{ padding: '12px 24px', background: '#332211', border: '1px solid #cfaa5e', color: '#cfaa5e', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Cinzel, serif', fontSize: '16px' }}
            >
              + Write Custom Spell (Homebrew)
            </button>
          </div>

          {isAddingCustom && (
            <div style={{ background: 'rgba(20,20,20,0.8)', border: '1px solid #cfaa5e', borderRadius: '8px', padding: '24px', marginBottom: '32px' }}>
              <h3 style={{ margin: '0 0 16px 0', color: '#cfaa5e' }}>Draft Homebrew Spell</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '16px', marginBottom: '16px' }}>
                <input placeholder="Spell Name" value={customDraft.name} onChange={e => setCustomDraft({...customDraft, name: e.target.value})} style={{ padding: '10px', background: '#111', border: '1px solid #444', color: '#fff' }} />
                <select value={customDraft.level} onChange={e => setCustomDraft({...customDraft, level: parseInt(e.target.value)})} style={{ padding: '10px', background: '#111', border: '1px solid #444', color: '#fff' }}>
                  <option value={0}>Cantrip</option>
                  {[1,2,3,4,5,6,7,8,9].map(l => <option key={l} value={l}>Level {l}</option>)}
                </select>

                <select value={customDraft.school} onChange={e => setCustomDraft({...customDraft, school: e.target.value})} style={{ padding: '10px', background: '#111', border: '1px solid #444', color: '#fff' }}>
                  {SPELL_SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input placeholder="Casting Time (e.g. 1 action)" value={customDraft.castingTime} onChange={e => setCustomDraft({...customDraft, castingTime: e.target.value})} style={{ padding: '10px', background: '#111', border: '1px solid #444', color: '#fff' }} />

                <input placeholder="Range (e.g. 60 feet, Touch)" value={customDraft.range} onChange={e => setCustomDraft({...customDraft, range: e.target.value})} style={{ padding: '10px', background: '#111', border: '1px solid #444', color: '#fff' }} />
                <input placeholder="Duration (e.g. 1 minute, Instantaneous)" value={customDraft.duration} onChange={e => setCustomDraft({...customDraft, duration: e.target.value})} style={{ padding: '10px', background: '#111', border: '1px solid #444', color: '#fff' }} />

                <input placeholder="Components (V, S, M)" value={customDraft.components} onChange={e => setCustomDraft({...customDraft, components: e.target.value})} style={{ padding: '10px', background: '#111', border: '1px solid #444', color: '#fff' }} />
                <input placeholder="Damage/Effect (e.g. 1d8) - Optional" value={customDraft.damage} onChange={e => setCustomDraft({...customDraft, damage: e.target.value})} style={{ padding: '10px', background: '#111', border: '1px solid #444', color: '#fff' }} />
                <select value={customDraft.damageType || ''} onChange={e => setCustomDraft({...customDraft, damageType: e.target.value})} style={{ padding: '10px', background: '#111', border: '1px solid #444', color: '#fff' }}>
                  <option value="">Damage Type (optional)</option>
                  {['acid','bludgeoning','cold','fire','force','lightning','necrotic','piercing','poison','psychic','radiant','slashing','thunder'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <textarea placeholder="Full Spell Description..." value={customDraft.description} onChange={e => setCustomDraft({...customDraft, description: e.target.value})} style={{ width: '100%', height: '100px', padding: '10px', background: '#111', border: '1px solid #444', color: '#fff', marginBottom: '16px' }} />

              <div style={{ marginBottom: '16px' }}>
                <ModifierBuilder value={spellModifiers} onChange={setSpellModifiers} />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={saveCustomSpell} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #cfaa5e, #b8842e)', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>✨ Forge Spell</button>
                <button onClick={() => { setIsAddingCustom(false); setSpellModifiers([]); }} style={{ padding: '10px 20px', background: 'transparent', color: '#888', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Spells Grid */}
          <div>
            <h3 className={styles.sectionHeading}>Known Mágicka</h3>
            {knownSpellsData.length === 0 && <p style={{ color: '#666' }}>Your spellbook is empty. Browse the Grimoire Archive to learn spells.</p>}
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 350px), 1fr))', gap: '20px' }}>
          {knownSpellsData.map(spell => {
            const isPrepared = char.preparedSpells?.includes(spell.id);
            const isCustom = spell.id.startsWith('custom_spell_');
            
            return (
              <div key={spell.id} style={{ position: 'relative' }}>
                <SpellCard 
                  spell={spell}
                  isKnown={true}
                  isPrepared={isPrepared}
                  onPrepareToggle={() => isPrepared ? unprepareSpell(spell.id) : prepareSpell(spell.id)}
                />
                {isCustom && (
                  <button 
                    onClick={() => removeCustomSpell(spell.id)}
                    style={{ position: 'absolute', top: '10px', right: '40px', background: 'rgba(255,50,50,0.2)', border: '1px solid red', color: 'red', borderRadius: '4px', padding: '2px 8px', fontSize: '10px', cursor: 'pointer' }}
                    title="Delete Custom Spell"
                  >
                    Delete Homebrew
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      </>
      ) : (
        <div style={{ height: 'calc(100vh - 250px)' }}>
          <SpellBrowser inline={true} />
        </div>
      )}
    </div>
  );
}
