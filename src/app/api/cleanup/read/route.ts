import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

// Points to your local Adminarr database
const ADMIN_DB_PATH = path.join(process.cwd(), 'data', 'dev.db');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  
  // Open DB Read-Only
  // If this fails, make sure the ./data/dev.db file exists (created by the cron job)
  let db;
  try {
      db = new Database(ADMIN_DB_PATH, { readonly: true, fileMustExist: false });
  } catch (e) {
      // If DB doesn't exist yet (first run), return empty list instead of crashing
      return NextResponse.json([]);
  }

  try {
    let rows = [];
    
    // Check if tables exist before querying
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cleanup_queue'").get();
    
    if (tableExists) {
        if (type === 'history') {
            rows = db.prepare('SELECT * FROM cleanup_history ORDER BY deleted_at DESC LIMIT 500').all();
        } else {
            rows = db.prepare('SELECT * FROM cleanup_queue ORDER BY last_active ASC LIMIT 500').all();
        }
    }

    db.close();
    return NextResponse.json(rows);
  } catch (error) {
    if (db && db.open) db.close();
    console.error("API Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}