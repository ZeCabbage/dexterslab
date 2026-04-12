'use client';

import React, { useState } from 'react';
import styles from '../[id]/page.module.css';
import D20Icon from './D20Icon';
import ResourceTracker from './ResourceTracker';
import { PostHitModifierEntry } from '../lib/resolve-modifiers';
import { TrackedResource } from '../lib/types';

export type CardActionCost = 'action' | 'bonus_action' | 'reaction' | 'special' | 'none';
export type CardType = 'weapon' | 'spell' | 'feature';

export interface DungeonCardData {
  id: string;
  name: string;
  type: CardType;
  actionCost: CardActionCost;
  description?: string;
  
  // Stats
  primaryStat?: string; // e.g., "Level 3 Magic", "Finesse 1d8"
  damageString?: string;
  isPrepared?: boolean;
  
  // Resource Tracking
  resourceMax?: number;
  resourceUsed?: number;
  onExpend?: () => void;
  onRestore?: () => void;

  // Play Execution
  onPlay?: () => void;
  playLabel?: string;
  
  // Alt Play Executions (like Rolling ATK vs DMG separately for weapons)
  onSecondaryPlay?: () => void;
  secondaryLabel?: string;
  
  // Options (e.g. basic action choices)
  options?: string[];
  selectedOption?: string;
  onOptionChange?: (val: string) => void;

  // ── Post-Hit Modifiers (Divine Smite pattern) ──
  postHitModifiers?: PostHitModifierEntry[];
  spellSlotResources?: Record<string, TrackedResource>;  // spell_slot_1, spell_slot_2, etc.
  onSmite?: (modifierName: string, slotLevel: number, totalDice: string, damageType: string) => void;
}

// ── Dice parser helper ──
function parseDice(dice: string): { count: number; sides: number } {
  const parts = dice.toLowerCase().split('d');
  return { count: parseInt(parts[0]) || 1, sides: parseInt(parts[1]) || 8 };
}

function buildSmiteDice(baseDice: string, dicePerLevel: string, slotLevel: number, maxDice?: string): string {
  const base = parseDice(baseDice);
  const perLevel = parseDice(dicePerLevel);
  
  // baseDice is at level 1 slot. Each slot above 1 adds dicePerLevel.
  const extraLevels = Math.max(0, slotLevel - 1);
  const totalCount = base.count + (extraLevels * perLevel.count);
  
  // Apply cap if maxDice is defined
  if (maxDice) {
    const max = parseDice(maxDice);
    const cappedCount = Math.min(totalCount, max.count);
    return `${cappedCount}d${base.sides}`;
  }
  
  return `${totalCount}d${base.sides}`;
}

export default function DungeonCard({ card }: { card: DungeonCardData }) {
  const [expanded, setExpanded] = useState(false);
  const [showSmitePanel, setShowSmitePanel] = useState(false);
  const [selectedSmiteMod, setSelectedSmiteMod] = useState<PostHitModifierEntry | null>(null);

  // Styling based on action economy
  let frameColor = '#cfaa5e'; // default gold for none/special
  let bgGradient = 'linear-gradient(to bottom, rgba(30,30,30,0.9), rgba(15,15,15,0.9))';
  let badgeColor = '#555';

  if (card.actionCost === 'action') {
    frameColor = '#44aa44';
    bgGradient = 'linear-gradient(to bottom, rgba(20,40,20,0.9), rgba(10,20,10,0.9))';
    badgeColor = '#224422';
  } else if (card.actionCost === 'bonus_action') {
    frameColor = '#aa4444';
    bgGradient = 'linear-gradient(to bottom, rgba(40,20,20,0.9), rgba(20,10,10,0.9))';
    badgeColor = '#442222';
  } else if (card.actionCost === 'reaction') {
    frameColor = '#aaaa44';
    bgGradient = 'linear-gradient(to bottom, rgba(40,40,20,0.9), rgba(20,20,10,0.9))';
    badgeColor = '#444422';
  }

  // Type Icons mapping
  const iconStr = card.type === 'weapon' ? '⚔️' : card.type === 'spell' ? '✨' : '🛡️';

  // ── Smite Slot Availability ──
  const availableSlots: { level: number; id: string; remaining: number }[] = [];
  if (selectedSmiteMod && card.spellSlotResources) {
    for (let lvl = 1; lvl <= 9; lvl++) {
      const slotId = `spell_slot_${lvl}`;
      const res = card.spellSlotResources[slotId];
      if (res && res.used < res.max) {
        availableSlots.push({ level: lvl, id: slotId, remaining: res.max - res.used });
      }
    }
  }

  const handleSmiteSelect = (slotLevel: number) => {
    if (!selectedSmiteMod || !card.onSmite) return;
    const totalDice = buildSmiteDice(
      selectedSmiteMod.baseDice,
      selectedSmiteMod.dicePerLevel,
      slotLevel,
      selectedSmiteMod.maxDice
    );
    card.onSmite(selectedSmiteMod.name, slotLevel, totalDice, selectedSmiteMod.damageType);
    setShowSmitePanel(false);
    setSelectedSmiteMod(null);
  };

  return (
    <div 
       style={{
         background: bgGradient,
         border: `1px solid ${frameColor}`,
         borderRadius: '8px',
         width: '100%',
         minWidth: '220px',
         maxWidth: '300px',
         display: 'flex',
         flexDirection: 'column',
         position: 'relative',
         transform: expanded ? 'scale(1.02)' : 'scale(1)',
         transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s',
         boxShadow: expanded ? `0 10px 20px rgba(0,0,0,0.6), 0 0 15px ${frameColor}44` : `0 4px 6px rgba(0,0,0,0.4)`,
         backgroundImage: 'url("/textures/grunge.jpg")',
         backgroundBlendMode: 'overlay',
         backgroundSize: 'cover'
       }}
    >
      {/* CARD HEADER */}
      <div 
         onClick={() => setExpanded(!expanded)} 
         style={{ padding: '12px', borderBottom: `1px solid ${frameColor}44`, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: 'bold', fontFamily: 'Cinzel', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {iconStr} {card.name}
          </h4>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: frameColor, fontWeight: 'bold', marginTop: '2px', letterSpacing: '0.5px' }}>
            {card.actionCost === 'bonus_action' ? 'Bonus Action' : card.actionCost}
          </span>
        </div>
        <div style={{ background: badgeColor, padding: '4px 6px', borderRadius: '4px', border: `1px solid ${frameColor}88`, color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>
           {card.primaryStat || card.type.toUpperCase()}
        </div>
      </div>

      {/* EXPANDABLE BODY */}
      {expanded && card.description && (
        <div style={{ padding: '12px', fontSize: '12px', color: '#ccc', fontStyle: 'italic', lineHeight: 1.4, background: 'rgba(0,0,0,0.3)', borderBottom: `1px solid ${frameColor}44` }}>
          {card.description}
        </div>
      )}

      {/* DROPDOWN OPTIONS (Basic Actions) */}
      {card.options && card.options.length > 0 && (
        <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.4)', borderBottom: `1px solid ${frameColor}44` }}>
          <select 
            value={card.selectedOption || card.options[0]} 
            onChange={e => card.onOptionChange && card.onOptionChange(e.target.value)}
            style={{ width: '100%', padding: '6px', background: '#111', color: '#fff', border: `1px solid ${frameColor}`, borderRadius: '4px', outline: 'none', fontFamily: 'Cinzel', fontSize: '12px' }}
          >
             {card.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      )}

      {/* CORE STATS (Damage) */}
      {card.damageString && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px', background: 'rgba(0,0,0,0.2)' }}>
           <span style={{ fontSize: '16px', color: '#ffaaaa', fontWeight: 'bold', border: '1px solid #aa4444', background: '#331111', padding: '4px 12px', borderRadius: '16px', letterSpacing: '1px' }}>
             DMG {card.damageString}
           </span>
        </div>
      )}

      {/* RESOURCE TRACKER INJECTION */}
      {(card.resourceMax ?? 0) > 0 && card.onExpend && card.onRestore && (
        <div style={{ padding: '8px 12px' }}>
           <ResourceTracker 
             label="Uses / Slots" 
             max={card.resourceMax!} 
             used={card.resourceUsed!} 
             onExpend={card.onExpend} 
             onRestore={card.onRestore} 
           />
        </div>
      )}

      {/* ═══ POST-HIT / SMITE SLOT PICKER ═══ */}
      {showSmitePanel && selectedSmiteMod && (
        <div style={{
          padding: '12px', background: 'linear-gradient(180deg, rgba(255, 200, 50, 0.08), rgba(200, 100, 0, 0.06))',
          borderTop: '1px solid #e9a444', borderBottom: '1px solid #e9a444'
        }}>
          <div style={{ fontSize: '11px', color: '#e9a444', fontFamily: 'Cinzel, serif', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            ✦ {selectedSmiteMod.name} — Select Spell Slot
          </div>
          {availableSlots.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#ff6666', fontStyle: 'italic', padding: '8px 0' }}>
              No spell slots remaining. Cannot Smite.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {availableSlots.map(slot => {
                const totalDice = buildSmiteDice(selectedSmiteMod.baseDice, selectedSmiteMod.dicePerLevel, slot.level, selectedSmiteMod.maxDice);
                const ordinal = slot.level === 1 ? '1st' : slot.level === 2 ? '2nd' : slot.level === 3 ? '3rd' : `${slot.level}th`;
                return (
                  <button
                    key={slot.id}
                    onClick={() => handleSmiteSelect(slot.level)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', background: 'rgba(0,0,0,0.4)',
                      border: '1px solid #e9a444', borderRadius: '6px',
                      color: '#fff', cursor: 'pointer', fontSize: '12px',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = 'rgba(233, 164, 68, 0.2)'; e.currentTarget.style.borderColor = '#ffcc66'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.4)'; e.currentTarget.style.borderColor = '#e9a444'; }}
                  >
                    <span style={{ fontFamily: 'Cinzel, serif', fontWeight: 'bold' }}>
                      {ordinal} Level Slot
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ color: '#ffaaaa', fontWeight: 'bold', background: '#331111', padding: '2px 8px', borderRadius: '10px', border: '1px solid #aa4444', fontSize: '11px' }}>
                        {totalDice} {selectedSmiteMod.damageType}
                      </span>
                      <span style={{ color: '#888', fontSize: '10px' }}>
                        ({slot.remaining} left)
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <button
            onClick={() => { setShowSmitePanel(false); setSelectedSmiteMod(null); }}
            style={{ marginTop: '8px', padding: '4px 10px', background: 'transparent', border: '1px solid #666', color: '#888', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', width: '100%' }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ACTIONS FOOTER */}
      <div style={{ padding: '8px', display: 'flex', gap: '8px', borderTop: `1px solid ${frameColor}44`, marginTop: 'auto', flexWrap: 'wrap' }}>
        {card.onPlay && (
          <button 
             onClick={card.onPlay}
             style={{
               flex: 1, padding: '8px', background: frameColor, color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer',
               display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', transition: 'filter 0.1s'
             }}
             onMouseOver={e => e.currentTarget.style.filter = 'brightness(1.2)'}
             onMouseOut={e => e.currentTarget.style.filter = 'brightness(1)'}
          >
            {card.type !== 'feature' && <div style={{width:'16px', height:'16px'}}><D20Icon /></div>}
            {card.playLabel || 'PLAY'}
          </button>
        )}
        
        {card.onSecondaryPlay && (
          <button 
             onClick={card.onSecondaryPlay}
             style={{
               flex: 1, padding: '8px', background: 'rgba(0,0,0,0.5)', color: frameColor, fontWeight: 'bold', border: `1px solid ${frameColor}`, borderRadius: '4px', cursor: 'pointer',
               display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', transition: 'background 0.1s'
             }}
             onMouseOver={e => e.currentTarget.style.background = 'rgba(0,0,0,0.8)'}
             onMouseOut={e => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}
          >
            {card.type !== 'feature' && <div style={{width:'16px', height:'16px'}}><D20Icon /></div>}
            {card.secondaryLabel || 'ALT'}
          </button>
        )}

        {/* ═══ SMITE / POST-HIT BUTTON ═══ */}
        {card.postHitModifiers && card.postHitModifiers.length > 0 && !showSmitePanel && (
          card.postHitModifiers.map(phm => (
            <button
              key={phm.name}
              onClick={() => { setSelectedSmiteMod(phm); setShowSmitePanel(true); }}
              style={{
                flex: 1, padding: '8px',
                background: 'linear-gradient(135deg, rgba(233, 164, 68, 0.25), rgba(200, 80, 30, 0.15))',
                color: '#ffcc66', fontWeight: 'bold',
                border: '1px solid #e9a444', borderRadius: '4px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                fontSize: '11px', transition: 'all 0.15s ease',
                boxShadow: '0 0 8px rgba(233, 164, 68, 0.15)',
              }}
              onMouseOver={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(233, 164, 68, 0.4), rgba(200, 80, 30, 0.25))'; e.currentTarget.style.boxShadow = '0 0 12px rgba(233, 164, 68, 0.3)'; }}
              onMouseOut={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(233, 164, 68, 0.25), rgba(200, 80, 30, 0.15))'; e.currentTarget.style.boxShadow = '0 0 8px rgba(233, 164, 68, 0.15)'; }}
            >
              ✦ {phm.name}
            </button>
          ))
        )}
      </div>
      
    </div>
  );
}
