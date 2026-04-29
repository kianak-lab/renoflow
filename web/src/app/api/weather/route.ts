import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number.parseFloat(searchParams.get("latitude") ?? "");
  const lon = Number.parseFloat(searchParams.get("longitude") ?? "");

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const upstream = new URL(OPEN_METEO);
  upstream.searchParams.set("latitude", String(lat));
  upstream.searchParams.set("longitude", String(lon));
  upstream.searchParams.set("current", "temperature_2m,weather_code");
  upstream.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
  upstream.searchParams.set("temperature_unit", "celsius");
  upstream.searchParams.set("wind_speed_unit", "kph");
  upstream.searchParams.set("timezone", "auto");

  let res: Response;
  try {
    res = await fetch(upstream.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Weather service unreachable" }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: "Weather service error" }, { status: 502 });
  }

  const data = (await res.json()) as { reason?: string; error?: boolean };
  if (data && (data.reason || data.error === true)) {
    return NextResponse.json({ error: "Weather service error" }, { status: 502 });
  }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "private, max-age=300",
    },
  });
}
