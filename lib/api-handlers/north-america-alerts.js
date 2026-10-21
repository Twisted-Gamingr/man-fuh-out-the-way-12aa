import { getNorthAmericaAlerts } from '../north-america-alerts.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=30');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    return response.status(200).json(await getNorthAmericaAlerts());
  } catch (error) {
    return response.status(502).json({ error: error.message || 'North American weather warnings are unavailable.' });
  }
}
