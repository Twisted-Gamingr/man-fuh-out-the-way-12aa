export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const upstream = await fetch('https://atmostorm.com/api/v1/nexrad/sites', {
      headers: { Accept: 'application/json', 'User-Agent': 'Atmos Weather Dashboard (single-site radar map)' },
      cache: 'no-store'
    });
    if (!upstream.ok) return response.status(502).json({ error: 'Single-site NEXRAD station list unavailable' });
    response.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=300');
    return response.status(200).json(await upstream.json());
  } catch {
    return response.status(502).json({ error: 'Single-site NEXRAD station list unavailable' });
  }
}
