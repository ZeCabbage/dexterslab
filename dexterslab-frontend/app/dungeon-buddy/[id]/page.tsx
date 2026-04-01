'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import styles from './page.module.css';

import { useCharacterStore } from '../lib/store';
import { LiveCharacter } from '../lib/types';

// Components
import StickyVitalsHeader from '../components/StickyVitalsHeader';
import ProfileTab from '../tabs/ProfileTab';
import AbilitiesTab from '../tabs/AbilitiesTab';
import SkillsTab from '../tabs/SkillsTab';
import CombatTab from '../tabs/CombatTab';
import SpellsTab from '../tabs/SpellsTab';
import InventoryTab from '../tabs/InventoryTab';
import FeaturesTab from '../tabs/FeaturesTab';
import LogbookTab from '../tabs/LogbookTab';

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

export default function CharacterSheet() {
  const params = useParams();
  const charId = params.id as string;
  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  
  const { char, setChar, saveStatus, setSaveStatus } = useCharacterStore();
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  // ── Fetch Initial Data ──
  useEffect(() => {
    const fetchCharacter = async () => {
      const res = await fetch(`/api/dungeon-buddy/characters/${charId}`);
      if (res.ok) {
        const data = await res.json();
        // V1 -> V2 Migration defaults
        const defaults: Partial<LiveCharacter> = {
          stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
          xp: 0, tempHp: 0, speed: 30,
          currentHp: data.maxHp || 10,
          maxHp: data.maxHp || 10,
          hitDie: 'd8', hitDiceTotal: data.level || 1, hitDiceUsed: 0,
          savingThrows: [], skills: [], expertise: [], attacks: [],
          resources: {}, cantrips: [], knownSpells: [], preparedSpells: [],
          inventory: [], gold: 0, silver: 0, copper: 0,
          equipped: { head: null, chest: null, cloak: null, mainHand: null, offHand: null, gloves: null, ring1: null, ring2: null, boots: null, amulet: null },
          traits: [], features: [], languages: [],
          armorProficiencies: [], weaponProficiencies: [],
          portrait: null, personalityTraits: '', ideals: '', bonds: '', flaws: '', notes: '',
          quests: '', people: '', places: '',
          deathSaves: { successes: 0, failures: 0 },
          conditions: [], logbook: [],
          alignment: '', background: '', 
          spellcaster: false, spellcastingAbility: null,
        };
        setChar({ ...defaults, ...data } as LiveCharacter);
      }
    };
    fetchCharacter();
  }, [charId, setChar]);

  // ── Auto-Save Side Effect ──
  // We use stringify to deep compare since char is an object, but a ref tracking the initial load helps avoid saving on mount
  const hasInitialized = useRef(false);
  
  useEffect(() => {
    if (!char) return;
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      return;
    }

    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus('saving');
    
    saveTimer.current = setTimeout(async () => {
      await fetch(`/api/dungeon-buddy/characters/${charId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(char),
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);

  }, [char, charId, setSaveStatus]);

  if (!char) return <div className={styles.loadingScreen}>Loading Chronicle...</div>;

  const tabRenderers: Record<TabKey, () => React.ReactNode> = {
    profile: () => <ProfileTab />,
    abilities: () => <AbilitiesTab />,
    skills: () => <SkillsTab />,
    combat: () => <CombatTab />,
    spells: () => <SpellsTab />,
    inventory: () => <InventoryTab />,
    features: () => <FeaturesTab />,
    logbook: () => <LogbookTab />,
  };

  return (
    <div className={styles.sheetContainer}>
      {/* Sidebar Navigation */}
      <div className={styles.sidebar}>
        <Link href="/dungeon-buddy" className={styles.sidebarBack}>←</Link>
        {TABS.map(tab => (
          <button 
            key={tab.key} 
            className={`${styles.sidebarTab} ${activeTab === tab.key ? styles.sidebarActive : ''}`} 
            onClick={() => setActiveTab(tab.key)} 
            title={tab.label}
          >
            <span className={styles.sidebarIcon}>{tab.icon}</span>
            <span className={styles.sidebarLabel}>{tab.label}</span>
          </button>
        ))}
        <div className={styles.sidebarSave}>
          {saveStatus === 'saving' ? '•' : saveStatus === 'saved' ? 'Saved ✓' : ''}
        </div>
      </div>

      {/* Main Panel */}
      <div className={styles.mainPanel} style={{ padding: 0 }}>
        {/* Vitals Header */}
        <StickyVitalsHeader />
        
        {/* Tab Content */}
        <div className={styles.tabContentArea}>
          {tabRenderers[activeTab]()}
        </div>
      </div>
    </div>
  );
}
