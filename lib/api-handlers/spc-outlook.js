export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const days = {};
  await Promise.all([1, 2, 3].map(async day => {
    try {
      const upstream = await fetch(`https://www.spc.noaa.gov/products/outlook/day${day}otlk.html`, { cache: 'no-store' });
      if (!upstream.ok) return;
      const html = await upstream.text();
      const pageTitle = html.match(new RegExp(`([^<]{0,100}?(\\d{3,4})\\s+UTC\\s+Day ${day} Convective Outlook)`, 'i'));
      const issued = pageTitle?.[2] || '';
      const imageName = issued ? `day${day}otlk_${issued}.png` : html.match(new RegExp(`day${day}otlk_\\d{3,4}\\.png`, 'i'))?.[0];
      const updated = html.match(/Updated:\s*([^<]{0,100})/i)?.[1]?.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').replace(/[([]\s*$/, '').trim() || '';
      if (!imageName) return;
      days[day] = {
        url: `https://www.spc.noaa.gov/products/outlook/${imageName}`,
        image: `/api/spc-image?day=${day}`,
        issued,
        revision: updated || upstream.headers.get('last-modified') || upstream.headers.get('etag') || imageName
      };
    } catch {}
  }));

  response.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=60');
  if (!Object.keys(days).length) return response.status(502).json({ error: 'SPC source unavailable' });
  return response.status(200).json({ days, revision: days[1]?.revision || '' });
}
