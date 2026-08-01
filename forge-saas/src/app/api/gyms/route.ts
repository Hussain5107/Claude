import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface Gym {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
  address: string | null;
  openingHours: string | null;
  phone: string | null;
  website: string | null;
}

// Public Overpass instances are free but frequently rate-limited (429) or
// overloaded (504), so fall through a few mirrors before giving up.
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
];
const MIN_RADIUS_M = 500;
const MAX_RADIUS_M = 20_000;
const MAX_RESULTS = 60;

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function buildAddress(tags: Record<string, string>): string | null {
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:city"],
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export async function GET(request: NextRequest) {
  // This route is excluded from the auth middleware, so it checks the session
  // itself — otherwise it would be an open proxy anyone could point at Overpass.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  const radius = Math.min(
    Math.max(Number(params.get("radius")) || 5000, MIN_RADIUS_M),
    MAX_RADIUS_M,
  );

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "Invalid location." }, { status: 400 });
  }

  const query = `[out:json][timeout:25];
(
  nwr["leisure"="fitness_centre"](around:${radius},${lat},${lon});
  nwr["amenity"="gym"](around:${radius},${lat},${lon});
);
out center ${MAX_RESULTS};`;

  let res: Response | null = null;
  for (const url of OVERPASS_URLS) {
    try {
      const attempt = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // Overpass asks callers to identify themselves.
          "User-Agent": "FORGE-fitness-app/1.0 (gym finder)",
        },
        body: `data=${encodeURIComponent(query)}`,
        // Nearby gyms don't change often; let the CDN hold this for an hour.
        next: { revalidate: 3600 },
      });
      if (attempt.ok) {
        res = attempt;
        break;
      }
    } catch {
      // Try the next mirror.
    }
  }

  if (!res) {
    return NextResponse.json(
      { error: "The free map service is busy right now. Please try again in a moment." },
      { status: 502 },
    );
  }

  let data: { elements?: OverpassElement[] };
  try {
    data = (await res.json()) as { elements?: OverpassElement[] };
  } catch {
    return NextResponse.json(
      { error: "Couldn't read the gym data. Please try again." },
      { status: 502 },
    );
  }

  const gyms: Gym[] = (data.elements ?? [])
    .map((el): Gym | null => {
      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;
      if (elLat === undefined || elLon === undefined) return null;
      const tags = el.tags ?? {};
      return {
        id: `${el.type}/${el.id}`,
        name: tags.name?.trim() || "Unnamed gym",
        lat: elLat,
        lon: elLon,
        distanceKm: haversineKm(lat, lon, elLat, elLon),
        address: buildAddress(tags),
        openingHours: tags.opening_hours ?? null,
        phone: tags.phone ?? tags["contact:phone"] ?? null,
        website: tags.website ?? tags["contact:website"] ?? null,
      };
    })
    .filter((g): g is Gym => g !== null)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return NextResponse.json({ gyms });
}
