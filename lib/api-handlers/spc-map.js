const LAYERS = {
  1: { categorical: 1, tornado: 3, hail: 5, wind: 7 },
  2: { categorical: 9, tornado: 11, hail: 13, wind: 15 },
  3: { categorical: 17 }
};

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const day = Number(request.query?.day || 1);
  const hazard = String(request.query?.hazard || 'categorical');
  const layer = LAYERS[day]?.[hazard];
  if (!layer) {
    return response.status(200).json({ features: [], message: 'SPC publishes a combined severe probability outlook for Day 3; separate tornado, wind, and hail layers are available on Days 1 and 2.' });
  }

  try {
    const url = new URL(`https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer/${layer}/query`);
    url.searchParams.set('where', '1=1');
    url.searchParams.set('outFields', '*');
    url.searchParams.set('returnGeometry', 'true');
    url.searchParams.set('outSR', '4326');
    url.searchParams.set('f', 'geojson');
    const upstream = await fetch(url, { headers: { Accept: 'application/geo+json, application/json' }, cache: 'no-store' });
    const data = await upstream.json();
    if (!upstream.ok || data.error) return response.status(502).json({ error: 'Official SPC map service is temporarily unavailable.' });
    return response.status(200).json(data);
  } catch {
    return response.status(502).json({ error: 'Official SPC map service is temporarily unavailable.' });
  }
}
