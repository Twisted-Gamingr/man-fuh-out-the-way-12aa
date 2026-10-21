# Atmos Weather Intelligence — global Vercel dashboard

Atmos is a browser-based weather dashboard for **North America, Europe, Asia, Oceania, and worldwide situational awareness**. It combines a global precipitation-radar mosaic, regional warning feeds, U.S. Storm Prediction Center outlooks, Canadian forecast/map products, forecast models, satellite imagery, storm-report resources, LightningMaps, service health checks, and a curated YouTube directory. The site is designed to deploy as a Vercel project with no required API keys for its core features.

> **This website was made with ChatGPT. Expect errors.** This is an experimental situational-awareness tool, not an official warning service. Always follow official meteorological agencies and local emergency authorities.

## Deploy on Vercel

1. Put the contents of this folder at the root of a Git repository.
2. Import that repository into Vercel as a project.
3. Use the defaults: build command `npm run build`, output directory `dist`, and Node.js 20.19+ (the included `package.json` specifies the engine range).
4. Deploy. The `api/[route].js` dispatcher serves every `/api/<name>` endpoint through one Vercel Function, keeping this project within the Hobby plan's function-count limit. The individual handlers live under `lib/api-handlers/`; do not move them back into `api/`.

No environment variables are required for weather feeds. Optional AI caption drafting needs `OPENAI_API_KEY` or `GEMINI_API_KEY` configured as a Vercel environment variable; never put secret keys in browser JavaScript.

## Run locally

```sh
npm install
npm run dev
```

Then open the local URL printed by the server. Do not open `index.html` as a `file://` URL. Vercel functions are provided locally for the principal global warning/radar/status feeds by the included development server; source providers may rate-limit requests or be unreachable in a local/network environment.

## Global features and feed limits

- **Global radar mosaic:** RainViewer's recent radar frames are tiled over an Esri basemap and centered on the selected location. Historical frame selection is available in the Radar explorer. Radar coverage, latency, resolution, and availability vary by country and sensor network; blank areas do not prove that it is dry. Mosaic imagery is not an official warning product. See [RainViewer](https://www.rainviewer.com/) and [API documentation](https://www.rainviewer.com/api.html).
- **Location:** First-time visitors are asked whether they want to share browser location, search for a place, or continue with a world view. Browser location is optional; choices are saved locally in the browser. You can change location in the header.
- **North America warnings:** Integrated official alerts from the U.S. National Weather Service and Environment and Climate Change Canada.
- **Europe warnings:** Country-specific legacy Atom feeds from MeteoAlarm where available. The feed is based on the chosen country; some countries or feed requests can be unavailable. Use the linked national service as the authority.
- **Australia warnings:** The API uses Australian Bureau of Meteorology RSS feeds for supported states/territories.
- **Asia, New Zealand, Pacific islands, Africa, South America, and other areas:** Global Red/Orange disaster-event alerts are drawn from GDACS where event geometry is available, with links to official national warning services and the WMO Severe Weather Information Centre. GDACS is a major-disaster product, not a complete feed of local thunderstorms, tornadoes, rain, wind, or flood warnings. National warning feed coverage is not uniform worldwide.
- **U.S. SPC outlooks:** Official Day 1–3 convective outlooks and selectable categorical/tornado/wind/hail map layers come from NOAA/NWS Storm Prediction Center products. SPC outlooks are U.S. products, not a global risk forecast.
- **Canadian outlook/maps:** The Canada panel uses official ECCC/MSC GeoMet layers and links to Canada.ca/ECCC forecast products. Canada does not publish an exact global equivalent of each SPC tornado/wind/hail outlook in this dashboard; the map layer selected is explicitly named.
- **Forecast models:** Open-Meteo exposes supported global forecast models where available; individual models such as HRRR have geographic limits.
- **Satellite imagery:** GOES East/West imagery provides the regions covered by those geostationary satellites, not worldwide satellite coverage. Other regions should use their national or global satellite provider.
- **Lightning detector:** The radar explorer embeds LightningMaps/Blitzortung around the selected location. Detection coverage depends on the community network. It is not an official lightning warning service and should not be used as a safety guarantee.
- **Storm reports / Skywarn:** The reports panel displays the latest SPC preliminary U.S. storm reports when that feed is available and links to NWS SKYWARN information. These are not a complete real-time feed of all local Skywarn submissions, and the program is U.S.-based. Other countries use their own spotter and reporting systems.
- **Trusted creators:** The YouTube directory includes independent meteorologists, educators, storm chasers, and official agency channels from several regions. It is a discovery list, not an endorsement; use national weather services for official warnings.
- **Service status:** `/api/status` checks reachability of key endpoints from the Vercel function environment. It is a point-in-time HTTP response check, not an uptime guarantee or an evaluation of every feed item/map tile. Automated checks can fail against sites that block server-side requests.

## Notifications

The app asks for browser notification permission only after the user chooses to enable it. Users can select tornado, severe thunderstorm, flood, other warnings, and SPC outlook updates. While the dashboard is open, it checks the currently selected integrated feed at intervals and compares recent warning identifiers; GDACS Red/Orange events are also observed. This is **not** 24/7 closed-app push. Background delivery requires a push sender, VAPID credentials, durable subscription storage, and a scheduled server-side checker, none of which are configured in this starter project. Worldwide notifications can only cover the connected sources described above, not every country's national feed.

## Themes, privacy, and storage

Eight preset palettes are provided (Bright, Dark, OLED, Storm, Ocean, Forest, Ember, and Violet), plus preset/custom accent colors. Theme, accent, selected place, camera links, notification preferences, and social drafts are saved in local browser storage. Browser location is requested only after user action; if granted, coordinates are used for local radar and alert context. Do not enter secrets into public/local preference fields.

## Operational safety

Alert timing, coverage, feed schemas, and availability can vary, especially outside countries with integrated public feeds. Always verify a warning at the issuing agency's official website or alert message and follow local emergency instructions. Do not use this application as the sole source for emergency decisions.
