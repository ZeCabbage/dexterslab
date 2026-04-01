'use client';

import { useState } from 'react';
import { useCharacterStore } from '../lib/store';
import { calculateAC } from '../lib/ac';
import LevelUpWizard from './LevelUpWizard';
import styles from '../[id]/page.module.css';

export default function StickyVitalsHeader() {
  const { char, updateHP, updateTempHP } = useCharacterStore();
  const [showLevelUp, setShowLevelUp] = useState(false);

  if (!char) return null;

  // Basic derivation
  const speed = char.speed || 30;
  const init = Math.floor(((char.stats?.dex || 10) - 10) / 2);
  const hpPercent = Math.min(100, Math.max(0, (char.currentHp / (char.maxHp || 1)) * 100));
  const profBonus = Math.ceil((char.level || 1) / 4) + 1;

  return (
    <div className={styles.stickyVitalsHeader} style={{
      position: 'sticky', top: 0, zIndex: 100, backgroundColor: 'rgba(15, 15, 15, 0.95)',
      backdropFilter: 'blur(10px)', borderBottom: '1px solid #cfaa5e', padding: '16px',
      display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px', flexWrap: 'wrap'
    }}>
      {/* Portrait */}
      <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', border: '2px solid #cfaa5e', flexShrink: 0 }}>
        {char.portrait ? (
          <img src={`data:image/png;base64,${char.portrait}`} alt={char.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#666' }}>No Pic</div>
        )}
      </div>

      {/* Hero Name & Info */}
      <div style={{ flexGrow: 1 }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', color: '#cfaa5e', fontFamily: 'Cinzel, serif' }}>{char.name || 'Unknown Hero'}</h2>
        <div style={{ fontSize: '14px', color: '#888', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>Lv.{char.level} {char.race} {char.class}</span>
          {char.level < 20 && (
            <button 
              onClick={() => setShowLevelUp(true)}
              style={{ background: '#332211', color: '#cfaa5e', border: '1px solid #cfaa5e', borderRadius: '4px', fontSize: '12px', padding: '2px 8px', cursor: 'pointer', fontFamily: 'Cinzel, serif' }}
            >
              ✦ Ascend to Level {char.level + 1}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          {(char.conditions || []).map(c => (
             <span key={c} style={{ background: '#4a1111', color: '#ffb3b3', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', border: '1px solid #ff4d4d' }}>{c}</span>
          ))}
        </div>
      </div>

      {/* Vitals Blocks */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', flex: '1 1 auto', justifyContent: 'flex-start' }}>
        
        {/* HP Block */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#1a1a1a', padding: '8px 12px', borderRadius: '8px', border: '1px solid #333' }}>
          <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Hit Points</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
            <button onClick={() => updateHP(-1)} style={{ background: '#331111', color: '#ff4d4d', border: '1px solid #662222', borderRadius: '4px', width: 28, height: 28, cursor: 'pointer' }}>-</button>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: char.currentHp === 0 ? '#ff4d4d' : '#ddd' }}>
              {char.currentHp} <span style={{ fontSize: '16px', color: '#666', fontWeight: 'normal' }}>/ {char.maxHp}</span>
            </div>
            <button onClick={() => updateHP(1)} style={{ background: '#113311', color: '#4dff4d', border: '1px solid #226622', borderRadius: '4px', width: 28, height: 28, cursor: 'pointer' }}>+</button>
          </div>
          <div style={{ width: '100%', height: '4px', background: '#333', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: char.currentHp > (char.maxHp/2) ? '#cfaa5e' : '#c44', width: `${hpPercent}%`, transition: 'width 0.3s ease' }} />
          </div>
          {char.tempHp > 0 && <div style={{ fontSize: '12px', color: '#77ccff', marginTop: '4px' }}>Temp: {char.tempHp}</div>}
        </div>

        {/* AC Block */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#1a1a1a', padding: '8px 16px', borderRadius: '8px', border: '1px solid #333', justifyContent: 'center' }}>
          <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Armor</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#cfaa5e' }}>{calculateAC(char)}</div>
        </div>

        {/* Small Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
          <div style={{ background: '#1a1a1a', padding: '2px 8px', borderRadius: '4px', border: '1px solid #333', fontSize: '12px', display: 'flex', justifyContent: 'space-between', width: '80px' }}>
             <span style={{ color: '#888' }}>INIT</span> <span style={{ color: '#ddd' }}>{init >= 0 ? '+'+init : init}</span>
          </div>
          <div style={{ background: '#1a1a1a', padding: '2px 8px', borderRadius: '4px', border: '1px solid #333', fontSize: '12px', display: 'flex', justifyContent: 'space-between', width: '80px' }}>
             <span style={{ color: '#888' }}>SPD</span> <span style={{ color: '#ddd' }}>{speed}</span>
          </div>
          <div style={{ background: '#1a1a1a', padding: '2px 8px', borderRadius: '4px', border: '1px solid #333', fontSize: '12px', display: 'flex', justifyContent: 'space-between', width: '80px' }}>
             <span style={{ color: '#888' }}>PROF</span> <span style={{ color: '#ddd' }}>+{profBonus}</span>
          </div>
        </div>

      </div>
      
      {showLevelUp && <LevelUpWizard onClose={() => setShowLevelUp(false)} />}
    </div>
  );
}
