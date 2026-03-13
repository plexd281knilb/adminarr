"use client";

import { useState, useEffect } from "react";
import { getDashboardActivity, getMediaAppsActivity } from "@/app/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
    Server, 
    Download, 
    Activity, 
    ListVideo, 
    PlayCircle, 
    Loader2, 
    CheckCircle2, 
    AlertCircle 
} from "lucide-react";

export default function AdminOverviewPage() {
    const [dashboardData, setDashboardData] = useState<any[]>([]);
    const [appsData, setAppsData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const formatTimeLeft = (timeStr: string | null | undefined) => {
        if (!timeStr) return "00:00:00";
        const cleanTime = timeStr.split('.')[0];
        return cleanTime || "00:00:00";
    };

    // FIX: Removed whitespace-nowrap and added max-w-full with text-center so it wraps on tiny screens safely
    const getStatusBadge = (status: string) => {
        switch(status) {
            case "Pending":
                return <Badge className="text-center sm:whitespace-nowrap bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 border border-yellow-500/50 shadow-sm w-fit max-w-full leading-tight">Pending Approval</Badge>;
            case "Approved":
            case "Processing":
                return <Badge className="text-center sm:whitespace-nowrap bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/50 shadow-sm w-fit max-w-full leading-tight">Approved Awaiting Download</Badge>;
            case "Partially Available":
                return <Badge className="text-center sm:whitespace-nowrap bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/50 shadow-sm w-fit max-w-full leading-tight">Partially Available</Badge>;
            case "Available":
                return <Badge className="text-center sm:whitespace-nowrap bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/50 shadow-sm w-fit max-w-full leading-tight">Available</Badge>;
            case "Declined":
                return <Badge className="text-center sm:whitespace-nowrap bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50 shadow-sm w-fit max-w-full leading-tight">Declined</Badge>;
            default:
                return <Badge variant="outline" className="text-center sm:whitespace-nowrap w-fit max-w-full leading-tight">{status}</Badge>;
        }
    };

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

        fetchLiveStats();
        const intervalId = setInterval(fetchLiveStats, 3000);
        return () => clearInterval(intervalId);
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] space-y-4 px-4 text-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground font-medium animate-pulse">Establishing Uplink to Mission Control...</p>
            </div>
        );
    }

    const mainHardware = dashboardData.find((d: any) => d?.type === "hardware" && d?.name.toLowerCase().includes("main"));
    const mainPlex = dashboardData.find((d: any) => d?.type === "plex" && d?.name.toLowerCase().includes("main"));
    const backupHardware = dashboardData.find((d: any) => d?.type === "hardware" && d?.name.toLowerCase().includes("backup"));
    const kidsPlex = dashboardData.find((d: any) => d?.type === "plex" && d?.name.toLowerCase().includes("kid"));
    const backupPlex = dashboardData.find((d: any) => d?.type === "plex" && d?.name.toLowerCase().includes("backup"));

    const backupStreams = [...(kidsPlex?.sessions || []), ...(backupPlex?.sessions || [])];
    const downloadApps = appsData.filter((app: any) => ["sabnzbd", "nzbget", "radarr", "sonarr", "lidarr", "readarr"].includes(app?.type?.toLowerCase()));
    const requestApps = appsData.filter((app: any) => ["overseerr", "ombi", "jellyseerr"].includes(app?.type?.toLowerCase()));

    return (
        <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 pb-12 px-4 sm:px-6 lg:px-8 pt-4 md:pt-6 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 md:mb-6">
                <div className="flex items-center gap-3">
                    <Server className="h-7 w-7 md:h-8 md:w-8 text-primary shrink-0" />
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Mission Control</h1>
                </div>
                <div className="sm:ml-auto flex items-center gap-2">
                    <span className="relative flex h-3 w-3 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Live (3s)</span>
                </div>
            </div>

            {/* --- ROW 1: SERVERS --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                <Card>
                    <CardHeader><CardTitle>Main Server</CardTitle></CardHeader>
                    <CardContent className="space-y-6 min-w-0">
                        <div className="space-y-4 min-w-0">
                            <div>
                                <div className="flex justify-between mb-1 text-sm"><span>CPU Usage</span><span>{mainHardware?.cpu?.toFixed(1) || 0}%</span></div>
                                <Progress value={mainHardware?.cpu || 0} />
                            </div>
                            <div>
                                <div className="flex justify-between mb-1 text-sm"><span>RAM Usage</span><span>{mainHardware?.mem?.toFixed(1) || 0}%</span></div>
                                <Progress value={mainHardware?.mem || 0} />
                            </div>
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm md:text-base"><PlayCircle className="h-4 w-4 text-primary shrink-0"/> Active Streams ({mainPlex?.streamCount || 0})</h3>
                            <div className="space-y-2 min-w-0">
                                {mainPlex?.sessions?.length > 0 ? mainPlex.sessions.map((s: any, i: number) => (
                                    <div key={i} className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-sm bg-muted/50 p-2.5 rounded gap-1 min-w-0">
                                        <span className="truncate flex-1 font-medium mr-2">{s.full_title || s.title}</span>
                                        <span className="text-muted-foreground text-xs sm:text-sm shrink-0">{s.friendly_name || s.user}</span>
                                    </div>
                                )) : <div className="text-sm text-muted-foreground italic">No active streams.</div>}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Backup Server</CardTitle></CardHeader>
                    <CardContent className="space-y-6 min-w-0">
                        <div className="space-y-4 min-w-0">
                            <div>
                                <div className="flex justify-between mb-1 text-sm"><span>CPU Usage</span><span>{backupHardware?.cpu?.toFixed(1) || 0}%</span></div>
                                <Progress value={backupHardware?.cpu || 0} />
                            </div>
                            <div>
                                <div className="flex justify-between mb-1 text-sm"><span>RAM Usage</span><span>{backupHardware?.mem?.toFixed(1) || 0}%</span></div>
                                <Progress value={backupHardware?.mem || 0} />
                            </div>
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm md:text-base"><PlayCircle className="h-4 w-4 text-primary shrink-0"/> Kids & Backup Streams ({backupStreams.length})</h3>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 min-w-0">
                                {backupStreams.length > 0 ? backupStreams.map((s: any, i: number) => (
                                    <div key={i} className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-sm bg-muted/50 p-2.5 rounded gap-1 min-w-0">
                                        <span className="truncate flex-1 font-medium mr-2">{s.full_title || s.title}</span>
                                        <span className="text-muted-foreground text-xs sm:text-sm shrink-0">{s.friendly_name || s.user}</span>
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
                    <CardTitle className="flex items-center gap-2 text-base md:text-lg"><Download className="h-5 w-5 text-primary shrink-0"/> Active Downloads</CardTitle>
                </CardHeader>
                <CardContent className="min-w-0">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 min-w-0">
                        {downloadApps.map((app: any) => {
                            if (!app.queue || app.queue.length === 0) return null;
                            return (
                                <div key={app.id} className="border rounded-lg p-3 md:p-4 bg-muted/20 min-w-0 overflow-hidden">
                                    <h4 className="font-semibold mb-3 uppercase text-[10px] md:text-xs text-muted-foreground tracking-wider truncate">{app.name}</h4>
                                    <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 min-w-0">
                                        {app.queue.map((item: any, i: number) => (
                                            <div key={i} className="space-y-1.5 min-w-0">
                                                <div className="flex flex-col sm:flex-row sm:justify-between text-sm gap-1 min-w-0">
                                                    <span className="truncate flex-1 font-medium mr-2" title={item.filename || item.title}>{item.filename || item.title || "Unknown"}</span>
                                                    <span className="text-muted-foreground text-xs font-mono shrink-0">{formatTimeLeft(item.timeleft)}</span>
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

            {/* --- ROW 3: APP CONNECTIVITY --- */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base md:text-lg"><Activity className="h-5 w-5 text-primary shrink-0"/> App Connectivity</CardTitle>
                </CardHeader>
                <CardContent className="min-w-0">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3 min-w-0">
                        {appsData.map((app: any) => (
                            <div 
                                key={app.id} 
                                className={`flex items-center gap-2 p-2 md:p-3 rounded-lg border bg-muted/20 transition-all min-w-0 ${
                                    app.online ? "border-green-500/20" : "border-red-500/20 bg-red-500/5"
                                }`}
                            >
                                {app.online ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                                ) : (
                                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="text-[10px] md:text-xs font-semibold truncate uppercase tracking-wider">{app.name}</div>
                                    <div className={`text-[9px] md:text-[10px] uppercase font-bold ${app.online ? "text-green-500" : "text-red-500"}`}>
                                        {app.online ? "Online" : "Offline"}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* --- ROW 4: CONTENT REQUESTS --- */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base md:text-lg"><ListVideo className="h-5 w-5 text-primary shrink-0"/> Pending & Active Requests</CardTitle>
                </CardHeader>
                <CardContent className="min-w-0">
                    <div className="grid gap-4 md:gap-6 md:grid-cols-2 min-w-0">
                        {requestApps.map((app: any) => {
                            if (!app.requests || app.requests.length === 0) return null;
                            return (
                                <div key={app.id} className="border rounded-lg p-3 md:p-4 bg-muted/20 min-w-0 overflow-hidden">
                                    <h4 className="font-semibold mb-3 uppercase text-[10px] md:text-xs text-muted-foreground tracking-wider truncate">{app.name}</h4>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 min-w-0">
                                        {app.requests.map((req: any, i: number) => (
                                            <div key={i} className="flex flex-col xl:flex-row xl:justify-between xl:items-center text-sm bg-background p-2.5 rounded shadow-sm border gap-2 min-w-0">
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <span className="font-medium block truncate" title={req.media?.title}>{req.media?.title || "Unknown"}</span>
                                                    <span className="text-[11px] md:text-xs text-muted-foreground truncate block">{req.requestedBy?.displayName}</span>
                                                </div>
                                                <div className="flex items-center shrink-0 max-w-full">
                                                    {getStatusBadge(req.status)}
                                                </div>
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