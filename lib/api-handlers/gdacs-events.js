export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=180');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const upstream = await fetch('https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP', {
      headers: { Accept: 'application/geo+json, application/json' },
      cache: 'no-store'
    });
    if (!upstream.ok) return response.status(502).json({ error: 'GDACS events unavailable' });
    return response.status(200).json(await upstream.json());
  } catch {
    return response.status(502).json({ error: 'GDACS events unavailable' });
  }
}
