import { PrismaClient } from "@prisma/client";

// Singleton pattern for Prisma
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// --- DATA FETCHERS (For Page Load) ---

export async function getSettings() {
  let settings = await prisma.settings.findUnique({ where: { id: "global" } });
  if (!settings) {
    settings = await prisma.settings.create({ data: { id: "global" } });
  }
  return settings;
}

export async function getTautulliInstances() {
  return await prisma.tautulliInstance.findMany({ orderBy: { createdAt: "asc" } });
}

export async function getSubscribers() {
  return await prisma.subscriber.findMany({ orderBy: { name: "asc" } });
}

// --- SYNC LOGIC (VERBOSE DEBUGGING) ---

export async function performSync() {
  const logs: string[] = [];
  console.log("[Sync] Starting Tautulli Sync Process...");
  logs.push("Starting Sync Process...");

  const instances = await prisma.tautulliInstance.findMany();
  if (instances.length === 0) {
      console.log("[Sync] Error: No Tautulli instances found.");
      logs.push("Error: No Tautulli instances configured in Settings.");
      return { success: false, logs };
  }

  const mergedUsers = new Map();
  const ignoredUsers = await prisma.ignoredUser.findMany();
  const ignoredIds = new Set(ignoredUsers.map(u => u.plexId));
  console.log(`[Sync] Found ${ignoredIds.size} ignored users.`);
  logs.push(`Found ${ignoredIds.size} ignored users.`);

  let successfulFetches = 0;

  const fetchInstanceData = async (instance: any) => {
    try {
        const baseUrl = instance.url.replace(/\/$/, "");
        console.log(`[Sync] Connecting to ${instance.name} at ${baseUrl}...`);
        logs.push(`Connecting to Tautulli: ${instance.name} (${baseUrl})...`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); 

        const url = `${baseUrl}/api/v2?apikey=${instance.apiKey}&cmd=get_users_table&order_column=last_seen&order_dir=desc&length=1000`;
        
        const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
        clearTimeout(timeoutId); 
        
        if (res.status === 401) throw new Error("401 Unauthorized - Check API Key");
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        
        const data = await res.json();
        const users = data?.response?.data?.data || [];
        
        console.log(`[Sync] Success: ${instance.name} returned ${users.length} users.`);
        logs.push(`Success: Fetched ${users.length} users from ${instance.name}.`);
        successfulFetches++;
        return users;
    } catch (err: any) { 
        const msg = err.name === 'AbortError' ? 'Connection Timed Out' : err.message;
        console.error(`[Sync] FAILED ${instance.name}: ${msg}`); 
        logs.push(`Failed to sync ${instance.name}: ${msg}`);
        return []; 
    }
  };

  const results = await Promise.all(instances.map(fetchInstanceData));

  if (successfulFetches === 0) {
      console.error("[Sync] CRITICAL: All Tautulli connections failed.");
      logs.push("CRITICAL: All Tautulli connections failed. Aborting database update.");
      return { success: false, logs };
  }

  results.flat().forEach((u: any) => {
      const plexId = String(u.user_id);
      if (ignoredIds.has(plexId)) return; 

      const lastSeen = u.last_seen ? Number(u.last_seen) : 0;
      let title = null;
      if (u.last_played) title = u.last_played; 

      if (!mergedUsers.has(plexId) || lastSeen > mergedUsers.get(plexId).lastSeen) {
          mergedUsers.set(plexId, { 
              plexId: plexId, 
              name: u.friendly_name || u.username, 
              email: u.email, 
              avatarUrl: u.user_thumb, 
              lastSeen: lastSeen,
              title: title
          });
      }
  });

  console.log(`[Sync] Processing ${mergedUsers.size} unique users for DB update...`);
  logs.push(`Processing ${mergedUsers.size} unique users...`);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const oneYearAgo = nowSeconds - (365 * 24 * 60 * 60);
  let added = 0;
  let updated = 0;

  try {
      for (const [plexId, userData] of mergedUsers) {
          const lastWatchedDate = userData.lastSeen > 0 ? new Date(userData.lastSeen * 1000) : null;
          
          if (userData.lastSeen > oneYearAgo) {
              const existing = await prisma.subscriber.findUnique({ where: { plexId } });
              if (existing) { 
                  await prisma.subscriber.update({ 
                      where: { id: existing.id }, 
                      data: { 
                          avatarUrl: userData.avatarUrl, 
                          lastWatched: lastWatchedDate,
                          lastWatchedTitle: userData.title
                      } 
                  }); 
                  updated++;
              } else { 
                  console.log(`[Sync] Creating new user: ${userData.name}`);
                  await prisma.subscriber.create({ 
                      data: { 
                          plexId: plexId, 
                          name: userData.name, 
                          email: userData.email, 
                          avatarUrl: userData.avatarUrl, 
                          lastWatched: lastWatchedDate, 
                          lastWatchedTitle: userData.title,
                          status: "Active", 
                          isManual: false,
                          nextPaymentDate: new Date(new Date().setDate(new Date().getDate() + 30)) 
                      } 
                  }); 
                  added++;
              }
          }
      }
  } catch (e: any) {
      console.error(`[Sync] CRITICAL DB ERROR: ${e.message}`); 
      console.error(e); 
      logs.push(`CRITICAL DB ERROR: ${e.message}`);
      return { success: false, logs };
  }

  console.log(`[Sync] Complete. Added: ${added}, Updated: ${updated}`);
  logs.push(`Sync Complete: ${added} added, ${updated} updated.`);
  return { success: true, logs };
}