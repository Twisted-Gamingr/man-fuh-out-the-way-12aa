export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).send('Method not allowed');
  }

  const params = new URL(request.url, 'https://atmos.invalid').searchParams;
  const day = Number(params.get('day') || 1);
  if (![1, 2, 3].includes(day)) return response.status(400).send('Day must be 1, 2, or 3.');

  try {
    const productPage = await fetch(`https://www.spc.noaa.gov/products/outlook/day${day}otlk.html`, { cache: 'no-store' });
    if (!productPage.ok) return response.status(502).send('SPC outlook is unavailable.');
    const html = await productPage.text();
    const issue = html.match(new RegExp(`(\\d{3,4})\\s+UTC\\s+Day ${day} Convective Outlook`, 'i'))?.[1];
    const imageName = issue ? `day${day}otlk_${issue}.png` : html.match(new RegExp(`day${day}otlk_\\d{3,4}\\.png`, 'i'))?.[0];
    if (!imageName) return response.status(502).send('The current SPC image could not be identified.');

    const image = await fetch(`https://www.spc.noaa.gov/products/outlook/${imageName}`, { cache: 'no-store' });
    if (!image.ok) return response.status(502).send('The current SPC image is unavailable.');
    response.setHeader('Content-Type', image.headers.get('content-type') || 'image/png');
    response.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=60');
    return response.status(200).send(Buffer.from(await image.arrayBuffer()));
  } catch {
    return response.status(502).send('SPC outlook is unavailable.');
  }
}
