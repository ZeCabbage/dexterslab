'use client';

import React from 'react';

interface ResourceTrackerProps {
  label: string;
  max: number;
  used: number;
  onExpend: () => void;
  onRestore: () => void;
}

export default function ResourceTracker({ label, max, used, onExpend, onRestore }: ResourceTrackerProps) {
  if (max === 0) return null; // Don't render if there's no pool

  // Generate an array of boolean flags representing the visual checkboxes
  // e.g. max 4, used 2 => [true, true, false, false]
  const boxes = Array.from({ length: max }, (_, index) => index < used);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(20,20,20,0.6)', borderRadius: '6px', border: '1px solid #333', marginBottom: '8px' }}>
      <span style={{ fontSize: '14px', color: '#cfaa5e', fontFamily: 'Cinzel, serif', fontWeight: 600 }}>{label}</span>
      <div style={{ display: 'flex', gap: '6px', cursor: 'pointer' }}>
        {boxes.map((isFilled, index) => (
          <div 
            key={index} 
            onClick={() => {
              if (isFilled) onRestore();
              else onExpend();
            }}
            style={{
              width: '18px',
              height: '18px',
              border: `2px solid ${isFilled ? '#8c1616' : '#555'}`,
              background: isFilled ? '#a12b2b' : 'transparent',
              borderRadius: '3px',
              transition: 'all 0.15s ease-in-out',
              boxShadow: isFilled ? '0 0 5px rgba(255, 50, 50, 0.4)' : 'none'
            }}
          />
        ))}
      </div>
    </div>
  );
}
