export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const upstream = await fetch('https://api.rainviewer.com/public/weather-maps.json', {
      headers: { Accept: 'application/json', 'User-Agent': 'Atmos Weather Dashboard (global radar mosaic)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(6500)
    });
    if (!upstream.ok) return response.status(502).json({ error: `RainViewer returned ${upstream.status}` });
    const data = await upstream.json();
    if (!data?.host || !Array.isArray(data?.radar?.past) || !data.radar.past.length) {
      return response.status(502).json({ error: 'RainViewer did not return recent radar frames.' });
    }
    response.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    return response.status(200).json(data);
  } catch {
    return response.status(502).json({ error: 'Global radar mosaic is temporarily unavailable.' });
  }
}
