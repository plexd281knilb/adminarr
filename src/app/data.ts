import { PrismaClient } from "@prisma/client";

// Singleton pattern for Prisma
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function getSettings() {
  let settings = await prisma.settings.findUnique({ where: { id: "global" } });
  if (!settings) settings = await prisma.settings.create({ data: { id: "global" } });
  return settings;
}
export async function getTautulliInstances() { return await prisma.tautulliInstance.findMany({ orderBy: { createdAt: "asc" } }); }
export async function getGlancesInstances() { return await prisma.glancesInstance.findMany({ orderBy: { createdAt: "asc" } }); }
export async function getSubscribers() { return await prisma.subscriber.findMany({ orderBy: { name: "asc" } }); }
export async function getServices() { return await prisma.service.findMany({ orderBy: { name: "asc" } }); }
export async function getMediaApps() { return await prisma.mediaApp.findMany({ orderBy: { type: "asc" } }); }

// --- LIVE DASHBOARD LOGIC ---
export async function fetchDashboardData() {
  const [tautulliInstances, glancesInstances] = await Promise.all([
    prisma.tautulliInstance.findMany(),
    prisma.glancesInstance.findMany()
  ]);

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
          type: "plex", name: instance.name, online: true,
          streamCount: Number(data.response.data.stream_count) || 0,
          sessions: data.response.data.sessions || [],
        };
      }
    } catch (e) { }
    return { type: "plex", name: instance.name, online: false };
  };

  const fetchGlances = async (instance: any) => {
    const baseUrl = instance.url.replace(/\/$/, "");
    const tryFetch = async (version: number) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        try {
            const [quickReq] = await Promise.all([fetch(`${baseUrl}/api/${version}/quicklook`, { cache: "no-store", signal: controller.signal })]);
            clearTimeout(timeoutId);
            if (!quickReq.ok) return null;
            return { quick: await quickReq.json() };
        } catch (e) { clearTimeout(timeoutId); return null; }
    };

    try {
        let data = await tryFetch(4) || await tryFetch(3) || await tryFetch(2);
        if (!data) return { id: instance.id, type: "hardware", name: instance.name, online: false };
        const cpu = data.quick.cpu?.total ?? data.quick.cpu ?? 0;
        const mem = data.quick.mem?.percent ?? data.quick.mem ?? 0;
        return { id: instance.id, type: "hardware", name: instance.name, online: true, cpu: cpu, mem: mem };
    } catch (e) { return { id: instance.id, type: "hardware", name: instance.name, online: false }; }
  };

  return await Promise.all([...tautulliInstances.map(fetchTautulli), ...glancesInstances.map(fetchGlances)]);
}

// --- MEDIA APP ACTIVITY FETCHERS ---
export async function fetchMediaAppsActivity() {
  const apps = await prisma.mediaApp.findMany({ orderBy: { type: "asc" } });

  return await Promise.all(apps.map(async (app) => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); 
        const cleanUrl = app.url.replace(/\/$/, "");
        let data: any = { id: app.id, type: app.type, name: app.name, online: false, queue: [], requests: [] };

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
            if (json.records) { data.online = true; data.queue = json.records; }
        } else if (app.type === "sabnzbd" || app.type === "nzbget") {
            const res = await fetch(`${cleanUrl}/api?mode=queue&output=json&apikey=${app.apiKey}`, { signal: controller.signal, cache: "no-store" });
            const json = await res.json();
            if (json.queue) { data.online = true; data.queue = json.queue.slots || []; }
        } else if (app.type === "overseerr" || app.type === "jellyseerr") {
             const res = await fetch(`${cleanUrl}/api/v1/request?take=100&skip=0&sort=added`, { headers: { "X-Api-Key": app.apiKey || "" }, signal: controller.signal, cache: "no-store" });
             const json = await res.json();
             if (json.results) {
                 data.online = true;
                 const activeRequests = json.results.filter((r: any) => r.status !== 3 && r.media?.status !== 5);
                 
                 data.requests = await Promise.all(activeRequests.map(async (r: any) => {
                     let title = "Unknown Title";
                     try {
                         const mediaType = r.media?.mediaType || "movie";
                         const tmdbId = r.media?.tmdbId;
                         if (tmdbId) {
                            const detailRes = await fetch(`${cleanUrl}/api/v1/${mediaType}/${tmdbId}`, { headers: { "X-Api-Key": app.apiKey || "" }, cache: "force-cache" });
                            if (detailRes.ok) { const detail = await detailRes.json(); title = detail.title || detail.name || detail.originalTitle || "Unknown Title"; }
                         }
                     } catch (err) {}
                     
                     let finalStatus = "Pending";
                     if (r.status === 2) {
                         if (r.media?.status === 4) finalStatus = "Partially Available";
                         else if (r.media?.status === 3) finalStatus = "Processing";
                         else finalStatus = "Approved";
                     }
                     
                     return { 
                         status: finalStatus, 
                         requestedBy: { displayName: r.requestedBy?.displayName || r.requestedBy?.email || "Unknown User" }, 
                         media: { title: `[${r.media?.mediaType === 'tv' ? 'TV' : 'Movie'}] ${title}` } 
                     };
                 }));
             }
        } else if (app.type === "ombi") {
             const [movieRes, tvRes] = await Promise.all([
                 fetch(`${cleanUrl}/api/v1/Request/movie?apikey=${app.apiKey}`, { signal: controller.signal, cache: "no-store" }),
                 fetch(`${cleanUrl}/api/v1/Request/tv?apikey=${app.apiKey}`, { signal: controller.signal, cache: "no-store" })
             ]);
             if (movieRes.ok || tvRes.ok) data.online = true;
             const movies = movieRes.ok ? await movieRes.json() : [];
             const tv = tvRes.ok ? await tvRes.json() : [];
             
             const activeRequests = [...movies.map((m:any) => ({...m, uniqueType: 'movie'})), ...tv.map((t:any) => ({...t, uniqueType: 'tv'}))]
                .filter((r: any) => {
                    const isDenied = r.denied || (r.childRequests && r.childRequests.length > 0 && r.childRequests.every((c:any) => c.denied));
                    const isAvailable = r.available || (r.childRequests && r.childRequests.length > 0 && r.childRequests.every((c:any) => c.available));
                    const reqStatus = (r.requestStatus || "").toLowerCase();
                    return !isDenied && !isAvailable && reqStatus !== 'available';
                });
             
             data.requests = activeRequests.map((r: any) => {
                 let finalStatus = "Pending";
                 const isApproved = r.approved || (r.childRequests && r.childRequests.some((c:any) => c.approved));
                 const isPartiallyAvailable = r.childRequests && r.childRequests.some((c:any) => c.available);

                 if (isPartiallyAvailable) {
                     finalStatus = "Partially Available";
                 } else if (isApproved) {
                     finalStatus = "Processing"; 
                 }

                 // OMBI USER FIX: Check the main object first, then dig into child seasons if it's missing
                 let reqUser = r.requestedUser;
                 if ((!reqUser || !reqUser.userName) && r.childRequests && r.childRequests.length > 0) {
                     reqUser = r.childRequests[0].requestedUser;
                 }

                 // Ombi uses 'alias' first, then 'userName', then fallback to email
                 let userName = "Ombi User";
                 if (reqUser) {
                     userName = reqUser.alias || reqUser.userName || reqUser.username || reqUser.emailAddress || "Ombi User";
                 }

                 return {
                     status: finalStatus, 
                     requestedBy: { displayName: userName },
                     media: { title: `[${r.uniqueType === 'tv' ? 'TV' : 'Movie'}] ${r.title || "Unknown"}` }
                 };
             });
        } else {
             const res = await fetch(cleanUrl, { signal: controller.signal, mode: 'no-cors' });
             data.online = true;
        }

        clearTimeout(timeoutId);
        return data;
    } catch (e) { return { id: app.id, type: app.type, name: app.name, online: false }; }
  }));
}

export async function performSync() { return { success: true, logs: [] }; }