export const STARTING_EQUIPMENT: Record<string, any[]> = {
  fighter: [
    { label: "Chain Mail", items: [{ name: "Chain Mail", qty: 1, type: "armor", weight: 55, slot: "chest" }] },
    { label: "Leather Armor, Longbow, 20 Arrows", items: [
      { name: "Leather", qty: 1, type: "armor", weight: 10, slot: "chest" },
      { name: "Longbow", qty: 1, type: "weapon", weight: 2, slot: "mainHand" },
      { name: "Arrows", qty: 20, type: "gear", weight: 1, slot: null }
    ]}
  ],
  wizard: [
    { label: "Quarterstaff", items: [{ name: "Quarterstaff", qty: 1, type: "weapon", weight: 4, slot: "mainHand" }] },
    { label: "Dagger", items: [{ name: "Dagger", qty: 1, type: "weapon", weight: 1, slot: "mainHand" }] }
  ],
  cleric: [
    { label: "Mace", items: [{ name: "Mace", qty: 1, type: "weapon", weight: 4, slot: "mainHand" }] },
    { label: "Warhammer (if proficient)", items: [{ name: "Warhammer", qty: 1, type: "weapon", weight: 2, slot: "mainHand" }] }
  ],
  rogue: [
    { label: "Rapier", items: [{ name: "Rapier", qty: 1, type: "weapon", weight: 2, slot: "mainHand" }] },
    { label: "Shortsword", items: [{ name: "Shortsword", qty: 1, type: "weapon", weight: 2, slot: "mainHand" }] }
  ],
  warlock: [
    { label: "Light Crossbow and 20 bolts", items: [{ name: "Light Crossbow", qty: 1, type: "weapon", weight: 5, slot: "mainHand" }, { name: "Bolts", qty: 20, type: "gear", weight: 1.5, slot: null }] },
    { label: "Any simple weapon", items: [{ name: "Dagger", qty: 1, type: "weapon", weight: 1, slot: "mainHand" }] }
  ]
};
