'use client';

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [heatmap, setHeatmap] = useState<any>(null);
  const [entities, setEntities] = useState<any[]>([]);
  const [observations, setObservations] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  
  const [obsFilter, setObsFilter] = useState({ source: '', eventType: '', zone: '', limit: 50 });
  const [convSearch, setConvSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const fetchInitial = async () => {
    try {
      const eRes = await fetch('/api/admin/entities');
      if (eRes.ok) setEntities(await eRes.json());
      
      const cRes = await fetch('/api/admin/conversation-log');
      if (cRes.ok) setConversations(await cRes.json());
      
      fetchObservations();
    } catch(e) {}
  };

  useEffect(() => {
    fetchInitial();

    const pollFast = setInterval(async () => {
      try {
        const hRes = await fetch('/api/admin/heatmap');
        if (hRes.ok) setHeatmap(await hRes.json());
        
        const sRes = await fetch('/api/admin/stats');
        if (sRes.ok) setStats(await sRes.json());
      } catch(e) {}
    }, 2000);
    
    return () => clearInterval(pollFast);
  }, []);

  const fetchObservations = async () => {
    try {
      const q = new URLSearchParams();
      if (obsFilter.source) q.append('source', obsFilter.source);
      if (obsFilter.eventType) q.append('eventType', obsFilter.eventType);
      if (obsFilter.zone) q.append('zone', obsFilter.zone);
      q.append('limit', obsFilter.limit.toString());
      
      const res = await fetch(`/api/admin/observations?${q}`);
      if (res.ok) setObservations(await res.json());
    } catch(e) {}
  };

  const handleLabelSubmit = async (entityId: string, label: string) => {
    await fetch('/api/admin/label-entity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityId, label })
    });
    fetchInitial();
  };

  const exportCSV = () => {
    const q = new URLSearchParams();
    if (obsFilter.source) q.append('source', obsFilter.source);
    if (obsFilter.eventType) q.append('eventType', obsFilter.eventType);
    window.location.href = `/api/admin/export-observations?${q}`;
  };

  // Pre-calculate heatmap intensity limits
  let heatMax = 1;
  if (heatmap?.heatmap) {
    heatMax = Math.max(1, ...Object.values(heatmap.heatmap) as number[]);
  }

  const renderHeatmapCell = (zoneId: string) => {
    const occ = heatmap?.currentOccupancy?.[zoneId] || 0;
    const count = heatmap?.heatmap?.[zoneId] || 0;
    const intensity = Math.min((count / heatMax) * 0.8, 0.8);
    const bg = occ > 0 ? '#ff0055' : `rgba(0, 255, 204, ${intensity})`;

    return (
      <div key={zoneId} className={styles.heatmapCell} style={{ backgroundColor: bg }}>
        <h4>{zoneId.replace('_', ' ')}</h4>
        <span>Occ: {occ}</span>
        <span>Today: {count}</span>
      </div>
    );
  };

  const zones = ['TOP_LEFT', 'TOP_CENTER', 'TOP_RIGHT', 'MID_LEFT', 'CENTER', 'MID_RIGHT', 'BOT_LEFT', 'BOT_CENTER', 'BOT_RIGHT'];

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>// OBSERVER MEMORY DASHBOARD //</h1>
      
      <div className={styles.grid}>
        <div className={styles.panel}>
          <h2>[ SYSTEM STATUS ]</h2>
          {stats ? (
            <div className={styles.sysdata}>
              <b>Session ID:</b> <span>{stats.sessionId}</span>
              <b>Session Duration:</b> <span>{stats.sessionDurationMin} minutes</span>
              <b>Current Mood:</b> <span>{stats.mood}</span>
              <b>DB Total Events:</b> <span>{stats.memory?.total_observations}</span>
              <b>Events/min:</b> <span>{stats.bus?.events_per_minute}</span>
            </div>
          ) : <span>Loading...</span>}
        </div>

        <div className={styles.panel}>
          <h2>[ SPATIAL HEATMAP ]</h2>
          <div className={styles.heatmapGrid}>
            {zones.map(renderHeatmapCell)}
          </div>
        </div>
      </div>

      <div className={styles.panel} style={{ marginBottom: '2rem' }}>
        <h2>[ ENTITY PROFILES ]</h2>
        <div className={styles.filterBar}>
            <select onChange={(e) => setEntityFilter(e.target.value)}>
               <option value="">All Patterns</option>
               <option value="resident">Resident</option>
               <option value="visitor">Visitor</option>
               <option value="passerby">Passerby</option>
            </select>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Pattern</th>
              <th>Visits</th>
              <th>Avg Duration</th>
              <th>Preferred Zones</th>
              <th>Label</th>
            </tr>
          </thead>
          <tbody>
            {entities.filter(e => !entityFilter || e.pattern_type === entityFilter).map(ent => (
              <tr key={ent.entity_id}>
                <td>{ent.entity_id.split('-')[0]}</td>
                <td>{ent.pattern_type}</td>
                <td>{ent.visit_count}</td>
                <td>{Math.round((ent.avg_duration_ms || 0)/1000)}s</td>
                <td>{(ent.preferred_zones || []).join(', ')}</td>
                <td>
                  <input 
                    className={styles.labelInput}
                    defaultValue={ent.label || ''}
                    placeholder="Set label..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLabelSubmit(ent.entity_id, e.currentTarget.value);
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.grid}>
        <div className={styles.panel}>
          <h2>[ RECENT OBSERVATIONS ]</h2>
          <div className={styles.filterBar}>
            <input placeholder="Source" onChange={e => setObsFilter({...obsFilter, source: e.target.value})} />
            <input placeholder="Event Type" onChange={e => setObsFilter({...obsFilter, eventType: e.target.value})} />
            <button className={styles.button} onClick={fetchObservations}>Filter</button>
            <button className={styles.button} onClick={exportCSV}>Export CSV</button>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Source</th>
                <th>Type</th>
                <th>Zone</th>
              </tr>
            </thead>
            <tbody>
              {observations.map(o => (
                <tr key={o.id}>
                  <td>{new Date(o.timestamp).toLocaleTimeString()}</td>
                  <td>{o.source}</td>
                  <td>{o.event_type}</td>
                  <td>{o.zone || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.panel}>
          <h2>[ CONVERSATION LOG ]</h2>
          <div className={styles.filterBar}>
             <input placeholder="Search transcripts..." onChange={e => setConvSearch(e.target.value.toLowerCase())} style={{ width: '100%' }} />
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {conversations
              .filter(c => c.text.toLowerCase().includes(convSearch))
              .map((c, i) => (
              <div key={i} className={`${styles.logEntry} ${styles[c.role]}`}>
                <span className={styles.logTime}>{new Date(c.timestamp).toLocaleTimeString()}</span>
                <strong>{c.role.toUpperCase()}:</strong> {c.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
