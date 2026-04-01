'use client';

import { useCharacterStore } from '../lib/store';
import styles from '../[id]/page.module.css';

export default function LogbookTab() {
  const { char, updateField } = useCharacterStore();

  if (!char) return null;

  const undoLog = (logId: string) => {
    const entry = char.logbook?.find(l => l.id === logId);
    if (!entry?.previousState) return;
    
    // simple undo for level ups (Phase 1, will enhance later)
    updateField('level', entry.previousState.level);
    updateField('maxHp', entry.previousState.maxHp);
    updateField('currentHp', entry.previousState.currentHp);
    
    updateField('logbook', char.logbook.filter(l => l.id !== logId));
  };

  return (
    <div className={styles.logbookTab}>
      <h2 className={styles.tabTitle}>Adventurer&apos;s Logbook</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div className={styles.notesSection} style={{ marginBottom: 0 }}>
          <h3 className={styles.sectionHeading} style={{ marginTop: 0 }}>Session Notes</h3>
          <textarea className={styles.notesTextarea} style={{ minHeight: '180px' }} value={char.notes || ''} onChange={e => updateField('notes', e.target.value)} placeholder="Write about your adventures and campaign events..." />
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className={styles.notesSection} style={{ marginBottom: 0 }}>
            <h3 className={styles.sectionHeading} style={{ marginTop: 0, fontSize: '0.9rem' }}>Active Quests</h3>
            <textarea className={styles.notesTextarea} style={{ minHeight: '80px', fontSize: '0.8rem' }} value={char.quests || ''} onChange={e => updateField('quests', e.target.value)} placeholder="Track your active objectives..." />
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
             <div className={styles.notesSection} style={{ flex: 1, marginBottom: 0 }}>
               <h3 className={styles.sectionHeading} style={{ marginTop: 0, fontSize: '0.8rem' }}>Key People / NPCs</h3>
               <textarea className={styles.notesTextarea} style={{ minHeight: '80px', fontSize: '0.8rem' }} value={char.people || ''} onChange={e => updateField('people', e.target.value)} placeholder="Allies, villains, patrons..." />
             </div>
             <div className={styles.notesSection} style={{ flex: 1, marginBottom: 0 }}>
               <h3 className={styles.sectionHeading} style={{ marginTop: 0, fontSize: '0.8rem' }}>Locations / POIs</h3>
               <textarea className={styles.notesTextarea} style={{ minHeight: '80px', fontSize: '0.8rem' }} value={char.places || ''} onChange={e => updateField('places', e.target.value)} placeholder="Dungeons, towns, taverns..." />
             </div>
          </div>
        </div>
      </div>

      <h3 className={styles.sectionHeading}>History</h3>
      {(!char.logbook || char.logbook.length === 0) ? (
        <p className={styles.emptyText}>No events recorded yet.</p>
      ) : (
        <div className={styles.logTimeline}>
          {char.logbook.map(log => (
            <div key={log.id} className={styles.logEntry}>
              <div className={styles.logDot} />
              <div className={styles.logContent}>
                <div className={styles.logTime}>{new Date(log.timestamp).toLocaleString()}</div>
                <div className={styles.logDesc}>{log.description}</div>
                {log.type === 'level_up' && <button className={styles.btnUndo} onClick={() => undoLog(log.id)}>↶ Undo</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
