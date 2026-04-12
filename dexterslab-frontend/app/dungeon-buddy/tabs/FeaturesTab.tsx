'use client';

import { useCharacterStore } from '../lib/store';
import styles from '../[id]/page.module.css';
import { useMemo } from 'react';
import { resolveModifiers } from '../lib/resolve-modifiers';

export default function FeaturesTab() {
  const { char } = useCharacterStore();

  if (!char) return null;

  const resolved = useMemo(() => resolveModifiers(char), [char]);

  // Group features by source
  const featureGroups = useMemo(() => {
    const groups: Record<string, typeof char.features> = {};
    for (const f of (char.features || [])) {
      const src = f.source || char.class || 'Unknown';
      if (!groups[src]) groups[src] = [];
      groups[src].push(f);
    }
    return groups;
  }, [char.features, char.class]);

  // Determine modifier badge type
  const getModBadges = (f: (typeof char.features)[0]) => {
    if (!f.modifiers || f.modifiers.length === 0) return [];
    return f.modifiers.map(m => {
      switch (m.type) {
        case 'add_resource': return { label: 'Resource', color: '#7cc' };
        case 'grant_proficiency': return { label: 'Proficiency', color: '#8b6' };
        case 'grant_spells_always_prepared': return { label: 'Spells', color: '#b9a' };
        case 'grant_cantrip': return { label: 'Cantrip', color: '#b9a' };
        case 'add_conditional_damage': return { label: 'Damage', color: '#e83' };
        case 'add_damage_ability': return { label: '+Dmg', color: '#e83' };
        case 'grant_extra_attack': return { label: 'Extra Attack', color: '#c55' };
        case 'expand_crit_range': return { label: 'Crit Range', color: '#e55' };
        case 'grant_resistance': return { label: 'Resistance', color: '#58d' };
        case 'grant_immunity': return { label: 'Immunity', color: '#dd8' };
        case 'grant_extra_hp': return { label: '+HP', color: '#5c5' };
        case 'grant_third_caster': return { label: 'Spellcasting', color: '#b9a' };
        case 'metamagic_option': return { label: 'Metamagic', color: '#b9a' };
        case 'maneuver_option': return { label: 'Maneuver', color: '#7cc' };
        case 'passive': return { label: 'Passive', color: '#888' };
        default: return { label: m.type, color: '#666' };
      }
    });
  };

  return (
    <div className={styles.featuresTab}>
      <h2 className={styles.tabTitle}>Features & Traits</h2>

      {(char.traits || []).length > 0 && (
        <div className={styles.featureSection}>
          <h3 className={styles.sectionHeading}>Racial Traits</h3>
          <ul className={styles.featureList}>
            {char.traits.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}

      {/* Grouped Class / Subclass Features with Modifier Badges */}
      {Object.entries(featureGroups).map(([source, features]) => (
        <div key={source} className={styles.featureSection}>
          <h3 className={styles.sectionHeading} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {source}
            <span style={{ fontSize: '11px', color: '#666', fontFamily: 'Inter, sans-serif', fontWeight: 'normal' }}>
              ({features.length} feature{features.length !== 1 ? 's' : ''})
            </span>
          </h3>
          {features.map((f, i) => {
            const badges = getModBadges(f);
            return (
              <div key={i} className={styles.featureCard} style={{ position: 'relative' }}>
                <div className={styles.featureCardHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div>
                    <span className={styles.featureName}>{f.name}</span>
                    {f.level && (
                      <span style={{ fontSize: '10px', color: '#666', marginLeft: '8px' }}>Lv.{f.level}</span>
                    )}
                  </div>
                  {badges.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', flexShrink: 0 }}>
                      {badges.filter((b, idx, arr) => arr.findIndex(x => x.label === b.label) === idx).map((b, bi) => (
                        <span key={bi} style={{
                          padding: '2px 6px', borderRadius: '3px', fontSize: '9px', fontWeight: 'bold',
                          background: `${b.color}22`, color: b.color, border: `1px solid ${b.color}44`,
                          textTransform: 'uppercase', letterSpacing: '0.5px'
                        }}>{b.label}</span>
                      ))}
                    </div>
                  )}
                </div>
                <p className={styles.featureDesc}>{f.description}</p>
              </div>
            );
          })}
        </div>
      ))}

      {/* Resolved Proficiency Summary */}
      <div className={styles.featureSection}>
        <h3 className={styles.sectionHeading}>Proficiencies</h3>
        <div className={styles.profList}>
          {(char.armorProficiencies || []).length > 0 && <div><strong>Armor:</strong> {char.armorProficiencies.join(', ')}</div>}
          {(char.weaponProficiencies || []).length > 0 && <div><strong>Weapons:</strong> {char.weaponProficiencies.join(', ')}</div>}
          {(char.languages || []).length > 0 && <div><strong>Languages:</strong> {char.languages.join(', ')}</div>}
          {resolved.grantedToolProficiencies.length > 0 && <div><strong>Tools:</strong> {resolved.grantedToolProficiencies.join(', ')}</div>}
          {resolved.grantedSaveProficiencies.length > 0 && <div><strong>Extra Save Prof:</strong> {resolved.grantedSaveProficiencies.join(', ')}</div>}
        </div>
      </div>

      {/* Cantrips from subclass features */}
      {(char.cantrips || []).length > 0 && (
        <div className={styles.featureSection}>
          <h3 className={styles.sectionHeading}>Cantrips</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {char.cantrips.map((c, i) => (
              <span key={i} style={{
                padding: '4px 10px', background: 'rgba(185, 153, 170, 0.15)', border: '1px solid #b9a44',
                borderRadius: '4px', fontSize: '12px', color: '#ddd'
              }}>{c.replace(/_/g, ' ')}</span>
            ))}
          </div>
        </div>
      )}

      {/* Extra Attack / Crit Range info */}
      {((char.extraAttacks && char.extraAttacks > 0) || (char.critRange && char.critRange < 20)) && (
        <div className={styles.featureSection}>
          <h3 className={styles.sectionHeading}>Combat Bonuses</h3>
          <div className={styles.profList}>
            {char.extraAttacks && char.extraAttacks > 0 && (
              <div><strong>Extra Attacks:</strong> {char.extraAttacks} ({char.extraAttacks + 1} total attacks per Attack action)</div>
            )}
            {char.critRange && char.critRange < 20 && (
              <div><strong>Critical Hit Range:</strong> {char.critRange}-20</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
