export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const upstream = await fetch('https://api.weather.gov/radar/stations', {
      headers: { Accept: 'application/geo+json', 'User-Agent': 'Atmos Weather Dashboard (NWS radar display)' },
      cache: 'no-store'
    });
    if (!upstream.ok) return response.status(upstream.status).json({ error: 'NWS radar stations unavailable' });
    response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=300');
    return response.status(200).json(await upstream.json());
  } catch {
    return response.status(502).json({ error: 'NWS radar stations unavailable' });
  }
}
