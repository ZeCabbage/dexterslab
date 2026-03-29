import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SCHEMA_VERSION = 1;

const SCHEMA_V1_SQL = `
  CREATE TABLE IF NOT EXISTS schema_version (
    version     INTEGER NOT NULL,
    applied_at  INTEGER NOT NULL,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    source TEXT NOT NULL,
    event_type TEXT NOT NULL,
    zone TEXT,
    duration_ms INTEGER,
    metadata TEXT,
    session_id TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS entities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    visit_count INTEGER DEFAULT 1,
    profile TEXT,
    label TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    observer_mode TEXT NOT NULL,
    summary TEXT
  );

  CREATE TABLE IF NOT EXISTS context_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    ttl_seconds INTEGER
  );
`;

const MIGRATIONS = {
  1: (db) => {
    db.exec(SCHEMA_V1_SQL);
  },
};

export class MemoryEngine {
  constructor() {
    const dbPath = process.env.MEMORY_DB_PATH || './data/dexterslab-memory.db';
    const retentionDays = parseInt(process.env.MEMORY_RETENTION_DAYS || '30', 10);
    
    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    
    // Integrity Rules
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this._initializeSchema();
    
    this.preparedInsertObservation = this.db.prepare(`
      INSERT INTO observations (timestamp, source, event_type, zone, duration_ms, metadata, session_id)
      VALUES (@queuedAt, @source, @eventType, @zone, @durationMs, @metadataStr, @sessionId)
    `);

    this.writeQueue = [];
    this.FLUSH_INTERVAL_MS = 500;
    this.MAX_QUEUE_SIZE = 500;
    this.totalFlushed = 0;
    this.lastFlushTime = Date.now();

    this.flushTimer = setInterval(() => this._flush(), this.FLUSH_INTERVAL_MS);
    this.flushTimer.unref();

    setTimeout(() => {
      this.pruneOldObservations(retentionDays);
      this.pruneTimer = setInterval(() => this.pruneOldObservations(retentionDays), 3600000);
      this.pruneTimer.unref();
    }, 250).unref();
    
    const stats = this.getStats();
    console.log('[MemoryEngine] Started successfully. DB Stats:', JSON.stringify(stats));
  }

  _initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version     INTEGER NOT NULL,
        applied_at  INTEGER NOT NULL,
        description TEXT
      )
    `);

    const row = this.db.prepare(
      `SELECT version FROM schema_version ORDER BY version DESC LIMIT 1`
    ).get();
    const currentVersion = row?.version ?? 0;

    if (currentVersion === SCHEMA_VERSION) {
      console.log(`[MemoryEngine] Schema up to date at version ${SCHEMA_VERSION}`);
      return;
    }

    if (currentVersion > SCHEMA_VERSION) {
      throw new Error(
        `[MemoryEngine] FATAL: Database schema version ${currentVersion} ` +
        `is newer than application version ${SCHEMA_VERSION}. ` +
        `Do not run old code against a migrated database.`
      );
    }

    console.log(
      `[MemoryEngine] Running schema migrations ` +
      `from v${currentVersion} to v${SCHEMA_VERSION}...`
    );

    for (let v = currentVersion + 1; v <= SCHEMA_VERSION; v++) {
      if (!MIGRATIONS[v]) {
        throw new Error(
          `[MemoryEngine] FATAL: No migration defined for version ${v}`
        );
      }

      console.log(`[MemoryEngine] Applying migration v${v}...`);
      
      const applyMigration = this.db.transaction(() => {
        MIGRATIONS[v](this.db);
        this.db.prepare(
          `INSERT INTO schema_version (version, applied_at, description) 
           VALUES (?, ?, ?)`
        ).run(v, Date.now(), `Migration to v${v}`);
      });

      applyMigration();
      console.log(`[MemoryEngine] Migration v${v} applied successfully`);
    }

    console.log(`[MemoryEngine] Schema migration complete`);
  }

  // ── Session Management ──

  startSession(mode) {
    const sessionId = crypto.randomUUID();
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, started_at, observer_mode)
      VALUES (?, ?, ?)
    `);
    stmt.run(sessionId, Date.now(), mode);
    return sessionId;
  }

  endSession(sessionId, summary = null) {
    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET ended_at = ?, summary = ?
      WHERE id = ?
    `);
    const summaryStr = summary ? JSON.stringify(summary) : null;
    stmt.run(Date.now(), summaryStr, sessionId);
  }

  // ── Recording Events ──

  queueObservation(params) {
    const { source, eventType, zone = null, durationMs = null, metadata = null, sessionId } = params;
    
    if (typeof source !== 'string' || source.trim() === '' || typeof eventType !== 'string' || eventType.trim() === '') {
      console.warn('[MemoryEngine] Invalid observation queue params, dropping.');
      return;
    }
    
    let metadataStr = null;
    if (metadata !== null) {
      try {
        metadataStr = JSON.stringify(metadata);
      } catch (e) {
        console.warn('[MemoryEngine] Failed to stringify metadata, dropping observation.');
        return;
      }
    }

    if (this.writeQueue.length >= this.MAX_QUEUE_SIZE) {
      console.warn(`[MemoryEngine] Write queue full (${this.MAX_QUEUE_SIZE} items). Dropping oldest observation.`);
      this.writeQueue.shift();
    }

    this.writeQueue.push({
      queuedAt: Date.now(),
      source,
      eventType,
      zone,
      durationMs,
      metadataStr,
      sessionId
    });
  }

  _flush() {
    if (this.writeQueue.length === 0) return;

    const batch = this.writeQueue.splice(0, this.writeQueue.length);
    
    try {
      const insertMany = this.db.transaction((items) => {
        for (const item of items) {
          // Strict coercion to SQLite-compatible types (Number, String, Null)
          const safeItem = {
            queuedAt: Number(item.queuedAt) || Date.now(),
            source: item.source != null ? (typeof item.source === 'object' ? JSON.stringify(item.source) : String(item.source)) : 'unknown',
            eventType: item.eventType != null ? (typeof item.eventType === 'object' ? JSON.stringify(item.eventType) : String(item.eventType)) : 'unknown',
            zone: item.zone != null ? (typeof item.zone === 'object' ? JSON.stringify(item.zone) : String(item.zone)) : null,
            durationMs: item.durationMs != null ? Number(item.durationMs) : null,
            metadataStr: item.metadataStr != null ? (typeof item.metadataStr === 'object' ? JSON.stringify(item.metadataStr) : String(item.metadataStr)) : null,
            sessionId: item.sessionId != null ? (typeof item.sessionId === 'object' ? JSON.stringify(item.sessionId) : String(item.sessionId)) : 'unknown'
          };
          this.preparedInsertObservation.run(safeItem);
        }
      });
      
      insertMany(batch);
      this.totalFlushed += batch.length;
      this.lastFlushTime = Date.now();
    } catch (err) {
      console.error(`[MemoryEngine] Batch write failed: ${err.message} (${batch.length} observations lost)`);
    }
  }

  /**
   * @deprecated Use queueObservation() for all hot-path calls.
   * Reserve recordObservationSync() ONLY for:
   *   - Startup/shutdown events that must persist before process exits
   *   - Security events that must not be lost (injection attempts)
   *   - Test code
   */
  recordObservationSync(params) {
    const { source, eventType, zone = null, durationMs = null, metadata = null, sessionId } = params;
    const stmt = this.db.prepare(`
      INSERT INTO observations (timestamp, source, event_type, zone, duration_ms, metadata, session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const metaStr = metadata ? JSON.stringify(metadata) : null;
    const info = stmt.run(Date.now(), source, eventType, zone, durationMs, metaStr, sessionId);
    return info.lastInsertRowid;
  }

  // ── Context State ──

  setContext(key, value, ttlSeconds = null) {
    const stmt = this.db.prepare(`
      INSERT INTO context_state (key, value, updated_at, ttl_seconds)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET 
        value = excluded.value, 
        updated_at = excluded.updated_at, 
        ttl_seconds = excluded.ttl_seconds
    `);
    stmt.run(key, JSON.stringify(value), Date.now(), ttlSeconds);
  }

  getContext(key) {
    const stmt = this.db.prepare('SELECT value, updated_at, ttl_seconds FROM context_state WHERE key = ?');
    const row = stmt.get(key);
    if (!row) return null;

    if (row.ttl_seconds !== null) {
      const ageSeconds = (Date.now() - row.updated_at) / 1000;
      if (ageSeconds > row.ttl_seconds) {
        this.clearContext(key);
        return null;
      }
    }
    return JSON.parse(row.value);
  }

  clearContext(key) {
    const stmt = this.db.prepare('DELETE FROM context_state WHERE key = ?');
    stmt.run(key);
  }

  // ── Entity Tracking ──

  recordEntityPresence(zone, sessionId) {
    const stmt = this.db.prepare(`
      INSERT INTO entities (first_seen, last_seen)
      VALUES (?, ?)
    `);
    const now = Date.now();
    const info = stmt.run(now, now);
    const entityId = info.lastInsertRowid.toString();
    
    this.queueObservation({
      source: 'memory_engine',
      eventType: 'entity_appeared',
      zone: zone,
      metadata: { entity_id: entityId },
      sessionId: sessionId
    });

    return entityId;
  }

  updateEntityLastSeen(entityId) {
    const stmt = this.db.prepare(`
      UPDATE entities 
      SET last_seen = ?, visit_count = visit_count + 1
      WHERE id = ?
    `);
    stmt.run(Date.now(), entityId);
  }

  getRecentEntities(limitMinutes) {
    const cutoff = Date.now() - (limitMinutes * 60 * 1000);
    const stmt = this.db.prepare('SELECT * FROM entities WHERE last_seen >= ? ORDER BY last_seen DESC');
    return stmt.all(cutoff).map(r => {
      let parsed = null;
      try { if (r.profile) parsed = JSON.parse(r.profile); } catch(e){}
      return { ...r, profile: parsed };
    });
  }

  labelEntity(entityId, label) {
    const stmt = this.db.prepare('UPDATE entities SET label = ? WHERE id = ?');
    stmt.run(label, entityId);
  }

  // ── Query Interface ──

  getRecentObservations(params) {
    const { source, eventType, zone, limitMinutes, limit = 100 } = params;
    let query = 'SELECT * FROM observations WHERE 1=1';
    const bindings = [];

    if (source) { query += ' AND source = ?'; bindings.push(source); }
    if (eventType) { query += ' AND event_type = ?'; bindings.push(eventType); }
    if (zone) { query += ' AND zone = ?'; bindings.push(zone); }
    if (limitMinutes) { 
      query += ' AND timestamp >= ?'; 
      bindings.push(Date.now() - (limitMinutes * 60 * 1000)); 
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    bindings.push(limit);

    const stmt = this.db.prepare(query);
    return stmt.all(...bindings).map(r => ({
      ...r,
      metadata: r.metadata ? JSON.parse(r.metadata) : null
    }));
  }

  getSessionSummary(sessionId) {
    const stmt = this.db.prepare('SELECT summary FROM sessions WHERE id = ?');
    const row = stmt.get(sessionId);
    if (!row || !row.summary) return null;
    return JSON.parse(row.summary);
  }

  // ── Maintenance ──

  pruneOldObservations(olderThanDays) {
    const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    const stmt = this.db.prepare('DELETE FROM observations WHERE timestamp < ?');
    const info = stmt.run(cutoff);
    if (info.changes > 0) {
      console.log(`[MemoryEngine] Pruned ${info.changes} old observations.`);
    }
    return info.changes;
  }

  getStats() {
    const observations = this.db.prepare('SELECT COUNT(*) as count FROM observations').get().count;
    const entities = this.db.prepare('SELECT COUNT(*) as count FROM entities').get().count;
    const sessions = this.db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
    
    let dbSizeBytes = 0;
    try {
      const stat = fs.statSync(this.db.name);
      dbSizeBytes = stat.size;
    } catch (e) { }

    const oldest = this.db.prepare('SELECT MIN(timestamp) as min_ts FROM observations').get().min_ts || 0;

    return {
      total_observations: observations,
      total_entities: entities,
      total_sessions: sessions,
      db_size_bytes: dbSizeBytes,
      oldest_record_timestamp: oldest
    };
  }

  getSchemaVersion() {
    const row = this.db.prepare(
      `SELECT version FROM schema_version ORDER BY version DESC LIMIT 1`
    ).get();
    return row?.version ?? 0;
  }
}

