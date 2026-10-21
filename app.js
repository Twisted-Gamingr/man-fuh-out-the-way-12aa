const API = {
  radarStations: 'https://atmostorm.com/api/v1/nexrad/sites',
  cameras: 'https://datumfeed.com/api/cameras',
  nws: 'https://api.weather.gov/alerts/active',
  geocoding: 'https://geocoding-api.open-meteo.com/v1/search',
  forecast: 'https://api.open-meteo.com/v1/forecast',
  gfs: 'https://api.open-meteo.com/v1/gfs',
  ecmwf: 'https://api.open-meteo.com/v1/ecmwf',
  nhc: 'https://www.nhc.noaa.gov/maps/currentStorms/currentStorms.json'
};

const SLUGS = {
  AD:'andorra',AT:'austria',BE:'belgium',BA:'bosnia-herzegovina',BG:'bulgaria',HR:'croatia',CY:'cyprus',CZ:'czechia',DK:'denmark',EE:'estonia',FI:'finland',FR:'france',DE:'germany',GR:'greece',HU:'hungary',IS:'iceland',IE:'ireland',IT:'italy',LV:'latvia',LT:'lithuania',LU:'luxembourg',MT:'malta',MD:'moldova',ME:'montenegro',NL:'netherlands',MK:'republic-of-north-macedonia',NO:'norway',PL:'poland',PT:'portugal',RO:'romania',RS:'serbia',SK:'slovakia',SI:'slovenia',ES:'spain',SE:'sweden',CH:'switzerland',UA:'ukraine',GB:'united-kingdom'
};

const US_STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming']
];
const CANADA_REGIONS = [
  ['AB','Alberta'],['BC','British Columbia'],['MB','Manitoba'],['NB','New Brunswick'],['NL','Newfoundland and Labrador'],['NS','Nova Scotia'],['NT','Northwest Territories'],['NU','Nunavut'],['ON','Ontario'],['PE','Prince Edward Island'],['QC','Quebec'],['SK','Saskatchewan'],['YT','Yukon']
];

const state = {
  page: location.hash.slice(1) || 'overview',
  warningRegion: 'auto',
  globalRadarMap: null,
  globalRadarLayer: null,
  globalRadarFrames: [],
  globalRadarFrameIndex: -1,
  globalRadarLoadedAt: null,
  spotterReports: [],
  spotterReportsStatus: 'idle',
  serviceStatus: [],
  serviceStatusCheckedAt: null,
  place: { name: 'World overview', region: 'Global', latitude: 15, longitude: 0, country: '', timezone: 'UTC' },
  weather: null,
  alerts: [],
  alertRegion: 'all',
  alertFeedStatus: null,
  gdacsEvents: [],
  gdacsLoaded: false,
  gdacsError: false,
  alertFilter: 'all',
  outlookDay: 1,
  radar: null,
  radarFrameIndex: 0,
  radarLayer: 'reflectivity',
  radarStations: [],
  radarStationId: '',
  radarRegion: 'auto',
  radarMap: null,
  radarProductMap: null,
  radarProductLayer: null,
  lightningMapLayer: null,
  canadaOutlookMap: null,
  canadaOutlookWmsLayer: null,
  canadaOutlookLayer: 'GDPS_15km_AirTemp_2m',
  radarSiteMarkers: [],
  radarPlaceMarker: null,
  radarScanIndex: null,
  radarPlaybackTimer: null,
  lightning: false,
  showCameras: false,
  map: null,
  mapLayer: null,
  mapKind: null,
  mapMarkers: [],
  timelineTimer: null,
  model: 'GFS',
  modelData: null,
  modelGridData: [],
  modelMap: null,
  modelCellLayers: [],
  modelFieldLayer: null,
  modelPointMarker: null,
  modelSelectedData: null,
  modelSelectedPoint: null,
  modelVariable: 'temperature_2m',
  modelFrame: 0,
  modelHorizon: 72,
  modelPlaybackTimer: null,
  satellite: 'east',
  satelliteChannel: 'GEOCOLOR',
  cameras: [],
  discoveredCameras: [],
  cameraPreferences: { mode: 'automatic', radiusKm: 40 },
  cameraQueryKey: '',
  cameraImageTimer: null,
  cameraMarkers: [],
  outlooks: [],
  outlookMap: null,
  outlookMapLayer: null,
  outlookHazard: 'categorical',
  nhcStorms: [],
  socialPlatform: 'YouTube',
  socialPrompt: '',
  installPrompt: null
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value = '') => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const fmtClock = (date = new Date()) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }).format(date);
const setText = (selector, text) => { const element = $(selector); if (element) element.textContent = text; };
const storage = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(`atmos:${key}`)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`atmos:${key}`, JSON.stringify(value)); } catch {} }
};

function toast(message) {
  const stack = $('#toast-stack');
  if (!stack) return;
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  stack.append(node);
  setTimeout(() => node.remove(), 4200);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { Accept: 'application/geo+json, application/json', ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}

async function fetchNws(query) {
  try { return await fetchJson(`/api/nws-alerts?${query}`); }
  catch { return fetchJson(`${API.nws}?${query}`); }
}

function initPreferences() {
  state.warningRegion = storage.get('warning-region', 'auto');
  const theme = storage.get('theme', 'dark');
  document.documentElement.dataset.theme = theme;
  $$('.theme-option').forEach(button => button.classList.toggle('selected', button.dataset.theme === theme));
  const accent = storage.get('accent', '#d1f477');
  document.documentElement.style.setProperty('--accent', accent);
  $('#custom-accent').value = accent;
  $$('.swatch').forEach(button => button.classList.toggle('selected', button.dataset.accent === accent));
  state.cameras = storage.get('cameras', []);
  state.radarStationId = storage.get('radar-station', '');
  state.cameraPreferences = storage.get('camera-preferences', { mode: 'automatic', radiusKm: 40 });
  state.discoveredCameras = storage.get('camera-discoveries', { key: '', at: 0, items: [] }).items || [];
}

function bindPersistentControls() {
  $$('.theme-option').forEach(button => button.addEventListener('click', () => {
    document.documentElement.dataset.theme = button.dataset.theme;
    storage.set('theme', button.dataset.theme);
    $$('.theme-option').forEach(item => item.classList.toggle('selected', item === button));
  }));
  $$('.swatch[data-accent]').forEach(button => button.addEventListener('click', () => setAccent(button.dataset.accent)));
  $('#custom-accent').addEventListener('input', event => setAccent(event.target.value));
  $('#mobile-menu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#use-location').addEventListener('click', useMyLocation);
  $('#location-search-button').addEventListener('click', searchLocation);
  $('#location-input').addEventListener('keydown', event => { if (event.key === 'Enter') searchLocation(); });
  $('#location-input').addEventListener('input', debounce(searchSuggestions, 280));
  $('#notifications-open').addEventListener('click', openNotificationModal);
  $('#background-music-dock')?.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(button)handleAction({currentTarget:button});});
  $$('.settings-open').forEach(button => button.addEventListener('click', () => navigate('settings')));
  $('#modal-backdrop').addEventListener('click', event => { if (event.target.id === 'modal-backdrop') closeModal(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
}

function setAccent(color) {
  document.documentElement.style.setProperty('--accent', color);
  $('#custom-accent').value = color;
  storage.set('accent', color);
  $$('.swatch').forEach(button => button.classList.toggle('selected', button.dataset.accent === color));
}

function debounce(fn, wait) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); };
}

async function searchSuggestions() {
  const query = $('#location-input').value.trim();
  const results = $('#search-results');
  if (query.length < 3) { results.hidden = true; return; }
  try {
    const data = await fetchJson(`${API.geocoding}?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
    const places = data.results || [];
    results.innerHTML = places.length ? places.map((place, index) => `<button class="search-result" data-place-index="${index}"><span>${esc(place.name)}${place.admin1 ? `, ${esc(place.admin1)}` : ''}</span><small>${esc(place.country || '')}</small></button>`).join('') : '<div class="empty-state">No places found.</div>';
    results.hidden = false;
    $$('.search-result', results).forEach(button => button.addEventListener('click', () => {
      const place = places[Number(button.dataset.placeIndex)];
      selectPlace(place);
      results.hidden = true;
    }));
  } catch {
    results.hidden = true;
  }
}

async function searchLocation() {
  const query = $('#location-input').value.trim();
  if (!query) return;
  try {
    const data = await fetchJson(`${API.geocoding}?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
    if (!data.results?.length) { toast('No matching location found. Try a city or postal code.'); return; }
    selectPlace(data.results[0]);
    $('#search-results').hidden = true;
  } catch { toast('Location search is unavailable right now.'); }
}

function selectPlace(place) {
  state.radarRegion='auto';
  state.place = {
    name: place.name,
    region: [place.admin1, place.country].filter(Boolean).join(', '),
    latitude: place.latitude,
    longitude: place.longitude,
    country: place.country_code || '',
    timezone: place.timezone || 'UTC'
  };
  $('#location-input').value = `${place.name}${place.admin1 ? `, ${place.admin1}` : ''}`;
  storage.set('place', state.place);
  state.radarStationId = '';
  state.radarScanIndex = null;
  state.cameraQueryKey = '';
  state.discoveredCameras = [];
  storage.set('radar-station', '');
  state.modelData=null;
  refreshData();
  renderPage();
  toast(`Location set to ${place.name}.`);
}

function useMyLocation() {
  if (!navigator.geolocation) { toast('This browser does not provide location access.'); return; }
  navigator.geolocation.getCurrentPosition(async position => {
    const { latitude, longitude } = position.coords;
    try {
      const data = await fetchJson(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
      selectPlace({ name: data.city || data.locality || 'My location', admin1: data.principalSubdivision, country: data.countryName, country_code: data.countryCode, latitude, longitude, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    } catch {
      selectPlace({ name: 'My location', admin1: '', country: '', country_code: '', latitude, longitude, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    }
  }, () => toast('Location permission was unavailable. You can search for a place instead.'), { enableHighAccuracy: false, timeout: 10000 });
}

function navigate(page) {
  const validPages = ['overview','radar','alerts','outlooks','models','satellite','cameras','reports','creators','status','music','social','settings'];
  state.page = validPages.includes(page) ? page : 'overview';
  if (location.hash !== `#${state.page}`) history.pushState(null, '', `#${state.page}`);
  $('#sidebar').classList.remove('open');
  renderPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindNavigation() {
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-page]');
    if (!link) return;
    event.preventDefault();
    navigate(link.dataset.page);
  });
  window.addEventListener('hashchange', () => { state.page = location.hash.slice(1) || 'overview'; renderPage(); });
  window.addEventListener('popstate', () => { state.page = location.hash.slice(1) || 'overview'; renderPage(); });
}

const PAGE_INFO = {
  overview: ['OVERVIEW','Your weather desk at a glance','Good day, weather watcher. Here’s what’s happening around your selected area.'],
  radar: ['RADAR','Radar & observations','Global precipitation mosaic with regional radar products where supported.'],
  alerts: ['WARNINGS','Active weather warnings','Region-aware official warning feeds where integrated, plus global hazard alerts and national service links.'],
  outlooks: ['SPC OUTLOOKS','Severe weather outlooks','Official Storm Prediction Center outlooks and products.'],
  models: ['MODEL DESK','Forecast model explorer','Explore spatial guidance across a forecast map and play it forward by hour.'],
  satellite: ['SATELLITE','Satellite imagery','Current geostationary imagery from NOAA / NESDIS GOES satellites.'],
  cameras: ['ROAD CAMERAS','Live camera desk','Automatically find public camera feeds near your selected area or search manually.'],
  reports: ['STORM REPORTS','Spotter & severe-weather reports','Recent U.S. preliminary storm reports plus official spotter-network resources. Coverage and reporting delays vary by country.'],
  creators: ['WEATHER CREATORS','Meteorologists & storm coverage','A curated list of weather educators, meteorologists, and storm-chasing channels. Check official agencies for warnings.'],
  status: ['SERVICE STATUS','Provider health & coverage','Live connection checks for the weather services and map providers this dashboard depends on.'],
  music: ['YOUR TOOLS','Weather desk music','Bring a Spotify playlist or Apple Music album into your workspace.'],
  social: ['YOUR TOOLS','Social studio','Prepare a warning-aware post preview for your channels.'],
  settings: ['PREFERENCES','Workspace settings','Tune your display and notification preferences.']
};

function renderPage() {
  let [crumb, title, subtitle] = PAGE_INFO[state.page] || PAGE_INFO.overview;
  if(state.page==='radar')subtitle=radarCoverageRegion()==='US'?'Explore the map to choose any location and its nearest NWS radar site.':`Explore the map, then open the official ${regionName(radarCoverageRegion())} radar feed.`;
  setText('#page-crumb', crumb);
  $$('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.page === state.page));
  const titleMarkup = `<div class="page-heading"><div><div class="eyebrow">${esc(crumb)} <span class="muted">/ ${esc(state.place.name.toUpperCase())}</span></div><h1>${esc(title)}</h1><p class="page-subtitle">${esc(subtitle)}</p></div>${pageActions()}</div>`;
  const views = {
    overview: renderOverview,
    radar: renderRadarPage,
    alerts: renderAlertsPage,
    outlooks: renderOutlooksPage,
    models: renderModelsPage,
    satellite: renderSatellitePage,
    cameras: renderCamerasPage,
    reports: renderReportsPage,
    creators: renderCreatorsPage,
    status: renderStatusPage,
    music: renderMusicPage,
    social: renderSocialPage,
    settings: renderSettingsPage
  };
  if (state.modelMap) { state.modelMap.remove(); state.modelMap = null; state.modelCellLayers = []; state.modelFieldLayer=null; state.modelPointMarker=null; }
  if (state.globalRadarMap) { state.globalRadarMap.remove(); state.globalRadarMap=null; state.globalRadarLayer=null; }
  if (state.radarMap) { state.radarMap.remove(); state.radarMap=null; state.radarSiteMarkers=[];state.radarPlaceMarker=null; }
  if (state.radarProductMap) { state.radarProductMap.remove(); state.radarProductMap=null;state.radarProductLayer=null;state.lightningMapLayer=null; }
  if (state.outlookMap) { state.outlookMap.remove();state.outlookMap=null;state.outlookMapLayer=null; }
  if (state.canadaOutlookMap) { state.canadaOutlookMap.remove();state.canadaOutlookMap=null;state.canadaOutlookWmsLayer=null; }
  if (state.map) { state.map.remove(); state.map = null; state.mapLayer = null; state.mapMarkers = []; state.cameraMarkers = []; }
  if (state.modelPlaybackTimer) { clearInterval(state.modelPlaybackTimer); state.modelPlaybackTimer = null; }
  if (state.radarPlaybackTimer) { clearInterval(state.radarPlaybackTimer); state.radarPlaybackTimer = null; }
  $('#page-content').innerHTML = titleMarkup + (views[state.page] || renderOverview)();
  if(state.page==='social'){
    $('.social-setup .check-list')?.insertAdjacentHTML('beforebegin',socialMonitorMarkup(savedSocialMonitor()));
    const autoLabel=$('#social-enable')?.closest('label');if(autoLabel)autoLabel.lastChild.textContent='Prepare a draft for new warnings in the monitored areas';
  }
  bindPageInteractions();
  syncBackgroundMusicPlayer();
  if(state.page==='alerts')renderGlobalHazardsCard();
  if (state.page === 'overview') initMap('dashboard');
  if (state.page === 'cameras') initMap('cameras');
  if (state.page === 'cameras' && state.cameraPreferences.mode === 'automatic') discoverCameras();
  if (state.page === 'radar') { initGlobalRadarMap();initRadarSiteMap();initRadarProductMap();loadRadarStations(); }
  if (state.page === 'reports') loadSpotterReports();
  if (state.page === 'status') loadServiceStatus();
  if (state.page === 'models') { initModelMap(); loadModelData(); }
  if (state.page === 'outlooks') { loadOutlookMap();initCanadaOutlookMap(); }
  if (state.page === 'satellite') updateSatelliteImage();
}

function pageActions() {
  if (state.page === 'overview') return `<div class="header-controls"><span class="live-pill"><span class="pulse-dot"></span>FEEDS CONNECTED</span></div>`;
  if (state.page === 'radar') return `<div class="header-controls"><button class="btn btn-quiet" data-action="refresh-radar">↻ Refresh radar</button></div>`;
  if (state.page === 'alerts') return `<div class="header-controls"><button class="btn btn-primary" data-action="notifications">♧ Set alert preferences</button></div>`;
  if (state.page === 'outlooks') return `<div class="header-controls"><select class="select-control" id="outlook-day"><option value="1" ${state.outlookDay===1?'selected':''}>Day 1</option><option value="2" ${state.outlookDay===2?'selected':''}>Day 2</option><option value="3" ${state.outlookDay===3?'selected':''}>Day 3</option></select><button class="btn btn-quiet" data-action="refresh-outlooks">↻ Refresh</button></div>`;
  if (state.page === 'models') return `<div class="header-controls"><span class="card-note">UPDATED <span id="model-updated">—</span></span></div>`;
  if (state.page === 'satellite') return `<div class="header-controls"><span class="live-pill"><span class="pulse-dot"></span>NOAA / NESDIS</span></div>`;
  if (state.page === 'cameras') return `<div class="header-controls"><button class="btn btn-primary" data-action="add-camera">＋ Add camera</button></div>`;
  if (state.page === 'social') return `<div class="header-controls"><span class="card-note">DRAFT MODE</span></div>`;
  return '';
}

function locationLine() { return `${state.place.name}${state.place.region ? ` · ${state.place.region}` : ''}`; }

function renderOverview() {
  const selectedLayer = ['reflectivity','velocity','correlation','tilt-1','tilt-2','tilt-3','tilt-4'].includes(state.radarLayer) ? state.radarLayer : 'reflectivity';
  return `<div class="status-strip"><div class="status-left"><span class="pulse-dot"></span><span><strong>Monitoring ${esc(state.place.name)}</strong> · global radar mosaic and location-aware weather feeds refresh automatically</span></div><div class="status-right">LAST CHECK <span id="last-updated">—</span> UTC</div></div>
    <div class="dashboard-grid">
      <section class="card dashboard-map-card"><div class="map-toolbar"><div class="map-tool-left"><span class="map-tool-title">GLOBAL PRECIPITATION MOSAIC</span><span class="live-pill"><span class="pulse-dot"></span>LIVE</span></div><div class="map-tools-right"><span class="card-note" id="global-radar-stamp">GLOBAL · RECENT COMPOSITE</span><button class="map-expand" data-action="refresh-global-radar">↻ Refresh</button><button class="map-expand" data-page="radar">Radar explorer ↗</button></div></div><div class="map-wrap"><div id="radar-map"></div><div class="map-overlay-label"><span class="pulse-dot"></span>GLOBAL RADAR MOSAIC</div><div class="map-status" id="map-status">Loading worldwide composite radar tiles…</div><div class="map-attribution">Weather radar tiles by <a href="https://www.rainviewer.com/" target="_blank" rel="noreferrer">RainViewer</a> · map tiles © Esri</div></div><div class="timeline radar-auto-status"><span class="pulse-dot"></span><span>Composite reflectivity · observed radar coverage varies by region</span><span class="frame-count" id="frame-count">GLOBAL MOSAIC</span></div></section>
      <div class="sidebar-stack"><section class="card"><div class="card-head"><h2 class="card-title"><span class="eyebrow-dot"></span>ACTIVE ALERTS</h2><a class="card-note" href="#alerts" data-page="alerts">ALL WARNINGS ↗</a></div><div class="alert-summary" id="alert-summary">${alertSummaryMarkup()}</div><div class="mini-alert-list" id="mini-alert-list">${miniAlertsMarkup()}</div></section>
        <section class="card"><div class="card-head"><h2 class="card-title"><span class="eyebrow-dot"></span>LOCAL CONDITIONS</h2><span class="card-note">OPEN-METEO</span></div><div class="weather-current" id="weather-current">${weatherMarkup()}</div></section>
      </div>
    </div>
    <div class="quick-grid"><a class="card quick-card" href="#outlooks" data-page="outlooks"><span class="quick-icon">⌁</span><span class="quick-copy"><strong>Outlooks</strong><span>SPC severe-weather risk and Canada forecast maps</span></span></a><a class="card quick-card" href="#models" data-page="models"><span class="quick-icon">⌘</span><span class="quick-copy"><strong>Model desk</strong><span>Compare forecast guidance</span></span></a><a class="card quick-card" href="#satellite" data-page="satellite"><span class="quick-icon">◉</span><span class="quick-copy"><strong>Satellite imagery</strong><span>GOES East & West</span></span></a><a class="card quick-card" href="#alerts" data-page="alerts"><span class="quick-icon">♧</span><span class="quick-copy"><strong>Alert notifications</strong><span>Choose area & warning types</span></span></a></div>`;
}

function alertSummaryMarkup() {
  const count = state.alerts.length;
  const warningCount = state.alerts.filter(alert => /warning/i.test(alert.properties?.event || '')).length;
  const watchCount = state.alerts.filter(alert => /watch/i.test(alert.properties?.event || '')).length;
  const signal=!state.alertFeedStatus?'LOADING':state.alertFeedStatus.us?.status==='unavailable'&&state.alertFeedStatus.canada?.status==='unavailable'?'OFFLINE':count?'ATTENTION':'CLEAR';
  return `<div class="alert-summary-top"><div><div class="alert-number">${state.alertFeedStatus?count:'—'}</div><div class="alert-caption">active in the selected feed</div></div><span class="alert-signal">${signal}</span></div><div class="alert-summary-list"><div class="alert-summary-row"><i class="alert-type-dot"></i>Warnings<small>${warningCount}</small></div><div class="alert-summary-row"><i class="alert-type-dot" style="background:var(--orange)"></i>Watches & advisories<small>${Math.max(0, count - warningCount) || watchCount}</small></div></div>`;
}

function miniAlertsMarkup() {
  if (!state.alerts.length) return `<div class="empty-state">${state.alertFeedStatus ? 'No active alerts in the selected feed.' : 'Connecting to U.S. and Canadian warning feeds…'}<br><span class="tiny">Official agency feeds; geographic coverage varies.</span></div>`;
  return state.alerts.slice(0, 4).map(alert => {
    const props = alert.properties || {};
    return `<a class="mini-alert" href="${esc(props.web || 'https://www.weather.gov/')}" target="_blank" rel="noreferrer"><span class="severity-mark ${severityClass(props.severity)}"></span><span class="mini-alert-text"><strong>${esc(props.event || 'Weather alert')}</strong><small>${esc(shortArea(props.areaDesc))}</small></span><span class="mini-alert-time">${relativeTime(props.sent)}</span></a>`;
  }).join('');
}

function weatherMarkup() {
  const weather = state.weather?.current;
  if (!weather) return `<div class="weather-location">⌖ ${esc(locationLine())}</div><div><div class="weather-temp">—°</div><div class="weather-condition">${state.place.country?'Loading local weather…':'Choose a location for local conditions.'}</div></div><div class="weather-icon">◌</div><div class="weather-metrics"><div class="weather-metric"><span>WIND</span><strong>—</strong></div><div class="weather-metric"><span>HUMIDITY</span><strong>—</strong></div><div class="weather-metric"><span>GUSTS</span><strong>—</strong></div></div>`;
  return `<div class="weather-location">⌖ ${esc(locationLine())}</div><div><div class="weather-temp">${Math.round(weather.temperature_2m)}°</div><div class="weather-condition">${weatherCode(weather.weather_code)} · feels ${Math.round(weather.apparent_temperature)}°</div></div><div class="weather-icon">${weatherIcon(weather.weather_code)}</div><div class="weather-metrics"><div class="weather-metric"><span>WIND</span><strong>${Math.round(weather.wind_speed_10m || 0)} km/h</strong></div><div class="weather-metric"><span>HUMIDITY</span><strong>${weather.relative_humidity_2m ?? '—'}%</strong></div><div class="weather-metric"><span>GUSTS</span><strong>${Math.round(weather.wind_gusts_10m || 0)} km/h</strong></div></div>`;
}

function weatherCode(code) {
  if ([0].includes(code)) return 'Clear sky';
  if ([1,2].includes(code)) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if ([45,48].includes(code)) return 'Fog';
  if ([51,53,55,56,57].includes(code)) return 'Drizzle';
  if ([61,63,65,66,67,80,81,82].includes(code)) return 'Rain';
  if ([71,73,75,77,85,86].includes(code)) return 'Snow';
  if ([95,96,99].includes(code)) return 'Thunderstorm';
  return 'Current conditions';
}
function weatherIcon(code) { return [95,96,99].includes(code) ? '⛈' : [61,63,65,80,81,82].includes(code) ? '🌧' : [71,73,75,77,85,86].includes(code) ? '🌨' : [0,1].includes(code) ? '☀' : '☁'; }
function modelLocalTime(value, includeDate=false) {
  const [date,time=''] = String(value).split('T');
  const [year,month,day] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(year,month-1,day,12)).toLocaleDateString('en',{weekday:'short',timeZone:'UTC'});
  return `${includeDate?`${weekday} ${month}/${day}`:weekday} ${time.slice(0,5)}`;
}
function shortArea(value = '') { return value.split(';')[0]?.trim() || 'Selected area'; }
function relativeTime(value) { if (!value) return 'ACTIVE'; const mins = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000)); return mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`; }
function severityClass(severity = '') { return /extreme|severe/i.test(severity) ? '' : /moderate/i.test(severity) ? 'warning' : 'watch'; }

function renderRadarPage() {
  const cameraItems=getAllCameras();
  const cameraButtons=state.showCameras?(cameraItems.length?cameraItems.map((camera,index)=>`<button class="camera-feed-button" data-camera-feed-index="${index}">▣ ${esc(camera.name)}</button>`).join(''):`<span class="tiny">No feeds found for this area yet. Open Road Cameras to search or add one.</span>`):'';
  const region=radarCoverageRegion();
  const isUs=region==='US',source=RADAR_REGIONS[region]||RADAR_REGIONS.GLOBAL;
  const siteStage=isUs?`<div class="radar-site-stage"><div class="radar-site-heading"><strong id="radar-site-name">Loading nearby radar stations…</strong><span id="radar-status" class="card-note">SINGLE-SITE NEXRAD</span></div><div id="radar-product-map" class="radar-product-map" aria-label="Map with individual radar site reflectivity tiles"></div><div id="radar-image-error" class="image-fallback" hidden></div><div class="map-attribution">Single-site Level-II radar tiles by <a href="https://atmostorm.com/api-docs/endpoints" target="_blank" rel="noreferrer">AtmoStorm</a>; map tiles © Esri</div></div>`:`<div class="regional-site-panel"><strong>${esc(source.source)}</strong><p>The map above provides a global composite where RainViewer has radar coverage. Individual-site NEXRAD tiles are available below for the United States; use the official national provider for ${esc(source.name)} coverage.</p><a class="btn btn-primary" href="${esc(source.url)}" target="_blank" rel="noreferrer">Open official ${esc(source.name)} radar ↗</a></div>`;
  const regionTitle=isUs?'NWS INDIVIDUAL RADAR SITES':`${source.name.toUpperCase()} RADAR`;
  const showLightning=state.lightning;
  const lightningMarkup=showLightning?`<section class="card lightning-image-card"><div class="card-head"><h2 class="card-title">LIGHTNING DETECTOR</h2><span class="card-note">LIGHTNINGMAPS / BLITZORTUNG</span></div><iframe class="glm-frame lightningmaps-frame" id="lightningmaps-frame" title="Community lightning detection map centred on the selected location" loading="lazy" src="https://map.blitzortung.org/index.php?interactive=0&NavigationControl=0&FullScreenControl=1&Cookies=0&InfoDiv=0&MenuButtonDiv=0&ScaleControl=1&LinksCheckboxChecked=1&LinksRangeValue=10&MapStyle=2&MapStyleRangeValue=4&Advertisment=0#6/${state.place.latitude.toFixed(3)}/${state.place.longitude.toFixed(3)}"></iframe><p class="source-note" style="padding:0 13px 12px">Community-detected lightning; coverage varies and this is not an official safety alert service. <a href="https://www.lightningmaps.org/" target="_blank" rel="noreferrer" style="color:var(--accent)">Open LightningMaps.org ↗</a></p></section>`:'';
  return `<section class="card global-radar-card"><div class="map-toolbar"><div class="map-tool-left"><span class="map-tool-title">GLOBAL RADAR MOSAIC</span><span class="live-pill"><span class="pulse-dot"></span>WORLDWIDE</span></div><div class="map-tools-right"><label class="control-label" for="global-radar-frame">FRAME</label><select class="select-control" id="global-radar-frame"><option value="latest">Latest available</option></select><button class="map-expand" data-action="refresh-global-radar">↻ Refresh</button></div></div><div class="global-radar-map-wrap"><div id="global-radar-map" aria-label="Worldwide composite radar map centred on the selected location"></div><div class="map-attribution">Weather data by <a href="https://www.rainviewer.com/" target="_blank" rel="noreferrer">RainViewer</a>; coverage depends on regional radar availability.</div></div><div class="global-radar-caption"><span id="global-radar-status">Loading global composite radar…</span><span>Composite reflectivity · not an official warning source</span></div></section><div class="card"><div class="map-toolbar"><div class="map-tool-left"><span class="map-tool-title" id="radar-source-title">${regionTitle}</span><span class="live-pill"><span class="pulse-dot"></span>LIVE SOURCES</span></div><div class="map-tools-right"><label class="control-label" for="radar-region-select">REGION</label><select class="select-control" id="radar-region-select"><option value="auto" ${state.radarRegion==='auto'?'selected':''}>Automatic · ${esc(regionName(region))}</option><option value="US" ${state.radarRegion==='US'?'selected':''}>United States</option><option value="GB" ${state.radarRegion==='GB'?'selected':''}>United Kingdom</option><option value="IE" ${state.radarRegion==='IE'?'selected':''}>Ireland</option><option value="CA" ${state.radarRegion==='CA'?'selected':''}>Canada</option></select><label class="control-label" for="radar-site-select">SITE</label><select class="select-control" id="radar-site-select"><option value="">Finding nearby sites…</option></select><button class="map-expand" data-action="refresh-radar">↻ Refresh</button><a class="map-expand" id="radar-official-link" href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.source)} ↗</a></div></div>
    <div class="radar-explorer"><div class="radar-explorer-heading"><div><strong>Choose a radar site</strong><span>Pan or zoom the map, or click anywhere to find the nearest available individual radar site.</span></div><span class="card-note" id="radar-region-label">${esc(regionName(region))} coverage</span></div><div class="radar-map-wrap"><div id="radar-site-map" class="radar-site-map" aria-label="Interactive map for choosing individual radar sites"></div><div class="radar-map-help">Click the map to move your search location</div></div><div id="radar-regional-feed" class="radar-regional-feed" hidden></div></div>
    ${siteStage}
    <div class="radar-controls"><div class="control-group"><span class="control-label">PRODUCT / ELEVATION</span>${radarLayerButton('reflectivity','Reflectivity')}${radarLayerButton('velocity','Base velocity')}${radarLayerButton('correlation','Correlation coefficient')}${radarLayerButton('tilt-1','Tilt 1 · 0.5°')}${radarLayerButton('tilt-2','Tilt 2 · 1.5°')}${radarLayerButton('tilt-3','Tilt 3 · 2.4°')}${radarLayerButton('tilt-4','Tilt 4 · 3.4°')}</div><div class="control-group"><label class="toggle-row"><span>Lightning layer / viewer</span><span class="switch"><input id="lightning-toggle" type="checkbox" ${state.lightning?'checked':''} ><span class="switch-track"></span></span></label><label class="toggle-row"><span>Nearby cameras</span><span class="switch"><input id="camera-toggle" type="checkbox" ${state.showCameras?'checked':''}><span class="switch-track"></span></span></label></div></div>
    <div class="timeline radar-auto-status"><span class="pulse-dot"></span><span>Single radar site · latest scans refresh automatically about every 2 minutes</span><span class="frame-count" id="frame-count">LIVE TILES</span></div></div>
    ${state.showCameras?`<section class="card radar-camera-strip"><div class="card-head"><h2 class="card-title">CAMERAS NEAR ${esc(state.place.name.toUpperCase())}</h2><a class="map-expand" href="#cameras" data-page="cameras">Manage feeds ↗</a></div><div class="radar-camera-buttons">${cameraButtons}</div></section>`:''}
    ${lightningMarkup}
    <div class="radar-lower-grid"><section class="card"><div class="card-head"><h2 class="card-title">${isUs?'SITE DETAILS':'REGIONAL RADAR'}</h2><span class="card-note">${isUs?'NWS RADAR':esc(regionName(region).toUpperCase())}</span></div><div class="card-body"><p class="source-note">${isUs?'This display uses a single radar site at a time, with radar-product and elevation controls. It deliberately does not fall back to a national mosaic.':`${source.source} provides an additional official regional radar viewer; the global RainViewer mosaic is shown above where coverage exists.`}</p><a class="btn btn-quiet" id="radar-products-link" href="${esc(isUs?'https://radar.weather.gov/':source.url)}" target="_blank" rel="noreferrer">${isUs?'Open this site in the official viewer':'Open official regional radar'} ↗</a></div></section><div class="lightning-panel"><strong>Radar coverage</strong><p>${isUs?'Choose an individual NEXRAD site using the site map. The worldwide composite is shown above as a separate layer.':`Individual-site NEXRAD tiles are not available for ${esc(regionName(region))}; use the global mosaic above and regional official radar link.`}</p><a class="btn btn-quiet" href="${esc(isUs?'https://www.weather.gov/radarfaq':source.url)}" target="_blank" rel="noreferrer">${isUs?'NWS radar information':`Open ${esc(source.name)} radar`} ↗</a></div></div>`;
}

function radarCoverageRegion(){
  if(state.radarRegion!=='auto')return state.radarRegion;
  const country=String(state.place.country||'').toUpperCase();
  if(country==='US')return 'US';if(country==='CA')return 'CA';if(country==='GB')return 'GB';if(country==='IE')return 'IE';
  const {latitude:lat,longitude:lon}=state.place;
  if(lat>=24&&lat<=50&&lon>=-126&&lon<=-66)return 'US';
  if(lat>=41&&lat<=84&&lon>=-142&&lon<=-50)return 'CA';
  if(lat>=49&&lat<=61&&lon>=-8.5&&lon<=2)return 'GB';
  if(lat>=51&&lat<=56&&lon>=-11&&lon<=-5)return 'IE';
  return 'GLOBAL';
}
function regionName(region){return RADAR_REGIONS[region]?.name||'Global';}

function chooseRadarRegion(region){
  const target=RADAR_REGIONS[region];if(!target)return;
  state.radarRegion=region;state.place={name:region==='US'?'United States':target.name,region:target.name,latitude:target.center[0],longitude:target.center[1],country:region==='US'?'US':region==='CA'?'CA':region==='GB'?'GB':region==='IE'?'IE':'',timezone:'UTC'};
  state.radarStationId='';state.radarScanIndex=null;state.modelData=null;
  storage.set('place',state.place);storage.set('radar-station','');$('#location-input').value=target.name;
  renderPage();refreshData();toast(`Radar view moved to ${target.name}.`);
}

function selectRadarMapPoint(latitude,longitude){
  const regionGuess=(()=>{if(latitude>=24&&latitude<=50&&longitude>=-126&&longitude<=-66)return'US';if(latitude>=41&&latitude<=84&&longitude>=-142&&longitude<=-50)return'CA';if(latitude>=49&&latitude<=61&&longitude>=-8.5&&longitude<=2)return'GB';if(latitude>=51&&latitude<=56&&longitude>=-11&&longitude<=-5)return'IE';return'GLOBAL';})();
  state.radarRegion='auto';state.place={name:'Map point',region:`${latitude.toFixed(2)}°, ${longitude.toFixed(2)}° · ${regionName(regionGuess)}`,latitude,longitude,country:regionGuess,timezone:'UTC'};
  state.radarStationId='';state.radarScanIndex=null;state.modelData=null;state.cameraQueryKey='';
  storage.set('place',state.place);storage.set('radar-station','');$('#location-input').value=`${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
  renderPage();refreshData();toast(`Search point set to ${latitude.toFixed(2)}, ${longitude.toFixed(2)}.`);
}

function initRadarSiteMap(){
  const node=$('#radar-site-map');if(!node)return;
  if(!window.L){node.innerHTML='<div class="no-map">The map library could not load.</div>';return;}
  const region=radarCoverageRegion(),preset=RADAR_REGIONS[region]||RADAR_REGIONS.GLOBAL;
  const map=L.map(node,{zoomControl:true,preferCanvas:true}).setView([state.place.latitude,state.place.longitude],region==='US'?5:preset.zoom);
  state.radarMap=map;
  L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri and OpenStreetMap contributors'}).addTo(map);
  map.on('click',event=>selectRadarMapPoint(event.latlng.lat,event.latlng.lng));
  setTimeout(()=>{if(state.radarMap===map&&map.getContainer().isConnected)map.invalidateSize();},150);
}

function initRadarProductMap(){
  const node=$('#radar-product-map');if(!node)return;
  if(!window.L){node.innerHTML='<div class="no-map">The radar map library could not load.</div>';return;}
  const map=L.map(node,{zoomControl:true,preferCanvas:true}).setView([state.place.latitude,state.place.longitude],7);
  state.radarProductMap=map;
  L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Map tiles © Esri and OpenStreetMap contributors'}).addTo(map);
  map.createPane('singleSiteRadar');map.getPane('singleSiteRadar').style.zIndex=350;
  map.createPane('lightningOverlay');map.getPane('lightningOverlay').style.zIndex=375;
  setTimeout(()=>{if(state.radarProductMap===map&&map.getContainer().isConnected)map.invalidateSize();},150);
}

function normalizeRadarSiteId(rawId,lat,lon){
  const raw=String(rawId||'').trim().toUpperCase();
  if(/^[A-Z0-9]{4}$/.test(raw))return raw;
  if(!/^[A-Z0-9]{3}$/.test(raw))return raw;
  if(lat>=24&&lat<=50&&lon>=-126&&lon<=-66)return `K${raw}`;
  if(lat>=50&&lon<=-125)return `P${raw}`;
  if(lat>=18&&lat<=25&&lon<=-150)return `P${raw}`;
  if(lat>=16&&lat<=22&&lon>=-70&&lon<=-60)return `T${raw}`;
  return raw;
}

async function fetchRadarStationList(){
  let data;
  try{data=await fetchJson('/api/nexrad-sites');}
  catch{data=await fetchJson(API.radarStations);}
  const rows=Array.isArray(data)?data:(data.sites||data.stations||data.data?.sites||data.data||data.features||[]);
  return rows.map(item=>{
    const props=item?.properties||item||{};
    const coordinates=item?.geometry?.coordinates;
    const lat=Number(props.lat??props.latitude??coordinates?.[1]);
    const lon=Number(props.lon??props.lng??props.longitude??coordinates?.[0]);
    const rawId=String(props.id||props.site||props.station||props.stationId||item?.id||'').trim().toUpperCase().split('/').pop();
    const id=normalizeRadarSiteId(rawId,lat,lon);
    return {id,rawId,name:props.name||props.stationName||props.siteName||id||'NWS radar site',state:props.state||'',lat,lon,operability:props.operability||'UNKNOWN'};
  }).filter(site=>/^[A-Z0-9]{4}$/.test(site.id)&&Number.isFinite(site.lat)&&Number.isFinite(site.lon)&&site.lat>=-90&&site.lat<=90&&site.lon>=-180&&site.lon<=180);
}
function updateRadarSiteMap(){
  const map=state.radarMap;if(!map)return;
  state.radarSiteMarkers.forEach(marker=>marker.remove());state.radarSiteMarkers=[];
  if(state.radarPlaceMarker)state.radarPlaceMarker.remove();
  if(state.radarCoverageCircle)state.radarCoverageCircle.remove();
  const accent=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#d1f477';
  state.radarStations.forEach(site=>{
    const selected=site.id===state.radarStationId;
    const marker=L.circleMarker([site.lat,site.lon],{radius:selected?6:4,color:selected?accent:'#e5eef2',weight:selected?2:1,fillColor:selected?accent:'#7a91a1',fillOpacity:selected?.95:.65,bubblingMouseEvents:false}).addTo(map);
    marker.bindTooltip(`${site.id} · ${site.name}`,{direction:'top'});
    marker.on('click',()=>{state.radarStationId=site.id;state.radarScanIndex=null;const select=$('#radar-site-select');if(select)select.value=site.id;storage.set('radar-station',site.id);loadRadarStationImage(true);updateRadarSiteMap();});
    state.radarSiteMarkers.push(marker);
  });
  state.radarPlaceMarker=L.circleMarker([state.place.latitude,state.place.longitude],{radius:7,color:'#fff',weight:2,fillColor:accent,fillOpacity:.95}).addTo(map).bindPopup(`Search point · ${esc(state.place.name)}`);
  const site=currentRadarStation();
  if(site&&radarCoverageRegion()==='US')state.radarCoverageCircle=L.circle([site.lat,site.lon],{radius:230000,color:accent,weight:1,opacity:.28,fillOpacity:.035,interactive:false}).addTo(map);
}

function renderAlertsPage() {
  const filter = state.alertFilter;
  const list = filteredAlerts();
  return `<div class="alert-filter-bar">${['all','warning','watch','advisory'].map(item => `<button class="filter-chip ${filter === item ? 'selected' : ''}" data-alert-filter="${item}">${item === 'all' ? 'All alerts' : item[0].toUpperCase() + item.slice(1) + 's'}</button>`).join('')}<span class="filter-divider"></span>${[['auto','My area'],['na','North America'],['eu','Europe'],['asia','Asia'],['oceania','Oceania'],['global','Global hazards']].map(([value,label]) => `<button class="filter-chip ${state.warningRegion===value?'selected':''}" data-warning-region="${value}">${label}</button>`).join('')}</div>
    <div class="alert-source-status" id="alert-source-status">${alertSourceStatusMarkup()}</div>
    <div class="alerts-layout"><section class="card"><div class="card-head"><h2 class="card-title" id="alert-list-heading">${list.length} ACTIVE ALERT${list.length===1?'':'S'} · ${alertRegionLabel().toUpperCase()}</h2><button class="map-expand" data-action="refresh-alerts">↻ Refresh feeds</button></div><div id="alerts-list">${alertsListMarkup(list)}</div></section><aside style="display:grid;gap:12px"><section class="card"><div class="card-head"><h2 class="card-title">OFFICIAL FEEDS</h2></div><div class="card-body"><div class="source-list"><a class="source-item" href="https://api.weather.gov/alerts/active" target="_blank" rel="noreferrer">🇺🇸 National Weather Service<span>U.S. ↗</span></a><a class="source-item" href="https://weather.gc.ca/en/alert" target="_blank" rel="noreferrer">🇨🇦 Environment and Climate Change Canada<span>CANADA ↗</span></a><a class="source-item" href="https://www.spc.noaa.gov/products/outlook/" target="_blank" rel="noreferrer">⌁ Storm Prediction Center<span>U.S. OUTLOOK ↗</span></a><a class="source-item" href="https://www.wmo.int/activities/severe-weather-information-centre" target="_blank" rel="noreferrer">🌐 WMO Severe Weather Information Centre<span>GLOBAL ↗</span></a><a class="source-item" href="https://www.meteoalarm.org/" target="_blank" rel="noreferrer">🇪🇺 MeteoAlarm<span>EUROPE ↗</span></a><a class="source-item" href="https://www.bom.gov.au/warnings/" target="_blank" rel="noreferrer">🇦🇺 Australian Bureau of Meteorology<span>OCEANIA ↗</span></a><a class="source-item" href="https://www.jma.go.jp/bosai/map.html#contents=warning" target="_blank" rel="noreferrer">🇯🇵 Japan Meteorological Agency<span>ASIA ↗</span></a><a class="source-item" href="https://mausam.imd.gov.in/" target="_blank" rel="noreferrer">🇮🇳 India Meteorological Department<span>ASIA ↗</span></a><a class="source-item" href="https://www.cma.gov.cn/en/" target="_blank" rel="noreferrer">🇨🇳 China Meteorological Administration<span>ASIA ↗</span></a><a class="source-item" href="https://www.conagua.gob.mx/" target="_blank" rel="noreferrer">🇲🇽 CONAGUA / Mexico weather authority<span>MEXICO ↗</span></a><a class="source-item" href="https://www.metservice.com/warnings/home" target="_blank" rel="noreferrer">🇳🇿 MetService New Zealand<span>OCEANIA ↗</span></a><a class="source-item" href="https://www.gdacs.org/" target="_blank" rel="noreferrer">🌍 GDACS disaster alerts<span>GLOBAL ↗</span></a></div><div class="divider" style="margin:13px 0"></div><p class="source-note">North America is integrated through NWS/ECCC; European country feeds use MeteoAlarm where available; Australian warnings use BOM feeds. Asia and other countries are linked to their official portals where a stable unified public alert feed is not available. Global hazards come from GDACS. Always verify with the issuing agency.</p><button class="btn btn-primary" style="width:100%" data-action="notifications">♧ Notification preferences</button></div></section><section class="card"><div class="card-head"><h2 class="card-title">NHC ACTIVE SYSTEMS</h2><span class="card-note">LIVE JSON</span></div><div id="nhc-storm-list">${nhcMarkup()}</div></section><section class="card"><div class="card-head"><h2 class="card-title">WPC OUTLOOKS</h2><span class="card-note">OFFICIAL</span></div><div class="card-body" style="padding:10px">${wpcProductsMarkup()}</div></section></aside></div>`;
}

function filteredAlerts() {
  const region=getResolvedWarningRegion();
  const regional=region==='na'?state.alerts.filter(alert=>state.alertRegion==='all'||(alert.properties?.country||'US')===state.alertRegion):state.alerts;
  if(state.alertFilter==='all')return regional;
  return regional.filter(alert=>{
    const event=alert.properties?.event||'';
    if(state.alertFilter==='warning')return /warning|alert|red|extreme/i.test(event);
    if(state.alertFilter==='watch')return /watch/i.test(event);
    return /advisory|statement|information/i.test(event);
  });
}

function alertsListMarkup(alerts) {
  if (!alerts.length) {
    const failed = Object.values(state.alertFeedStatus||{}).some(source=>source?.status==='unavailable')&&!state.alerts.length;
    const region=getResolvedWarningRegion();const reason=region==='asia'?'This dashboard uses GDACS for major regional hazards in Asia; official local weather warnings vary by national service.':region==='oceania'&&String(state.place.country||'').toUpperCase()!=='AU'?'Automated live alerts are not integrated for this selected Oceania country yet. Open the official national service below.':region==='eu'?'No current warnings were returned by the selected MeteoAlarm country feed.':'No matching active alerts in this filter.';
    return `<div class="empty-state">${failed ? 'Could not connect to the selected warning source.' : 'No matching alerts in this feed.'}<br><span class="tiny">${esc(reason)} Check the official links before making safety decisions.</span></div>`;
  }
  return alerts.map(alert => {
    const p = alert.properties || {};
    const countryLabel=p.source==='ECCC'?'🇨🇦 ECCC':p.source==='MeteoAlarm'?'🇪🇺 MeteoAlarm':p.source==='Bureau of Meteorology'?'🇦🇺 BOM':p.source==='GDACS'?'🌐 GDACS':p.source==='NWS'?'🇺🇸 NWS':esc(p.source||'Official feed');
    const until=p.expires||p.ends;
    const sourceUrl=p.web||'https://www.weather.gov/';
    const summary=(p.headline||p.description||`Official ${p.source||'weather'} alert.`).replace(/\s+/g,' ').slice(0,260);
    return `<article class="alert-card-row"><span class="alert-card-accent ${severityClass(p.severity)}"></span><div class="alert-card-main"><div class="alert-title-line"><strong class="alert-card-title">${esc(p.event || 'Weather alert')}</strong><span class="alert-origin">${countryLabel}</span></div><div class="alert-card-meta"><span>${esc(shortArea(p.areaDesc))}</span><span>ISSUED ${esc(p.sent ? new Date(p.sent).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : '—')}</span><span>UNTIL ${esc(until ? new Date(until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—')}</span></div><div class="alert-card-description">${esc(summary)}${(p.description || '').length > 260 ? '…' : ''}</div><span class="card-note">${esc(p.severity || 'Unknown')} · ${esc(p.certainty || 'Unknown certainty')}</span></div><div class="alert-card-actions"><a class="btn btn-quiet" href="${esc(sourceUrl)}" target="_blank" rel="noreferrer">Official details ↗</a></div></article>`;
  }).join('');
}

function alertRegionLabel(){if(state.warningRegion==='auto'&&!state.place.country)return 'Global hazards';return ({auto:`${state.place.name} · local sources`,na:'North America · NWS/ECCC',eu:'Europe · MeteoAlarm',asia:'Asia · global major hazards',oceania:'Oceania · selected feeds',global:'Global hazards'}[state.warningRegion]||'Local warning sources');}
function alertSourceStatusMarkup(){
  if(!state.alertFeedStatus)return `<span class="pulse-dot"></span>Connecting to ${esc(alertRegionLabel())} warning feeds…`;
  const sources=state.alertFeedStatus;
  const sourceHtml=Object.entries(sources).filter(([key,value])=>key!=='updatedAt'&&key!=='error'&&value&&typeof value==='object').map(([key,source])=>{
    const label=source.name||({us:'NWS',canada:'ECCC',europe:'MeteoAlarm',oceania:'BOM',gdacs:'GDACS',national:'National feed'}[key]||key);
    const detail=source.status==='live'?`${source.count??0} active`:source.status==='loading'?'checking…':source.status==='not-covered'?'country-specific feed not integrated':'unavailable';
    return `<span class="${['unavailable','not-covered'].includes(source.status)?'feed-source-error':''}">${esc(label)} · ${esc(detail)}</span>`;
  }).join('');
  const stamp=sources.updatedAt?new Date(sources.updatedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'';
  const note=Object.values(sources).find(item=>item?.note)?.note;
  return `${sourceHtml||`<span>${esc(alertRegionLabel())} · checking</span>`}${note?`<span>${esc(note)}</span>`:''}<span class="alert-feed-updated">${stamp?`CHECKED ${stamp} LOCAL`:''}</span>`;
}

function nhcMarkup() {
  if (!state.nhcStorms.length) return `<div class="empty-state" style="padding:12px 4px">No active tropical systems listed by the NHC.<br><span class="tiny">Seasonal activity varies.</span></div>`;
  return state.nhcStorms.slice(0,5).map(storm=>{
    const name=storm.name||storm.stormName||storm.id||'Tropical system';
    const kind=storm.classification||storm.type||'Active system';
    const wind=storm.intensity||storm.maxWind||storm.windSpeed;
    return `<div class="mini-alert"><span class="severity-mark warning"></span><span class="mini-alert-text"><strong>${esc(name)}</strong><small>${esc(kind)}${wind?` · ${esc(wind)} kt`:''}</small></span><span class="mini-alert-time">NHC</span></div>`;
  }).join('');
}

function wpcProductsMarkup() {
  return `<div class="source-list"><a class="source-item" href="https://www.wpc.ncep.noaa.gov/threats/threats.php" target="_blank" rel="noreferrer">WPC Day 3–7 hazards outlook<span>OPEN ↗</span></a><a class="source-item" href="https://www.wpc.ncep.noaa.gov/qpf/excess_rain.shtml" target="_blank" rel="noreferrer">WPC excessive rainfall outlook<span>OPEN ↗</span></a><a class="source-item" href="https://www.wpc.ncep.noaa.gov/wwd/winter_wx.shtml" target="_blank" rel="noreferrer">WPC winter weather products<span>OPEN ↗</span></a></div>`;
}

function renderOutlooksPage() {
  const day = state.outlookDay;
  const hazards=[['categorical','Thunderstorm risk'],['tornado','Tornado'],['wind','Wind'],['hail','Hail']];
  const label=hazards.find(item=>item[0]===state.outlookHazard)?.[1]||'Thunderstorm risk';
  const canadaLayers=[['GDPS_15km_AirTemp_2m','Surface temperature forecast'],['Current-Alerts','Current weather alerts'],['Lightning_2.5km_Density','Lightning density']];
  return `<div class="status-strip"><div class="status-left"><span class="pulse-dot"></span><span><strong>Official outlooks and forecast maps</strong> · NOAA SPC for U.S. severe risk and ECCC GeoMet for Canadian conditions</span></div><a class="status-right" href="https://www.canada.ca/en/environment-climate-change/services/weather-general-tools-resources/weather-tools-specialized-data/msc-geomet-api-geospatial-web-services.html" target="_blank" rel="noreferrer">CANADA.CA DATA ↗</a></div><section class="card spc-map-card"><div class="spc-hazard-tabs" role="tablist" aria-label="SPC outlook hazard">${hazards.map(([id,name])=>`<button class="layer-button ${state.outlookHazard===id?'selected':''}" role="tab" aria-selected="${state.outlookHazard===id}" data-spc-hazard="${id}">${name}</button>`).join('')}</div><div class="spc-map-heading"><div><span class="eyebrow">DAY ${day} · SPC</span><h2 id="spc-map-title">${esc(label)} outlook</h2></div><span class="card-note" id="spc-map-updated">Loading official map data…</span></div><div class="spc-map-wrap"><div id="spc-map" class="spc-map" aria-label="SPC severe weather outlook map"></div><div class="model-map-status" id="spc-map-status">Loading current SPC outlook areas…</div></div><div class="spc-legend" id="spc-legend">${spcLegendMarkup()}</div><div class="outlook-source"><span>Official NOAA/NWS vector outlook product · auto-refreshed</span><a href="https://www.spc.noaa.gov/products/outlook/day${day}otlk.html" target="_blank" rel="noreferrer">SPC discussion & product ↗</a></div></section>
  <section class="card canada-outlook-card"><div class="card-head"><div><h2 class="card-title">CANADA WEATHER OUTLOOKS</h2><p class="source-note">Environment and Climate Change Canada · MSC GeoMet live forecast and observation layers</p></div><span class="card-note">ECCC · LIVE</span></div><div class="canada-outlook-toolbar"><label class="form-label" for="canada-outlook-layer">CANADIAN MAP LAYER<select id="canada-outlook-layer" class="select-control">${canadaLayers.map(([id,name])=>`<option value="${id}" ${state.canadaOutlookLayer===id?'selected':''}>${name}</option>`).join('')}</select></label><span class="card-note" id="canada-outlook-updated">Waiting for GeoMet…</span></div><div class="canada-outlook-map-wrap"><div id="canada-outlook-map" class="canada-outlook-map" aria-label="Canadian forecast, alert, or lightning map"></div><div class="model-map-status" id="canada-outlook-status">Loading Canada’s official forecast layer…</div></div><div class="outlook-source"><span id="canada-outlook-layer-note">Latest available model guidance or live observation layer</span><a href="https://weather.gc.ca/forecast/canada/index_e.html" target="_blank" rel="noreferrer">Canadian forecasts ↗</a></div><div class="outlook-source"><span>Map data supplied by the Meteorological Service of Canada</span><a href="https://www.canada.ca/en/environment-climate-change/services/weather-general-tools-resources/weather-tools-specialized-data/msc-geomet-api-geospatial-web-services.html" target="_blank" rel="noreferrer">GeoMet documentation ↗</a></div></section>
  <div class="card" style="margin-top:14px"><div class="card-head"><h2 class="card-title">OFFICIAL OUTLOOK DESK</h2><span class="card-note">U.S. + CANADA</span></div><div class="spc-list"><div class="spc-product"><span>Day ${day} U.S. Convective Outlook & discussion</span><a href="https://www.spc.noaa.gov/products/outlook/day${day}otlk.html" target="_blank" rel="noreferrer">Open ↗</a><span class="outlook-time">SPC</span></div><div class="spc-product"><span>Canadian public forecast by location</span><a href="https://weather.gc.ca/forecast/canada/index_e.html" target="_blank" rel="noreferrer">Open ↗</a><span class="outlook-time">ECCC</span></div><div class="spc-product"><span>Canadian severe weather alerts</span><a href="https://weather.gc.ca/en/alert" target="_blank" rel="noreferrer">Open ↗</a><span class="outlook-time">ECCC</span></div><div class="spc-product"><span>Mesoscale Discussions</span><a href="https://www.spc.noaa.gov/products/md/" target="_blank" rel="noreferrer">Open ↗</a><span class="outlook-time">SPC</span></div><div class="spc-product"><span>U.S. Watches & warnings</span><a href="https://www.spc.noaa.gov/products/watch/" target="_blank" rel="noreferrer">Open ↗</a><span class="outlook-time">SPC</span></div></div></div>`;
}

function spcLegendMarkup(){
  if(state.outlookHazard==='categorical')return `<span><i style="--legend-color:#aee0aa"></i>Thunderstorm risk</span><span><i style="--legend-color:#72b66f"></i>Marginal</span><span><i style="--legend-color:#ffe16b"></i>Slight</span><span><i style="--legend-color:#ff9b45"></i>Enhanced</span><span><i style="--legend-color:#e85858"></i>Moderate+</span>`;
  return `<span><i style="--legend-color:#72b66f"></i>2–5%</span><span><i style="--legend-color:#ffe16b"></i>10–15%</span><span><i style="--legend-color:#ff9b45"></i>30%</span><span><i style="--legend-color:#e85858"></i>45%+</span><span class="tiny">Probability within 25 miles of a point</span>`;
}

function initOutlookMap(){
  const node=$('#spc-map');if(!node)return;
  if(!window.L){node.innerHTML='<div class="no-map">The interactive map library could not load.</div>';return;}
  const map=L.map(node,{zoomControl:true,preferCanvas:true}).setView([38.5,-96.8],4);
  state.outlookMap=map;
  L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:12,attribution:'Tiles © Esri and OpenStreetMap contributors'}).addTo(map);
  setTimeout(()=>{if(state.outlookMap===map&&map.getContainer().isConnected)map.invalidateSize();},120);
}

function spcFeatureColor(feature){
  const dn=Number(feature?.properties?.dn||0);
  const colors=state.outlookHazard==='categorical'?{2:'#aee0aa',3:'#72b66f',4:'#ffe16b',5:'#ff9b45',6:'#e85858',8:'#be53c7'}:{2:'#72b66f',5:'#a6c94e',10:'#ffe16b',15:'#ffbd4c',30:'#ff8a42',45:'#e85858',60:'#be53c7'};
  return colors[dn]||'#cf8fc8';
}

async function loadOutlookMap(){
  if(!state.outlookMap)initOutlookMap();
  const map=state.outlookMap;if(!map)return;
  if(state.outlookMapLayer){map.removeLayer(state.outlookMapLayer);state.outlookMapLayer=null;}
  const title={categorical:'Thunderstorm risk',tornado:'Tornado',wind:'Wind',hail:'Hail'}[state.outlookHazard]||'Thunderstorm risk';
  setText('#spc-map-title',`${title} outlook`);setText('#spc-map-status',`Loading Day ${state.outlookDay} ${title.toLowerCase()} polygons…`);setText('#spc-map-updated','NOAA / NWS MAP SERVICE');
  const generation=`${state.outlookDay}:${state.outlookHazard}`;state.outlookMapGeneration=generation;
  try{
    const data=await fetchJson(`/api/spc-map?day=${state.outlookDay}&hazard=${state.outlookHazard}`);
    if(state.page!=='outlooks'||state.outlookMapGeneration!==generation)return;
    const features=data.features||[];
    if(!features.length){setText('#spc-map-status',`No ${title.toLowerCase()} outlook areas are currently posted for Day ${state.outlookDay}.`);return;}
    state.outlookMapLayer=L.geoJSON(data,{style:feature=>({color:spcFeatureColor(feature),weight:1.3,opacity:.95,fillColor:spcFeatureColor(feature),fillOpacity:.37}),onEachFeature:(feature,layer)=>{
      const props=feature.properties||{};const value=state.outlookHazard==='categorical'?props.label||props.label2||'Thunderstorm risk':`${props.dn||'—'}% probability`;
      layer.bindPopup(`<strong>${esc(value)}</strong><br>${esc(props.valid||`Day ${state.outlookDay}`)}${props.expire?`<br>Expires ${esc(props.expire)}`:''}`);
    }}).addTo(map);
    if(state.outlookDay===1)map.fitBounds([[24,-125],[50,-66]],{padding:[8,8]});
    setText('#spc-map-status',`${features.length} official ${title.toLowerCase()} outlook area${features.length===1?'':'s'} · tap an area for details`);
    setText('#spc-map-updated',`LIVE · ${fmtClock()} UTC`);
  }catch{if(state.outlookMapGeneration===generation)setText('#spc-map-status','Official SPC map data is temporarily unavailable. Open the current SPC product for the published outlook.');}
}


function initCanadaOutlookMap(){
  const node=$('#canada-outlook-map');if(!node)return;
  if(!window.L){node.innerHTML='<div class="no-map">The map library could not load.</div>';return;}
  const map=L.map(node,{zoomControl:true,preferCanvas:true}).setView([57,-105],3);
  state.canadaOutlookMap=map;
  L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:12,attribution:'Base map © Esri and OpenStreetMap contributors'}).addTo(map);
  setTimeout(()=>{if(state.canadaOutlookMap===map&&map.getContainer().isConnected)map.invalidateSize();},140);
  loadCanadaOutlookMap();
}

function loadCanadaOutlookMap(refresh=false){
  const map=state.canadaOutlookMap;if(!map)return;
  if(state.canadaOutlookWmsLayer){map.removeLayer(state.canadaOutlookWmsLayer);state.canadaOutlookWmsLayer=null;}
  const layerName=state.canadaOutlookLayer||'GDPS_15km_AirTemp_2m';
  const layerNames={
    'GDPS_15km_AirTemp_2m':'GDPS 15 km surface-temperature forecast',
    'Current-Alerts':'Current Environment and Climate Change Canada weather alerts',
    'Lightning_2.5km_Density':'Observed Canadian lightning density'
  };
  const cache=refresh?Date.now():Math.floor(Date.now()/300000);
  const layer=L.tileLayer.wms(`https://geo.weather.gc.ca/geomet/?cache=${cache}`,{
    layers:layerName,styles:'',version:'1.3.0',format:'image/png',transparent:true,opacity:layerName==='Current-Alerts'?.88:.7,
    attribution:'Data © Environment and Climate Change Canada / Meteorological Service of Canada'
  }).addTo(map);
  let failures=0;
  layer.on('tileerror',()=>{
    failures++;
    if(failures>=3)setText('#canada-outlook-status','ECCC GeoMet did not return this layer. Choose another layer or open the official Canadian forecast site.');
  });
  layer.on('load',()=>setText('#canada-outlook-status',`${layerNames[layerName]||layerName} · tiles loaded`));
  state.canadaOutlookWmsLayer=layer;
  setText('#canada-outlook-updated',`REQUESTED ${fmtClock()} UTC`);
  setText('#canada-outlook-layer-note',layerNames[layerName]||'Environment and Climate Change Canada GeoMet layer');
  setText('#canada-outlook-status',`Loading ${layerNames[layerName]||layerName}…`);
}

function renderModelsPage() {
  const data = state.modelData;
  return `<div class="model-layout"><section class="card"><div class="model-controls"><span class="control-label">MODEL</span><select id="model-select" class="select-control">${['GFS','HRRR','ECMWF','NAM','NBM'].map(model => `<option ${state.model === model ? 'selected' : ''}>${model}</option>`).join('')}</select><label class="control-label" for="model-variable" style="margin-left:auto">MAP</label><select id="model-variable" class="select-control"><option value="temperature_2m" ${state.modelVariable==='temperature_2m'?'selected':''}>Temperature</option><option value="precipitation" ${state.modelVariable==='precipitation'?'selected':''}>Precipitation</option><option value="wind_speed_10m" ${state.modelVariable==='wind_speed_10m'?'selected':''}>Wind speed</option></select><label class="control-label" for="model-horizon">RANGE</label><select id="model-horizon" class="select-control"><option value="48" ${state.modelHorizon===48?'selected':''}>48 hours</option><option value="72" ${state.modelHorizon===72?'selected':''}>72 hours</option><option value="168" ${state.modelHorizon===168?'selected':''}>7 days</option></select></div><div class="model-map-wrap"><div id="model-map" class="model-map"></div><div class="model-map-status" id="model-map-status">Loading spatial forecast guidance…</div></div><p class="model-map-hint">Smooth shading is interpolated from the forecast grid. Hover a sample point for its value, or click anywhere to inspect a forecast at that exact location.</p><div class="model-legend" id="model-legend"><span id="model-variable-label">Temperature field</span><div class="model-legend-gradient"></div><small id="model-legend-label">—</small></div><div class="timeline model-timeline"><button class="play-btn" data-action="toggle-model-play" aria-label="Play forecast">▶</button><span class="timeline-time">NOW</span><input class="timeline-range" type="range" min="0" max="71" value="0" id="model-timeline" aria-label="Forecast playback time"><span class="timeline-time" id="model-time-label">—</span><span class="frame-count" id="model-frame-count">—</span></div></section><aside class="card"><div class="card-head"><h2 class="card-title">MODEL DETAILS</h2><span class="card-note">OPEN-METEO</span></div><div class="model-info"><div class="model-row"><span>Selected model</span><strong id="model-name">${esc(state.model)}</strong></div><div class="model-row"><span>Location</span><strong>${esc(state.place.name)}</strong></div><div class="model-row"><span>Coordinates</span><strong>${state.place.latitude.toFixed(2)}, ${state.place.longitude.toFixed(2)}</strong></div><div class="model-row"><span>Provider</span><strong>Open-Meteo</strong></div><div class="model-row"><span>Data refresh</span><strong id="model-data-time">—</strong></div><div class="model-inspector"><div class="eyebrow">SELECTED POINT · <span id="model-point-label">${esc(state.place.name)}</span></div><div class="model-inspector-grid" id="model-point-inspector"><div class="empty-state">Forecast values will load with the map.</div></div></div><div class="model-warning" id="model-warning">${state.model === 'HRRR' ? 'HRRR has high-resolution guidance for the contiguous United States. Outside its domain, data may be unavailable.' : 'Model guidance is not a warning. Check official alerts and local forecaster guidance for decisions.'}</div><a class="btn btn-quiet" style="width:100%;margin-top:12px" href="https://open-meteo.com/en/docs/gfs-api" target="_blank" rel="noreferrer">Model/API notes ↗</a></div></aside></div><section class="card" style="margin-top:14px"><div class="card-head"><h2 class="card-title">HOURLY GUIDANCE AT ${esc(state.place.name.toUpperCase())}</h2><span class="card-note">LOCAL TIME</span></div><div id="hourly-table-wrap">${data ? hourlyTableMarkup(data) : `<div class="empty-state">Forecast table will appear when the model data loads.</div>`}</div></section>`;
}

function modelChartMarkup(data) {
  const hours = data.hourly?.time || [];
  const temps = data.hourly?.temperature_2m || [];
  const rain = data.hourly?.precipitation || [];
  if (temps.length < 2) return `<div class="empty-state">No hourly forecast is available for this model and location.</div>`;
  const n = Math.min(Number($('#model-horizon')?.value || 48), temps.length);
  const values = temps.slice(0,n);
  const min = Math.min(...values)-2, max = Math.max(...values)+2;
  const w=760,h=220,left=42,right=10,top=16,bottom=26,cw=w-left-right,ch=h-top-bottom;
  const points = values.map((v,i) => `${left + (i/(values.length-1))*cw},${top + (max-v)/(max-min)*ch}`).join(' ');
  const area = `${left},${h-bottom} ${points} ${left+cw},${h-bottom}`;
  const maxRain = Math.max(1, ...rain.slice(0,n).map(Number));
  const rainBars = rain.slice(0,n).map((value,i) => {
    const barHeight = (Number(value)||0) / maxRain * 26;
    if (barHeight < 1) return '';
    const x = left + (i/(values.length-1))*cw;
    return `<line x1="${x}" x2="${x}" y1="${h-bottom}" y2="${h-bottom-barHeight}" stroke="#78bfea" stroke-width="4" opacity=".8"/>`;
  }).join('');
  const labels = [0, Math.floor((n-1)/3), Math.floor(2*(n-1)/3), n-1].map(i=>`<text x="${left+(i/(values.length-1))*cw}" y="${h-6}" text-anchor="middle" class="chart-axis">${esc(modelLocalTime(hours[i]))}</text>`).join('');
  const yLabels = [0,.5,1].map(frac=>{const val=max-frac*(max-min);return `<text x="5" y="${top+frac*ch+3}" class="chart-axis">${Math.round(val)}°</text>`;}).join('');
  const grid = [0,.5,1].map(frac=>`<line x1="${left}" x2="${w-right}" y1="${top+frac*ch}" y2="${top+frac*ch}"/>`).join('');
  const dots=values.map((v,i)=>i%Math.max(1,Math.floor(n/7))===0?`<circle class="chart-point" cx="${left+(i/(values.length-1))*cw}" cy="${top+(max-v)/(max-min)*ch}" r="3"/>`:``).join('');
  return `<div class="model-chart"><svg class="chart-svg" viewBox="0 ${0} ${w} ${h}" role="img" aria-label="${esc(state.model)} hourly temperature and precipitation chart"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".2"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs><g class="chart-grid">${grid}</g>${yLabels}${rainBars}<polygon class="chart-area" points="${area}"/><polyline class="chart-temp" points="${points}"/>${dots}${labels}</svg><div class="chart-legend"><span><i></i>Temperature</span><span><i class="rain-key"></i>Precipitation</span></div></div><div class="metric-grid"><div class="metric-card"><span>NOW</span><strong>${Math.round(data.current?.temperature_2m ?? temps[0])}°</strong><small>${weatherCode(data.current?.weather_code)}</small></div><div class="metric-card"><span>24H HIGH</span><strong>${Math.round(Math.max(...temps.slice(0,24)))}°</strong><small>model guidance</small></div><div class="metric-card"><span>24H LOW</span><strong>${Math.round(Math.min(...temps.slice(0,24)))}°</strong><small>model guidance</small></div><div class="metric-card"><span>RAIN TOTAL</span><strong>${rain.slice(0,24).reduce((sum,v)=>sum+(Number(v)||0),0).toFixed(1)}<small style="display:inline"> mm</small></strong><small>next 24 hours</small></div></div>`;
}

function hourlyTableMarkup(data) {
  const times=data.hourly?.time||[]; const temps=data.hourly?.temperature_2m||[];
  const indexes=[0,1,2,3,4,5,6,7,8,9,10,11,12,15,18,21,24,30].filter(i=>i<times.length);
  return `<div class="hourly-scroll"><table class="hourly-table"><thead><tr><th>TIME</th><th>TEMPERATURE</th><th>HUMIDITY</th><th>PRECIPITATION</th><th>WIND</th></tr></thead><tbody>${indexes.map(i=>`<tr><td>${esc(modelLocalTime(times[i],true))}</td><td>${Math.round(temps[i]||0)}°</td><td>${Math.round(data.hourly.relative_humidity_2m?.[i]||0)}%</td><td>${Number(data.hourly.precipitation?.[i]||0).toFixed(1)} mm</td><td>${Math.round(data.hourly.wind_speed_10m?.[i]||0)} km/h</td></tr>`).join('')}</tbody></table></div>`;
}

function renderSatellitePage() {
  const satellite = state.satellite;
  const name = satellite === 'west' ? 'GOES West · GOES-18 Full Disk' : 'GOES East · GOES-19 Full Disk';
  return `<div class="satellite-layout"><section class="card"><div class="sat-controls"><span class="control-label">SATELLITE</span><select id="satellite-select" class="select-control"><option value="east" ${satellite==='east'?'selected':''}>GOES East · GOES-19 Full Disk</option><option value="west" ${satellite==='west'?'selected':''}>GOES West · GOES-18 Full Disk</option></select><span class="control-label" style="margin-left:auto">CHANNEL</span><select id="satellite-channel" class="select-control"><option value="GEOCOLOR" ${state.satelliteChannel==='GEOCOLOR'?'selected':''}>GeoColor</option><option value="13" ${state.satelliteChannel==='13'?'selected':''}>Infrared · band 13</option><option value="08" ${state.satelliteChannel==='08'?'selected':''}>Water vapor · band 8</option><option value="02" ${state.satelliteChannel==='02'?'selected':''}>Visible · band 2</option></select><button class="map-expand" data-action="refresh-satellite">↻</button></div><div id="sat-image-wrap"><img id="sat-image" class="sat-image" referrerpolicy="no-referrer" alt="Current GOES full-disk satellite imagery"/><div id="sat-image-error" class="image-fallback" hidden>Satellite image is unavailable for this channel. Try GeoColor or open the official NOAA viewer.</div></div><div class="outlook-source"><span id="sat-caption">${esc(name)} · ${esc(state.satelliteChannel)}</span><a id="satellite-source-link" href="https://www.star.nesdis.noaa.gov/GOES/fulldisk_band.php?band=GEOCOLOR&length=12&sat=G19" target="_blank" rel="noreferrer">NOAA full-disk loop ↗</a></div></section><aside class="card"><div class="card-head"><h2 class="card-title">IMAGE CHANNELS</h2><span class="card-note">NOAA / NESDIS</span></div><div class="sat-info"><div class="channel-option"><span>GeoColor</span><small>DAY / NIGHT</small></div><div class="channel-option"><span>Clean infrared</span><small>24/7</small></div><div class="channel-option"><span>Water vapor</span><small>MID / UPPER LEVEL</small></div><div class="channel-option"><span>Visible</span><small>DAYLIGHT</small></div><p class="sat-disclaimer">The image is loaded directly into Atmos; it no longer embeds the NOAA website. GOES-East and GOES-West each cover a large part of the Western Hemisphere, not the entire globe. Bands and image coverage vary by satellite.</p></div></aside></div>`;
}

function renderCamerasPage() {
  const feeds=getAllCameras();
  const rows=feeds.length?feeds.slice(0,20).map((camera,index)=>`<div class="camera-row"><span class="camera-thumb">▣</span><span class="camera-info"><strong>${esc(camera.name)}</strong><small>${esc(camera.lat)}, ${esc(camera.lon)} · ${esc(camera.attribution||camera.url)}</small></span><button class="btn btn-quiet" data-camera-feed-index="${index}">View</button></div>`).join(''):`<div class="empty-state">No feeds loaded yet.<br><span class="tiny">Search this area or add a public feed below.</span></div>`;
  const preference=state.cameraPreferences;
  const providerCards=`<div class="camera-provider-grid"><a class="camera-provider-card" href="https://trafficcameras.uk/" target="_blank" rel="noreferrer"><span class="provider-region">UNITED KINGDOM</span><strong>Traffic Cameras UK</strong><small>Browse motorway and major-road cameras by road. Their site manages live-image refresh; its interactive map requires a free account.</small><span class="provider-open">Browse UK cameras ↗</span></a><a class="camera-provider-card" href="https://opencctv.org/cameras/united-states" target="_blank" rel="noreferrer"><span class="provider-region">UNITED STATES</span><strong>OpenCCTV public cameras</strong><small>Browse public traffic cameras. Open a camera page there, then paste its page URL into the in-app form below to view the embedded feed here.</small><span class="provider-open">Browse U.S. cameras ↗</span></a></div>`;
  return `<div class="status-strip"><div class="status-left"><span class="pulse-dot"></span><span><strong>${feeds.length} camera feed${feeds.length===1?'':'s'} available</strong> · ${state.discoveredCameras.length} found nearby, ${state.cameras.length} saved by you</span></div><div class="status-right">CAMERA COVERAGE VARIES BY AGENCY</div></div>${providerCards}<div class="camera-layout"><section class="card"><div class="card-head"><h2 class="card-title">CAMERA MAP</h2><span class="card-note">${esc(state.place.name.toUpperCase())}</span></div><div class="map-wrap camera-map"><div id="radar-map"></div><div class="map-overlay-label">▣ PUBLIC CAMERA LOCATIONS</div></div></section><section class="card"><div class="card-head"><h2 class="card-title">CAMERA FEEDS</h2><button class="map-expand" data-action="add-camera">＋ Add</button></div><div class="camera-list"><section class="camera-preferences"><div class="eyebrow">CAMERA DISCOVERY</div><label class="form-label">Search mode<select class="input" id="camera-search-mode"><option value="automatic" ${preference.mode==='automatic'?'selected':''}>Automatic when this page opens</option><option value="manual" ${preference.mode==='manual'?'selected':''}>Manual only</option></select></label><label class="form-label">Search radius<select class="input" id="camera-search-radius"><option value="20" ${Number(preference.radiusKm)===20?'selected':''}>20 km</option><option value="40" ${Number(preference.radiusKm)===40?'selected':''}>40 km</option><option value="80" ${Number(preference.radiusKm)===80?'selected':''}>80 km</option></select></label><div class="camera-preference-actions"><button class="btn btn-primary" data-action="save-camera-preferences">Save user preferences</button><button class="btn btn-quiet" data-action="search-cameras">Search this area now</button></div><p class="source-note">Automatic discovery sends a rounded area box around ${esc(state.place.name)} to Datumfeed, a public camera registry. Searches are cached for 15 minutes; camera coverage varies by participating transport agencies.</p><div id="camera-search-status" class="tiny">${state.cameraPreferences.mode==='automatic'?'Automatic discovery runs when this page opens.':'Manual search is enabled.'}</div></section><div class="camera-section-label">NEARBY AND SAVED FEEDS</div>${rows}${feeds.length>20?`<div class="tiny">Showing 20 of ${feeds.length} available feeds.</div>`:''}<form class="camera-form" id="camera-form"><div class="eyebrow">ADD A PUBLIC FEED MANUALLY</div><label class="form-label">Camera name<input class="input" name="name" placeholder="e.g. I-35 Northbound" required /></label><label class="form-label">Stream, image, or OpenCCTV camera page URL<input class="input" name="url" type="url" placeholder="https://opencctv.org/cameras/united-states/…" required /></label><div style="display:grid;grid-template-columns:1fr 1fr;gap:7px"><label class="form-label">Latitude<input class="input" name="lat" type="number" step="any" value="${state.place.latitude.toFixed(4)}" required /></label><label class="form-label">Longitude<input class="input" name="lon" type="number" step="any" value="${state.place.longitude.toFixed(4)}" required /></label></div><button class="btn btn-primary" type="submit">＋ Save camera</button><small class="tiny">Use an HTTPS stream, image, or embeddable camera page. Some providers block playback outside their own site.</small></form></div></section></div>`;
}

function renderMusicPage() {
  const provider=storage.get('music-provider','Spotify'); const url=storage.get('music-url','');
  const active=storage.get('music-player-active',true);
  const playerMessage=!url?'Choose a service and paste a public playlist, album, or track link to get started.':active?'Use the docked player at the lower-right to start or control playback. It stays mounted as you switch Atmos pages.':`Music is saved. <button class="btn btn-primary" data-action="resume-background-music">Start background player</button>`;
  return `<div class="music-grid"><div><section class="card music-hero"><div><div class="eyebrow">SOUNDTRACK YOUR WEATHER DESK</div><h2>Weather, in the background.</h2><p>Your Spotify or Apple Music player stays on screen while you browse the radar, warnings, and forecasts. Start playback in the player controls, then keep working in Atmos.</p></div></section><section class="card" style="margin-top:14px"><div class="card-head"><h2 class="card-title">NOW PLAYING</h2><span class="card-note">${provider.toUpperCase()}</span></div><div class="music-embed" id="music-embed"><div class="empty-state">${playerMessage}<br><span class="tiny">Background playback continues while this tab stays open; browser and music-provider settings control playback outside the tab.</span></div></div></section></div><section class="card"><div class="card-head"><h2 class="card-title">CONNECT MUSIC</h2><span class="card-note">PUBLIC PLAYER</span></div><form class="music-form" id="music-form"><div class="provider-tabs"><button class="provider-tab ${provider==='Spotify'?'selected':''}" type="button" data-provider="Spotify">Spotify</button><button class="provider-tab ${provider==='Apple Music'?'selected':''}" type="button" data-provider="Apple Music">Apple Music</button></div><label class="form-label">Playlist, album, or track URL<input class="input" type="url" name="url" value="${esc(url)}" placeholder="https://open.spotify.com/playlist/…" /></label><button class="btn btn-primary" type="submit">Save and open player</button><p class="source-note">Public embeds use the provider’s player controls. A user gesture may be required to start audio. Closing this dock stops playback but keeps your saved link.</p></form></section></div>`;
}

function musicEmbedMarkup(provider,url) {
  if (!url) return `<div class="empty-state">Choose Spotify or Apple Music and paste a public link to get started.<br><span class="tiny">Your player appears here.</span></div>`;
  try {
    const parsed=new URL(url);
    let embed='';
    if (provider==='Spotify' && (parsed.hostname==='spotify.com'||parsed.hostname.endsWith('.spotify.com'))) {
      const parts=parsed.pathname.split('/').filter(Boolean); const type=parts[0], id=parts[1]?.split('?')[0];
      if (!['track','album','playlist','episode','show'].includes(type) || !id) throw new Error('bad url');
      embed=`https://open.spotify.com/embed/${type}/${encodeURIComponent(id)}?utm_source=generator`;
    } else if (provider==='Apple Music' && (parsed.hostname==='apple.com'||parsed.hostname.endsWith('.apple.com'))) {
      embed=url.replace(/^https:\/\/music\.apple\.com/i,'https://embed.music.apple.com');
    } else throw new Error('wrong provider');
    return `<iframe src="${esc(embed)}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="eager" title="${esc(provider)} background player"></iframe>`;
  } catch { return `<div class="empty-state">That link doesn’t look like a public ${esc(provider)} page. Check the URL and try again.</div>`; }
}

function syncBackgroundMusicPlayer() {
  const dock=$('#background-music-dock'),content=$('#background-music-content');
  if(!dock||!content)return;
  const provider=storage.get('music-provider','Spotify'),url=storage.get('music-url','');
  const active=storage.get('music-player-active',Boolean(url));
  dock.hidden=!url||!active;
  setText('#background-music-provider',provider.toUpperCase());
  if(!url||!active){if(!active)content.replaceChildren();return;}
  const key=`${provider}|${url}`;
  if(content.dataset.playerKey!==key||!content.querySelector('iframe')) {
    content.innerHTML=musicEmbedMarkup(provider,url);
    content.dataset.playerKey=key;
  }
}

function savedSocialMonitor(){return {...{usMode:'all',usStates:[],canadaMode:'off',canadaRegions:[]},...storage.get('social-monitor',{})};}

function socialMonitorMarkup(monitor){
  const states=US_STATES.map(([code,name])=>`<label class="area-check"><input type="checkbox" data-social-area="us" value="${code}" ${monitor.usStates.includes(code)?'checked':''}/><span>${name}</span></label>`).join('');
  const regions=CANADA_REGIONS.map(([code,name])=>`<label class="area-check"><input type="checkbox" data-social-area="ca" value="${code}" ${monitor.canadaRegions.includes(code)?'checked':''}/><span>${name}</span></label>`).join('');
  return `<div class="social-monitor-card"><div class="eyebrow">WARNING MONITORING AREAS</div><p class="source-note">Choose where new warnings can trigger an AI-assisted draft. Drafts still require your review.</p><div class="monitor-country"><label class="form-label">United States<select class="input" id="social-us-mode"><option value="all" ${monitor.usMode==='all'?'selected':''}>Monitor all 50 states + DC</option><option value="selected" ${monitor.usMode==='selected'?'selected':''}>Only states I check below</option><option value="off" ${monitor.usMode==='off'?'selected':''}>Do not monitor U.S. alerts</option></select></label><div class="area-check-grid" id="social-us-areas" ${monitor.usMode==='selected'?'':'hidden'}>${states}</div><label class="form-label">Canada<select class="input" id="social-ca-mode"><option value="off" ${monitor.canadaMode==='off'?'selected':''}>Do not monitor Canada</option><option value="all" ${monitor.canadaMode==='all'?'selected':''}>Monitor all of Canada</option><option value="selected" ${monitor.canadaMode==='selected'?'selected':''}>Only provinces / territories I check below</option></select></label><div class="area-check-grid" id="social-ca-areas" ${monitor.canadaMode==='selected'?'':'hidden'}>${regions}</div></div></div>`;
}

function updateSocialMonitorVisibility(){
  const us=$('#social-us-areas'),canada=$('#social-ca-areas');
  if(us)us.hidden=$('#social-us-mode')?.value!=='selected';
  if(canada)canada.hidden=$('#social-ca-mode')?.value!=='selected';
}

function socialMonitorFromPage(){
  return {usMode:$('#social-us-mode')?.value||'all',usStates:$$('[data-social-area="us"]:checked').map(input=>input.value),canadaMode:$('#social-ca-mode')?.value||'off',canadaRegions:$$('[data-social-area="ca"]:checked').map(input=>input.value)};
}

function alertMonitorRegions(alert){
  const properties=alert.properties||{};
  if(properties.country==='CA')return (properties.regionCodes||[properties.province]).filter(Boolean).map(code=>String(code).toUpperCase());
  const raw=[...(Array.isArray(properties.stateCodes)?properties.stateCodes:[]),...(Array.isArray(properties.geocode?.UGC)?properties.geocode.UGC:[])];
  return [...new Set(raw.map(value=>{
    const code=String(value||'').toUpperCase().trim();
    if(/^[A-Z]{2}$/.test(code))return code;
    return code.match(/^([A-Z]{2})(?:C|Z)\d+$/)?.[1]||'';
  }).filter(Boolean))];
}

function socialMonitorMatchesAlert(alert,monitor=savedSocialMonitor()){
  const properties=alert.properties||{};
  if(properties.country==='CA'){
    if(monitor.canadaMode==='off')return false;
    return monitor.canadaMode==='all'||alertMonitorRegions(alert).some(code=>monitor.canadaRegions.includes(code));
  }
  if(monitor.usMode==='off')return false;
  return monitor.usMode==='all'||alertMonitorRegions(alert).some(code=>monitor.usStates.includes(code));
}

function renderSocialPage() {
  const selected = state.socialPlatform;
  const options=storage.get('social-options',{tone:'reassuring',length:'standard',audience:'local',format:'warning',includeLocation:true,includeHashtags:true});
  const profiles=storage.get('social-profiles',{});
  const profile=profiles[selected]||{username:'',displayName:''};
  const profileUrl=socialProfileUrl(selected,profile.username);
  const profileDisplayName=esc(profile.displayName||'');
  const profileUsername=esc(profile.username||'');
  const profileLink=profileUrl?`<a class="btn btn-quiet" id="social-profile-link" href="${esc(profileUrl)}" target="_blank" rel="noreferrer">Open public profile ↗</a>`:'<span class="tiny">Save a username to create the public profile link.</span>';
  const sourceAlert=state.alerts.find(alert=>/warning/i.test(alert.properties?.event||''));
  const event=sourceAlert?.properties?.event || 'Weather update';
  const area=sourceAlert?.properties?.areaDesc?.split(';')[0] || state.place.name;
  const initial=state.socialPrompt || storage.get('social-draft','') || `${event} issued for ${area}. Follow official local guidance and stay weather aware. #WeatherAlert #${state.place.name.replace(/[^a-z0-9]/gi,'')}`;
  const max=selected==='TikTok'?2200:5000;
  return `<div class="social-layout"><section class="card"><div class="card-head"><h2 class="card-title">POST PREVIEW</h2><div class="provider-tabs" style="margin:0">${['YouTube','TikTok'].map(platform=>`<button class="provider-tab ${selected===platform?'selected':''}" data-social-platform="${platform}">${platform}</button>`).join('')}</div></div><div class="social-preview"><div class="post-preview"><div class="post-brand"><span class="avatar">A</span><span id="social-preview-brand">${esc(storage.get('social-brand','Atmos Weather Desk'))}</span><span class="card-note">· ${esc(selected.toUpperCase())}</span></div><strong class="post-headline" id="social-preview-title">${esc(storage.get('social-title',''))}</strong><div class="post-copy" id="social-preview-copy">${esc(initial)}</div></div><div class="social-custom-grid"><label class="form-label">Display name<input class="input" id="social-brand" value="${esc(storage.get('social-brand','Atmos Weather Desk'))}" maxlength="48" /></label><label class="form-label">Post title<input class="input" id="social-title" value="${esc(storage.get('social-title',''))}" maxlength="100" placeholder="Optional headline" /></label></div><label class="form-label" style="margin-top:10px">Caption<textarea id="social-caption" class="input" rows="6" maxlength="${max}" style="height:auto;padding:10px;resize:vertical">${esc(initial)}</textarea></label><div class="social-caption-footer"><span class="tiny">Editable draft · saved on this device</span><span id="social-char-count" class="tiny">${initial.length} / ${max}</span></div><div style="display:flex;gap:7px;margin-top:9px;flex-wrap:wrap"><button class="btn btn-quiet" data-action="draft-caption">✦ Draft with AI</button><button class="btn btn-quiet" data-action="copy-caption">Copy caption</button><button class="btn btn-quiet" data-action="copy-social-package">Copy post package</button></div><p class="tiny" style="margin:10px 0 0">Your text and preferences stay saved in this browser. This page can be installed and opened offline; live weather data still needs an internet connection.</p></div></section><section class="card"><div class="card-head"><h2 class="card-title">CUSTOMIZE & AUTOMATION</h2><span class="card-note">SAVED ON THIS DEVICE</span></div><div class="social-setup"><div class="social-options-grid"><label class="form-label">Writing style<select class="input" id="social-tone"><option value="reassuring" ${options.tone==='reassuring'?'selected':''}>Reassuring</option><option value="direct" ${options.tone==='direct'?'selected':''}>Direct</option><option value="conversational" ${options.tone==='conversational'?'selected':''}>Conversational</option><option value="formal" ${options.tone==='formal'?'selected':''}>Formal</option></select></label><label class="form-label">Length<select class="input" id="social-length"><option value="short" ${options.length==='short'?'selected':''}>Short</option><option value="standard" ${options.length==='standard'?'selected':''}>Standard</option><option value="detailed" ${options.length==='detailed'?'selected':''}>Detailed</option></select></label><label class="form-label">Audience<select class="input" id="social-audience"><option value="local" ${options.audience==='local'?'selected':''}>Local community</option><option value="drivers" ${options.audience==='drivers'?'selected':''}>Road users</option><option value="general" ${options.audience==='general'?'selected':''}>General followers</option></select></label><label class="form-label">Post focus<select class="input" id="social-format"><option value="warning" ${options.format==='warning'?'selected':''}>Warning update</option><option value="forecast" ${options.format==='forecast'?'selected':''}>Weather update</option><option value="preparedness" ${options.format==='preparedness'?'selected':''}>Preparedness reminder</option></select></label></div><div class="check-list"><label class="check-row"><input type="checkbox" id="social-include-location" ${options.includeLocation?'checked':''}/>Include the location name</label><label class="check-row"><input type="checkbox" id="social-include-hashtags" ${options.includeHashtags?'checked':''}/>Suggest relevant hashtags</label><label class="check-row"><input type="checkbox" id="social-enable" ${storage.get('social-enabled',false)?'checked':''}/>Prepare a draft when a new NWS warning is detected</label><label class="check-row"><input type="checkbox" id="social-review" checked/>Require my review before publishing</label></div><button class="btn btn-primary" style="margin-top:12px" data-action="save-social-preferences">Save social preferences</button><div class="social-account-form"><div class="eyebrow">LINK YOUR ${selected.toUpperCase()} PROFILE</div><label class="form-label">Display name<input class="input" id="social-account-display" value="${profileDisplayName}" maxlength="60" placeholder="Your public display name" /></label><label class="form-label">Username or handle<input class="input" id="social-account-username" value="${profileUsername}" maxlength="50" placeholder="@yourchannel" /></label><div class="social-account-actions"><button class="btn btn-primary" data-action="save-social-profile">Save profile link</button>${profileLink}</div><p class="tiny">This saves a public username and display name on this device. It does not sign in or grant permission to publish.</p></div><div class="divider" style="margin:14px 0"></div><div class="source-list"><div class="source-item">${selected==='YouTube'?'▶':'♪'} ${selected} account<span>${profileUrl?'PROFILE LINKED':'PROFILE NOT SET'}</span></div><div class="source-item">✦ Gemini / ChatGPT<span>SERVER KEY</span></div></div><div class="social-warning">Automatic publishing needs an authorized social account and a secure server integration. Never paste provider keys into this browser app. Posts should be reviewed before publishing during active hazards.</div><div style="display:flex;gap:7px;flex-wrap:wrap"><select class="select-control" id="ai-provider"><option ${storage.get('ai-provider','ChatGPT')==='ChatGPT'?'selected':''}>ChatGPT</option><option ${storage.get('ai-provider','ChatGPT')==='Gemini'?'selected':''}>Gemini</option></select><button class="btn btn-quiet" data-action="draft-caption">✦ Draft with AI</button></div><p class="source-note" style="margin-top:12px">YouTube and TikTok drafts can be copied into their native composer. A saved username opens your public profile; publishing still requires platform authorization.</p></div></section></div>`;
}

const WEATHER_CREATORS = [
  {name:'Ryan Hall, Y’all', kind:'Meteorologist-led live coverage', url:'https://www.youtube.com/@RyanHallYall', region:'United States'},
  {name:'Reed Timmer', kind:'Extreme-weather field reporting', url:'https://www.youtube.com/@ReedTimmerWX', region:'United States'},
  {name:'Storm of Passion', kind:'Live storm coverage', url:'https://www.youtube.com/results?search_query=Storm+of+Passion+weather', region:'United States'},
  {name:'Pecos Hank', kind:'Storm photography & atmospheric science', url:'https://www.youtube.com/@PecosHank', region:'United States'},
  {name:'Convective Chronicles', kind:'Severe-weather analysis & education', url:'https://www.youtube.com/@ConvectiveChronicles', region:'United States'},
  {name:'Max Velocity', kind:'Live severe-weather coverage', url:'https://www.youtube.com/@MaxVelocityWX', region:'United States'},
  {name:'The Weather Channel', kind:'Weather news & live coverage', url:'https://www.youtube.com/@TheWeatherChannel', region:'International'},
  {name:'WeatherNation', kind:'Weather news & event coverage', url:'https://www.youtube.com/@WeatherNation', region:'United States'},
  {name:'Met Office', kind:'Official UK forecasts & explainers', url:'https://www.youtube.com/@metoffice', region:'United Kingdom'},
  {name:'Environment and Climate Change Canada', kind:'Official Canadian weather education', url:'https://www.youtube.com/results?search_query=Environment+and+Climate+Change+Canada+weather', region:'Canada'},
  {name:'Bureau of Meteorology', kind:'Official Australian weather information', url:'https://www.youtube.com/results?search_query=Australian+Bureau+of+Meteorology+weather', region:'Australia'},
  {name:'National Weather Service', kind:'Official U.S. watches, warnings & safety', url:'https://www.youtube.com/@NationalWeatherService', region:'United States'},
  {name:'Severe Weather Europe', kind:'European severe-weather coverage & analysis', url:'https://www.youtube.com/results?search_query=Severe+Weather+Europe', region:'Europe'},
  {name:'MetService New Zealand', kind:'Official NZ forecasts and weather education', url:'https://www.youtube.com/results?search_query=MetService+New+Zealand+weather', region:'New Zealand'},
  {name:'Japan Meteorological Agency', kind:'Official Japanese weather information', url:'https://www.youtube.com/results?search_query=Japan+Meteorological+Agency+weather', region:'Japan'},
  {name:'Skip Talbot', kind:'Storm spotting, safety, and storm structure education', url:'https://www.youtube.com/results?search_query=Skip+Talbot+storm+spotting', region:'United States'}
];

function renderCreatorsPage(){
  return `<section class="card creator-intro"><div class="card-body"><div class="eyebrow">COMMUNITY & EDUCATION</div><h2>People to follow during active weather</h2><p class="source-note">A selection of meteorologists, storm chasers, weather educators, and official agency channels. This is not an endorsement or a guarantee of accuracy. Use creators for context; always verify warnings with the official agency for your location.</p><div class="creator-quick-links"><a class="btn btn-primary" href="https://www.youtube.com/@RyanHallYall" target="_blank" rel="noopener noreferrer">▶ Ryan Hall, Y’all</a><a class="btn btn-quiet" href="https://www.youtube.com/@ReedTimmerWX" target="_blank" rel="noopener noreferrer">▶ Reed Timmer</a><a class="btn btn-quiet" href="https://www.youtube.com/results?search_query=Storm+of+Passion+weather" target="_blank" rel="noopener noreferrer">▶ Storm of Passion</a></div></div></section><div class="creator-grid">${WEATHER_CREATORS.map((item,index)=>`<article class="card creator-card"><div class="creator-avatar">${index<8?'▶':'✓'}</div><div class="creator-card-copy"><h3>${esc(item.name)}</h3><p>${esc(item.kind)}</p><span class="tiny">${esc(item.region)}</span></div><a class="btn btn-quiet" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Open channel ↗</a></article>`).join('')}</div><p class="source-note creator-disclaimer">Live streams can contain speculation, delayed reports, or user-generated information. During a warning, use the official alert text and local emergency-management instructions.</p>`;
}

function spotterReportRowsMarkup(){
  if(state.spotterReportsStatus==='loading'||state.spotterReportsStatus==='idle')return `<div class="empty-state">Loading SPC preliminary storm reports…</div>`;
  if(state.spotterReportsStatus!=='live'||!state.spotterReports.length)return `<div class="empty-state">The SPC preliminary report feed is currently unavailable or has no published rows for this period.<br><span class="tiny">Open the official preliminary storm-report page for the latest source material.</span></div>`;
  const rows=state.spotterReports;
  const first=rows[0]?.properties||{};
  const keys=Object.keys(first);
  const choose=patterns=>keys.find(key=>patterns.some(pattern=>pattern.test(key)));
  const ordered=[choose(/^(time|utc|time_utc|report_time)$/),choose(/^(location|city|county)$/),choose(/^(state|st)$/),choose(/^(type|event|report)$/),choose(/^(mag|magnitude|hail_size|wind)$/),choose(/^(comments|remarks|comment)$/)].filter((v,i,a)=>v&&a.indexOf(v)===i);
  const columns=ordered.length?ordered:keys.slice(0,6);
  const nice=key=>key.replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase());
  return `<div class="table-scroll"><table class="report-table"><thead><tr>${columns.map(key=>`<th>${esc(nice(key))}</th>`).join('')}</tr></thead><tbody>${rows.slice(0,100).map(row=>`<tr>${columns.map(key=>`<td>${esc(row.properties?.[key]||'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function renderReportsPage(){
  return `<div class="reports-layout"><section class="card"><div class="card-head"><h2 class="card-title">LATEST PRELIMINARY STORM REPORTS</h2><button class="btn btn-quiet" data-action="refresh-reports">↻ Refresh</button></div><div class="report-feed-summary"><span class="report-feed-dot ${state.spotterReportsStatus==='live'?'is-live':''}"></span><span id="spotter-report-status">${state.spotterReportsStatus==='live'?`${state.spotterReports.length} source rows loaded`:'Connecting to SPC report archive…'}</span><span class="card-note">SPC · U.S.</span></div><div id="spotter-report-table">${spotterReportRowsMarkup()}</div><div class="card-body"><p class="source-note">These are preliminary Storm Prediction Center reports, not a complete list of every Skywarn submission. Reports can be unconfirmed, duplicated, delayed, or later revised. A blank table means the feed has no rows or is unavailable—not that no hazardous weather occurred.</p><a class="btn btn-primary" href="https://www.spc.noaa.gov/climo/reports/" target="_blank" rel="noopener noreferrer">Open official SPC storm reports ↗</a></div></section><aside class="reports-side"><section class="card"><div class="card-head"><h2 class="card-title">SKYWARN & SPOTTER NETWORKS</h2></div><div class="card-body"><p class="source-note">SKYWARN is an NWS volunteer spotter program in the U.S. Individual reports usually enter operational systems through local forecast offices; a single global public Skywarn feed does not exist.</p><div class="source-list"><a class="source-item" href="https://www.weather.gov/SKYWARN" target="_blank" rel="noopener noreferrer">NWS SKYWARN program<span>TRAINING ↗</span></a><a class="source-item" href="https://www.weather.gov/crh/skywarn" target="_blank" rel="noopener noreferrer">Regional SKYWARN resources<span>OFFICIAL ↗</span></a><a class="source-item" href="https://www.spc.noaa.gov/climo/reports/" target="_blank" rel="noopener noreferrer">SPC preliminary reports<span>U.S. REPORTS ↗</span></a></div></div></section><section class="card"><div class="card-head"><h2 class="card-title">GLOBAL REPORTING</h2></div><div class="card-body"><p class="source-note">Outside the U.S., spotter programs and public reporting vary. Use your national meteorological service and local emergency services rather than assuming U.S. Skywarn reports cover your region.</p><a class="btn btn-quiet" href="https://severeweather.wmo.int/" target="_blank" rel="noopener noreferrer">WMO Severe Weather Information Centre ↗</a></div></section></aside></div>`;
}

function serviceStatusMarkup(){
  if(!state.serviceStatus.length)return `<div class="empty-state">Checking data providers…</div>`;
  const groups={};for(const service of state.serviceStatus){(groups[service.region||'Other']||(groups[service.region||'Other']=[])).push(service);}
  const count=state.serviceStatus.reduce((acc,item)=>{acc[item.status]=(acc[item.status]||0)+1;return acc;},{});
  const summary=count.down?'Some providers are unreachable':count.degraded?'Some providers are rate-limited or degraded':count.up===state.serviceStatus.length?'All checked providers responded':'Status partially available';
  const statusClass=status=>status==='up'?'service-up':status==='degraded'?'service-degraded':status==='internal'?'service-internal':'service-down';
  return `<div class="service-summary-row"><div><span class="service-summary-label">SYSTEM CHECK</span><h2>${esc(summary)}</h2><p>${state.serviceStatus.length} checks · ${count.up||0} up · ${count.degraded||0} degraded · ${count.down||0} down</p></div><span class="service-total-dot ${count.down?'service-dot-down':''}"></span></div>${Object.entries(groups).map(([group,items])=>`<section class="service-group"><div class="service-group-heading">${esc(group)} <span>${items.length} checks</span></div>${items.map(service=>`<article class="service-row"><span class="service-status-dot ${statusClass(service.status)}"></span><div class="service-copy"><strong>${esc(service.name)}</strong><small>${esc(service.note||'External data source')}</small><small class="service-latency">${service.latencyMs!=null?`${service.latencyMs} ms`:''}${service.httpStatus?` · HTTP ${service.httpStatus}`:''}${service.checkedAt?` · ${new Date(service.checkedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`:''}</small></div><span class="service-state ${statusClass(service.status)}">${esc(service.status||'unknown').toUpperCase()}</span><a class="service-link" href="${esc(service.url?.startsWith('/')?new URL(service.url,location.origin).href:service.url||'https://www.wmo.int/')}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(service.name)}">↗</a></article>`).join('')}`).join('')}`;
}
function renderStatusPage(){
  return `<section class="card service-status-card"><div class="card-head"><h2 class="card-title">UPSTREAM PROVIDERS</h2><div><span class="card-note" id="status-checked-at">Waiting for first check…</span> <button class="btn btn-quiet" data-action="refresh-status">↻ Check now</button></div></div><div class="card-body" id="service-status-content">${serviceStatusMarkup()}</div></section><section class="card service-notes-card"><div class="card-head"><h2 class="card-title">HOW TO READ THIS PAGE</h2></div><div class="card-body"><p class="source-note">A service is marked up when its endpoint returned a successful HTTP response from the server. This is a point-in-time reachability check, not an uptime guarantee, a test of every map tile, or verification that the data is complete. Some sites block automated health checks; that can create a false down indication.</p><p class="source-note">Global coverage is mixed: radar availability depends on regional networks, and warning feeds depend on national agencies. A working provider does not mean a warning is active in your area.</p><p class="tiny">Checked at <span id="status-checked-at-footer">—</span>. Refresh to run another check.</p></div></section>`;
}

async function loadSpotterReports(showToast=false){
  state.spotterReportsStatus='loading';
  const table=$('#spotter-report-table');if(table)table.innerHTML=spotterReportRowsMarkup();
  try{
    const data=await fetchJson('/api/spc-reports',{cache:'no-store'});
    state.spotterReports=data.rows||[];state.spotterReportsStatus=data.status==='live'?'live':'unavailable';
  }catch{state.spotterReports=[];state.spotterReportsStatus='unavailable';}
  const target=$('#spotter-report-table');if(target)target.innerHTML=spotterReportRowsMarkup();
  const status=$('#spotter-report-status');if(status)status.textContent=state.spotterReportsStatus==='live'?`${state.spotterReports.length} rows · source reports refreshed`: 'Source report feed unavailable';
  if(showToast)toast(state.spotterReportsStatus==='live'?'Storm reports refreshed.':'Storm report feed is unavailable.');
}

async function loadServiceStatus(showToast=false){
  const target=$('#service-status-content');if(target)target.innerHTML='<div class="empty-state">Checking weather-service endpoints…</div>';
  try{
    const data=await fetchJson('/api/status',{cache:'no-store'});
    state.serviceStatus=data.services||[];state.serviceStatusCheckedAt=data.checkedAt||new Date().toISOString();
  }catch{state.serviceStatus=[{id:'status',name:'Status checker',region:'Website',status:'down',note:'The site could not reach its own status route.',url:'/api/status'}];state.serviceStatusCheckedAt=new Date().toISOString();}
  const content=$('#service-status-content');if(content)content.innerHTML=serviceStatusMarkup();
  const stamp=new Date(state.serviceStatusCheckedAt).toLocaleString([], {dateStyle:'medium',timeStyle:'short'});
  setText('#status-checked-at',stamp);setText('#status-checked-at-footer',stamp);
  if(showToast)toast('Provider status check complete.');
}

function renderSettingsPage() {
  const prefs=storage.get('notifications',{enabled:false,scope:'nearby',spc:true,warnings:true});
  return `<div class="settings-grid"><section class="card"><div class="card-head"><h2 class="card-title">ALERT NOTIFICATIONS</h2><span class="card-note">BROWSER-BASED</span></div><div class="card-body"><div class="setting-row"><div class="setting-copy"><strong>Browser notifications</strong><small>Show alerts while Atmos is open. Background push still needs a Vercel push sender and saved subscriptions.</small></div><label class="switch"><input id="setting-notifications" type="checkbox" ${prefs.enabled?'checked':''}/><span class="switch-track"></span></label></div><div class="setting-row"><div class="setting-copy"><strong>Watch area</strong><small>Nearby follows the selected place when alert geometry or country metadata is available. Worldwide follows connected feeds plus GDACS major hazards; national warning integration varies by country.</small></div><select class="select-control" id="setting-scope"><option value="nearby" ${prefs.scope==='nearby'?'selected':''}>Near me</option><option value="worldwide" ${prefs.scope==='worldwide'?'selected':''}>Worldwide · connected feeds + GDACS</option></select></div><div class="setting-row"><div class="setting-copy"><strong>Tornado warnings</strong><small>Show tornado-specific alerts where a connected feed provides them.</small></div><label class="switch"><input id="setting-tornado" type="checkbox" ${prefs.tornado!==false?'checked':''}/><span class="switch-track"></span></label></div><div class="setting-row"><div class="setting-copy"><strong>Severe thunderstorm warnings</strong><small>Include severe thunderstorm alert events.</small></div><label class="switch"><input id="setting-severe" type="checkbox" ${prefs.severe!==false?'checked':''}/><span class="switch-track"></span></label></div><div class="setting-row"><div class="setting-copy"><strong>Flood warnings</strong><small>Include flood and flash-flood events.</small></div><label class="switch"><input id="setting-flood" type="checkbox" ${prefs.flood!==false?'checked':''}/><span class="switch-track"></span></label></div><div class="setting-row"><div class="setting-copy"><strong>SPC outlook updates</strong><small>Notify when the official SPC Day 1 outlook changes.</small></div><label class="switch"><input id="setting-spc" type="checkbox" ${prefs.spc?'checked':''}/><span class="switch-track"></span></label></div><div class="setting-row"><div class="setting-copy"><strong>Weather warnings</strong><small>Notify about new active alerts for this area.</small></div><label class="switch"><input id="setting-warnings" type="checkbox" ${prefs.warnings?'checked':''}/><span class="switch-track"></span></label></div><button class="btn btn-primary" style="margin-top:12px" data-action="save-notifications">Save notification settings</button></div></section><section class="card"><div class="card-head"><h2 class="card-title">INSTALL & OFFLINE</h2><span class="card-note">APP SHELL</span></div><div class="card-body"><p class="source-note">Install Atmos as an app for quick access. The app shell and saved Social Studio drafts are available offline; live maps, alerts, and forecasts need a connection.</p><button class="btn btn-primary" id="install-app-button" data-action="install-app">Install Atmos</button><p class="tiny" id="install-status" style="margin-top:10px">Offline mode is ready after the first visit.</p><p class="tiny" style="margin-top:9px">Closed-app push notifications require a push service, VAPID credentials, and persistent subscription storage on the deployed server.</p></div></section><section class="card"><div class="card-head"><h2 class="card-title">DISPLAY</h2><span class="card-note">SAVED ON THIS DEVICE</span></div><div class="card-body"><div class="setting-row"><div class="setting-copy"><strong>Appearance</strong><small>Choose Bright, Dark, OLED, Storm, Ocean, Forest, Ember, or Violet; adjust the accent color in the sidebar.</small></div><span class="tiny">Use theme controls at left</span></div><div class="setting-row"><div class="setting-copy"><strong>Accent & outline</strong><small>Customize the highlight color used for selection outlines and active controls.</small></div><span class="tiny">Use color swatches at left</span></div><div class="setting-row"><div class="setting-copy"><strong>Selected location</strong><small>${esc(locationLine())}</small></div><button class="btn btn-quiet" data-action="focus-search">Change</button></div><p class="source-note" style="margin:12px 0 0">Your theme, accent, location, camera links, and music embed preference are stored in this browser.</p></div></section><section class="card"><div class="card-head"><h2 class="card-title">DATA SOURCES</h2></div><div class="card-body"><div class="source-list"><div class="source-item">Radar sites · NWS / NOAA<span>US</span></div><div class="source-item">Regional radar links · Met Office / Met Éireann / ECCC<span>UK · IE · CA</span></div><div class="source-item">Basemap · Esri World Street Map<span>NO API KEY</span></div><div class="source-item">Alerts · National Weather Service<span>UNITED STATES</span></div><div class="source-item">Forecast models · Open-Meteo<span>GLOBAL / US</span></div><div class="source-item">Satellite imagery · NOAA / NESDIS<span>GOES COVERAGE</span></div><div class="source-item">Outlooks · SPC official vector service<span>UNITED STATES</span></div></div></div></section><section class="card"><div class="card-head"><h2 class="card-title">ABOUT ATMOS</h2></div><div class="card-body"><p class="source-note">Atmos is a weather awareness dashboard. It is not a substitute for official warnings or emergency instructions. Follow your national meteorological service and local emergency management.</p><a class="btn btn-quiet" href="https://www.weather.gov/" target="_blank" rel="noreferrer">National Weather Service ↗</a></div></section></div>`;
}

function bindPageInteractions() {
  $$('[data-action]', $('#page-content')).forEach(button => button.addEventListener('click', handleAction));
  $$('[data-radar-layer]').forEach(button => button.addEventListener('click', () => setRadarLayer(button.dataset.radarLayer)));
  $$('[data-alert-filter]').forEach(button => button.addEventListener('click', () => { state.alertFilter = button.dataset.alertFilter; renderPage(); }));
  $$('[data-alert-region]').forEach(button => button.addEventListener('click', () => { state.alertRegion=button.dataset.alertRegion;renderPage(); }));
  $$('[data-warning-region]').forEach(button => button.addEventListener('click', () => { state.warningRegion=button.dataset.warningRegion;storage.set('warning-region',state.warningRegion);state.alertRegion='all';renderPage();loadAlerts(true); }));
  if ($('#global-radar-frame')) $('#global-radar-frame').addEventListener('change', event => { const value=event.target.value; const index=value==='latest'?state.globalRadarFrames.length-1:Number(value); paintGlobalRadarFrame(state.globalRadarMap,false,index); });
  $$('[data-social-platform]').forEach(button => button.addEventListener('click', () => { state.socialPlatform=button.dataset.socialPlatform; renderPage(); }));
  $$('[data-spc-hazard]').forEach(button=>button.addEventListener('click',()=>{state.outlookHazard=button.dataset.spcHazard;renderPage();}));
  if ($('#overview-layer')) $('#overview-layer').addEventListener('change', event => setRadarLayer(event.target.value));
  if ($('#lightning-toggle')) $('#lightning-toggle').addEventListener('change', event => { state.lightning=event.target.checked; renderPage(); });
  if ($('#camera-toggle')) $('#camera-toggle').addEventListener('change', event => { state.showCameras=event.target.checked; renderPage(); if(state.showCameras&&state.cameraPreferences.mode==='automatic')discoverCameras(); });
  if ($('#radar-site-select')) $('#radar-site-select').addEventListener('change', event => { state.radarStationId=event.target.value;state.radarScanIndex=null;storage.set('radar-station',state.radarStationId);loadRadarStationImage(true); });
  if ($('#radar-region-select')) $('#radar-region-select').addEventListener('change',event=>{if(event.target.value==='auto'){state.radarRegion='auto';renderPage();}else chooseRadarRegion(event.target.value);});
  if ($('#outlook-day')) $('#outlook-day').addEventListener('change', event => { state.outlookDay=Number(event.target.value);renderPage(); });
  if ($('#canada-outlook-layer')) $('#canada-outlook-layer').addEventListener('change', event => { state.canadaOutlookLayer=event.target.value;loadCanadaOutlookMap(true); });
  if ($('#model-select')) $('#model-select').addEventListener('change', event => { state.model=event.target.value;state.modelData=null;renderPage(); });
  if ($('#model-horizon')) $('#model-horizon').addEventListener('change', event => { state.modelHorizon=Number(event.target.value);if(state.modelData)setModelFrame(Math.min(state.modelFrame,state.modelHorizon-1)); });
  if ($('#model-variable')) $('#model-variable').addEventListener('change', event => { state.modelVariable=event.target.value;drawModelGrid(); });
  if ($('#model-timeline')) $('#model-timeline').addEventListener('input', event => setModelFrame(Number(event.target.value)));
  if ($('#satellite-select')) $('#satellite-select').addEventListener('change', event => { state.satellite=event.target.value;updateSatelliteImage(); });
  if ($('#satellite-channel')) $('#satellite-channel').addEventListener('change', event => { state.satelliteChannel=event.target.value;updateSatelliteImage(); });
  if ($('#camera-form')) $('#camera-form').addEventListener('submit', saveCamera);
  $$('[data-camera-index]').forEach(button => button.addEventListener('click', () => openCamera(state.cameras[Number(button.dataset.cameraIndex)])));
  $$('[data-camera-feed-index]').forEach(button => button.addEventListener('click', () => openCamera(getAllCameras()[Number(button.dataset.cameraFeedIndex)])));
  if ($('#camera-search-mode')) $('#camera-search-mode').addEventListener('change', event => { state.cameraPreferences.mode=event.target.value; });
  if ($('#music-form')) $('#music-form').addEventListener('submit', saveMusic);
  $$('[data-provider]').forEach(button=>button.addEventListener('click',()=>{storage.set('music-provider',button.dataset.provider);if(storage.get('music-url',''))storage.set('music-player-active',true);renderPage();}));
  if ($('#social-caption')) $('#social-caption').addEventListener('input', event=>{state.socialPrompt=event.target.value;storage.set('social-draft',event.target.value);setText('#social-preview-copy',event.target.value);setText('#social-char-count',`${event.target.value.length} / ${event.target.maxLength}`);});
  if ($('#social-title')) $('#social-title').addEventListener('input',event=>{storage.set('social-title',event.target.value);setText('#social-preview-title',event.target.value);});
  if ($('#social-brand')) $('#social-brand').addEventListener('input',event=>{storage.set('social-brand',event.target.value);setText('#social-preview-brand',event.target.value);});
  if ($('#social-enable')) $('#social-enable').addEventListener('change',event=>storage.set('social-enabled',event.target.checked));
  if ($('#social-us-mode')) $('#social-us-mode').addEventListener('change',updateSocialMonitorVisibility);
  if ($('#social-ca-mode')) $('#social-ca-mode').addEventListener('change',updateSocialMonitorVisibility);
  if ($('#ai-provider')) $('#ai-provider').addEventListener('change',event=>storage.set('ai-provider',event.target.value));
}

function handleAction(event) {
  const action=event.currentTarget.dataset.action;
  if (action==='toggle-play') { if(state.page==='radar')loadRadarStationImage(true);else loadRadar(true); }
  if (action==='toggle-model-play') toggleModelPlayback(event.currentTarget);
  if (action==='refresh-radar') state.page==='radar'?loadRadarStations(true):loadRadar(true);
  if (action==='refresh-global-radar') { if(state.page==='radar')loadGlobalRadarMosaic(state.globalRadarMap,false,true);else loadGlobalRadarMosaic(state.map,true,true); }
  if (action==='refresh-alerts') loadAlerts(true);
  if (action==='refresh-reports') loadSpotterReports(true);
  if (action==='refresh-status') loadServiceStatus(true);
  if (action==='refresh-outlooks') { state.outlooks=[];if(state.page==='outlooks'){loadOutlookMap();loadCanadaOutlookMap(true);}else renderPage(); }
  if (action==='refresh-satellite') updateSatelliteImage(true);
  if (action==='notifications') openNotificationModal();
  if (action==='add-camera') { $('#camera-form')?.scrollIntoView({behavior:'smooth',block:'center'}); $('#camera-form input[name="name"]')?.focus(); }
  if (action==='save-camera-preferences') saveCameraPreferences();
  if (action==='search-cameras') discoverCameras(true);
  if (action==='draft-caption') draftCaption();
  if (action==='copy-caption') copyCaption();
  if (action==='copy-social-package') copySocialPackage();
  if (action==='save-social-preferences') saveSocialPreferences();
  if (action==='save-social-profile') saveSocialProfile();
  if (action==='stop-background-music') { storage.set('music-player-active',false);syncBackgroundMusicPlayer();toast('Background music stopped. Your saved link is still available on the Music page.'); }
  if (action==='resume-background-music') { storage.set('music-player-active',true);syncBackgroundMusicPlayer();toast('Background player opened. Press play in the music controls to resume.'); }
  if (action==='install-app') installAtmos();
  if (action==='connect-social') toast('Social account publishing needs a server-side OAuth connection.');
  if (action==='lightning-view') openLightningViewer();
  if (action==='save-notifications') saveNotificationSettings();
  if (action==='focus-search') { $('#location-input').focus(); $('#location-input').select(); }
}

function radarDistanceKm(aLat,aLon,bLat,bLon) {
  const rad=value=>value*Math.PI/180;
  const dLat=rad(bLat-aLat),dLon=rad(bLon-aLon);
  const q=Math.sin(dLat/2)**2+Math.cos(rad(aLat))*Math.cos(rad(bLat))*Math.sin(dLon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));
}

async function loadRadarStations(showToast=false) {
  const select=$('#radar-site-select');
  if(!select)return;
  const region=radarCoverageRegion();
  const source=RADAR_REGIONS[region]||RADAR_REGIONS.GLOBAL;
  const regionalFeed=$('#radar-regional-feed');
  setText('#radar-region-label',`${source.name} coverage`);
  const official=$('#radar-official-link');if(official){official.href=source.url;official.textContent=`${source.source} ↗`;}
  const products=$('#radar-products-link');if(products)products.href=source.url;
  if(region!=='US'){
    state.radarStations=[];state.radarStationId='';select.innerHTML='<option value="">Individual NEXRAD tiles are U.S.-only</option>';select.disabled=true;
    setText('#radar-site-name',`${source.name} · ${state.place.name}`);setText('#radar-status','No individual-site tile feed for this region');
    if(regionalFeed){regionalFeed.hidden=false;regionalFeed.innerHTML=`<div><strong>${esc(source.source)}</strong><span>Atmos will not substitute a regional radar composite. Open the official ${esc(source.name)} site for radar coverage.</span></div><a class="btn btn-primary" href="${esc(source.url)}" target="_blank" rel="noreferrer">Open official radar ↗</a>`;}
    if(state.radarProductLayer&&state.radarProductMap){state.radarProductMap.removeLayer(state.radarProductLayer);state.radarProductLayer=null;}
    if(state.mapLayer&&state.map){state.map.removeLayer(state.mapLayer);state.mapLayer=null;}
    updateLightningOverlay(state.radarProductMap,region);
    const error=$('#radar-image-error');if(error){error.hidden=false;error.textContent=`Individual-site NEXRAD radar tiles are not available for ${source.name}. No mosaic is used here.`;}
    setText('#map-status',`Individual-site radar tiles are not available for ${source.name}; no mosaic loaded.`);
    if(showToast)toast(`${source.name}: the dashboard will not load a radar mosaic.`);
    return;
  }
  select.disabled=false;if(regionalFeed)regionalFeed.hidden=true;
  setText('#radar-source-title','NWS INDIVIDUAL RADAR SITES');
  try {
    const sites=await fetchRadarStationList();
    if(!sites.length)throw new Error('No WSR-88D sites found');
    state.radarStations=sites.map(site=>({...site,distance:radarDistanceKm(state.place.latitude,state.place.longitude,site.lat,site.lon)})).sort((a,b)=>a.distance-b.distance);
    if(!state.radarStationId||!state.radarStations.some(site=>site.id===state.radarStationId))state.radarStationId=state.radarStations[0].id;
    const selected=state.radarStations.find(site=>site.id===state.radarStationId);
    if(selected&&selected.distance>850){state.radarStationId=state.radarStations[0].id;}
    select.innerHTML=state.radarStations.map(site=>`<option value="${esc(site.id)}" ${state.radarStationId===site.id?'selected':''}>${esc(site.id)} · ${esc(site.name)} · ${Math.round(site.distance)} km</option>`).join('');
    storage.set('radar-station',state.radarStationId);
    updateRadarSiteMap();loadRadarStationImage(true);
    if(showToast)toast(`Loaded ${state.radarStations.length} individual NWS radar sites; nearest is ${state.radarStations[0].id}.`);
  } catch {
    select.innerHTML='<option value="">NWS station list unavailable</option>';
    setText('#radar-site-name','NWS radar station list unavailable');
    setText('#radar-status','Check your connection and refresh.');
    const error=$('#radar-image-error');if(error){error.hidden=false;error.textContent='The official NWS station directory is currently unavailable.';}
    if(showToast)toast('NWS radar stations could not be loaded.');
  }
}

function currentRadarStation() { return state.radarStations.find(site=>site.id===state.radarStationId)||state.radarStations[0]; }

function radarProductSpec(){
  const layer=state.radarLayer||'reflectivity';
  if(layer==='velocity')return {product:'velocity',tilt:0,label:'Base velocity'};
  if(layer==='correlation')return {product:'cc',tilt:0,label:'Correlation coefficient'};
  if(layer.startsWith('tilt-')){
    const tilt=Math.max(0,Math.min(20,Number(layer.split('-')[1]||1)-1));
    const labels={0:'0.5°',1:'1.5°',2:'2.4°',3:'3.4°'};
    return {product:'reflectivity',tilt,label:`Tilt ${tilt+1} · ${labels[tilt]||'site-dependent elevation'}`};
  }
  return {product:'reflectivity',tilt:0,label:'Base reflectivity'};
}

function updateSingleSiteRadarLayer(map,slot,statusSelector,refresh=false){
  if(!map||!window.L)return;
  const previous=state[slot];
  if(previous){map.removeLayer(previous);state[slot]=null;}
  const region=radarCoverageRegion();
  const site=currentRadarStation();
  if(region!=='US'||!site){if(statusSelector)setText(statusSelector,'Single-site radar is not available at this location. No mosaic loaded.');return;}
  const spec=radarProductSpec();
  const cacheKey=refresh?Date.now():Math.floor(Date.now()/120000);
  const url=`https://atmostorm.com/api/v1/nexrad/${encodeURIComponent(site.id)}/${spec.product}/{z}/{x}/{y}.png?tilt=${spec.tilt}&cache=${cacheKey}`;
  let failures=0;
  const layerOptions={tileSize:256,opacity:.86,zIndex:350,maxZoom:18,updateWhenIdle:true,keepBuffer:2,attribution:'Individual radar-site tiles © <a href="https://atmostorm.com/api-docs/endpoints" target="_blank" rel="noreferrer">AtmoStorm</a>'};
  // Only the detailed radar map defines this custom pane; omit the property entirely on the overview.
  if(slot==='radarProductLayer')layerOptions.pane='singleSiteRadar';
  const layer=L.tileLayer(url,layerOptions);
  layer.on('tileerror',()=>{
    failures++;
    if(failures>=3&&statusSelector){
      const status=$(statusSelector);
      if(status)status.innerHTML=`${esc(site.id)} ${esc(spec.label)} tile feed unavailable. No mosaic fallback is used. <a href="https://radar.weather.gov/station/${encodeURIComponent(site.id.toLowerCase())}/standard" target="_blank" rel="noreferrer" style="color:var(--accent)">Open official NWS site ↗</a>`;
      const error=$('#radar-image-error');if(error&&state.page==='radar'){error.hidden=false;error.textContent='Individual radar tiles could not be loaded from the single-site tile provider. The dashboard has not replaced them with a composite.';}
    }
  });
  layer.on('load',()=>{
    if(failures>0){
      if(statusSelector)setText(statusSelector,`${site.id} · ${spec.label} · some tiles unavailable; no mosaic fallback`);
      return;
    }
    if(statusSelector){
      const status=$(statusSelector);
      if(status)status.textContent=`${site.id} · ${spec.label} · latest scan · refresh ${fmtClock()} UTC`;
    }
    const error=$('#radar-image-error');if(error)error.hidden=true;
  });
  layer.addTo(map);state[slot]=layer;
  if(statusSelector)setText(statusSelector,`${site.id} · ${spec.label} · loading individual-site tiles…`);
}

function loadRadarStationImage(refresh=false) {
  const site=currentRadarStation();
  const region=radarCoverageRegion();
  const source=RADAR_REGIONS[region]||RADAR_REGIONS.GLOBAL;
  const stationUrl=site?`https://radar.weather.gov/station/${site.id.toLowerCase()}/standard`:source.url;
  const officialLink=$('#radar-official-link');if(officialLink)officialLink.href=stationUrl;
  const productsLink=$('#radar-products-link');if(productsLink)productsLink.href=stationUrl;
  if(site)setText('#radar-site-name',`${site.id} · ${site.name} · ${Math.round(site.distance||radarDistanceKm(state.place.latitude,state.place.longitude,site.lat,site.lon))} km from ${state.place.name}`);
  else setText('#radar-site-name',`${source.name} · ${state.place.name}`);
  const map=state.radarProductMap;
  if(map){
    if(site&&region==='US')map.setView([site.lat,site.lon],Math.max(7,map.getZoom()),{animate:false});
    updateSingleSiteRadarLayer(map,'radarProductLayer','#radar-status',refresh);
    updateLightningOverlay(map,region);
  }
  if(state.map&&state.page==='overview')updateSingleSiteRadarLayer(state.map,'mapLayer','#map-status',refresh);
  const glm=$('#glm-frame');
  if(glm&&state.lightning&&region==='US'&&refresh){
    const sat=state.place.longitude < -110?'G18':'G19';
    glm.src=`https://www.star.nesdis.noaa.gov/GOES/conus_band.php?band=EXTENT3&length=12&sat=${sat}&refresh=${Date.now()}`;
  }
  setText('#frame-count','SINGLE-SITE TILES');
}

function updateLightningOverlay(map,region){
  if(!map||!window.L)return;
  if(state.lightningMapLayer){map.removeLayer(state.lightningMapLayer);state.lightningMapLayer=null;}
  if(!state.lightning||region!=='CA')return;
  state.lightningMapLayer=L.tileLayer.wms('https://geo.weather.gc.ca/geomet/',{
    layers:'Lightning_2.5km_Density',styles:'',version:'1.3.0',format:'image/png',transparent:true,opacity:.78,
    attribution:'Lightning data © Environment and Climate Change Canada'
  }).addTo(map);
}

function renderMap(kind) {
  if (!window.L) { const node=$('#radar-map'); if(node) node.innerHTML='<div class="no-map">The interactive map library could not load.<br>Check your internet connection or open the radar source.</div>'; return; }
  if (state.map) { state.map.remove(); state.map=null; state.mapLayer=null; state.mapMarkers=[];state.cameraMarkers=[]; }
  const target=$('#radar-map'); if(!target)return;
  state.mapKind=kind;
  const localLocation=Boolean(state.place.country);const map=L.map(target,{zoomControl:true,preferCanvas:true}).setView([state.place.latitude,state.place.longitude],localLocation?(kind==='dashboard'?7:6):2);
  state.map=map;
  map.on('moveend',addAlertMarkers);
  map.createPane('osmBase');
  map.createPane('rainviewerRadar');
  map.getPane('rainviewerRadar').style.zIndex='350';
  const basePane=map.getPane('osmBase');
  basePane.classList.add('osm-base-pane');
  basePane.style.zIndex='200';
  L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{pane:'osmBase',maxZoom:19,attribution:'Tiles © Esri, HERE, Garmin, (c) OpenStreetMap contributors, and the GIS user community'}).addTo(map);
  setTimeout(()=>{if(state.map===map&&map.getContainer().isConnected)map.invalidateSize();},160);
  if(kind==='cameras') {
    getAllCameras().forEach((camera,index)=>addCameraMarker(camera,index));
  } else {
    if(state.place.country)L.circleMarker([state.place.latitude,state.place.longitude],{radius:5,color:'#d1f477',weight:2,fillColor:'#d1f477',fillOpacity:.9}).addTo(map).bindPopup(esc(state.place.name));
    addAlertMarkers();
    if(kind==='radar'&&state.showCameras)toggleCameraMarkers();
    loadRadar();
  }
}

function initMap(kind) { setTimeout(()=>renderMap(kind),30); }

function initGlobalRadarMap(){
  const node=$('#global-radar-map');if(!node)return;
  if(!window.L){node.innerHTML='<div class="no-map">The map library could not load. Open RainViewer directly for radar coverage.</div>';return;}
  const map=L.map(node,{zoomControl:true,preferCanvas:true}).setView([state.place.latitude,state.place.longitude],state.place.country?6:2);
  state.globalRadarMap=map;
  map.createPane('osmBase');map.getPane('osmBase').classList.add('osm-base-pane');map.getPane('osmBase').style.zIndex='200';
  map.createPane('rainviewerRadar');map.getPane('rainviewerRadar').style.zIndex='350';
  L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{pane:'osmBase',maxZoom:19,attribution:'Tiles © Esri and OpenStreetMap contributors'}).addTo(map);
  if(state.place.country)L.circleMarker([state.place.latitude,state.place.longitude],{radius:6,color:'#fff',weight:2,fillColor:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#d1f477',fillOpacity:.95}).addTo(map).bindPopup(esc(state.place.name));
  map.on('moveend',()=>{const label=$('#global-radar-status');if(label)label.textContent=state.place.country?`Map centred near ${state.place.name}. Radar data availability varies by country.`:'World view. Set a location to centre the mosaic on your area.';});
  setTimeout(()=>{if(state.globalRadarMap===map&&map.getContainer().isConnected)map.invalidateSize();},180);
  loadGlobalRadarMosaic(map,false,false);
}

function globalRadarLayerRef(overview){return overview?'mapLayer':'globalRadarLayer';}
function paintGlobalRadarFrame(map,overview,index){
  if(!map||!window.L||!state.globalRadarFrames.length)return;
  index=Math.max(0,Math.min(state.globalRadarFrames.length-1,Number(index)||0));
  state.globalRadarFrameIndex=index;
  const frame=state.globalRadarFrames[index];
  const layerKey=globalRadarLayerRef(overview);
  const prior=overview?state.mapLayer:state.globalRadarLayer;
  if(prior){try{map.removeLayer(prior);}catch{}}
  const tileUrl=`${state.globalRadarHost||'https://tilecache.rainviewer.com'}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
  const layer=L.tileLayer(tileUrl,{pane:'rainviewerRadar',opacity:.76,maxZoom:18,maxNativeZoom:7,updateWhenIdle:true,keepBuffer:2,attribution:'Weather radar data © RainViewer'}).addTo(map);
  if(overview)state.mapLayer=layer;else state.globalRadarLayer=layer;
  const date=new Date(Number(frame.time)*1000);
  const frameLabel=Number.isFinite(date.getTime())?`${date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'})} UTC`:'latest frame';
  const stamp=$('#global-radar-stamp');if(stamp)stamp.textContent=`RADAR FRAME · ${frameLabel}`;
  const status=$('#map-status');if(status&&overview)status.textContent=`RainViewer composite · frame ${frameLabel} · radar coverage varies by location`;
  const globalStatus=$('#global-radar-status');if(globalStatus&&!overview)globalStatus.textContent=`RainViewer composite · frame ${frameLabel} · ${index+1} of ${state.globalRadarFrames.length} recent frames`;
  const frameCount=$('#frame-count');if(frameCount&&overview)frameCount.textContent=frameLabel;
  const select=$('#global-radar-frame');
  if(select){select.innerHTML=state.globalRadarFrames.map((item,i)=>{const t=new Date(Number(item.time)*1000);const label=Number.isFinite(t.getTime())?`${t.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'})} UTC`: `Frame ${i+1}`;return `<option value="${i}" ${i===index?'selected':''}>${i===state.globalRadarFrames.length-1?'Latest · ':''}${label}</option>`;}).join('');}
}

async function loadGlobalRadarMosaic(map=state.map,overview=Boolean(state.map&&state.mapKind==='dashboard'),showToast=false){
  if(!map||!window.L)return;
  const status=overview?$('#map-status'):$('#global-radar-status');if(status)status.textContent='Connecting to global radar mosaic…';
  try{
    const data=await fetchJson('/api/radar-mosaic',{cache:'no-store'});
    const frames=(data?.radar?.past||[]).filter(frame=>frame?.path&&Number.isFinite(Number(frame.time)));
    if(!frames.length||!data.host)throw new Error('No recent radar frames were returned.');
    state.globalRadarHost=data.host;state.globalRadarFrames=frames;
    const index=state.globalRadarFrameIndex>=0&&state.globalRadarFrameIndex<frames.length?state.globalRadarFrameIndex:frames.length-1;
    state.globalRadarLoadedAt=new Date().toISOString();
    paintGlobalRadarFrame(map,overview,index);
    if(showToast)toast('Global radar mosaic refreshed.');
  }catch{
    if(status)status.innerHTML='Global radar mosaic is temporarily unavailable. <a href="https://www.rainviewer.com/weather-radar-map-live.html" target="_blank" rel="noreferrer" style="color:var(--accent)">Open RainViewer ↗</a>';
    if(showToast)toast('Global radar source is temporarily unavailable.');
  }
}

function addAlertMarkers() {
  if(!state.map || !window.L) return;
  state.mapMarkers.forEach(marker=>marker.remove());state.mapMarkers=[];
  const viewBounds=state.map.getBounds();
  state.alerts.forEach(alert=>{
    const coords=alert.geometry?.coordinates;
    if(!coords)return;
    const geometry=alert.geometry;
    try {
      const layer=L.geoJSON(geometry,{style:{color:'#fa766f',weight:1.5,fillColor:'#fa766f',fillOpacity:.12}}).bindPopup(`<strong>${esc(alert.properties?.event)}</strong><br>${esc(shortArea(alert.properties?.areaDesc))}`);
      const bounds=layer.getBounds();
      if(bounds.isValid()&&bounds.intersects(viewBounds)){layer.addTo(state.map);state.mapMarkers.push(layer);}
    } catch {}
  });
}

async function loadRadar(showToast=false) {
  if(!state.map||state.mapKind==='cameras')return;
  await loadGlobalRadarMosaic(state.map,true,showToast);
}

function refreshRadarLayer(){
  if(state.page==='radar')loadRadarStationImage(true);
  else if(state.map)loadRadar(true);
}

function updateMapStatus(){
  const status=$('#map-status');if(!status)return;
  const site=currentRadarStation();
  if(radarCoverageRegion()!=='US')status.textContent='No individual-site NEXRAD layer for this region. No mosaic loaded.';
  else if(site){const spec=radarProductSpec();status.textContent=`${site.id} · ${spec.label} · refreshing individual-site tiles`;} 
  else status.textContent='Finding the nearest individual radar site…';
}

function setRadarLayer(layer) {
  const allowed=['reflectivity','velocity','correlation','tilt-1','tilt-2','tilt-3','tilt-4'];
  if(!allowed.includes(layer))layer='reflectivity';
  state.radarLayer=layer;
  $$('[data-radar-layer]').forEach(button=>button.classList.toggle('selected',button.dataset.radarLayer===layer));
  if($('#overview-layer'))$('#overview-layer').value=layer;
  if(state.page==='radar')loadRadarStationImage(true);
  else if(state.page==='overview')loadRadar(true);
}

function openLightningViewer() {
  const url=`https://map.blitzortung.org/index.php?interactive=1&NavigationControl=1&FullScreenControl=1&ScaleControl=1&Cookies=0&InfoDiv=1&MenuButtonDiv=1&Advertisment=0#6/${state.place.latitude.toFixed(3)}/${state.place.longitude.toFixed(3)}`;
  showModal(`<div class="modal-head"><h2 id="modal-title">Lightning detector · LightningMaps / Blitzortung</h2><button class="modal-close" data-close-modal aria-label="Close">×</button></div><div class="modal-body" style="padding:0"><iframe title="Community lightning detection map" src="${url}" style="width:100%;height:min(70vh,560px);border:0;background:#081018" loading="lazy"></iframe><p class="source-note" style="padding:0 15px 14px">Community detection only, with region-dependent coverage. Not an official warning service. <a href="https://www.lightningmaps.org/" target="_blank" rel="noreferrer" style="color:var(--accent)">Open LightningMaps.org ↗</a></p></div>`);
}

function getResolvedWarningRegion(){
  if(state.warningRegion!=='auto')return state.warningRegion;
  const c=String(state.place.country||'').toUpperCase();
  if(['US','CA','MX','GT','BZ','SV','HN','NI','CR','PA','CU','JM','HT','DO','BS','BB','TT','PR'].includes(c))return 'na';
  if(SLUGS[c])return 'eu';
  if(['AU','NZ','PG','FJ','SB','VU','WS','TO'].includes(c))return 'oceania';
  if(['JP','IN','CN','KR','KP','PH','ID','MY','SG','TH','VN','KH','LA','MM','BD','PK','LK','NP','BT','MN','TW','HK','MO','BN','TL','IR','IQ','SA','AE','QA','OM','YE','JO','LB','IL','TR','AF','KZ','UZ','TM','KG','TJ'].includes(c))return 'asia';
  return 'global';
}
function gdacsToAlert(feature){
  const p=gdacsProperties(feature),level=gdacsLevel(feature),point=gdacsCoordinates(feature);
  return {type:'Feature',id:`GDACS:${gdacsId(feature)}`,geometry:feature.geometry||null,properties:{country:'GLOBAL',countryCode:'GLOBAL',source:'GDACS',event:`${gdacsType(feature)} · ${gdacsName(feature)}`,headline:gdacsName(feature),description:p.description||p.htmldescription||'Global hazard alert from GDACS.',areaDesc:gdacsCountry(feature),severity:level==='red'?'Extreme':'Severe',certainty:'GDACS global hazard bulletin',sent:p.fromdate||p.fromDate||p.datemodified||p.date_modified||'',web:gdacsLink(feature),coordinates:point}};
}
function featureRegionMatch(feature,region){
  const p=gdacsProperties(feature),point=gdacsCoordinates(feature);
  if(!point)return false;const [lat,lon]=point;
  if(region==='asia')return lat>=-12&&lat<=82&&lon>=25&&lon<=180;
  if(region==='oceania')return lat>=-55&&lat<=20&&((lon>=105&&lon<=180)||(lon>=-180&&lon<=-120));
  if(region==='eu')return lat>=30&&lat<=75&&lon>=-30&&lon<=65;
  if(region==='na')return lat>=5&&lat<=85&&lon>=-180&&lon<=-45;
  return true;
}
async function loadAlerts(showToast=false) {
  const region=getResolvedWarningRegion();
  state.alertFeedStatus={primary:{status:'loading',count:0}};
  const loadingStatus=$('#alert-source-status');if(loadingStatus)loadingStatus.innerHTML=alertSourceStatusMarkup();
  try{
    if(region==='na'){
      const data=await fetchJson('/api/north-america-alerts',{headers:{Accept:'application/geo+json'}});
      state.alerts=data.features||[];
      state.alertFeedStatus={...(data.sources||{}),updatedAt:data.updatedAt||new Date().toISOString()};
    }else if(region==='eu'){
      const selected=String(state.place.country||'').toUpperCase();
      const country=SLUGS[selected]?selected:'GB';
      const data=await fetchJson(`/api/europe-alerts?country=${encodeURIComponent(country)}`,{cache:'no-store'});
      state.alerts=(data.features||[]).map(f=>({...f,properties:{...f.properties,country:'REGIONAL',source:data.source||'MeteoAlarm'}}));
      state.alertFeedStatus={europe:{status:data.status||'unavailable',count:state.alerts.length,name:`MeteoAlarm · ${country}`},updatedAt:data.updatedAt||new Date().toISOString()};
      if(!SLUGS[selected])state.alertFeedStatus.europe.note='Selected place is outside Europe; showing the United Kingdom feed by default. Search for a European location to change it.';
    }else if(region==='oceania'&&String(state.place.country||'').toUpperCase()==='AU'){
      const data=await fetchJson(`/api/australia-alerts?region=${encodeURIComponent(state.place.region||'NSW')}`,{cache:'no-store'});
      state.alerts=data.features||[];state.alertFeedStatus={oceania:{status:data.status||'unavailable',count:state.alerts.length,name:`Bureau of Meteorology · ${data.region||''}`},updatedAt:data.updatedAt||new Date().toISOString()};
    }else{
      await loadGdacs();
      const events=(state.gdacsEvents||[]).filter(feature=>['red','orange'].includes(gdacsLevel(feature))&&(region==='global'||featureRegionMatch(feature,region)));
      state.alerts=events.map(gdacsToAlert);
      const title=region==='asia'?'Asia region · GDACS major hazards':region==='oceania'?'Oceania region · GDACS major hazards':'Global hazards · GDACS';
      state.alertFeedStatus={gdacs:{status:state.gdacsError?'unavailable':'live',count:state.alerts.length,name:title},national:{status:'not-covered',count:0,name:'National feeds vary by country'},updatedAt:new Date().toISOString()};
    }
    detectNewAlerts(state.alerts);renderAlertWidgets();
    if(showToast)toast(`Loaded ${state.alerts.length} alerts from ${alertRegionLabel()}.`);
  }catch(error){
    state.alerts=[];
    state.alertFeedStatus={primary:{status:'unavailable',count:0,name:alertRegionLabel()},updatedAt:new Date().toISOString(),error:'The selected provider feed did not respond.'};
    renderAlertWidgets();if(showToast)toast('The selected warning feed is temporarily unavailable.');
  }
}

function renderAlertWidgets() {
  const summary=$('#alert-summary');if(summary)summary.innerHTML=alertSummaryMarkup();
  const mini=$('#mini-alert-list');if(mini)mini.innerHTML=miniAlertsMarkup();
  setText('#nav-alert-count',String(state.alerts.length));
  const list=$('#alerts-list');if(list)list.innerHTML=alertsListMarkup(filteredAlerts());
  const heading=$('#alert-list-heading');if(heading)heading.textContent=`${filteredAlerts().length} ACTIVE ALERT${filteredAlerts().length===1?'':'S'} · ${alertRegionLabel().toUpperCase()}`;
  const sources=$('#alert-source-status');if(sources)sources.innerHTML=alertSourceStatusMarkup();
  addAlertMarkers();
}

function gdacsProperties(feature) { return feature?.properties || feature || {}; }
function gdacsLevel(feature) { return String(gdacsProperties(feature).alertlevel || gdacsProperties(feature).alert_level || 'Green').toLowerCase(); }
function gdacsType(feature) {
  const properties=gdacsProperties(feature);
  const types={TC:'Tropical cyclone',FL:'Flood',EQ:'Earthquake',VO:'Volcano',WF:'Wildfire',DR:'Drought'};
  const code=properties.eventtype||properties.event_type||'';
  return properties.eventtypename||properties.event_type_name||types[code]||'Global hazard';
}
function gdacsName(feature) {
  const p=gdacsProperties(feature);
  return p.name||p.eventname||p.event_name||`${gdacsType(feature)} alert`;
}
function gdacsId(feature) {
  const p=gdacsProperties(feature);
  return String(p.eventid||p.event_id||feature.id||`${gdacsType(feature)}-${gdacsName(feature)}`)+`-${p.episodeid||p.episode_id||''}`;
}
function gdacsCountry(feature) { const p=gdacsProperties(feature);return p.country||p.affected_country_names||p.countryname||'International'; }
function gdacsLink(feature) {
  const p=gdacsProperties(feature);
  return p.url?.report||p.url?.details||p.reporturl||p.reportUrl||(typeof p.url==='string'?p.url:'https://www.gdacs.org/');
}
function gdacsRowsMarkup(features) {
  if(!state.gdacsLoaded)return `<div class="empty-state" style="padding:13px">Loading global hazard alerts…</div>`;
  if(state.gdacsError)return `<div class="empty-state" style="padding:13px">Global hazard feed is temporarily unavailable.<br><span class="tiny">Check GDACS directly for current events.</span></div>`;
  const events=features.filter(feature=>['red','orange'].includes(gdacsLevel(feature))).slice(0,7);
  if(!events.length)return `<div class="empty-state" style="padding:13px">No Red or Orange GDACS alerts in the current event feed.<br><span class="tiny">This feed tracks major global disasters; local warnings still come from national agencies.</span></div>`;
  return events.map(feature=>{
    const level=gdacsLevel(feature);const p=gdacsProperties(feature);const when=p.fromdate||p.fromDate||p.datemodified||p.date_modified;
    return `<a class="mini-alert" href="${esc(gdacsLink(feature))}" target="_blank" rel="noreferrer"><span class="severity-mark ${level==='orange'?'warning':''}"></span><span class="mini-alert-text"><strong>${esc(gdacsName(feature))}</strong><small>${esc(gdacsType(feature))} · ${esc(gdacsCountry(feature))}</small></span><span class="mini-alert-time">${level.toUpperCase()}</span></a>`;
  }).join('');
}

function renderGlobalHazardsCard() {
  const aside=$('.alerts-layout aside');if(!aside)return;
  const card=document.createElement('section');card.className='card';
  card.innerHTML=`<div class="card-head"><h2 class="card-title">WORLDWIDE HAZARD WATCH</h2><span class="card-note">GDACS</span></div><div id="gdacs-event-list">${gdacsRowsMarkup(state.gdacsEvents)}</div><div class="outlook-source"><span>UN / European Commission disaster alerts</span><a href="https://www.gdacs.org/" target="_blank" rel="noreferrer">Source ↗</a></div>`;
  aside.append(card);
}

function gdacsCoordinates(feature) {
  const coordinates=feature?.geometry?.coordinates;
  if(!coordinates)return null;
  if(typeof coordinates[0]==='number'&&typeof coordinates[1]==='number')return [coordinates[1],coordinates[0]];
  const findPoint=value=>{
    if(!Array.isArray(value))return null;
    if(typeof value[0]==='number'&&typeof value[1]==='number')return [value[1],value[0]];
    for(const child of value){const point=findPoint(child);if(point)return point;}
    return null;
  };
  return findPoint(coordinates);
}

function distanceKm(aLat,aLon,bLat,bLon) {
  const radians=value=>value*Math.PI/180;
  const dLat=radians(bLat-aLat),dLon=radians(bLon-aLon);
  const value=Math.sin(dLat/2)**2+Math.cos(radians(aLat))*Math.cos(radians(bLat))*Math.sin(dLon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(value),Math.sqrt(1-value));
}

function detectNewGdacsEvents(events) {
  const prefs=storage.get('notifications',{enabled:false,scope:'nearby',warnings:true});
  const known=storage.get('known-gdacs-events',[]);
  const fresh=events.filter(event=>!known.includes(gdacsId(event))&&['red','orange'].includes(gdacsLevel(event)));
  if(prefs.enabled&&prefs.warnings&&known.length)fresh.filter(event=>alertMatchesNotificationPreferences(gdacsToAlert(event))).forEach(event=>{
    if(prefs.scope==='worldwide')notifyUser(`Global ${gdacsType(event)} · ${gdacsName(event)} · ${gdacsCountry(event)}`);
    else {
      const point=gdacsCoordinates(event);
      if(point&&distanceKm(state.place.latitude,state.place.longitude,point[0],point[1])<=300)notifyUser(`Nearby global ${gdacsType(event)} · ${gdacsName(event)}`);
    }
  });
  storage.set('known-gdacs-events',events.map(gdacsId).slice(0,250));
}

async function loadGdacs() {
  let data;
  try { data=await fetchJson('/api/gdacs-events'); }
  catch {
    try { data=await fetchJson('https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP'); }
    catch { state.gdacsError=true;const target=$('#gdacs-event-list');if(target)target.innerHTML=gdacsRowsMarkup(state.gdacsEvents);return; }
  }
  state.gdacsEvents=Array.isArray(data)?data:(data.features||data.events||[]);
  state.gdacsLoaded=true;state.gdacsError=false;
  detectNewGdacsEvents(state.gdacsEvents);
  const target=$('#gdacs-event-list');if(target)target.innerHTML=gdacsRowsMarkup(state.gdacsEvents);
}

function alertMatchesNotificationPreferences(alert){
  const prefs=storage.get('notifications',{enabled:false,warnings:true,tornado:true,severe:true,flood:true,other:true});
  const event=String(alert.properties?.event||alert.properties?.headline||'').toLowerCase();
  if(/tornado/.test(event))return prefs.tornado!==false;
  if(/severe thunderstorm|thunderstorm warning|severe weather warning/.test(event))return prefs.severe!==false;
  if(/flood|flash flood|coastal inundation/.test(event))return prefs.flood!==false;
  return prefs.other!==false;
}

function detectNewAlerts(alerts) {
  const prefs=storage.get('notifications',{enabled:false,scope:'nearby',warnings:true,spc:true});
  const seeded=storage.get('north-america-alerts-seeded',false);
  const known=new Set(storage.get('known-alerts',[]));
  const fresh=seeded?alerts.filter(alert=>alert.id&&!known.has(alert.id)):[ ];
  const relevant=fresh.filter(alert=>(prefs.scope==='worldwide'||alertAffectsSelectedPlace(alert))&&alertMatchesNotificationPreferences(alert));
  if(seeded&&prefs.enabled&&prefs.warnings)relevant.slice(0,6).forEach(alert=>notifyUser(`${alert.properties?.event||'New weather alert'} · ${shortArea(alert.properties?.areaDesc)}`));
  const socialAlert=fresh.find(alert=>/warning/i.test(alert.properties?.event||'')&&socialMonitorMatchesAlert(alert));
  if(seeded&&socialAlert&&storage.get('social-enabled',false))createAlertDraft(socialAlert);
  storage.set('known-alerts',alerts.map(alert=>alert.id).filter(Boolean).slice(0,3000));
  storage.set('north-america-alerts-seeded',true);
}

function pointInRing(longitude,latitude,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [xi,yi]=ring[i]||[],[xj,yj]=ring[j]||[];
    if(((yi>latitude)!==(yj>latitude))&&(longitude<(xj-xi)*(latitude-yi)/(yj-yi||Number.EPSILON)+xi))inside=!inside;
  }
  return inside;
}

function geometryContainsPoint(geometry,longitude,latitude){
  if(!geometry)return false;
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];
  return polygons.some(polygon=>Array.isArray(polygon?.[0])&&pointInRing(longitude,latitude,polygon[0])&&!polygon.slice(1).some(ring=>pointInRing(longitude,latitude,ring)));
}

function alertAffectsSelectedPlace(alert){
  if(geometryContainsPoint(alert.geometry,state.place.longitude,state.place.latitude))return true;
  const alertCountry=String(alert.properties?.countryCode||'').toUpperCase();if(alertCountry&&alertCountry===String(state.place.country||'').toUpperCase())return true;
  const country=String(state.place.country||'').toUpperCase();
  const region=String(state.place.region||'').split(',')[0].trim().toLowerCase();
  const code=(country==='CA'?CANADA_REGIONS:US_STATES).find(([,name])=>name.toLowerCase()===region)?.[0];
  return Boolean(code&&alertMonitorRegions(alert).includes(code));
}

async function pollNotificationFeed() {
  return loadAlerts();
}

async function loadWeather() {
  if(!state.place.country){state.weather=null;const target=$('#weather-current');if(target)target.innerHTML=weatherMarkup();return;}
  try {
    const params=new URLSearchParams({latitude:state.place.latitude,longitude:state.place.longitude,current:'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m',timezone:'auto'});
    state.weather=await fetchJson(`${API.forecast}?${params}`);
    const target=$('#weather-current');if(target)target.innerHTML=weatherMarkup();
  } catch { const target=$('#weather-current');if(target)target.querySelector('.weather-condition').textContent='Weather feed unavailable'; }
}

function modelEndpoint() {
  if(state.model==='ECMWF') return `${API.ecmwf}`;
  const modelName={HRRR:'hrrr_conus',NAM:'nam_conus',NBM:'nbm_conus'}[state.model];
  return `${API.gfs}${modelName?`?models=${modelName}`:''}`;
}

function modelCoordinates() {
  const step=.5;
  const lonStep=step/Math.max(.25,Math.cos(state.place.latitude*Math.PI/180));
  const points=[];
  for(let row=-3;row<=3;row++)for(let col=-3;col<=3;col++)points.push({latitude:Math.max(-85,Math.min(85,state.place.latitude+row*step)),longitude:Math.max(-180,Math.min(180,state.place.longitude+col*lonStep))});
  return points;
}

function modelCenterData(){return state.modelGridData[Math.floor(state.modelGridData.length/2)]||state.modelData;}

function initModelMap() {
  const node=$('#model-map');if(!node)return;
  if(!window.L){node.innerHTML='<div class="no-map">The forecast map library could not load.</div>';return;}
  const map=L.map(node,{zoomControl:true,preferCanvas:true}).setView([state.place.latitude,state.place.longitude],state.place.country?6.5:2);
  state.modelMap=map;
  L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri, HERE, Garmin, OpenStreetMap contributors, and the GIS user community'}).addTo(map);
  map.on('click',event=>loadModelPointForecast(event.latlng.lat,event.latlng.lng));
  setTimeout(()=>{if(state.modelMap===map&&map.getContainer().isConnected)map.invalidateSize();},150);
}

function modelUnit() { return state.modelVariable==='temperature_2m'?'°C':state.modelVariable==='precipitation'?'mm':'km/h'; }
function modelValue(data,index) { const value=data?.hourly?.[state.modelVariable]?.[index];return value===null||value===undefined||!Number.isFinite(Number(value))?null:Number(value); }

function modelCellColor(value,min,max) {
  const span=Math.max(.001,max-min);
  const ratio=Math.max(0,Math.min(1,(value-min)/span));
  if(state.modelVariable==='precipitation')return {color:`hsl(204 ${Math.round(78-ratio*12)}% ${Math.round(80-ratio*42)}%)`,opacity:value<=0 ? .08 : .32+ratio*.48};
  if(state.modelVariable==='wind_speed_10m')return {color:`hsl(${Math.round(190-ratio*160)} 78% ${Math.round(57-ratio*8)}%)`,opacity:.5};
  return {color:`hsl(${Math.round(220-ratio*215)} 78% ${Math.round(62-ratio*8)}%)`,opacity:.52};
}

function modelHeatRgb(value,min,max){
  const stops=state.modelVariable==='precipitation'?[[35,117,206],[38,190,204],[90,205,130],[246,218,78],[244,123,68]]:state.modelVariable==='wind_speed_10m'?[[51,124,214],[54,192,199],[143,197,98],[241,166,72],[206,74,104]]:[[57,103,207],[57,178,202],[94,196,130],[244,188,69],[223,67,70]];
  const ratio=Math.max(0,Math.min(.999,(value-min)/Math.max(.001,max-min)))*(stops.length-1),index=Math.floor(ratio),mix=ratio-index;
  return stops[index].map((channel,i)=>Math.round(channel+(stops[index+1][i]-channel)*mix));
}

function drawModelField(coords,values,min,max){
  const map=state.modelMap;if(!map||!coords.length)return;
  const width=150,height=150,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d'),image=context.createImageData(width,height),latMin=Math.min(...coords.map(p=>p.latitude)),latMax=Math.max(...coords.map(p=>p.latitude)),lonMin=Math.min(...coords.map(p=>p.longitude)),lonMax=Math.max(...coords.map(p=>p.longitude));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const lat=latMax-(y/(height-1))*(latMax-latMin),lon=lonMin+(x/(width-1))*(lonMax-lonMin);let weighted=0,total=0;
    for(let i=0;i<coords.length;i++){const value=values[i];if(value===null)continue;const dx=(lon-coords[i].longitude)*Math.cos(lat*Math.PI/180),dy=lat-coords[i].latitude,d2=dx*dx+dy*dy;if(d2<.000001){weighted=value;total=1e12;break;}const weight=1/(d2*d2);weighted+=value*weight;total+=weight;}
    if(!total)continue;const value=weighted/total;if(state.modelVariable==='precipitation'&&value<.08)continue;
    const offset=(y*width+x)*4,[r,g,b]=modelHeatRgb(value,min,max);image.data[offset]=r;image.data[offset+1]=g;image.data[offset+2]=b;image.data[offset+3]=state.modelVariable==='precipitation'?Math.round(Math.min(215,95+value*38)):142;
  }
  context.putImageData(image,0,0);
  if(state.modelFieldLayer)map.removeLayer(state.modelFieldLayer);
  state.modelFieldLayer=L.imageOverlay(canvas.toDataURL('image/png'),[[latMin,lonMin],[latMax,lonMax]],{opacity:.78,interactive:false}).addTo(map);
}

function modelInspectorMarkup(data,index){
  const hourly=data?.hourly||{},time=hourly.time?.[index]||'';
  const rows=[['Temperature',hourly.temperature_2m?.[index],'°C'],['Precipitation',hourly.precipitation?.[index],'mm'],['Wind',hourly.wind_speed_10m?.[index],'km/h'],['Humidity',hourly.relative_humidity_2m?.[index],'%']];
  return `<div class="model-inspector-time">${time?esc(modelLocalTime(time,true))+' UTC':'Forecast point'}</div>${rows.map(([label,value,unit])=>`<div class="model-reading"><span>${label}</span><strong>${value===null||value===undefined||!Number.isFinite(Number(value))?'—':`${Number(value).toFixed(label==='Humidity'?0:1)} ${unit}`}</strong></div>`).join('')}`;
}

async function loadModelPointForecast(latitude,longitude){
  state.modelSelectedPoint={latitude,longitude,label:'Map point'};state.modelSelectedData=null;
  if(state.modelPointMarker)state.modelPointMarker.remove();
  const accent=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#d1f477';
  state.modelPointMarker=L.circleMarker([latitude,longitude],{radius:8,color:'#fff',weight:2,fillColor:accent,fillOpacity:.95}).addTo(state.modelMap);
  setText('#model-point-label',`${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);setText('#model-point-inspector','Loading point forecast…');
  const params=new URLSearchParams({latitude:latitude.toFixed(4),longitude:longitude.toFixed(4),current:'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',hourly:'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m',forecast_days:'7',timezone:'UTC',wind_speed_unit:'kmh'});
  const endpoint=modelEndpoint(),url=`${endpoint}${endpoint.includes('?')?'&':'?'}${params}`;
  try{const data=await fetchJson(url);if(state.page!=='models')return;state.modelSelectedData=data;const display=state.modelSelectedData;const html=modelInspectorMarkup(display,state.modelFrame);const target=$('#model-point-inspector');if(target)target.innerHTML=html;setText('#model-map-status',`${state.model} point forecast · ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);}
  catch{setText('#model-point-inspector','Point forecast unavailable for this location and model.');}
}

function drawModelGrid() {
  const map=state.modelMap;if(!map||!state.modelGridData.length)return;
  state.modelCellLayers.forEach(layer=>layer.remove());state.modelCellLayers=[];
  const coords=state.modelCoordinates||modelCoordinates();
  const values=state.modelGridData.map((item,index)=>modelValue(item,state.modelFrame));
  const allValues=values.filter(value=>value!==null);
  if(!allValues.length){setText('#model-map-status',`${state.model} has no ${state.modelVariable.replaceAll('_',' ')} field for this time.`);return;}
  const min=Math.min(...allValues),max=Math.max(...allValues);
  drawModelField(coords,values,min,max);
  state.modelGridData.forEach((data,index)=>{
    const point=coords[index];if(!point)return;
    const value=modelValue(data,state.modelFrame);if(value===null)return;
    const fill=modelCellColor(value,min,max);
    const layer=L.circleMarker([point.latitude,point.longitude],{radius:2.2,color:fill.color,weight:1,fillColor:fill.color,fillOpacity:.85,opacity:.7}).addTo(map);
    const time=data.hourly?.time?.[state.modelFrame]||'';
    layer.bindTooltip(`<strong>${esc(state.modelVariable.replaceAll('_',' '))}</strong><br>${value.toFixed(1)} ${modelUnit()}${time?` · ${esc(modelLocalTime(time,true))}`:''}`,{sticky:true});
    state.modelCellLayers.push(layer);
  });
  const center=modelCenterData();
  const time=center?.hourly?.time?.[state.modelFrame]||'';
  setText('#model-time-label',time?`${modelLocalTime(time,true)} UTC`:'—');
  setText('#model-frame-count',`${state.modelFrame+1} / ${Math.min(state.modelHorizon,center?.hourly?.time?.length||0)} H`);
  setText('#model-map-status',`${state.model} · ${state.modelVariable.replaceAll('_',' ')} · ${allValues.length} forecast samples`);
  setText('#model-legend-label',`${Math.min(...allValues).toFixed(1)} ${modelUnit()} — ${Math.max(...allValues).toFixed(1)} ${modelUnit()}`);
  setText('#model-variable-label',`${state.modelVariable.replaceAll('_',' ')} · ${modelUnit()}`);
  if(!state.modelSelectedData)state.modelSelectedData=center;
  const selected=state.modelSelectedData||center,inspector=$('#model-point-inspector');if(inspector)inspector.innerHTML=modelInspectorMarkup(selected,state.modelFrame);
  setText('#model-point-label',state.modelSelectedPoint?.label==='Map point'?`${state.modelSelectedPoint.latitude.toFixed(2)}, ${state.modelSelectedPoint.longitude.toFixed(2)}`:state.place.name);
  if(state.modelSelectedPoint&&state.modelPointMarker)state.modelPointMarker.setLatLng([state.modelSelectedPoint.latitude,state.modelSelectedPoint.longitude]);
  const slider=$('#model-timeline');if(slider)slider.max=String(Math.max(0,Math.min(state.modelHorizon,center?.hourly?.time?.length||1)-1));
}

function setModelFrame(index) {
  const center=modelCenterData();
  const max=Math.max(0,Math.min(state.modelHorizon,center?.hourly?.time?.length||1)-1);
  state.modelFrame=Math.max(0,Math.min(max,index));
  const slider=$('#model-timeline');if(slider)slider.value=String(state.modelFrame);
  drawModelGrid();
}

function toggleModelPlayback(button) {
  if(state.modelPlaybackTimer){clearInterval(state.modelPlaybackTimer);state.modelPlaybackTimer=null;button.textContent='▶';button.setAttribute('aria-label','Play forecast');return;}
  button.textContent='Ⅱ';button.setAttribute('aria-label','Pause forecast');
  state.modelPlaybackTimer=setInterval(()=>{
    const max=Number($('#model-timeline')?.max||0);
    setModelFrame(state.modelFrame>=max?0:state.modelFrame+1);
  },700);
}

async function loadModelData() {
  if(!state.place.country){state.modelData=null;state.modelGridData=[];if(state.page==='models'){setText('#model-map-status','Choose a location to load local forecast guidance, or click a point on the map to inspect it.');const table=$('#hourly-table-wrap');if(table)table.innerHTML='<div class="empty-state">Choose a location for the hourly forecast table.</div>';const inspector=$('#model-point-inspector');if(inspector)inspector.innerHTML='<div class="empty-state">No selected location yet.</div>';}return;}
  const coordinates=modelCoordinates();state.modelCoordinates=coordinates;
  const params=new URLSearchParams({current:'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',hourly:'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m',forecast_days:'7',timezone:'UTC',wind_speed_unit:'kmh'});
  params.set('latitude',coordinates.map(point=>point.latitude.toFixed(3)).join(','));
  params.set('longitude',coordinates.map(point=>point.longitude.toFixed(3)).join(','));
  const endpoint=modelEndpoint();
  const separator=endpoint.includes('?')?'&':'?';
  try {
    const result=await fetchJson(`${endpoint}${separator}${params}`);
    state.modelGridData=Array.isArray(result)?result:[result];
    state.modelData=modelCenterData()||state.modelGridData[0];state.modelSelectedData=state.modelData;state.modelSelectedPoint=null;
    state.modelFrame=0;
    if(state.page==='models') {
      const table=$('#hourly-table-wrap');if(table)table.innerHTML=hourlyTableMarkup(state.modelData);
      setText('#model-name',state.model);setText('#model-data-time',`${fmtClock()} UTC`);setText('#model-updated',`${fmtClock()} UTC`);
      setModelFrame(0);
    }
  } catch {
    if(state.page==='models'){
      setText('#model-map-status',`${state.model} spatial guidance is temporarily unavailable. Try GFS or check the provider.`);
      const table=$('#hourly-table-wrap');if(table)table.innerHTML=`<div class="empty-state">No forecast table available.</div>`;
    }
  }
}

async function loadOutlooks() {
  const image=$('#outlook-categorical');
  if(image) {
    image.onload=()=>{ const wrap=image.closest('.outlook-image-wrap');const loading=wrap?.querySelector('.image-loading');const error=wrap?.querySelector('#outlook-image-error');if(loading)loading.hidden=true;if(error)error.hidden=true;image.hidden=false; };
    image.onerror=()=>{ const wrap=image.closest('.outlook-image-wrap');const loading=wrap?.querySelector('.image-loading');const error=wrap?.querySelector('#outlook-image-error');if(loading)loading.hidden=true;image.hidden=true;if(error)error.hidden=false; };
    image.src=image.dataset.src||'';
  }
  try {
    const response=await fetch('/api/spc-outlook',{cache:'no-store'});
    if(!response.ok)throw new Error('SPC endpoint is unavailable');
    const data=await response.json();
    state.outlookUrls=Object.fromEntries(Object.entries(data.days||{}).map(([day,product])=>[day,product.image||product.url]));
    const product=data.days?.[state.outlookDay];
    const productImage=product?.image||product?.url;
    if(productImage&&image&&!productImage.startsWith('/api/spc-image'))image.src=`${productImage}${productImage.includes('?')?'&':'?'}v=${Date.now()}`;
    if(product?.issued)setText('#outlook-issued',`Issued ${product.issued} UTC · ${product.revision||'latest'}`);
  } catch {
    if(!state.outlookUrls)state.outlookUrls={};
    if(image)image.src=state.outlookDay===1?`https://www.spc.noaa.gov/products/outlook/day1otlk_1300.png?v=${Date.now()}`:`https://www.spc.noaa.gov/products/outlook/day${state.outlookDay}otlk.html`;
  }
}

function updateSatelliteImage(refresh=false) {
  const image=$('#sat-image');if(!image)return;
  const satellite=state.satellite==='east'?'GOES19':'GOES18';
  const band=state.satelliteChannel==='GEOCOLOR'?'GEOCOLOR':state.satelliteChannel;
  const region=state.satelliteChannel;
  image.hidden=false;$('#sat-image-error').hidden=true;
  image.onload=()=>{$('#sat-image-error').hidden=true;image.hidden=false;};
  image.onerror=()=>{$('#sat-image-error').hidden=false;image.hidden=true;};
  image.src=`/api/satellite-image?satellite=${satellite}&channel=${region}${refresh?`&t=${Date.now()}`:''}`;
  const officialBand=state.satelliteChannel==='GEOCOLOR'?'GEOCOLOR':state.satelliteChannel;
  const officialSatellite=state.satellite==='east'?'G19':'G18';
  const sourceLink=$('#satellite-source-link');
  if(sourceLink)sourceLink.href=`https://www.star.nesdis.noaa.gov/GOES/fulldisk_band.php?band=${officialBand}&length=12&sat=${officialSatellite}`;
  setText('#sat-caption',`${state.satellite==='east'?'GOES East · GOES-19':'GOES West · GOES-18'} · Full Disk · ${band} · ${fmtClock()} UTC`);
}

function saveCamera(event) {
  event.preventDefault();
  const form=new FormData(event.currentTarget); const url=String(form.get('url')||'').trim();
  try { const parsed=new URL(url);if(parsed.protocol!=='https:')throw new Error('https'); } catch { toast('Add a valid HTTPS camera URL.'); return; }
  const camera={name:String(form.get('name')).trim(),url,lat:Number(form.get('lat')),lon:Number(form.get('lon')),attribution:'User added feed'};
  if(!camera.name||!Number.isFinite(camera.lat)||!Number.isFinite(camera.lon)||Math.abs(camera.lat)>90||Math.abs(camera.lon)>180){toast('Check the camera name and coordinates.');return;}
  state.cameras.push(camera);storage.set('cameras',state.cameras);renderPage();toast('Camera saved to this browser.');
}

function getAllCameras() {
  const seen=new Set();
  return [...state.cameras,...state.discoveredCameras].filter(camera=>{
    if(!camera?.url||!Number.isFinite(Number(camera.lat))||!Number.isFinite(Number(camera.lon))||seen.has(camera.url))return false;
    seen.add(camera.url);return true;
  });
}

function saveCameraPreferences() {
  state.cameraPreferences={mode:$('#camera-search-mode')?.value||state.cameraPreferences.mode,radiusKm:Number($('#camera-search-radius')?.value||state.cameraPreferences.radiusKm)};
  storage.set('camera-preferences',state.cameraPreferences);
  state.cameraQueryKey='';
  toast('Camera preferences saved on this device.');
  renderPage();
}

function cameraSearchKey(radiusKm) {
  return `${state.place.latitude.toFixed(2)},${state.place.longitude.toFixed(2)}:${radiusKm}`;
}

async function discoverCameras(force=false) {
  const radiusKm=Number($('#camera-search-radius')?.value||state.cameraPreferences.radiusKm||40);
  if(!force&&state.cameraPreferences.mode!=='automatic')return;
  const key=cameraSearchKey(radiusKm);
  if(!force&&state.cameraQueryKey===key)return;
  state.cameraQueryKey=key;
  const status=$('#camera-search-status');if(status)status.textContent=`Searching within about ${radiusKm} km of ${state.place.name}…`;
  const cache=storage.get('camera-discoveries',{key:'',at:0,items:[]});
  if(!force&&cache.key===key&&Date.now()-cache.at<15*60*1000) {
    state.discoveredCameras=cache.items||[];
    if(status)status.textContent=`${state.discoveredCameras.length} nearby public feeds found · cached for 15 minutes.`;
    if(state.page==='cameras')renderPage();
    return;
  }
  const centerLat=Number(state.place.latitude.toFixed(2)),centerLon=Number(state.place.longitude.toFixed(2));
  const latPad=radiusKm/111,lonPad=radiusKm/(111*Math.max(.2,Math.cos(centerLat*Math.PI/180)));
  const bbox=[centerLon-lonPad,centerLat-latPad,centerLon+lonPad,centerLat+latPad].map(value=>value.toFixed(3)).join(',');
  const params=new URLSearchParams({bbox,limit:'100',verificationStatus:'auto_checked'});
  try {
    let data;
    try { data=await fetchJson(`/api/cameras?${params}`); }
    catch { data=await fetchJson(`${API.cameras}?${params}`); }
    state.discoveredCameras=(data.cameras||[]).map(camera=>({
      id:camera.id,name:camera.name||camera.id||'Public road camera',lat:Number(camera.lat),lon:Number(camera.lon),url:camera.feedUrl,
      feedType:camera.feedType||'jpeg_poll',attribution:camera.registry?.attribution||'Datumfeed public registry',
      verificationStatus:camera.verificationStatus,trustScore:camera.stats?.trustScore,
      pollIntervalS:Math.max(30,Number(camera.minPollIntervalS||camera.registry?.minPollIntervalS||60)),autoDiscovered:true
    })).filter(camera=>{
      try { return new URL(camera.url).protocol==='https:'&&Number.isFinite(camera.lat)&&Number.isFinite(camera.lon); }
      catch { return false; }
    }).slice(0,100);
    storage.set('camera-discoveries',{key,at:Date.now(),items:state.discoveredCameras});
    if(state.page==='cameras') { renderPage(); }
    else if(state.page==='radar'&&state.showCameras)renderPage();
    else if(state.mapKind==='cameras')toggleCameraMarkers();
    const label=$('#camera-search-status');if(label)label.textContent=state.discoveredCameras.length?`${state.discoveredCameras.length} verified public feeds found near ${state.place.name}.`:`No participating public camera feeds were found within ${radiusKm} km.`;
  } catch {
    if(status)status.textContent='Camera registry unavailable. You can still search again or add a public feed manually.';
  }
}

function addCameraMarker(camera,index) {
  if(!state.map || !window.L)return;
  const marker=L.marker([camera.lat,camera.lon]).addTo(state.map).bindPopup(`<strong>${esc(camera.name)}</strong><br><small>${esc(camera.attribution||'Public camera feed')}</small><br><button onclick="window.atmosOpenCamera(${index})">Open feed ↗</button>`);
  marker.on('click',()=>{});state.cameraMarkers.push(marker);
}

function openCamera(camera) {
  if(!camera)return;
  const url=new URL(camera.url);
  const isVideo=/\.(mp4|webm|ogg)(\?|$)/i.test(url.pathname+url.search);
  const isImage=camera.feedType==='jpeg_poll'||/\.(jpg|jpeg|png|webp)(\?|$)/i.test(url.pathname+url.search);
  showModal(`<div class="modal-head"><h2 id="modal-title">${esc(camera.name)}</h2><button class="modal-close" data-close-modal aria-label="Close">×</button></div><div class="modal-body camera-popup">${isImage?`<img class="camera-live-image" id="camera-live-image" src="${esc(camera.url)}" alt="Latest image from ${esc(camera.name)}">`:isVideo?`<video class="camera-video" controls autoplay playsinline src="${esc(camera.url)}">This browser cannot play this stream.</video>`:`<iframe class="camera-frame" sandbox="allow-scripts allow-same-origin allow-presentation" referrerpolicy="no-referrer" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen src="${esc(camera.url)}" title="${esc(camera.name)}"></iframe>`}<p class="source-note" style="margin-top:9px">${esc(camera.attribution||'Camera feed provider')} · ${isImage?'latest public still image':''} · <a style="color:var(--accent)" href="${esc(camera.url)}" target="_blank" rel="noreferrer">Open source ↗</a></p></div>`);
  if(isImage&&camera.feedType==='jpeg_poll')state.cameraImageTimer=setInterval(()=>{const node=$('#camera-live-image');if(!node)return;const imageUrl=new URL(camera.url);imageUrl.searchParams.set('_atmos',String(Date.now()));node.src=imageUrl.toString();},Math.max(30,Number(camera.pollIntervalS||60))*1000);
  $$('[data-close-modal]').forEach(button=>button.addEventListener('click',closeModal));
}
window.atmosOpenCamera=index=>openCamera(getAllCameras()[index]);

function saveMusic(event) {
  event.preventDefault();
  const provider=storage.get('music-provider','Spotify');const url=new FormData(event.currentTarget).get('url')?.toString().trim()||'';
  if(url){const markup=musicEmbedMarkup(provider,url);if(markup.includes('doesn’t look like')){toast(`Enter a valid public ${provider} link.`);return;}}
  storage.set('music-url',url);storage.set('music-player-active',Boolean(url));renderPage();toast(url?'Music link saved. Start playback in the docked player.':'Music player cleared.');
}

function copyCaption() {
  const value=$('#social-caption')?.value||'';
  navigator.clipboard?.writeText(value).then(()=>toast('Caption copied.')).catch(()=>toast('Copy was blocked by the browser.'));
}

function socialProfileUrl(platform,username){
  const handle=String(username||'').trim().replace(/^@+/,'');
  if(!/^[a-z0-9._-]{1,50}$/i.test(handle))return '';
  const encoded=encodeURIComponent(handle);
  return platform==='YouTube'?`https://www.youtube.com/@${encoded}`:`https://www.tiktok.com/@${encoded}`;
}

function saveSocialProfile(){
  const displayName=$('#social-account-display')?.value.trim()||'';
  const username=$('#social-account-username')?.value.trim()||'';
  const url=socialProfileUrl(state.socialPlatform,username);
  if(!displayName||!url){toast('Enter a display name and a valid username or handle.');return;}
  const profiles=storage.get('social-profiles',{});
  profiles[state.socialPlatform]={displayName,username:username.replace(/^@+/,'')};
  storage.set('social-profiles',profiles);
  storage.set('social-brand',displayName);
  renderPage();
  toast(`${state.socialPlatform} public profile link saved on this device.`);
}

function socialOptionsFromPage(){
  return {tone:$('#social-tone')?.value||'reassuring',length:$('#social-length')?.value||'standard',audience:$('#social-audience')?.value||'local',format:$('#social-format')?.value||'warning',includeLocation:$('#social-include-location')?.checked??true,includeHashtags:$('#social-include-hashtags')?.checked??true};
}

function saveSocialPreferences(){
  const options=socialOptionsFromPage();storage.set('social-options',options);
  storage.set('social-monitor',socialMonitorFromPage());
  storage.set('social-enabled',$('#social-enable')?.checked===true);
  storage.set('social-title',$('#social-title')?.value||'');storage.set('social-brand',$('#social-brand')?.value||'Atmos Weather Desk');
  storage.set('social-draft',$('#social-caption')?.value||'');toast('Social preferences, monitored areas, and draft saved on this device.');
}

function copySocialPackage(){
  const title=$('#social-title')?.value.trim()||'',caption=$('#social-caption')?.value||'';
  const text=[title,caption].filter(Boolean).join('\n\n');
  navigator.clipboard?.writeText(text).then(()=>toast('Post title and caption copied.')).catch(()=>toast('Copy was blocked by the browser.'));
}

async function draftCaption() {
  const button=$('[data-action="draft-caption"]');
  const provider=$('#ai-provider')?.value||storage.get('ai-provider','ChatGPT');
  const draft=$('#social-caption')?.value||'';
  const sourceAlert=state.alerts.find(alert=>/warning/i.test(alert.properties?.event||''));
  const event=sourceAlert?.properties?.event||'Weather update';
  const area=sourceAlert?.properties?.areaDesc?.split(';')[0]||state.place.name;
  const config=socialOptionsFromPage();
  if(button){button.disabled=true;button.textContent='✦ Drafting…';}
  try {
    const response=await fetch('/api/draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider,platform:state.socialPlatform,event,area,draft,config})});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'AI drafting is unavailable.');
    state.socialPrompt=result.caption;
    storage.set('social-draft',result.caption);
    const caption=$('#social-caption');if(caption)caption.value=result.caption;
    setText('#social-preview-copy',result.caption);
    toast(`${provider} draft ready. Review it before sharing.`);
  } catch(error) {
    toast(error.message||'AI drafting needs a configured Vercel server integration.');
  } finally {
    if(button){button.disabled=false;button.textContent='✦ Draft with AI';}
  }
}

async function createAlertDraft(alert) {
  const provider=storage.get('ai-provider','ChatGPT');
  const properties=alert.properties||{};
  const event=properties.event||'Weather warning';
  const area=shortArea(properties.areaDesc);
  const country=properties.country==='CA'?'Canada':'United States';
  const severity=properties.severity||properties.urgency||'';
  const expires=properties.expires?` until ${new Date(properties.expires).toLocaleString('en-GB',{timeZone:'UTC',hour12:false})} UTC`:'';
  const officialUrl=properties.web||properties.url|| (country==='Canada'?'https://weather.gc.ca/en/alert':'https://www.weather.gov/');
  const fallback=`${event} for ${area}, ${country}${severity?` (${severity.toLowerCase()})`:''}${expires}. Check the official alert for details and follow local emergency instructions: ${officialUrl} #WeatherAlert`;
  const config=storage.get('social-options',{});
  try {
    const response=await fetch('/api/draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider,platform:state.socialPlatform,event,area,draft:fallback,config,officialUrl,country,severity,expires})});
    const result=await response.json();
    const caption=response.ok?result.caption:fallback;
    state.socialPrompt=caption;storage.set('social-draft',caption);
    storage.set('social-last-alert',{event,area,country,officialUrl,at:new Date().toISOString()});
    if($('#social-caption')){$('#social-caption').value=caption;setText('#social-preview-copy',caption);}
  } catch {
    state.socialPrompt=fallback;storage.set('social-draft',fallback);
    storage.set('social-last-alert',{event,area,country,officialUrl,at:new Date().toISOString()});
    if($('#social-caption')){$('#social-caption').value=fallback;setText('#social-preview-copy',fallback);}
  }
  toast(`Draft prepared for ${area}. Review it before posting.`);
}

function showModal(content) {
  $('#modal-card').innerHTML=content;$('#modal-backdrop').hidden=false;
  $$('[data-close-modal]').forEach(button=>button.addEventListener('click',closeModal));
}
function closeModal() { if(state.cameraImageTimer){clearInterval(state.cameraImageTimer);state.cameraImageTimer=null;} $('#modal-backdrop').hidden=true;$('#modal-card').innerHTML=''; }

function setupPwa(){
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>setText('#install-status','Offline app support could not be enabled in this browser.'));
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();state.installPrompt=event;setText('#install-status','Ready to install on this device.');const button=$('#install-app-button');if(button)button.disabled=false;});
  window.addEventListener('appinstalled',()=>{state.installPrompt=null;setText('#install-status','Atmos is installed. You can open it from your app list.');toast('Atmos installed.');});
}

async function installAtmos(){
  if(!state.installPrompt){
    const standalone=window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone;
    toast(standalone?'Atmos is already installed.':'Use your browser menu and choose Install app or Add to Home Screen.');return;
  }
  const prompt=state.installPrompt;state.installPrompt=null;await prompt.prompt();
  const choice=await prompt.userChoice;
  if(choice?.outcome==='accepted')setText('#install-status','Atmos is installing on this device.');
  else setText('#install-status','Install was dismissed. You can install it later from this page.');
}

function openFirstLocationPrompt(){
  if(storage.get('location-prompt-dismissed',false))return;
  showModal(`<div class="modal-head"><h2 id="modal-title">Set your weather location</h2><button class="modal-close" data-close-modal aria-label="Close">×</button></div><div class="modal-body"><p class="source-note">Use your device location for nearby warnings and a centred radar mosaic, or search for any city or region. Your choice is saved only in this browser.</p><div class="location-prompt-actions"><button class="btn btn-primary" id="prompt-use-location">⌖ Use device location</button><button class="btn btn-quiet" id="prompt-search-location">Search for a place</button><button class="btn btn-quiet" id="prompt-continue-global">Continue with world view</button></div><p class="tiny">Location access is optional. If denied, use the location search in the header. The world view is not a local warning feed.</p></div>`);
  $('#prompt-use-location')?.addEventListener('click',()=>{storage.set('location-prompt-dismissed',true);closeModal();useMyLocation();});
  $('#prompt-search-location')?.addEventListener('click',()=>{storage.set('location-prompt-dismissed',true);closeModal();$('#location-input')?.focus();$('#location-input')?.select();});
  $('#prompt-continue-global')?.addEventListener('click',()=>{storage.set('location-prompt-dismissed',true);closeModal();});
}

function openNotificationModal() {
  const prefs=storage.get('notifications',{enabled:false,scope:'nearby',spc:true,warnings:true});
  const allowed=typeof Notification==='undefined'?'unavailable':Notification.permission;
  showModal(`<div class="modal-head"><h2 id="modal-title">Alert notifications</h2><button class="modal-close" data-close-modal aria-label="Close">×</button></div><div class="modal-body"><p class="source-note">Choose whether to follow your selected area or all available sources. Browser notifications work while this dashboard is open and permission is granted.</p><label class="form-label" style="margin:14px 0">Coverage<select class="input" id="modal-scope"><option value="nearby" ${prefs.scope==='nearby'?'selected':''}>Near me · ${esc(state.place.name)}</option><option value="worldwide" ${prefs.scope==='worldwide'?'selected':''}>Worldwide · active connected sources</option></select></label><div class="setting-row"><div class="setting-copy"><strong>New NWS alerts</strong><small>Worldwide watches the selected feed regardless of distance and adds GDACS major hazards. National warning coverage varies by country.</small></div><label class="switch"><input id="modal-warnings" type="checkbox" ${prefs.warnings?'checked':''}/><span class="switch-track"></span></label></div><div class="setting-row"><div class="setting-copy"><strong>Tornado warnings</strong><small>Prioritize tornado warnings from integrated regional feeds.</small></div><label class="switch"><input id="modal-tornado" type="checkbox" ${prefs.tornado!==false?'checked':''}/><span class="switch-track"></span></label></div><div class="setting-row"><div class="setting-copy"><strong>Severe thunderstorm warnings</strong><small>Include severe thunderstorm and equivalent severe-weather alerts.</small></div><label class="switch"><input id="modal-severe" type="checkbox" ${prefs.severe!==false?'checked':''}/><span class="switch-track"></span></label></div><div class="setting-row"><div class="setting-copy"><strong>Flood warnings</strong><small>Include flood, flash-flood, and related alerts where available.</small></div><label class="switch"><input id="modal-flood" type="checkbox" ${prefs.flood!==false?'checked':''}/><span class="switch-track"></span></label></div><div class="setting-row"><div class="setting-copy"><strong>SPC outlook changes</strong><small>Check for a revised Day 1 outlook image.</small></div><label class="switch"><input id="modal-spc" type="checkbox" ${prefs.spc?'checked':''}/><span class="switch-track"></span></label></div><div class="setting-row"><div class="setting-copy"><strong>Enable notifications</strong><small>Browser permission: ${esc(allowed)}</small></div><label class="switch"><input id="modal-enabled" type="checkbox" ${prefs.enabled?'checked':''}/><span class="switch-track"></span></label></div><p class="tiny" style="margin-top:12px">GDACS covers major global disasters; local weather warnings still depend on national agency feeds.</p></div><div class="modal-actions"><button class="btn btn-quiet" data-close-modal>Cancel</button><button class="btn btn-primary" id="save-notification-modal">Save preferences</button></div>`);
  $('#save-notification-modal').addEventListener('click',saveNotificationSettings);
}

async function saveNotificationSettings() {
  const modal=$('#modal-enabled');
  const enabled=modal?modal.checked:$('#setting-notifications')?.checked;
  const scope=$('#modal-scope')?.value||$('#setting-scope')?.value||'nearby';
  const warnings=$('#modal-warnings')?.checked??$('#setting-warnings')?.checked??true;
  const spc=$('#modal-spc')?.checked??$('#setting-spc')?.checked??true;
  const tornado=$('#modal-tornado')?.checked??$('#setting-tornado')?.checked??true;
  const severe=$('#modal-severe')?.checked??$('#setting-severe')?.checked??true;
  const flood=$('#modal-flood')?.checked??$('#setting-flood')?.checked??true;
  let notificationsEnabled=enabled===true;
  if(notificationsEnabled&&typeof Notification==='undefined'){
    notificationsEnabled=false;toast('This browser does not support desktop notifications.');
  }else if(notificationsEnabled&&Notification.permission!=='granted'){
    const permission=Notification.permission==='default'?await Notification.requestPermission():Notification.permission;
    notificationsEnabled=permission==='granted';
    if(!notificationsEnabled)toast('Browser notification permission was not granted; warning settings were saved with notifications off.');
  }
  storage.set('notifications',{enabled:notificationsEnabled,scope,warnings,spc,tornado,severe,flood,other:true});
  closeModal();if(notificationsEnabled)toast('Notification preferences saved.');
}

function notifyUser(message) {
  toast(message);
  if(typeof Notification!=='undefined'&&Notification.permission==='granted')new Notification('Atmos weather update',{body:message,icon:'https://www.weather.gov/images/nws/nws_logo.png'});
}

async function checkOutlookChange() {
  const prefs=storage.get('notifications',{enabled:false,spc:true});if(!prefs.enabled||!prefs.spc)return;
  try {
    const data=await fetch('/api/spc-outlook',{cache:'no-store'}).then(response=>response.ok?response.json():Promise.reject());
    const stamp=data.revision||'';
    const prior=storage.get('spc-stamp','');
    if(prior&&stamp&&prior!==stamp)notifyUser('SPC Day 1 convective outlook updated.');
    if(stamp)storage.set('spc-stamp',stamp);
  } catch {}
}

async function loadNHC() {
  try { const data=await fetchJson(API.nhc);state.nhcStorms=data.activeStorms||[]; } catch { state.nhcStorms=[]; }
  const target=$('#nhc-storm-list');if(target)target.innerHTML=nhcMarkup();
}

function addCameraMapMarkers() {
  if(state.mapKind!=='cameras')return;
  getAllCameras().forEach((camera,index)=>addCameraMarker(camera,index));
}

function refreshData() {
  setText('#last-updated',fmtClock());
  loadWeather();loadAlerts();if(state.page==='overview')loadRadar();if(state.page==='radar')loadRadarStations();loadNHC();
  if(state.page==='models')loadModelData();
}

function updateClock() { setText('#utc-clock',`${fmtClock()}Z`); }

function startRefreshLoops() {
  setInterval(()=>{updateClock();loadAlerts();loadWeather();setText('#last-updated',fmtClock());if(state.page==='overview'&&state.map)loadGlobalRadarMosaic(state.map,true,false);if(state.page==='radar'&&state.globalRadarMap)loadGlobalRadarMosaic(state.globalRadarMap,false,false);},90000);
  setInterval(()=>{
    if(state.page==='overview'&&state.map)loadRadar(false);
    if(state.page==='radar'&&radarCoverageRegion()==='US'){if(!state.radarStations.length)loadRadarStations();else loadRadarStationImage(true);}
    if(state.page==='outlooks'){loadOutlookMap();loadCanadaOutlookMap(true);}
    if(state.page==='satellite')updateSatelliteImage(true);
    if(state.page==='models')loadModelData();
    loadNHC();loadGdacs();
  },120000);
  setInterval(checkOutlookChange,5*60*1000);
  updateClock();
}

async function initialize() {
  setupPwa();
  initPreferences();
  const saved=storage.get('place');if(saved)state.place=saved;
  $('#location-input').value=`${state.place.name}${state.place.region?`, ${state.place.region.split(',')[0]}`:''}`;
  bindPersistentControls();bindNavigation();
  if(state.page==='')state.page='overview';
  renderPage();
  refreshData();
  loadGdacs();
  startRefreshLoops();
  if(!saved)openFirstLocationPrompt();
}

initialize();
