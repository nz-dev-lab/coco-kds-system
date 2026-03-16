import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

// Determine database path based on platform
function getSharedDBPath(): string {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // DEVELOPMENT: Always use user directory (no permission issues)
  if (isDevelopment) {
    const devPath = path.join(app.getPath('userData'), 'kds-data.db');
    console.log('🔧 Development mode - Database:', devPath);
    return devPath;
  }
  
  // PRODUCTION: Platform-specific shared locations with fallback
  let sharedDir: string;
  
  if (process.platform === 'win32') {
    sharedDir = 'C:\\ProgramData\\CocoKDS';
  } else if (process.platform === 'darwin') {
    sharedDir = '/Library/Application Support/CocoKDS';
  } else {
    // Linux
    sharedDir = '/opt/cocokds';
  }
  
  // Try to use shared directory
  try {
    if (!fs.existsSync(sharedDir)) {
      fs.mkdirSync(sharedDir, { recursive: true });
    }
    
    // Test write permission
    const testFile = path.join(sharedDir, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    
    const dbPath = path.join(sharedDir, 'kds-data.db');
    console.log('✅ Using shared database:', dbPath);
    return dbPath;
    
  } catch (error) {
    // Fallback to user directory
    console.warn('⚠️ Cannot access shared directory, using user directory');
    console.warn('   For multi-user setup, see application documentation');
    
    const userPath = path.join(app.getPath('userData'), 'kds-data.db');
    console.log('ℹ️ Using user database:', userPath);
    return userPath;
  }
}

const dbPath = getSharedDBPath();

console.log('📁 Database location:', dbPath);

// ── Auto-backup on startup ────────────────────────────────────────────────────
// Keeps the last 3 timestamped backups. Safe against accidental uninstall/corruption
// because the DB lives in C:\ProgramData\CocoKDS (outside the install directory).
function backupDatabase(sourcePath: string): void {
  if (!fs.existsSync(sourcePath)) return; // nothing to back up on first run
  const backupDir = path.dirname(sourcePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = path.join(backupDir, `kds-data.backup-${timestamp}.db`);
  try {
    fs.copyFileSync(sourcePath, backupPath);
    console.log('✅ Database backed up to:', backupPath);
    // Prune — keep only the 3 most recent backups
    const backups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('kds-data.backup-') && f.endsWith('.db'))
      .sort()
      .reverse();
    backups.slice(3).forEach(old => {
      try { fs.unlinkSync(path.join(backupDir, old)); } catch {}
      console.log('🗑️ Removed old backup:', old);
    });
  } catch (err) {
    console.warn('⚠️ Database backup failed:', err);
  }
}

backupDatabase(dbPath);

// Initialize database
const db = new Database(dbPath, { verbose: console.log });

// Enable WAL mode for better concurrent access (multiple staff can use simultaneously)
db.pragma('journal_mode = WAL');

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS completed_orders (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    bumped_at TEXT NOT NULL,
    order_type TEXT NOT NULL CHECK(order_type IN ('delivery', 'take_away', 'dine_in')),
    order_status TEXT NOT NULL,
    order_amount REAL NOT NULL,
    payment_method TEXT,
    item_count INTEGER NOT NULL DEFAULT 0,
    items TEXT NOT NULL,
    prep_time_minutes INTEGER,
    delivery_man_id TEXT,
    restaurant_id TEXT NOT NULL,
    customer_name TEXT,
    bumped_by_user TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_completed_at ON completed_orders(completed_at);
  CREATE INDEX IF NOT EXISTS idx_bumped_at ON completed_orders(bumped_at);
  CREATE INDEX IF NOT EXISTS idx_order_type ON completed_orders(order_type);
  CREATE INDEX IF NOT EXISTS idx_restaurant_id ON completed_orders(restaurant_id);
  CREATE INDEX IF NOT EXISTS idx_restaurant_date ON completed_orders(restaurant_id, completed_at);
`);

console.log('✅ Database initialized successfully');

// Prepared statements for better performance
export const statements = {
  // Insert completed order
  insertOrder: db.prepare(`
    INSERT OR IGNORE INTO completed_orders (
      id, created_at, completed_at, bumped_at, order_type, order_status,
      order_amount, payment_method, item_count, items, prep_time_minutes,
      delivery_man_id, restaurant_id, customer_name, bumped_by_user
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  // Get orders for a specific date and restaurant
  getOrdersByDate: db.prepare(`
    SELECT *
    FROM completed_orders
    WHERE DATE(completed_at) = ?
      AND restaurant_id = ?
    ORDER BY completed_at DESC
  `),

  // Get daily statistics for a restaurant
  getDailyStats: db.prepare(`
    SELECT 
      COUNT(*) as total_orders,
      SUM(order_amount) as total_revenue,
      AVG(prep_time_minutes) as avg_prep_time,
      SUM(CASE WHEN order_type = 'delivery' THEN 1 ELSE 0 END) as delivery_count,
      SUM(CASE WHEN order_type = 'take_away' THEN 1 ELSE 0 END) as takeaway_count,
      SUM(CASE WHEN order_type = 'dine_in' THEN 1 ELSE 0 END) as dine_in_count,
      COUNT(DISTINCT customer_name) as unique_customers
    FROM completed_orders
    WHERE DATE(completed_at) = ?
      AND restaurant_id = ?
  `),

  // Get revenue trend for last N days (restaurant-specific)
  getRevenueTrend: db.prepare(`
    SELECT 
      DATE(completed_at) as date,
      COUNT(*) as orders,
      SUM(order_amount) as revenue,
      AVG(prep_time_minutes) as avg_prep_time
    FROM completed_orders
    WHERE completed_at >= DATE('now', '-' || ? || ' days')
      AND restaurant_id = ?
    GROUP BY DATE(completed_at)
    ORDER BY date ASC
  `),

  // Delete old orders for a specific restaurant
  deleteOldOrders: db.prepare(`
    DELETE FROM completed_orders
    WHERE completed_at < DATE('now', '-' || ? || ' days')
      AND restaurant_id = ?
  `),

  // Get total count for a restaurant
  getTotalCount: db.prepare(`
    SELECT COUNT(*) as count 
    FROM completed_orders 
    WHERE restaurant_id = ?
  `),
};

// Helper function to add completed order
export function addCompletedOrder(order: {
  id: string;
  created_at: string;
  completed_at: string;
  order_type: string;
  order_status: string;
  order_amount: string;
  payment_method: string;
  item_count: number;
  items: any[];
  prep_time_minutes: number;
  delivery_man_id?: string | null;
  restaurant_id: string;
  customer_name?: string | null;
}, bumpedByUser?: string) {
  try {
    const now = new Date().toISOString();
    
    // Prepare items for storage (minimal data to save space)
    const itemsForStorage = order.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    }));

    statements.insertOrder.run(
      order.id,
      order.created_at,
      order.completed_at || now,
      now, // bumped_at (when the bump button was clicked)
      order.order_type,
      order.order_status,
      parseFloat(order.order_amount),
      order.payment_method || 'unknown',
      order.item_count,
      JSON.stringify(itemsForStorage),
      order.prep_time_minutes,
      order.delivery_man_id || null,
      order.restaurant_id, // CRITICAL: Always store restaurant_id
      order.customer_name || null,
      bumpedByUser || 'unknown'
    );

    console.log(`✅ Order ${order.id} stored in database for restaurant ${order.restaurant_id}`);
    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to store order:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to get daily stats (restaurant-specific)
export function getDailyStats(date: string, restaurantId: string) {
  try {
    const stats = statements.getDailyStats.get(date, restaurantId);
    return { success: true, data: stats };
  } catch (error: any) {
    console.error('❌ Failed to get daily stats:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to get orders by date (restaurant-specific)
export function getOrdersByDate(date: string, restaurantId: string) {
  try {
    const orders = statements.getOrdersByDate.all(date, restaurantId);
    // Parse items JSON back to objects
    const parsedOrders = orders.map((order: any) => ({
      ...order,
      items: JSON.parse(order.items),
    }));
    return { success: true, data: parsedOrders };
  } catch (error: any) {
    console.error('❌ Failed to get orders by date:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to get revenue trend (restaurant-specific)
export function getRevenueTrend(days: number, restaurantId: string) {
  try {
    const trend = statements.getRevenueTrend.all(days, restaurantId);
    return { success: true, data: trend };
  } catch (error: any) {
    console.error('❌ Failed to get revenue trend:', error);
    return { success: false, error: error.message };
  }
}

// Helper function for cleanup (restaurant-specific)
export function cleanupOldOrders(days: number = 90, restaurantId: string) {
  try {
    const result = statements.deleteOldOrders.run(days, restaurantId);
    console.log(`🗑️ Cleaned up ${result.changes} old orders for restaurant ${restaurantId} (older than ${days} days)`);
    return { success: true, deleted: result.changes };
  } catch (error: any) {
    console.error('❌ Failed to cleanup orders:', error);
    return { success: false, error: error.message };
  }
}

// ── ITEM MAPPING & STATION ROUTING SCHEMA ────────────────────────────────────
db.exec(`
  -- Source-agnostic canonical item registry
  CREATE TABLE IF NOT EXISTS canonical_items (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT NOT NULL UNIQUE,
    category TEXT,
    station_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- CocoEats food_id → canonical item (one-to-one per food_id)
  CREATE TABLE IF NOT EXISTS cocoeats_item_map (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    food_id           TEXT NOT NULL UNIQUE,
    food_name         TEXT NOT NULL,
    canonical_item_id INTEGER NOT NULL REFERENCES canonical_items(id) ON DELETE CASCADE
  );

  -- Kitchen stations (stub for future routing UI)
  CREATE TABLE IF NOT EXISTS stations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    color       TEXT NOT NULL DEFAULT '#6b7280',
    description TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_ce_map_canonical ON cocoeats_item_map(canonical_item_id);
`);

// ── tmbill_item_map migration: old schema used item_name as UNIQUE key;
//    new schema uses item_id (stable integer from TMBILL POS menu endpoint).
//    Detect old schema and migrate — safe because no real production data yet.
{
  const cols = (db.prepare("PRAGMA table_info(tmbill_item_map)").all() as any[]);
  const hasItemId = cols.some((c: any) => c.name === 'item_id');
  if (cols.length > 0 && !hasItemId) {
    db.exec('DROP TABLE IF EXISTS tmbill_item_map;');
    console.log('⚠️  tmbill_item_map migrated to item_id-based schema (old name-based data cleared)');
  }
}

db.exec(`
  -- TMBILL item_id → canonical item (stable ID from /menu endpoint)
  CREATE TABLE IF NOT EXISTS tmbill_item_map (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id           INTEGER NOT NULL UNIQUE,
    item_name         TEXT    NOT NULL,
    canonical_item_id INTEGER NOT NULL REFERENCES canonical_items(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_tb_map_canonical ON tmbill_item_map(canonical_item_id);
`);

// ── Migrate: add station TEXT column if not present ──────────────────────────
try { db.exec(`ALTER TABLE canonical_items ADD COLUMN station TEXT`); } catch { /* already exists */ }

console.log('✅ Item mapping schema ready');

// ── Mapping prepared statements ───────────────────────────────────────────────
const mappingStatements = {
  // Fetch all canonical items with their CocoEats + TMBILL mappings
  getAllCanonical: db.prepare(`
    SELECT
      c.id, c.name, c.category, c.station_id, c.station, c.created_at,
      (SELECT json_group_array(json_object('id', m.id, 'food_id', m.food_id, 'food_name', m.food_name))
       FROM cocoeats_item_map m WHERE m.canonical_item_id = c.id) AS cocoeats_maps,
      (SELECT json_group_array(json_object('id', t.id, 'item_id', t.item_id, 'item_name', t.item_name))
       FROM tmbill_item_map t WHERE t.canonical_item_id = c.id) AS tmbill_maps
    FROM canonical_items c
    ORDER BY c.name ASC
  `),

  addCanonical: db.prepare(`
    INSERT INTO canonical_items (name, category) VALUES (?, ?)
  `),

  updateCanonical: db.prepare(`
    UPDATE canonical_items SET name = ?, category = ? WHERE id = ?
  `),

  deleteCanonical: db.prepare(`
    DELETE FROM canonical_items WHERE id = ?
  `),

  addCocoeatsMap: db.prepare(`
    INSERT OR REPLACE INTO cocoeats_item_map (food_id, food_name, canonical_item_id)
    VALUES (?, ?, ?)
  `),

  removeCocoeatsMap: db.prepare(`
    DELETE FROM cocoeats_item_map WHERE food_id = ?
  `),

  addTmbillMap: db.prepare(`
    INSERT OR REPLACE INTO tmbill_item_map (item_id, item_name, canonical_item_id)
    VALUES (?, ?, ?)
  `),

  removeTmbillMap: db.prepare(`
    DELETE FROM tmbill_item_map WHERE item_id = ?
  `),

  setStation: db.prepare(`
    UPDATE canonical_items SET station = ? WHERE id = ?
  `),

  lookupByFoodId: db.prepare(`
    SELECT c.* FROM canonical_items c
    JOIN cocoeats_item_map m ON m.canonical_item_id = c.id
    WHERE m.food_id = ?
  `),

  lookupByTmbillItemId: db.prepare(`
    SELECT c.* FROM canonical_items c
    JOIN tmbill_item_map t ON t.canonical_item_id = c.id
    WHERE t.item_id = ?
  `),
};

// ── Mapping helper functions ──────────────────────────────────────────────────

export function getAllCanonicalItems() {
  try {
    const rows = mappingStatements.getAllCanonical.all() as any[];
    return {
      success: true,
      data: rows.map(r => ({
        ...r,
        cocoeats_maps: r.cocoeats_maps ? JSON.parse(r.cocoeats_maps) : [],
        tmbill_maps:   r.tmbill_maps   ? JSON.parse(r.tmbill_maps)   : [],
      })),
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function addCanonicalItem(name: string, category: string | null) {
  try {
    const result = mappingStatements.addCanonical.run(name, category ?? null);
    return { success: true, id: result.lastInsertRowid };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function updateCanonicalItem(id: number, name: string, category: string | null) {
  try {
    mappingStatements.updateCanonical.run(name, category ?? null, id);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function deleteCanonicalItem(id: number) {
  try {
    mappingStatements.deleteCanonical.run(id);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function addCocoeatsMap(foodId: string, foodName: string, canonicalItemId: number) {
  try {
    mappingStatements.addCocoeatsMap.run(foodId, foodName, canonicalItemId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function removeCocoeatsMap(foodId: string) {
  try {
    mappingStatements.removeCocoeatsMap.run(foodId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function addTmbillMap(itemId: number, itemName: string, canonicalItemId: number) {
  try {
    mappingStatements.addTmbillMap.run(itemId, itemName, canonicalItemId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function removeTmbillMap(itemId: number) {
  try {
    mappingStatements.removeTmbillMap.run(itemId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function setCanonicalStation(id: number, station: string | null) {
  try {
    mappingStatements.setStation.run(station ?? null, id);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Graceful shutdown
export function closeDatabase() {
  try {
    db.close();
    console.log('✅ Database closed successfully');
  } catch (error) {
    console.error('❌ Error closing database:', error);
  }
}

export default db;



// Windows: C:\ProgramData\CocoKDS\kds-data.db
// macOS: /Library/Application Support/CocoKDS/kds-data.db
// Linux: /opt/cocokds/kds-data.db