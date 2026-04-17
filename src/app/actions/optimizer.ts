"use server"

import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import Database from 'better-sqlite3';

const execPromise = util.promisify(exec);

// --- Environment Variable Config (with fallbacks) ---
const MOUNT_PATH = process.env.ARRAY_MOUNT_PATH || "/mnt/user";
const DB_MAIN_SOURCE = process.env.PLEX_DB_MAIN || "/mnt/user/appdata/plex/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db";
const DB_KIDS_SOURCE = process.env.PLEX_DB_KIDS || "/mnt/remotes/Kid_Server_Appdata/KidsPlexServer/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db";
const DB_BACKUP_SOURCE = process.env.PLEX_DB_BACKUP || "/mnt/remotes/Kid_Server_Appdata/MainPlexBackup/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db";
const TDARR_API = process.env.TDARR_API_URL || "http://192.168.1.87:8265";

export async function getDiskUsage() {
  try {
    const { stdout } = await execPromise(`df -h "${MOUNT_PATH}" | awk 'NR==2 {gsub("%",""); print $5}'`);
    return parseInt(stdout.trim(), 10);
  } catch (error) {
    console.error("Failed to get disk usage", error);
    return 0;
  }
}

export async function getOldestMedia() {
  const DB_MAIN_TMP = "/tmp/main_plex_snapshot.db";
  const DB_KIDS_TMP = "/tmp/kids_plex_snapshot.db";
  const DB_BACKUP_TMP = "/tmp/backup_plex_snapshot.db";

  try {
    // 1. Create snapshots using the configurable source paths
    fs.copyFileSync(DB_MAIN_SOURCE, DB_MAIN_TMP);
    fs.copyFileSync(DB_KIDS_SOURCE, DB_KIDS_TMP);
    fs.copyFileSync(DB_BACKUP_SOURCE, DB_BACKUP_TMP);

    const db = new Database(DB_MAIN_TMP, { readonly: true });
    
    // 2. Attach the other databases
    db.exec(`ATTACH DATABASE '${DB_KIDS_TMP}' AS kids;`);
    db.exec(`ATTACH DATABASE '${DB_BACKUP_TMP}' AS backup;`);

    // 3. Your massive SQL query
    const stmt = db.prepare(`
      WITH AllMedia AS (
          SELECT 
              CASE WHEN mi.guid LIKE '%local%' THEN hints ELSE mi.guid END AS guid,
              CASE WHEN datetime(mi.created_at, 'unixepoch', 'localtime') > miv.viewed_at 
                   THEN datetime(mi.created_at, 'unixepoch', 'localtime') 
                   ELSE IFNULL(miv.viewed_at, datetime(mi.created_at, 'unixepoch', 'localtime')) 
              END AS active_dt,
              CASE 
                  WHEN mp.file LIKE '%/Kid_TV/%'      THEN replace(mp.file,'/Kid_TV/','/mnt/user/Kid_TV_Shows/')
                  WHEN mp.file LIKE '%/Kid_tvshows/%' THEN replace(mp.file,'/Kid_tvshows/','/mnt/user/Kid_TV_Shows/')
                  WHEN mp.file LIKE '%/4k_tv_shows/%' THEN replace(mp.file,'/4k_tv_shows/','/mnt/user/4k_TV_Shows/')
                  WHEN mp.file LIKE '%/tvshows/%'     THEN replace(mp.file,'/tvshows/','/mnt/user/Kid_TV_Shows/')
                  WHEN mp.file LIKE '%/tv_shows/%'    THEN replace(mp.file,'/tv_shows/','/mnt/user/TV_Shows/')
                  WHEN mp.file LIKE '%/tv/%'          THEN replace(mp.file,'/tv/','/mnt/user/TV_Shows/')
                  WHEN mp.file LIKE '%/4k_Movies/%'   THEN replace(mp.file,'/4k_Movies/','/mnt/user/4k_Movies/')
                  WHEN mp.file LIKE '%/4k_movies/%'   THEN replace(mp.file,'/4k_movies/','/mnt/user/4k_Movies/')
                  WHEN mp.file LIKE '%/Kid_Movies/%'  THEN replace(mp.file,'/Kid_Movies/','/mnt/user/Kid_Movies/')
                  WHEN mp.file LIKE '%/Kid_movies/%'  THEN replace(mp.file,'/Kid_movies/','/mnt/user/Kid_Movies/')
                  WHEN mp.file LIKE '%/movies/%' AND ls.name = 'Kids Movies' THEN replace(mp.file,'/movies/','/mnt/user/Kid_Movies/')
                  WHEN mp.file LIKE '%/movies/%'      THEN replace(mp.file,'/movies/','/mnt/user/Movies/')
                  ELSE mp.file
              END AS file_path
          FROM metadata_items AS mi
          JOIN library_sections AS ls ON mi.library_section_id = ls.id
          JOIN media_items AS mitem ON mitem.metadata_item_id = mi.id
          JOIN media_parts AS mp ON mp.media_item_id = mitem.id
          LEFT JOIN (SELECT MAX(datetime(viewed_at, 'unixepoch', 'localtime')) AS viewed_at, guid FROM metadata_item_views GROUP BY guid) miv ON miv.guid = mi.guid
          WHERE ls.name IN ('Movies','TV Shows', 'Kids Movies', 'Kids TV Shows')
      
          UNION ALL
      
          SELECT 
              CASE WHEN mi.guid LIKE '%local%' THEN hints ELSE mi.guid END AS guid,
              CASE WHEN datetime(mi.created_at, 'unixepoch', 'localtime') > miv.viewed_at 
                   THEN datetime(mi.created_at, 'unixepoch', 'localtime') 
                   ELSE IFNULL(miv.viewed_at, datetime(mi.created_at, 'unixepoch', 'localtime')) 
              END AS active_dt,
              CASE 
                  WHEN mp.file LIKE '%/Kid_TV/%'      THEN replace(mp.file,'/Kid_TV/','/mnt/user/Kid_TV_Shows/')
                  WHEN mp.file LIKE '%/Kid_tvshows/%' THEN replace(mp.file,'/Kid_tvshows/','/mnt/user/Kid_TV_Shows/')
                  WHEN mp.file LIKE '%/4k_tv_shows/%' THEN replace(mp.file,'/4k_tv_shows/','/mnt/user/4k_TV_Shows/')
                  WHEN mp.file LIKE '%/tvshows/%'     THEN replace(mp.file,'/tvshows/','/mnt/user/Kid_TV_Shows/')
                  WHEN mp.file LIKE '%/tv_shows/%'    THEN replace(mp.file,'/tv_shows/','/mnt/user/TV_Shows/')
                  WHEN mp.file LIKE '%/tv/%'          THEN replace(mp.file,'/tv/','/mnt/user/TV_Shows/')
                  WHEN mp.file LIKE '%/4k_Movies/%'   THEN replace(mp.file,'/4k_Movies/','/mnt/user/4k_Movies/')
                  WHEN mp.file LIKE '%/4k_movies/%'   THEN replace(mp.file,'/4k_movies/','/mnt/user/4k_Movies/')
                  WHEN mp.file LIKE '%/Kid_Movies/%'  THEN replace(mp.file,'/Kid_Movies/','/mnt/user/Kid_Movies/')
                  WHEN mp.file LIKE '%/Kid_movies/%'  THEN replace(mp.file,'/Kid_movies/','/mnt/user/Kid_Movies/')
                  WHEN mp.file LIKE '%/movies/%' AND ls.name = 'Kids Movies' THEN replace(mp.file,'/movies/','/mnt/user/Kid_Movies/')
                  WHEN mp.file LIKE '%/movies/%'      THEN replace(mp.file,'/movies/','/mnt/user/Movies/')
                  ELSE mp.file
              END AS file_path
          FROM kids.metadata_items AS mi
          JOIN kids.library_sections AS ls ON mi.library_section_id = ls.id
          JOIN kids.media_items AS mitem ON mitem.metadata_item_id = mi.id
          JOIN kids.media_parts AS mp ON mp.media_item_id = mitem.id
          LEFT JOIN (SELECT MAX(datetime(viewed_at, 'unixepoch', 'localtime')) AS viewed_at, guid FROM kids.metadata_item_views GROUP BY guid) miv ON miv.guid = mi.guid
          WHERE ls.name IN ('Movies','TV Shows', 'Kids Movies', 'Kids TV Shows')
      
          UNION ALL
      
          SELECT 
              CASE WHEN mi.guid LIKE '%local%' THEN hints ELSE mi.guid END AS guid,
              CASE WHEN datetime(mi.created_at, 'unixepoch', 'localtime') > miv.viewed_at 
                   THEN datetime(mi.created_at, 'unixepoch', 'localtime') 
                   ELSE IFNULL(miv.viewed_at, datetime(mi.created_at, 'unixepoch', 'localtime')) 
              END AS active_dt,
              CASE 
                  WHEN mp.file LIKE '%/Kid_TV/%'      THEN replace(mp.file,'/Kid_TV/','/mnt/user/Kid_TV_Shows/')
                  WHEN mp.file LIKE '%/4k_movies/%'   THEN replace(mp.file,'/4k_movies/','/mnt/user/4k_Movies/')
                  WHEN mp.file LIKE '%Kid_movies%'    THEN replace(mp.file,'/Kid_movies/','/mnt/user/Kid_Movies/')
                  WHEN mp.file LIKE '%/Kid_tvshows/%' THEN replace(mp.file,'/Kid_tvshows/','/mnt/user/Kid_TV_Shows/')
                  WHEN mp.file LIKE '%/4k_tv_shows/%' THEN replace(mp.file,'/4k_tv_shows/','/mnt/user/4k_TV_Shows/')
                  WHEN mp.file LIKE '%/tvshows/%'     THEN replace(mp.file,'/tvshows/','/mnt/user/Kid_TV_Shows/')
                  WHEN mp.file LIKE '%/tv_shows/%'    THEN replace(mp.file,'/tv_shows/','/mnt/user/TV_Shows/')
                  WHEN mp.file LIKE '%/tv/%'          THEN replace(mp.file,'/tv/','/mnt/user/TV_Shows/')
                  WHEN mp.file LIKE '%/4k_Movies/%'   THEN replace(mp.file,'/4k_Movies/','/mnt/user/4k_Movies/')
                  WHEN mp.file LIKE '%/Kid_Movies/%'  THEN replace(mp.file,'/Kid_Movies/','/mnt/user/Kid_Movies/')
                  WHEN mp.file LIKE '%/movies/%' AND ls.name = 'Kids Movies' THEN replace(mp.file,'/movies/','/mnt/user/Kid_Movies/')
                  WHEN mp.file LIKE '%/movies/%'      THEN replace(mp.file,'/movies/','/mnt/user/Movies/')
                  ELSE mp.file
              END AS file_path
          FROM backup.metadata_items AS mi
          JOIN backup.library_sections AS ls ON mi.library_section_id = ls.id
          JOIN backup.media_items AS mitem ON mitem.metadata_item_id = mi.id
          JOIN backup.media_parts AS mp ON mp.media_item_id = mitem.id
          LEFT JOIN (SELECT MAX(datetime(viewed_at, 'unixepoch', 'localtime')) AS viewed_at, guid FROM backup.metadata_item_views GROUP BY guid) miv ON miv.guid = mi.guid
          WHERE ls.name IN ('Movies','TV Shows', 'Kids Movies', 'Kids TV Shows')
      ),
      GlobalGuidActivity AS (
          SELECT guid, MAX(active_dt) AS latest_activity
          FROM AllMedia
          GROUP BY guid
      )
      SELECT DISTINCT
          ga.latest_activity, am.file_path, am.guid
      FROM AllMedia am
      JOIN GlobalGuidActivity ga ON am.guid = ga.guid
      WHERE am.file_path LIKE '/mnt/user/%' 
        AND am.file_path NOT LIKE '%placeholders%'
      ORDER BY ga.latest_activity ASC
      LIMIT 50;
    `);

    const results = stmt.all();
    db.close();

    // 4. Clean up tmp files
    [DB_MAIN_TMP, DB_KIDS_TMP, DB_BACKUP_TMP].forEach(file => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });

    return results as { guid: string; latest_activity: string; file_path: string }[];
  } catch (error) {
    console.error("Database querying failed:", error);
    return [];
  }
}

export async function queueInTdarr(filePath: string) {
  try {
    const response = await fetch(`${TDARR_API}/api/v2/cruddb`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          collection: "FileJSONDB",
          mode: "update",
          docID: filePath,
          obj: { Statc: "Queued" }
        }
      })
    });
    
    return response.ok;
  } catch (error) {
    console.error("Tdarr Queueing Error:", error);
    return false;
  }
}