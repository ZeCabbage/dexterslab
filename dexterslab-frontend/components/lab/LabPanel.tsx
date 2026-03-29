import React from 'react';

export function LabPanel({ 
  title, 
  children, 
  style 
}: { 
  title?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{
      padding: '2rem',
      backgroundColor: 'var(--bg-card)',
      border: 'var(--border-width) solid var(--border-color)',
      borderRadius: 'var(--border-radius)',
      boxShadow: 'var(--panel-shadow)',
      position: 'relative',
      ...style
    }}>
      {title && (
        <div style={{
          position: 'absolute',
          top: -10,
          left: 16,
          backgroundColor: 'var(--bg-primary)', /* Cut through the border */
          padding: '0 10px',
          color: 'var(--text-label)',
          fontSize: '11px',
          fontFamily: 'var(--font-header)',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
