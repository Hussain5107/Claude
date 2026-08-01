"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button, Card } from "./ui";
import AppHeader from "./AppHeader";
import { useTheme } from "./ThemeProvider";
import type { Gym } from "@/app/api/gyms/route";

type Status = "idle" | "locating" | "loading" | "ready" | "error";

const RADIUS_OPTIONS = [
  { label: "2 km", value: 2000 },
  { label: "5 km", value: 5000 },
  { label: "10 km", value: 10000 },
  { label: "20 km", value: 20000 },
];

export default function GymsClient() {
  const theme = useTheme();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [radius, setRadius] = useState(5000);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const mapRef = useRef<LeafletMap | null>(null);
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Map<string, { openPopup: () => void }>>(new Map());
  const posRef = useRef<{ lat: number; lon: number } | null>(null);

  // Tear the map down on unmount so a re-mount doesn't hit
  // "Map container is already initialized".
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const render = useCallback(async (lat: number, lon: number, found: Gym[]) => {
    // Imported here rather than at module scope: Leaflet touches `window`, which
    // doesn't exist while this component is server-rendered.
    const L = (await import("leaflet")).default;
    if (!mapNodeRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(mapNodeRef.current, { zoomControl: true }).setView([lat, lon], 13);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      }).addTo(mapRef.current);
    } else {
      mapRef.current.setView([lat, lon], 13);
    }

    const map = mapRef.current;
    markersRef.current.clear();
    map.eachLayer((layer) => {
      if ("getLatLng" in layer) map.removeLayer(layer);
    });

    L.marker([lat, lon], {
      icon: L.divIcon({
        className: "",
        html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${theme.colors.secondary};box-shadow:0 0 0 4px ${theme.colors.secondary}4d"></span>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    })
      .addTo(map)
      .bindPopup("You are here");

    found.forEach((gym, i) => {
      const marker = L.marker([gym.lat, gym.lon], {
        icon: L.divIcon({
          className: "",
          html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:linear-gradient(135deg,${theme.colors.primary},${theme.colors.secondary});color:#fff;font:700 12px/1 system-ui;border:2px solid rgba(255,255,255,0.85)">${i + 1}</span>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
      })
        .addTo(map)
        .bindPopup(
          `<strong>${escapeHtml(gym.name)}</strong><br/>${gym.distanceKm.toFixed(1)} km away`,
        );
      marker.on("click", () => setSelectedId(gym.id));
      markersRef.current.set(gym.id, marker);
    });

    if (found.length > 0) {
      map.fitBounds(
        L.latLngBounds([[lat, lon], ...found.map((g) => [g.lat, g.lon] as [number, number])]).pad(
          0.15,
        ),
      );
    }
  }, [theme]);

  const fetchGyms = useCallback(
    async (lat: number, lon: number, r: number) => {
      setStatus("loading");
      setError(null);
      try {
        const res = await fetch(`/api/gyms?lat=${lat}&lon=${lon}&radius=${r}`);
        const body = await res.json();
        if (!res.ok) {
          setError(body.error ?? "Couldn't load nearby gyms.");
          setStatus("error");
          return;
        }
        setGyms(body.gyms);
        setStatus("ready");
        await render(lat, lon, body.gyms);
      } catch {
        setError("Couldn't load nearby gyms. Check your connection and try again.");
        setStatus("error");
      }
    },
    [render],
  );

  function locate() {
    if (!("geolocation" in navigator)) {
      setError("This browser can't share your location.");
      setStatus("error");
      return;
    }
    setStatus("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        posRef.current = { lat: latitude, lon: longitude };
        void fetchGyms(latitude, longitude, radius);
      },
      (err) => {
        setStatus("error");
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location access was blocked. Allow location for this site in your browser settings, then try again."
            : err.code === err.TIMEOUT
              ? "Finding your location took too long. Try again."
              : "Couldn't determine your location. Try again, or move somewhere with a better signal.",
        );
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  }

  function changeRadius(r: number) {
    setRadius(r);
    const p = posRef.current;
    if (p) void fetchGyms(p.lat, p.lon, r);
  }

  const busy = status === "locating" || status === "loading";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-4 sm:px-6">
      <AppHeader title="Gyms near you" subtitle="From OpenStreetMap" />

      <p className="text-sm text-[var(--text-dim)]">
        Find a gym close by — useful if you train at home and want somewhere to lift heavier, or
        you&apos;re somewhere new.
      </p>

      {status === "idle" && (
        <Card className="mt-6 p-6 text-center">
          <div className="text-3xl">📍</div>
          <h2 className="mt-2 text-lg font-bold">Search around you</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--text-dim)]">
            We&apos;ll ask your browser for your location, use it once to search, and won&apos;t
            store it.
          </p>
          <Button variant="primary" onClick={locate} className="mt-4">
            Find gyms near me
          </Button>
        </Card>
      )}

      {status !== "idle" && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
              Within
            </span>
            {RADIUS_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => changeRadius(o.value)}
                disabled={busy}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition disabled:opacity-40 ${
                  radius === o.value
                    ? "bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] text-white"
                    : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-dim)] hover:border-[var(--border-hi)]"
                }`}
              >
                {o.label}
              </button>
            ))}
            <button
              type="button"
              onClick={locate}
              disabled={busy}
              className="ml-auto rounded-full border border-[var(--border-hi)] bg-[var(--surface-hi)] px-3.5 py-1.5 text-xs font-bold hover:border-[var(--secondary)] disabled:opacity-40"
            >
              {busy ? "Searching…" : "↻ Refresh"}
            </button>
          </div>

          <div
            ref={mapNodeRef}
            className="mt-4 h-[340px] w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-2)]"
          />
        </>
      )}

      {busy && (
        <p className="mt-4 text-center text-sm text-[var(--text-dim)]">
          {status === "locating" ? "Getting your location…" : "Looking for gyms nearby…"}
        </p>
      )}

      {error && (
        <Card className="mt-4 border-[var(--rose)]/40 p-4">
          <p className="text-sm text-[var(--rose)]">{error}</p>
          <Button onClick={locate} className="mt-3 px-4 py-1.5 text-xs">
            Try again
          </Button>
        </Card>
      )}

      {status === "ready" && gyms.length === 0 && (
        <Card className="mt-4 p-6 text-center">
          <p className="text-sm text-[var(--text-dim)]">
            No gyms found within {(radius / 1000).toFixed(0)} km. Try a wider search — and note this
            uses community-maintained map data, so smaller gyms are sometimes missing.
          </p>
        </Card>
      )}

      {gyms.length > 0 && (
        <div className="mt-5 flex flex-col gap-2">
          {gyms.map((gym, i) => (
            <Card
              key={gym.id}
              className={`p-4 transition ${selectedId === gym.id ? "border-[var(--secondary)]" : ""}`}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-[15px] font-bold">{gym.name}</h3>
                    <span className="font-mono text-xs text-[var(--secondary)]">
                      {gym.distanceKm.toFixed(1)} km
                    </span>
                  </div>
                  {gym.address && (
                    <p className="mt-0.5 text-xs text-[var(--text-dim)]">{gym.address}</p>
                  )}
                  {gym.openingHours && (
                    <p className="mt-0.5 text-xs text-[var(--text-faint)]">🕒 {gym.openingHours}</p>
                  )}
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${gym.lat},${gym.lon}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-[var(--border-hi)] bg-[var(--surface-hi)] px-3 py-1.5 text-xs font-bold hover:border-[var(--secondary)]"
                    >
                      Directions
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(gym.id);
                        markersRef.current.get(gym.id)?.openPopup();
                        mapNodeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--text-dim)] hover:border-[var(--border-hi)]"
                    >
                      Show on map
                    </button>
                    {gym.phone && (
                      <a
                        href={`tel:${gym.phone}`}
                        className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--text-dim)] hover:border-[var(--border-hi)]"
                      >
                        Call
                      </a>
                    )}
                    {gym.website && (
                      <a
                        href={gym.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--text-dim)] hover:border-[var(--border-hi)]"
                      >
                        Website
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
          <p className="mt-1 text-center text-[11px] text-[var(--text-faint)]">
            Gym data from OpenStreetMap contributors. Smaller gyms are sometimes missing — if one is,
            you can add it on openstreetmap.org.
          </p>
        </div>
      )}
    </main>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
