import React from 'react';

export function LabHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header style={{
      marginBottom: '2rem',
      borderBottom: 'var(--border-width) solid var(--border-color)',
      paddingBottom: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }}>
      <h1 style={{
        fontFamily: 'var(--font-header)',
        fontSize: '2rem',
        color: 'var(--text-primary)',
        textShadow: '0 0 10px var(--border-color)', /* Subtle theme-aware glow */
        margin: 0,
        textTransform: 'uppercase'
      }}>
        {title}
      </h1>
      {subtitle && (
        <span style={{
          color: 'var(--text-secondary)',
          fontSize: '0.9rem',
          fontFamily: 'var(--font-main)',
        }}>
          {subtitle}
        </span>
      )}
    </header>
  );
}
