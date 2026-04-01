'use client';

import React, { useState, useEffect } from 'react';
import { useCharacterStore } from '../lib/store';
import { CLASSES, ABILITY_NAMES, AbilityName } from '../data/srd';
import { STANDARD_FEATS } from '../data/feats';
import { getSpellProgression } from '../lib/magic-system';
import { FeatData } from '../lib/types';
import styles from '../[id]/page.module.css';

interface LevelUpWizardProps {
  onClose: () => void;
}

export default function LevelUpWizard({ onClose }: LevelUpWizardProps) {
  const { char, setChar } = useCharacterStore();
  
  if (!char) return null;
  const newLevel = char.level + 1;
  const isASILevel = [4, 8, 12, 16, 19].includes(newLevel);
  const isCaster = char.spellcaster;

  // Build dynamic steps array
  const steps = ['Vitality', 'Class Features'];
  if (isASILevel) steps.push('Ability Score / Feat');
  if (isCaster) steps.push('Arcane Epiphany');

  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  // -- Step 1 State (Vitality)
  const classData = CLASSES.find(c => c.name.toLowerCase() === char.class.toLowerCase());
  const hitDie = classData?.hitDie || 8;
  const conMod = Math.floor(((char.stats?.con || 10) - 10) / 2);
  const averageHpGain = Math.floor(hitDie / 2) + 1 + conMod;
  
  const [hpRoll, setHpRoll] = useState<number>(averageHpGain);

  // -- Step 2 State (Features)
  const newFeatures = classData?.features.filter(f => f.level === newLevel) || [];
  const oldProf = Math.ceil(char.level / 4) + 1;
  const newProf = Math.ceil(newLevel / 4) + 1;

  // -- Step 3 State (ASI / Feat)
  const [asiMode, setAsiMode] = useState<'stat' | 'feat'>('stat');
  
  // Stat Boost State
  const [statPoints, setStatPoints] = useState(2);
  const [tempStats, setTempStats] = useState({ ...char.stats });
  
  const handleStatIncrease = (stat: AbilityName) => {
    if (statPoints > 0 && tempStats[stat] < 20) {
      setTempStats({ ...tempStats, [stat]: tempStats[stat] + 1 });
      setStatPoints(statPoints - 1);
    }
  };
  const handleStatDecrease = (stat: AbilityName) => {
    if (tempStats[stat] > char.stats[stat]) {
      setTempStats({ ...tempStats, [stat]: tempStats[stat] - 1 });
      setStatPoints(statPoints + 1);
    }
  };

  // Feat State
  const [selectedFeat, setSelectedFeat] = useState<FeatData | null>(null);
  const [customFeatDraft, setCustomFeatDraft] = useState<Partial<FeatData>>({ name: '', description: '' });
  const [isHomebrewFeat, setIsHomebrewFeat] = useState(false);

  // -- Step 4 State (Arcana)
  const oldMagic = getSpellProgression(char.class, char.level);
  const newMagic = getSpellProgression(char.class, newLevel);

  // ── Sealing the Pact ──
  const finishLevelUp = () => {
    const finalMaxHp = char.maxHp + hpRoll;
    let finalStats = { ...tempStats };
    let finalFeats = [...(char.feats || [])];

    if (isASILevel) {
      if (asiMode === 'feat') {
        // Did not use ASI stats, revert to char stats but add feat
        finalStats = { ...char.stats };
        
        let newFeat: FeatData;
        if (isHomebrewFeat && customFeatDraft.name) {
          newFeat = {
            id: 'custom_feat_' + Date.now(),
            name: customFeatDraft.name,
            description: customFeatDraft.description || '',
          };
        } else if (selectedFeat) {
          newFeat = selectedFeat;
          // Apply Half-Feat stats
          if (newFeat.abilityIncrease) {
            Object.keys(newFeat.abilityIncrease).forEach(stat => {
              finalStats[stat as AbilityName] += newFeat.abilityIncrease![stat] || 0;
            });
          }
        } else {
           // Somehow bypassed without picking, skip.
           console.warn("No feat selected");
        }
        
        // @ts-ignore
        if (newFeat) finalFeats.push(newFeat);
      }
    }

    setChar({
      ...char,
      level: newLevel,
      maxHp: finalMaxHp,
      currentHp: finalMaxHp, // Fully restore
      hitDiceTotal: newLevel, // Max Hit Dice = Level usually
      stats: finalStats,
      feats: finalFeats,
      logbook: [
        { id: 'log_'+Date.now(), timestamp: Date.now(), type: 'level_up', description: `Ascended to Level ${newLevel}!`, previousState: null },
        ...char.logbook
      ]
    });
    
    onClose();
  };

  const activeStepName = steps[currentStepIdx];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(5, 5, 8, 0.95)', zIndex: 99999,
      display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif'
    }}>
      {/* Wizard Header Bar */}
      <div style={{ background: '#111', padding: '24px', borderBottom: '2px solid #cfaa5e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, color: '#cfaa5e', fontFamily: 'Cinzel, serif', fontSize: '32px' }}>Ascension</h1>
          <div style={{ color: '#888', marginTop: '8px' }}>Navigating the threshold to Level {newLevel}</div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #444', color: '#fff', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Cancel Ascension</button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Sidebar (Progress) */}
        <div style={{ width: '250px', background: '#0a0a0a', borderRight: '1px solid #333', padding: '32px' }}>
          {steps.map((s, i) => (
            <div key={s} style={{
              padding: '16px', marginBottom: '8px', 
              borderLeft: i === currentStepIdx ? '3px solid #cfaa5e' : '3px solid transparent',
              background: i === currentStepIdx ? '#1a1a1a' : 'transparent',
              color: i === currentStepIdx ? '#cfaa5e' : (i < currentStepIdx ? '#888' : '#444'),
              fontWeight: i === currentStepIdx ? 'bold' : 'normal',
              cursor: 'default'
            }}>
              Step {i + 1}: {s}
            </div>
          ))}
        </div>

        {/* Main Content Pane */}
        <div style={{ flex: 1, padding: '48px', overflowY: 'auto' }}>
          
          {/* STEP 1: VITALITY */}
          {activeStepName === 'Vitality' && (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <h2 style={{ fontFamily: 'Cinzel, serif', color: '#fff', borderBottom: '1px solid #333', paddingBottom: '16px' }}>Vitality Infusion</h2>
              <p style={{ color: '#aaa', fontSize: '18px', lineHeight: '1.6' }}>Your maximum hit points increase. You roll a <strong>d{hitDie}</strong> (your class hit die) and add your Constitution modifier (+{conMod}).</p>
              
              <div style={{ display: 'flex', gap: '24px', marginTop: '32px' }}>
                <div style={{ flex: 1, background: '#111', border: '1px solid #444', borderRadius: '8px', padding: '32px', textAlign: 'center' }}>
                  <div style={{ color: '#888', marginBottom: '16px' }}>Average Yield</div>
                  <div style={{ fontSize: '48px', color: '#cfaa5e', fontWeight: 'bold' }}>+{averageHpGain}</div>
                  <button 
                    onClick={() => setHpRoll(averageHpGain)} 
                    style={{ marginTop: '16px', width: '100%', padding: '12px', background: hpRoll === averageHpGain ? '#2a1f11' : '#222', border: `1px solid ${hpRoll === averageHpGain ? '#cfaa5e' : '#444'}`, color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>
                    Take Average
                  </button>
                </div>

                <div style={{ flex: 1, background: '#111', border: '1px solid #444', borderRadius: '8px', padding: '32px', textAlign: 'center' }}>
                  <div style={{ color: '#888', marginBottom: '16px' }}>Manual Roll</div>
                  <input 
                    type="number" 
                    value={hpRoll} 
                    onChange={e => setHpRoll(parseInt(e.target.value) || 0)} 
                    style={{ fontSize: '48px', color: '#cfaa5e', fontWeight: 'bold', width: '100%', background: 'transparent', border: 'none', textAlign: 'center', outline: 'none' }} 
                  />
                  <div style={{ marginTop: '16px', padding: '12px', color: '#888', fontSize: '14px' }}>
                    Enter raw dice result
                  </div>
                </div>
              </div>
              
              <div style={{ marginTop: '32px', padding: '24px', background: '#112', border: '1px solid #224', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '18px', color: '#88a' }}>New Maximum HP</span>
                <span style={{ fontSize: '24px', color: '#aaf', fontWeight: 'bold' }}>{char.maxHp} → {char.maxHp + hpRoll}</span>
              </div>
            </div>
          )}

          {/* STEP 2: CLASS FEATURES */}
          {activeStepName === 'Class Features' && (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <h2 style={{ fontFamily: 'Cinzel, serif', color: '#fff', borderBottom: '1px solid #333', paddingBottom: '16px' }}>New Class Features</h2>
              
              {newProf > oldProf && (
                <div style={{ padding: '24px', background: 'rgba(200, 150, 50, 0.1)', border: '1px solid #cfaa5e', borderRadius: '8px', marginBottom: '24px' }}>
                  <h3 style={{ margin: '0 0 8px 0', color: '#cfaa5e' }}>Proficiency Bonus Increased</h3>
                  <p style={{ margin: 0, color: '#ccc' }}>Your overall competency has improved. Your proficiency bonus is now <strong>+{newProf}</strong> (up from +{oldProf}). This improves your attacks, saving throws, and skilled checks.</p>
                </div>
              )}

              {newFeatures.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', background: '#111', borderRadius: '8px', border: '1px solid #333' }}>
                  <p style={{ color: '#888', fontSize: '18px' }}>You gain no explicit major class mechanics at this level. You instead focus on refining your core techniques.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {newFeatures.map(f => (
                    <div key={f.name} style={{ background: '#111', padding: '24px', borderRadius: '8px', border: '1px solid #333' }}>
                      <h4 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '20px' }}>{f.name}</h4>
                      <p style={{ margin: 0, color: '#aaa', lineHeight: '1.6' }}>{f.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: ASI / FEAT */}
          {activeStepName === 'Ability Score / Feat' && (
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              <h2 style={{ fontFamily: 'Cinzel, serif', color: '#fff', borderBottom: '1px solid #333', paddingBottom: '16px' }}>Heroic Advancement</h2>
              
              <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
                <button onClick={() => setAsiMode('stat')} style={{ flex: 1, padding: '16px', background: asiMode === 'stat' ? '#332211' : '#111', color: asiMode === 'stat' ? '#cfaa5e' : '#888', border: `1px solid ${asiMode === 'stat' ? '#cfaa5e' : '#444'}`, borderRadius: '8px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}>
                  Ability Score Improvement
                </button>
                <button onClick={() => setAsiMode('feat')} style={{ flex: 1, padding: '16px', background: asiMode === 'feat' ? '#112233' : '#111', color: asiMode === 'feat' ? '#55aacc' : '#888', border: `1px solid ${asiMode === 'feat' ? '#55aacc' : '#444'}`, borderRadius: '8px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}>
                  Choose a Feat
                </button>
              </div>

              {asiMode === 'stat' && (
                <div style={{ background: '#111', padding: '32px', borderRadius: '8px', border: '1px solid #333' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px dashed #444', paddingBottom: '16px' }}>
                    <span style={{ fontSize: '18px', color: '#ccc' }}>Available Points</span>
                    <span style={{ fontSize: '32px', color: '#cfaa5e', fontWeight: 'bold' }}>{statPoints}</span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
                    {ABILITY_NAMES.map(ability => (
                      <div key={ability.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a', padding: '16px', borderRadius: '8px', border: tempStats[ability.key] > char.stats[ability.key] ? '1px solid #cfaa5e' : '1px solid #333' }}>
                        <div>
                          <div style={{ color: '#fff', fontWeight: 'bold' }}>{ability.label}</div>
                          <div style={{ color: '#888', fontSize: '14px' }}>Base: {char.stats[ability.key]}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <button onClick={() => handleStatDecrease(ability.key)} disabled={tempStats[ability.key] === char.stats[ability.key]} style={{ background: '#331111', border: '1px solid #552222', color: '#ff4444', width: '30px', height: '30px', borderRadius: '4px', cursor: tempStats[ability.key] === char.stats[ability.key] ? 'not-allowed' : 'pointer' }}>-</button>
                          <span style={{ fontSize: '24px', color: '#fff', width: '30px', textAlign: 'center' }}>{tempStats[ability.key]}</span>
                          <button onClick={() => handleStatIncrease(ability.key)} disabled={statPoints === 0 || tempStats[ability.key] === 20} style={{ background: '#113311', border: '1px solid #225522', color: '#44ff44', width: '30px', height: '30px', borderRadius: '4px', cursor: (statPoints === 0 || tempStats[ability.key] === 20) ? 'not-allowed' : 'pointer' }}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {asiMode === 'feat' && (
                <div style={{ background: '#111', padding: '32px', borderRadius: '8px', border: '1px solid #333' }}>
                  
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                    <button onClick={() => setIsHomebrewFeat(false)} style={{ padding: '8px 16px', background: !isHomebrewFeat ? '#444' : '#222', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Standard Feats</button>
                    <button onClick={() => setIsHomebrewFeat(true)} style={{ padding: '8px 16px', background: isHomebrewFeat ? '#444' : '#222', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Custom Homebrew</button>
                  </div>

                  {!isHomebrewFeat ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '16px', maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
                      {STANDARD_FEATS.map(feat => {
                        const isSelected = selectedFeat?.id === feat.id;
                        return (
                          <div 
                            key={feat.id} 
                            onClick={() => setSelectedFeat(feat)}
                            style={{ padding: '16px', background: isSelected ? '#1a2a3a' : '#1a1a1a', border: isSelected ? '1px solid #55aacc' : '1px solid #333', borderRadius: '8px', cursor: 'pointer' }}
                          >
                            <h4 style={{ margin: '0 0 8px 0', color: isSelected ? '#55aacc' : '#ccc', fontSize: '18px' }}>{feat.name}</h4>
                            {feat.prerequisite && <div style={{ fontSize: '12px', color: '#a66', marginBottom: '8px' }}>Prerequisite: {feat.prerequisite}</div>}
                            <p style={{ margin: 0, color: '#888', fontSize: '14px', lineHeight: '1.5' }}>{feat.description}</p>
                            {feat.abilityIncrease && (
                               <div style={{ marginTop: '8px', fontSize: '12px', color: '#5a5' }}>Grants: {Object.keys(feat.abilityIncrease).map(k => `+${feat.abilityIncrease![k]} ${k.toUpperCase()}`).join(', ')}</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div>
                      <input 
                        type="text" 
                        placeholder="Feat Name" 
                        value={customFeatDraft.name} 
                        onChange={e => setCustomFeatDraft({...customFeatDraft, name: e.target.value})}
                        style={{ width: '100%', padding: '12px', background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px', marginBottom: '16px' }} 
                      />
                      <textarea 
                        placeholder="Detailed feat description and mechanics..." 
                        value={customFeatDraft.description}
                        onChange={e => setCustomFeatDraft({...customFeatDraft, description: e.target.value})}
                        style={{ width: '100%', height: '150px', padding: '12px', background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px' }} 
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: ARCANE EPIPHANY */}
          {activeStepName === 'Arcane Epiphany' && (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <h2 style={{ fontFamily: 'Cinzel, serif', color: '#fff', borderBottom: '1px solid #333', paddingBottom: '16px' }}>Arcane Expansion</h2>
              <p style={{ color: '#aaa', fontSize: '18px', lineHeight: '1.6', marginBottom: '32px' }}>Your magical reserves and mastery deepen. You have unlocked new capacities in your Grimoire.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '16px' }}>
                <div style={{ background: '#111', padding: '24px', borderRadius: '8px', border: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '18px', color: '#ccc' }}>Caster Level Limit</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>The highest spell level you can cast</div>
                  </div>
                  <div style={{ fontSize: '24px', color: newMagic.maxSpellLevel > oldMagic.maxSpellLevel ? '#55aacc' : '#888', fontWeight: 'bold' }}>
                    {oldMagic.maxSpellLevel} → {newMagic.maxSpellLevel}
                  </div>
                </div>

                <div style={{ background: '#111', padding: '24px', borderRadius: '8px', border: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '18px', color: '#ccc' }}>Spells Capacity</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Your total theoretical spell library allowance</div>
                  </div>
                  <div style={{ fontSize: '24px', color: newMagic.spellsKnown > oldMagic.spellsKnown ? '#55aacc' : '#888', fontWeight: 'bold' }}>
                    {oldMagic.spellsKnown} → {newMagic.spellsKnown}
                  </div>
                </div>
                
                <div style={{ background: '#111', padding: '24px', borderRadius: '8px', border: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '18px', color: '#ccc' }}>Cantrips Known</div>
                  </div>
                  <div style={{ fontSize: '24px', color: newMagic.cantripsKnown > oldMagic.cantripsKnown ? '#55aacc' : '#888', fontWeight: 'bold' }}>
                    {oldMagic.cantripsKnown} → {newMagic.cantripsKnown}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '32px', padding: '16px', background: 'rgba(85, 170, 204, 0.1)', border: '1px solid #55aacc', borderRadius: '8px', color: '#55aacc', textAlign: 'center' }}>
                <strong>Note:</strong> You will pick your new spells in your Grimoire Archive tab after formalizing your Level Up.
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Footer Controls */}
      <div style={{ background: '#111', padding: '24px 32px', borderTop: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
           {currentStepIdx > 0 && (
             <button onClick={() => setCurrentStepIdx(i => i - 1)} style={{ padding: '12px 24px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}>← Reverse</button>
           )}
        </div>

        <div>
          {currentStepIdx < steps.length - 1 ? (
             <button onClick={() => setCurrentStepIdx(i => i + 1)} style={{ padding: '12px 32px', background: '#332211', color: '#cfaa5e', border: '1px solid #cfaa5e', borderRadius: '4px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', fontFamily: 'Cinzel, serif' }}>Continue →</button>
          ) : (
            <button onClick={finishLevelUp} style={{ padding: '12px 48px', background: '#cfaa5e', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold', fontFamily: 'Cinzel, serif' }}>Seal the Pact (Finish)</button>
          )}
        </div>
      </div>
    </div>
  );
}
