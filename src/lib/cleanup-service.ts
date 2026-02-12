import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const DB_PATHS = {
  main: '/mnt/user/appdata/plex/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db',
  kids: '/mnt/remotes/Kid_Server_Appdata/KidsPlexServer/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db',
  backup: '/mnt/remotes/Kid_Server_Appdata/MainPlexBackup/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db'
};

const ADMIN_DB_PATH = path.join(process.cwd(), 'data', 'dev.db');

// --- PLEX QUERY ---
const CORE_SELECT = `
    SELECT 
        MAX(datetime(viewed_at, 'unixepoch', 'localtime')) as last_viewed,
        datetime(mi.created_at, 'unixepoch', 'localtime') AS added_at,
        CASE 
            WHEN mp.file LIKE ('%/Kid_TV/%')      THEN replace(mp.file,'/Kid_TV/','/mnt/user/Kid_TV_Shows/')
            WHEN mp.file LIKE ('%/tv/%')          THEN replace(mp.file,'/tv/','/mnt/user/TV_Shows/')
            WHEN mp.file LIKE ('%/movies/%')      THEN replace(mp.file,'/movies/','/mnt/user/Movies/')
            WHEN mp.file LIKE ('%/4k_Movies/%')   THEN replace(mp.file,'/4k_Movies/','/mnt/user/4k_Movies/')
            WHEN mp.file LIKE ('%/Kid_Movies/%')  THEN replace(mp.file,'/Kid_Movies/','/mnt/user/Kid_Movies/')
            WHEN mp.file LIKE ('%/4k_tv_shows/%') THEN replace(mp.file,'/4k_tv_shows/','/mnt/user/4k_TV_Shows/')
            ELSE mp.file
        END AS file_path,
        mi.title
    FROM metadata_items AS mi
    JOIN library_sections AS ls ON mi.library_section_id = ls.id
    JOIN media_items AS mitem ON mitem.metadata_item_id = mi.id
    JOIN media_parts AS mp ON mp.media_item_id = mitem.id
    LEFT JOIN metadata_item_views AS miv ON miv.guid = mi.guid
    WHERE ls.name IN ('Movies','TV Shows')
`;

export async function syncCleanupData() {
  const db = new Database(ADMIN_DB_PATH);
  
  // 1. Ensure Tables Exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS cleanup_queue (
      filepath TEXT PRIMARY KEY,
      title TEXT,
      last_active TEXT,
      added_at TEXT
    );
    CREATE TABLE IF NOT EXISTS cleanup_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filepath TEXT,
      title TEXT,
      last_active TEXT,
      added_at TEXT,
      deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. AUTO-MIGRATION (The "Safe Way")
  // Checks if 'added_at' is missing and adds it without deleting data
  const migrate = (table: string, col: string, type: string) => {
    const info = db.pragma(`table_info(${table})`) as any[];
    if (!info.some(c => c.name === col)) {
        console.log(`[Migration] Updating ${table}: Adding missing column '${col}'...`);
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
    }
  };

  migrate('cleanup_queue', 'added_at', 'TEXT');
  migrate('cleanup_history', 'added_at', 'TEXT');

  // --- STANDARD SYNC LOGIC BELOW ---
  let plexDB;
  
  try {
    plexDB = new Database(DB_PATHS.main, { readonly: true });
    plexDB.exec(`ATTACH DATABASE '${DB_PATHS.kids}' AS kids`);
    plexDB.exec(`ATTACH DATABASE '${DB_PATHS.backup}' AS backup`);

    const query = `
      SELECT DISTINCT
          MAX(IFNULL(last_viewed, added_at)) as last_active,
          added_at,
          file_path,
          title
      FROM (
          ${CORE_SELECT}
          UNION ALL
          ${CORE_SELECT.replace(/FROM metadata_items/g, 'FROM kids.metadata_items')}
          UNION ALL
          ${CORE_SELECT.replace(/FROM metadata_items/g, 'FROM backup.metadata_items')}
      ) ALL_Activity
      WHERE file_path IS NOT NULL
      GROUP BY file_path
    `;

    const currentPlexItems = plexDB.prepare(query).all();
    plexDB.close();

    const storedItems = db.prepare('SELECT filepath, title, last_active, added_at FROM cleanup_queue').all();
    const currentFileSet = new Set(currentPlexItems.map((i: any) => i.file_path));

    const insertHistory = db.prepare('INSERT INTO cleanup_history (filepath, title, last_active, added_at) VALUES (?, ?, ?, ?)');
    const deleteQueue = db.prepare('DELETE FROM cleanup_queue WHERE filepath = ?');

    const runTransaction = db.transaction((items) => {
      for (const item of items) {
        if (!currentFileSet.has(item.filepath)) {
          if (!fs.existsSync(item.filepath)) {
            // Now safe to insert added_at because we migrated the table above
            insertHistory.run(item.filepath, item.title, item.last_active, item.added_at);
            deleteQueue.run(item.filepath);
          }
        }
      }
    });

    runTransaction(storedItems);

    const upsertQueue = db.prepare(`
      INSERT OR REPLACE INTO cleanup_queue (filepath, title, last_active, added_at)
      VALUES (@file_path, @title, @last_active, @added_at)
    `);

    const updateTransaction = db.transaction((items) => {
        for (const item of items) upsertQueue.run(item);
    });

    updateTransaction(currentPlexItems);
    
    return { success: true };

  } catch (error) {
    console.error("Sync Error:", error);
    throw error;
  } finally {
    if (db.open) db.close();
    if (plexDB && plexDB.open) plexDB.close();
  }
}