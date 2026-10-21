export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const params = new URL(request.url, 'https://atmos.invalid').searchParams;
  const bbox = params.get('bbox') || '';
  if (!/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(bbox)) {
    return response.status(400).json({ error: 'A valid west,south,east,north camera search box is required.' });
  }

  const target = new URL('https://datumfeed.com/api/cameras');
  target.searchParams.set('bbox', bbox);
  target.searchParams.set('limit', '100');
  target.searchParams.set('verificationStatus', 'auto_checked');
  try {
    const upstream = await fetch(target, {
      headers: { Accept: 'application/json', 'User-Agent': 'Atmos Weather Dashboard (public camera discovery)' },
      cache: 'no-store'
    });
    const data = await upstream.json();
    if (!upstream.ok) return response.status(upstream.status).json({ error: data.error || 'Public camera registry unavailable' });
    response.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=300');
    return response.status(200).json(data);
  } catch {
    return response.status(502).json({ error: 'Public camera registry unavailable' });
  }
}
