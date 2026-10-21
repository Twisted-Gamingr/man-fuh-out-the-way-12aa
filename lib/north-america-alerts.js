const NWS_URL = 'https://api.weather.gov/alerts/active';
const ECCC_URL = 'https://api.weather.gc.ca/collections/weather-alerts/items';

function stateCodesFromAlert(properties = {}) {
  const ugc = properties.geocode?.UGC || [];
  return [...new Set(ugc
    .map(code => String(code).toUpperCase().match(/^([A-Z]{2})(?:C|Z)\d+$/)?.[1])
    .filter(Boolean))];
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Weather alert source returned ${response.status}`);
  return response.json();
}

async function fetchNwsAlerts() {
  const data = await fetchJson(NWS_URL, {
    headers: { Accept: 'application/geo+json', 'User-Agent': 'Atmos Weather Dashboard (public warning display)' },
    cache: 'no-store'
  });
  return (data.features || []).map(feature => {
    const properties = feature.properties || {};
    return {
      ...feature,
      id: `US:${feature.id || properties.id || properties.event || Math.random().toString(36).slice(2)}`,
      properties: {
        ...properties,
        country: 'US',
        source: 'NWS',
        stateCodes: stateCodesFromAlert(properties),
        web: properties.web || 'https://www.weather.gov/'
      }
    };
  });
}

function canadianFeature(feature) {
  const source = feature.properties || {};
  const name = source.alert_name_en || source.alert_short_name_en || source.alert_code || 'Weather alert';
  const place = source.feature_name_en || 'Canada';
  const province = String(source.province || '').toUpperCase();
  const id = source.id || source.feature_id || feature.id || `${name}-${place}-${source.publication_datetime || ''}`;
  const colour = String(source.risk_colour_en || '').toLowerCase();
  const severity = colour === 'red' ? 'Extreme' : colour === 'orange' ? 'Severe' : colour === 'yellow' ? 'Moderate' : 'Minor';
  const headline = place === 'Canada' ? name : `${name} for ${place}`;

  return {
    type: 'Feature',
    id: `CA:${id}:${place}:${source.publication_datetime || ''}`,
    geometry: feature.geometry || null,
    properties: {
      event: name,
      headline,
      description: source.alert_text_en || source.impact_en || source.confidence_en || '',
      areaDesc: [place, province].filter(Boolean).join(', '),
      severity,
      certainty: source.confidence_en || 'Unknown certainty',
      sent: source.publication_datetime || source.validity_datetime || '',
      effective: source.validity_datetime || source.publication_datetime || '',
      expires: source.expiration_datetime || source.event_end_datetime || '',
      web: 'https://weather.gc.ca/en/alert',
      country: 'CA',
      source: 'ECCC',
      province,
      stateCodes: [],
      regionCodes: province ? [province] : [],
      alertType: source.alert_type || '',
      riskColour: colour
    }
  };
}

async function fetchEcccAlerts() {
  const firstPage = new URL(ECCC_URL);
  firstPage.searchParams.set('f', 'json');
  firstPage.searchParams.set('limit', '1000');
  const features = [];
  let nextUrl = firstPage;
  let pageCount = 0;

  while (nextUrl && pageCount < 4) {
    const data = await fetchJson(nextUrl, { headers: { Accept: 'application/geo+json, application/json' }, cache: 'no-store' });
    features.push(...(data.features || []));
    const next = data.links?.find(link => link.rel === 'next')?.href;
    if (!next) break;
    const candidate = new URL(next, ECCC_URL);
    if (candidate.origin !== 'https://api.weather.gc.ca') break;
    nextUrl = candidate;
    pageCount += 1;
  }

  const now = Date.now();
  return features
    .filter(feature => {
      const properties = feature.properties || {};
      const status = String(properties.status_en || '').toLowerCase();
      const expiry = Date.parse(properties.expiration_datetime || properties.event_end_datetime || '');
      return !/ended|cancelled|canceled|expired/.test(status) && (!Number.isFinite(expiry) || expiry > now);
    })
    .map(canadianFeature);
}

export async function getNorthAmericaAlerts() {
  const [usResult, canadaResult] = await Promise.allSettled([fetchNwsAlerts(), fetchEcccAlerts()]);
  const usAlerts = usResult.status === 'fulfilled' ? usResult.value : [];
  const canadaAlerts = canadaResult.status === 'fulfilled' ? canadaResult.value : [];
  const sources = {
    us: { name: 'National Weather Service', status: usResult.status === 'fulfilled' ? 'live' : 'unavailable', count: usAlerts.length },
    canada: { name: 'Environment and Climate Change Canada', status: canadaResult.status === 'fulfilled' ? 'live' : 'unavailable', count: canadaAlerts.length }
  };

  if (usResult.status === 'rejected' && canadaResult.status === 'rejected') {
    throw new Error('Both North American weather warning feeds are unavailable.');
  }

  const features = [...usAlerts, ...canadaAlerts].sort((a, b) =>
    Date.parse(b.properties?.sent || '') - Date.parse(a.properties?.sent || ''));
  return { type: 'FeatureCollection', features, sources, updatedAt: new Date().toISOString() };
}
