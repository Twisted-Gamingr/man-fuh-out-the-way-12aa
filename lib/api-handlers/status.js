const SERVICES = [
  { id:'app', name:'Atmos API functions', region:'Website', url:'/api/status', check:false, note:'Vercel serverless routes' },
  { id:'radar', name:'RainViewer radar mosaic', region:'Global', url:'https://api.rainviewer.com/public/weather-maps.json', note:'Composite precipitation tiles; coverage varies by area' },
  { id:'openmeteo', name:'Open-Meteo forecasts', region:'Global', url:'https://api.open-meteo.com/v1/forecast?latitude=51.5&longitude=-0.1&current=temperature_2m', note:'Current conditions and forecast model grids' },
  { id:'wmo', name:'WMO Severe Weather Information Centre', region:'Global alerts', url:'https://severeweather.wmo.int/', note:'Global CAP warning centre; national participation varies' },
  { id:'lightning', name:'LightningMaps.org', region:'Global (coverage varies)', url:'https://www.lightningmaps.org/', note:'Community lightning network; not an official warning service' },
  { id:'nws', name:'U.S. National Weather Service alerts', region:'North America', url:'https://api.weather.gov/alerts/active?limit=1', note:'Official U.S. warnings, watches and advisories' },
  { id:'eccc', name:'Environment and Climate Change Canada', region:'North America', url:'https://api.weather.gc.ca/collections/weather-alerts/items?f=json&limit=1', note:'Canadian official alert data and GeoMet products' },
  { id:'spc', name:'Storm Prediction Center', region:'North America', url:'https://www.spc.noaa.gov/products/outlook/day1otlk.html', note:'U.S. convective outlooks and preliminary storm reports' },
  { id:'meteoalarm', name:'MeteoAlarm warning feeds', region:'Europe', url:'https://feeds.meteoalarm.org/', note:'Warnings from participating European national services' },
  { id:'metoffice', name:'UK Met Office', region:'Europe', url:'https://www.metoffice.gov.uk/', note:'Official UK forecasts and warnings' },
  { id:'jma', name:'Japan Meteorological Agency', region:'Asia', url:'https://www.jma.go.jp/bosai/warning/', note:'Official Japanese warnings portal' },
  { id:'imd', name:'India Meteorological Department', region:'Asia', url:'https://mausam.imd.gov.in/', note:'Official India forecast and warning portal' },
  { id:'bom', name:'Australian Bureau of Meteorology', region:'Oceania', url:'https://www.bom.gov.au/rss/', note:'Official Australia warnings and RSS feeds' },
  { id:'metservice', name:'MetService New Zealand', region:'Oceania', url:'https://www.metservice.com/warnings/home', note:'Official New Zealand weather warnings' },
  { id:'gdacs', name:'GDACS global disaster alerts', region:'Global hazards', url:'https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP', note:'Major disaster events; not a substitute for local weather warnings' }
];
async function check(service){
  if(service.check===false)return {...service,status:'up',latencyMs:0,checkedAt:new Date().toISOString()};
  const started=Date.now();
  try{
    const upstream=await fetch(service.url,{method:'GET',headers:{Accept:'application/json, text/html, application/xml, text/xml, */*','User-Agent':'Atmos Weather Dashboard (service status checker)'},cache:'no-store',signal:AbortSignal.timeout(6000)});
    const status=upstream.ok?'up':upstream.status===429?'degraded':'down';
    return {id:service.id,name:service.name,region:service.region,url:service.url,note:service.note,status,httpStatus:upstream.status,latencyMs:Date.now()-started,checkedAt:new Date().toISOString()};
  }catch(error){return {id:service.id,name:service.name,region:service.region,url:service.url,note:service.note,status:'down',latencyMs:Date.now()-started,error:error.name==='TimeoutError'?'Timed out':'Connection failed',checkedAt:new Date().toISOString()};}
}
export default async function handler(request,response){
  if(request.method!=='GET'){response.setHeader('Allow','GET');return response.status(405).json({error:'Method not allowed'});}
  const results=await Promise.all(SERVICES.map(check));
  response.setHeader('Cache-Control','no-store, max-age=0');
  return response.status(200).json({status:results.every(s=>s.status==='up')?'operational':results.some(s=>s.status==='up')?'partial':'outage',checkedAt:new Date().toISOString(),services:results});
}
