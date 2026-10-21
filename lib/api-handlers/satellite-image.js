const satellites = new Set(['GOES18', 'GOES19']);
const channels = new Set(['GEOCOLOR', '13', '08', '02']);

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).send('Method not allowed');
  }

  const params = new URL(request.url, 'https://atmos.invalid').searchParams;
  const satellite = params.get('satellite') || '';
  const channel = params.get('channel') || '';
  if (!satellites.has(satellite) || !channels.has(channel)) {
    return response.status(400).send('Unsupported GOES satellite or image channel.');
  }

  try {
    let imageUrl = `https://cdn.star.nesdis.noaa.gov/${satellite}/ABI/FD/GEOCOLOR/1808x1808.jpg`;
    if (channel !== 'GEOCOLOR') {
      const page = await fetch(`https://www.star.nesdis.noaa.gov/GOES/fulldisk_band.php?band=${channel}&length=12&sat=${satellite === 'GOES19' ? 'G19' : 'G18'}`, { cache: 'no-store' });
      if (!page.ok) return response.status(502).send('NOAA satellite viewer unavailable.');
      const html = await page.text();
      const imagePath = html.match(new RegExp(`/GOES${satellite.slice(4)}/ABI/FD/${channel}/[\\w.-]+\\.jpg`, 'i'))?.[0];
      if (!imagePath) return response.status(404).send('NOAA is not currently serving imagery for this band.');
      imageUrl = `https://cdn.star.nesdis.noaa.gov${imagePath}`;
    }
    const image = await fetch(imageUrl, { cache: 'no-store' });
    if (!image.ok) return response.status(image.status).send('NOAA satellite image unavailable.');
    response.setHeader('Content-Type', image.headers.get('content-type') || 'image/jpeg');
    response.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
    return response.status(200).send(Buffer.from(await image.arrayBuffer()));
  } catch {
    return response.status(502).send('NOAA satellite image unavailable.');
  }
}
