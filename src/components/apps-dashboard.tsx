"use client"

import { useState, useEffect, useRef } from "react";
import { getMediaAppsActivity } from "@/app/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { 
    Download, Film, Tv, Users, Wrench, 
    Pause, Play, HardDrive, ExternalLink 
} from "lucide-react";

// --- HELPER COMPONENT: THE OPEN BUTTON ---
function OpenButton({ app }: { app: any }) {
    const linkUrl = app.externalUrl || app.url || "";
    
    if (!linkUrl) {
        return (
            <Button size="sm" variant="outline" disabled className="gap-2 h-8 text-xs opacity-50">
                Open <ExternalLink className="h-3 w-3" />
            </Button>
        );
    }

    return (
        <Link href={linkUrl} target="_blank">
            <Button size="sm" variant="outline" className="gap-2 h-8 text-xs">
                Open <ExternalLink className="h-3 w-3" />
            </Button>
        </Link>
    );
}

export default function AppsDashboard({ initialData }: { initialData: any[] }) {
  const [apps, setApps] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(async () => {
        try {
            setLoading(true);
            const fresh = await getMediaAppsActivity();
            if (fresh) setApps(fresh);
        } catch(e) { console.error(e); } 
        finally { setLoading(false); }
    }, 2000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const formatMb = (input: any) => {
      const num = typeof input === "string" ? parseFloat(input) : input;
      if (typeof num !== "number" || isNaN(num)) return "0 MB";
      if (num > 1000000) return `${(num / 1000000).toFixed(2)} TB`;
      if (num > 1000) return `${(num / 1000).toFixed(2)} GB`;
      return `${num.toFixed(0)} MB`;
  };

  const getPosterUrl = (posterPath: string) => {
      if (!posterPath) return null;
      if (posterPath.startsWith("http")) return posterPath;
      return `https://image.tmdb.org/t/p/w200${posterPath}`;
  };

  // Groupings
  const downloaders = apps.filter(a => ["sabnzbd", "nzbget"].includes(a.type));
  const movies = apps.filter(a => a.type === "radarr");
  const tv = apps.filter(a => a.type === "sonarr");
  const requests = apps.filter(a => ["overseerr", "jellyseerr", "ombi"].includes(a.type));
  const maintenance = apps.filter(a => ["bazarr", "prowlarr", "readarr", "lidarr", "maintainerr"].includes(a.type));

  return (
    <div className="space-y-6">
       <div className="flex justify-end h-4">
           {loading && <Badge variant="outline" className="text-xs border-transparent text-muted-foreground animate-pulse">Updating...</Badge>}
       </div>

       <Tabs defaultValue="downloads" className="space-y-6">
            {/* UPDATED: grid-cols-2 on mobile, grid-cols-5 on desktop, h-auto to allow wrapping */}
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 h-auto">
                <TabsTrigger value="downloads"><Download className="h-4 w-4 mr-2"/> Downloads</TabsTrigger>
                <TabsTrigger value="movies"><Film className="h-4 w-4 mr-2"/> Movies</TabsTrigger>
                <TabsTrigger value="tv"><Tv className="h-4 w-4 mr-2"/> TV</TabsTrigger>
                <TabsTrigger value="requests"><Users className="h-4 w-4 mr-2"/> Requests</TabsTrigger>
                <TabsTrigger value="maintenance"><Wrench className="h-4 w-4 mr-2"/> Utility</TabsTrigger>
            </TabsList>

            {/* 1. DOWNLOADS */}
            <TabsContent value="downloads" className="space-y-6">
                {downloaders.length === 0 && <div className="text-muted-foreground p-4">No download clients configured.</div>}
                {downloaders.map(app => (
                    <Card key={app.id}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-lg font-medium flex items-center gap-2">
                                {app.name}
                                {app.online ? <Badge className="bg-green-500">Online</Badge> : <Badge variant="destructive">Offline</Badge>}
                            </CardTitle>
                            <div className="flex items-center gap-4">
                                {app.online && (
                                    <div className="text-right">
                                        <div className="text-2xl font-bold">{app.stats.speed}</div>
                                        <div className="text-xs text-muted-foreground">Time Left: {app.stats.timeleft}</div>
                                    </div>
                                )}
                                <OpenButton app={app} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            {!app.online ? <div className="text-sm text-red-500">Connection Failed</div> : (
                                <div className="space-y-4">
                                    <div className="flex gap-4 text-sm text-muted-foreground border-b pb-4">
                                        <span className="flex items-center"><HardDrive className="h-4 w-4 mr-1"/> {formatMb(app.stats.mbleft)} Remaining</span>
                                        <span className="flex items-center">
                                            {app.stats.paused ? <Pause className="h-4 w-4 mr-1 text-yellow-500"/> : <Play className="h-4 w-4 mr-1 text-green-500"/>}
                                            {app.stats.paused ? "Paused" : "Downloading"}
                                        </span>
                                    </div>
                                    <div className="space-y-3">
                                        {app.queue.length === 0 ? <div className="text-sm italic">Queue is empty.</div> : app.queue.map((item: any, i: number) => (
                                            <div key={item.nzo_id || i} className="space-y-1">
                                                <div className="flex justify-between text-sm font-medium">
                                                    <span className="truncate max-w-[70%]">{item.filename}</span>
                                                    <span>{item.percentage}%</span>
                                                </div>
                                                <Progress value={Number(item.percentage)} className="h-2" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </TabsContent>

            {/* 2. MOVIES */}
            <TabsContent value="movies" className="grid gap-6 md:grid-cols-2">
                {movies.map(app => (
                    <Card key={app.id}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle>{app.name}</CardTitle>
                            <OpenButton app={app} />
                        </CardHeader>
                        <CardContent>
                            {!app.online ? <div className="text-red-500 text-sm">Offline</div> : (
                                <div className="space-y-4">
                                    {app.queue.length === 0 ? <div className="text-sm text-muted-foreground italic">No active downloads.</div> : 
                                        app.queue.map((item: any) => (
                                            <div key={item.id} className="border-b last:border-0 pb-2">
                                                <div className="text-sm font-medium truncate">{item.title}</div>
                                                <Progress value={100 - (item.sizeleft / item.size * 100)} className="h-1 mt-2" />
                                            </div>
                                        ))
                                    }
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </TabsContent>

            {/* 3. TV */}
            <TabsContent value="tv" className="grid gap-6 md:grid-cols-2">
                {tv.map(app => (
                    <Card key={app.id}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle>{app.name}</CardTitle>
                            <OpenButton app={app} />
                        </CardHeader>
                        <CardContent>
                             {!app.online ? <div className="text-red-500 text-sm">Offline</div> : (
                                <div className="space-y-4">
                                    {app.queue.length === 0 ? <div className="text-sm text-muted-foreground italic">No active downloads.</div> : 
                                        app.queue.map((item: any) => (
                                            <div key={item.id} className="border-b last:border-0 pb-2">
                                                <div className="text-sm font-medium truncate">{item.title}</div>
                                                <div className="text-xs text-muted-foreground">{item.episode?.title}</div>
                                            </div>
                                        ))
                                    }
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </TabsContent>

            {/* 4. REQUESTS */}
            <TabsContent value="requests" className="space-y-6">
                {requests.map(app => (
                    <Card key={app.id}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle>{app.name}</CardTitle>
                            <OpenButton app={app} />
                        </CardHeader>
                        <CardContent>
                            {!app.online ? <div className="text-red-500 text-sm">Offline</div> : (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {(!app.requests || app.requests.length === 0) ? (
                                        <div className="text-sm italic text-muted-foreground p-2">No active requests found.</div>
                                    ) : (
                                        app.requests.map((req: any) => (
                                            <div key={req.id} className="flex items-start space-x-3 border p-3 rounded bg-muted/20">
                                                {/* IMAGE RENDERING */}
                                                {req.media?.posterPath ? (
                                                    <img 
                                                        src={getPosterUrl(req.media.posterPath)!} 
                                                        className="w-10 h-14 object-cover rounded shadow"
                                                        alt="poster"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-14 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-400">?</div>
                                                )}
                                                
                                                <div className="flex-1 overflow-hidden">
                                                    <div className="text-sm font-bold truncate">{req.media?.title || "Unknown"}</div>
                                                    <div className="text-xs text-muted-foreground">{req.requestedBy?.displayName}</div>
                                                    <Badge variant={req.status === 2 ? "secondary" : "outline"} className="mt-1 text-[10px]">
                                                        {req.status === 2 ? "Approved" : "Pending"}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </TabsContent>

            {/* 5. UTILITY */}
            <TabsContent value="maintenance" className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {maintenance.length === 0 && <div className="col-span-full text-muted-foreground p-4">No utility apps configured.</div>}
                {maintenance.map(app => (
                    <Card key={app.id}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-base">{app.name}</CardTitle>
                            <div className="flex items-center gap-2">
                                {app.online ? <Badge variant="outline" className="text-green-600 bg-green-50">Online</Badge> : <Badge variant="destructive">Offline</Badge>}
                                <OpenButton app={app} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            {app.type === "prowlarr" && (
                                <div className="text-center py-2">
                                    <div className="text-2xl font-bold">{app.stats?.total || 0}</div>
                                    <div className="text-xs text-muted-foreground">Total Indexers</div>
                                    {app.stats?.failed > 0 && <div className="text-xs text-red-500 mt-1">{app.stats.failed} Failed</div>}
                                </div>
                            )}
                            {app.type === "bazarr" && (
                                <div className="text-center py-2">
                                    <div className="text-sm font-medium">Subtitles Service</div>
                                    <div className="text-xs text-muted-foreground">Version: {app.stats?.version || "Unknown"}</div>
                                </div>
                            )}
                             {!["prowlarr", "bazarr"].includes(app.type) && (
                                <div className="text-center py-2 text-sm text-muted-foreground">
                                    {app.online ? "Monitoring active." : "Check URL/API Key"}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </TabsContent>
       </Tabs>
    </div>
  );
}