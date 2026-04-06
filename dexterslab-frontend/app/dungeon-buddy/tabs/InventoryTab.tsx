'use client';

import { useState } from 'react';
import { useCharacterStore } from '../lib/store';
import styles from '../[id]/page.module.css';
import { ITEM_DATABASE } from '../lib/data/items';
import { InventoryItem, EquipSlot } from '../lib/types';

const SLOTS: { id: EquipSlot, label: string }[] = [
  { id: 'head', label: 'Head' },
  { id: 'amulet', label: 'Amulet' },
  { id: 'cloak', label: 'Cloak' },
  { id: 'chest', label: 'Chest' },
  { id: 'gloves', label: 'Gloves' },
  { id: 'mainHand', label: 'Main Hand' },
  { id: 'offHand', label: 'Off Hand' },
  { id: 'ring1', label: 'Ring' },
  { id: 'ring2', label: 'Ring' },
  { id: 'boots', label: 'Boots' },
];

export default function InventoryTab() {
  const { char, equipItem, unequipSlot, updateField } = useCharacterStore();
  const [selectedBackpackItem, setSelectedBackpackItem] = useState<InventoryItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newItemMode, setNewItemMode] = useState<'srd' | 'custom'>('srd');
  const [srdSelection, setSrdSelection] = useState(Object.keys(ITEM_DATABASE)[0]);
  const [customDraft, setCustomDraft] = useState({ name: '', type: 'gear', weight: 1 });

  if (!char) return null;

  const addItemToInventory = () => {
    let itemToAdd: any;
    if (newItemMode === 'srd') {
      itemToAdd = { ...ITEM_DATABASE[srdSelection], id: `item_${Date.now()}`, qty: 1 };
    } else {
      itemToAdd = { 
         id: `custom_item_${Date.now()}`, 
         name: customDraft.name || 'Unknown Item', 
         type: customDraft.type as any, 
         weight: customDraft.weight, 
         qty: 1, 
      };
    }
    updateField('inventory', [...(char.inventory || []), itemToAdd]);
    setIsAdding(false);
  };

  const handleEquipToSlot = (slot: EquipSlot) => {
    if (!selectedBackpackItem) return;
    equipItem(selectedBackpackItem.id, slot);
    setSelectedBackpackItem(null); // deselect after equipping
  };

  const renderSlot = (slotId: EquipSlot, label: string, position: { top?: string, bottom?: string, left?: string, right?: string }) => {
    const item = char.equipped?.[slotId];
    return (
      <div 
        key={slotId}
        onClick={() => item && unequipSlot(slotId)}
        style={{
          width: '64px', height: '64px', 
          background: item ? 'rgba(50, 40, 30, 0.9)' : 'rgba(20,20,20,0.6)', 
          border: `1px solid ${item ? '#cfaa5e' : '#444'}`,
          borderRadius: '4px',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          cursor: item ? 'pointer' : 'default',
          position: 'absolute',
          ...position,
          boxShadow: item ? '0 0 10px rgba(207, 170, 94, 0.2)' : 'none',
          transition: 'all 0.2s',
          zIndex: 10
        }}
        title={item ? `Click to unequip ${item.name}` : `Empty ${label}`}
      >
        <span style={{ fontSize: '9px', color: '#888', position: 'absolute', top: '2px', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontSize: '11px', color: item ? '#fff' : '#555', textAlign: 'center', padding: '0 2px', marginTop: '12px', wordBreak: 'break-word', lineHeight: 1.1 }}>
          {item ? item.name : 'Empty'}
        </span>
      </div>
    );
  };

  return (
    <div className={styles.inventoryLayoutWrapper}>
      
      {/* LEFT: Paper Doll */}
      <div style={{ flex: '0 0 auto', width: '100%', maxWidth: '350px', background: 'rgba(10,10,10,0.8)', padding: '24px', borderRadius: '8px', border: '1px solid #333', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h3 className={styles.sectionHeading} style={{ width: '100%', textAlign: 'center', marginBottom: '24px' }}>Equipped Gear</h3>
        
        {/* Visual Humanoid Silhouette */}
        <div style={{ position: 'relative', width: '320px', height: '480px', border: '1px solid #222', borderRadius: '8px', overflow: 'hidden', background: '#0a0a0a' }}>
           
           {/* Background Silhouette Image */}
           <img 
              src="/silhouette.png" 
              alt="Adventurer Silhouette" 
              style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', height: '105%', objectFit: 'contain', opacity: 0.4, pointerEvents: 'none' }} 
           />

           {/* Center Column */}
           {renderSlot('head', 'Head', { top: '16px', left: '128px' })}
           {renderSlot('chest', 'Chest', { top: '140px', left: '128px' })}
           {renderSlot('boots', 'Boots', { bottom: '24px', left: '128px' })}

           {/* Left Column (Main Hand Side) */}
           {renderSlot('mainHand', 'Main', { top: '100px', left: '16px' })}
           {renderSlot('gloves', 'Gloves', { top: '190px', left: '16px' })}
           {renderSlot('amulet', 'Amulet', { top: '280px', left: '16px' })}
           {renderSlot('ring1', 'Ring', { top: '370px', left: '16px' })}

           {/* Right Column (Off Hand Side) */}
           {renderSlot('offHand', 'Offhand', { top: '100px', right: '16px' })}
           {renderSlot('cloak', 'Cloak', { top: '190px', right: '16px' })}
           {renderSlot('ring2', 'Ring', { top: '280px', right: '16px' })}
           
        </div>

        <p style={{ marginTop: '24px', fontSize: '12px', color: '#666', textAlign: 'center' }}>
          Click an equipped item to unequip it and return it to your backpack. 
          Armor Class is derived automatically.
        </p>
      </div>

      {/* RIGHT: Backpack */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className={styles.sectionHeading} style={{ margin: 0 }}>Backpack Inventory</h3>
          <button 
            onClick={() => setIsAdding(true)}
            style={{ padding: '6px 12px', background: '#332211', border: '1px solid #cfaa5e', color: '#cfaa5e', borderRadius: '4px', cursor: 'pointer' }}
          >
            + Add Item
          </button>
        </div>

        {isAdding && (
          <div style={{ padding: '16px', background: '#1a1a1a', border: '1px solid #55aacc', borderRadius: '6px', marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#55aacc' }}>Add New Item</h4>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
               <label style={{ color: '#ccc', fontSize: '14px', cursor: 'pointer' }}>
                 <input type="radio" checked={newItemMode === 'srd'} onChange={() => setNewItemMode('srd')} style={{ marginRight: '8px' }} />
                 Database Item
               </label>
               <label style={{ color: '#ccc', fontSize: '14px', cursor: 'pointer' }}>
                 <input type="radio" checked={newItemMode === 'custom'} onChange={() => setNewItemMode('custom')} style={{ marginRight: '8px' }} />
                 Write Custom Item
               </label>
            </div>

            {newItemMode === 'srd' ? (
              <select 
                value={srdSelection} 
                onChange={e => setSrdSelection(e.target.value)}
                style={{ width: '100%', padding: '10px', background: '#111', border: '1px solid #444', color: '#fff', marginBottom: '16px' }}
              >
                {Object.entries(ITEM_DATABASE).map(([key, item]) => (
                  <option key={key} value={key}>{item.name}</option>
                ))}
              </select>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                <input placeholder="Item Name" value={customDraft.name} onChange={e => setCustomDraft({...customDraft, name: e.target.value})} style={{ padding: '10px', background: '#111', border: '1px solid #444', color: '#fff' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select value={customDraft.type} onChange={e => setCustomDraft({...customDraft, type: e.target.value})} style={{ padding: '10px', background: '#111', border: '1px solid #444', color: '#fff', flex: 1 }}>
                    <option value="gear">Standard Gear</option>
                    <option value="weapon">Weapon</option>
                    <option value="armor">Armor</option>
                    <option value="tool">Tool</option>
                  </select>
                  <input type="number" placeholder="Weight (lbs)" value={customDraft.weight} onChange={e => setCustomDraft({...customDraft, weight: parseFloat(e.target.value)||0})} style={{ padding: '10px', background: '#111', border: '1px solid #444', color: '#fff', width: '100px' }} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={addItemToInventory} style={{ padding: '8px 16px', background: '#55aacc', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Add to Backpack</button>
              <button onClick={() => setIsAdding(false)} style={{ padding: '8px 16px', background: 'transparent', color: '#888', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}
        
        {selectedBackpackItem && (
          <div style={{ padding: '16px', background: '#1a1a1a', border: '1px solid #cfaa5e', borderRadius: '6px' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#cfaa5e' }}>{selectedBackpackItem.name}</h4>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#aaa' }}>Type: {selectedBackpackItem.type}</span>
              <span style={{ fontSize: '12px', color: '#aaa' }}>Weight: {selectedBackpackItem.weight} lbs</span>
            </div>
            
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#aaa', alignSelf: 'center', marginRight: '8px' }}>Equip to:</span>
              {SLOTS.map(s => (
                <button 
                  key={s.id}
                  onClick={() => handleEquipToSlot(s.id)}
                  style={{
                    padding: '6px 12px', background: 'transparent', border: '1px solid #555', color: '#ccc', borderRadius: '4px', cursor: 'pointer', fontSize: '12px'
                  }}
                >
                  {s.label}
                </button>
              ))}
              <button 
                onClick={() => setSelectedBackpackItem(null)}
                style={{ marginLeft: 'auto', padding: '6px 12px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '12px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: '12px' }}>
          {char.inventory.length === 0 && <p style={{ color: '#555' }}>Your backpack is completely empty.</p>}
          {char.inventory.map(item => (
            <div 
              key={item.id}
              onClick={() => setSelectedBackpackItem(item)}
              style={{
                background: selectedBackpackItem?.id === item.id ? 'rgba(207, 170, 94, 0.1)' : 'rgba(20,20,20,0.8)',
                border: `1px solid ${selectedBackpackItem?.id === item.id ? '#cfaa5e' : '#333'}`,
                padding: '12px', borderRadius: '4px', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.1s'
              }}
            >
              <span style={{ color: '#ccc', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {item.qty > 1 ? `${item.qty}x ` : ''}{item.name}
                <span style={{ flexShrink: 0, fontSize: '10px', color: '#cfaa5e', border: '1px solid #cfaa5e', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', paddingBottom: '1px' }}>i</span>
              </span>
              <span style={{ color: '#666', fontSize: '12px' }}>{item.weight} lb</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
