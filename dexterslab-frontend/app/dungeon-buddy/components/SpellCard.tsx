'use client';

import React from 'react';
import { SpellData } from '../lib/data/spells';

interface SpellCardProps {
  spell: SpellData;
  isKnown?: boolean;
  isPrepared?: boolean;
  onPrepareToggle?: () => void;
  onLearnToggle?: () => void;
}

export default function SpellCard({ spell, isKnown, isPrepared, onPrepareToggle, onLearnToggle }: SpellCardProps) {
  return (
    <div style={{
      background: 'rgba(20,20,20,0.8)',
      border: `1px solid ${isPrepared ? '#cfaa5e' : '#444'}`, // Highlight if prepared
      borderRadius: '6px',
      padding: '12px',
      position: 'relative',
      boxShadow: isPrepared ? '0 0 10px rgba(207, 170, 94, 0.1)' : 'none',
      display: 'flex', flexDirection: 'column'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h4 style={{ margin: '0 0 4px 0', color: isPrepared ? '#fff' : '#cfaa5e', fontSize: '16px' }}>{spell.name}</h4>
          <span style={{ fontSize: '12px', color: '#888', fontStyle: 'italic' }}>
            {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`} {spell.school}
          </span>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          {onPrepareToggle && spell.level > 0 && (
            <button 
              onClick={onPrepareToggle}
              style={{
                background: isPrepared ? '#cfaa5e' : 'transparent',
                color: isPrepared ? '#000' : '#888',
                border: `1px solid ${isPrepared ? '#cfaa5e' : '#555'}`,
                padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {isPrepared ? 'PREPARED' : 'Prepare'}
            </button>
          )}

          {onLearnToggle && (
            <button 
              onClick={onLearnToggle}
              style={{
                background: isKnown ? '#55aacc' : 'transparent',
                color: isKnown ? '#000' : '#55aacc',
                border: '1px solid #55aacc',
                padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer'
              }}
            >
              {isKnown ? 'FORGET' : 'LEARN'}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginTop: '12px', marginBottom: '12px', borderBottom: '1px solid #333', paddingBottom: '8px' }}>
        <div style={{ fontSize: '11px', color: '#aaa' }}><strong>Time:</strong> {spell.castingTime}</div>
        <div style={{ fontSize: '11px', color: '#aaa' }}><strong>Range:</strong> {spell.range}</div>
        <div style={{ fontSize: '11px', color: '#aaa' }}><strong>Duration:</strong> {spell.duration}</div>
      </div>

      <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#bbb', lineHeight: '1.4' }}>
        {spell.description}
      </p>

      {spell.damage && (
        <div style={{ marginTop: 'auto', background: 'rgba(255, 50, 50, 0.1)', border: '1px solid rgba(255,50,50,0.3)', padding: '6px', borderRadius: '4px', textAlign: 'center', fontSize: '12px', color: '#ff6666' }}>
          <strong>{spell.damage}</strong>
        </div>
      )}
    </div>
  );
}
