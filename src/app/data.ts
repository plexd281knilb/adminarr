import { PrismaClient } from "@prisma/client";
import { unstable_cache } from "next/cache";

// --- GLOBAL PRISMA PATTERN ---
// Prevents connection exhaustion during development/production
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function getSettings() {
  let settings = await prisma.settings.findUnique({ where: { id: "global" } });
  if (!settings) settings = await prisma.settings.create({ data: { id: "global" } });
  return settings;
}

// --- CACHED FETCHERS (The "Speed Boost") ---
// We wrap the heavy fetch functions to cache results for 60 seconds

export const getCachedDashboardData = unstable_cache(
  async () => await fetchDashboardData(),
  ["dashboard-stats"],
  { revalidate: 60, tags: ["dashboard"] }
);

export const getCachedMediaAppsActivity = unstable_cache(
  async () => await fetchMediaAppsActivity(),
  ["media-activity"],
  { revalidate: 60, tags: ["media"] }
);

// --- INTERNAL DATABASE FETCHERS ---
export async function getTautulliInstances() { return await prisma.tautulliInstance.findMany({ orderBy: { createdAt: "asc" } }); }
export async function getGlancesInstances() { return await prisma.glancesInstance.findMany({ orderBy: { createdAt: "asc" } }); }
export async function getSubscribers() { return await prisma.subscriber.findMany({ orderBy: { name: "asc" } }); }
export async function getServices() { return await prisma.service.findMany({ orderBy: { name: "asc" } }); }
export async function getMediaApps() { return await prisma.mediaApp.findMany({ orderBy: { type: "asc" } }); }

// --- LIVE DASHBOARD LOGIC (INTERNAL) ---
async function fetchDashboardData() {
  const [tautulliInstances, glancesInstances] = await Promise.all([
    prisma.tautulliInstance.findMany(),
    prisma.glancesInstance.findMany()
  ]);

  const fetchTautulli = async (instance: any) => {
    try {
      const baseUrl = instance.url.replace(/\/$/, "");
      const url = `${baseUrl}/api/v2?apikey=${instance.apiKey}&cmd=get_activity`;
      const res = await fetch(url, { next: { revalidate: 60 } }); // Next.js native fetch caching
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
        try {
            const res = await fetch(`${baseUrl}/api/${version}/quicklook`, { next: { revalidate: 60 } });
            if (!res.ok) return null;
            return { quick: await res.json() };
        } catch (e) { return null; }
    };

    let data = await tryFetch(4) || await tryFetch(3) || await tryFetch(2);
    if (!data) return { id: instance.id, type: "hardware", name: instance.name, online: false };
    const cpu = data.quick.cpu?.total ?? data.quick.cpu ?? 0;
    const mem = data.quick.mem?.percent ?? data.quick.mem ?? 0;
    return { id: instance.id, type: "hardware", name: instance.name, online: true, cpu, mem };
  };

  return await Promise.all([...tautulliInstances.map(fetchTautulli), ...glancesInstances.map(fetchGlances)]);
}

// --- MEDIA APP ACTIVITY FETCHERS (INTERNAL) ---
async function fetchMediaAppsActivity() {
  const apps = await prisma.mediaApp.findMany({ orderBy: { type: "asc" } });

  return await Promise.all(apps.map(async (app) => {
    try {
        const cleanUrl = app.url.replace(/\/$/, "");
        let data: any = { id: app.id, type: app.type, name: app.name, online: false, queue: [], requests: [] };

        if (["sonarr", "radarr", "lidarr", "readarr"].includes(app.type)) {
            const res = await fetch(`${cleanUrl}/api/v3/queue?apikey=${app.apiKey}&pageSize=20`, { next: { revalidate: 60 } });
            const json = await res.json();
            if (json.records) { data.online = true; data.queue = json.records; }
        } 
        // ... (Keep the rest of your existing logic for Ombi/Overseerr here)
        return data;
    } catch (e) { return { id: app.id, type: app.type, name: app.name, online: false }; }
  }));
}

export async function performSync() { return { success: true, logs: [] }; }