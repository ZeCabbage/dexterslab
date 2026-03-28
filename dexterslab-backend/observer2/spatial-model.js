export class SpatialModel {
  constructor(width = 320, height = 240, configJson = null) {
    this.width = width;
    this.height = height;
    
    if (configJson) {
      try {
        this.zones = JSON.parse(configJson);
      } catch (err) {
        console.warn('Failed to parse SPATIAL_ZONE_CONFIG, falling back to defaults.');
      }
    }

    if (!this.zones) {
      const colWidth = Math.ceil(width / 3);
      const rowHeight = Math.ceil(height / 3);
      this.zones = [
        { name: 'TOP_LEFT', xMin: 0, xMax: colWidth, yMin: 0, yMax: rowHeight },
        { name: 'TOP_CENTER', xMin: colWidth, xMax: colWidth * 2, yMin: 0, yMax: rowHeight },
        { name: 'TOP_RIGHT', xMin: colWidth * 2, xMax: width, yMin: 0, yMax: rowHeight },
        { name: 'MID_LEFT', xMin: 0, xMax: colWidth, yMin: rowHeight, yMax: rowHeight * 2 },
        { name: 'CENTER', xMin: colWidth, xMax: colWidth * 2, yMin: rowHeight, yMax: rowHeight * 2 },
        { name: 'MID_RIGHT', xMin: colWidth * 2, xMax: width, yMin: rowHeight, yMax: rowHeight * 2 },
        { name: 'BOT_LEFT', xMin: 0, xMax: colWidth, yMin: rowHeight * 2, yMax: height },
        { name: 'BOT_CENTER', xMin: colWidth, xMax: colWidth * 2, yMin: rowHeight * 2, yMax: height },
        { name: 'BOT_RIGHT', xMin: colWidth * 2, xMax: width, yMin: rowHeight * 2, yMax: height },
      ];
    }
    
    this.occupancy = new Map();
    this.history = [];
  }

  coordinateToZone(x, y) {
    const cx = Math.max(0, Math.min(x, this.width - 1));
    const cy = Math.max(0, Math.min(y, this.height - 1));

    for (const zone of this.zones) {
      if (cx >= zone.xMin && cx < zone.xMax && cy >= zone.yMin && cy < zone.yMax) {
        return zone.name;
      }
    }
    return 'CENTER';
  }

  processMotionEvent(entities) {
    const now = Date.now();
    const currentZoneCounts = new Map();
    
    for (const ent of entities) {
      const cx = ent.x + (ent.w / 2);
      const cy = ent.y + (ent.h / 2);
      const zoneName = this.coordinateToZone(cx, cy);
      
      if (!currentZoneCounts.has(zoneName)) {
        currentZoneCounts.set(zoneName, { count: 0, centroids: [], bbs: [] });
      }
      
      const zData = currentZoneCounts.get(zoneName);
      zData.count += 1;
      zData.centroids.push({ x: cx, y: cy });
      zData.bbs.push(ent);
    }

    const events = [];

    // Process entered / present
    for (const [zoneName, data] of currentZoneCounts.entries()) {
      const centroid = data.centroids[0];
      const bounding_box = data.bbs[0];

      if (!this.occupancy.has(zoneName)) {
        this.occupancy.set(zoneName, { count: data.count, firstSeen: now, lastSeen: now });
        events.push({
          timestamp: now,
          type: 'entity_entered',
          zone: zoneName,
          entity_count: data.count,
          centroid,
          bounding_box,
          duration_ms: null
        });
      } else {
        const occ = this.occupancy.get(zoneName);
        occ.count = data.count;
        occ.lastSeen = now;
        events.push({
          timestamp: now,
          type: 'entity_present',
          zone: zoneName,
          entity_count: data.count,
          centroid,
          bounding_box,
          duration_ms: now - occ.firstSeen
        });
      }
    }

    // Process departed
    for (const [zoneName, occ] of this.occupancy.entries()) {
      if (!currentZoneCounts.has(zoneName)) {
        if (now - occ.lastSeen > 2000) {
          events.push({
            timestamp: now,
            type: 'entity_departed',
            zone: zoneName,
            entity_count: 0,
            centroid: null,
            bounding_box: null,
            duration_ms: occ.lastSeen - occ.firstSeen
          });
          this.occupancy.delete(zoneName);
        }
      }
    }

    const significantEvents = events.filter(e => e.type !== 'entity_present');
    this.history.push(...significantEvents);
    if (this.history.length > 1000) {
      this.history = this.history.slice(this.history.length - 1000);
    }

    return events;
  }

  getZoneHistory(zone, windowMs) {
    const cutoff = Date.now() - windowMs;
    return this.history.filter(e => e.zone === zone && e.timestamp >= cutoff);
  }

  getCurrentOccupancy() {
    const counts = {};
    for (const [zoneName, occ] of this.occupancy.entries()) {
      counts[zoneName] = occ.count;
    }
    return counts;
  }

  getAttentionZone() {
    const now = Date.now();
    let bestZone = null;
    let highestScore = -1;

    for (const [zoneName, occ] of this.occupancy.entries()) {
      if (now - occ.lastSeen > 5000) continue;
      
      const recencyScore = 5000 - (now - occ.lastSeen); 
      const score = recencyScore + (occ.count * 1000);

      if (score > highestScore) {
        highestScore = score;
        bestZone = zoneName;
      }
    }
    
    return bestZone;
  }
}
