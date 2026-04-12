#!/usr/bin/env node
/**
 * migrate-spells.js — Backfill `damageType` into the spell database.
 *
 * Strategy:
 *   1. PRIMARY: Parse the existing `damage` field (e.g. "8d6 Fire" → "fire").
 *      Most spells with damage already embed the type in the damage string.
 *   2. FALLBACK: Scan the `description` field for explicit damage type keywords.
 *   3. SKIP: Spells with no `damage` field and no identifiable damage type
 *      in their description are left without `damageType` (utility/buff/debuff spells).
 *
 * Usage:
 *   node scripts/migrate-spells.js
 *   node scripts/migrate-spells.js --dry-run    (preview changes without writing)
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
//  Configuration
// ═══════════════════════════════════════════════════════════════

const SPELLS_FILE = path.join(
  __dirname,
  '..',
  'app',
  'dungeon-buddy',
  'lib',
  'data',
  'spells.ts'
);

const DRY_RUN = process.argv.includes('--dry-run');

// Canonical 5e damage types (lowercase for matching)
const DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
];

// Some spells have non-standard damage type strings in their damage field.
// Map common variants to canonical types.
const DAMAGE_TYPE_ALIASES = {
  'extra': null,      // "1d4 Extra" from Enlarge/Reduce — context-dependent, skip
  'hp':    null,       // not a damage type
};

// ═══════════════════════════════════════════════════════════════
//  Extraction Logic
// ═══════════════════════════════════════════════════════════════

/**
 * Attempt to extract damage type from the `damage` field string.
 * Patterns like "8d6 Fire", "10d6 + 40 force", "3d6 Psychic"
 */
function extractFromDamageField(damageStr) {
  if (!damageStr) return null;

  // Split on spaces and check each token for a damage type
  const tokens = damageStr.toLowerCase().replace(/[+\-,]/g, ' ').split(/\s+/);
  for (const token of tokens) {
    // Check aliases first
    if (token in DAMAGE_TYPE_ALIASES) return DAMAGE_TYPE_ALIASES[token];
    // Check canonical types
    if (DAMAGE_TYPES.includes(token)) return token;
  }

  return null;
}

/**
 * Attempt to extract damage type from the spell description.
 * Looks for patterns like "Xd6 fire damage", "takes fire damage", "cold damage".
 * Only used as fallback when the damage field doesn't have a type.
 */
function extractFromDescription(description) {
  if (!description) return null;

  const desc = description.toLowerCase();

  // Pattern 1: "XdY <type> damage"
  const dicePattern = /\d+d\d+\s+(\w+)\s+damage/;
  const diceMatch = desc.match(dicePattern);
  if (diceMatch && DAMAGE_TYPES.includes(diceMatch[1])) {
    return diceMatch[1];
  }

  // Pattern 2: "takes <type> damage"
  const takesPattern = /takes?\s+(\w+)\s+damage/;
  const takesMatch = desc.match(takesPattern);
  if (takesMatch && DAMAGE_TYPES.includes(takesMatch[1])) {
    return takesMatch[1];
  }

  // Pattern 3: "deals <type> damage" or "deal <type> damage"
  const dealsPattern = /deals?\s+(\w+)\s+damage/;
  const dealsMatch = desc.match(dealsPattern);
  if (dealsMatch && DAMAGE_TYPES.includes(dealsMatch[1])) {
    return dealsMatch[1];
  }

  // Pattern 4: "XdY + N <type> damage"
  const diceBonus = /\d+d\d+\s*\+\s*\d+\s+(\w+)\s+damage/;
  const diceBonusMatch = desc.match(diceBonus);
  if (diceBonusMatch && DAMAGE_TYPES.includes(diceBonusMatch[1])) {
    return diceBonusMatch[1];
  }

  // Pattern 5: "<type> damage on a failed save" or "<type> damage on"
  const failedSave = /(\w+)\s+damage\s+on\s+a?\s*failed/;
  const failedMatch = desc.match(failedSave);
  if (failedMatch && DAMAGE_TYPES.includes(failedMatch[1])) {
    return failedMatch[1];
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
//  File Processing
// ═══════════════════════════════════════════════════════════════

function processSpellsFile() {
  console.log(`\n📖 Reading: ${SPELLS_FILE}\n`);

  if (!fs.existsSync(SPELLS_FILE)) {
    console.error('❌ Spells file not found!');
    process.exit(1);
  }

  const content = fs.readFileSync(SPELLS_FILE, 'utf-8');

  let patchCount = 0;
  let skipCount = 0;
  let alreadyCount = 0;
  let noDamageCount = 0;

  // Strategy: walk line-by-line, find each spell entry, and inject damageType after the damage field.
  // We operate on the raw TS text to avoid needing a TS parser.

  const lines = content.split('\n');
  const output = [];

  // State machine
  let inSpell = false;
  let currentDamage = null;
  let currentDescription = '';
  let hasDamageType = false;
  let damageLineIdx = -1;
  let spellId = '';
  let spellBuffer = [];   // Collect lines for the current spell entry
  let spellStartIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Detect start of a spell entry: "spell_xxx": {
    const spellStartMatch = trimmed.match(/^"(spell_\w+)":\s*\{/);
    if (spellStartMatch) {
      inSpell = true;
      spellId = spellStartMatch[1];
      currentDamage = null;
      currentDescription = '';
      hasDamageType = false;
      damageLineIdx = -1;
      spellStartIdx = i;
    }

    if (inSpell) {
      // Check for `damage: "..."` field
      const dmgMatch = line.match(/damage:\s*"([^"]*)"/);
      if (dmgMatch) {
        currentDamage = dmgMatch[1];
        damageLineIdx = i;
      }

      // Check for existing damageType field
      if (line.includes('damageType:')) {
        hasDamageType = true;
      }

      // Capture description (can be multi-line with backticks or quotes)
      const descMatch = line.match(/description:\s*[`"]([^`"]*)/)
      if (descMatch) {
        currentDescription = descMatch[1];
      }
    }

    // Detect end of spell entry (line starting with `  },` or `  }`)
    // Also check for lines containing `classes:` which is the last field
    const isEnd = inSpell && (
      trimmed.match(/^},?\s*$/) ||
      (trimmed.includes('classes:') && trimmed.includes(']'))
    );

    if (isEnd && inSpell) {
      // Process this spell
      if (hasDamageType) {
        // Already has damageType, skip
        alreadyCount++;
        output.push(line);
        inSpell = false;
        continue;
      }

      // Try to extract damage type
      let damageType = extractFromDamageField(currentDamage);
      if (!damageType && currentDamage) {
        damageType = extractFromDescription(currentDescription);
      }

      if (damageType && currentDamage) {
        // Inject damageType after the damage line
        // Since this is the end-of-entry line, we need to inject before this line
        // Find the damage field line and add damageType after it
        patchCount++;
        if (!DRY_RUN) {
          console.log(`  ✅ ${spellId}: damage="${currentDamage}" → damageType: "${damageType}"`);
        } else {
          console.log(`  🔍 [DRY] ${spellId}: would set damageType: "${damageType}"`);
        }

        // We already pushed previous lines. We need to retroactively inject.
        // Instead, we'll use a two-pass approach or inject at the classes line.
        // Since we're at the end, let's inject before the classes line.

        // Insert damageType before the current line (classes or closing brace)
        if (trimmed.includes('classes:')) {
          // Inject before classes line
          const indent = line.match(/^(\s*)/)?.[1] || '    ';
          output.push(`${indent}damageType: "${damageType}",`);
        }

        output.push(line);
      } else if (!currentDamage) {
        noDamageCount++;
        output.push(line);
      } else {
        skipCount++;
        if (DRY_RUN) {
          console.log(`  ⏭️  [SKIP] ${spellId}: damage="${currentDamage}" — could not determine type`);
        }
        output.push(line);
      }

      inSpell = false;
      continue;
    }

    output.push(line);
  }

  // ── Summary ──
  console.log('\n' + '═'.repeat(60));
  console.log(`  📊 Migration Summary`);
  console.log('═'.repeat(60));
  console.log(`  ✅ Patched:         ${patchCount}`);
  console.log(`  ⏭️  Skipped (no ID): ${skipCount}`);
  console.log(`  📦 Already had:     ${alreadyCount}`);
  console.log(`  🔇 No damage field: ${noDamageCount}`);
  console.log(`  📝 Total lines:     ${lines.length} → ${output.length}`);
  console.log('═'.repeat(60));

  if (DRY_RUN) {
    console.log('\n🏃 Dry run complete. No files modified.\n');
    return;
  }

  // Write back
  const outputContent = output.join('\n');
  fs.writeFileSync(SPELLS_FILE, outputContent, 'utf-8');
  console.log(`\n💾 Written: ${SPELLS_FILE}\n`);
}

// ═══════════════════════════════════════════════════════════════
//  Run
// ═══════════════════════════════════════════════════════════════

processSpellsFile();
