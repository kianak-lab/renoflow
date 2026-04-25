export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  const res = await fetch(
    `https://serpapi.com/search?engine=home_depot&q=${encodeURIComponent(q)}&country=ca&api_key=${process.env.SERPAPI_KEY}`
  );
  const data = await res.json();
  return Response.json(data.products || []);
}
