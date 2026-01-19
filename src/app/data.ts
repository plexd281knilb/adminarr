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

export async function getGlancesInstances() {
  return await prisma.glancesInstance.findMany({ orderBy: { createdAt: "asc" } });
}

export async function getSubscribers() {
  return await prisma.subscriber.findMany({ orderBy: { name: "asc" } });
}

export async function getServices() {
  return await prisma.service.findMany({ orderBy: { name: "asc" } });
}

export async function getMediaApps() {
    return await prisma.mediaApp.findMany({ orderBy: { type: "asc" } });
}

// --- LIVE DASHBOARD LOGIC (Auto-Detect v4/v3/v2) ---

export async function fetchDashboardData() {
  const [tautulliInstances, glancesInstances] = await Promise.all([
    prisma.tautulliInstance.findMany(),
    prisma.glancesInstance.findMany()
  ]);

  // 1. FETCH PLEX (Tautulli)
  const fetchTautulli = async (instance: any) => {
    try {
      const baseUrl = instance.url.replace(/\/$/, "");
      const url = `${baseUrl}/api/v2?apikey=${instance.apiKey}&cmd=get_activity`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      
      const res = await fetch(url, { cache: "no-store", signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();

      if (data?.response?.data) {
        return {
          type: "plex",
          name: instance.name,
          online: true,
          streamCount: Number(data.response.data.stream_count) || 0,
          wanBandwidth: Number(data.response.data.wan_bandwidth) || 0,
          sessions: data.response.data.sessions || [],
        };
      }
    } catch (e) { /* ignore */ }
    return { type: "plex", name: instance.name, online: false };
  };

  // 2. FETCH HARDWARE (Glances)
  const fetchGlances = async (instance: any) => {
    const baseUrl = instance.url.replace(/\/$/, "");

    const tryFetch = async (version: number) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        
        const quickUrl = `${baseUrl}/api/${version}/quicklook`;
        const fsUrl = `${baseUrl}/api/${version}/fs`;
        const netUrl = `${baseUrl}/api/${version}/network`;

        try {
            const [quickReq, fsReq, netReq] = await Promise.all([
                fetch(quickUrl, { cache: "no-store", signal: controller.signal }),
                fetch(fsUrl, { cache: "no-store", signal: controller.signal }),
                fetch(netUrl, { cache: "no-store", signal: controller.signal })
            ]);
            clearTimeout(timeoutId);

            if (!quickReq.ok || !fsReq.ok) return null;
            
            return {
                quick: await quickReq.json(),
                fs: await fsReq.json(),
                network: netReq.ok ? await netReq.json() : []
            };
        } catch (e: any) {
            clearTimeout(timeoutId);
            return null;
        }
    };

    try {
        let data = await tryFetch(4);
        if (!data) data = await tryFetch(3);
        if (!data) data = await tryFetch(2);

        if (!data) {
            return { id: instance.id, type: "hardware", name: instance.name, online: false };
        }

        const { quick, fs, network } = data;

        // --- NETWORK: FILTER DUPLICATES ---
        let totalRx = 0;
        let totalTx = 0;
        if (Array.isArray(network)) {
            network.forEach((n: any) => {
                const name = n.interface_name;
                const isIgnored = 
                    name === "lo" || 
                    name.startsWith("veth") || 
                    name.startsWith("docker") ||
                    name.startsWith("br") ||   
                    name.startsWith("bond");   

                if (!isIgnored) {
                    totalRx += (n.bytes_recv_rate_per_sec || n.rx || 0);
                    totalTx += (n.bytes_sent_rate_per_sec || n.tx || 0);
                }
            });
        }

        // --- DISK: SMART SELECTOR ---
        const disks = Array.isArray(fs) ? fs : [];
        const cleanDisks = disks.filter(d => 
            !d.mnt_point.startsWith("/boot") && !d.mnt_point.startsWith("/efi") &&
            !d.mnt_point.startsWith("/run") && !d.mnt_point.includes("docker")
        );

        const mainDisk = cleanDisks.find((d: any) => d.mnt_point === '/mnt/user') || 
                         cleanDisks.sort((a:any, b:any) => (b.size || 0) - (a.size || 0))[0] || 
                         { percent: 0, mnt_point: "Disk" };

        const cpu = quick.cpu?.total ?? quick.cpu ?? 0;
        const mem = quick.mem?.percent ?? quick.mem ?? 0;

        return {
            id: instance.id,
            type: "hardware",
            name: instance.name,
            online: true,
            cpu: cpu,
            mem: mem,
            diskPercent: mainDisk.percent || 0,
            diskName: mainDisk.mnt_point || "Disk",
            rx: totalRx,
            tx: totalTx
        };

    } catch (e) { 
        return { id: instance.id, type: "hardware", name: instance.name, online: false };
    }
  };

  const results = await Promise.all([
    ...tautulliInstances.map(fetchTautulli),
    ...glancesInstances.map(fetchGlances)
  ]);

  return results;
}

// --- MEDIA APP ACTIVITY FETCHERS ---

export async function fetchMediaAppsActivity() {
  const apps = await prisma.mediaApp.findMany({ orderBy: { type: "asc" } });

  const results = await Promise.all(apps.map(async (app) => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); 
        const cleanUrl = app.url.replace(/\/$/, "");
        let data: any = { id: app.id, type: app.type, name: app.name, online: false };

        const fetchArrQueue = async () => {
             try {
                const res = await fetch(`${cleanUrl}/api/v3/queue?apikey=${app.apiKey}&pageSize=20`, { signal: controller.signal, cache: "no-store" });
                if (res.ok) return await res.json();
             } catch(e) {}
             const res = await fetch(`${cleanUrl}/api/v1/queue?apikey=${app.apiKey}&pageSize=20`, { signal: controller.signal, cache: "no-store" });
             if (res.ok) return await res.json();
             throw new Error("Failed");
        };

        if (["sonarr", "radarr", "lidarr", "readarr"].includes(app.type)) {
            const json = await fetchArrQueue();
            if (json.records) {
                data.online = true;
                data.queue = json.records;
            }
        }
        
        else if (app.type === "sabnzbd" || app.type === "nzbget") {
            const res = await fetch(`${cleanUrl}/api?mode=queue&output=json&apikey=${app.apiKey}`, { signal: controller.signal, cache: "no-store" });
            const json = await res.json();
            if (json.queue) {
                data.online = true;
                data.queue = json.queue.slots || [];
                data.stats = {
                    speed: json.queue.speed || "0",
                    timeleft: json.queue.timeleft || "0:00",
                    mbleft: json.queue.mbleft || "0",
                    paused: json.queue.paused || false
                };
            }
        }

        else if (app.type === "overseerr" || app.type === "jellyseerr") {
             const res = await fetch(`${cleanUrl}/api/v1/request?take=10&skip=0&sort=added`, { 
                 headers: { "X-Api-Key": app.apiKey || "" },
                 signal: controller.signal, 
                 cache: "no-store" 
             });
             const json = await res.json();

             let pendingCount = 0;
             try {
                const countRes = await fetch(`${cleanUrl}/api/v1/request/count`, { 
                     headers: { "X-Api-Key": app.apiKey || "" },
                     signal: controller.signal,
                     cache: "no-store" 
                });
                if (countRes.ok) {
                    const countJson = await countRes.json();
                    pendingCount = countJson.pending || 0;
                }
             } catch(e) { pendingCount = json.pageInfo?.results || 0; }
             
             if (json.results) {
                 data.online = true;
                 data.requests = await Promise.all(json.results.map(async (r: any) => {
                     let title = "Unknown Title";
                     let poster = r.media?.posterPath || "";
                     try {
                         const mediaType = r.media?.mediaType || "movie";
                         const tmdbId = r.media?.tmdbId;
                         if (tmdbId) {
                            const detailRes = await fetch(`${cleanUrl}/api/v1/${mediaType}/${tmdbId}`, { 
                                headers: { "X-Api-Key": app.apiKey || "" },
                                cache: "force-cache" 
                            });
                            if (detailRes.ok) {
                                const detail = await detailRes.json();
                                title = detail.title || detail.name || detail.originalTitle || "Unknown Title";
                                if (!poster && detail.posterPath) poster = detail.posterPath;
                            }
                         }
                     } catch (err) {}
                     return {
                         id: r.id, status: r.status, requestedBy: r.requestedBy,
                         media: { ...r.media, title, posterPath: poster }
                     };
                 }));
                 data.stats = { total: json.pageInfo?.results || 0, pending: pendingCount };
             }
        }

        else if (app.type === "bazarr") {
            try {
                const res = await fetch(`${cleanUrl}/api/system/status?apikey=${app.apiKey}`, { signal: controller.signal, cache: "no-store" });
                const json = await res.json();
                const ver = json.version || json.data?.version || "Online";
                data.online = true;
                data.stats = { version: ver };
                data.queue = [];
            } catch (e) { /* fail */ }
        }

        else if (app.type === "prowlarr") {
            const res = await fetch(`${cleanUrl}/api/v1/indexer?apikey=${app.apiKey}`, { signal: controller.signal, cache: "no-store" });
            const json = await res.json();
            if (Array.isArray(json)) {
                data.online = true;
                
                // Count items that are explicitly disabled
                const failed = json.filter((i: any) => i.enable === false);
                
                data.stats = { 
                    total: json.length, 
                    failed: failed.length
                };
                
                // Show the disabled indexers in the 'queue' list so you know which ones to fix
                data.queue = failed.map((i: any) => ({
                    title: i.name,
                    status: "Disabled"
                }));
            }
        }

        else if (app.type === "ombi") {
             const res = await fetch(`${cleanUrl}/api/v1/Request/movie?apikey=${app.apiKey}`, { signal: controller.signal, cache: "no-store" });
             const json = await res.json();
             if (Array.isArray(json)) {
                 data.online = true;
                 data.requests = json.map((r: any) => {
                    let userDisplay = "Ombi User";
                    if (r.requestedUser) {
                        if (typeof r.requestedUser === "string") userDisplay = r.requestedUser;
                        else if (typeof r.requestedUser === "object") userDisplay = r.requestedUser.userAlias || r.requestedUser.userName || "Ombi User";
                    }
                    return {
                        id: r.id,
                        status: r.approved ? 2 : 1, 
                        requestedBy: { displayName: userDisplay },
                        media: { title: r.title, posterPath: r.posterPath }
                    };
                 }).slice(0, 10);
                 data.stats = { total: json.length, pending: json.filter((r:any) => !r.approved).length };
             }
        }

        else if (app.type === "maintainerr") data.online = true; 

        clearTimeout(timeoutId);
        return data;
    } catch (e) {
        return { id: app.id, type: app.type, name: app.name, online: false };
    }
  }));

  return results;
}

// --- DETAILED NODE STATS (FIXED FOR CONTAINERS) ---

export async function fetchGlancesNodeDetails(id: string) {
  const instance = await prisma.glancesInstance.findUnique({ where: { id } });
  if (!instance) return null;

  const baseUrl = instance.url.replace(/\/$/, "");
  
  const safeFetch = async (version: number, endpoint: string, signal: AbortSignal) => {
      try {
          const res = await fetch(`${baseUrl}/api/${version}/${endpoint}`, { cache: "no-store", signal });
          if (!res.ok) return null;
          return await res.json();
      } catch (e) { return null; }
  };

  const toArray = (data: any) => Array.isArray(data) ? data : [];

  const tryFetchAll = async (version: number) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      try {
          const quick = await safeFetch(version, "quicklook", controller.signal);
          if (!quick) throw new Error("Offline");

          // NEW: Fetch BOTH "containers" (v4) and "docker" (v3)
          const [cpu, mem, load, fs, sensors, smart, network, uptime, processList, containers, docker] = await Promise.all([
              safeFetch(version, "cpu", controller.signal),
              safeFetch(version, "mem", controller.signal),
              safeFetch(version, "load", controller.signal),
              safeFetch(version, "fs", controller.signal),
              safeFetch(version, "sensors", controller.signal),
              safeFetch(version, "smart", controller.signal),
              safeFetch(version, "network", controller.signal),
              safeFetch(version, "uptime", controller.signal),
              safeFetch(version, "processlist", controller.signal),
              safeFetch(version, "containers", controller.signal), // Glances v4
              safeFetch(version, "docker", controller.signal)      // Glances v3
          ]);
          
          clearTimeout(timeoutId);

          // SMART MERGE: Use whichever one returned data
          // Glances 'containers' often returns a Map/Object in JSON, so we value-ize it
          let dockerData = containers || docker || [];
          if (!Array.isArray(dockerData) && typeof dockerData === 'object') {
              dockerData = Object.values(dockerData); // Flatten object to array
          }

          const processes = toArray(processList)
            .sort((a: any, b: any) => (b.cpu_percent || 0) - (a.cpu_percent || 0))
            .slice(0, 15);

          return {
              id: instance.id,
              name: instance.name,
              url: instance.url,
              online: true,
              version: version,
              uptime: uptime || "Online",
              cpu: cpu || quick.cpu,
              mem: mem || quick.mem,
              load: load,
              fs: toArray(fs),
              sensors: toArray(sensors),
              smart: toArray(smart),
              quick: quick,
              network: toArray(network),
              processes: processes,
              docker: dockerData // Now populated correctly!
          };
      } catch (e) {
          clearTimeout(timeoutId);
          return null;
      }
  };

  let data = await tryFetchAll(4);
  if (!data) data = await tryFetchAll(3);
  if (!data) data = await tryFetchAll(2);

  if (!data) {
      return { id: instance.id, name: instance.name, url: instance.url, online: false };
  }

  return data;
}

// ... (keep the rest of the file the same)

// --- SYNC LOGIC (VERBOSE DEBUGGING) ---

export async function performSync() {
  const logs: string[] = [];
  logs.push("Starting Sync Process...");

  const instances = await prisma.tautulliInstance.findMany();
  if (instances.length === 0) {
      logs.push("Error: No Tautulli instances configured in Settings.");
      return { success: false, logs };
  }

  const mergedUsers = new Map();
  const ignoredUsers = await prisma.ignoredUser.findMany();
  const ignoredIds = new Set(ignoredUsers.map(u => u.plexId));
  logs.push(`Found ${ignoredIds.size} ignored users.`);

  let successfulFetches = 0;

  const fetchInstanceData = async (instance: any) => {
    try {
        const baseUrl = instance.url.replace(/\/$/, "");
        logs.push(`Connecting to Tautulli: ${instance.name} (${baseUrl})...`);
        
        const url = `${baseUrl}/api/v2?apikey=${instance.apiKey}&cmd=get_users_table&order_column=last_seen&order_dir=desc&length=1000`;
        const res = await fetch(url, { cache: 'no-store' });
        
        if (res.status === 401) throw new Error("401 Unauthorized - Check API Key");
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        
        const data = await res.json();
        const users = data?.response?.data?.data || [];
        logs.push(`Success: Fetched ${users.length} users from ${instance.name}.`);
        successfulFetches++;
        return users;
    } catch (err: any) { 
        logs.push(`Failed to sync ${instance.name}: ${err.message}`);
        return []; 
    }
  };

  const results = await Promise.all(instances.map(fetchInstanceData));

  if (successfulFetches === 0) {
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

  logs.push(`Processing ${mergedUsers.size} unique users...`);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const oneYearAgo = nowSeconds - (365 * 24 * 60 * 60);
  let added = 0;
  let updated = 0;

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

  logs.push(`Sync Complete: ${added} added, ${updated} updated.`);
  return { success: true, logs };
}

// --- HELPER FOR SERVICE HEALTH ---

export async function fetchServiceHealth() {
  const services = await prisma.service.findMany({ orderBy: { name: "asc" } });
  
  const checkService = async (service: any) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(service.url, { method: "HEAD", cache: "no-store", signal: controller.signal });
      clearTimeout(timeoutId);
      
      // Some apps return 401/403 (Unauthorized) which actually means they are ONLINE and reachable
      const isOnline = res.ok || res.status === 401 || res.status === 403;
      return { id: service.id, name: service.name, online: isOnline };
    } catch (e) { 
        return { id: service.id, name: service.name, online: false }; 
    }
  };
  
  return await Promise.all(services.map(checkService));
}