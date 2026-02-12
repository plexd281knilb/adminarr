import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const DB_PATHS = {
  main: '/mnt/remotes/Main_Appdata/plex/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db',
  kids: '/mnt/user/appdata/KidsPlexServer/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db',
  backup: '/mnt/user/appdata/MainPlexBackup/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db'
};

const ADMIN_DB_PATH = path.join(process.cwd(), 'data', 'dev.db');

// --- HELPER TO BUILD SQL FOR EACH DB ---
// This ensures we join 'kids.media_items' with 'kids.media_parts', not mixing DBs.
const buildSelect = (dbPrefix: string = "") => {
    const p = dbPrefix ? `${dbPrefix}.` : ""; // e.g. "kids." or ""
    
    return `
    SELECT 
        miv.viewed_at,
        datetime(${p}mi.created_at, 'unixepoch', 'localtime') AS added_at,
        CASE 
            WHEN ${p}mp.file LIKE ('%/Kid_TV/%')      THEN replace(${p}mp.file,'/Kid_TV/','/mnt/user/Kid_TV_Shows/')
            WHEN ${p}mp.file LIKE ('%/tv/%')          THEN replace(${p}mp.file,'/tv/','/mnt/user/TV_Shows/')
            WHEN ${p}mp.file LIKE ('%/movies/%')      THEN replace(${p}mp.file,'/movies/','/mnt/user/Movies/')
            WHEN ${p}mp.file LIKE ('%/4k_Movies/%')   THEN replace(${p}mp.file,'/4k_Movies/','/mnt/user/4k_Movies/')
            WHEN ${p}mp.file LIKE ('%/Kid_Movies/%')  THEN replace(${p}mp.file,'/Kid_Movies/','/mnt/user/Kid_Movies/')
            WHEN ${p}mp.file LIKE ('%/4k_tv_shows/%') THEN replace(${p}mp.file,'/4k_tv_shows/','/mnt/user/4k_TV_Shows/')
            ELSE ${p}mp.file
        END AS file_path,
        ${p}mi.title
    FROM ${p}metadata_items AS ${p}mi
    JOIN ${p}library_sections AS ${p}ls ON ${p}mi.library_section_id = ${p}ls.id
    JOIN ${p}media_items AS ${p}mitem ON ${p}mitem.metadata_item_id = ${p}mi.id
    JOIN ${p}media_parts AS ${p}mp ON ${p}mp.media_item_id = ${p}mitem.id
    LEFT JOIN (
        SELECT MAX(datetime(viewed_at, 'unixepoch', 'localtime')) AS viewed_at, guid
        FROM ${p}metadata_item_views GROUP BY guid
    ) miv ON miv.guid = ${p}mi.guid
    WHERE ${p}ls.name IN ('Movies','TV Shows')
    `;
};

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

  // 2. AUTO-MIGRATION
  const migrate = (table: string, col: string, type: string) => {
    const info = db.pragma(`table_info(${table})`) as any[];
    if (!info.some(c => c.name === col)) {
        console.log(`[Migration] Updating ${table}: Adding missing column '${col}'...`);
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
    }
  };
  migrate('cleanup_queue', 'added_at', 'TEXT');
  migrate('cleanup_history', 'added_at', 'TEXT');

  let plexDB;
  
  try {
    // 3. QUERY PLEX (READ ONLY)
    plexDB = new Database(DB_PATHS.main, { readonly: true, fileMustExist: true });
    plexDB.exec(`ATTACH DATABASE '${DB_PATHS.kids}' AS kids`);
    plexDB.exec(`ATTACH DATABASE '${DB_PATHS.backup}' AS backup`);

    // Combine queries from Main, Kids, and Backup
    const query = `
      SELECT DISTINCT
          MAX(IFNULL(viewed_at, added_at)) as last_active,
          added_at,
          file_path,
          title
      FROM (
          ${buildSelect("")}       -- MAIN
          UNION ALL
          ${buildSelect("kids")}   -- KIDS
          UNION ALL
          ${buildSelect("backup")} -- BACKUP
      ) ALL_Activity
      WHERE file_path IS NOT NULL
      GROUP BY file_path
    `;

    console.log("[Sync] Executing Plex Query...");
    const currentPlexItems = plexDB.prepare(query).all();
    console.log(`[Sync] Found ${currentPlexItems.length} items from Plex.`);

    plexDB.close();

    // 4. SYNC WITH LOCAL DB
    const storedItems = db.prepare('SELECT filepath, title, last_active, added_at FROM cleanup_queue').all();
    const currentFileSet = new Set(currentPlexItems.map((i: any) => i.file_path));

    const insertHistory = db.prepare('INSERT INTO cleanup_history (filepath, title, last_active, added_at) VALUES (?, ?, ?, ?)');
    const deleteQueue = db.prepare('DELETE FROM cleanup_queue WHERE filepath = ?');

    const runTransaction = db.transaction((items) => {
      for (const item of items) {
        if (!currentFileSet.has(item.filepath)) {
          // If file is gone from Plex AND gone from disk -> History
          if (!fs.existsSync(item.filepath)) {
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
    
    return { success: true, count: currentPlexItems.length };

  } catch (error) {
    console.error("Sync Error:", error);
    throw error;
  } finally {
    if (db.open) db.close();
    if (plexDB && plexDB.open) plexDB.close();
  }
}