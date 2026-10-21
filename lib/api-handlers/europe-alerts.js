const SLUGS = {
  AD:'andorra',AT:'austria',BE:'belgium',BA:'bosnia-herzegovina',BG:'bulgaria',HR:'croatia',CY:'cyprus',CZ:'czechia',DK:'denmark',EE:'estonia',FI:'finland',FR:'france',DE:'germany',GR:'greece',HU:'hungary',IS:'iceland',IE:'ireland',IL:'israel',IT:'italy',LV:'latvia',LT:'lithuania',LU:'luxembourg',MT:'malta',MD:'moldova',ME:'montenegro',NL:'netherlands',MK:'republic-of-north-macedonia',NO:'norway',PL:'poland',PT:'portugal',RO:'romania',RS:'serbia',SK:'slovakia',SI:'slovenia',ES:'spain',SE:'sweden',CH:'switzerland',UA:'ukraine',GB:'united-kingdom'
};
function decodeXml(value='') {
  return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/\s+/g, ' ').trim();
}
function tag(block, name) {
  const re = new RegExp(`<${name}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i');
  return block.match(re)?.[1] || '';
}
export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  const url = new URL(request.url, 'https://atmos.invalid');
  const country = String(url.searchParams.get('country') || '').toUpperCase();
  const slug = SLUGS[country];
  if (!slug) return response.status(200).json({ source: 'MeteoAlarm', status: 'not-covered', country, features: [], message: 'No MeteoAlarm feed is configured for this country. Use the WMO global warning centre and the national warning-service link.' });
  try {
    const upstream = await fetch(`https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-${slug}`, {
      headers: { Accept: 'application/atom+xml, application/xml, text/xml', 'User-Agent': 'Atmos Weather Dashboard (regional warning feed)' },
      cache: 'no-store', signal: AbortSignal.timeout(7000)
    });
    if (!upstream.ok) throw new Error(`MeteoAlarm returned ${upstream.status}`);
    const xml = await upstream.text();
    const features = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map((match, index) => {
      const block = match[1];
      const title = decodeXml(tag(block, 'title')) || 'Weather warning';
      const summary = decodeXml(tag(block, 'summary') || tag(block, 'content'));
      const updated = decodeXml(tag(block, 'updated') || tag(block, 'published'));
      const href = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1] || 'https://www.meteoalarm.org/';
      const id = decodeXml(tag(block, 'id')) || `${country}-${updated}-${index}`;
      const severity = /red|extreme/i.test(`${title} ${summary}`) ? 'Extreme' : /orange|severe/i.test(`${title} ${summary}`) ? 'Severe' : /yellow|moderate/i.test(`${title} ${summary}`) ? 'Moderate' : 'Minor';
      return { type: 'Feature', id: `EU:${country}:${id}`, geometry: null, properties: { country: 'REGIONAL', countryCode: country, source: 'MeteoAlarm', event: title, headline: title, description: summary, areaDesc: country, severity, sent: updated, effective: updated, web: href, certainty: 'Official national warning feed' } };
    });
    response.setHeader('Cache-Control', 'public, s-maxage=90, stale-while-revalidate=180');
    return response.status(200).json({ source: 'MeteoAlarm', status: 'live', country, features, updatedAt: new Date().toISOString() });
  } catch {
    return response.status(502).json({ source: 'MeteoAlarm', status: 'unavailable', country, features: [], error: 'MeteoAlarm could not be reached.' });
  }
}
