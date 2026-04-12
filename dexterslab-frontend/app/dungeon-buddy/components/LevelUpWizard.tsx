'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCharacterStore } from '../lib/store';
import { CLASSES, ClassData } from '../data/srd';
import SpellBrowser from './SpellBrowser';
import { getSubclassFeaturesAtLevel, getSubclassFeaturesUpToLevel, SUBCLASS_FEATURES } from '../data/subclass-features';
import { METAMAGIC_OPTIONS, MANEUVER_OPTIONS, FIGHTING_STYLE_OPTIONS } from '../data/resource-scaling';

interface Props {
  onClose: () => void;
}

const SPELL_SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];

export default function LevelUpWizard({ onClose }: Props) {
  const { char, completeLevelUp } = useCharacterStore();
  const [step, setStep] = useState(0);

  // Core Level Math (BG3 Framework)
  const nextLevel = (char?.level || 1) + 1;
  const [targetClass, setTargetClass] = useState<string>(char?.class || 'Fighter');
  // Need to force derived class re-reads
  const tClassData = CLASSES.find(c => c.name === targetClass);
  const TargetClassLevelFallback = char?.class === targetClass ? (char?.level || 1) : 0;
  const targetClassLevel = (char?.classes?.[targetClass] || TargetClassLevelFallback) + 1;

  const conMod = Math.floor(((char?.stats?.con || 10) - 10) / 2);
  const hitDie = tClassData?.hitDie || 8;
  const avgHp = Math.ceil(hitDie / 2) + 1;
  
  // State: HP
  const [hpRoll, setHpRoll] = useState(avgHp);
  useEffect(() => setHpRoll(avgHp), [avgHp, targetClass]);
  
  // State: Subclass
  const needsSubclass = !!(tClassData && typeof tClassData.subclassLevel === 'number' && tClassData.subclassLevel <= targetClassLevel && !(char?.subclasses && char.subclasses[targetClass]));
  const [subclassChoice, setSubclassChoice] = useState('');
  const [isOracleForging, setIsOracleForging] = useState(false);
  const [oracleTheme, setOracleTheme] = useState('');

  // State: ASI / Feat
  const needsAsi = tClassData?.asiLevels?.includes(targetClassLevel);
  const [asiMode, setAsiMode] = useState<'asi'|'feat'>('asi');
  const [asiAlloc, setAsiAlloc] = useState({str:0, dex:0, con:0, int:0, wis:0, cha:0});
  const [customFeat, setCustomFeat] = useState({ name: '', description: '' });

  // State: Custom Homebrew / Choices
  const [customFeatures, setCustomFeatures] = useState<{name: string, description: string}[]>([]);

  // State: Subclass Choices (Metamagic picks, Maneuver picks, Totem animals, etc.)
  const [selectedMetamagic, setSelectedMetamagic] = useState<string[]>([]);
  const [selectedManeuvers, setSelectedManeuvers] = useState<string[]>([]);
  const [selectedTotem, setSelectedTotem] = useState<string>('');
  const [selectedFightingStyle, setSelectedFightingStyle] = useState<string>('');
  const [selectedDraconicAncestry, setSelectedDraconicAncestry] = useState<string>('');
  const [selectedLandType, setSelectedLandType] = useState<string>('');

  // State: Spells Step
  const needsSpells = !!tClassData?.spellcaster;
  const [learnedSpells, setLearnedSpells] = useState<string[]>([]);
  const [isAddingCustomSpell, setIsAddingCustomSpell] = useState(false);
  const [customDraft, setCustomDraft] = useState({ name:'', level:1, school:'Evocation', castingTime:'1 Action', range:'60 feet', components:'V, S', duration:'Instantaneous', damage:'', description:'' });
  const [addedCustomSpells, setAddedCustomSpells] = useState<any[]>([]);

  // 5E Spell Learning Limits
  // Base default: 1 spell per level for Sorcerer/Bard/Warlock/Ranger. 2 for Wizard.
  // We use 0 for prep casters unless it's a specific cantrip level, but to simplify we'll bound them to 1 if the step appears.
  const isPrepCaster = ['Cleric', 'Druid', 'Paladin'].includes(targetClass);
  const maxDraftSpells = isPrepCaster ? 0 : (targetClass === 'Wizard' ? 2 : 1);
  const numDrafted = learnedSpells.length + addedCustomSpells.length;

  // Portal mount check
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!char) return null;
  if (!mounted) return null;

  const classFeatures = tClassData?.features.filter(f => f.level === targetClassLevel) || [];
  
  const stepsList = ['Ascension Path', 'Health'];
  if (needsSubclass) stepsList.push('Subclass');

  // Check if current level has subclass features with choices
  const existingSubclass = char?.subclasses?.[targetClass] || (char?.class === targetClass ? char?.subclass : null);
  const activeSubclassName = needsSubclass ? subclassChoice : existingSubclass;
  const subclassFeaturesThisLevel = activeSubclassName
    ? getSubclassFeaturesAtLevel(targetClass, activeSubclassName, targetClassLevel)
    : [];
  const hasSubclassChoices = subclassFeaturesThisLevel.some(f => f.choiceType);
  if (hasSubclassChoices && activeSubclassName) stepsList.push('Subclass Choices');

  if (needsAsi) stepsList.push('ASI or Feat');
  if (needsSpells) stepsList.push('Grimoire (Spells)');
  stepsList.push('Class Features');
  stepsList.push('Review');

  const saveCustomSpell = () => {
    if (!customDraft.name.trim()) return;
    if (numDrafted >= maxDraftSpells && !isPrepCaster) {
      alert(`You have already reached your limit of ${maxDraftSpells} drafted spell(s) this level.`);
      return;
    }
    const newSpell = {
      ...customDraft,
      id: 'custom_spell_' + Date.now(),
      classes: [targetClass],
      actionCost: 'action'
    };
    setAddedCustomSpells([...addedCustomSpells, newSpell]);
    setIsAddingCustomSpell(false);
    setCustomDraft({ name:'', level:1, school:'Evocation', castingTime:'1 Action', range:'60 feet', components:'V, S', duration:'Instantaneous', damage:'', description:'' });
  };

  const handleToggleDraft = (spellId: string) => {
    if (learnedSpells.includes(spellId)) {
       setLearnedSpells(learnedSpells.filter(id => id !== spellId));
    } else {
       if (numDrafted >= maxDraftSpells && !isPrepCaster) {
         alert(`You can only draft ${maxDraftSpells} new spell(s) at this level per 5E rules.`);
         return;
       }
       setLearnedSpells([...learnedSpells, spellId]);
    }
  };

  const invokeOracleSubclass = async () => {
    setIsOracleForging(true);
    try {
      const res = await fetch('/api/dungeon-buddy/oracle/forge-subclass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: oracleTheme, charClass: targetClass, nextLevel: targetClassLevel })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setSubclassChoice(data.subclassName || 'Oracle Path');
      if (data.features && data.features.length > 0) {
        setCustomFeatures([
           ...customFeatures, 
           ...data.features.map((f:any) => ({ name: f.name, description: f.description }))
        ]);
      }
    } catch (err: any) {
      alert("Oracle Failed: " + err.message);
    } finally {
      setIsOracleForging(false);
    }
  };

  // Fetch subclass data for the OLD srd.ts preview (dropdown list still comes from there)
  const activeSubclassData = tClassData?.subclasses?.find(sc => sc.name === activeSubclassName);
  // But features come from the NEW subclass-features.ts (with modifiers!)
  // subclassFeaturesThisLevel is now defined above using getSubclassFeaturesAtLevel

  const finalizeLevelUp = () => {
    let payload: any = {
      newLevel: nextLevel,
      targetClass: targetClass,
      hpIncrease: hpRoll + conMod,
      addedFeatures: [
         ...classFeatures,
         ...subclassFeaturesThisLevel,
         ...customFeatures.map(f => ({ name: f.name || 'Custom Feature', description: f.description, level: targetClassLevel }))
      ],
      learnedSpells,
      addedCustomSpells
    };

    if (needsSubclass && subclassChoice.trim()) {
      payload.subclassChoice = subclassChoice.trim();
      payload.addedFeatures.push({ name: `${payload.subclassChoice}`, description: `Chosen Path at ${targetClass} Level ${targetClassLevel}`, level: targetClassLevel });
    }

    // Inject subclass choice selections into payload
    const choicesUpdate: Record<string, any> = {};
    if (selectedMetamagic.length > 0) {
      choicesUpdate.metamagic = selectedMetamagic;
      // Create metamagic_option modifiers for each selected option
      for (const mmId of selectedMetamagic) {
        const opt = METAMAGIC_OPTIONS.find(o => o.id === mmId);
        if (opt) {
          payload.addedFeatures.push({
            name: opt.name, description: opt.description, level: targetClassLevel,
            source: 'Metamagic',
            modifiers: [{ type: 'metamagic_option', optionId: mmId, name: opt.name, cost: opt.cost, effect: opt.effect }]
          });
        }
      }
    }
    if (selectedManeuvers.length > 0) {
      choicesUpdate.maneuvers = selectedManeuvers;
      for (const manId of selectedManeuvers) {
        const opt = MANEUVER_OPTIONS.find(o => o.id === manId);
        if (opt) {
          payload.addedFeatures.push({
            name: opt.name, description: opt.description, level: targetClassLevel,
            source: 'Battle Master',
            modifiers: [{ type: 'maneuver_option', optionId: manId, name: opt.name, dice: 'd8', effect: opt.effect }]
          });
        }
      }
    }
    if (selectedTotem) choicesUpdate.totem = selectedTotem;
    if (selectedFightingStyle) choicesUpdate.fightingStyle = selectedFightingStyle;
    if (selectedDraconicAncestry) choicesUpdate.draconicAncestry = selectedDraconicAncestry;
    if (selectedLandType) choicesUpdate.landType = selectedLandType;
    if (Object.keys(choicesUpdate).length > 0) {
      payload.subclassChoicesUpdate = choicesUpdate;
    }

    if (needsAsi) {
      if (asiMode === 'asi') {
        payload.asiChoice = asiAlloc;
      } else {
        payload.featChoice = { name: customFeat.name || 'Custom Feat', description: customFeat.description, abilityIncrease: {} };
      }
    }

    // Unified Slot Math
    if (tClassData?.spellSlots && tClassData.spellSlots[targetClassLevel]) {
      const currentSlotsArr = tClassData.spellSlots[targetClassLevel] as number[];
      const previousSlotsArr = (targetClassLevel > 1 && tClassData.spellSlots[targetClassLevel-1]) ? (tClassData.spellSlots[targetClassLevel-1] as number[]) : [];
      
      const newSlots: Record<string, any> = {};
      currentSlotsArr.forEach((count, idx) => {
        const prevCount = previousSlotsArr[idx] || 0;
        const delta = count - prevCount;
        if (delta > 0) {
          const sLevel = idx + 1;
          const key = `spell_slot_${sLevel}`;
          const existingMax = char.resources?.[key]?.max || 0;
          newSlots[key] = {
            name: `Level ${sLevel} Spell Slots`,
            max: existingMax + delta,
            used: char.resources?.[key]?.used || 0,
            recharge: targetClass.toLowerCase() === 'warlock' ? 'short' : 'long'
          };
        }
      });
      payload.overrideSpellSlots = newSlots;
    }

    completeLevelUp(payload);
    onClose();
  };

  const asiPointsTotal = Object.values(asiAlloc).reduce((a,b)=>a+b, 0);

  const renderStep = () => {
    const currentView = stepsList[step];

    if (currentView === 'Ascension Path') {
      return (
        <div style={{ animation: 'fadeIn 0.3s' }}>
          <h3 style={{ color: '#cfaa5e', fontFamily: 'Cinzel', marginBottom: '8px' }}>Ascension Path</h3>
          <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '16px' }}>Select the discipline you wish to advance. Total Character Level: {nextLevel}</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {CLASSES.map(cls => {
               const isActiveClasses = char.classes ? !!char.classes[cls.name] : cls.name === char.class;
               const cLvl = (char.classes?.[cls.name] || (char.class === cls.name ? char.level : 0));
               
               return (
                 <button
                   key={cls.name}
                   onClick={() => setTargetClass(cls.name)}
                   style={{
                     padding: '16px',
                     background: targetClass === cls.name ? '#cfaa5e' : (isActiveClasses ? '#112233' : '#111'),
                     color: targetClass === cls.name ? '#000' : '#fff',
                     border: `1px solid ${targetClass === cls.name ? '#fff' : '#444'}`,
                     borderRadius: '8px',
                     cursor: 'pointer',
                     textAlign: 'left',
                     fontFamily: 'Cinzel, serif'
                   }}
                 >
                   <div style={{ fontWeight: 'bold' }}>{cls.name}</div>
                   <div style={{ fontSize: '12px', opacity: 0.8 }}>
                     {isActiveClasses ? `Level ${cLvl} → ${cLvl + 1}` : 'New Class'}
                   </div>
                 </button>
               )
            })}
          </div>
        </div>
      );
    }

    if (currentView === 'Health') {
      return (
        <div style={{ animation: 'fadeIn 0.3s' }}>
          <h3 style={{ color: '#cfaa5e', fontFamily: 'Cinzel', marginBottom: '8px' }}>Hit Points Overlay</h3>
          <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '16px' }}>Advancing in <strong>{targetClass}</strong> grants you a <strong>d{hitDie}</strong> Hit Die.</p>
          
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', background: '#111', padding: '16px', borderRadius: '8px', border: '1px solid #333' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Base HP Roll</label>
              <input type="number" min={1} max={hitDie} value={hpRoll} onChange={e => setHpRoll(parseInt(e.target.value) || 1)}
                style={{ width: '100%', padding: '12px', background: '#000', border: '1px solid #444', color: '#cfaa5e', fontSize: '20px', textAlign: 'center', fontFamily: 'Cinzel' }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button onClick={() => setHpRoll(avgHp)} style={{ flex: 1, padding: '4px', background: '#222', border: '1px solid #444', color: '#aaa', cursor: 'pointer', fontSize:'12px' }}>Avg ({avgHp})</button>
                <button onClick={() => setHpRoll(Math.floor(Math.random() * hitDie) + 1)} style={{ flex: 1, padding: '4px', background: '#222', border: '1px solid #cfaa5e', color: '#cfaa5e', cursor: 'pointer', fontSize:'12px' }}>Roll D{hitDie}</button>
              </div>
            </div>
            
            <div style={{ fontSize: '24px', color: '#555' }}>+</div>
            
            <div style={{ flex: 1, textAlign: 'center' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>CON Modifier</label>
              <div style={{ padding: '12px', background: '#0a0a0a', border: '1px dashed #333', color: '#fff', fontSize: '20px', fontFamily: 'Cinzel' }}>
                {conMod >= 0 ? '+' : ''}{conMod}
              </div>
            </div>
          </div>
          
          <div style={{ textAlign: 'center', marginTop: '20px', padding: '12px', background: 'rgba(50, 200, 50, 0.1)', border: '1px solid #3c5', borderRadius: '4px' }}>
             <span style={{ fontSize: '14px', color: '#8c8' }}>New Max HP increases by:</span>
             <div style={{ fontSize: '32px', color: '#5f5', fontFamily: 'Cinzel', fontWeight: 'bold' }}>{hpRoll + conMod}</div>
          </div>
        </div>
      );
    }

    if (currentView === 'Subclass') {
      return (
        <div style={{ animation: 'fadeIn 0.3s' }}>
          <h3 style={{ color: '#cfaa5e', fontFamily: 'Cinzel', marginBottom: '8px' }}>Select {tClassData?.subclassLabel || 'Subclass'}</h3>
          <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '16px' }}>At this level, you choose a defining path for your character.</p>
          
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Standard Path</label>
            <select 
               value={subclassChoice} 
               onChange={e => setSubclassChoice(e.target.value)}
               style={{ width: '100%', padding: '12px', background: '#111', border: '1px solid #cfaa5e', color: '#fff', fontSize: '16px' }}
            >
              <option value="">-- Choose Path --</option>
              {tClassData?.subclasses?.map((sc:any) => (
                <option key={sc.id} value={sc.name}>{sc.name}</option>
              ))}
            </select>
          </div>

          {activeSubclassData && (
            <div style={{ padding: '16px', background: 'rgba(207, 170, 94, 0.1)', border: '1px solid #cfaa5e', borderRadius: '8px', marginBottom: '24px' }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#cfaa5e', fontFamily: 'Cinzel, serif', fontSize: '18px' }}>{activeSubclassData.name} Overview</h4>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#ccc', fontStyle: 'italic', lineHeight: 1.5 }}>
                 {activeSubclassData.description}
              </p>
              
              <h5 style={{ margin: '0 0 8px 0', color: '#55aacc', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '1px' }}>Features Granted Now (Level {targetClassLevel})</h5>
              {subclassFeaturesThisLevel.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '16px', color: '#ddd', fontSize: '12px' }}>
                  {subclassFeaturesThisLevel.map(f => (
                    <li key={f.name} style={{ marginBottom: '6px' }}><strong>{f.name}:</strong> {f.description}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: '12px', color: '#888', fontStyle: 'italic', margin: 0 }}>This path grants standard proficiencies or spell access. Refer to deeper levels for explicit features.</p>
              )}
            </div>
          )}

          <div style={{ borderTop: '1px dashed #333', paddingTop: '16px' }}>
             <h4 style={{ color: '#55aacc', fontFamily: 'Cinzel', marginBottom: '8px' }}>Or Forge Thy Fate (AI Path)</h4>
             <p style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>Briefly describe a thematic homebrew path and let the Oracle build it mechanically.</p>
             <div style={{ display: 'flex', gap: '8px' }}>
               <input 
                 value={oracleTheme} 
                 onChange={e => setOracleTheme(e.target.value)} 
                 placeholder="e.g. A blood-magic knight who sacrifices HP for damage"
                 style={{ flex: 1, padding: '10px', background: '#000', border: '1px solid #55aacc', color: '#fff' }}
                 disabled={isOracleForging}
               />
               <button 
                 onClick={invokeOracleSubclass}
                 disabled={isOracleForging || !oracleTheme.trim()}
                 style={{ padding: '10px 16px', background: '#55aacc', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
               >
                 {isOracleForging ? 'Forging...' : 'Invoke Oracle'}
               </button>
             </div>
          </div>
        </div>
      );
    }

    if (currentView === 'Subclass Choices') {
      const choiceFeatures = subclassFeaturesThisLevel.filter(f => f.choiceType);
      const TOTEM_OPTIONS = ['Bear', 'Eagle', 'Elk', 'Tiger', 'Wolf'];
      const DRACONIC_OPTIONS = ['Black (Acid)', 'Blue (Lightning)', 'Brass (Fire)', 'Bronze (Lightning)', 'Copper (Acid)', 'Gold (Fire)', 'Green (Poison)', 'Red (Fire)', 'Silver (Cold)', 'White (Cold)'];
      const LAND_OPTIONS = ['Arctic', 'Coast', 'Desert', 'Forest', 'Grassland', 'Mountain', 'Swamp', 'Underdark'];
      
      return (
        <div style={{ animation: 'fadeIn 0.3s' }}>
          <h3 style={{ color: '#cfaa5e', fontFamily: 'Cinzel', marginBottom: '8px' }}>Subclass Choices</h3>
          <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '16px' }}>Your subclass grants choices at this level. Select your options below.</p>
          
          {choiceFeatures.map(feature => {
            if (feature.choiceType === 'metamagic') {
              return (
                <div key={feature.name} style={{ marginBottom: '24px' }}>
                  <h4 style={{ color: '#b9a', fontFamily: 'Cinzel', marginBottom: '8px' }}>{feature.name} — Pick {feature.choiceCount || 2}</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                    {METAMAGIC_OPTIONS.map(opt => {
                      const isSelected = selectedMetamagic.includes(opt.id);
                      return (
                        <button key={opt.id} onClick={() => {
                          if (isSelected) setSelectedMetamagic(selectedMetamagic.filter(id => id !== opt.id));
                          else if (selectedMetamagic.length < (feature.choiceCount || 2)) setSelectedMetamagic([...selectedMetamagic, opt.id]);
                        }} style={{
                          padding: '10px', background: isSelected ? 'rgba(185, 153, 170, 0.3)' : '#111',
                          border: `1px solid ${isSelected ? '#b9a' : '#333'}`, borderRadius: '6px',
                          color: isSelected ? '#fff' : '#aaa', cursor: 'pointer', textAlign: 'left', fontSize: '12px'
                        }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '4px', color: isSelected ? '#b9a' : '#ddd' }}>{opt.name} ({opt.cost} SP)</div>
                          <div style={{ opacity: 0.8 }}>{opt.effect}</div>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#888' }}>Selected: {selectedMetamagic.length} / {feature.choiceCount || 2}</div>
                </div>
              );
            }
            if (feature.choiceType === 'maneuver') {
              return (
                <div key={feature.name} style={{ marginBottom: '24px' }}>
                  <h4 style={{ color: '#7cc', fontFamily: 'Cinzel', marginBottom: '8px' }}>{feature.name} — Pick {feature.choiceCount || 3}</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                    {MANEUVER_OPTIONS.map(opt => {
                      const isSelected = selectedManeuvers.includes(opt.id);
                      return (
                        <button key={opt.id} onClick={() => {
                          if (isSelected) setSelectedManeuvers(selectedManeuvers.filter(id => id !== opt.id));
                          else if (selectedManeuvers.length < (feature.choiceCount || 3)) setSelectedManeuvers([...selectedManeuvers, opt.id]);
                        }} style={{
                          padding: '10px', background: isSelected ? 'rgba(119, 204, 204, 0.2)' : '#111',
                          border: `1px solid ${isSelected ? '#7cc' : '#333'}`, borderRadius: '6px',
                          color: isSelected ? '#fff' : '#aaa', cursor: 'pointer', textAlign: 'left', fontSize: '12px'
                        }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '4px', color: isSelected ? '#7cc' : '#ddd' }}>{opt.name}</div>
                          <div style={{ opacity: 0.8 }}>{opt.effect}</div>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#888' }}>Selected: {selectedManeuvers.length} / {feature.choiceCount || 3}</div>
                </div>
              );
            }
            if (feature.choiceType === 'totem') {
              return (
                <div key={feature.name} style={{ marginBottom: '24px' }}>
                  <h4 style={{ color: '#8b6', fontFamily: 'Cinzel', marginBottom: '8px' }}>{feature.name}</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {TOTEM_OPTIONS.map(opt => (
                      <button key={opt} onClick={() => setSelectedTotem(opt)} style={{
                        padding: '12px 20px', background: selectedTotem === opt ? 'rgba(136, 187, 102, 0.3)' : '#111',
                        border: `1px solid ${selectedTotem === opt ? '#8b6' : '#333'}`, borderRadius: '6px',
                        color: selectedTotem === opt ? '#fff' : '#aaa', cursor: 'pointer', fontWeight: selectedTotem === opt ? 'bold' : 'normal'
                      }}>{opt}</button>
                    ))}
                  </div>
                </div>
              );
            }
            if (feature.choiceType === 'fighting_style') {
              const applicableStyles = FIGHTING_STYLE_OPTIONS.filter(fs => fs.classes.includes(targetClass));
              return (
                <div key={feature.name} style={{ marginBottom: '24px' }}>
                  <h4 style={{ color: '#c97', fontFamily: 'Cinzel', marginBottom: '8px' }}>{feature.name}</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                    {applicableStyles.map(opt => (
                      <button key={opt.id} onClick={() => setSelectedFightingStyle(opt.id)} style={{
                        padding: '10px', background: selectedFightingStyle === opt.id ? 'rgba(204, 153, 119, 0.3)' : '#111',
                        border: `1px solid ${selectedFightingStyle === opt.id ? '#c97' : '#333'}`, borderRadius: '6px',
                        color: selectedFightingStyle === opt.id ? '#fff' : '#aaa', cursor: 'pointer', textAlign: 'left', fontSize: '12px'
                      }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{opt.name}</div>
                        <div style={{ opacity: 0.8 }}>{opt.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            }
            if (feature.choiceType === 'draconic_ancestry') {
              return (
                <div key={feature.name} style={{ marginBottom: '24px' }}>
                  <h4 style={{ color: '#e83', fontFamily: 'Cinzel', marginBottom: '8px' }}>{feature.name}</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
                    {DRACONIC_OPTIONS.map(opt => (
                      <button key={opt} onClick={() => setSelectedDraconicAncestry(opt)} style={{
                        padding: '10px', background: selectedDraconicAncestry === opt ? 'rgba(238, 136, 51, 0.3)' : '#111',
                        border: `1px solid ${selectedDraconicAncestry === opt ? '#e83' : '#333'}`, borderRadius: '6px',
                        color: selectedDraconicAncestry === opt ? '#fff' : '#aaa', cursor: 'pointer', fontWeight: selectedDraconicAncestry === opt ? 'bold' : 'normal'
                      }}>{opt}</button>
                    ))}
                  </div>
                </div>
              );
            }
            if (feature.choiceType === 'land_type') {
              return (
                <div key={feature.name} style={{ marginBottom: '24px' }}>
                  <h4 style={{ color: '#6b8', fontFamily: 'Cinzel', marginBottom: '8px' }}>{feature.name}</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {LAND_OPTIONS.map(opt => (
                      <button key={opt} onClick={() => setSelectedLandType(opt)} style={{
                        padding: '12px 20px', background: selectedLandType === opt ? 'rgba(102, 187, 136, 0.3)' : '#111',
                        border: `1px solid ${selectedLandType === opt ? '#6b8' : '#333'}`, borderRadius: '6px',
                        color: selectedLandType === opt ? '#fff' : '#aaa', cursor: 'pointer', fontWeight: selectedLandType === opt ? 'bold' : 'normal'
                      }}>{opt}</button>
                    ))}
                  </div>
                </div>
              );
            }
            // Generic choice fallback
            return (
              <div key={feature.name} style={{ marginBottom: '16px', padding: '12px', background: '#111', border: '1px solid #333', borderRadius: '6px' }}>
                <h4 style={{ color: '#cfaa5e', margin: '0 0 4px 0' }}>{feature.name}</h4>
                <p style={{ color: '#aaa', fontSize: '12px', margin: 0 }}>{feature.description}</p>
                <p style={{ color: '#888', fontSize: '11px', fontStyle: 'italic', margin: '4px 0 0' }}>Choice type: {feature.choiceType} (pick {feature.choiceCount || 1})</p>
              </div>
            );
          })}
        </div>
      );
    }

    if (currentView === 'ASI or Feat') {
      return (
        <div style={{ animation: 'fadeIn 0.3s' }}>
          <h3 style={{ color: '#cfaa5e', fontFamily: 'Cinzel', marginBottom: '8px' }}>Ability Score Improvement</h3>
          <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '16px' }}>Choose to improve core attributes or learn a Feat.</p>
          
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
             <button onClick={() => setAsiMode('asi')} style={{ flex: 1, padding: '10px', background: asiMode === 'asi' ? '#cfaa5e' : '#111', color: asiMode === 'asi' ? '#000' : '#888', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+2 Stats</button>
             <button onClick={() => setAsiMode('feat')} style={{ flex: 1, padding: '10px', background: asiMode === 'feat' ? '#cfaa5e' : '#111', color: asiMode === 'feat' ? '#000' : '#888', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>New Feat</button>
          </div>

          {asiMode === 'asi' ? (
            <div style={{ background: '#111', padding: '16px', borderRadius: '8px', border: '1px solid #333' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                 <span style={{ color: '#aaa' }}>Points Remaining:</span>
                 <strong style={{ color: asiPointsTotal < 2 ? '#cfaa5e' : '#a11' }}>{2 - asiPointsTotal}</strong>
               </div>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                 {Object.keys(asiAlloc).map(k => {
                   const statKey = k as keyof typeof asiAlloc;
                   const val = asiAlloc[statKey];
                   const base = char.stats[statKey];
                   return (
                     <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#000', padding: '8px', border: '1px solid #222' }}>
                       <span style={{ color: '#888', textTransform: 'uppercase', fontSize: '12px' }}>{k} ({base})</span>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                         <button disabled={val <= 0} onClick={() => setAsiAlloc({...asiAlloc, [k]: val - 1})} style={{ background: '#222', color: '#fff', border: 'none', width: '24px', cursor: 'pointer' }}>-</button>
                         <span style={{ color: val > 0 ? '#5f5' : '#fff', fontWeight: 'bold', width: '16px', textAlign: 'center' }}>{val > 0 ? `+${val}` : 0}</span>
                         <button disabled={asiPointsTotal >= 2 || base + val >= 20} onClick={() => setAsiAlloc({...asiAlloc, [k]: val + 1})} style={{ background: '#222', color: '#fff', border: 'none', width: '24px', cursor: 'pointer' }}>+</button>
                       </div>
                     </div>
                   )
                 })}
               </div>
            </div>
          ) : (
            <div style={{ background: '#111', padding: '16px', borderRadius: '8px', border: '1px solid #333' }}>
              <input placeholder="Feat Name" value={customFeat.name} onChange={e => setCustomFeat({...customFeat, name: e.target.value})} style={{ width: '100%', padding: '10px', background: '#000', border: '1px solid #444', color: '#fff', marginBottom: '12px' }} />
              <textarea placeholder="Paste feat description..." value={customFeat.description} onChange={e => setCustomFeat({...customFeat, description: e.target.value})} style={{ width: '100%', padding: '10px', background: '#000', border: '1px solid #444', color: '#fff', minHeight: '80px', resize: 'vertical' }} />
            </div>
          )}
        </div>
      );
    }

    if (currentView === 'Grimoire (Spells)') {
      return (
         <div style={{ animation: 'fadeIn 0.3s', height: '100%', display: 'flex', flexDirection: 'column' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                 <h3 style={{ color: '#cfaa5e', fontFamily: 'Cinzel', marginBottom: '4px' }}>Expanding the Grimoire</h3>
                 <p style={{ color: '#aaa', fontSize: '14px', margin: 0 }}>
                    {isPrepCaster 
                      ? `As a ${targetClass}, you prepare spells daily rather than learning them permanently. You may skip this step or learn a Cantrip.` 
                      : `As a ${targetClass}, you unlock new spells. Use the standard archive or forge a homebrew incantation.`}
                 </p>
              </div>
              <div style={{ background: '#111', border: `1px solid ${numDrafted >= maxDraftSpells && !isPrepCaster ? '#cfaa5e' : '#444'}`, padding: '8px 16px', borderRadius: '4px', textAlign: 'center' }}>
                 <div style={{ fontSize: '20px', fontFamily: 'Cinzel', color: numDrafted > maxDraftSpells ? '#a44' : '#cfaa5e' }}>
                    {isPrepCaster ? '∞' : `${numDrafted} / ${maxDraftSpells}`}
                 </div>
                 <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase' }}>Spells Drafted</div>
              </div>
           </div>

           <div style={{ marginBottom: '16px', marginTop: '16px' }}>
             <button onClick={() => setIsAddingCustomSpell(!isAddingCustomSpell)} style={{ width: '100%', padding: '12px', background: '#221133', color: '#b9a', border: '1px solid #b9a', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Cinzel' }}>
               {isAddingCustomSpell ? 'Close Homebrew Forge' : '+ Forge Custom Spell (Homebrew)'}
             </button>
           </div>

           {isAddingCustomSpell && (
            <div style={{ background: 'rgba(20,20,20,0.8)', border: '1px solid #cfaa5e', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: '8px', marginBottom: '12px' }}>
                <input placeholder="Spell Name" value={customDraft.name} onChange={e => setCustomDraft({...customDraft, name: e.target.value})} style={{ padding: '8px', background: '#111', border: '1px solid #444', color: '#fff' }} />
                <select value={customDraft.level} onChange={e => setCustomDraft({...customDraft, level: parseInt(e.target.value)})} style={{ padding: '8px', background: '#111', border: '1px solid #444', color: '#fff' }}>
                  <option value={0}>Cantrip</option>
                  {[1,2,3,4,5,6,7,8,9].map(l => <option key={l} value={l}>Level {l}</option>)}
                </select>
                <select value={customDraft.school} onChange={e => setCustomDraft({...customDraft, school: e.target.value})} style={{ padding: '8px', background: '#111', border: '1px solid #444', color: '#fff' }}>
                  {SPELL_SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input placeholder="Range" value={customDraft.range} onChange={e => setCustomDraft({...customDraft, range: e.target.value})} style={{ padding: '8px', background: '#111', border: '1px solid #444', color: '#fff' }} />
                <input placeholder="Components" value={customDraft.components} onChange={e => setCustomDraft({...customDraft, components: e.target.value})} style={{ padding: '8px', background: '#111', border: '1px solid #444', color: '#fff' }} />
              </div>
              <textarea placeholder="Spell Description..." value={customDraft.description} onChange={e => setCustomDraft({...customDraft, description: e.target.value})} style={{ width: '100%', height: '60px', padding: '8px', background: '#111', border: '1px solid #444', color: '#fff', marginBottom: '12px' }} />
              <button 
                onClick={saveCustomSpell} 
                style={{ width: '100%', padding: '8px', background: '#cfaa5e', color: '#000', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Commit Draft to Grimoire
              </button>
            </div>
           )}

           {addedCustomSpells.length > 0 && (
             <div style={{ marginBottom: '16px', background: '#1a2a1a', padding: '12px', borderRadius: '4px', border: '1px solid #3c3' }}>
                <h4 style={{ color: '#5f5', fontSize: '12px', margin: '0 0 8px 0' }}>Homebrew Spells Forged (Will Learn on Level Up):</h4>
                {addedCustomSpells.map(s => <div key={s.id} style={{ color: '#fff', fontSize: '12px' }}>✦ {s.name} (Lv.{s.level})</div>)}
             </div>
           )}

           <div style={{ borderTop: '1px dashed #444', paddingTop: '16px', flex: 1, minHeight: '300px' }}>
             <h4 style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px' }}>Standard Spells Finder</h4>
             <SpellBrowser 
               inline={true} 
               draftMode={true} 
               draftedSpells={learnedSpells} 
               onSpellDraft={handleToggleDraft} 
             />
             <p style={{ fontSize: '10px', color: '#666', marginTop: '8px', fontStyle: 'italic' }}>* Spells drafted here will become permanently known when you commit the level up.</p>
           </div>
         </div>
      );
    }

    if (currentView === 'Class Features') {
      return (
        <div style={{ animation: 'fadeIn 0.3s' }}>
          <h3 style={{ color: '#cfaa5e', fontFamily: 'Cinzel', marginBottom: '8px' }}>Class Paths & Features</h3>
          <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '16px' }}>At {targetClass} Level {targetClassLevel}, you automatically gain standard core features.</p>
          
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '12px', color: '#55aacc', textTransform: 'uppercase', marginBottom: '8px' }}>Core Features Unlocking</h4>
            {classFeatures.length === 0 ? <p style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>No auto-features this level.</p> : (
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#ccc', fontSize: '12px' }}>
                {classFeatures.map(f => <li key={f.name}><strong>{f.name}:</strong> {f.description}</li>)}
              </ul>
            )}
          </div>

          <div style={{ borderTop: '1px dashed #333', paddingTop: '16px' }}>
            <h4 style={{ fontSize: '12px', color: '#cfaa5e', textTransform: 'uppercase', marginBottom: '8px' }}>Add Custom Choice / Homebrew</h4>
            {customFeatures.map((feat, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px', background: '#111', padding: '12px', borderRadius: '4px', border: '1px solid #333' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                   <input placeholder="Feature Name" value={feat.name} onChange={e => { const copy=[...customFeatures]; copy[i].name=e.target.value; setCustomFeatures(copy); }} style={{ flex: 1, padding: '8px', background: '#000', border: '1px solid #444', color: '#fff' }} />
                   <button onClick={() => setCustomFeatures(customFeatures.filter((_, idx)=>idx!==i))} style={{ padding: '8px', background: '#a44', color: '#000', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>Remove</button>
                </div>
                <textarea placeholder="Description..." value={feat.description} onChange={e => { const copy=[...customFeatures]; copy[i].description=e.target.value; setCustomFeatures(copy); }} style={{ width: '100%', padding: '8px', background: '#000', border: '1px solid #444', color: '#fff', minHeight: '60px' }} />
              </div>
            ))}
            <button onClick={() => setCustomFeatures([...customFeatures, {name:'', description:''}])} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #55aacc', color: '#55aacc', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
              + Add Custom Feature
            </button>
          </div>
        </div>
      );
    }

    if (currentView === 'Review') {
      return (
        <div style={{ animation: 'fadeIn 0.3s' }}>
          <h3 style={{ color: '#cfaa5e', fontFamily: 'Cinzel', marginBottom: '16px' }}>Ascension Overview</h3>
          
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <div style={{ flex: 1, background: '#111', padding: '12px', border: '1px solid #333', borderRadius: '6px', textAlign: 'center' }}>
               <div style={{ fontSize: '24px', fontFamily: 'Cinzel', color: '#fff' }}>{char.level} <span style={{ color: '#666' }}>→</span> <span style={{ color: '#cfaa5e' }}>{nextLevel}</span></div>
               <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase' }}>Total Level</div>
            </div>
            <div style={{ flex: 1, background: '#111', padding: '12px', border: '1px solid #333', borderRadius: '6px', textAlign: 'center' }}>
               <div style={{ fontSize: '24px', fontFamily: 'Cinzel', color: '#cfaa5e' }}>{targetClass} {targetClassLevel}</div>
               <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase' }}>Path Taken</div>
            </div>
            <div style={{ flex: 1, background: '#111', padding: '12px', border: '1px solid #333', borderRadius: '6px', textAlign: 'center' }}>
               <div style={{ fontSize: '24px', fontFamily: 'Cinzel', color: '#5f5' }}>+{hpRoll + conMod}</div>
               <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase' }}>Max HP</div>
            </div>
          </div>

          <div style={{ color: '#aaa', fontSize: '14px', lineHeight: '1.6' }}>
            <p>You have finalized your leveling choices. Upon committing, your new health, spell slots, and features will be permanently etched into your chronicle.</p>
          </div>
        </div>
      );
    }

    return null;
  };

  const modalMarkup = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
      <div style={{ width: '800px', maxWidth: '95vw', height: '80vh', maxHeight: '900px', background: '#0a0a0a', border: '2px solid #3a2a1a', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 0 40px rgba(0,0,0,0.8)' }}>
        
        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid #332211', background: 'url(/dungeon-buddy/bg-texture.jpg) center center', backgroundSize: 'cover', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(10,10,10,0.4), #0a0a0a)' }}></div>
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontFamily: 'Cinzel', color: '#cfaa5e', fontSize: '24px', textShadow: '2px 2px 4px #000' }}>
              Level Up: {char.name}
            </h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: '24px', cursor: 'pointer' }}>×</button>
          </div>
        </div>

        {/* Steps Progress */}
        <div style={{ display: 'flex', padding: '16px 20px', background: '#111', borderBottom: '1px solid #222', overflowX: 'auto', gap: '8px' }}>
          {stepsList.map((s, idx) => (
            <div key={s} style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', opacity: step === idx ? 1 : 0.4, 
              color: step === idx ? '#cfaa5e' : '#fff', fontWeight: step === idx ? 'bold' : 'normal',
              flexShrink: 0
            }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '12px', background: step >= idx ? '#cfaa5e' : '#333', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                {idx + 1}
              </div>
              <span style={{ fontSize: '14px', fontFamily: 'Cinzel' }}>{s}</span>
              {idx < stepsList.length - 1 && <span style={{ color: '#444' }}>-</span>}
            </div>
          ))}
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {renderStep()}
        </div>

        {/* Footer Actions */}
        <div style={{ padding: '20px', borderTop: '1px solid #222', background: '#111', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
           {step > 0 && (
             <button onClick={() => setStep(step - 1)} style={{ padding: '12px 24px', background: 'transparent', color: '#aaa', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Cinzel', fontSize: '16px' }}>
               Back
             </button>
           )}
           {step < stepsList.length - 1 ? (
             <button onClick={() => setStep(step + 1)} disabled={stepsList[step] === 'Subclass' && isOracleForging} style={{ padding: '12px 32px', background: '#cfaa5e', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Cinzel', fontSize: '16px', fontWeight: 'bold' }}>
               Next Step
             </button>
           ) : (
             <button onClick={finalizeLevelUp} style={{ padding: '12px 32px', background: '#cfaa5e', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Cinzel', fontSize: '16px', fontWeight: 'bold', boxShadow: '0 0 15px rgba(207, 170, 94, 0.4)' }}>
               Commit Level
             </button>
           )}
        </div>

      </div>
    </div>
  );

  return createPortal(modalMarkup, document.body);
}
