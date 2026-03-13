"use client";

import { useState, useEffect } from "react";
import { getDashboardActivity, getMediaAppsActivity } from "@/app/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Server, Download, Activity, ListVideo, PlayCircle, Loader2 } from "lucide-react";

export default function AdminOverviewPage() {
    const [dashboardData, setDashboardData] = useState<any[]>([]);
    const [appsData, setAppsData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLiveStats = async () => {
            try {
                const [dash, apps] = await Promise.all([
                    getDashboardActivity(),
                    getMediaAppsActivity()
                ]);
                setDashboardData(dash || []);
                setAppsData(apps || []);
            } catch (error) {
                console.error("Failed to fetch live stats", error);
            } finally {
                setLoading(false);
            }
        };

        // Fetch immediately on load
        fetchLiveStats();

        // Ping the server every 1 second (1000ms)
        const intervalId = setInterval(fetchLiveStats, 1000);

        // Cleanup the interval if the user navigates away from the page
        return () => clearInterval(intervalId);
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground font-medium animate-pulse">Establishing Uplink to Mission Control...</p>
            </div>
        );
    }

    // --- DATA ROUTING ---
    const mainHardware = dashboardData.find((d: any) => d?.type === "hardware" && d?.name.toLowerCase().includes("main"));
    const mainPlex = dashboardData.find((d: any) => d?.type === "plex" && d?.name.toLowerCase().includes("main"));

    const backupHardware = dashboardData.find((d: any) => d?.type === "hardware" && d?.name.toLowerCase().includes("backup"));
    const kidsPlex = dashboardData.find((d: any) => d?.type === "plex" && d?.name.toLowerCase().includes("kid"));
    const backupPlex = dashboardData.find((d: any) => d?.type === "plex" && d?.name.toLowerCase().includes("backup"));

    const backupStreams = [
        ...(kidsPlex?.sessions || []),
        ...(backupPlex?.sessions || [])
    ];

    const downloadApps = appsData.filter((app: any) => ["sabnzbd", "nzbget", "radarr", "sonarr", "lidarr", "readarr"].includes(app?.type?.toLowerCase()));
    const requestApps = appsData.filter((app: any) => ["overseerr", "ombi", "jellyseerr"].includes(app?.type?.toLowerCase()));

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-12">
            <div className="flex items-center gap-3 mb-6">
                <Server className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold tracking-tight">Mission Control</h1>
                <div className="ml-auto flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Live (1s)</span>
                </div>
            </div>

            {/* --- ROW 1: SERVERS --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Main Server Card */}
                <Card>
                    <CardHeader><CardTitle>Main Server</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between mb-1 text-sm"><span>CPU Usage</span><span>{mainHardware?.cpu?.toFixed(1) || 0}%</span></div>
                                <Progress value={mainHardware?.cpu || 0} />
                            </div>
                            <div>
                                <div className="flex justify-between mb-1 text-sm"><span>RAM Usage</span><span>{mainHardware?.mem?.toFixed(1) || 0}%</span></div>
                                <Progress value={mainHardware?.mem || 0} />
                            </div>
                        </div>
                        <div>
                            <h3 className="font-semibold mb-3 flex items-center gap-2"><PlayCircle className="h-4 w-4 text-primary"/> Active Streams ({mainPlex?.streamCount || 0})</h3>
                            <div className="space-y-2">
                                {mainPlex?.sessions?.length > 0 ? mainPlex.sessions.map((s: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center text-sm bg-muted/50 p-2 rounded">
                                        <span className="truncate max-w-[200px] font-medium">{s.full_title || s.title}</span>
                                        <span className="text-muted-foreground">{s.friendly_name || s.user}</span>
                                    </div>
                                )) : <div className="text-sm text-muted-foreground italic">No active streams.</div>}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Backup Server Card */}
                <Card>
                    <CardHeader><CardTitle>Backup Server</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between mb-1 text-sm"><span>CPU Usage</span><span>{backupHardware?.cpu?.toFixed(1) || 0}%</span></div>
                                <Progress value={backupHardware?.cpu || 0} />
                            </div>
                            <div>
                                <div className="flex justify-between mb-1 text-sm"><span>RAM Usage</span><span>{backupHardware?.mem?.toFixed(1) || 0}%</span></div>
                                <Progress value={backupHardware?.mem || 0} />
                            </div>
                        </div>
                        <div>
                            <h3 className="font-semibold mb-3 flex items-center gap-2"><PlayCircle className="h-4 w-4 text-primary"/> Kids & Backup Streams ({backupStreams.length})</h3>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                {backupStreams.length > 0 ? backupStreams.map((s: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center text-sm bg-muted/50 p-2 rounded">
                                        <span className="truncate max-w-[200px] font-medium">{s.full_title || s.title}</span>
                                        <span className="text-muted-foreground">{s.friendly_name || s.user}</span>
                                    </div>
                                )) : <div className="text-sm text-muted-foreground italic">No active streams.</div>}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* --- ROW 2: ACTIVE DOWNLOADS --- */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5 text-primary"/> Active Downloads</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {downloadApps.map((app: any) => {
                            if (!app.queue || app.queue.length === 0) return null;
                            return (
                                <div key={app.id} className="border rounded-lg p-4 bg-muted/20">
                                    <h4 className="font-semibold mb-3 uppercase text-xs text-muted-foreground tracking-wider">{app.name}</h4>
                                    <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2">
                                        {app.queue.map((item: any, i: number) => (
                                            <div key={i} className="space-y-1.5">
                                                <div className="flex justify-between text-sm">
                                                    <span className="truncate pr-2 font-medium">{item.filename || item.title || "Unknown"}</span>
                                                    <span className="text-muted-foreground whitespace-nowrap">{item.timeleft || ""}</span>
                                                </div>
                                                <Progress value={parseFloat(item.percentage || item.sizeleft ? ((item.size - item.sizeleft) / item.size * 100).toString() : "0")} className="h-1.5" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                        {!downloadApps.some((a: any) => a.queue && a.queue.length > 0) && (
                            <div className="text-sm text-muted-foreground italic">Your download queues are empty.</div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* --- ROW 3: SYSTEM STATUS --- */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary"/> App Connectivity</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {appsData.map((app: any) => (
                            <Badge key={app.id} variant={app.online ? "default" : "destructive"} className="px-3 py-1.5">
                                {app.name}
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* --- ROW 4: CONTENT REQUESTS --- */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ListVideo className="h-5 w-5 text-primary"/> Pending & Active Requests</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-6 md:grid-cols-2">
                        {requestApps.map((app: any) => {
                            if (!app.requests || app.requests.length === 0) return null;
                            return (
                                <div key={app.id} className="border rounded-lg p-4 bg-muted/20">
                                    <h4 className="font-semibold mb-3 uppercase text-xs text-muted-foreground tracking-wider">{app.name}</h4>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                                        {app.requests.map((req: any, i: number) => (
                                            <div key={i} className="flex justify-between items-center text-sm bg-background p-2.5 rounded shadow-sm border">
                                                <div className="truncate max-w-[250px]">
                                                    <span className="font-medium block truncate">{req.media?.title || "Unknown"}</span>
                                                    <span className="text-xs text-muted-foreground">{req.requestedBy?.displayName}</span>
                                                </div>
                                                <Badge variant={req.status === 2 || req.status === "Approved" ? "secondary" : "default"} className="whitespace-nowrap ml-2">
                                                    {req.status === 2 || req.status === "Approved" ? "Approved" : "Pending"}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                        {!requestApps.some((a: any) => a.requests && a.requests.length > 0) && (
                            <div className="text-sm text-muted-foreground italic col-span-2">No active requests.</div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}