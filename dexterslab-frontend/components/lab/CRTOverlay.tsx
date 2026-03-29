import React from 'react';

export function CRTOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-main)',
      fontWeight: 'var(--font-weight-main, normal)' as React.CSSProperties['fontWeight'],
      letterSpacing: 'var(--letter-spacing)',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {children}
      <div className="crt-scanlines" />
    </div>
  );
}
