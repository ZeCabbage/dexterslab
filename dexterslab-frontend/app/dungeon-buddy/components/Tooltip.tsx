'use client';

import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

export default function Tooltip({ content, children }: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Measure and set portal coords below the button
  const toggleTooltip = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const vx = window.innerWidth;
      const proposedX = rect.left + rect.width / 2;
      
      // Keep it completely visible on screen
      setCoords({
        x: Math.max(160, Math.min(proposedX, vx - 160)), // 300px wide tooltip -> 150px half width + 10px margin
        y: rect.bottom + 8,
      });
    }
    setIsOpen(!isOpen);
  };

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const close = () => setIsOpen(false);
    window.addEventListener('click', close);
    // Also attach to scroll so it hides neatly if you walk away
    window.addEventListener('scroll', close, true);
    
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [isOpen]);

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: '100%' }}>
      {children}
      <button 
        ref={triggerRef}
        onClick={toggleTooltip}
        onMouseEnter={toggleTooltip}
        onMouseLeave={() => setIsOpen(false)}
        style={{
          background: 'rgba(180, 150, 79, 0.15)', border: '1px solid rgba(180, 150, 79, 0.5)',
          color: '#cfaa5e', fontSize: '10px', width: '18px', height: '18px', 
          borderRadius: '50%', cursor: 'pointer', display: 'inline-flex', 
          alignItems: 'center', justifyContent: 'center', marginLeft: '6px',
          flexShrink: 0,
          fontWeight: 'bold', fontFamily: 'Inter, sans-serif',
          boxShadow: isOpen ? '0 0 8px rgba(180, 150, 79, 0.4)' : 'none',
          transition: 'all 0.2s ease'
        }}
        title="View Details"
      >
        i
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div 
          onClick={(e) => e.stopPropagation()} // Prevent closing if you try to select tooltip text
          style={{
            position: 'fixed',
            left: coords.x,
            top: coords.y,
            transform: 'translateX(-50%)',
            background: '#111113',
            border: '1px solid #b4964f',
            boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
            padding: '16px', borderRadius: '8px',
            width: '300px', zIndex: 999999,
            color: '#d4d0c8', fontFamily: 'Inter, sans-serif',
            fontSize: '13px', lineHeight: '1.4',
            pointerEvents: 'none' // Ensures mouse leave fires cleanly from the button
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </span>
  );
}
