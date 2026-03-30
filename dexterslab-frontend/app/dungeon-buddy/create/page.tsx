'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import {
  RACES, CLASSES, BACKGROUNDS, ABILITY_NAMES, SKILL_LABELS, SKILL_ABILITY_MAP,
  POINT_BUY_COSTS, POINT_BUY_TOTAL, STANDARD_ARRAY,
  calculateModifier, calculateStartingHp, getPointBuyCost,
  type RaceData, type SubraceData, type ClassData, type BackgroundData,
  type AbilityName, type SkillName,
} from '../data/srd';
import { STARTING_EQUIPMENT } from '../data/starting-equipment';

const STEPS = [
  { label: 'Race', key: 'race' },
  { label: 'Class', key: 'class' },
  { label: 'Abilities', key: 'abilities' },
  { label: 'Background', key: 'background' },
  { label: 'Skills', key: 'skills' },
  { label: 'Equipment', key: 'equipment' },
  { label: 'Portrait', key: 'portrait' },
  { label: 'Finalize', key: 'finalize' },
];

type AbilityMethod = 'point_buy' | 'standard_array' | 'manual';

export default function CharacterCreationWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Selections
  const [selectedRace, setSelectedRace] = useState<RaceData | null>(null);
  const [selectedSubrace, setSelectedSubrace] = useState<SubraceData | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [selectedBackground, setSelectedBackground] = useState<BackgroundData | null>(null);
  const [abilityMethod, setAbilityMethod] = useState<AbilityMethod>('point_buy');
  const [baseScores, setBaseScores] = useState<Record<AbilityName, number>>({
    str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8,
  });
  const [standardArrayAssignment, setStandardArrayAssignment] = useState<Record<AbilityName, number | null>>({
    str: null, dex: null, con: null, int: null, wis: null, cha: null,
  });
  const [selectedSkills, setSelectedSkills] = useState<SkillName[]>([]);
  const [selectedEquipmentPack, setSelectedEquipmentPack] = useState<number>(0);
  const [characterName, setCharacterName] = useState('');

  // Portrait state
  const [portraitDescription, setPortraitDescription] = useState('');
  const [portraitData, setPortraitData] = useState<string | null>(null);
  const [portraitLoading, setPortraitLoading] = useState(false);

  // ── Computed values ──
  const raceBonuses = useMemo(() => {
    const bonuses: Partial<Record<AbilityName, number>> = {};
    if (selectedRace) Object.assign(bonuses, selectedRace.abilityBonuses);
    if (selectedSubrace) {
      for (const [k, v] of Object.entries(selectedSubrace.abilityBonuses)) {
        bonuses[k as AbilityName] = (bonuses[k as AbilityName] || 0) + v;
      }
    }
    return bonuses;
  }, [selectedRace, selectedSubrace]);

  const finalScores = useMemo(() => {
    const scores: Record<AbilityName, number> = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    if (abilityMethod === 'standard_array') {
      for (const key of ABILITY_NAMES.map(a => a.key)) {
        scores[key] = (standardArrayAssignment[key] ?? 10) + (raceBonuses[key] || 0);
      }
    } else {
      for (const key of ABILITY_NAMES.map(a => a.key)) {
        scores[key] = baseScores[key] + (raceBonuses[key] || 0);
      }
    }
    return scores;
  }, [baseScores, standardArrayAssignment, raceBonuses, abilityMethod]);

  const pointsSpent = useMemo(() => getPointBuyCost(baseScores), [baseScores]);
  const pointsLeft = POINT_BUY_TOTAL - pointsSpent;

  const lockedSkills = useMemo(() => {
    return selectedBackground?.skillProficiencies || [];
  }, [selectedBackground]);

  const maxSkillChoices = selectedClass?.numSkillChoices || 0;

  const usedArrayValues = useMemo(() => {
    return Object.values(standardArrayAssignment).filter(v => v !== null) as number[];
  }, [standardArrayAssignment]);

  const availableArrayValues = useMemo(() => {
    return STANDARD_ARRAY.filter(v => !usedArrayValues.includes(v));
  }, [usedArrayValues]);

  // ── Validation ──
  const canProceed = () => {
    switch (step) {
      case 0: return !!selectedRace && (!selectedRace.subraces?.length || !!selectedSubrace);
      case 1: return !!selectedClass;
      case 2: {
        if (abilityMethod === 'point_buy') return pointsLeft >= 0;
        if (abilityMethod === 'standard_array') return usedArrayValues.length === 6;
        return true;
      }
      case 3: return !!selectedBackground;
      case 4: return selectedSkills.length === maxSkillChoices;
      case 5: return true; // Equipment just defaults to first option
      case 6: return true; // portrait is optional
      case 7: return characterName.trim().length > 0;
      default: return true;
    }
  };

  // ── Handlers ──
  const handlePointBuyChange = (ability: AbilityName, delta: number) => {
    const newVal = baseScores[ability] + delta;
    if (newVal < 8 || newVal > 15) return;
    const testScores = { ...baseScores, [ability]: newVal };
    const cost = getPointBuyCost(testScores);
    if (cost > POINT_BUY_TOTAL) return;
    setBaseScores(testScores);
  };

  const handleStandardArrayAssign = (ability: AbilityName) => {
    if (availableArrayValues.length === 0 && standardArrayAssignment[ability] === null) return;
    if (standardArrayAssignment[ability] !== null) {
      setStandardArrayAssignment({ ...standardArrayAssignment, [ability]: null });
    } else if (availableArrayValues.length > 0) {
      setStandardArrayAssignment({ ...standardArrayAssignment, [ability]: availableArrayValues[0] });
    }
  };

  const cycleStandardArrayValue = (ability: AbilityName, direction: number) => {
    const current = standardArrayAssignment[ability];
    if (current === null) return;
    const pool = [...availableArrayValues, current].sort((a, b) => b - a);
    const idx = pool.indexOf(current);
    const nextIdx = (idx + direction + pool.length) % pool.length;
    setStandardArrayAssignment({ ...standardArrayAssignment, [ability]: pool[nextIdx] });
  };

  const toggleSkill = (skill: SkillName) => {
    if (lockedSkills.includes(skill)) return;
    if (!selectedClass?.skillChoices.includes(skill)) return;
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter(s => s !== skill));
    } else if (selectedSkills.length < maxSkillChoices) {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const generatePortrait = async () => {
    if (!portraitDescription.trim()) return;
    setPortraitLoading(true);
    try {
      const res = await fetch(`/api/dungeon-buddy/generate-portrait`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: portraitDescription,
          race: selectedRace?.name + (selectedSubrace ? ` (${selectedSubrace.name})` : ''),
          charClass: selectedClass?.name,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.imageData) {
          setPortraitData(data.imageData);
        }
      }
    } catch (err) {
      console.error('Portrait generation failed:', err);
    } finally {
      setPortraitLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedRace || !selectedClass || !selectedBackground) return;
    const conMod = calculateModifier(finalScores.con);
    const startingHp = calculateStartingHp(selectedClass, conMod);
    const allSkills = [...new Set([...lockedSkills, ...selectedSkills])];

    const packs = STARTING_EQUIPMENT[selectedClass.id.toLowerCase()] || [];
    const packItems = packs.length > 0 && packs[selectedEquipmentPack] ? packs[selectedEquipmentPack].items : [];
    const inventory = packItems.map((pi: any, i: number) => ({
      id: `item_${Date.now()}_${i}`, name: pi.name, qty: pi.qty, weight: pi.weight,
      equipped: !!pi.slot, attuned: false, slot: pi.slot, type: pi.type, description: ''
    }));
    const equipped: Record<string, any> = { head: null, chest: null, cloak: null, mainHand: null, offHand: null, gloves: null, boots: null, ring1: null, ring2: null, amulet: null };
    // We filter the inventory so anything that starts equipped is removed from the backpack entirely
    const startingInventory = inventory.filter((i: any) => {
      if (i.slot) {
        equipped[i.slot] = i;
        return false;
      }
      return true;
    });

    const newChar = {
      name: characterName,
      race: selectedRace.name + (selectedSubrace ? ` (${selectedSubrace.name})` : ''),
      class: selectedClass.name,
      background: selectedBackground.name,
      level: 1,
      maxHp: startingHp,
      currentHp: startingHp,
      ac: 10 + calculateModifier(finalScores.dex),
      stats: finalScores,
      skills: allSkills,
      hitDie: selectedClass.hitDie,
      hitDiceTotal: 1,
      hitDiceUsed: 0,
      speed: selectedRace.speed,
      proficiencyBonus: 2,
      savingThrows: selectedClass.savingThrows,
      armorProficiencies: selectedClass.armorProficiencies,
      weaponProficiencies: selectedClass.weaponProficiencies,
      spellcaster: selectedClass.spellcaster,
      spellcastingAbility: selectedClass.spellcastingAbility || null,
      traits: [...(selectedRace.traits || []), ...(selectedSubrace?.traits || [])],
      languages: selectedRace.languages,
      inventory: startingInventory,
      equipped,
      equipment: selectedBackground.equipment, // Legacy
      features: selectedClass.features.filter(f => f.level <= 1),
      portrait: portraitData || null,
      logbook: [{
        id: 'log_' + Date.now(),
        timestamp: Date.now(),
        type: 'creation',
        description: `${characterName} was born. A Level 1 ${selectedRace.name} ${selectedClass.name}, ${selectedBackground.name} background.`,
        previousState: null,
      }],
    };

    try {
      const res = await fetch(`/api/dungeon-buddy/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newChar),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/dungeon-buddy/${data.id}`);
      }
    } catch (err) {
      console.error('Failed to create character', err);
    }
  };

  // ═══════════════════════════════════════════
  //  STEP RENDERERS
  // ═══════════════════════════════════════════

  const renderRaceStep = () => (
    <>
      <h2 className={styles.sectionTitle}>Choose Your Race</h2>
      <p className={styles.sectionSubtitle}>Your race determines your physical traits, innate abilities, and cultural heritage in the world.</p>
      <div className={styles.optionsGrid}>
        {RACES.map(race => (
          <div
            key={race.id}
            className={`${styles.optionCard} ${selectedRace?.id === race.id ? styles.selected : ''}`}
            onClick={() => { setSelectedRace(race); setSelectedSubrace(null); }}
          >
            <h3 className={styles.optionName}>{race.name}</h3>
            <p className={styles.optionMeta}>
              Speed {race.speed} ft · {Object.entries(race.abilityBonuses).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(', ')}
            </p>
            <p className={styles.optionDesc}>{race.description}</p>
          </div>
        ))}
      </div>
      {selectedRace?.subraces && selectedRace.subraces.length > 0 && (
        <div className={styles.subraceSection}>
          <h3 className={styles.subraceTitle}>Choose Subrace</h3>
          <div className={styles.subraceGrid}>
            {selectedRace.subraces.map(sub => (
              <div
                key={sub.id}
                className={`${styles.optionCard} ${selectedSubrace?.id === sub.id ? styles.selected : ''}`}
                onClick={() => setSelectedSubrace(sub)}
              >
                <h3 className={styles.optionName}>{sub.name}</h3>
                <p className={styles.optionMeta}>
                  {Object.entries(sub.abilityBonuses).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(', ')}
                </p>
                <p className={styles.optionDesc}>{sub.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const renderClassStep = () => (
    <>
      <h2 className={styles.sectionTitle}>Choose Your Class</h2>
      <p className={styles.sectionSubtitle}>Your class defines your combat role, available abilities, and how you interact with the world.</p>
      <div className={styles.optionsGrid}>
        {CLASSES.map(cls => (
          <div
            key={cls.id}
            className={`${styles.optionCard} ${selectedClass?.id === cls.id ? styles.selected : ''}`}
            onClick={() => { setSelectedClass(cls); setSelectedSkills([]); }}
          >
            <h3 className={styles.optionName}>{cls.name}</h3>
            <p className={styles.optionMeta}>
              d{cls.hitDie} hit die · {cls.spellcaster ? '✦ Spellcaster' : '⚔ Martial'}
            </p>
            <p className={styles.optionDesc}>{cls.description}</p>
          </div>
        ))}
      </div>
    </>
  );

  const renderAbilitiesStep = () => (
    <>
      <h2 className={styles.sectionTitle}>Ability Scores</h2>
      <p className={styles.sectionSubtitle}>
        Six ability scores define your character.
        {selectedClass && <> <strong>{selectedClass.name}</strong> benefits most from <strong>{selectedClass.primaryAbility.map(a => a.toUpperCase()).join(' &amp; ')}</strong>.</>}
      </p>

      <div className={styles.methodToggle}>
        <button className={`${styles.methodBtn} ${abilityMethod === 'point_buy' ? styles.active : ''}`} onClick={() => setAbilityMethod('point_buy')}>Point Buy</button>
        <button className={`${styles.methodBtn} ${abilityMethod === 'standard_array' ? styles.active : ''}`} onClick={() => setAbilityMethod('standard_array')}>Standard Array</button>
        <button className={`${styles.methodBtn} ${abilityMethod === 'manual' ? styles.active : ''}`} onClick={() => setAbilityMethod('manual')}>Manual</button>
      </div>

      {abilityMethod === 'point_buy' && (
        <div className={styles.pointsRemaining}>Points Remaining: <span>{pointsLeft}</span> / {POINT_BUY_TOTAL}</div>
      )}
      {abilityMethod === 'standard_array' && (
        <div className={styles.pointsRemaining}>
          {availableArrayValues.length > 0 ? `Assign: ${availableArrayValues.join(', ')}` : 'All assigned ✓'}
        </div>
      )}

      <div className={styles.abilityGrid}>
        {ABILITY_NAMES.map(({ key, label }) => {
          const base = abilityMethod === 'standard_array' ? (standardArrayAssignment[key] ?? 0) : baseScores[key];
          const bonus = raceBonuses[key] || 0;
          const total = base + bonus;
          const mod = calculateModifier(total);
          const isPrimary = selectedClass?.primaryAbility.includes(key);

          return (
            <div key={key} className={styles.abilityBox} style={isPrimary ? { borderColor: 'var(--border-gold)' } : {}}>
              <div className={styles.abilityLabel} style={isPrimary ? { color: 'var(--gold-bright)' } : {}}>{label}</div>
              <div className={styles.abilityScore}>{total}</div>
              <div className={styles.abilityMod}>{mod >= 0 ? '+' : ''}{mod}</div>
              {bonus > 0 && <div style={{ fontSize: '0.72rem', color: 'var(--ice)', marginTop: '2px' }}>+{bonus} racial</div>}

              {abilityMethod === 'point_buy' && (
                <div className={styles.abilityControls}>
                  <button className={styles.abilityBtn} onClick={() => handlePointBuyChange(key, -1)} disabled={baseScores[key] <= 8}>−</button>
                  <span style={{ color: '#444', fontSize: '0.75rem' }}>{baseScores[key]}</span>
                  <button className={styles.abilityBtn} onClick={() => handlePointBuyChange(key, 1)} disabled={baseScores[key] >= 15}>+</button>
                </div>
              )}
              {abilityMethod === 'standard_array' && (
                <div className={styles.abilityControls}>
                  {standardArrayAssignment[key] !== null ? (
                    <>
                      <button className={styles.abilityBtn} onClick={() => cycleStandardArrayValue(key, -1)}>◀</button>
                      <button className={styles.abilityBtn} onClick={() => handleStandardArrayAssign(key)} style={{ color: '#c44', borderColor: '#833' }}>×</button>
                      <button className={styles.abilityBtn} onClick={() => cycleStandardArrayValue(key, 1)}>▶</button>
                    </>
                  ) : (
                    <button className={styles.abilityBtn} onClick={() => handleStandardArrayAssign(key)} disabled={availableArrayValues.length === 0} style={{ width: 'auto', borderRadius: '3px', padding: '4px 10px', fontSize: '0.75rem' }}>Assign</button>
                  )}
                </div>
              )}
              {abilityMethod === 'manual' && (
                <div className={styles.abilityControls}>
                  <button className={styles.abilityBtn} onClick={() => setBaseScores({ ...baseScores, [key]: Math.max(1, baseScores[key] - 1) })}>−</button>
                  <span style={{ color: '#444', fontSize: '0.75rem' }}>{baseScores[key]}</span>
                  <button className={styles.abilityBtn} onClick={() => setBaseScores({ ...baseScores, [key]: Math.min(20, baseScores[key] + 1) })}>+</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  const renderBackgroundStep = () => (
    <>
      <h2 className={styles.sectionTitle}>Choose Your Background</h2>
      <p className={styles.sectionSubtitle}>Your background reveals where you came from, your experiences, and your place in the world.</p>
      <div className={styles.optionsGrid}>
        {BACKGROUNDS.map(bg => (
          <div
            key={bg.id}
            className={`${styles.optionCard} ${selectedBackground?.id === bg.id ? styles.selected : ''}`}
            onClick={() => setSelectedBackground(bg)}
          >
            <h3 className={styles.optionName}>{bg.name}</h3>
            <p className={styles.optionMeta}>{bg.skillProficiencies.map(s => SKILL_LABELS[s]).join(', ')}</p>
            <p className={styles.optionDesc}>{bg.description}</p>
          </div>
        ))}
      </div>
    </>
  );

  const renderSkillsStep = () => {
    const allSkills = Object.keys(SKILL_LABELS) as SkillName[];
    return (
      <>
        <h2 className={styles.sectionTitle}>Choose Your Skills</h2>
        <p className={styles.sectionSubtitle}>
          Select {maxSkillChoices} skill{maxSkillChoices > 1 ? 's' : ''} from your class list.
          Background skills are already locked in.
        </p>
        <div className={styles.skillsRemaining}>Selected: {selectedSkills.length} / {maxSkillChoices}</div>
        <div className={styles.skillsGrid}>
          {allSkills.map(skill => {
            const isLocked = lockedSkills.includes(skill);
            const isSelected = selectedSkills.includes(skill);
            const isAvailable = selectedClass?.skillChoices.includes(skill) || false;
            const chipClass = isLocked ? styles.locked : isSelected ? styles.selected : (!isAvailable ? styles.unavailable : '');
            return (
              <div
                key={skill}
                className={`${styles.skillChip} ${chipClass}`}
                onClick={() => !isLocked && isAvailable && toggleSkill(skill)}
              >
                <div className={styles.skillCheck}>{(isLocked || isSelected) && '✓'}</div>
                <span>{SKILL_LABELS[skill]}</span>
                <span className={styles.skillAbility}>{SKILL_ABILITY_MAP[skill].toUpperCase()}</span>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const renderPortraitStep = () => (
    <>
      <h2 className={styles.sectionTitle}>Forge Your Appearance</h2>
      <p className={styles.sectionSubtitle}>
        Describe your character&apos;s appearance and we&apos;ll conjure a portrait using arcane magic.
        This step is optional — you can skip to finalization.
      </p>
      <div className={styles.portraitSection}>
        <h3 className={styles.portraitSectionTitle}>Character Description</h3>
        <p className={styles.portraitDescription}>
          Describe your {selectedRace?.name} {selectedClass?.name}&apos;s appearance — facial features, scars, hair, armor, mood, etc.
        </p>
        <div className={styles.portraitLayout}>
          <div>
            <textarea
              className={styles.portraitTextarea}
              placeholder={`e.g. "A battle-scarred ${selectedRace?.name || 'warrior'} with silver-streaked hair, glowing amber eyes, and a jagged scar across the left cheek. Clad in worn leather armor with a dark hooded cloak..."`}
              value={portraitDescription}
              onChange={e => setPortraitDescription(e.target.value)}
            />
            <button
              className={styles.generateBtn}
              onClick={generatePortrait}
              disabled={portraitLoading || !portraitDescription.trim()}
            >
              {portraitLoading ? 'Conjuring...' : '✦ Generate Portrait'}
            </button>
          </div>
          <div className={styles.portraitPreview}>
            {portraitLoading ? (
              <div className={styles.portraitLoading}>
                <div className={styles.portraitSpinner} />
                <span>Channeling arcane energies...</span>
              </div>
            ) : portraitData ? (
              <img src={`data:image/png;base64,${portraitData}`} alt="Character portrait" />
            ) : (
              <div className={styles.portraitPlaceholder}>
                Your portrait will materialize here
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  const renderFinalizeStep = () => {
    const conMod = calculateModifier(finalScores.con);
    const startingHp = selectedClass ? calculateStartingHp(selectedClass, conMod) : 0;

    return (
      <>
        <h2 className={styles.sectionTitle}>Name Your Hero</h2>
        <p className={styles.sectionSubtitle}>Every legend begins with a name. What shall yours be?</p>
        <input
          className={styles.nameInputLarge}
          placeholder="Enter character name..."
          value={characterName}
          onChange={e => setCharacterName(e.target.value)}
          autoFocus
        />

        <div style={{ marginTop: '28px' }}>
          <h2 className={styles.sectionTitle}>Character Summary</h2>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              <div className={styles.summaryLabel}>Race</div>
              <div className={styles.summaryValue}>{selectedRace?.name}{selectedSubrace ? ` (${selectedSubrace.name})` : ''}</div>
            </div>
            <div className={styles.summaryItem}>
              <div className={styles.summaryLabel}>Class</div>
              <div className={styles.summaryValue}>{selectedClass?.name}</div>
            </div>
            <div className={styles.summaryItem}>
              <div className={styles.summaryLabel}>Background</div>
              <div className={styles.summaryValue}>{selectedBackground?.name}</div>
            </div>
            <div className={styles.summaryItem}>
              <div className={styles.summaryLabel}>Hit Points</div>
              <div className={styles.summaryValue}>{startingHp}</div>
            </div>
            <div className={styles.summaryItem}>
              <div className={styles.summaryLabel}>Armor Class</div>
              <div className={styles.summaryValue}>{10 + calculateModifier(finalScores.dex)}</div>
            </div>
            <div className={styles.summaryItem}>
              <div className={styles.summaryLabel}>Speed</div>
              <div className={styles.summaryValue}>{selectedRace?.speed} ft.</div>
            </div>
          </div>
          <div style={{ marginTop: '16px' }}>
            <div className={styles.summaryItem}>
              <div className={styles.summaryLabel}>Ability Scores</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                {ABILITY_NAMES.map(({ key, label }) => (
                  <span key={key} className={styles.bonusBadge}>
                    {label.substring(0, 3).toUpperCase()}: <span className={styles.bonusValue}>{finalScores[key]}</span> ({calculateModifier(finalScores[key]) >= 0 ? '+' : ''}{calculateModifier(finalScores[key])})
                  </span>
                ))}
              </div>
            </div>
          </div>
          {portraitData && (
            <div style={{ marginTop: '16px', display: 'flex', gap: '16px', alignItems: 'start' }}>
              <div style={{ width: '120px', height: '120px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-dim)', flexShrink: 0 }}>
                <img src={`data:image/png;base64,${portraitData}`} alt="Portrait" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div className={styles.summaryItem} style={{ flex: 1 }}>
                <div className={styles.summaryLabel}>Portrait</div>
                <div className={styles.summaryValueSmall}>Generated from your description</div>
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  // ── Preview panel ──
  const renderPreview = () => {
    if (step === 0 && selectedRace) {
      return (
        <>
          <h2 className={styles.previewTitle}>{selectedRace.name}</h2>
          <div className={styles.previewSection}>
            <div className={styles.previewSectionTitle}>Racial Traits</div>
            <ul className={styles.traitsList}>
              {selectedRace.traits.map(t => <li key={t}>{t}</li>)}
              {selectedSubrace?.traits.map(t => <li key={t}>{t} <span style={{ color: 'var(--ice)', fontSize: '0.7rem' }}>(subrace)</span></li>)}
            </ul>
          </div>
          <div className={styles.previewSection}>
            <div className={styles.previewSectionTitle}>Ability Bonuses</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {Object.entries(raceBonuses).map(([k, v]) => (
                <span key={k} className={styles.bonusBadge}>{k.toUpperCase()} <span className={styles.bonusValue}>+{v}</span></span>
              ))}
            </div>
          </div>
          <div className={styles.previewSection}>
            <div className={styles.previewSectionTitle}>Speed</div>
            <p style={{ color: '#aaa', fontSize: '0.88rem', margin: 0, fontFamily: 'Cinzel, serif' }}>{selectedRace.speed} ft.</p>
          </div>
          <div className={styles.previewSection}>
            <div className={styles.previewSectionTitle}>Languages</div>
            <p style={{ color: '#aaa', fontSize: '0.88rem', margin: 0 }}>{selectedRace.languages.join(', ')}</p>
          </div>
        </>
      );
    }

    if (step === 1 && selectedClass) {
      return (
        <>
          <h2 className={styles.previewTitle}>{selectedClass.name}</h2>
          <div className={styles.previewSection}>
            <div className={styles.previewSectionTitle}>Key Stats</div>
            <ul className={styles.traitsList}>
              <li>Hit Die: d{selectedClass.hitDie}</li>
              <li>Primary: {selectedClass.primaryAbility.map(a => a.toUpperCase()).join(', ')}</li>
              <li>Saves: {selectedClass.savingThrows.map(a => a.toUpperCase()).join(', ')}</li>
              <li>Armor: {selectedClass.armorProficiencies.join(', ') || 'None'}</li>
              <li>Weapons: {selectedClass.weaponProficiencies.join(', ')}</li>
            </ul>
          </div>
          <div className={styles.previewSection}>
            <div className={styles.previewSectionTitle}>Class Features</div>
            <ul className={styles.featuresList}>
              {selectedClass.features.map(f => (
                <li key={f.name} className={styles.featureItem}>
                  <div className={styles.featureLevel}>Level {f.level}</div>
                  <div className={styles.featureName}>{f.name}</div>
                  <div className={styles.featureDesc}>{f.description}</div>
                </li>
              ))}
            </ul>
          </div>
        </>
      );
    }

    if (step === 3 && selectedBackground) {
      return (
        <>
          <h2 className={styles.previewTitle}>{selectedBackground.name}</h2>
          <div className={styles.previewSection}>
            <div className={styles.previewSectionTitle}>Feature</div>
            <p style={{ color: '#aaa', fontSize: '0.88rem', margin: 0 }}>{selectedBackground.feature}</p>
          </div>
          <div className={styles.previewSection}>
            <div className={styles.previewSectionTitle}>Skill Proficiencies</div>
            <ul className={styles.traitsList}>
              {selectedBackground.skillProficiencies.map(s => <li key={s}>{SKILL_LABELS[s]}</li>)}
            </ul>
          </div>
          <div className={styles.previewSection}>
            <div className={styles.previewSectionTitle}>Equipment</div>
            <ul className={styles.traitsList}>
              {selectedBackground.equipment.map(e => <li key={e}>{e}</li>)}
            </ul>
          </div>
        </>
      );
    }

    // Default: build summary
    return (
      <>
        <h2 className={styles.previewTitle}>Character Build</h2>
        {selectedRace && (
          <div className={styles.previewSection}>
            <div className={styles.previewSectionTitle}>Race</div>
            <p style={{ color: '#ccc', margin: 0, fontFamily: 'Cinzel, serif' }}>
              {selectedRace.name}{selectedSubrace ? ` — ${selectedSubrace.name}` : ''}
            </p>
          </div>
        )}
        {selectedClass && (
          <div className={styles.previewSection}>
            <div className={styles.previewSectionTitle}>Class</div>
            <p style={{ color: '#ccc', margin: 0, fontFamily: 'Cinzel, serif' }}>{selectedClass.name}</p>
            <p style={{ color: '#555', margin: '4px 0 0', fontSize: '0.82rem' }}>d{selectedClass.hitDie} · {selectedClass.spellcaster ? 'Spellcaster' : 'Martial'}</p>
          </div>
        )}
        {selectedBackground && (
          <div className={styles.previewSection}>
            <div className={styles.previewSectionTitle}>Background</div>
            <p style={{ color: '#ccc', margin: 0, fontFamily: 'Cinzel, serif' }}>{selectedBackground.name}</p>
          </div>
        )}
        {step >= 2 && (
          <div className={styles.previewSection}>
            <div className={styles.previewSectionTitle}>Abilities</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {ABILITY_NAMES.map(({ key }) => (
                <span key={key} className={styles.bonusBadge}>{key.toUpperCase()}: <span className={styles.bonusValue}>{finalScores[key]}</span></span>
              ))}
            </div>
          </div>
        )}
        {portraitData && (
          <div className={styles.previewSection}>
            <div className={styles.previewSectionTitle}>Portrait</div>
            <div style={{ width: '100%', borderRadius: '4px', overflow: 'hidden', marginTop: '4px' }}>
              <img src={`data:image/png;base64,${portraitData}`} alt="Portrait" style={{ width: '100%', objectFit: 'cover' }} />
            </div>
          </div>
        )}
      </>
    );
  };

  const renderEquipmentStep = () => {
    const packs = selectedClass ? STARTING_EQUIPMENT[selectedClass.id.toLowerCase()] || [] : [];
    return (
      <>
        <h2 className={styles.sectionTitle}>Select Starting Gear</h2>
        <p className={styles.sectionSubtitle}>Choose your preferred equipment pack for adventuring.</p>
        <div className={styles.optionsGrid}>
          {packs.length === 0 ? <p style={{ color: '#aaa', padding: '10px' }}>No specific class packs available. You will rely on background gear.</p> : packs.map((pack: any, i: number) => (
             <div key={i} className={`${styles.optionCard} ${selectedEquipmentPack === i ? styles.selected : ''}`} onClick={() => setSelectedEquipmentPack(i)}>
               <h3 className={styles.optionName}>{pack.label}</h3>
               <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: '#ccc' }}>
                 {pack.items.map((pi: any, j: number) => <li key={j}>{pi.qty}x {pi.name}</li>)}
               </ul>
             </div>
          ))}
        </div>
      </>
    );
  };

  const stepRenderers = [
    renderRaceStep, renderClassStep, renderAbilitiesStep,
    renderBackgroundStep, renderSkillsStep, renderEquipmentStep, renderPortraitStep, renderFinalizeStep,
  ];

  // ── Step indicator styles ──
  const getStepNumStyle = (i: number) => {
    if (i === step) return { borderColor: 'var(--gold)', color: '#000', background: 'var(--gold)', boxShadow: '0 0 10px var(--gold-glow)' };
    if (i < step) return { borderColor: 'var(--ice-dim)', color: 'var(--ice)', background: 'rgba(107,163,199,0.1)' };
    return {};
  };

  const getStepLabelStyle = (i: number) => {
    if (i === step) return { color: 'var(--gold-bright)' };
    if (i < step) return { color: 'var(--ice)' };
    return {};
  };

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <Link href="/dungeon-buddy" className={styles.backLink}>← Abandon</Link>
        <div className={styles.topTitle}>Character Creation</div>
        <div style={{ width: '80px' }} />
      </div>

      <div className={styles.stepsBar}>
        {STEPS.map((s, i) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
            <div className={styles.stepItem} onClick={() => i < step && setStep(i)}>
              <div className={styles.stepNumber} style={getStepNumStyle(i)}>
                {i < step ? '✓' : i + 1}
              </div>
              <div className={styles.stepLabel} style={getStepLabelStyle(i)}>{s.label}</div>
            </div>
            {i < STEPS.length - 1 && (
              <div className={styles.stepConnector} style={i < step ? { background: 'var(--ice-dim)' } : {}} />
            )}
          </div>
        ))}
      </div>

      <div className={styles.mainContent}>
        <div className={styles.selectionPanel}>{stepRenderers[step]()}</div>
        <div className={styles.previewPanel}>{renderPreview()}</div>
      </div>

      <div className={styles.bottomBar}>
        {step > 0 ? (
          <button className={styles.btnBack} onClick={() => setStep(step - 1)}>← Back</button>
        ) : <div />}
        <div className={styles.stepHint}>
          {step === 0 && !selectedRace && 'Select a race to begin'}
          {step === 0 && selectedRace && selectedRace.subraces?.length && !selectedSubrace && 'Choose a subrace to continue'}
          {step === 2 && abilityMethod === 'point_buy' && `${pointsLeft} points remaining`}
          {step === 4 && `${maxSkillChoices - selectedSkills.length} skill${maxSkillChoices - selectedSkills.length !== 1 ? 's' : ''} remaining`}
          {step === 6 && 'Portrait is optional — skip or generate'}
        </div>
        {step < STEPS.length - 1 ? (
          <button className={styles.btnNext} onClick={() => setStep(step + 1)} disabled={!canProceed()}>Next →</button>
        ) : (
          <button className={styles.btnCreate} onClick={handleCreate} disabled={!canProceed()}>⚔ Forge Hero</button>
        )}
      </div>
    </div>
  );
}
