export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=30');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const params = new URL(request.url, 'https://atmos.invalid').searchParams;
  const point = params.get('point');
  const worldwide = params.get('scope') === 'worldwide';
  if (!worldwide && (!point || !/^-?\d{1,3}(?:\.\d+)?,-?\d{1,3}(?:\.\d+)?$/.test(point))) {
    return response.status(400).json({ error: 'Provide valid latitude,longitude coordinates or scope=worldwide.' });
  }

  const target = new URL('https://api.weather.gov/alerts/active');
  if (worldwide) target.searchParams.set('status', 'actual');
  else target.searchParams.set('point', point);

  try {
    const upstream = await fetch(target, {
      headers: {
        Accept: 'application/geo+json',
        'User-Agent': 'Atmos Weather Dashboard (public alert display)'
      },
      cache: 'no-store'
    });
    const data = await upstream.json();
    if (!upstream.ok) return response.status(upstream.status).json({ error: 'NWS alerts unavailable' });
    return response.status(200).json(data);
  } catch {
    return response.status(502).json({ error: 'NWS alerts unavailable' });
  }
}
