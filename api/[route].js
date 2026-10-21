// Single Vercel serverless function for all /api/* requests.
// Keeping endpoint handlers in lib/api-handlers avoids Vercel Hobby's
// per-deployment function-count limit while retaining the existing URLs.
import australiaAlerts from '../lib/api-handlers/australia-alerts.js';
import cameras from '../lib/api-handlers/cameras.js';
import draft from '../lib/api-handlers/draft.js';
import europeAlerts from '../lib/api-handlers/europe-alerts.js';
import gdacsEvents from '../lib/api-handlers/gdacs-events.js';
import nexradSites from '../lib/api-handlers/nexrad-sites.js';
import northAmericaAlerts from '../lib/api-handlers/north-america-alerts.js';
import nwsAlerts from '../lib/api-handlers/nws-alerts.js';
import radarMosaic from '../lib/api-handlers/radar-mosaic.js';
import radarStations from '../lib/api-handlers/radar-stations.js';
import satelliteImage from '../lib/api-handlers/satellite-image.js';
import spcImage from '../lib/api-handlers/spc-image.js';
import spcMap from '../lib/api-handlers/spc-map.js';
import spcOutlook from '../lib/api-handlers/spc-outlook.js';
import spcReports from '../lib/api-handlers/spc-reports.js';
import status from '../lib/api-handlers/status.js';

const handlers = {
  'australia-alerts': australiaAlerts,
  cameras,
  draft,
  'europe-alerts': europeAlerts,
  'gdacs-events': gdacsEvents,
  'nexrad-sites': nexradSites,
  'north-america-alerts': northAmericaAlerts,
  'nws-alerts': nwsAlerts,
  'radar-mosaic': radarMosaic,
  'radar-stations': radarStations,
  'satellite-image': satelliteImage,
  'spc-image': spcImage,
  'spc-map': spcMap,
  'spc-outlook': spcOutlook,
  'spc-reports': spcReports,
  status,
};

export default async function handler(request, response) {
  let pathname = '';
  try {
    pathname = new URL(request.url || '/', 'https://atmos.invalid').pathname;
  } catch {
    response.status(400).json({ error: 'Invalid request URL.' });
    return;
  }

  const route = pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  const selected = handlers[route];
  if (!selected) {
    response.status(404).json({ error: 'API route not found.' });
    return;
  }

  try {
    await selected(request, response);
  } catch (error) {
    console.error(`[Atmos API] ${route} failed:`, error);
    if (!response.headersSent && !response.writableEnded) {
      response.status(500).json({ error: 'The weather service endpoint failed unexpectedly.' });
    }
  }
}
