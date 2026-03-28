'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (res.status === 200) {
        router.push('/admin');
      } else if (res.status === 401) {
        setError('Invalid token');
      } else if (res.status === 429) {
        setError('Too many attempts');
      } else {
        setError('Authentication error');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#000', color: '#0f0', fontFamily: 'monospace' }}>
      <form onSubmit={handleSubmit} style={{ border: '1px solid #0f0', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2>Admin Authentication</h2>
        <input 
          type="password" 
          value={token} 
          onChange={(e) => setToken(e.target.value)} 
          placeholder="Enter Secret Token"
          style={{ padding: '0.5rem', backgroundColor: '#111', color: '#0f0', border: '1px solid #0f0' }}
        />
        <button type="submit" style={{ padding: '0.5rem', backgroundColor: '#0f0', color: '#000', cursor: 'pointer', fontWeight: 'bold' }}>
          LOGIN
        </button>
        {error && <div style={{ color: 'red', marginTop: '1rem' }}>{error}</div>}
      </form>
    </div>
  );
}
