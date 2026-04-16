'use client';

import React, { useState, useCallback } from 'react';
import { ModifierEffect } from '../lib/types';

// ═══════════════════════════════════════════════════════════════
//  MODIFIER BUILDER — Visual form for constructing ModifierEffect[]
//  Proof-of-concept: add_conditional_damage, modify_ac, grant_resistance
//  Outputs a valid ModifierEffect[] that hooks into resolveModifiers()
// ═══════════════════════════════════════════════════════════════

interface ModifierBuilderProps {
  value: ModifierEffect[];
  onChange: (modifiers: ModifierEffect[]) => void;
}

type SupportedType = 'add_conditional_damage' | 'modify_ac' | 'grant_resistance';

const MODIFIER_TYPE_OPTIONS: { value: SupportedType; label: string; icon: string; description: string }[] = [
  { value: 'add_conditional_damage', label: 'Conditional Damage', icon: '⚔️', description: 'Add bonus damage dice to attacks' },
  { value: 'modify_ac', label: 'Modify AC', icon: '🛡️', description: 'Add a flat bonus to Armor Class' },
  { value: 'grant_resistance', label: 'Grant Resistance', icon: '✨', description: 'Grant resistance to a damage type' },
];

const DAMAGE_TYPES = [
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 
  'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'
];

const DICE_OPTIONS = ['1d4', '1d6', '1d8', '1d10', '1d12', '2d6', '2d8', '2d10', '3d6', '3d8'];

const TARGET_OPTIONS: { value: 'melee' | 'spell' | 'all'; label: string }[] = [
  { value: 'melee', label: 'Melee Attacks' },
  { value: 'spell', label: 'Spells' },
  { value: 'all', label: 'All Attacks' },
];

// ── Styles ──
const containerStyle: React.CSSProperties = {
  border: '1px solid #444',
  borderRadius: '8px',
  background: 'linear-gradient(180deg, rgba(25,25,30,0.95), rgba(15,15,20,0.98))',
  padding: '16px',
};

const modEntryStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid #555',
  borderRadius: '6px',
  padding: '12px',
  marginBottom: '8px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#888',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  marginBottom: '4px',
  fontWeight: 'bold',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: '#1a1a1a',
  border: '1px solid #555',
  color: '#fff',
  borderRadius: '4px',
  fontSize: '13px',
  fontFamily: 'Cinzel, serif',
  outline: 'none',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: '#1a1a1a',
  border: '1px solid #555',
  color: '#fff',
  borderRadius: '4px',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box' as const,
};

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px',
  background: 'linear-gradient(135deg, #cfaa5e, #b8842e)',
  color: '#000',
  fontWeight: 'bold',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '12px',
  fontFamily: 'Cinzel, serif',
  transition: 'filter 0.15s',
};

const btnDanger: React.CSSProperties = {
  padding: '4px 10px',
  background: 'transparent',
  color: '#ff6666',
  border: '1px solid #663333',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '11px',
  transition: 'all 0.15s',
};

// ── Inline Modifier Form for each type ──

function ConditionalDamageForm({ onAdd }: { onAdd: (mod: ModifierEffect) => void }) {
  const [target, setTarget] = useState<'melee' | 'spell' | 'all'>('melee');
  const [dice, setDice] = useState('1d6');
  const [damageType, setDamageType] = useState('fire');
  const [condition, setCondition] = useState('Once per turn on a hit');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div>
        <div style={labelStyle}>Target</div>
        <select style={selectStyle} value={target} onChange={e => setTarget(e.target.value as any)}>
          {TARGET_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <div style={{ flex: 1 }}>
          <div style={labelStyle}>Dice</div>
          <select style={selectStyle} value={dice} onChange={e => setDice(e.target.value)}>
            {DICE_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <div style={labelStyle}>Damage Type</div>
          <select style={selectStyle} value={damageType} onChange={e => setDamageType(e.target.value)}>
            {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div>
        <div style={labelStyle}>Condition</div>
        <input
          style={inputStyle}
          value={condition}
          onChange={e => setCondition(e.target.value)}
          placeholder="e.g., Once per turn on a hit"
        />
      </div>
      <button
        style={btnPrimary}
        onClick={() => onAdd({ type: 'add_conditional_damage', target, dice, damageType, condition })}
        onMouseOver={e => e.currentTarget.style.filter = 'brightness(1.2)'}
        onMouseOut={e => e.currentTarget.style.filter = 'brightness(1)'}
      >
        + Add Conditional Damage
      </button>
    </div>
  );
}

function ModifyACForm({ onAdd }: { onAdd: (mod: ModifierEffect) => void }) {
  const [mode, setMode] = useState<'bonus' | 'formula'>('bonus');
  const [bonus, setBonus] = useState(1);
  const [formula, setFormula] = useState('13+dex');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={() => setMode('bonus')} style={{ ...btnPrimary, flex: 1, background: mode === 'bonus' ? 'linear-gradient(135deg, #cfaa5e, #b8842e)' : '#222', color: mode === 'bonus' ? '#000' : '#888' }}>Flat Bonus (+1, +2)</button>
        <button onClick={() => setMode('formula')} style={{ ...btnPrimary, flex: 1, background: mode === 'formula' ? 'linear-gradient(135deg, #cfaa5e, #b8842e)' : '#222', color: mode === 'formula' ? '#000' : '#888' }}>Base Formula</button>
      </div>
      {mode === 'bonus' ? (
        <div>
          <div style={labelStyle}>AC Bonus</div>
          <input
            style={inputStyle}
            type="number"
            min={1}
            max={10}
            value={bonus}
            onChange={e => setBonus(parseInt(e.target.value) || 1)}
          />
          <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
            Flat bonus that stacks with everything (e.g., Ring of Protection +1)
          </div>
        </div>
      ) : (
        <div>
          <div style={labelStyle}>AC Formula</div>
          <input
            style={inputStyle}
            value={formula}
            onChange={e => setFormula(e.target.value)}
            placeholder="e.g., 13+dex, 10+dex+wis, 10+dex+con"
          />
          <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
            Base AC formula (replaces armor). Engine picks the highest between all formulas and equipped armor.
          </div>
        </div>
      )}
      <button
        style={btnPrimary}
        onClick={() => mode === 'bonus'
          ? onAdd({ type: 'modify_ac', bonus })
          : onAdd({ type: 'set_ac_formula', formula })
        }
        onMouseOver={e => e.currentTarget.style.filter = 'brightness(1.2)'}
        onMouseOut={e => e.currentTarget.style.filter = 'brightness(1)'}
      >
        + Add AC Modifier
      </button>
    </div>
  );
}

function GrantResistanceForm({ onAdd }: { onAdd: (mod: ModifierEffect) => void }) {
  const [damageType, setDamageType] = useState('fire');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div>
        <div style={labelStyle}>Damage Type</div>
        <select style={selectStyle} value={damageType} onChange={e => setDamageType(e.target.value)}>
          {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <button
        style={btnPrimary}
        onClick={() => onAdd({ type: 'grant_resistance', damageType })}
        onMouseOver={e => e.currentTarget.style.filter = 'brightness(1.2)'}
        onMouseOut={e => e.currentTarget.style.filter = 'brightness(1)'}
      >
        + Add Resistance
      </button>
    </div>
  );
}

// ── Display a single modifier as a badge ──
function ModifierBadge({ mod, onRemove }: { mod: ModifierEffect; onRemove: () => void }) {
  let label = '';
  let color = '#cfaa5e';

  switch (mod.type) {
    case 'add_conditional_damage':
      label = `⚔️ ${mod.dice} ${mod.damageType} (${mod.target})`;
      color = '#ff6666';
      break;
    case 'modify_ac':
      label = `🛡️ AC: +${mod.bonus}`;
      color = '#66aaff';
      break;
    case 'set_ac_formula':
      label = `🛡️ AC Formula: ${mod.formula}`;
      color = '#66aaff';
      break;
    case 'grant_resistance':
      label = `✨ Resist: ${mod.damageType}`;
      color = '#66ff66';
      break;
    default:
      label = `🔧 ${mod.type}`;
  }

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 12px',
      background: 'rgba(0,0,0,0.4)',
      border: `1px solid ${color}44`,
      borderRadius: '16px',
      fontSize: '12px',
      color,
    }}>
      <span>{label}</span>
      <button
        onClick={onRemove}
        style={btnDanger}
        onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,0,0,0.15)'; }}
        onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        ✕
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function ModifierBuilder({ value, onChange }: ModifierBuilderProps) {
  const [selectedType, setSelectedType] = useState<SupportedType | ''>('');

  const handleAdd = useCallback((mod: ModifierEffect) => {
    onChange([...value, mod]);
    setSelectedType(''); // Reset form
  }, [value, onChange]);

  const handleRemove = useCallback((index: number) => {
    const updated = [...value];
    updated.splice(index, 1);
    onChange(updated);
  }, [value, onChange]);

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <h4 style={{ margin: 0, color: '#cfaa5e', fontSize: '14px', fontFamily: 'Cinzel, serif' }}>
            ⚙ Mechanical Modifiers
          </h4>
          <div style={{ fontSize: '11px', color: '#777', marginTop: '2px' }}>
            Add mechanical effects that integrate into the combat engine
          </div>
        </div>
        <div style={{
          padding: '3px 8px',
          background: value.length > 0 ? 'rgba(207,170,94,0.15)' : 'rgba(100,100,100,0.15)',
          border: `1px solid ${value.length > 0 ? '#cfaa5e' : '#555'}44`,
          borderRadius: '10px',
          fontSize: '11px',
          color: value.length > 0 ? '#cfaa5e' : '#666',
          fontWeight: 'bold',
        }}>
          {value.length} active
        </div>
      </div>

      {/* Active Modifiers Display */}
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
          {value.map((mod, i) => (
            <ModifierBadge key={i} mod={mod} onRemove={() => handleRemove(i)} />
          ))}
        </div>
      )}

      {/* Type Selector */}
      {!selectedType && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {MODIFIER_TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSelectedType(opt.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', background: 'rgba(0,0,0,0.3)',
                border: '1px solid #444', borderRadius: '6px',
                color: '#ccc', cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.15s',
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = '#cfaa5e'; e.currentTarget.style.background = 'rgba(207,170,94,0.06)'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.background = 'rgba(0,0,0,0.3)'; }}
            >
              <span style={{ fontSize: '18px' }}>{opt.icon}</span>
              <div>
                <div style={{ fontFamily: 'Cinzel, serif', fontWeight: 'bold', fontSize: '13px', color: '#fff' }}>{opt.label}</div>
                <div style={{ fontSize: '11px', color: '#777' }}>{opt.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Active Form */}
      {selectedType && (
        <div style={modEntryStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#cfaa5e', fontFamily: 'Cinzel, serif', fontSize: '13px', fontWeight: 'bold' }}>
              {MODIFIER_TYPE_OPTIONS.find(o => o.value === selectedType)?.icon} {MODIFIER_TYPE_OPTIONS.find(o => o.value === selectedType)?.label}
            </span>
            <button
              onClick={() => setSelectedType('')}
              style={{...btnDanger, padding: '2px 8px'}}
            >
              Cancel
            </button>
          </div>

          {selectedType === 'add_conditional_damage' && <ConditionalDamageForm onAdd={handleAdd} />}
          {selectedType === 'modify_ac' && <ModifyACForm onAdd={handleAdd} />}
          {selectedType === 'grant_resistance' && <GrantResistanceForm onAdd={handleAdd} />}
        </div>
      )}
    </div>
  );
}
