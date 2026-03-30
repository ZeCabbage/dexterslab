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

      <div className={styles.notesSection}>
        <h3 className={styles.sectionHeading}>Session Notes</h3>
        <textarea className={styles.notesTextarea} value={char.notes || ''} onChange={e => updateField('notes', e.target.value)} placeholder="Write about your adventures, campaign events, key NPCs..." />
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
