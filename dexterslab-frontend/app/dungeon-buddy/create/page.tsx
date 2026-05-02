'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { getSpellProgression, isPrepCaster } from '../lib/magic-system';
import { STARTING_EQUIPMENT_DB } from '../data/starting-equipment';
import { WARLOCK_PACT_SLOTS } from '../data/resource-scaling';
import { ITEM_DATABASE } from '../lib/data/items';
import { useCharacterStore } from '../lib/store';
import Tooltip from '../components/Tooltip';
import SpellBrowser from '../components/SpellBrowser';

const STEPS = [
  { label: 'Race', key: 'race' },
  { label: 'Class', key: 'class' },
  { label: 'Abilities', key: 'abilities' },
  { label: 'Spells', key: 'spells' },
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
  const { draftGearSelections, setDraftGearChoice } = useCharacterStore();

  // Selections
  const [selectedRace, setSelectedRace] = useState<RaceData | null>(null);
  const [selectedSubrace, setSelectedSubrace] = useState<SubraceData | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [selectedSubclassChoice, setSelectedSubclassChoice] = useState<string>('');
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
  const [draftedSpells, setDraftedSpells] = useState<string[]>([]);
  
  // Oracle Extended State Buffer
  const [oraclePersonalityTraits, setOracleTraits] = useState('');
  const [oracleIdeals, setOracleIdeals] = useState('');
  const [oracleBonds, setOracleBonds] = useState('');
  const [oracleFlaws, setOracleFlaws] = useState('');
  const [oracleCustomSpells, setOracleCustomSpells] = useState<any[]>([]);
  const [oracleCustomEquipment, setOracleCustomEquipment] = useState<any[]>([]);

  // Oracle-generated flag (shows review banner + inline edit buttons on Finalize)
  const [oracleGenerated, setOracleGenerated] = useState(false);

  // ── Custom Homebrew Identity State ──
  const [customRaceMode, setCustomRaceMode] = useState(false);
  const [customRaceName, setCustomRaceName] = useState('');
  const [customRaceDesc, setCustomRaceDesc] = useState('');
  const [customClassMode, setCustomClassMode] = useState(false);
  const [customClassName, setCustomClassName] = useState('');
  const [customClassDesc, setCustomClassDesc] = useState('');
  const [customClassHitDie, setCustomClassHitDie] = useState('8');
  const [customClassSpellAbility, setCustomClassSpellAbility] = useState<string>('');
  const [customBgMode, setCustomBgMode] = useState(false);
  const [customBgName, setCustomBgName] = useState('');
  const [customBgDesc, setCustomBgDesc] = useState('');

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
      case 0: return (!!selectedRace && (!selectedRace.subraces?.length || !!selectedSubrace)) || (customRaceMode && customRaceName.trim().length > 0);
      case 1: {
        if (customClassMode) return customClassName.trim().length > 0;
        if (!selectedClass) return false;
        if (selectedClass.subclassLevel === 1 && !selectedSubclassChoice) return false;
        return true;
      }
      case 2: { // Abilities (was step 3)
        if (abilityMethod === 'point_buy') return pointsLeft >= 0;
        if (abilityMethod === 'standard_array') return usedArrayValues.length === 6;
        return true;
      }
      case 3: // Spells (was step 2)
        if (customClassMode) return true;
        if (!selectedClass?.spellcaster) return true;
        return true; // Don't hard-block — caps enforce naturally via disabled buttons
      case 4: return !!selectedBackground || (customBgMode && customBgName.trim().length > 0);
      case 5: return customClassMode || selectedSkills.length === maxSkillChoices;
      case 6: return true; // Equipment just defaults to first option
      case 7: return true; // portrait is optional
      case 8: return characterName.trim().length > 0;
      default: return true;
    }
  };

  // ── Handlers ──
  const [oracleQuery, setOracleQuery] = useState('');
  const [oracleLoading, setOracleLoading] = useState(false);
  const [oracleLoadingText, setOracleLoadingText] = useState('Forging your destiny...');

  useEffect(() => {
    if (!oracleLoading) return;
    const phrases = [
      "Consulting the Elder Gods...",
      "Rolling digital D20s...",
      "Balancing Point Buy stats...",
      "Inventing homebrew spells...",
      "Painting character portrait...",
      "Assigning tragic flaws...",
      "Distributing skill points...",
      "Weaving your backstory...",
      "Almost ready..."
    ];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % phrases.length;
      setOracleLoadingText(phrases[i]);
    }, 2500);
    return () => clearInterval(interval);
  }, [oracleLoading]);

  const invokeOracle = async (mode: 'text' | 'chaos') => {
    if (mode === 'text' && !oracleQuery.trim()) return;
    setOracleLoading(true);
    try {
      // Package only the IDs and valid limits, not the entire massive object schema, to save tokens.
      const constraints = {
        races: RACES.map(r => ({ id: r.id, subraces: r.subraces?.map(s => s.id) || null })),
        classes: CLASSES.map(c => ({ id: c.id, allowedSkills: c.skillChoices, numChoices: c.numSkillChoices })),
        backgrounds: BACKGROUNDS.map(b => b.id)
      };

      const res = await fetch('/api/dungeon-buddy/oracle/forge-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: oracleQuery, mode, constraints })
      });

      if (!res.ok) {
        try {
          const errData = await res.json();
          throw new Error(errData.error || "Forge connection failed.");
        } catch {
          throw new Error("Backend connection failed structure.");
        }
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // ── FORCE MAP STATE ──
      const fRace = RACES.find(r => r.id === data.raceId);
      if (fRace) {
        setSelectedRace(fRace);
        if (data.subraceId) setSelectedSubrace(fRace.subraces?.find(s => s.id === data.subraceId) || null);
      }
      const fClass = CLASSES.find(c => c.id === data.classId);
      if (fClass) {
        setSelectedClass(fClass);
        if (fClass.subclassLevel === 1 && fClass.subclasses && fClass.subclasses.length > 0) {
           setSelectedSubclassChoice(fClass.subclasses[0].name);
        }
      }
      const fBg = BACKGROUNDS.find(b => b.id === data.backgroundId);
      if (fBg) setSelectedBackground(fBg);

      // ── POINT BUY VALIDATION (Directive 3b) ──
      // Verify the LLM's base scores actually spend exactly 27 points.
      // If not, silently fall back to Standard Array mapped by class primary ability.
      setAbilityMethod('point_buy');
      if (data.baseScores) {
        const pbCosts: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
        const scores = data.baseScores as Record<string, number>;
        let totalCost = 0;
        let valid = true;
        for (const val of Object.values(scores)) {
          if (val < 8 || val > 20 || pbCosts[val] === undefined) { valid = false; break; }
          totalCost += pbCosts[val];
        }
        if (valid && totalCost === 27) {
          setBaseScores(scores as Record<AbilityName, number>);
        } else {
          // Fallback: Apply Standard Array, prioritizing class primary abilities
          console.warn('[Oracle] Point buy validation failed (cost=' + totalCost + '). Applying Standard Array fallback.');
          const primaryAbilities = fClass?.primaryAbility || ['str'];
          const allAbilities: AbilityName[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
          const sortedAbilities = [
            ...allAbilities.filter(a => primaryAbilities.includes(a)),
            ...allAbilities.filter(a => !primaryAbilities.includes(a))
          ];
          const stdArray = [15, 14, 13, 12, 10, 8];
          const fallback: Record<AbilityName, number> = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
          sortedAbilities.forEach((ability, i) => { fallback[ability] = stdArray[i]; });
          setBaseScores(fallback);
        }
      }

      if (data.skills) setSelectedSkills(data.skills);

      if (data.name) setCharacterName(data.name);
      if (data.personalityTraits) setOracleTraits(data.personalityTraits);
      if (data.ideals) setOracleIdeals(data.ideals);
      if (data.bonds) setOracleBonds(data.bonds);
      if (data.flaws) setOracleFlaws(data.flaws);
      if (data.customSpells && Array.isArray(data.customSpells)) {
        setOracleCustomSpells(data.customSpells.map((cs: any) => ({
           id: `custom_spell_${Date.now()}_${Math.floor(Math.random()*10000)}`,
           name: cs.name || "Unknown Spell",
           level: parseInt(cs.level) || 0,
           school: cs.school || "Evocation",
           castingTime: cs.castingTime || "1 Action",
           range: cs.range || "Touch",
           components: cs.components || "V, S, M",
           duration: cs.duration || "Instantaneous",
           description: cs.description || "",
           damage: cs.damage || "",
           damageType: cs.damageType || "",
           actionCost: cs.actionCost || "action",
           classes: [data.classId] // Bind it to their class
        })));
      }
      if (data.customEquipment && Array.isArray(data.customEquipment)) {
        setOracleCustomEquipment(data.customEquipment.map((ce: any) => ({
           id: `inst_${Date.now()}_${Math.floor(Math.random()*10000)}`,
           name: ce.name || "Unknown Item",
           qty: ce.qty || 1,
           weight: ce.weight || 0,
           attuned: false,
           slot: ce.slot || null,
           type: ce.type || 'gear',
           description: ce.description || '',
           armorClass: ce.armorClass,
           armorCategory: ce.armorCategory,
           damage: ce.damage,
           damageType: ce.damageType,
           properties: Array.isArray(ce.properties) ? ce.properties : undefined,
           weaponCategory: ce.weaponCategory,
           actionCost: ce.actionCost || (ce.type === 'weapon' ? 'action' : null),
           modifiers: Array.isArray(ce.modifiers) ? ce.modifiers : undefined,
        })));
      }

      setOracleGenerated(true);

      // ── PORTRAIT GENERATION WITH ERROR HANDLING (Directive 3c) ──
      if (data.portraitPrompt) {
        setPortraitDescription(data.portraitPrompt);
        try {
          await generatePortrait(data.portraitPrompt, fRace, fClass);
        } catch (portraitErr: any) {
          console.error('[Oracle] Portrait generation failed:', portraitErr);
          // Non-blocking toast notification — don't break the flow
          setTimeout(() => alert('⚠ Portrait generation failed. You can retry on Step 7 (Portrait).'), 100);
        }
      }

      setStep(8); // Jump straight to Finalize screen!
    } catch (e: any) {
      console.error(e);
      alert('The Oracle failed to conjure a valid character: ' + e.message);
    } finally {
      setOracleLoading(false);
    }
  };


  const randomizePointBuy = () => {
    const currentBase: Record<AbilityName, number> = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
    let points = POINT_BUY_TOTAL;
    const abilities = ABILITY_NAMES.map(a => a.key);
    
    while (points > 0) {
      const validAbilities = abilities.filter(ability => {
        const val = currentBase[ability];
        if (val >= 20) return false;
        const currentCost = getPointBuyCost(currentBase);
        const nextCost = getPointBuyCost({ ...currentBase, [ability]: val + 1 });
        return (nextCost - currentCost) <= points;
      });
      
      if (validAbilities.length === 0) break;
      
      const target = validAbilities[Math.floor(Math.random() * validAbilities.length)];
      const currentCost = getPointBuyCost(currentBase);
      currentBase[target] += 1;
      const nextCost = getPointBuyCost(currentBase);
      points -= (nextCost - currentCost);
    }
    
    setBaseScores(currentBase);
  };

  const handlePointBuyChange = (ability: AbilityName, delta: number) => {
    const newVal = baseScores[ability] + delta;
    if (newVal < 8 || newVal > 20) return;
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

  const generatePortrait = async (forcedPrompt?: string, forcedRace?: any, forcedClass?: any) => {
    const descriptionToUse = forcedPrompt || portraitDescription;
    if (!descriptionToUse.trim()) return;
    setPortraitLoading(true);
    try {
      const raceLabel = forcedRace ? forcedRace.name : (selectedRace?.name + (selectedSubrace ? ` (${selectedSubrace.name})` : ''));
      const classLabel = forcedClass ? forcedClass.name : selectedClass?.name;
      
      const res = await fetch(`/api/dungeon-buddy/generate-portrait`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: descriptionToUse,
          race: raceLabel,
          charClass: classLabel,
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
    // Build safe fallback objects for custom modes
    const effectiveRace = customRaceMode
      ? { name: customRaceName, speed: 30, abilityBonuses: {}, traits: [], languages: ['Common'], id: 'custom', description: customRaceDesc }
      : selectedRace;
    const effectiveClass = customClassMode
      ? {
          name: customClassName, id: 'custom', description: customClassDesc,
          hitDie: parseInt(customClassHitDie) || 8, spellcaster: !!customClassSpellAbility,
          spellcastingAbility: customClassSpellAbility || null,
          savingThrows: [], armorProficiencies: [], weaponProficiencies: [],
          features: [], primaryAbility: [], numSkillChoices: 2, skillChoices: [],
          spellSlots: null, subclasses: null, subclassLevel: 0, subclassLabel: '',
        }
      : selectedClass;
    const effectiveBackground = customBgMode
      ? { name: customBgName, id: 'custom', description: customBgDesc, skillProficiencies: [], equipment: [] }
      : selectedBackground;

    if (!effectiveRace || !effectiveClass || !effectiveBackground) return;
    const conMod = calculateModifier(finalScores.con);
    const startingHp = calculateStartingHp(effectiveClass as any, conMod);
    const allSkills = [...new Set([...lockedSkills, ...selectedSkills])];

    const gearIds = Object.values(draftGearSelections).flat();
    const inventory = gearIds.map((itemId: string, i: number) => {
      const dbItem = ITEM_DATABASE[itemId];
      if (!dbItem) return null;
      return {
        id: `inst_${Date.now()}_${i}`,
        name: dbItem.name || 'Unknown Item',
        qty: dbItem.qty || 1,
        weight: dbItem.weight || 0,
        attuned: false,
        slot: dbItem.slot || null,
        type: dbItem.type || 'gear',
        description: dbItem.description || '',
        // ── Armor fields ──
        armorClass: dbItem.armorClass,
        armorCategory: dbItem.armorCategory,
        // ── Weapon fields (critical for CombatTab damage & proficiency) ──
        damage: dbItem.damage,
        damageType: dbItem.damageType,
        properties: dbItem.properties ? [...dbItem.properties] : undefined,
        weaponCategory: dbItem.weaponCategory,
        actionCost: dbItem.actionCost,
      };
    }).filter(Boolean);
    const equipped: Record<string, any> = { head: null, chest: null, cloak: null, mainHand: null, offHand: null, gloves: null, boots: null, ring1: null, ring2: null, amulet: null };
    // Auto-equip the first item for each slot; extras stay in the backpack
    const startingInventory = inventory.filter((i: any) => {
      if (i.slot && !equipped[i.slot]) {
        equipped[i.slot] = i;
        return false; // Equipped — remove from backpack
      }
      return true; // No slot, or slot already filled — keep in backpack
    });

    // ── Homebrew Registry: Route Oracle output into proper structures ──
    const homebrewSpells = oracleCustomSpells.map((cs: any) => ({
      ...cs,
      isHomebrew: true as const,
      createdAt: Date.now(),
    }));

    const homebrewItems = oracleCustomEquipment.map((ce: any) => ({
      ...ce,
      isHomebrew: true as const,
      createdAt: Date.now(),
    }));

    // Merge Oracle Custom Equipment into equipped/inventory
    if (oracleCustomEquipment.length > 0) {
      oracleCustomEquipment.forEach(item => {
        if (item.slot && !equipped[item.slot]) {
          equipped[item.slot] = item;
        } else {
          startingInventory.push(item);
        }
      });
    }

    const initialResources: Record<string, any> = {};
    // ── Spell Slot Initialization (1-indexed to match LevelUp convention) ──
    if ((effectiveClass as any).id === 'warlock') {
      // Warlock uses Pact Magic — completely separate from standard spell slots
      const pact = WARLOCK_PACT_SLOTS[1];
      if (pact) {
        initialResources['pact_magic'] = {
          name: `Pact Slots (Lv.${pact.level})`,
          max: pact.slots,
          used: 0,
          recharge: 'short',
        };
      }
    } else if ((effectiveClass as any).spellcaster && (effectiveClass as any).spellSlots) {
      const slotsForLevel = (effectiveClass as any).spellSlots[1]; // number[] for level 1
      if (slotsForLevel && Array.isArray(slotsForLevel)) {
        slotsForLevel.forEach((count: number, idx: number) => {
          if (count > 0) {
            const sLevel = idx + 1;
            const key = `spell_slot_${sLevel}`;
            initialResources[key] = {
              name: `Level ${sLevel} Spell Slots`,
              max: count,
              used: 0,
              recharge: 'long',
            };
          }
        });
      }
    }

    const subclasses: Record<string, string> = {};
    let subclassFeatures: any[] = [];
    if (selectedSubclassChoice) {
       subclasses[(effectiveClass as any).name] = selectedSubclassChoice;
       const scData = (effectiveClass as any).subclasses?.find((sc:any) => sc.name === selectedSubclassChoice);
       if (scData && scData.features) {
         subclassFeatures = scData.features.filter((f:any) => f.level === 1);
       }
    }

    const newChar = {
      id: '', // populated by backend POST response
      name: characterName,
      race: (effectiveRace as any).name + (selectedSubrace ? ` (${selectedSubrace.name})` : ''),
      class: (effectiveClass as any).name,
      subclass: selectedSubclassChoice || null,
      subclasses,
      background: (effectiveBackground as any).name,
      level: 1,
      xp: 0,
      alignment: '',
      maxHp: startingHp,
      currentHp: startingHp,
      tempHp: 0,
      ac: 10 + calculateModifier(finalScores.dex),
      stats: finalScores,
      skills: allSkills,
      expertise: [],
      hitDie: (effectiveClass as any).hitDie,
      hitDiceTotal: 1,
      hitDiceUsed: 0,
      speed: (effectiveRace as any).speed,
      proficiencyBonus: 2,
      savingThrows: (effectiveClass as any).savingThrows || [],
      armorProficiencies: (effectiveClass as any).armorProficiencies || [],
      weaponProficiencies: (effectiveClass as any).weaponProficiencies || [],
      spellcaster: (effectiveClass as any).spellcaster,
      spellcastingAbility: (effectiveClass as any).spellcastingAbility || null,
      resources: initialResources,
      cantrips: [],
      knownSpells: [...homebrewSpells.map((s: any) => s.id), ...draftedSpells],
      preparedSpells: [...homebrewSpells.map((s: any) => s.id), ...draftedSpells],
      customSpells: homebrewSpells.length > 0 ? homebrewSpells : [],
      conditions: [],
      deathSaves: { successes: 0, failures: 0 },
      attacks: [],
      traits: [...((effectiveRace as any).traits || []), ...(selectedSubrace?.traits || [])],
      languages: (effectiveRace as any).languages || ['Common'],
      inventory: startingInventory,
      gold: 0,
      silver: 0,
      copper: 0,
      equipped,
      equipment: (effectiveBackground as any).equipment || [],
      features: [...((effectiveClass as any).features || []).filter((f:any) => f.level <= 1), ...subclassFeatures],
      portrait: portraitData || null,
      notes: '', quests: '', people: '', places: '', feats: [],
      personalityTraits: oraclePersonalityTraits,
      ideals: oracleIdeals,
      bonds: oracleBonds,
      flaws: oracleFlaws,
      homebrew: {
        spells: homebrewSpells,
        items: homebrewItems,
        features: [],
        subclasses: [],
      },
      logbook: [{
        id: 'log_' + Date.now(),
        timestamp: Date.now(),
        type: 'creation',
        description: `${characterName} was born. A Level 1 ${(effectiveRace as any).name} ${(effectiveClass as any).name}, ${(effectiveBackground as any).name} background.`,
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
      <div className={styles.oracleSection} style={{ marginBottom: '32px', borderRadius: '8px', border: '1px solid var(--border-gold)' }}>
        <div className={styles.oracleHeader}>
          <h3 className={styles.oracleTitle}>✨ The Character Oracle</h3>
        </div>
        <p className={styles.oracleDesc}>Describe the character you want to play, and the Oracle will forge their stats, class, and portrait automatically. Or surrender to chaos for a completely random hero.</p>
        
        <div className={styles.oracleInputWrapper} style={{ flexDirection: 'column' }}>
          <textarea 
            className={styles.oracleInput} 
            placeholder="e.g. 'A sneaky halfling who uses daggers and loves stealing cheese.'" 
            value={oracleQuery}
            onChange={e => setOracleQuery(e.target.value)}
            disabled={oracleLoading}
          />
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
             {oracleLoading && <span style={{ color: 'var(--gold-bright)', fontStyle: 'italic', fontSize: '0.9rem', marginRight: 'auto' }}>{oracleLoadingText}</span>}
             <button title="Randomize a fully chaotic character" className={styles.btnChaos} onClick={() => invokeOracle('chaos')} disabled={oracleLoading}>🎲 Pure Chaos</button>
             <button className={styles.btnOracle} onClick={() => invokeOracle('text')} disabled={!oracleQuery.trim() || oracleLoading}>
               {oracleLoading ? 'Conjuring...' : 'Forge from Description'}
             </button>
          </div>
        </div>
      </div>

      <h2 className={styles.sectionTitle}>Choose Your Race</h2>
      <p className={styles.sectionSubtitle}>Your race determines your physical traits, innate abilities, and cultural heritage in the world.</p>
      <div className={styles.optionsGrid}>
        {RACES.map(race => (
          <div
            key={race.id}
            className={`${styles.optionCard} ${selectedRace?.id === race.id && !customRaceMode ? styles.selected : ''}`}
            onClick={() => { setSelectedRace(race); setSelectedSubrace(null); setCustomRaceMode(false); }}
          >
            <h3 className={styles.optionName}>{race.name}</h3>
            <p className={styles.optionMeta}>
              Speed {race.speed} ft · {Object.entries(race.abilityBonuses).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(', ')}
            </p>
            <p className={styles.optionDesc}>{race.description}</p>
          </div>
        ))}

        {/* Custom Race Card */}
        <div
          className={`${styles.optionCard} ${customRaceMode ? styles.selected : ''}`}
          onClick={() => { setCustomRaceMode(true); setSelectedRace(null); setSelectedSubrace(null); }}
          style={{ borderStyle: customRaceMode ? 'solid' : 'dashed', borderColor: customRaceMode ? '#cfaa5e' : '#cfaa5e55' }}
        >
          <h3 className={styles.optionName} style={{ color: '#cfaa5e' }}>✨ Custom Race</h3>
          <p className={styles.optionMeta}>Homebrew · Speed 30 ft · No racial bonuses</p>
          <p className={styles.optionDesc}>Create a completely custom race for your homebrew world.</p>
        </div>
      </div>

      {/* Custom Race Form */}
      {customRaceMode && (
        <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(207,170,94,0.06)', border: '1px solid #cfaa5e', borderRadius: '8px' }}>
          <input
            placeholder="Race Name (e.g., Aetherborn)"
            value={customRaceName}
            onChange={e => setCustomRaceName(e.target.value)}
            className={styles.oracleInput}
            style={{ width: '100%', marginBottom: '8px', padding: '10px', background: '#111', border: '1px solid #444' }}
          />
          <textarea
            placeholder="Brief description of this race..."
            value={customRaceDesc}
            onChange={e => setCustomRaceDesc(e.target.value)}
            className={styles.oracleInput}
            style={{ width: '100%', minHeight: '60px', padding: '10px', background: '#111', border: '1px solid #444', resize: 'vertical' }}
          />
          <p style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>Defaults: Speed 30ft, no ability bonuses. You can add homebrew features later via the Features tab.</p>
        </div>
      )}
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
            className={`${styles.optionCard} ${selectedClass?.id === cls.id && !customClassMode ? styles.selected : ''}`}
            onClick={() => { setSelectedClass(cls); setSelectedSkills([]); setSelectedSubclassChoice(''); setCustomClassMode(false); }}
          >
            <h3 className={styles.optionName}>{cls.name}</h3>
            <p className={styles.optionMeta}>
              d{cls.hitDie} hit die · {cls.spellcaster ? '✦ Spellcaster' : '⚔ Martial'}
            </p>
            <p className={styles.optionDesc}>{cls.description}</p>
          </div>
        ))}

        {/* Custom Class Card */}
        <div
          className={`${styles.optionCard} ${customClassMode ? styles.selected : ''}`}
          onClick={() => { setCustomClassMode(true); setSelectedClass(null); setSelectedSkills([]); setSelectedSubclassChoice(''); }}
          style={{ borderStyle: customClassMode ? 'solid' : 'dashed', borderColor: customClassMode ? '#cfaa5e' : '#cfaa5e55' }}
        >
          <h3 className={styles.optionName} style={{ color: '#cfaa5e' }}>✨ Custom Class</h3>
          <p className={styles.optionMeta}>Homebrew · Configure hit die & spellcasting</p>
          <p className={styles.optionDesc}>Create a fully custom class — select a hit die and optional spellcasting ability.</p>
        </div>
      </div>

      {/* Custom Class Form */}
      {customClassMode && (
        <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(207,170,94,0.06)', border: '1px solid #cfaa5e', borderRadius: '8px' }}>
          <input
            placeholder="Class Name (e.g., Chronomancer)"
            value={customClassName}
            onChange={e => setCustomClassName(e.target.value)}
            className={styles.oracleInput}
            style={{ width: '100%', marginBottom: '8px', padding: '10px', background: '#111', border: '1px solid #444' }}
          />
          <textarea
            placeholder="Brief description of this class..."
            value={customClassDesc}
            onChange={e => setCustomClassDesc(e.target.value)}
            className={styles.oracleInput}
            style={{ width: '100%', minHeight: '50px', marginBottom: '8px', padding: '10px', background: '#111', border: '1px solid #444', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <label style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Hit Die</label>
              <select
                value={customClassHitDie}
                onChange={e => setCustomClassHitDie(e.target.value)}
                style={{ width: '100%', padding: '10px', background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
              >
                <option value="6">d6 (Wizard/Sorcerer)</option>
                <option value="8">d8 (Bard/Cleric/Rogue)</option>
                <option value="10">d10 (Fighter/Ranger)</option>
                <option value="12">d12 (Barbarian)</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <label style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Spellcasting Ability</label>
              <select
                value={customClassSpellAbility}
                onChange={e => setCustomClassSpellAbility(e.target.value)}
                style={{ width: '100%', padding: '10px', background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
              >
                <option value="">None (Martial)</option>
                <option value="int">Intelligence</option>
                <option value="wis">Wisdom</option>
                <option value="cha">Charisma</option>
              </select>
            </div>
          </div>
          <p style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>You can add custom features, spells, and equipment after creation via the Homebrew system.</p>
        </div>
      )}

      {selectedClass && selectedClass.subclassLevel === 1 && (
        <div style={{ marginTop: '32px', animation: 'fadeIn 0.3s' }}>
          <h2 className={styles.sectionTitle}>Choose Your {selectedClass.subclassLabel || 'Subclass'}</h2>
          <p className={styles.sectionSubtitle}>As a {selectedClass.name}, you must commit to a path immediately.</p>
          <div style={{ maxWidth: '400px', marginBottom: '24px' }}>
            <select 
               value={selectedSubclassChoice} 
               onChange={e => setSelectedSubclassChoice(e.target.value)}
               className={styles.oracleInput}
               style={{ width: '100%', padding: '12px', background: '#111', border: '1px solid #cfaa5e' }}
            >
              <option value="">-- Choose Path --</option>
              {selectedClass.subclasses?.map((sc:any) => (
                <option key={sc.id} value={sc.name}>{sc.name}</option>
              ))}
            </select>
          </div>

          {selectedSubclassChoice && (
            <div style={{ padding: '16px', background: 'rgba(207, 170, 94, 0.1)', border: '1px solid #cfaa5e', borderRadius: '8px' }}>
               {(() => {
                 const scData = selectedClass.subclasses?.find((s:any) => s.name === selectedSubclassChoice);
                 if (!scData) return null;
                 const lvl1Features = scData.features?.filter((f:any) => f.level === 1) || [];
                 return (
                   <>
                     <h4 style={{ margin: '0 0 8px 0', color: '#cfaa5e', fontFamily: 'Cinzel, serif', fontSize: '18px' }}>{scData.name} Overview</h4>
                     <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#ccc', fontStyle: 'italic', lineHeight: 1.5 }}>{scData.description}</p>
                     
                     <h5 style={{ margin: '0 0 12px 0', color: '#55aacc', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '1px' }}>Features Granted Now</h5>
                     {lvl1Features.length > 0 ? (
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                         {lvl1Features.map((f:any) => (
                           <div key={f.name} style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '4px', borderLeft: '2px solid #55aacc' }}>
                             <strong style={{ display: 'block', color: '#e0e0e0', fontSize: '13px', marginBottom: '4px' }}>{f.name}</strong>
                             <span style={{ color: '#aaa', fontSize: '12px', lineHeight: 1.4, display: 'block' }}>{f.description}</span>
                           </div>
                         ))}
                       </div>
                     ) : (
                       <p style={{ fontSize: '12px', color: '#888', fontStyle: 'italic', margin: 0 }}>This path grants standard proficiencies or spell access.</p>
                     )}
                   </>
                 );
               })()}
            </div>
          )}
        </div>
      )}
    </>
  );

  const renderSpellsStep = () => {
    if (!selectedClass?.spellcaster) {
       return (
         <div style={{ textAlign: 'center', padding: '64px 20px' }}>
           <h2 style={{ color: '#aaa', fontFamily: 'Cinzel', marginBottom: '16px' }}>Martial Path</h2>
           <p style={{ color: '#888' }}>As a {selectedClass?.name || 'warrior'}, you do not command arcane forces. Your might lies in steel and determination.</p>
           <button className={styles.btnNext} onClick={() => setStep(step + 1)} style={{ marginTop: '24px' }}>Proceed to Background →</button>
         </div>
       );
    }
    
    // ── Compute spell budget using 5E rules ──
    const isPrep = isPrepCaster(selectedClass.name);
    const spellAbility = selectedClass.spellcastingAbility || 'int';
    const spellAbilityMod = calculateModifier(finalScores[spellAbility as AbilityName] || 10);
    const prog = getSpellProgression(selectedClass.name, 1, spellAbilityMod);
    
    // Count current draft by type
    const allSpellDb = require('../lib/data/spells').SPELL_DATABASE;
    const draftedCantrips = draftedSpells.filter(id => {
      const spell = allSpellDb[id];
      return spell && spell.level === 0;
    }).length;
    const draftedLeveled = draftedSpells.filter(id => {
      const spell = allSpellDb[id];
      return spell && spell.level > 0;
    }).length;
    
    const mockCharState: any = {
      level: 1,
      class: selectedClass.name,
      subclass: selectedSubclassChoice || null,
      spellcaster: true,
      knownSpells: draftedSpells
    };

    const spellTypeLabel = isPrep ? 'Prepared Spells' : 'Known Spells';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
         <h2 className={styles.sectionTitle}>Draft Your Initial Grimoire</h2>
         <p className={styles.sectionSubtitle}>
           {isPrep 
             ? `As a ${selectedClass.name}, you prepare spells daily from your class list. Select your initial ${spellTypeLabel.toLowerCase()} — you can swap these after each long rest.`
             : `Select the specific magical invocations your ${selectedClass.name} knows at Level 1.`}
         </p>
         
         {/* ── Spell Budget Counter ── */}
         <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
           {prog.cantripsKnown > 0 && (
             <div style={{ 
               background: draftedCantrips >= prog.cantripsKnown ? 'rgba(207,170,94,0.15)' : '#111', 
               border: `1px solid ${draftedCantrips >= prog.cantripsKnown ? '#cfaa5e' : '#333'}`, 
               padding: '10px 20px', borderRadius: '6px', textAlign: 'center', minWidth: '140px' 
             }}>
               <div style={{ fontSize: '22px', fontFamily: 'Cinzel', color: draftedCantrips > prog.cantripsKnown ? '#c44' : '#cfaa5e' }}>
                 {draftedCantrips} / {prog.cantripsKnown}
               </div>
               <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cantrips</div>
             </div>
           )}
           {prog.spellsKnown > 0 && (
             <div style={{ 
               background: draftedLeveled >= prog.spellsKnown ? 'rgba(207,170,94,0.15)' : '#111', 
               border: `1px solid ${draftedLeveled >= prog.spellsKnown ? '#cfaa5e' : '#333'}`, 
               padding: '10px 20px', borderRadius: '6px', textAlign: 'center', minWidth: '140px' 
             }}>
               <div style={{ fontSize: '22px', fontFamily: 'Cinzel', color: draftedLeveled > prog.spellsKnown ? '#c44' : '#cfaa5e' }}>
                 {draftedLeveled} / {prog.spellsKnown}
               </div>
               <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{spellTypeLabel}</div>
             </div>
           )}
         </div>

         {selectedClass.subclasses && selectedSubclassChoice && (
            <div style={{ padding: '12px', background: 'rgba(200, 150, 50, 0.1)', border: '1px solid rgba(200, 150, 50, 0.3)', borderRadius: '4px', marginBottom: '12px', fontSize: '12px', color: '#ccc' }}>
              <strong>Subclass Magic:</strong> If your <em>{selectedSubclassChoice}</em> subclass grants cross-class spells (e.g. Fiend Warlocks gaining <em>Command</em>), uncheck <strong>"Show Valid Leveling Magic Only"</strong> to find and draft them.
            </div>
         )}
         <div style={{ flex: 1, minHeight: '400px', borderTop: '1px dashed #333', paddingTop: '16px' }}>
            <SpellBrowser 
               inline={true} 
               draftMode={true} 
               draftedSpells={draftedSpells}
               contextChar={mockCharState}
               maxCantrips={prog.cantripsKnown}
               maxLeveledSpells={prog.spellsKnown}
               draftedCantrips={draftedCantrips}
               draftedLeveled={draftedLeveled}
               onSpellDraft={(id) => {
                 // Toggle off always works
                 if (draftedSpells.includes(id)) {
                   setDraftedSpells(draftedSpells.filter(s => s !== id));
                   return;
                 }
                 // Toggle on: enforce caps
                 const spell = allSpellDb[id];
                 if (spell) {
                   if (spell.level === 0 && draftedCantrips >= prog.cantripsKnown) return; // cantrip cap hit
                   if (spell.level > 0 && draftedLeveled >= prog.spellsKnown) return; // spell cap hit
                 }
                 setDraftedSpells([...draftedSpells, id]);
               }} 
            />
         </div>
      </div>
    );
  };

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
        <div className={styles.pointsRemaining} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Points Remaining: <span style={{ color: pointsLeft === 0 ? '#44cc44' : '#cfaa5e' }}>{pointsLeft}</span> / {POINT_BUY_TOTAL}</span>
          <button 
            onClick={randomizePointBuy} 
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid var(--border-gold)', color: 'var(--gold)', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'Cinzel, serif' }}
          >
            Randomize 🎲
          </button>
        </div>
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
                  <button className={styles.abilityBtn} onClick={() => handlePointBuyChange(key, 1)} disabled={baseScores[key] >= 20}>+</button>
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
            className={`${styles.optionCard} ${selectedBackground?.id === bg.id && !customBgMode ? styles.selected : ''}`}
            onClick={() => { setSelectedBackground(bg); setCustomBgMode(false); }}
          >
            <h3 className={styles.optionName}>{bg.name}</h3>
            <p className={styles.optionMeta}>{bg.skillProficiencies.map(s => SKILL_LABELS[s]).join(', ')}</p>
            <p className={styles.optionDesc}>{bg.description}</p>
          </div>
        ))}

        {/* Custom Background Card */}
        <div
          className={`${styles.optionCard} ${customBgMode ? styles.selected : ''}`}
          onClick={() => { setCustomBgMode(true); setSelectedBackground(null); }}
          style={{ borderStyle: customBgMode ? 'solid' : 'dashed', borderColor: customBgMode ? '#cfaa5e' : '#cfaa5e55' }}
        >
          <h3 className={styles.optionName} style={{ color: '#cfaa5e' }}>✨ Custom Background</h3>
          <p className={styles.optionMeta}>Homebrew · No default skill proficiencies</p>
          <p className={styles.optionDesc}>Define a unique backstory that doesn't fit any standard template.</p>
        </div>
      </div>

      {/* Custom Background Form */}
      {customBgMode && (
        <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(207,170,94,0.06)', border: '1px solid #cfaa5e', borderRadius: '8px' }}>
          <input
            placeholder="Background Name (e.g., Displaced Noble)"
            value={customBgName}
            onChange={e => setCustomBgName(e.target.value)}
            className={styles.oracleInput}
            style={{ width: '100%', marginBottom: '8px', padding: '10px', background: '#111', border: '1px solid #444' }}
          />
          <textarea
            placeholder="Brief description of this background..."
            value={customBgDesc}
            onChange={e => setCustomBgDesc(e.target.value)}
            className={styles.oracleInput}
            style={{ width: '100%', minHeight: '60px', padding: '10px', background: '#111', border: '1px solid #444', resize: 'vertical' }}
          />
          <p style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>Custom backgrounds start with no locked skill proficiencies. Choose your skills freely in the Skills step.</p>
        </div>
      )}
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
              onClick={() => generatePortrait()}
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

    const editBtnStyle: React.CSSProperties = {
      padding: '3px 10px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold',
      background: 'transparent', border: '1px solid rgba(207,170,94,0.5)', color: '#cfaa5e',
      cursor: 'pointer', fontFamily: 'Cinzel, serif', letterSpacing: '0.5px',
      transition: 'all 0.2s', textTransform: 'uppercase'
    };

    const SectionHeader = ({ label, stepIdx }: { label: string; stepIdx: number }) => (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className={styles.summaryLabel}>{label}</div>
        <button
          style={editBtnStyle}
          onClick={() => setStep(stepIdx)}
          onMouseEnter={e => { (e.target as any).style.background = 'rgba(207,170,94,0.15)'; }}
          onMouseLeave={e => { (e.target as any).style.background = 'transparent'; }}
        >✎ Edit</button>
      </div>
    );

    return (
      <>
        {oracleGenerated && (
          <div style={{
            padding: '14px 18px', marginBottom: '24px', borderRadius: '8px',
            background: 'linear-gradient(135deg, rgba(207,170,94,0.08), rgba(85,170,204,0.08))',
            border: '1px solid rgba(207,170,94,0.3)', display: 'flex', alignItems: 'center', gap: '12px'
          }}>
            <span style={{ fontSize: '24px' }}>✨</span>
            <div>
              <div style={{ color: '#cfaa5e', fontFamily: 'Cinzel, serif', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
                Oracle-Forged Character
              </div>
              <div style={{ color: '#aaa', fontSize: '12px', lineHeight: '1.5' }}>
                Review your character below. Click <strong style={{ color: '#cfaa5e' }}>✎ Edit</strong> next to any section, 
                or use the step bar at the top, to refine details before forging.
              </div>
            </div>
          </div>
        )}

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
              <SectionHeader label="Race" stepIdx={0} />
              <div className={styles.summaryValue}>{selectedRace?.name}{selectedSubrace ? ` (${selectedSubrace.name})` : ''}</div>
            </div>
            <div className={styles.summaryItem}>
              <SectionHeader label="Class" stepIdx={1} />
              <div className={styles.summaryValue}>
                {selectedClass?.name}{selectedSubclassChoice && ` (${selectedSubclassChoice})`}
              </div>
            </div>
            <div className={styles.summaryItem}>
              <SectionHeader label="Background" stepIdx={4} />
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
              <SectionHeader label="Speed" stepIdx={0} />
              <div className={styles.summaryValue}>{selectedRace?.speed} ft.</div>
            </div>
          </div>
          <div style={{ marginTop: '16px' }}>
            <div className={styles.summaryItem}>
              <SectionHeader label="Ability Scores" stepIdx={2} />
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                {ABILITY_NAMES.map(({ key, label }) => (
                  <span key={key} className={styles.bonusBadge}>
                    {label.substring(0, 3).toUpperCase()}: <span className={styles.bonusValue}>{finalScores[key]}</span> ({calculateModifier(finalScores[key]) >= 0 ? '+' : ''}{calculateModifier(finalScores[key])})
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginTop: '16px' }}>
            <div className={styles.summaryItem}>
              <SectionHeader label="Skills" stepIdx={5} />
              <div className={styles.summaryValueSmall}>
                {[...lockedSkills, ...selectedSkills].map(s => SKILL_LABELS[s] || s).join(', ') || 'None selected'}
              </div>
            </div>
          </div>
          {(draftedSpells.length > 0 || oracleCustomSpells.length > 0) && (
            <div style={{ marginTop: '16px' }}>
              <div className={styles.summaryItem}>
                <SectionHeader label="Initial Grimoire" stepIdx={3} />
                <div className={styles.summaryValueSmall}>
                  {draftedSpells.length} standard spells prepared, {oracleCustomSpells.length} custom spells forged.
                </div>
              </div>
            </div>
          )}
          <div style={{ marginTop: '16px' }}>
            <div className={styles.summaryItem}>
              <SectionHeader label="Equipment" stepIdx={6} />
              <div className={styles.summaryValueSmall}>
                {Object.values(draftGearSelections).flat().length > 0
                  ? `${Object.values(draftGearSelections).flat().length} items selected`
                  : 'Default equipment'}
                {oracleCustomEquipment.length > 0 && `, + ${oracleCustomEquipment.length} Oracle items`}
              </div>
            </div>
          </div>
          {portraitData && (
            <div style={{ marginTop: '16px', display: 'flex', gap: '16px', alignItems: 'start' }}>
              <div style={{ width: '120px', height: '120px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-dim)', flexShrink: 0 }}>
                <img src={`data:image/png;base64,${portraitData}`} alt="Portrait" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div className={styles.summaryItem} style={{ flex: 1 }}>
                <SectionHeader label="Portrait" stepIdx={7} />
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

    if (step === 4 && selectedBackground) {
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
        {step >= 3 && (
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
    const choices = selectedClass ? STARTING_EQUIPMENT_DB[selectedClass.id.toLowerCase()] || [] : [];
    return (
      <>
        <h2 className={styles.sectionTitle}>Select Starting Gear</h2>
        <p className={styles.sectionSubtitle}>Choose your preferred equipment pack for adventuring.</p>
        <div className={styles.optionsGrid} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {choices.length === 0 ? <p style={{ color: '#aaa', padding: '10px' }}>No specific class packs available. You will rely on background gear.</p> : choices.map((choice: any) => (
             <div key={choice.id} style={{ background: 'rgba(20,20,20,0.8)', padding: '16px', borderRadius: '8px', border: '1px solid #333' }}>
               <h3 className={styles.optionName} style={{ marginBottom: '12px', fontSize: '1.2rem', color: '#cfaa5e' }}>{choice.name}</h3>
               <div style={{ display: 'flex', gap: '12px' }}>
                 {choice.options.map((optGroup: any, j: number) => {
                    const isSelected = JSON.stringify(draftGearSelections[choice.id]) === JSON.stringify(optGroup);
                    return (
                      <div 
                        key={j} 
                        className={`${styles.optionCard} ${isSelected ? styles.selected : ''}`} 
                        onClick={() => setDraftGearChoice(choice.id, optGroup)}
                        style={{ flex: 1, padding: '12px' }}
                      >
                         <ul style={{ paddingLeft: '20px', fontSize: '0.9rem', color: isSelected ? '#fff' : '#aaa', margin: 0 }}>
                           {optGroup.map((itemId: any) => {
                             const item = ITEM_DATABASE[itemId];
                             if (!item) return <li key={itemId}>{itemId}</li>;
                             return (
                               <li key={itemId} style={{ display: 'flex', alignItems: 'center' }}>
                                 <Tooltip content={
                                   <div>
                                     <strong style={{ color: '#cfaa5e', display: 'block', marginBottom: '4px' }}>{item.name}</strong>
                                     <p style={{ margin: 0, paddingBottom: '4px', borderBottom: '1px solid #333', marginBottom: '4px' }}>{item.weight} lbs | {item.type}</p>
                                     <p style={{ margin: 0 }}>{item.description || 'A standard piece of adventuring equipment.'}</p>
                                     {item.armorClass && <p style={{ margin: '4px 0 0', color: '#6ba3c7' }}>AC: {item.armorClass}</p>}
                                     {item.damage && <p style={{ margin: '4px 0 0', color: '#c44' }}>Damage: {item.damage}</p>}
                                   </div>
                                 }>
                                   <span>{item.name}</span>
                                 </Tooltip>
                               </li>
                             );
                           })}
                         </ul>
                      </div>
                    );
                 })}
               </div>
             </div>
          ))}
        </div>
      </>
    );
  };

  const stepRenderers = [
    renderRaceStep, renderClassStep, renderAbilitiesStep, renderSpellsStep,
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
        {STEPS.map((s, i) => {
          // Allow clicking any visited step, or any step when on Finalize (Oracle-generated)
          const isClickable = i < step || (step === STEPS.length - 1 && i !== step);
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
              <div
                className={styles.stepItem}
                onClick={() => isClickable && setStep(i)}
                style={{ cursor: isClickable ? 'pointer' : 'default' }}
              >
                <div className={styles.stepNumber} style={getStepNumStyle(i)}>
                  {i < step ? '✓' : i + 1}
                </div>
                <div className={styles.stepLabel} style={getStepLabelStyle(i)}>{s.label}</div>
              </div>
              {i < STEPS.length - 1 && (
                <div className={styles.stepConnector} style={i < step ? { background: 'var(--ice-dim)' } : {}} />
              )}
            </div>
          );
        })}
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
          {step === 5 && `${maxSkillChoices - selectedSkills.length} skill${maxSkillChoices - selectedSkills.length !== 1 ? 's' : ''} remaining`}
          {step === 7 && 'Portrait is optional — skip or generate'}
        </div>
        {step < STEPS.length - 1 ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            {oracleGenerated && (
              <button
                className={styles.btnNext}
                onClick={() => setStep(STEPS.length - 1)}
                style={{ background: 'transparent', border: '1px solid var(--border-gold)', color: 'var(--gold)' }}
              >Review Summary →</button>
            )}
            <button className={styles.btnNext} onClick={() => setStep(step + 1)} disabled={!canProceed()}>Next →</button>
          </div>
        ) : (
          <button className={styles.btnCreate} onClick={handleCreate} disabled={!canProceed()}>⚔ Forge Hero</button>
        )}
      </div>
    </div>
  );
}
