import crypto from 'crypto';

const CONFIG = {
  residentMinVisits: parseInt(process.env.ENTITY_RESIDENT_MIN_VISITS) || 10,
  residentMinAvgDurationSeconds: parseInt(process.env.ENTITY_RESIDENT_MIN_AVG_DURATION_SECONDS) || 300,
  visitorMinVisits: parseInt(process.env.ENTITY_VISITOR_MIN_VISITS) || 2,
  visitorMinAvgDurationSeconds: parseInt(process.env.ENTITY_VISITOR_MIN_AVG_DURATION_SECONDS) || 60,
  passerbyMaxDurationSeconds: parseInt(process.env.ENTITY_PASSERBY_MAX_DURATION_SECONDS) || 30,
  unknownMaxVisits: parseInt(process.env.ENTITY_UNKNOWN_MAX_VISITS) || 2,
};

export class EntityTracker {
  constructor(memoryEngine, contextBus) {
    this.memory = memoryEngine;
    this.bus = contextBus;
    
    this.activeBlobs = new Map();

    if (CONFIG.visitorMinVisits >= CONFIG.residentMinVisits) {
      console.warn(
        '[EntityTracker] WARNING: ENTITY_VISITOR_MIN_VISITS ' +
        `(${CONFIG.visitorMinVisits}) >= ` +
        `ENTITY_RESIDENT_MIN_VISITS (${CONFIG.residentMinVisits}). ` +
        'All residents will be classified as visitors. ' +
        'Check your .env configuration.'
      );
    }

    if (CONFIG.passerbyMaxDurationSeconds >= CONFIG.visitorMinAvgDurationSeconds) {
      console.warn(
        '[EntityTracker] WARNING: ENTITY_PASSERBY_MAX_DURATION_SECONDS ' +
        `(${CONFIG.passerbyMaxDurationSeconds}) >= ` +
        `ENTITY_VISITOR_MIN_AVG_DURATION_SECONDS (${CONFIG.visitorMinAvgDurationSeconds}). ` +
        'Classification boundary overlap detected.'
      );
    }
  }

  _generateId() {
    return crypto.randomUUID();
  }

  onPresenceEvent(event) {
    if (!this.memory) return;
    
    const now = event.timestamp || Date.now();
    const zone = event.zone;

    if (event.type === 'entity_entered') {
      const entityId = this._matchOrCreateEntity(zone, now);
      
      this.activeBlobs.set(zone, {
        entityId,
        startTime: now,
        lastActivity: now,
        sustainedFired: false
      });

      this.memory.recordEntityPresence(entityId, { zone, timestamp: now });
      
      const profile = this.getEntityProfile(entityId) || {};
      const familiar = (profile.visit_count > 2 || !!profile.label);

      if (this.bus && familiar) {
        this.bus.publish('presence.detected', {
          entity_id: entityId,
          label: profile.label || null,
          zone: zone,
          familiar: true
        });
      }

    } else if (event.type === 'entity_present') {
      const blob = this.activeBlobs.get(zone);
      if (blob) {
        blob.lastActivity = now;
        
        const duration = now - blob.startTime;
        if (duration > 30000 && !blob.sustainedFired) {
          blob.sustainedFired = true;
          const classification = this.classifyPattern(blob.entityId);
          
          if (this.bus) {
            this.bus.publish('presence.sustained', {
              entity_id: blob.entityId,
              pattern_type: classification.type,
              visit_count: (this.getEntityProfile(blob.entityId) || {}).visit_count || 1,
              zone: zone
            });
          }
        }
      }

    } else if (event.type === 'entity_departed') {
      const blob = this.activeBlobs.get(zone);
      if (blob) {
        // Update historical behavioral data
        const duration = event.duration_ms || (now - blob.startTime);
        this._updateEntityProfileStats(blob.entityId, zone, now, duration);
        this.memory.updateEntityLastSeen(blob.entityId);
        this.activeBlobs.delete(zone);
      }
    }
  }

  _updateEntityProfileStats(entityId, zone, timestamp, duration) {
    try {
      const row = this.memory.db.prepare('SELECT * FROM entities WHERE id = ?').get(entityId);
      if (!row) return;

      const profile = JSON.parse(row.profile || '{}');
      const totalVisits = row.visit_count || 1;

      // Update avg duration
      const prevTotal = (profile.avg_duration_ms || 0) * Math.max(1, totalVisits - 1);
      profile.avg_duration_ms = Math.round((prevTotal + duration) / totalVisits);

      // Update preferred zones
      const zones = profile.preferred_zones || [];
      if (!zones.includes(zone)) {
        zones.unshift(zone);
        profile.preferred_zones = zones.slice(0, 3); // Keep top 3 recent
      }

      // Update typical hours
      const hour = new Date(timestamp).getHours();
      const hours = profile.typical_hours || [];
      if (!hours.includes(hour)) {
        hours.push(hour);
        profile.typical_hours = hours.sort();
      }

      this.memory.db.prepare('UPDATE entities SET profile = ? WHERE id = ?')
        .run(JSON.stringify(profile), entityId);
    } catch(e) {
      console.error('[EntityTracker] Failed to update stats:', e.message);
    }
  }

  _matchOrCreateEntity(zone, currentTimestamp) {
    const recentEntities = this.memory.getRecentEntities(20) || [];
    const currentHour = new Date(currentTimestamp).getHours();
    
    let bestMatch = null;
    let highestScore = -1;

    for (const ent of recentEntities) {
       let score = 0;
       
       let activeNow = false;
       for (const existingBlob of this.activeBlobs.values()) {
         if (existingBlob.entityId === ent.id) activeNow = true;
       }
       if (activeNow) continue; // Deny duplicates in the same frame

       let profile = {};
       try { profile = JSON.parse(ent.profile || '{}'); } catch(e) {}
       
       if (profile.preferred_zones && profile.preferred_zones.includes(zone)) {
         score += 2;
       }
       if (profile.typical_hours && profile.typical_hours.includes(currentHour)) {
         score += 1;
       }

       const timeSinceLastSeen = currentTimestamp - ent.last_seen;
       if (timeSinceLastSeen < 1000 * 60 * 60) {
          score += 5; // Recently seen 
       } else if (timeSinceLastSeen < 1000 * 60 * 60 * 24) {
          score += 2; // Seen today
       }

       if (score > highestScore && score >= 2) {
         highestScore = score;
         bestMatch = ent.id;
       }
    }

    return bestMatch || this._generateId();
  }

  getCurrentEntities() {
    return Array.from(this.activeBlobs.values()).map(b => {
      const profile = this.getEntityProfile(b.entityId);
      const zone = Array.from(this.activeBlobs.keys()).find(k => this.activeBlobs.get(k) === b);
      return {
        entity_id: b.entityId,
        zone: zone,
        duration_ms: Date.now() - b.startTime,
        profile: profile
      };
    });
  }

  getEntityProfile(entityId) {
    if (!this.memory) return null;
    try {
      const row = this.memory.db.prepare('SELECT * FROM entities WHERE id = ?').get(entityId);
      if (!row) return null;
      
      const parsed = JSON.parse(row.profile || '{}');
      
      const classification = this.classifyPattern(entityId, row, parsed);
      
      return {
        entity_id: row.id,
        label: row.label,
        visit_count: row.visit_count,
        avg_duration_ms: parsed.avg_duration_ms || 0,
        preferred_zones: parsed.preferred_zones || [],
        typical_hours: parsed.typical_hours || [],
        interaction_rate: parsed.interaction_rate || 0,
        first_seen: row.first_seen,
        last_seen: row.last_seen,
        pattern_type: classification.type,
        classificationReason: classification.reason
      };
    } catch(e) {
      return null;
    }
  }

  classifyPattern(entityId, row = null, parsed = null) {
    const unknownClassification = {
      type: 'unknown',
      reason: { rule: 'Missing or malformed data records' }
    };

    if (!this.memory) return unknownClassification;
    
    if (!row) {
      try {
        row = this.memory.db.prepare('SELECT * FROM entities WHERE id = ?').get(entityId);
        if (!row) return unknownClassification;
        parsed = JSON.parse(row.profile || '{}');
      } catch(e) { return unknownClassification; }
    }

    const { visit_count } = row;
    const avg_duration = parsed.avg_duration_ms || 0;
    const avg_duration_sec = avg_duration / 1000;
    const { interaction_rate = 0 } = parsed;

    if (visit_count <= CONFIG.unknownMaxVisits) {
      return {
        type: 'unknown',
        reason: {
          visits: visit_count,
          rule: `visits <= unknownMaxVisits`,
          thresholdsApplied: { unknownMaxVisits: CONFIG.unknownMaxVisits }
        }
      };
    }

    if (visit_count >= CONFIG.residentMinVisits && avg_duration_sec >= CONFIG.residentMinAvgDurationSeconds) {
      return {
        type: 'resident',
        reason: {
          visits: visit_count,
          avgDurationSeconds: avg_duration_sec,
          rule: 'visits >= residentMinVisits && avgDuration >= residentMinAvgDurationSeconds',
          thresholdsApplied: {
            residentMinVisits: CONFIG.residentMinVisits,
            residentMinAvgDurationSeconds: CONFIG.residentMinAvgDurationSeconds
          }
        }
      };
    } else if (visit_count >= CONFIG.visitorMinVisits && avg_duration_sec >= CONFIG.visitorMinAvgDurationSeconds) {
      return {
        type: 'visitor',
        reason: {
          visits: visit_count,
          avgDurationSeconds: avg_duration_sec,
          rule: 'visits >= visitorMinVisits && avgDuration >= visitorMinAvgDurationSeconds',
          thresholdsApplied: {
            visitorMinVisits: CONFIG.visitorMinVisits,
            visitorMinAvgDurationSeconds: CONFIG.visitorMinAvgDurationSeconds
          }
        }
      };
    } else if (avg_duration_sec <= CONFIG.passerbyMaxDurationSeconds && interaction_rate < 0.2) {
      return {
        type: 'passerby',
        reason: {
          avgDurationSeconds: avg_duration_sec,
          interactionRate: interaction_rate,
          rule: 'avgDuration <= passerbyMaxDurationSeconds && interactionRate < 0.2',
          thresholdsApplied: {
            passerbyMaxDurationSeconds: CONFIG.passerbyMaxDurationSeconds
          }
        }
      };
    }

    return {
      type: 'unknown',
      reason: {
        visits: visit_count,
        avgDurationSeconds: avg_duration_sec,
        rule: 'Fell through pattern classifier ranges'
      }
    };
  }

  onVoiceInteraction(transcript) {
    if (!this.memory) return;
    
    for (const blob of this.activeBlobs.values()) {
      try {
        const row = this.memory.db.prepare('SELECT * FROM entities WHERE id = ?').get(blob.entityId);
        if (row) {
          let parsed = JSON.parse(row.profile || '{}');
          let interactions = (parsed.interaction_count || 0) + 1;
          parsed.interaction_count = interactions;
          
          let rate = interactions / Math.max(1, row.visit_count);
          parsed.interaction_rate = Math.min(1.0, rate);
          
          this.memory.db.prepare('UPDATE entities SET profile = ? WHERE id = ?')
            .run(JSON.stringify(parsed), blob.entityId);
        }
      } catch(e) {}
    }
  }

  getGreetingContext() {
    const active = this.getCurrentEntities();
    
    let patternSummary = "unknown presence";
    let suggestedTone = "neutral";
    const knownEntities = [];

    if (active.length > 0) {
      const profiles = active.map(a => a.profile).filter(Boolean);
      
      for (const profile of profiles) {
        if (profile.label) {
          knownEntities.push(profile);
        }
      }

      const types = profiles.map(p => p.pattern_type);
      if (types.includes('resident')) {
        patternSummary = "familiar presence, likely returning resident";
        suggestedTone = "familiar";
      } else if (types.includes('visitor')) {
        patternSummary = "returning visitor";
        suggestedTone = "neutral";
      } else if (types.every(t => t === 'passerby')) {
        patternSummary = "brief passerby";
        suggestedTone = "brief";
      } else {
        patternSummary = "new or unknown presence";
      }
    }

    return {
      entity_count: active.length,
      known_entities: knownEntities,
      pattern_summary: patternSummary,
      suggested_tone: suggestedTone
    };
  }
}
