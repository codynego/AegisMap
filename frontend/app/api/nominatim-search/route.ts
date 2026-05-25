import { NextResponse, type NextRequest } from "next/server";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Math.max(1, Math.min(20, Number(searchParams.get("limit") ?? "10") || 10));
  const state = searchParams.get("state")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const query = state ? `${q}, ${state}, Nigeria` : q;
  const upstreamParams = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    limit: String(limit),
    countrycodes: "ng",
    dedupe: "1",
    namedetails: "1",
    "accept-language": "en",
  });

  const upstream = await fetch(`${NOMINATIM_URL}?${upstreamParams.toString()}`, {
    headers: {
      "User-Agent": "AegisMap/1.0 (route intelligence autocomplete)",
      Accept: "application/json",
    },
  });

  if (!upstream.ok) {
    return NextResponse.json([], { status: 200 });
  }

  const payload = await upstream.json();
  return NextResponse.json(Array.isArray(payload) ? payload : []);
}
