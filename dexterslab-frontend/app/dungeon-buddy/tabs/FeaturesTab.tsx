'use client';

import { useCharacterStore } from '../lib/store';
import styles from '../[id]/page.module.css';

export default function FeaturesTab() {
  const { char } = useCharacterStore();

  if (!char) return null;

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

      {(char.features || []).length > 0 && (
        <div className={styles.featureSection}>
          <h3 className={styles.sectionHeading}>Class Features</h3>
          {char.features.map((f, i) => (
            <div key={i} className={styles.featureCard}>
              <div className={styles.featureCardHeader}>
                <span className={styles.featureName}>{f.name}</span>
              </div>
              <p className={styles.featureDesc}>{f.description}</p>
            </div>
          ))}
        </div>
      )}

      <div className={styles.featureSection}>
        <h3 className={styles.sectionHeading}>Proficiencies</h3>
        <div className={styles.profList}>
          {(char.armorProficiencies || []).length > 0 && <div><strong>Armor:</strong> {char.armorProficiencies.join(', ')}</div>}
          {(char.weaponProficiencies || []).length > 0 && <div><strong>Weapons:</strong> {char.weaponProficiencies.join(', ')}</div>}
          {(char.languages || []).length > 0 && <div><strong>Languages:</strong> {char.languages.join(', ')}</div>}
        </div>
      </div>
    </div>
  );
}
