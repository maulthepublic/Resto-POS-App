import { db } from './localSchema';

// In-memory lock prevents double-seeding from React StrictMode double-invocation
let seedingInProgress = false;

export async function seedDatabase() {
  // Prevent concurrent seed calls (React StrictMode fires useEffect twice in dev)
  if (seedingInProgress) {
    console.log('[Dexie] Seeding already in progress. Skipping duplicate call.');
    return;
  }

  // Check using a versioned marker so seed runs again after schema upgrade
  const marker = await db.appSettings.get('seeded_version');
  if (marker && marker.value === '2') {
    console.log('[Dexie] Database v2 already seeded. Skipping.');
    return;
  }

  seedingInProgress = true;
  console.log('[Dexie] Seeding initial database data...');

  try {
    // 1. Seed Users (with role-based access)
    // Use bulkPut (upsert) so re-runs never throw ConstraintError
    await db.users.bulkPut([
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Budi (Owner)',
        email: 'owner@resto.com',
        role: 'owner' as const,
        isActive: true,
        updatedAt: new Date().toISOString(),
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Siti (Kasir)',
        email: 'cashier@resto.com',
        role: 'cashier' as const,
        isActive: true,
        updatedAt: new Date().toISOString(),
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Agus (Chef)',
        email: 'chef@resto.com',
        role: 'chef' as const,
        isActive: true,
        updatedAt: new Date().toISOString(),
      },
      {
        id: '44444444-4444-4444-8444-444444444444',
        name: 'Rudi (Admin)',
        email: 'admin@resto.com',
        role: 'admin' as const,
        isActive: true,
        updatedAt: new Date().toISOString(),
      },
    ]);

    await db.appSettings.bulkPut([
      { key: 'pin:11111111-1111-4111-8111-111111111111', value: '1234' },
      { key: 'pin:22222222-2222-4222-8222-222222222222', value: '1111' },
      { key: 'pin:33333333-3333-4333-8333-333333333333', value: '2222' },
      { key: 'pin:44444444-4444-4444-8444-444444444444', value: '3333' },
      { key: 'deviceId', value: 'dev-resto-pos-tablet-01' },
    ]);
    // PIN mappings stored in appSettings
    await db.appSettings.bulkPut([
      { key: 'pin:usr-1', value: '1234' }, // Owner PIN
      { key: 'pin:usr-2', value: '1111' }, // Cashier PIN
      { key: 'pin:usr-3', value: '2222' }, // Chef PIN
      { key: 'pin:usr-4', value: '3333' }, // Admin PIN
      { key: 'deviceId', value: 'dev-resto-pos-tablet-01' },
    ]);

    // 2. Seed Categories
    await db.categories.bulkPut([
      { id: 'cat-1', name: 'Makanan Utama', sortOrder: 1, isActive: true, updatedAt: new Date().toISOString() },
      { id: 'cat-2', name: 'Minuman', sortOrder: 2, isActive: true, updatedAt: new Date().toISOString() },
      { id: 'cat-3', name: 'Cemilan', sortOrder: 3, isActive: true, updatedAt: new Date().toISOString() },
    ]);

    // 3. Seed Menu Items
    await db.menuItems.bulkPut([
      {
        id: 'menu-1',
        categoryId: 'cat-1',
        name: 'Nasi Goreng Spesial',
        description: 'Nasi goreng dengan bumbu rempah pilihan, telur, dan irisan ayam.',
        basePrice: 18000,
        imageUrl: '',
        isActive: true,
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'menu-2',
        categoryId: 'cat-1',
        name: 'Ayam Goreng Bakar',
        description: 'Ayam goreng empuk dibakar dengan olesan kecap manis legendaris.',
        basePrice: 22000,
        imageUrl: '',
        isActive: true,
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'menu-3',
        categoryId: 'cat-2',
        name: 'Es Teh Manis',
        description: 'Teh melati seduh segar dengan es batu kristal dan gula murni.',
        basePrice: 5000,
        imageUrl: '',
        isActive: true,
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'menu-4',
        categoryId: 'cat-3',
        name: 'Kentang Goreng Keju',
        description: 'Kentang potongan panjang renyah disajikan dengan taburan keju parut.',
        basePrice: 12000,
        imageUrl: '',
        isActive: true,
        updatedAt: new Date().toISOString(),
      },
    ]);

    // 4. Seed Variant Groups & Variants
    await db.variantGroups.bulkPut([
      {
        id: 'vg-1',
        menuItemId: 'menu-1', // Nasi Goreng
        name: 'Porsi',
        isRequired: true,
        maxSelected: 1,
      },
      {
        id: 'vg-2',
        menuItemId: 'menu-3', // Es Teh Manis
        name: 'Kemanisan',
        isRequired: false,
        maxSelected: 1,
      },
    ]);

    await db.variants.bulkPut([
      { id: 'var-1', variantGroupId: 'vg-1', name: 'Regular', priceDelta: 0, isActive: true },
      { id: 'var-2', variantGroupId: 'vg-1', name: 'Jumbo', priceDelta: 5000, isActive: true },
      { id: 'var-3', variantGroupId: 'vg-2', name: 'Kurang Gula (Less Sugar)', priceDelta: 0, isActive: true },
      { id: 'var-4', variantGroupId: 'vg-2', name: 'Tanpa Gula (No Sugar)', priceDelta: -500, isActive: true },
    ]);

    // 5. Seed Modifiers
    await db.modifiers.bulkPut([
      { id: 'mod-1', name: 'Ekstra Telur Mata Sapi', priceDelta: 3000, isActive: true },
      { id: 'mod-2', name: 'Ekstra Keju Parut', priceDelta: 4000, isActive: true },
      { id: 'mod-3', name: 'Level Pedas: Gila', priceDelta: 1000, isActive: true },
    ]);

    // 6. Seed Raw Materials (Bahan Baku)
    await db.rawMaterials.bulkPut([
      { id: 'raw-1', name: 'Beras Cianjur', unit: 'kg', unitCost: 12000, minimumQuantity: 10.0, currentQuantity: 50.0, updatedAt: new Date().toISOString() },
      { id: 'raw-2', name: 'Daging Ayam Fresh', unit: 'kg', unitCost: 36000, minimumQuantity: 5.0, currentQuantity: 20.0, updatedAt: new Date().toISOString() },
      { id: 'raw-3', name: 'Telur Ayam Negeri', unit: 'butir', unitCost: 2000, minimumQuantity: 30.0, currentQuantity: 120.0, updatedAt: new Date().toISOString() },
      { id: 'raw-4', name: 'Minyak Goreng Sawit', unit: 'liter', unitCost: 16000, minimumQuantity: 5.0, currentQuantity: 25.0, updatedAt: new Date().toISOString() },
      { id: 'raw-5', name: 'Teh Melati Bubuk', unit: 'g', unitCost: 100, minimumQuantity: 200.0, currentQuantity: 1000.0, updatedAt: new Date().toISOString() },
      { id: 'raw-6', name: 'Gula Pasir Putih', unit: 'kg', unitCost: 15000, minimumQuantity: 5.0, currentQuantity: 15.0, updatedAt: new Date().toISOString() },
      { id: 'raw-7', name: 'Kentang Beku Import', unit: 'kg', unitCost: 28000, minimumQuantity: 5.0, currentQuantity: 15.0, updatedAt: new Date().toISOString() },
    ]);

    // 7. Seed Recipes (BOM - Bill of Materials)
    await db.recipes.bulkPut([
      // Nasi Goreng Spesial
      { id: 'rec-1', menuItemId: 'menu-1', rawMaterialId: 'raw-1', quantity: 0.15 },
      { id: 'rec-2', menuItemId: 'menu-1', rawMaterialId: 'raw-3', quantity: 1 },
      { id: 'rec-3', menuItemId: 'menu-1', rawMaterialId: 'raw-4', quantity: 0.02 },
      // Ayam Goreng Bakar
      { id: 'rec-4', menuItemId: 'menu-2', rawMaterialId: 'raw-2', quantity: 0.25 },
      { id: 'rec-5', menuItemId: 'menu-2', rawMaterialId: 'raw-4', quantity: 0.015 },
      // Es Teh Manis
      { id: 'rec-6', menuItemId: 'menu-3', rawMaterialId: 'raw-5', quantity: 10 },
      { id: 'rec-7', menuItemId: 'menu-3', rawMaterialId: 'raw-6', quantity: 0.025 },
      // Kentang Goreng Keju
      { id: 'rec-8', menuItemId: 'menu-4', rawMaterialId: 'raw-7', quantity: 0.2 },
      { id: 'rec-9', menuItemId: 'menu-4', rawMaterialId: 'raw-4', quantity: 0.025 },
    ]);

    // Write version marker LAST — only after all data is successfully written
    await db.appSettings.put({ key: 'seeded_version', value: '2' });

    console.log('[Dexie] Database v2 successfully seeded.');
  } catch (err) {
    console.error('[Dexie] Seeding failed:', err);
    seedingInProgress = false; // Release lock on error so a retry is possible
    throw err;
  }

  seedingInProgress = false;
}
