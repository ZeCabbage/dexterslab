# Dungeon Buddy — Technical Design Document

**Version:** 2.0  
**Last Updated:** April 2026  
**Project:** DextersLab Ecosystem — `dexterslab-frontend` + `dexterslab-backend`  
**Route:** `/dungeon-buddy`

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Data Storage & Persistence](#3-data-storage--persistence)
4. [Character Data Model](#4-character-data-model)
5. [Character Creation System](#5-character-creation-system)
6. [The Modifier Effect System](#6-the-modifier-effect-system)
7. [Subclass Feature Engine](#7-subclass-feature-engine)
8. [Level-Up System](#8-level-up-system)
9. [Resource Scaling Engine](#9-resource-scaling-engine)
10. [Combat Tab & Dungeon Cards](#10-combat-tab--dungeon-cards)
11. [Spell System](#11-spell-system)
12. [Rest System](#12-rest-system)
13. [Character Sheet Tabs](#13-character-sheet-tabs)
14. [AI Integration (The Oracle)](#14-ai-integration-the-oracle)
15. [Session Scribe](#15-session-scribe)
16. [Auto-Save System](#16-auto-save-system)
17. [File Reference Map](#17-file-reference-map)

---

## 1. Architecture Overview

Dungeon Buddy is a full-stack web application built as a sub-project within the DextersLab ecosystem. It follows a **three-tier architecture**:

```
┌────────────────────────────────────┐
│         Next.js Frontend           │
│   (React, TypeScript, Zustand)     │
│   localhost:7777/dungeon-buddy     │
├────────────────────────────────────┤
│         Next.js API Routes         │
│   (Proxy layer to backend)         │
│   /api/dungeon-buddy/*             │
├────────────────────────────────────┤
│         Express.js Backend         │
│   (Node.js, File-based JSON)       │
│   localhost:8888                    │
├────────────────────────────────────┤
│      Google Gemini AI (Cloud)      │
│   (Character Forge + Scribe)       │
│   gemini-2.5-flash + imagen-4.0    │
└────────────────────────────────────┘
```

**Data Flow:** The frontend communicates with the backend through Next.js API route proxies. The frontend stores live character state in a Zustand store, which auto-saves to the backend via debounced PUT requests. AI features (character generation, portrait creation, session summarization) route through the backend's Gemini API integration.

---

## 2. Technology Stack

### Frontend
| Technology | Purpose |
|---|---|
| **Next.js 15** (App Router) | React framework, file-based routing, SSR |
| **TypeScript** | Type-safe character models, modifier unions |
| **Zustand** | Client-side state management (single store) |
| **CSS Modules** | Scoped, per-page styling (`.module.css`) |
| **React Portals** | Level-up wizard rendered as overlay modal |

### Backend
| Technology | Purpose |
|---|---|
| **Express.js** | REST API server |
| **Node.js (ESM)** | Runtime environment |
| **JSON file storage** | Character and session persistence |
| **Google Gemini SDK** | AI character generation, spell forging, session summary |
| **Imagen 4.0** | Character portrait generation |

### Design System
- **Font:** Cinzel (serif, fantasy aesthetic) for headings; system default for body
- **Color palette:** Dark parchment backgrounds (`#0d0b08`), gold accents (`#cfaa5e`), ice blue (`#6ba3c7`)
- **UI pattern:** Sidebar navigation with tab-based character sheet, card-based combat deck

---

## 3. Data Storage & Persistence

### Backend Storage
Characters are stored as a flat JSON array in:
```
dexterslab-backend/data/dungeon-buddy-characters.json
```

Session records (from the Scribe) are stored in:
```
dexterslab-backend/data/dungeon-buddy-sessions.json
```

### API Endpoints

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/dungeon-buddy/characters` | List all characters (summary: id, name, class, level, hp, portrait) |
| `GET` | `/api/dungeon-buddy/characters/:id` | Get full character document |
| `POST` | `/api/dungeon-buddy/characters` | Create new character |
| `PUT` | `/api/dungeon-buddy/characters/:id` | Update (auto-save) full character |
| `DELETE` | `/api/dungeon-buddy/characters/:id` | Permanently delete character |
| `POST` | `/api/dungeon-buddy/generate-portrait` | Generate AI portrait via Imagen 4.0 |
| `POST` | `/api/dungeon-buddy/oracle/forge-character` | AI character generation (text or chaos) |
| `POST` | `/api/dungeon-buddy/oracle/forge-subclass` | AI homebrew subclass generation |
| `POST` | `/api/dungeon-buddy/oracle/forge-subclass-features` | AI canonical subclass feature lookup |
| `GET` | `/api/dungeon-buddy/sessions` | List recorded sessions |
| `POST` | `/api/dungeon-buddy/scribe/summarize` | AI session transcript summarization |

### Frontend State Management
The entire active character is held in a **Zustand store** (`useCharacterStore`). The store provides:
- **Direct field updates:** `updateField(field, value)` and `updateNestedField(parent, child, value)`
- **Specialized actions:** `updateHP()`, `expendResource()`, `restoreResource()`, `learnSpell()`, `equipItem()`, etc.
- **Level-up processing:** `completeLevelUp(payload)` — the core modifier processing engine
- **Rest actions:** `shortRest(hitDiceRoll)`, `longRest()`
- **Modifier toggles:** `activateOneShot()`, `resetModifiers()`

---

## 4. Character Data Model

The master character type is `LiveCharacter` (defined in `lib/types.ts`). Key fields:

### Identity
| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique ID (e.g., `char_1712345678_123`) |
| `name` | `string` | Character name |
| `race` | `string` | Display race (e.g., "Elf (High Elf)") |
| `class` | `string` | Primary class name |
| `classes` | `Record<string, number>` | Multiclass map (e.g., `{ Fighter: 3, Wizard: 2 }`) |
| `subclass` | `string \| null` | Primary subclass |
| `subclasses` | `Record<string, string>` | Per-class subclass map |
| `subclassChoices` | `Record<string, any>` | Totem animal, Draconic Ancestry, Land Type, etc. |
| `background` | `string` | Background name |
| `level` | `number` | Total character level |

### Combat Stats
| Field | Type | Description |
|---|---|---|
| `maxHp` / `currentHp` / `tempHp` | `number` | Hit point tracking |
| `hitDie` | `string` | Hit die type (e.g., `"d10"`) |
| `hitDiceTotal` / `hitDiceUsed` | `number` | Hit die pool for rests |
| `stats` | `{ str, dex, con, int, wis, cha }` | Ability scores |
| `ac` | `number` | Base armor class |
| `speed` | `number` | Movement speed in feet |
| `savingThrows` | `string[]` | Proficient save types |
| `deathSaves` | `{ successes, failures }` | Death save tracking |
| `conditions` | `string[]` | Active conditions |
| `extraAttacks` | `number` | Extra Attack count (1 = 2 total) |
| `critRange` | `number` | Minimum crit roll (default 20, Champion 19) |

### Spellcasting
| Field | Type | Description |
|---|---|---|
| `spellcaster` | `boolean` | Whether this character casts spells |
| `spellcastingAbility` | `string \| null` | Primary casting stat |
| `cantrips` | `string[]` | Known cantrip IDs |
| `knownSpells` | `string[]` | All learned spell IDs |
| `preparedSpells` | `string[]` | Currently prepared spell IDs |
| `customSpells` | `SpellData[]` | Oracle-forged homebrew spells (full objects) |

### Equipment & Inventory
| Field | Type | Description |
|---|---|---|
| `inventory` | `InventoryItem[]` | Backpack items |
| `equipped` | `Record<EquipSlot, InventoryItem \| null>` | Paper-doll equipment slots |
| `gold` / `silver` / `copper` | `number` | Currency |

Equipment slots: `head`, `chest`, `cloak`, `mainHand`, `offHand`, `gloves`, `boots`, `ring1`, `ring2`, `amulet`.

### Resources
| Field | Type | Description |
|---|---|---|
| `resources` | `Record<string, TrackedResource>` | All trackable resources |

Each `TrackedResource` has:
```typescript
{
  name: string;       // Display name
  max: number;        // Maximum uses
  used: number;       // Currently spent count
  recharge: 'short' | 'long' | 'none';
  actionCost?: ActionCost;  // action, bonus_action, reaction, special, none
  description?: string;
  die?: string;       // For dice resources (e.g., "d8")
}
```

Resource IDs follow patterns:
- Spell slots: `spell_slot_1`, `spell_slot_2`, etc.
- Class resources: `rage`, `ki_points`, `sorcery_points`, `channel_divinity`, `action_surge`, `wild_shape`, `lay_on_hands`, `bardic_inspiration`, `second_wind`, `superiority_dice`, `indomitable`
- Subclass resources: `frenzy`, `intimidating_presence`, `retaliation`, etc.

### Subclass Modifier Engine
| Field | Type | Description |
|---|---|---|
| `activeModifiers` | `ActiveModifierState[]` | One-shot togglable modifiers (Metamagic, Maneuvers) |
| `companions` | `Companion[]` | Persistent companions (Beast Master, etc.) |
| `wildShapeForm` | `WildShapeForm \| null` | Active Wild Shape form |
| `features` | `FeatureData[]` | All class + subclass features with modifiers |

---

## 5. Character Creation System

**Route:** `/dungeon-buddy/create`  
**File:** `create/page.tsx` (~1250 lines)

### Wizard Steps
The creation wizard has 9 sequential steps:

| Step | Key | What Happens |
|---|---|---|
| 0 | **Race** | Race + subrace picker. Also houses The Character Oracle. |
| 1 | **Class** | Class picker. For classes with `subclassLevel === 1` (Cleric), shows inline subclass selection. |
| 2 | **Spells** | For spellcasters: opens SpellBrowser in draft mode. Non-casters skip. |
| 3 | **Abilities** | Point Buy (27 points), Standard Array, or Manual entry. Has "Randomize 🎲" button. |
| 4 | **Background** | Background picker (skill proficiencies auto-locked). |
| 5 | **Skills** | Class-specific skill selection (limited to class list, quantity enforced). |
| 6 | **Equipment** | Gear selection using `starting-equipment.ts` database with ITEM_DATABASE tooltips. |
| 7 | **Portrait** | AI portrait generation via Imagen 4.0 (optional). |
| 8 | **Finalize** | Name entry + full summary with inline ✎ Edit buttons for each section. |

### Oracle Generation
When the Oracle (text prompt or "Pure Chaos" random) is invoked:
1. Frontend sends race/class/background constraints to backend
2. Backend prompts Gemini 2.5 Flash with structured JSON output schema
3. Response maps to frontend state: auto-sets race, class, background, scores, skills, custom spells, custom equipment
4. Auto-calls portrait generation
5. Jumps to Finalize step (`setStep(8)`) with `oracleGenerated = true`
6. Shows "Oracle-Forged Character" banner with edit guidance
7. All step bar items become fully clickable for review/editing

### On Creation Complete
The `handleCreate()` function:
1. Computes starting HP: `hitDie + CON mod`
2. Merges background skills + chosen skills
3. Maps equipment choices from `ITEM_DATABASE`
4. Creates initial spell slot resources from class spell table
5. Sets up subclass if chosen at level 1 (Cleric)
6. POSTs full character JSON to backend, receives ID, navigates to `/dungeon-buddy/:id`

---

## 6. The Modifier Effect System

**File:** `lib/types.ts` — `ModifierEffect` discriminated union

This is the core mechanical abstraction. Every subclass feature can carry an array of `modifiers[]` that describe their mechanical impact. The union type covers **22+ modifier types** grouped into categories:

### Damage Modifiers
| Type | Effect |
|---|---|
| `add_damage_ability` | Add ability modifier to spell damage |
| `add_flat_damage` | Add flat damage bonus |
| `add_conditional_damage` | Add dice damage with condition |
| `add_range` | Extend range |

### Spell/Casting Modifiers
| Type | Effect |
|---|---|
| `grant_spells_always_prepared` | Auto-prepare domain/oath spells |
| `expanded_spell_list` | Add class-accessible spell lists |
| `grant_cantrip` | Add a cantrip (doesn't count against limit) |
| `grant_third_caster` | Enable spellcasting for third-caster subclasses |

### Proficiency Modifiers
| Type | Effect |
|---|---|
| `grant_proficiency` | Add armor/weapon/save/tool proficiency |
| `grant_skill` | Add skill proficiency |
| `grant_expertise` | Double proficiency bonus for a skill |

### Resource Modifiers
| Type | Effect |
|---|---|
| `add_resource` | Create a new tracked resource (e.g., Frenzy, Channel Divinity) |
| `scale_resource` | Scale resource max by formula (`prof_bonus`, `class_level`, `wis_mod`, etc.) |
| `upgrade_resource_die` | Upgrade resource die type (e.g., d8 → d10) |

### Defense/Stat Modifiers
| Type | Effect |
|---|---|
| `modify_ac` | Override AC formula (e.g., "13+dex" for Draconic Resilience) |
| `grant_resistance` | Grant damage resistance |
| `grant_immunity` | Grant condition immunity |
| `grant_extra_hp` | +1 HP per level (e.g., Draconic Resilience) |
| `grant_speed` | Bonus movement speed |
| `grant_darkvision` | Grant or extend darkvision |

### Combat Modifiers
| Type | Effect |
|---|---|
| `grant_extra_attack` | Set Extra Attack count |
| `expand_crit_range` | Lower crit threshold (19 for Improved Critical) |
| `fighting_style` | Grant a fighting style |

### Choice-Based Modifiers
| Type | Effect |
|---|---|
| `metamagic_option` | Sorcerer Metamagic pick → one-shot toggle |
| `maneuver_option` | Battle Master Maneuver pick → one-shot toggle |

### Passive / Narrative
| Type | Effect |
|---|---|
| `passive` | Display-only, no mechanical automation |

---

## 7. Subclass Feature Engine

### Data Layer

**Root file:** `data/subclass-features.ts`  
**Per-class files:** `data/subclass-features-{bard,cleric,druid,fighter,monk,paladin,ranger,rogue,sorcerer,warlock,wizard}.ts`

Each subclass is defined as a `SubclassFeatureSet`:
```typescript
interface SubclassFeatureSet {
  id: string;           // e.g., "path_of_the_berserker"
  name: string;         // e.g., "Path of the Berserker"
  className: string;    // e.g., "Barbarian"
  description: string;  // Flavor text
  features: FeatureData[];  // Features from L1-L20 with modifiers
}
```

Each `FeatureData` entry:
```typescript
interface FeatureData {
  name: string;
  description: string;
  level: number;          // Level this feature is gained
  source?: string;        // Subclass name
  modifiers?: ModifierEffect[];  // Mechanical effects
  choiceType?: string;    // metamagic, maneuver, totem, etc.
  choiceCount?: number;   // How many options to pick
}
```

### Coverage
All 12 base classes with a total of **115 canonical subclasses** have data entries with features through level 20. Key subclasses include:

| Class | Subclasses Covered |
|---|---|
| **Barbarian** | Berserker, Totem Warrior, Zealot, Ancestral Guardian, Storm Herald, Beast, Wild Magic |
| **Bard** | Lore, Valor, Glamour, Swords, Whispers, Creation, Eloquence, Spirits |
| **Cleric** | Knowledge, Life, Light, Nature, Tempest, Trickery, War, Death, Forge, Grave, Order, Peace, Twilight |
| **Druid** | Land, Moon, Dreams, Shepherd, Spores, Stars, Wildfire |
| **Fighter** | Champion, Battle Master, Eldritch Knight, Arcane Archer, Cavalier, Samurai, Psi Warrior, Rune Knight, Echo Knight |
| **Monk** | Open Hand, Shadow, Four Elements, Kensei, Drunken Master, Sun Soul, Mercy, Astral Self, Ascendant Dragon |
| **Paladin** | Devotion, Ancients, Vengeance, Crown, Conquest, Redemption, Watchers, Glory, Oathbreaker |
| **Ranger** | Hunter, Beast Master, Gloom Stalker, Horizon Walker, Monster Slayer, Fey Wanderer, Swarmkeeper, Drakewarden |
| **Rogue** | Thief, Assassin, Arcane Trickster, Mastermind, Swashbuckler, Inquisitive, Scout, Phantom, Soulknife |
| **Sorcerer** | Draconic Bloodline, Wild Magic |
| **Warlock** | Archfey, Fiend, Great Old One, Celestial, Hexblade, Fathomless, Genie, Undead |
| **Wizard** | Abjuration, Conjuration, Divination, Enchantment, Evocation, Illusion, Necromancy, Transmutation, War Magic, Bladesinging, Chronurgy, Graviturgy, Order of Scribes |

### Lookup Functions
```typescript
getSubclassFeatures(className, subclassName)       // → SubclassFeatureSet | null
getSubclassFeaturesAtLevel(className, subclassName, level)  // → FeatureData[]
getSubclassFeaturesUpToLevel(className, subclassName, level) // → FeatureData[]
```

### Resolve Modifiers Engine

**File:** `lib/resolve-modifiers.ts`

The `resolveModifiers(char: LiveCharacter)` function walks ALL `char.features[]` and computes a `ResolvedModifiers` object that the UI reads reactively:

```typescript
interface ResolvedModifiers {
  bonusDamage: Record<string, DamageBonus[]>;
  bonusAC: number;
  acFormula: string | null;
  bonusHP: number;
  bonusSpeed: number;
  grantedResistances: string[];
  grantedImmunities: string[];
  darkvisionRange: number;
  grantedArmorProficiencies: string[];
  grantedWeaponProficiencies: string[];
  grantedSkills: string[];
  grantedExpertise: string[];
  grantedSaveProficiencies: string[];
  grantedToolProficiencies: string[];
  alwaysPreparedSpells: string[];
  expandedSpellList: string[];
  grantedCantrips: string[];
  extraAttacks: number;
  critRange: number;
  fightingStyles: FightingStyle[];
  metamagicOptions: MetamagicOption[];
  maneuverOptions: ManeuverOption[];
  featureResources: Record<string, TrackedResource>;
  isThirdCaster: boolean;
  wildShapeEnhancements: Enhancement[];
  companionTemplates: string[];
}
```

This is computed via `useMemo()` in the CombatTab and FeaturesTab, so it recalculates automatically when features change.

---

## 8. Level-Up System

### Level-Up Modal
**File:** `components/LevelUpModal.tsx` (39KB)  
The entry-point modal that opens from the character sheet header.

### Level-Up Wizard  
**File:** `components/LevelUpWizard.tsx` (47KB)  
A multi-step wizard rendered as a full-screen portal overlay.

### Wizard Steps

| Step | Content |
|---|---|
| **HP Roll** | Roll or take average for new hit die. Shows `hitDie + CON mod`. |
| **Multiclass Pick** | If not first level-up, choose which class to advance. |
| **Subclass** | If reaching `subclassLevel` for the chosen class, pick a subclass from the canonical list OR use Oracle to forge a homebrew one. |
| **Subclass Choices** | Dynamic step that appears when features at this level have `choiceType`. 6 supported types: |
|  | • **Metamagic** (Sorcerer): Multi-select grid with SP costs |
|  | • **Maneuvers** (Battle Master): Multi-select with descriptions |
|  | • **Totem** (Totem Warrior): Radio picker (Bear/Eagle/Elk/Tiger/Wolf) |
|  | • **Fighting Style**: Class-filtered radio grid |
|  | • **Draconic Ancestry**: Dragon type picker |
|  | • **Land Type**: Terrain picker for Circle of the Land |
| **ASI / Feat** | At ASI levels (4, 8, 12, 16, 19 default; Fighter/Rogue have extras). Choose +2/+2 ASI split or a feat from `feats.ts`. |
| **Spells** | SpellBrowser opens in-place for learning new spells at this level. |
| **Summary** | Review all changes before applying. |

### The `completeLevelUp(payload)` Engine

This is the **core function** in `store.ts` that processes a level-up. It runs through these phases:

#### Phase 1: Core Stats
```
- Increment total level
- Track multiclass levels in char.classes{}
- Add HP increase
- Increment hit dice total
- Set subclass choice if applicable
- Store subclass-specific choices (totem, ancestry, etc.)
- Process ASI / Feat selection
- Append new features to char.features[]
```

#### Phase 2: Modifier Processing Engine
Walks every `feature.modifiers[]` from `payload.addedFeatures` and applies mutations:

| Case | Mutation |
|---|---|
| `add_resource` | Creates `char.resources[resourceId]` with name, max, recharge, actionCost |
| `scale_resource` | Resolves formula (`prof_bonus`, `class_level`, `wis_mod`, etc.) and updates max |
| `upgrade_resource_die` | Updates resource die type |
| `grant_proficiency` | Adds to armor or weapon proficiency arrays |
| `grant_spells_always_prepared` | Adds to both `knownSpells` and `preparedSpells` |
| `grant_cantrip` | Adds to `cantrips` array |
| `grant_skill` | Adds to `skills` array (if not `__choice__`) |
| `grant_extra_hp` | +1 maxHP and currentHP |
| `grant_extra_attack` | Sets `extraAttacks` to max across sources |
| `expand_crit_range` | Sets `critRange` to minimum across sources |
| `grant_third_caster` | Enables spellcasting + injects third-caster spell slots |
| `metamagic_option` | Pushes to `activeModifiers[]` with long rest recharge |
| `maneuver_option` | Pushes to `activeModifiers[]` with short rest recharge |

#### Phase 3: Resource Scaling Pass
After processing modifiers, the system checks **scaling tables** for the class and auto-creates/updates resources:

```typescript
const scalableResources = [
  'rage', 'ki_points', 'sorcery_points', 'channel_divinity',
  'action_surge', 'superiority_dice', 'indomitable', 'wild_shape',
  'lay_on_hands', 'bardic_inspiration', 'second_wind'
];
```

For each resource:
1. Look up `getResourceScaling(className, resourceId, classLevel)`
2. If the scaling table returns a value AND the resource already exists → **update max**
3. If the scaling table returns a value BUT the resource doesn't exist → **auto-create it** using the `RESOURCE_META` metadata map (name, recharge type, action cost, description)

This auto-creation mechanism ensures core class abilities (Rage, Ki, etc.) always appear even if they weren't created during initial character creation.

#### Phase 4: Spell Slot Override
If the payload includes `overrideSpellSlots`, all spell slot resources are replaced (used for BG3-style multiclass slot merging).

#### Phase 5: Logging
A log entry is created recording the level-up details.

---

## 9. Resource Scaling Engine

**File:** `data/resource-scaling.ts` (~24KB)

Contains lookup tables mapping `(class, resourceId, classLevel)` → `{ max, die? }`.

### Scaling Tables

| Resource | Classes | Scaling Pattern |
|---|---|---|
| **Rage** | Barbarian | 2→2→3→3→3→4→4→4→4→4→4→5→5→5→5→5→6→6→6→∞ |
| **Rage Damage** | Barbarian | +2 (L1-8), +3 (L9-15), +4 (L16-20) |
| **Bardic Inspiration Die** | Bard | d6→d8(L5)→d10(L10)→d12(L15) |
| **Channel Divinity** | Cleric, Paladin | 1(L2)→2(L6)→3(L18) |
| **Wild Shape** | Druid | 2 uses (L2-19), unlimited(L20), with CR scaling |
| **Ki Points** | Monk | Equal to monk level |
| **Sorcery Points** | Sorcerer | Equal to sorcerer level |
| **Superiority Dice** | Fighter (BM) | 4(L3)→5(L7)→6(L15), die d8→d10(L10)→d12(L18) |
| **Action Surge** | Fighter | 1(L2)→2(L17) |
| **Indomitable** | Fighter | 1(L9)→2(L13)→3(L17) |
| **Second Wind** | Fighter | Always 1 |
| **Lay on Hands** | Paladin | paladin_level × 5 |
| **Bardic Inspiration Uses** | Bard | Scales with proficiency bonus |

### Choice Options
The file also contains:
- `METAMAGIC_OPTIONS[]` — 11 options with SP costs and effects
- `MANEUVER_OPTIONS[]` — 16 maneuver options with descriptions
- `FIGHTING_STYLE_OPTIONS[]` — 10 fighting styles with class restrictions
- `THIRD_CASTER_SLOTS{}` — Spell slot progression for Eldritch Knight / Arcane Trickster
- `WARLOCK_SLOTS{}` — Pact Magic progression (slots per level, slot level)
- `MOON_DRUID_CR_OVERRIDE{}` — Enhanced Wild Shape CR limits

---

## 10. Combat Tab & Dungeon Cards

**File:** `tabs/CombatTab.tsx` (~26KB)

### Turn Tracker
Each turn has 3 budgets: **Action**, **Bonus Action**, **Reaction**. Playing a card deducts from the appropriate budget. A "New Turn" button resets all three.

### Unified Combat Deck
All combat options are compiled into a single card array (`DungeonCardData[]`) from 5 sources:

#### 1. Spell Cards
- Built from `preparedSpells` (prepared casters) or `knownSpells` (known casters)
- Resolved via the `useSpells()` hook which merges custom spells with the static spell database
- Shows damage, range, slot cost with expendable pip counter
- Cantrips (level 0) have no slot cost

#### 2. Feature/Resource Cards
- Built from `char.resources{}` (excluding spell slot entries)
- Shows name, description, action cost badge
- **Unlimited resources** (max ≥ 99 or recharge = 'none'): hide pip counter, always playable
- **Limited resources**: show pip counter, deduct on use

#### 3. Weapon Cards
- Built from `char.equipped.mainHand` and `char.equipped.offHand`
- Auto-calculates attack bonus: `ability_mod + proficiency_bonus`
- Handles finesse (uses higher of STR/DEX), ranged, and proficiency checks
- Main hand = Action, Off hand = Bonus Action

#### 4. Manual Attack Cards
- From `char.attacks[]` — user-defined attack entries

#### 5. Basic Action Cards
- Universal D&D actions: Dash, Dodge, Disengage, Help, Hide, Ready, Search, Use Object
- Basic bonus actions: Two-Weapon Fighting, Dash (Cunning Action)
- Basic reaction: Opportunity Attack

### The DungeonCard Component
**File:** `components/DungeonCard.tsx`

A card UI component that displays:
- **Name** with color-coded action cost badge (🟢 Action, 🟡 Bonus, 🔵 Reaction)
- **Description** text
- **Damage/Range** stats
- **Resource pips** (filled = available, empty = spent)
- **Attack Roll** button → random d20 + bonus
- **Damage Roll** button → random dice + bonus
- **Play** button → spends turn resource, expends resource, logs to logbook

### Active Modifier Toggles
Below the deck, a section shows **one-shot modifier buttons** from `char.activeModifiers[]`:
- Metamagic options (e.g., "Twinned Spell — 2 SP")
- Maneuver options (e.g., "Riposte")
- Visual states: Available (gold border), Spent (grey, strikethrough)
- Reset on appropriate rest type

### Resolved Modifier Display
The combat tab also shows:
- **Resistances** (from `resolveModifiers()`)
- **Immunities** (from `resolveModifiers()`)

### Dice Rolling
`handleRoll(name, diceString, bonus, isAttack)`:
- Parses dice notation (e.g., "2d6")
- Rolls random values, adds bonus
- Shows alert with result
- Logs to character logbook

---

## 11. Spell System

### Static Spell Database
**File:** `lib/data/spells.ts` (~265KB)

Contains the full 5e SRD spell list as a typed array of `SpellData`:
```typescript
interface SpellData {
  id: string;          // e.g., "fireball"
  name: string;        // e.g., "Fireball"
  level: number;       // 0 = cantrip, 1-9
  school: string;      // e.g., "Evocation"
  castingTime: string; // e.g., "1 Action"
  range: string;       // e.g., "150 ft."
  components: string;  // e.g., "V, S, M (bat guano)"
  duration: string;    // e.g., "Instantaneous"
  description: string; // Full text
  damage?: string;     // e.g., "8d6"
  actionCost: ActionCost;
  classes: string[];   // Which classes can learn it
}
```

### Spell Browser
**File:** `components/SpellBrowser.tsx`

A filterable, searchable spell list component used in:
- Character creation (draft mode)
- Level-up wizard (learning mode)
- Spells tab (management mode)

Features:
- Filter by class, level, school
- Search by name
- "Show Valid Leveling Magic Only" toggle
- Lock indicators for spells the character can't learn (wrong class, too high level, cap reached)

### Spell Lock Evaluator
**File:** `lib/magic-system.ts` — `evaluateSpellLock()`

Checks:
1. Is the character a spellcaster?
2. Does the spell belong to their class list (or subclass expanded list)?
3. Are they high enough level?
4. Have they reached their max cantrips/spells known?

### Spell Progression
`getSpellProgression(className, level)` returns:
- `cantripsKnown` — max cantrips
- `spellsKnown` — max spells known/prepared
- `maxSpellLevel` — highest spell level accessible

Categories:
- **Full casters** (Wizard, Cleric, Druid, Bard, Sorcerer, Warlock): cantrips + full spell progression
- **Half casters** (Paladin, Ranger): no cantrips, half progression
- **Non-casters** (Fighter, Barbarian, Rogue, Monk): 0/0/0

### Spells Tab
**File:** `tabs/SpellsTab.tsx`

Manages the character's spell repertoire:
- View known spells grouped by level
- Prepare/unprepare spells (for prepared casters)
- Open SpellBrowser to learn new spells
- Manage cantrips

---

## 12. Rest System

### Short Rest (`shortRest(hitDiceRoll)`)
1. Spend 1 Hit Die → heal for `hitDiceRoll` HP (if available)
2. Reset all resources with `recharge: 'short'` (set `used = 0`)
3. Reset `activeModifiers` where `recharge === 'short'` (e.g., Maneuvers)
4. Log event

### Long Rest (`longRest()`)
1. Restore HP to maximum, clear temp HP
2. Restore half hit dice (minimum 1)
3. Reset ALL resources with `recharge: 'short'` or `'long'` (set `used = 0`)
4. Reset ALL `activeModifiers` (regardless of recharge type)
5. Clear death saves
6. Log event

Resources with `recharge: 'none'` are **never** automatically reset.

---

## 13. Character Sheet Tabs

**Route:** `/dungeon-buddy/:id`  
**File:** `[id]/page.tsx`

The character sheet uses a left sidebar with 8 tabs:

### Sticky Vitals Header
**File:** `components/StickyVitalsHeader.tsx`

Always visible at the top. Shows:
- Character name, race, class, level
- HP bar with +/- controls
- Temp HP display
- AC, Speed, Proficiency Bonus
- Level Up button
- Short Rest / Long Rest buttons

### Tab List

| Tab | Icon | File | Purpose |
|---|---|---|---|
| **Profile** | 👤 | `ProfileTab.tsx` | Name, portrait, personality traits, ideals, bonds, flaws, notes |
| **Abilities** | ⚔ | `AbilitiesTab.tsx` | Six ability scores with modifiers, saving throw proficiencies |
| **Skills** | 🎯 | `SkillsTab.tsx` | 18 skills with modifiers, proficiency/expertise indicators |
| **Combat** | 🛡 | `CombatTab.tsx` | Turn tracker, combat deck, dice rolling, conditions, rests |
| **Spells** | ✦ | `SpellsTab.tsx` | Spell management, preparation, SpellBrowser |
| **Inventory** | 🎒 | `InventoryTab.tsx` | Paper-doll equipment, backpack, currency, item management |
| **Features** | 📜 | `FeaturesTab.tsx` | Grouped by source, modifier badges, cantrip/proficiency summary |
| **Logbook** | 📖 | `LogbookTab.tsx` | Chronological event log (rolls, rests, level-ups, notes) |

### Features Tab Details
**File:** `tabs/FeaturesTab.tsx`

Features are grouped by their `source` field (class name, subclass name, "Metamagic", etc.) and display:
- Level indicator
- Description text
- **Modifier badges** with color coding:
  - 🔵 Resource — adds a trackable resource
  - 🟢 Proficiency — grants a proficiency
  - 🟡 Spells — grants/prepares spells
  - 🔴 Damage — adds damage bonuses
  - 🟣 Defense — grants resistances/immunities/HP
  - ⚪ Combat — extra attacks, crit range, fighting styles

### Inventory Tab Details
**File:** `tabs/InventoryTab.tsx` (~20KB)

Features:
- **Paper Doll:** Visual equipment slots layout
- **Backpack:** Scrollable item list with quantity, weight, equip/drop actions
- **Currency:** Gold/Silver/Copper tracking
- **Weight calculation:** Total carry weight display
- **Equip flow:** Click item → select slot → moves from inventory to equipped

---

## 14. AI Integration (The Oracle)

### Character Forge
**Backend endpoint:** `POST /oracle/forge-character`  
**AI Model:** Gemini 2.5 Flash (JSON output mode)

The Oracle generates complete characters from either:
- **Text mode:** User describes a character concept
- **Chaos mode:** Fully random, with a system prompt that explicitly avoids common tropes

The system prompt enforces:
- Valid race/class/background IDs from constraint lists
- Point Buy compliance (exactly 27 points)
- Correct skill count from class skill list
- Level 0-1 homebrew spells for casters (2-3 custom spells)
- 3-5 thematic equipment items with balanced stats
- Atmospheric portrait prompt generation
- Single-line JSON strings (no literal newlines)

Includes retry logic (up to 2 retries with 2-second delay).

### Homebrew Subclass Forge
**Backend endpoint:** `POST /oracle/forge-subclass`  
**AI Model:** Gemini 2.5 Flash

Generates a complete homebrew subclass with:
- Thematic name
- 3-4 features (1 at current level + 2-3 at future milestone levels)
- Mechanically balanced for 5e play

### Canonical Subclass Feature Lookup
**Backend endpoint:** `POST /oracle/forge-subclass-features`  
**AI Model:** Gemini 2.5 Flash

Looks up whether the official subclass grants features at a specific level. Used as a fallback when the local data files don't cover a specific feature.

### Portrait Generation
**Backend endpoint:** `POST /generate-portrait`  
**AI Model:** Imagen 4.0 (`imagen-4.0-generate-001`)

Generates 1:1 aspect ratio fantasy character portraits. Prompt includes:
- Race and class context
- User description
- Style directives: "dramatic lighting, dark moody background, detailed face, high quality fantasy art, no text, no UI elements"

Portraits are stored as base64-encoded JPEG strings in the character document.

---

## 15. Session Scribe

**Route:** `/dungeon-buddy/scribe`  
**File:** `scribe/page.tsx` (~14KB)

A live session recording and AI summarization tool.

### Features
- **Text input:** Paste or type session transcripts
- **AI Summarization:** Sends to Gemini 2.5 Flash for structured extraction
- **Output format:**
  ```json
  {
    "title": "Epic session title",
    "summary": "Narrative summary paragraph(s)",
    "locations": ["Places visited"],
    "npcs": ["NPCs encountered"],
    "quests": ["Quest updates"],
    "loot": ["Items acquired"]
  }
  ```
- **Session history:** Browse past summarized sessions
- Sessions stored in `dungeon-buddy-sessions.json`

---

## 16. Auto-Save System

**File:** `[id]/page.tsx` — `useEffect` with debounce

The character sheet auto-saves with this mechanism:

1. A `useEffect` watches the `char` object from Zustand
2. On first mount, skips save (prevents saving the initial fetch)
3. On subsequent changes, sets `saveStatus = 'saving'` immediately
4. Debounces for **500ms** to batch rapid changes
5. Sends `PUT /api/dungeon-buddy/characters/:id` with complete character JSON
6. Sets `saveStatus = 'saved'` for 2 seconds, then returns to `'idle'`
7. Save indicator shown in sidebar: `• (saving)` → `Saved ✓` → `` (idle)

---

## 17. File Reference Map

```
dexterslab-frontend/app/dungeon-buddy/
├── page.tsx                          # Landing / character lobby
├── page.module.css                   # Lobby styles
├── create/
│   ├── page.tsx                      # 9-step creation wizard (1250 lines)
│   └── page.module.css               # Creation styles
├── [id]/
│   ├── page.tsx                      # Character sheet shell + auto-save
│   └── page.module.css               # Sheet styles (26KB)
├── scribe/
│   ├── page.tsx                      # Session scribe
│   └── page.module.css
├── components/
│   ├── LevelUpWizard.tsx             # Full level-up wizard (47KB, 780 lines)
│   ├── LevelUpModal.tsx              # Level-up entry modal (40KB)
│   ├── DungeonCard.tsx               # Combat deck card component
│   ├── SpellBrowser.tsx              # Filterable spell list
│   ├── SpellCard.tsx                 # Individual spell display
│   ├── StickyVitalsHeader.tsx        # HP/AC bar always visible
│   ├── ResourceTracker.tsx           # Pip-based resource counter
│   ├── Tooltip.tsx                   # Hover tooltip component
│   └── D20Icon.tsx                   # D20 SVG icon
├── tabs/
│   ├── ProfileTab.tsx                # Character bio / notes
│   ├── AbilitiesTab.tsx              # Ability scores
│   ├── SkillsTab.tsx                 # Skill proficiencies
│   ├── CombatTab.tsx                 # Combat deck + turn tracker (26KB)
│   ├── SpellsTab.tsx                 # Spell management
│   ├── InventoryTab.tsx              # Equipment + inventory (20KB)
│   ├── FeaturesTab.tsx               # Grouped features + badges
│   └── LogbookTab.tsx                # Event log
├── lib/
│   ├── store.ts                      # Zustand store (22KB, 614 lines)
│   ├── types.ts                      # TypeScript types (13KB, 333 lines)
│   ├── resolve-modifiers.ts          # Modifier resolution engine (13KB)
│   ├── magic-system.ts              # Spell progression + lock evaluator
│   ├── compute-stats.ts             # Damage computation helpers
│   ├── ac.ts                         # AC calculation
│   └── data/
│       ├── spells.ts                 # Full spell database (265KB)
│       └── items.ts                  # Item database (7KB)
├── data/
│   ├── srd.ts                        # Races, classes, backgrounds (68KB)
│   ├── subclass-features.ts          # Master subclass registry + Barbarian
│   ├── subclass-features-bard.ts     # Bard subclasses
│   ├── subclass-features-cleric.ts   # Cleric subclasses
│   ├── subclass-features-druid.ts    # Druid subclasses
│   ├── subclass-features-fighter.ts  # Fighter subclasses
│   ├── subclass-features-monk.ts     # Monk subclasses
│   ├── subclass-features-paladin.ts  # Paladin subclasses
│   ├── subclass-features-ranger.ts   # Ranger subclasses
│   ├── subclass-features-rogue.ts    # Rogue subclasses
│   ├── subclass-features-sorcerer.ts # Sorcerer subclasses
│   ├── subclass-features-warlock.ts  # Warlock subclasses
│   ├── subclass-features-wizard.ts   # Wizard subclasses
│   ├── resource-scaling.ts           # Scaling tables (24KB)
│   ├── feats.ts                      # Feat list
│   ├── invocations.ts                # Warlock invocations
│   └── starting-equipment.ts         # Starting gear choices
└── hooks/
    └── useSpells.ts                  # Spell ID → SpellData resolver

dexterslab-backend/apps/dungeon-buddy/
└── index.js                          # Express routes, file storage, AI endpoints (486 lines)
```

---

*Document generated from codebase analysis. All line counts and byte sizes are approximate and reflect the state at time of writing.*
