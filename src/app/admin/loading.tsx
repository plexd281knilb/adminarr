import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server } from "lucide-react";

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 pb-12 px-4 sm:px-6 lg:px-8 pt-4 md:pt-6">
      {/* Header Skeleton */}
      <div className="flex items-center gap-3 mb-6">
        <Server className="h-8 w-8 text-muted animate-pulse" />
        <Skeleton className="h-10 w-64" />
      </div>

      {/* Row 1: Server Skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 2: Downloads Skeleton */}
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Row 3: App Grid Skeleton */}
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}