'use client';

import { useCharacterStore } from '../lib/store';
import styles from '../[id]/page.module.css';
import { useState, useMemo, useCallback } from 'react';
import { resolveModifiers } from '../lib/resolve-modifiers';
import { ModifierEffect } from '../lib/types';
import ModifierBuilder from '../components/ModifierBuilder';

export default function FeaturesTab() {
  const { char, addHomebrewFeature, removeHomebrewFeature, updateField } = useCharacterStore();
  const [isAddingFeature, setIsAddingFeature] = useState(false);
  const [featureDraft, setFeatureDraft] = useState({ name: '', description: '', source: 'Homebrew' });
  const [featureModifiers, setFeatureModifiers] = useState<ModifierEffect[]>([]);

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

  // Homebrew features from the registry
  const homebrewFeatures = char.homebrew?.features || [];

  const handleSaveFeature = () => {
    if (!featureDraft.name.trim()) return;
    addHomebrewFeature({
      name: featureDraft.name,
      description: featureDraft.description,
      source: featureDraft.source || 'Homebrew',
      modifiers: featureModifiers.length > 0 ? featureModifiers : undefined,
      isActive: true,
    });
    setIsAddingFeature(false);
    setFeatureDraft({ name: '', description: '', source: 'Homebrew' });
    setFeatureModifiers([]);
  };

  const toggleHomebrewFeature = (featureId: string) => {
    if (!char.homebrew) return;
    const updated = char.homebrew.features.map(f =>
      f.id === featureId ? { ...f, isActive: !f.isActive } : f
    );
    updateField('homebrew', { ...char.homebrew, features: updated });
  };

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
        case 'modify_ac': return { label: 'AC', color: '#66aaff' };
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

      {/* ═══════════════════════════════════════════════
          HOMEBREW FEATURES — Custom / DM Boons
          ═══════════════════════════════════════════════ */}
      <div className={styles.featureSection}>
        <h3 className={styles.sectionHeading} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          Custom / DM Boons
          <span style={{ fontSize: '11px', color: '#cfaa5e', fontFamily: 'Inter, sans-serif', fontWeight: 'normal' }}>
            ({homebrewFeatures.length} homebrew)
          </span>
        </h3>

        {/* Render existing homebrew features */}
        {homebrewFeatures.map((hbf) => {
          const badges = getModBadges(hbf as any);
          return (
            <div key={hbf.id} className={styles.featureCard} style={{
              position: 'relative',
              opacity: hbf.isActive ? 1 : 0.5,
              borderLeft: `3px solid ${hbf.isActive ? '#cfaa5e' : '#555'}`,
              transition: 'opacity 0.2s, border-color 0.2s',
            }}>
              <div className={styles.featureCardHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* isActive Toggle */}
                  <button
                    onClick={() => toggleHomebrewFeature(hbf.id)}
                    title={hbf.isActive ? 'Disable this feature' : 'Enable this feature'}
                    style={{
                      width: '32px', height: '18px', borderRadius: '9px', border: 'none',
                      background: hbf.isActive ? 'linear-gradient(135deg, #cfaa5e, #b8842e)' : '#333',
                      cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: '14px', height: '14px', borderRadius: '50%',
                      background: '#fff', position: 'absolute', top: '2px',
                      left: hbf.isActive ? '16px' : '2px',
                      transition: 'left 0.2s',
                    }} />
                  </button>
                  <div>
                    <span className={styles.featureName}>{hbf.name}</span>
                    <span style={{
                      padding: '1px 5px', borderRadius: '3px', fontSize: '8px', fontWeight: 'bold',
                      background: 'rgba(207, 170, 94, 0.15)', color: '#cfaa5e', border: '1px solid rgba(207, 170, 94, 0.3)',
                      textTransform: 'uppercase', letterSpacing: '0.5px', marginLeft: '8px',
                    }}>HB</span>
                    <span style={{ fontSize: '10px', color: '#666', marginLeft: '6px' }}>{hbf.source}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                  {badges.filter((b, idx, arr) => arr.findIndex(x => x.label === b.label) === idx).map((b, bi) => (
                    <span key={bi} style={{
                      padding: '2px 6px', borderRadius: '3px', fontSize: '9px', fontWeight: 'bold',
                      background: `${b.color}22`, color: b.color, border: `1px solid ${b.color}44`,
                      textTransform: 'uppercase', letterSpacing: '0.5px'
                    }}>{b.label}</span>
                  ))}
                  <button
                    onClick={() => removeHomebrewFeature(hbf.id)}
                    style={{
                      background: 'transparent', border: '1px solid #663333', color: '#ff6666',
                      padding: '2px 6px', borderRadius: '3px', fontSize: '9px', cursor: 'pointer',
                      marginLeft: '4px',
                    }}
                    title="Delete this homebrew feature"
                  >✕</button>
                </div>
              </div>
              <p className={styles.featureDesc}>{hbf.description}</p>
            </div>
          );
        })}

        {/* Add Feature Button */}
        {!isAddingFeature && (
          <button
            onClick={() => setIsAddingFeature(true)}
            style={{
              width: '100%', padding: '14px 24px', marginTop: '8px',
              background: 'linear-gradient(135deg, rgba(207,170,94,0.08), rgba(207,170,94,0.02))',
              border: '1px dashed #cfaa5e55', borderRadius: '6px',
              color: '#cfaa5e', cursor: 'pointer', fontFamily: 'Cinzel, serif',
              fontSize: '14px', fontWeight: 'bold',
              transition: 'all 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = '#cfaa5e'; e.currentTarget.style.background = 'rgba(207,170,94,0.1)'; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = '#cfaa5e55'; e.currentTarget.style.background = 'linear-gradient(135deg, rgba(207,170,94,0.08), rgba(207,170,94,0.02))'; }}
          >
            ✨ Add Custom Feature
          </button>
        )}

        {/* Inline Creation Form */}
        {isAddingFeature && (
          <div style={{
            marginTop: '8px', padding: '20px',
            background: 'linear-gradient(180deg, rgba(25,25,30,0.95), rgba(15,15,20,0.98))',
            border: '1px solid #cfaa5e', borderRadius: '8px',
          }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#cfaa5e', fontFamily: 'Cinzel, serif', fontSize: '16px' }}>
              ✨ Forge Custom Feature
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              <input
                placeholder="Feature Name (e.g., Dragon's Bane)"
                value={featureDraft.name}
                onChange={e => setFeatureDraft({ ...featureDraft, name: e.target.value })}
                style={{ padding: '10px', background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '4px', fontFamily: 'Cinzel, serif' }}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <select
                  value={featureDraft.source}
                  onChange={e => setFeatureDraft({ ...featureDraft, source: e.target.value })}
                  style={{ padding: '10px', background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '4px', flex: 1 }}
                >
                  <option value="Homebrew">Homebrew</option>
                  <option value="DM Boon">DM Boon</option>
                  <option value="Magic Item">Magic Item</option>
                  <option value="Quest Reward">Quest Reward</option>
                  <option value="Racial Variant">Racial Variant</option>
                </select>
              </div>
              <textarea
                placeholder="Description: What does this feature do narratively?"
                value={featureDraft.description}
                onChange={e => setFeatureDraft({ ...featureDraft, description: e.target.value })}
                style={{ padding: '10px', background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '4px', minHeight: '80px', resize: 'vertical' }}
              />
            </div>

            <ModifierBuilder value={featureModifiers} onChange={setFeatureModifiers} />

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button
                onClick={handleSaveFeature}
                disabled={!featureDraft.name.trim()}
                style={{
                  padding: '10px 20px',
                  background: featureDraft.name.trim() ? 'linear-gradient(135deg, #cfaa5e, #b8842e)' : '#333',
                  color: featureDraft.name.trim() ? '#000' : '#666',
                  border: 'none', borderRadius: '4px', cursor: featureDraft.name.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold', fontFamily: 'Cinzel, serif',
                }}
              >
                ✨ Save Feature
              </button>
              <button
                onClick={() => { setIsAddingFeature(false); setFeatureModifiers([]); }}
                style={{ padding: '10px 20px', background: 'transparent', color: '#888', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

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
