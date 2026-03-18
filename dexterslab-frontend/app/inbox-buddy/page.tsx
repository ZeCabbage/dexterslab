'use client';

/**
 * INBOX BUDDY v2.1 — Gmail Assistant Dashboard
 * Enhancements: confirmation modals, toast notifications,
 * scrollable panels, download recs, mass purge
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import Link from 'next/link';
import styles from './page.module.css';

// ── Types ──

interface CleanMetrics {
  timestamp: string;
  security: { scanned: number; flagged: number };
  declutter: { found: number; trashed: number };
  vip: { found: number; highlighted: number };
  archive: { found: number; archived: number };
  duration: number;
}

interface StoredMetrics {
  lastClean: CleanMetrics | null;
  history: CleanMetrics[];
  totalCleans: number;
}

interface VIPSuggestion {
  email: string;
  name: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  stats: { totalEmails: number; repliedTo: number; threads: number };
  status: 'pending' | 'approved' | 'dismissed';
}

interface DeepDiveRec {
  id: string;
  category: string;
  title: string;
  description: string;
  reason: string;
  impact: 'high' | 'medium' | 'low';
  action: string;
  messageIds: string[];
  senderEmail?: string;
  count: number;
  status: 'pending' | 'applied' | 'skipped' | 'dismissed';
}

interface PurgeCategory {
  id: string;
  label: string;
  description: string;
  icon: string;
  query: string;
  count: number;
  sampleSubjects: string[];
  sampleSenders: string[];
  messageIds: string[];
  selected?: boolean;
}

interface ConfirmAction {
  title: string;
  description: string;
  details: string[];
  actionLabel: string;
  dangerLevel: 'safe' | 'moderate' | 'destructive';
  onConfirm: () => Promise<void>;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const CATEGORY_INFO: Record<string, { icon: string; label: string }> = {
  subscriptions: { icon: '🗑️', label: 'SUBSCRIPTIONS' },
  large_attachments: { icon: '📎', label: 'LARGE FILES' },
  redundant_threads: { icon: '🔄', label: 'REDUNDANT' },
  worth_keeping: { icon: '📌', label: 'KEEP' },
  unsubscribe: { icon: '🚫', label: 'UNSUBSCRIBE' },
  risks: { icon: '⚠️', label: 'RISKS' },
  download: { icon: '💾', label: 'DOWNLOAD' },
};

// ── Component ──

export default function InboxBuddyPage() {
  const { data: session, status } = useSession();
  const [metrics, setMetrics] = useState<StoredMetrics | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [time, setTime] = useState('');
  const [scanY, setScanY] = useState(0);
  const [cleanPhase, setCleanPhase] = useState('');

  // VIP state
  const [vipSuggestions, setVipSuggestions] = useState<VIPSuggestion[]>([]);
  const [vipLoading, setVipLoading] = useState(false);
  const [approvedVips, setApprovedVips] = useState<any[]>([]);

  // Deep Dive state
  const [deepDiveRecs, setDeepDiveRecs] = useState<DeepDiveRec[]>([]);
  const [deepDiveSummary, setDeepDiveSummary] = useState('');
  const [deepDiveLoading, setDeepDiveLoading] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  // Mass Purge state
  const [purgeCategories, setPurgeCategories] = useState<PurgeCategory[]>([]);
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [purgingId, setPurgingId] = useState<string | null>(null);

  // Confirmation modal
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [activeTab, setActiveTab] = useState<'overview' | 'vip' | 'deepdive' | 'purge'>('overview');

  // ── Helpers ──

  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const showConfirm = useCallback((action: ConfirmAction) => {
    setConfirmAction(action);
  }, []);

  const executeConfirm = useCallback(async () => {
    if (!confirmAction) return;
    setConfirmLoading(true);
    try {
      await confirmAction.onConfirm();
    } finally {
      setConfirmLoading(false);
      setConfirmAction(null);
    }
  }, [confirmAction]);

  // Clock
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Scanline
  useEffect(() => {
    const id = setInterval(() => setScanY((y) => (y + 1.2) % 100), 50);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (status === 'authenticated') { fetchMetrics(); fetchVips(); }
  }, [status]);

  // ── Data fetching ──
  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/inbox-buddy/metrics');
      if (res.ok) setMetrics(await res.json());
    } catch {}
  }, []);

  const fetchVips = useCallback(async () => {
    try {
      const res = await fetch('/api/inbox-buddy/vips');
      if (res.ok) { const data = await res.json(); setApprovedVips(data.vips || []); }
    } catch {}
  }, []);

  // ── Actions with confirmation ──

  const runClean = useCallback(async () => {
    showConfirm({
      title: 'RUN INBOX CLEAN',
      description: 'This will perform a full inbox sweep:',
      details: [
        '🛡 Security scan for phishing emails',
        '🧹 Trash promotional emails older than 30 days',
        '⭐ Star & label emails from your VIPs',
        '📦 Archive un-starred emails older than 90 days',
      ],
      actionLabel: 'CONFIRM CLEAN',
      dangerLevel: 'moderate',
      onConfirm: async () => {
        setCleaning(true);
        setCleanPhase('INITIALIZING SWEEP...');
        const phases = ['SCANNING FOR THREATS...', 'DECLUTTERING PROMOTIONS...', 'HIGHLIGHTING VIPs...', 'ARCHIVING STALE MAIL...'];
        let idx = 0;
        const timer = setInterval(() => { idx = (idx + 1) % phases.length; setCleanPhase(phases[idx]); }, 1500);
        try {
          const res = await fetch('/api/inbox-buddy/clean', { method: 'POST' });
          const data = await res.json();
          clearInterval(timer);
          if (!res.ok) { setError(data.error); setCleanPhase(''); return; }
          const total = data.metrics.security.flagged + data.metrics.declutter.trashed + data.metrics.vip.highlighted + data.metrics.archive.archived;
          setCleanPhase('COMPLETE ✓');
          addToast(`Clean complete: ${total} actions in ${data.metrics.duration}ms`, 'success');
          setTimeout(() => setCleanPhase(''), 2000);
          await fetchMetrics();
        } catch (err: any) {
          clearInterval(timer);
          setError(err.message);
          setCleanPhase('');
        } finally { setCleaning(false); }
      },
    });
  }, [showConfirm, addToast, fetchMetrics]);

  const runVipDiscovery = useCallback(async () => {
    setVipLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/inbox-buddy/discover');
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setVipSuggestions(data.suggestions || []);
      addToast(`Found ${data.suggestions?.length || 0} VIP suggestions`, 'info');
    } catch (err: any) { setError(err.message); }
    finally { setVipLoading(false); }
  }, [addToast]);

  const handleVipAction = useCallback(async (email: string, name: string, reason: string, action: 'approve' | 'dismiss') => {
    const doIt = async () => {
      await fetch('/api/inbox-buddy/vips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, email, name, reason }),
      });
      setVipSuggestions((prev) => prev.map((v) => v.email === email ? { ...v, status: action === 'approve' ? 'approved' : 'dismissed' } : v));
      if (action === 'approve') {
        setApprovedVips((prev) => [...prev, { email, name, reason, addedAt: new Date().toISOString() }]);
        addToast(`✅ ${name} added as VIP`, 'success');
      } else {
        addToast(`${name} dismissed`, 'info');
      }
    };

    if (action === 'approve') {
      showConfirm({
        title: 'APPROVE VIP',
        description: `Add ${name} as a VIP contact?`,
        details: [`Email: ${email}`, `Reason: ${reason}`, 'Their emails will be auto-starred and labeled URGENT'],
        actionLabel: 'APPROVE',
        dangerLevel: 'safe',
        onConfirm: doIt,
      });
    } else {
      await doIt();
    }
  }, [showConfirm, addToast]);

  const runDeepDive = useCallback(async () => {
    setDeepDiveLoading(true);
    setError(null);
    setDeepDiveRecs([]);
    setDeepDiveSummary('');
    try {
      const res = await fetch('/api/inbox-buddy/deep-dive', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setDeepDiveRecs(data.recommendations || []);
      setDeepDiveSummary(data.summary || '');
      addToast(`Deep dive complete: ${data.recommendations?.length || 0} recommendations`, 'info');
    } catch (err: any) { setError(err.message); }
    finally { setDeepDiveLoading(false); }
  }, [addToast]);

  const applyRec = useCallback(async (rec: DeepDiveRec) => {
    const actionLabels: Record<string, string> = {
      trash: 'Move to Trash', archive: 'Archive', label: 'Apply KEEP label',
      review: 'Flag for Review', unsubscribe: 'Mark for Unsubscribe', keep: 'Keep as-is',
    };

    showConfirm({
      title: `APPLY: ${rec.title}`,
      description: `${actionLabels[rec.action] || rec.action} — ${rec.count} email${rec.count !== 1 ? 's' : ''}`,
      details: [
        `Category: ${rec.category.replace('_', ' ').toUpperCase()}`,
        `Action: ${rec.action.toUpperCase()}`,
        `Reason: ${rec.reason}`,
        rec.senderEmail ? `Sender: ${rec.senderEmail}` : '',
      ].filter(Boolean),
      actionLabel: 'APPLY',
      dangerLevel: rec.action === 'trash' ? 'destructive' : 'moderate',
      onConfirm: async () => {
        setApplyingId(rec.id);
        try {
          const res = await fetch('/api/inbox-buddy/deep-dive/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: rec.action, messageIds: rec.messageIds, senderEmail: rec.senderEmail }),
          });
          const data = await res.json();
          if (res.ok) {
            setDeepDiveRecs((prev) => prev.map((r) => r.id === rec.id ? { ...r, status: 'applied' } : r));
            addToast(`✅ Applied ${rec.action} to ${data.affected} emails`, 'success');
          } else { setError(data.error); }
        } catch (err: any) { setError(err.message); }
        finally { setApplyingId(null); }
      },
    });
  }, [showConfirm, addToast]);

  const skipRec = useCallback((id: string) => {
    setDeepDiveRecs((prev) => prev.map((r) => r.id === id ? { ...r, status: 'skipped' } : r));
    addToast('Recommendation skipped', 'info');
  }, [addToast]);

  const dismissRec = useCallback((id: string) => {
    setDeepDiveRecs((prev) => prev.map((r) => r.id === id ? { ...r, status: 'dismissed' } : r));
  }, []);

  // ── Mass Purge ──
  const scanPurge = useCallback(async () => {
    setPurgeLoading(true);
    setError(null);
    setPurgeCategories([]);
    try {
      const res = await fetch('/api/inbox-buddy/mass-purge?action=scan', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setPurgeCategories((data.categories || []).map((c: PurgeCategory) => ({ ...c, selected: false })));
      addToast(`Found ${data.totalPurgeable} purgeable emails across ${data.categories?.length || 0} categories`, 'info');
    } catch (err: any) { setError(err.message); }
    finally { setPurgeLoading(false); }
  }, [addToast]);

  const togglePurgeCategory = useCallback((id: string) => {
    setPurgeCategories((prev) => prev.map((c) => c.id === id ? { ...c, selected: !c.selected } : c));
  }, []);

  const executePurge = useCallback(async (cat: PurgeCategory, action: 'trash' | 'archive') => {
    showConfirm({
      title: `${action === 'trash' ? '🗑️ TRASH' : '📦 ARCHIVE'}: ${cat.label}`,
      description: `${action === 'trash' ? 'Move to trash' : 'Archive'} ${cat.count} emails`,
      details: [
        cat.description,
        `Sample senders: ${cat.sampleSenders.join(', ') || 'various'}`,
        `Sample subjects: ${cat.sampleSubjects.slice(0, 2).join('; ') || 'various'}`,
        '',
        action === 'trash' ? '⚠ Emails can be recovered from Trash within 30 days' : '📦 Emails will be archived (still searchable)',
      ],
      actionLabel: `${action.toUpperCase()} ${cat.count} EMAILS`,
      dangerLevel: action === 'trash' ? 'destructive' : 'moderate',
      onConfirm: async () => {
        setPurgingId(cat.id);
        try {
          const res = await fetch('/api/inbox-buddy/mass-purge?action=apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryId: cat.id, messageIds: cat.messageIds, action }),
          });
          const data = await res.json();
          if (res.ok) {
            setPurgeCategories((prev) => prev.filter((c) => c.id !== cat.id));
            addToast(`✅ ${action === 'trash' ? 'Trashed' : 'Archived'} ${data.affected} emails from "${cat.label}"`, 'success');
          } else { setError(data.error); }
        } catch (err: any) { setError(err.message); }
        finally { setPurgingId(null); }
      },
    });
  }, [showConfirm, addToast]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const last = metrics?.lastClean;
  const pendingRecs = deepDiveRecs.filter((r) => r.status === 'pending');
  const appliedRecs = deepDiveRecs.filter((r) => r.status === 'applied');
  const totalPurge = purgeCategories.reduce((a, c) => a + c.count, 0);

  return (
    <div className={styles.container}>
      <div className="crt-scanlines" />
      <div className={styles.scanline} style={{ top: `${scanY}%` }} />
      <div className={styles.gridOverlay} />

      {/* Toast Notifications */}
      <div className={styles.toastContainer}>
        {toasts.map((t) => (
          <div key={t.id} className={styles.toast} data-type={t.type}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className={styles.modalOverlay} onClick={() => !confirmLoading && setConfirmAction(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>{confirmAction.title}</h3>
            <p className={styles.modalDesc}>{confirmAction.description}</p>
            <ul className={styles.modalDetails}>
              {confirmAction.details.map((d, i) => d && <li key={i}>{d}</li>)}
            </ul>
            <div className={styles.modalActions}>
              <button
                className={`${styles.modalConfirmBtn} ${styles[`danger_${confirmAction.dangerLevel}`]}`}
                onClick={executeConfirm}
                disabled={confirmLoading}
              >
                {confirmLoading ? <><span className={styles.spinner} />PROCESSING...</> : confirmAction.actionLabel}
              </button>
              <button
                className={styles.modalCancelBtn}
                onClick={() => setConfirmAction(null)}
                disabled={confirmLoading}
              >CANCEL</button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.content}>
        {/* Header */}
        <header className={styles.header}>
          <Link href="/" className={styles.backLink}>← BACK TO LAB</Link>
          <div className={styles.titleRow}>
            <span className={styles.icon}>📬</span>
            <h1 className={styles.title}>INBOX BUDDY</h1>
          </div>
          <p className={styles.subtitle}>AI-POWERED GMAIL ASSISTANT</p>
          <div className={styles.headerMeta}>
            <span className={styles.clock}>{time}</span>
            <span className={styles.divider}>│</span>
            <span className={styles.cleanCount}>{metrics?.totalCleans ?? 0} CLEANS</span>
            <span className={styles.divider}>│</span>
            <span className={styles.cleanCount}>{approvedVips.length} VIPs</span>
          </div>
        </header>

        {/* Auth */}
        <div className={styles.authPanel}>
          {status === 'loading' ? (
            <div className={styles.authStatus}>
              <span className={styles.statusDot} data-status="loading" /><span>AUTHENTICATING...</span>
            </div>
          ) : status === 'authenticated' ? (
            <div className={styles.authStatus}>
              <span className={styles.statusDot} data-status="online" />
              <span className={styles.authEmail}>{session?.user?.email ?? 'CONNECTED'}</span>
              <button className={styles.authBtn} onClick={() => signOut()}>DISCONNECT</button>
            </div>
          ) : (
            <div className={styles.authStatus}>
              <span className={styles.statusDot} data-status="offline" /><span>NOT CONNECTED</span>
              <button className={styles.authBtnPrimary} onClick={() => signIn('google')}>CONNECT GMAIL</button>
            </div>
          )}
        </div>

        {error && (
          <div className={styles.errorBar}>
            <span>⚠ {error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* Tabs */}
        {status === 'authenticated' && (
          <>
            <div className={styles.tabBar}>
              {(['overview', 'vip', 'deepdive', 'purge'] as const).map((tab) => (
                <button key={tab} className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`} onClick={() => setActiveTab(tab)}>
                  {tab === 'overview' ? '🧹 OVERVIEW' : tab === 'vip' ? '⭐ VIP' : tab === 'deepdive' ? '🔬 DEEP DIVE' : '💣 MASS PURGE'}
                </button>
              ))}
            </div>

            <div className={styles.tabContent}>

              {/* ═══ OVERVIEW ═══ */}
              {activeTab === 'overview' && (
                <>
                  <div className={styles.metricsGrid}>
                    {[
                      { accent: 'red', icon: '🛡', label: 'SECURITY SWEEP', val: last?.security.flagged ?? 0, sub: `flagged / ${last?.security.scanned ?? 0} scanned` },
                      { accent: 'cyan', icon: '🧹', label: 'DECLUTTER', val: last?.declutter.trashed ?? 0, sub: `trashed / ${last?.declutter.found ?? 0} found` },
                      { accent: 'amber', icon: '⭐', label: 'VIP HIGHLIGHT', val: last?.vip.highlighted ?? 0, sub: `starred / ${last?.vip.found ?? 0} found` },
                      { accent: 'green', icon: '📦', label: 'AUTO-ARCHIVE', val: last?.archive.archived ?? 0, sub: `archived / ${last?.archive.found ?? 0} found` },
                    ].map((m) => (
                      <div key={m.label} className={styles.metricCard} data-accent={m.accent}>
                        <div className={styles.metricIcon}>{m.icon}</div>
                        <div className={styles.metricInfo}>
                          <span className={styles.metricLabel}>{m.label}</span>
                          <span className={styles.metricValue}>{m.val}</span>
                          <span className={styles.metricSub}>{m.sub}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={styles.actionBar}>
                    <button className={`${styles.cleanBtn} ${cleaning ? styles.cleaning : ''}`} onClick={runClean} disabled={cleaning}>
                      {cleaning ? <><span className={styles.spinner} />{cleanPhase}</> : '▶ RUN INBOX CLEAN'}
                    </button>
                    {last && <span className={styles.lastRun}>LAST RUN: {formatTime(last.timestamp)} ({last.duration}ms)</span>}
                  </div>
                  {metrics && metrics.history.length > 0 && (
                    <div className={styles.activityLog}>
                      <h3 className={styles.logTitle}>ACTIVITY LOG</h3>
                      <div className={styles.logEntries}>
                        {metrics.history.slice(0, 10).map((entry, i) => {
                          const total = entry.security.flagged + entry.declutter.trashed + entry.vip.highlighted + entry.archive.archived;
                          return (
                            <div key={entry.timestamp} className={styles.logEntry} style={{ animationDelay: `${i * 0.05}s` }}>
                              <span className={styles.logTime}>{formatTime(entry.timestamp)}</span>
                              <span className={styles.logBar}><span className={styles.logBarFill} style={{ width: `${Math.min(100, (total / 50) * 100)}%` }} /></span>
                              <span className={styles.logTotal}>{total} actions</span>
                              <span className={styles.logDuration}>{entry.duration}ms</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ═══ VIP DISCOVERY ═══ */}
              {activeTab === 'vip' && (
                <div className={styles.vipPanel}>
                  <div className={styles.panelHeader}>
                    <div>
                      <h2 className={styles.panelTitle}>⭐ VIP DISCOVERY</h2>
                      <p className={styles.panelDesc}>AI analyzes your inbox to find important contacts</p>
                    </div>
                    <button className={styles.cleanBtn} onClick={runVipDiscovery} disabled={vipLoading} style={{ width: 'auto', padding: '10px 20px' }}>
                      {vipLoading ? <><span className={styles.spinner} />ANALYZING...</> : '🔍 DISCOVER VIPs'}
                    </button>
                  </div>
                  {approvedVips.length > 0 && (
                    <div className={styles.vipApproved}>
                      <h3 className={styles.sectionLabel}>YOUR VIPs ({approvedVips.length})</h3>
                      <div className={styles.vipChips}>
                        {approvedVips.map((v: any) => <span key={v.email} className={styles.vipChip}>⭐ {v.name || v.email}</span>)}
                      </div>
                    </div>
                  )}
                  {vipSuggestions.length > 0 && (
                    <div className={styles.vipSuggestions}>
                      <h3 className={styles.sectionLabel}>SUGGESTED VIPs</h3>
                      {vipSuggestions.map((vip) => (
                        <div key={vip.email} className={`${styles.vipCard} ${vip.status !== 'pending' ? styles.vipCardDone : ''}`}>
                          <div className={styles.vipCardHeader}>
                            <div className={styles.vipCardInfo}>
                              <span className={styles.vipName}>{vip.name}</span>
                              <span className={styles.vipEmail}>{vip.email}</span>
                            </div>
                            <span className={styles.confidenceBadge} data-level={vip.confidence}>{vip.confidence.toUpperCase()}</span>
                          </div>
                          <p className={styles.vipReason}>{vip.reason}</p>
                          <div className={styles.vipStats}>
                            <span>{vip.stats.totalEmails} emails</span>
                            <span>{vip.stats.repliedTo} replied</span>
                            <span>{vip.stats.threads} threads</span>
                          </div>
                          {vip.status === 'pending' ? (
                            <div className={styles.vipActions}>
                              <button className={styles.approveBtn} onClick={() => handleVipAction(vip.email, vip.name, vip.reason, 'approve')}>✅ APPROVE</button>
                              <button className={styles.dismissBtn} onClick={() => handleVipAction(vip.email, vip.name, vip.reason, 'dismiss')}>✗ DISMISS</button>
                            </div>
                          ) : (
                            <div className={styles.vipStatusBadge} data-status={vip.status}>
                              {vip.status === 'approved' ? '✅ APPROVED' : '✗ DISMISSED'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {!vipLoading && vipSuggestions.length === 0 && approvedVips.length === 0 && (
                    <div className={styles.emptyState}><span>⭐</span><p>Click &quot;Discover VIPs&quot; to let AI analyze your inbox</p></div>
                  )}
                </div>
              )}

              {/* ═══ DEEP DIVE ═══ */}
              {activeTab === 'deepdive' && (
                <div className={styles.deepDivePanel}>
                  <div className={styles.panelHeader}>
                    <div>
                      <h2 className={styles.panelTitle}>🔬 DEEP DIVE ANALYSIS</h2>
                      <p className={styles.panelDesc}>AI audit — identifies docs to download, subscriptions to cancel, and more</p>
                    </div>
                    <button className={styles.cleanBtn} onClick={runDeepDive} disabled={deepDiveLoading} style={{ width: 'auto', padding: '10px 20px' }}>
                      {deepDiveLoading ? <><span className={styles.spinner} />ANALYZING...</> : '🔬 RUN DEEP DIVE'}
                    </button>
                  </div>
                  {deepDiveSummary && (
                    <div className={styles.deepDiveSummary}><span className={styles.summaryIcon}>🧠</span><p>{deepDiveSummary}</p></div>
                  )}
                  {deepDiveRecs.length > 0 && (
                    <div className={styles.recStats}>
                      <span>{pendingRecs.length} pending</span>
                      <span className={styles.divider}>│</span>
                      <span style={{ color: 'var(--color-green)' }}>{appliedRecs.length} applied</span>
                      <span className={styles.divider}>│</span>
                      <span>{deepDiveRecs.length} total</span>
                    </div>
                  )}
                  {deepDiveRecs.length > 0 && (
                    <div className={styles.recList}>
                      {deepDiveRecs.map((rec) => {
                        const cat = CATEGORY_INFO[rec.category] || { icon: '📋', label: rec.category.toUpperCase() };
                        return (
                          <div key={rec.id} className={`${styles.recCard} ${rec.status !== 'pending' ? styles.recCardDone : ''}`} data-impact={rec.impact}>
                            <div className={styles.recHeader}>
                              <span className={styles.recCat}>{cat.icon} {cat.label}</span>
                              <span className={styles.impactBadge} data-level={rec.impact}>{rec.impact.toUpperCase()}</span>
                            </div>
                            <h4 className={styles.recTitle}>{rec.title}</h4>
                            <p className={styles.recDesc}>{rec.description}</p>
                            <p className={styles.recReason}>💡 {rec.reason}</p>
                            <div className={styles.recMeta}>
                              <span>{rec.count} email{rec.count !== 1 ? 's' : ''}</span>
                              <span>Action: {rec.action.toUpperCase()}</span>
                            </div>
                            {rec.status === 'pending' ? (
                              <div className={styles.recActions}>
                                <button className={styles.approveBtn} onClick={() => applyRec(rec)} disabled={applyingId === rec.id}>
                                  {applyingId === rec.id ? <><span className={styles.spinner} />APPLYING...</> : '✅ APPLY'}
                                </button>
                                <button className={styles.skipBtn} onClick={() => skipRec(rec.id)}>⏭ SKIP</button>
                                <button className={styles.dismissBtn} onClick={() => dismissRec(rec.id)}>🗑 DISMISS</button>
                              </div>
                            ) : (
                              <div className={styles.recStatusBadge} data-status={rec.status}>
                                {rec.status === 'applied' ? '✅ APPLIED' : rec.status === 'skipped' ? '⏭ SKIPPED' : '🗑 DISMISSED'}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {!deepDiveLoading && deepDiveRecs.length === 0 && (
                    <div className={styles.emptyState}><span>🔬</span><p>Run a deep dive for AI-powered analysis with download recommendations</p></div>
                  )}
                </div>
              )}

              {/* ═══ MASS PURGE ═══ */}
              {activeTab === 'purge' && (
                <div className={styles.purgePanel}>
                  <div className={styles.panelHeader}>
                    <div>
                      <h2 className={styles.panelTitle}>💣 MASS PURGE</h2>
                      <p className={styles.panelDesc}>Historical scan — find and eliminate thousands of junk emails</p>
                    </div>
                    <button className={styles.cleanBtn} onClick={scanPurge} disabled={purgeLoading} style={{ width: 'auto', padding: '10px 20px' }}>
                      {purgeLoading ? <><span className={styles.spinner} />SCANNING HISTORY...</> : '🔍 SCAN FOR JUNK'}
                    </button>
                  </div>

                  {purgeCategories.length > 0 && (
                    <>
                      <div className={styles.purgeTotal}>
                        <span className={styles.purgeCount}>{totalPurge.toLocaleString()}</span>
                        <span className={styles.purgeLabel}>PURGEABLE EMAILS FOUND</span>
                      </div>

                      <div className={styles.purgeList}>
                        {purgeCategories.map((cat) => (
                          <div key={cat.id} className={styles.purgeCard}>
                            <div className={styles.purgeCardHeader}>
                              <span className={styles.purgeIcon}>{cat.icon}</span>
                              <div className={styles.purgeCardInfo}>
                                <span className={styles.purgeCardTitle}>{cat.label}</span>
                                <span className={styles.purgeCardDesc}>{cat.description}</span>
                              </div>
                              <span className={styles.purgeCardCount}>{cat.count.toLocaleString()}</span>
                            </div>

                            {cat.sampleSenders.length > 0 && (
                              <div className={styles.purgeSamples}>
                                <span className={styles.sampleLabel}>SENDERS:</span>
                                <span>{cat.sampleSenders.join(', ')}</span>
                              </div>
                            )}
                            {cat.sampleSubjects.length > 0 && (
                              <div className={styles.purgeSamples}>
                                <span className={styles.sampleLabel}>SUBJECTS:</span>
                                <span>{cat.sampleSubjects.join(' · ')}</span>
                              </div>
                            )}

                            <div className={styles.purgeActions}>
                              <button
                                className={styles.purgeTrashBtn}
                                onClick={() => executePurge(cat, 'trash')}
                                disabled={purgingId === cat.id}
                              >
                                {purgingId === cat.id ? <><span className={styles.spinner} /></> : '🗑️'} TRASH ALL
                              </button>
                              <button
                                className={styles.purgeArchiveBtn}
                                onClick={() => executePurge(cat, 'archive')}
                                disabled={purgingId === cat.id}
                              >📦 ARCHIVE ALL</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {!purgeLoading && purgeCategories.length === 0 && (
                    <div className={styles.emptyState}>
                      <span>💣</span>
                      <p>Scan your entire inbox history to find junk, old subscriptions, notifications, and emails you don&apos;t need</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {status === 'unauthenticated' && (
          <div className={styles.placeholder}>
            <span className={styles.placeholderIcon}>📬</span>
            <h2>CONNECT YOUR GMAIL</h2>
            <p>Sign in with Google to enable AI-powered inbox management.</p>
            <button className={styles.cleanBtn} onClick={() => signIn('google')}>CONNECT GMAIL ACCOUNT</button>
          </div>
        )}

        <footer className={styles.footer}>
          <span>INBOX BUDDY v2.1</span>
          <span className={styles.divider}>│</span>
          <span>GEMINI AI</span>
          <span className={styles.divider}>│</span>
          <span>EXPERIMENT/INBOX-BUDDY</span>
        </footer>
      </div>
    </div>
  );
}
