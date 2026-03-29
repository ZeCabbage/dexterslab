'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import styles from './page.module.css';

// ── Types ──
interface LogEntry {
  id: string;
  timestamp: number;
  type: 'creation' | 'level_up' | 'manual_edit' | 'item' | 'spell' | 'note';
  description: string;
  previousState: any;
}

interface SpellSlot { max: number; used: number; }
interface Spell { name: string; level: number; school: string; prepared: boolean; description: string; }
interface InventoryItem { id: string; name: string; qty: number; weight: number; equipped: boolean; attuned: boolean; description: string; }
interface Attack { name: string; bonus: string; damage: string; type: string; }

interface Character {
  id: string;
  name: string;
  race: string;
  class: string;
  background: string;
  level: number;
  xp: number;
  alignment: string;
  maxHp: number;
  currentHp: number;
  tempHp: number;
  ac: number;
  speed: number;
  hitDie: string;
  proficiencyBonus: number;
  stats: { str: number; dex: number; con: number; int: number; wis: number; cha: number; };
  savingThrows: string[];
  skills: string[];
  attacks: Attack[];
  spellcastingAbility: string | null;
  spellcaster: boolean;
  spellSlots: Record<string, SpellSlot>;
  spells: Spell[];
  cantrips: string[];
  inventory: InventoryItem[];
  gold: number; silver: number; copper: number;
  traits: string[];
  features: { name: string; level: number; description: string; }[];
  languages: string[];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  portrait: string | null;
  personalityTraits: string;
  ideals: string;
  bonds: string;
  flaws: string;
  notes: string;
  deathSaves: { successes: number; failures: number; };
  conditions: string[];
  equipment: string[];
  logbook: LogEntry[];
}

const TABS = [
  { key: 'profile', icon: '👤', label: 'Profile' },
  { key: 'abilities', icon: '⚔', label: 'Abilities' },
  { key: 'skills', icon: '🎯', label: 'Skills' },
  { key: 'combat', icon: '🛡', label: 'Combat' },
  { key: 'spells', icon: '✦', label: 'Spells' },
  { key: 'inventory', icon: '🎒', label: 'Inventory' },
  { key: 'features', icon: '📜', label: 'Features' },
  { key: 'logbook', icon: '📖', label: 'Logbook' },
] as const;

type TabKey = typeof TABS[number]['key'];

const ABILITY_LABELS: Record<string, string> = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
const SKILL_MAP: { name: string; ability: string; key: string; }[] = [
  { name: 'Acrobatics', ability: 'dex', key: 'acrobatics' },
  { name: 'Animal Handling', ability: 'wis', key: 'animal_handling' },
  { name: 'Arcana', ability: 'int', key: 'arcana' },
  { name: 'Athletics', ability: 'str', key: 'athletics' },
  { name: 'Deception', ability: 'cha', key: 'deception' },
  { name: 'History', ability: 'int', key: 'history' },
  { name: 'Insight', ability: 'wis', key: 'insight' },
  { name: 'Intimidation', ability: 'cha', key: 'intimidation' },
  { name: 'Investigation', ability: 'int', key: 'investigation' },
  { name: 'Medicine', ability: 'wis', key: 'medicine' },
  { name: 'Nature', ability: 'int', key: 'nature' },
  { name: 'Perception', ability: 'wis', key: 'perception' },
  { name: 'Performance', ability: 'cha', key: 'performance' },
  { name: 'Persuasion', ability: 'cha', key: 'persuasion' },
  { name: 'Religion', ability: 'int', key: 'religion' },
  { name: 'Sleight of Hand', ability: 'dex', key: 'sleight_of_hand' },
  { name: 'Stealth', ability: 'dex', key: 'stealth' },
  { name: 'Survival', ability: 'wis', key: 'survival' },
];
const CONDITIONS = ['Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious'];
const SPELL_SCHOOLS = ['Abjuration','Conjuration','Divination','Enchantment','Evocation','Illusion','Necromancy','Transmutation'];
const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

const calcMod = (score: number) => Math.floor((score - 10) / 2);
const profBonusFromLevel = (level: number) => Math.ceil(level / 4) + 1;

export default function CharacterSheet() {
  const params = useParams();
  const charId = params.id as string;
  const [char, setChar] = useState<Character | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  const [saveStatus, setSaveStatus] = useState('');
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  // ── Data fetching ──
  useEffect(() => { fetchCharacter(); }, [charId]);

  const fetchCharacter = async () => {
    const res = await fetch(`/api/dungeon-buddy/characters/${charId}`);
    if (res.ok) {
      const data = await res.json();
      // Ensure defaults
      const defaults: Partial<Character> = {
        stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        ac: 10, xp: 0, tempHp: 0, speed: 30,
        savingThrows: [], skills: [], attacks: [],
        spellSlots: {}, spells: [], cantrips: [],
        inventory: [], gold: 0, silver: 0, copper: 0,
        traits: [], features: [], languages: [],
        armorProficiencies: [], weaponProficiencies: [],
        portrait: null, personalityTraits: '', ideals: '', bonds: '', flaws: '', notes: '',
        deathSaves: { successes: 0, failures: 0 },
        conditions: [], equipment: [], logbook: [],
        alignment: '', background: '', hitDie: 'd8',
        spellcaster: false, spellcastingAbility: null,
        proficiencyBonus: 2,
      };
      setChar({ ...defaults, ...data } as Character);
    }
  };

  const saveCharacter = useCallback(async (updatedChar: Character) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus('•');
    saveTimer.current = setTimeout(async () => {
      await fetch(`/api/dungeon-buddy/characters/${charId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedChar),
      });
      setSaveStatus('Saved ✓');
      setTimeout(() => setSaveStatus(''), 2000);
    }, 500);
  }, [charId]);

  const update = (changes: Partial<Character>) => {
    if (!char) return;
    const updated = { ...char, ...changes };
    setChar(updated);
    saveCharacter(updated);
  };

  const updateStat = (key: string, val: number) => {
    if (!char) return;
    update({ stats: { ...char.stats, [key]: val } });
  };

  if (!char) return <div className={styles.loadingScreen}>Loading Chronicle...</div>;

  const profBonus = profBonusFromLevel(char.level);
  const xpNext = XP_THRESHOLDS[char.level] || 999999;
  const xpPrev = XP_THRESHOLDS[char.level - 1] || 0;
  const xpProgress = Math.min(100, Math.max(0, ((char.xp - xpPrev) / (xpNext - xpPrev)) * 100));

  // ── Level Up ──
  const levelUp = () => {
    const hitDieVal = parseInt(char.hitDie?.replace('d', '') || '8');
    const conMod = calcMod(char.stats.con);
    const hpGain = Math.max(1, Math.floor(hitDieVal / 2) + 1 + conMod);
    const logEntry: LogEntry = {
      id: 'log_' + Date.now(),
      timestamp: Date.now(),
      type: 'level_up',
      description: `Leveled up to ${char.level + 1}. HP +${hpGain}.`,
      previousState: { level: char.level, maxHp: char.maxHp, currentHp: char.currentHp, proficiencyBonus: char.proficiencyBonus },
    };
    update({
      level: char.level + 1,
      maxHp: char.maxHp + hpGain,
      currentHp: char.currentHp + hpGain,
      proficiencyBonus: profBonusFromLevel(char.level + 1),
      logbook: [logEntry, ...(char.logbook || [])],
    });
  };

  const undoLog = (logId: string) => {
    const entry = char.logbook?.find(l => l.id === logId);
    if (!entry?.previousState) return;
    update({ ...entry.previousState, logbook: char.logbook.filter(l => l.id !== logId) });
  };

  // ── Spell management ──
  const addSpell = () => {
    const newSpell: Spell = { name: 'New Spell', level: 0, school: 'Evocation', prepared: false, description: '' };
    update({ spells: [...(char.spells || []), newSpell] });
  };
  const updateSpell = (idx: number, changes: Partial<Spell>) => {
    const spells = [...(char.spells || [])];
    spells[idx] = { ...spells[idx], ...changes };
    update({ spells });
  };
  const removeSpell = (idx: number) => {
    update({ spells: (char.spells || []).filter((_, i) => i !== idx) });
  };

  // ── Inventory management ──
  const addItem = () => {
    const newItem: InventoryItem = { id: 'item_' + Date.now(), name: 'New Item', qty: 1, weight: 0, equipped: false, attuned: false, description: '' };
    update({ inventory: [...(char.inventory || []), newItem] });
  };
  const updateItem = (idx: number, changes: Partial<InventoryItem>) => {
    const inventory = [...(char.inventory || [])];
    inventory[idx] = { ...inventory[idx], ...changes };
    update({ inventory });
  };
  const removeItem = (idx: number) => {
    update({ inventory: (char.inventory || []).filter((_, i) => i !== idx) });
  };

  // ── Attack management ──
  const addAttack = () => {
    update({ attacks: [...(char.attacks || []), { name: 'Weapon', bonus: '+0', damage: '1d6', type: 'Slashing' }] });
  };
  const updateAttack = (idx: number, changes: Partial<Attack>) => {
    const attacks = [...(char.attacks || [])];
    attacks[idx] = { ...attacks[idx], ...changes };
    update({ attacks });
  };
  const removeAttack = (idx: number) => {
    update({ attacks: (char.attacks || []).filter((_, i) => i !== idx) });
  };

  // ── Spell slot management ──
  const useSlot = (level: string) => {
    const slots = { ...(char.spellSlots || {}) };
    if (slots[level] && slots[level].used < slots[level].max) {
      slots[level] = { ...slots[level], used: slots[level].used + 1 };
      update({ spellSlots: slots });
    }
  };
  const restoreSlot = (level: string) => {
    const slots = { ...(char.spellSlots || {}) };
    if (slots[level] && slots[level].used > 0) {
      slots[level] = { ...slots[level], used: slots[level].used - 1 };
      update({ spellSlots: slots });
    }
  };

  // ═══════════════════════════════
  //  TAB RENDERERS
  // ═══════════════════════════════

  const renderProfile = () => (
    <div className={styles.profileTab}>
      <div className={styles.profileHeader}>
        <div className={styles.portraitFrame}>
          {char.portrait ? (
            <img src={`data:image/png;base64,${char.portrait}`} alt="Portrait" className={styles.portraitImg} />
          ) : (
            <div className={styles.portraitPlaceholder}>No Portrait</div>
          )}
        </div>
        <div className={styles.profileInfo}>
          <input className={styles.nameInputLarge} value={char.name} onChange={e => update({ name: e.target.value })} placeholder="Character Name" />
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
              <input value={char.alignment || ''} onChange={e => update({ alignment: e.target.value })} placeholder="e.g. Chaotic Good" />
            </div>
            <div className={styles.inlineField}>
              <label>XP</label>
              <input type="number" value={char.xp || 0} onChange={e => update({ xp: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <button className={styles.btnLevelUp} onClick={levelUp}>▲ Level Up to {char.level + 1}</button>
        </div>
      </div>

      <div className={styles.personalityGrid}>
        <div className={styles.personalityBox}>
          <label>Personality Traits</label>
          <textarea value={char.personalityTraits || ''} onChange={e => update({ personalityTraits: e.target.value })} placeholder="I am always polite and respectful..." />
        </div>
        <div className={styles.personalityBox}>
          <label>Ideals</label>
          <textarea value={char.ideals || ''} onChange={e => update({ ideals: e.target.value })} placeholder="Greater good..." />
        </div>
        <div className={styles.personalityBox}>
          <label>Bonds</label>
          <textarea value={char.bonds || ''} onChange={e => update({ bonds: e.target.value })} placeholder="I will protect my family..." />
        </div>
        <div className={styles.personalityBox}>
          <label>Flaws</label>
          <textarea value={char.flaws || ''} onChange={e => update({ flaws: e.target.value })} placeholder="I am slow to trust..." />
        </div>
      </div>
    </div>
  );

  const renderAbilities = () => (
    <div className={styles.abilitiesTab}>
      <h2 className={styles.tabTitle}>Ability Scores</h2>
      <div className={styles.abilityScoresGrid}>
        {Object.entries(char.stats).map(([key, val]) => {
          const mod = calcMod(val);
          const isSave = char.savingThrows?.includes(key);
          return (
            <div key={key} className={styles.abilityCard}>
              <div className={styles.abilityName}>{ABILITY_LABELS[key]}</div>
              <div className={styles.abilityScoreCircle}>
                <input type="number" value={val} onChange={e => updateStat(key, parseInt(e.target.value) || 0)} className={styles.abilityScoreInput} />
              </div>
              <div className={styles.abilityModifier}>{mod >= 0 ? '+' : ''}{mod}</div>
              <div className={styles.savingThrow}>
                <span className={`${styles.profDot} ${isSave ? styles.profActive : ''}`} onClick={() => {
                  const saves = isSave ? char.savingThrows.filter(s => s !== key) : [...char.savingThrows, key];
                  update({ savingThrows: saves });
                }}>●</span>
                <span className={styles.saveLabel}>Save {isSave ? (mod + profBonus >= 0 ? '+' : '') + (mod + profBonus) : (mod >= 0 ? '+' : '') + mod}</span>
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

  const renderSkills = () => (
    <div className={styles.skillsTab}>
      <h2 className={styles.tabTitle}>Skills</h2>
      <p className={styles.tabSubtitle}>Click the dot to toggle proficiency. Modifiers auto-calculate.</p>
      <div className={styles.skillsList}>
        {SKILL_MAP.map(skill => {
          const isProficient = char.skills?.includes(skill.key);
          const abilityMod = calcMod(char.stats[skill.ability as keyof typeof char.stats] || 10);
          const total = abilityMod + (isProficient ? profBonus : 0);
          return (
            <div key={skill.key} className={`${styles.skillRow} ${isProficient ? styles.skillProficient : ''}`}>
              <span className={`${styles.profDot} ${isProficient ? styles.profActive : ''}`} onClick={() => {
                const skills = isProficient ? char.skills.filter(s => s !== skill.key) : [...char.skills, skill.key];
                update({ skills });
              }}>●</span>
              <span className={styles.skillMod}>{total >= 0 ? '+' : ''}{total}</span>
              <span className={styles.skillName}>{skill.name}</span>
              <span className={styles.skillAbility}>{skill.ability.toUpperCase()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderCombat = () => (
    <div className={styles.combatTab}>
      <h2 className={styles.tabTitle}>Combat & Vitals</h2>
      <div className={styles.combatTopRow}>
        <div className={styles.hpSection}>
          <div className={styles.hpLabel}>Hit Points</div>
          <div className={styles.hpDisplay}>
            <input type="number" className={styles.hpInput} value={char.currentHp} onChange={e => update({ currentHp: parseInt(e.target.value) || 0 })} />
            <span className={styles.hpSep}>/</span>
            <input type="number" className={styles.hpInputMax} value={char.maxHp} onChange={e => update({ maxHp: parseInt(e.target.value) || 0 })} />
          </div>
          <div className={styles.hpBar}>
            <div className={styles.hpFill} style={{ width: `${Math.min(100, (char.currentHp / (char.maxHp || 1)) * 100)}%` }} />
          </div>
          <div className={styles.tempHpRow}>
            <label>Temp HP</label>
            <input type="number" value={char.tempHp || 0} onChange={e => update({ tempHp: parseInt(e.target.value) || 0 })} />
          </div>
        </div>

        <div className={styles.combatStatsRow}>
          <div className={styles.combatStatBox}>
            <div className={styles.combatStatValue}>{char.ac}</div>
            <div className={styles.combatStatLabel}>AC</div>
            <input type="number" className={styles.combatStatInput} value={char.ac} onChange={e => update({ ac: parseInt(e.target.value) || 0 })} />
          </div>
          <div className={styles.combatStatBox}>
            <div className={styles.combatStatValue}>+{calcMod(char.stats.dex)}</div>
            <div className={styles.combatStatLabel}>Initiative</div>
          </div>
          <div className={styles.combatStatBox}>
            <div className={styles.combatStatValue}>{char.speed || 30}</div>
            <div className={styles.combatStatLabel}>Speed</div>
            <input type="number" className={styles.combatStatInput} value={char.speed || 30} onChange={e => update({ speed: parseInt(e.target.value) || 30 })} />
          </div>
          <div className={styles.combatStatBox}>
            <div className={styles.combatStatValue}>{char.hitDie || 'd8'}</div>
            <div className={styles.combatStatLabel}>Hit Die</div>
          </div>
        </div>
      </div>

      {/* Death Saves */}
      <div className={styles.deathSavesRow}>
        <div className={styles.deathSaveGroup}>
          <span className={styles.deathLabel}>Death Saves — Successes</span>
          <div className={styles.deathDots}>
            {[0,1,2].map(i => (<span key={i} className={`${styles.deathDot} ${i < (char.deathSaves?.successes || 0) ? styles.deathSuccess : ''}`} onClick={() => update({ deathSaves: { ...char.deathSaves, successes: (char.deathSaves?.successes || 0) === i+1 ? i : i+1 } })} />))}
          </div>
        </div>
        <div className={styles.deathSaveGroup}>
          <span className={styles.deathLabel}>Failures</span>
          <div className={styles.deathDots}>
            {[0,1,2].map(i => (<span key={i} className={`${styles.deathDot} ${i < (char.deathSaves?.failures || 0) ? styles.deathFail : ''}`} onClick={() => update({ deathSaves: { ...char.deathSaves, failures: (char.deathSaves?.failures || 0) === i+1 ? i : i+1 } })} />))}
          </div>
        </div>
        <button className={styles.btnSmall} onClick={() => update({ deathSaves: { successes: 0, failures: 0 } })}>Reset</button>
      </div>

      {/* Rest Buttons */}
      <div className={styles.restRow}>
        <button className={styles.btnAction} onClick={() => update({ currentHp: char.maxHp, deathSaves: { successes: 0, failures: 0 }, spellSlots: Object.fromEntries(Object.entries(char.spellSlots || {}).map(([k, v]) => [k, { ...v, used: 0 }])) })}>🌙 Long Rest</button>
        <button className={styles.btnAction} onClick={() => { /* short rest — just resets death saves */ update({ deathSaves: { successes: 0, failures: 0 } }); }}>☀ Short Rest</button>
      </div>

      {/* Conditions */}
      <div className={styles.conditionsSection}>
        <h3 className={styles.sectionHeading}>Conditions</h3>
        <div className={styles.conditionChips}>
          {CONDITIONS.map(c => (
            <span key={c} className={`${styles.conditionChip} ${char.conditions?.includes(c) ? styles.conditionActive : ''}`}
              onClick={() => {
                const conditions = char.conditions?.includes(c) ? char.conditions.filter(x => x !== c) : [...(char.conditions || []), c];
                update({ conditions });
              }}>{c}</span>
          ))}
        </div>
      </div>

      {/* Attacks */}
      <div className={styles.attacksSection}>
        <h3 className={styles.sectionHeading}>Attacks & Actions <button className={styles.btnAdd} onClick={addAttack}>+</button></h3>
        {(char.attacks || []).map((atk, i) => (
          <div key={i} className={styles.attackRow}>
            <input className={styles.attackInput} value={atk.name} onChange={e => updateAttack(i, { name: e.target.value })} placeholder="Name" />
            <input className={styles.attackInputSm} value={atk.bonus} onChange={e => updateAttack(i, { bonus: e.target.value })} placeholder="+5" />
            <input className={styles.attackInputSm} value={atk.damage} onChange={e => updateAttack(i, { damage: e.target.value })} placeholder="1d8+3" />
            <input className={styles.attackInputSm} value={atk.type} onChange={e => updateAttack(i, { type: e.target.value })} placeholder="Slashing" />
            <button className={styles.btnRemove} onClick={() => removeAttack(i)}>×</button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSpells = () => {
    const spellAbility = char.spellcastingAbility || 'int';
    const spellMod = calcMod(char.stats[spellAbility as keyof typeof char.stats] || 10);
    const spellDC = 8 + profBonus + spellMod;
    const spellAttack = profBonus + spellMod;

    return (
      <div className={styles.spellsTab}>
        <h2 className={styles.tabTitle}>Spellcasting</h2>
        {!char.spellcaster && <p className={styles.tabSubtitle} style={{ color: '#666' }}>This character is not a spellcaster. You can still add spells manually.</p>}

        <div className={styles.spellHeader}>
          <div className={styles.spellStat}>
            <div className={styles.spellStatLabel}>Ability</div>
            <div className={styles.spellStatValue}>{ABILITY_LABELS[spellAbility] || spellAbility.toUpperCase()}</div>
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

        {/* Spell Slots */}
        <div className={styles.spellSlotsGrid}>
          {[1,2,3,4,5,6,7,8,9].map(lvl => {
            const key = `${lvl}`;
            const slot = char.spellSlots?.[key] || { max: 0, used: 0 };
            if (slot.max === 0 && char.level < lvl * 2) return null;
            return (
              <div key={lvl} className={styles.slotBox}>
                <div className={styles.slotLevel}>Level {lvl}</div>
                <div className={styles.slotDots}>
                  {Array.from({ length: slot.max || 0 }).map((_, i) => (
                    <span key={i} className={`${styles.slotDot} ${i < slot.used ? styles.slotUsed : ''}`} />
                  ))}
                </div>
                <div className={styles.slotActions}>
                  <button onClick={() => useSlot(key)} disabled={slot.used >= slot.max}>Use</button>
                  <button onClick={() => restoreSlot(key)} disabled={slot.used <= 0}>+</button>
                  <input type="number" value={slot.max} min={0} max={9} style={{ width: '36px' }}
                    onChange={e => {
                      const slots = { ...(char.spellSlots || {}) };
                      slots[key] = { max: parseInt(e.target.value) || 0, used: Math.min(slot.used, parseInt(e.target.value) || 0) };
                      update({ spellSlots: slots });
                    }} />
                </div>
              </div>
            );
          })}
        </div>

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
  };

  const renderInventory = () => {
    const totalWeight = (char.inventory || []).reduce((sum, item) => sum + item.qty * item.weight, 0);
    const carryCapacity = char.stats.str * 15;
    const attunedCount = (char.inventory || []).filter(i => i.attuned).length;

    return (
      <div className={styles.inventoryTab}>
        <h2 className={styles.tabTitle}>Inventory & Equipment</h2>

        <div className={styles.inventoryHeader}>
          <div className={styles.currencyRow}>
            <div className={styles.currencyBox}><label>GP</label><input type="number" value={char.gold || 0} onChange={e => update({ gold: parseInt(e.target.value) || 0 })} /></div>
            <div className={styles.currencyBox}><label>SP</label><input type="number" value={char.silver || 0} onChange={e => update({ silver: parseInt(e.target.value) || 0 })} /></div>
            <div className={styles.currencyBox}><label>CP</label><input type="number" value={char.copper || 0} onChange={e => update({ copper: parseInt(e.target.value) || 0 })} /></div>
          </div>
          <div className={styles.weightRow}>
            <span>{totalWeight.toFixed(1)} / {carryCapacity} lbs</span>
            <span className={styles.attunement}>Attunement: {attunedCount}/3</span>
          </div>
          <div className={styles.weightBar}>
            <div className={styles.weightFill} style={{ width: `${Math.min(100, (totalWeight / carryCapacity) * 100)}%`, background: totalWeight > carryCapacity ? '#c44' : undefined }} />
          </div>
        </div>

        <h3 className={styles.sectionHeading}>Items <button className={styles.btnAdd} onClick={addItem}>+ Add</button></h3>
        {(char.inventory || []).length === 0 && <p className={styles.emptyText}>Your pack is empty. Click + Add to equip.</p>}
        {(char.inventory || []).map((item, i) => (
          <div key={item.id} className={`${styles.itemRow} ${item.equipped ? styles.itemEquipped : ''}`}>
            <input className={styles.itemName} value={item.name} onChange={e => updateItem(i, { name: e.target.value })} />
            <input className={styles.itemQty} type="number" value={item.qty} onChange={e => updateItem(i, { qty: parseInt(e.target.value) || 0 })} title="Qty" />
            <input className={styles.itemWeight} type="number" step="0.1" value={item.weight} onChange={e => updateItem(i, { weight: parseFloat(e.target.value) || 0 })} title="Weight" />
            <button className={`${styles.itemToggle} ${item.equipped ? styles.toggleActive : ''}`} onClick={() => updateItem(i, { equipped: !item.equipped })} title="Equipped">⚔</button>
            <button className={`${styles.itemToggle} ${item.attuned ? styles.toggleAttuned : ''}`} onClick={() => {
              if (!item.attuned && attunedCount >= 3) return;
              updateItem(i, { attuned: !item.attuned });
            }} title="Attuned">✦</button>
            <button className={styles.btnRemove} onClick={() => removeItem(i)}>×</button>
          </div>
        ))}
      </div>
    );
  };

  const renderFeatures = () => (
    <div className={styles.featuresTab}>
      <h2 className={styles.tabTitle}>Features & Traits</h2>

      {(char.traits || []).length > 0 && (
        <div className={styles.featureSection}>
          <h3 className={styles.sectionHeading}>Racial Traits</h3>
          <ul className={styles.featureList}>
            {char.traits.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}

      {(char.features || []).length > 0 && (
        <div className={styles.featureSection}>
          <h3 className={styles.sectionHeading}>Class Features</h3>
          {char.features.map((f, i) => (
            <div key={i} className={styles.featureCard}>
              <div className={styles.featureCardHeader}>
                <span className={styles.featureLevel}>Lv.{f.level}</span>
                <span className={styles.featureName}>{f.name}</span>
              </div>
              <p className={styles.featureDesc}>{f.description}</p>
            </div>
          ))}
        </div>
      )}

      <div className={styles.featureSection}>
        <h3 className={styles.sectionHeading}>Proficiencies</h3>
        <div className={styles.profList}>
          {(char.armorProficiencies || []).length > 0 && <div><strong>Armor:</strong> {char.armorProficiencies.join(', ')}</div>}
          {(char.weaponProficiencies || []).length > 0 && <div><strong>Weapons:</strong> {char.weaponProficiencies.join(', ')}</div>}
          {(char.languages || []).length > 0 && <div><strong>Languages:</strong> {char.languages.join(', ')}</div>}
        </div>
      </div>

      {(char.equipment || []).length > 0 && (
        <div className={styles.featureSection}>
          <h3 className={styles.sectionHeading}>Starting Equipment</h3>
          <ul className={styles.featureList}>
            {char.equipment.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}
    </div>
  );

  const renderLogbook = () => (
    <div className={styles.logbookTab}>
      <h2 className={styles.tabTitle}>Adventurer&apos;s Logbook</h2>

      <div className={styles.notesSection}>
        <h3 className={styles.sectionHeading}>Session Notes</h3>
        <textarea className={styles.notesTextarea} value={char.notes || ''} onChange={e => update({ notes: e.target.value })} placeholder="Write about your adventures, campaign events, key NPCs..." />
      </div>

      <h3 className={styles.sectionHeading}>History</h3>
      {(!char.logbook || char.logbook.length === 0) ? (
        <p className={styles.emptyText}>No events recorded yet.</p>
      ) : (
        <div className={styles.logTimeline}>
          {char.logbook.map(log => (
            <div key={log.id} className={styles.logEntry}>
              <div className={styles.logDot} />
              <div className={styles.logContent}>
                <div className={styles.logTime}>{new Date(log.timestamp).toLocaleString()}</div>
                <div className={styles.logDesc}>{log.description}</div>
                {log.type === 'level_up' && <button className={styles.btnUndo} onClick={() => undoLog(log.id)}>↶ Undo</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const tabRenderers: Record<TabKey, () => JSX.Element> = {
    profile: renderProfile, abilities: renderAbilities, skills: renderSkills,
    combat: renderCombat, spells: renderSpells, inventory: renderInventory,
    features: renderFeatures, logbook: renderLogbook,
  };

  return (
    <div className={styles.sheetContainer}>
      {/* Sidebar */}
      <div className={styles.sidebar}>
        <Link href="/dungeon-buddy" className={styles.sidebarBack}>←</Link>
        {TABS.map(tab => (
          <button key={tab.key} className={`${styles.sidebarTab} ${activeTab === tab.key ? styles.sidebarActive : ''}`} onClick={() => setActiveTab(tab.key)} title={tab.label}>
            <span className={styles.sidebarIcon}>{tab.icon}</span>
            <span className={styles.sidebarLabel}>{tab.label}</span>
          </button>
        ))}
        <div className={styles.sidebarSave}>{saveStatus}</div>
      </div>

      {/* Main */}
      <div className={styles.mainPanel}>
        {tabRenderers[activeTab]()}
      </div>
    </div>
  );
}
