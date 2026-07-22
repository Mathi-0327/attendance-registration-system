/**
 * GeoFenceIndicator.tsx
 * Visual GPS distance indicator for attendance geo-fence validation.
 * Shows real-time distance from the class location.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Navigation, AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GeoFenceConfig {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

interface GeoFenceIndicatorProps {
  geoFence?: GeoFenceConfig | null;
  onLocationUpdate?: (lat: number, lng: number, accuracy: number) => void;
  advisory?: boolean; // true = warning only, false = hard block
}

type GeoStatus = "idle" | "loading" | "allowed" | "warning" | "denied" | "error";

export function GeoFenceIndicator({
  geoFence,
  onLocationUpdate,
  advisory = true,
}: GeoFenceIndicatorProps) {
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Haversine distance in meters
  function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const checkLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("error");
      setErrorMsg("GPS not supported in this browser");
      return;
    }

    setStatus("loading");
    setErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy: acc } = position.coords;
        setAccuracy(Math.round(acc));
        setCoords({ lat: latitude, lng: longitude });
        onLocationUpdate?.(latitude, longitude, acc);

        if (!geoFence) {
          // No geo-fence configured — GPS captured but no check needed
          setStatus("allowed");
          setDistanceMeters(null);
          return;
        }

        const dist = calcDistance(latitude, longitude, geoFence.latitude, geoFence.longitude);
        setDistanceMeters(Math.round(dist));

        if (dist <= geoFence.radiusMeters) {
          setStatus("allowed");
        } else {
          setStatus(advisory ? "warning" : "denied");
        }
      },
      (err) => {
        setStatus("error");
        setErrorMsg(
          err.code === 1
            ? "Location permission denied. Please enable GPS access."
            : err.code === 2
            ? "GPS signal unavailable. Try moving outdoors."
            : "GPS timeout. Please try again."
        );
      },
      { timeout: 10000, maximumAge: 30000, enableHighAccuracy: true }
    );
  }, [geoFence, advisory, onLocationUpdate]);

  useEffect(() => {
    checkLocation();
  }, []);

  const config: Record<
    GeoStatus,
    {
      icon: React.ReactNode;
      label: string;
      subtext?: string;
      color: string;
      bg: string;
      border: string;
    }
  > = {
    idle: {
      icon: <MapPin className="h-4 w-4" />,
      label: "GPS not checked",
      color: "text-muted-foreground",
      bg: "bg-muted/40",
      border: "border-muted",
    },
    loading: {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      label: "Checking location...",
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      border: "border-blue-200 dark:border-blue-800",
    },
    allowed: {
      icon: <CheckCircle2 className="h-4 w-4" />,
      label: geoFence
        ? `Within geo-fence (${distanceMeters}m)`
        : "GPS location captured",
      subtext: accuracy ? `Accuracy: ±${accuracy}m` : undefined,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      border: "border-emerald-200 dark:border-emerald-800",
    },
    warning: {
      icon: <AlertTriangle className="h-4 w-4" />,
      label: `Outside zone by ${distanceMeters ? distanceMeters - (geoFence?.radiusMeters || 0) : 0}m`,
      subtext: "Advisory: attendance may be flagged",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      border: "border-amber-200 dark:border-amber-800",
    },
    denied: {
      icon: <XCircle className="h-4 w-4" />,
      label: "Outside geo-fence — blocked",
      subtext: `${distanceMeters}m from class (limit: ${geoFence?.radiusMeters}m)`,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/30",
      border: "border-red-200 dark:border-red-800",
    },
    error: {
      icon: <AlertTriangle className="h-4 w-4" />,
      label: errorMsg || "GPS error",
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/30",
      border: "border-red-200 dark:border-red-800",
    },
  };

  const current = config[status];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
        className={`flex items-start gap-2 rounded-lg px-3 py-2 border text-sm ${current.bg} ${current.border}`}
      >
        <span className={`mt-0.5 flex-shrink-0 ${current.color}`}>{current.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`font-medium leading-snug ${current.color}`}>{current.label}</p>
          {current.subtext && (
            <p className="text-xs text-muted-foreground mt-0.5">{current.subtext}</p>
          )}
        </div>
        {(status === "error" || status === "warning" || status === "denied") && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs shrink-0"
            onClick={checkLocation}
          >
            Retry
          </Button>
        )}
        {status === "allowed" && (
          <Navigation className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${current.color}`} />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
