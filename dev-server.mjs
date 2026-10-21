import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getNorthAmericaAlerts } from './lib/north-america-alerts.js';

const root=process.cwd();
const staticRoot=process.env.ATMOS_STATIC_ROOT?path.resolve(root,process.env.ATMOS_STATIC_ROOT):root;
const port=Number(process.env.ATMOS_PORT||8123);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.gif':'image/gif'};

async function spcDay(day) {
  const page=await fetch(`https://www.spc.noaa.gov/products/outlook/day${day}otlk.html`,{cache:'no-store'});
  if(!page.ok)throw new Error('SPC outlook unavailable');
  const html=await page.text();
  const issued=html.match(new RegExp(`(\\d{3,4})\\s+UTC\\s+Day ${day} Convective Outlook`,'i'))?.[1]||'';
  const filename=issued?`day${day}otlk_${issued}.png`:html.match(new RegExp(`day${day}otlk_\\d{3,4}\\.png`,'i'))?.[0];
  if(!filename)throw new Error('SPC image unavailable');
  return {url:`https://www.spc.noaa.gov/products/outlook/${filename}`,image:`/api/spc-image?day=${day}`,issued,revision:html.match(/Updated:\s*([^<]{0,100})/i)?.[1]?.replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').replace(/[([]\s*$/,'').trim()||filename};
}

function json(response,status,data) {
  response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  response.end(JSON.stringify(data));
}

async function handleApi(request,response,url) {
  if(request.method!=='GET')return json(response,405,{error:'Method not allowed'});
  if(url.pathname==='/api/north-america-alerts') {
    try {
      const data=await getNorthAmericaAlerts();
      response.writeHead(200,{'Content-Type':'application/geo+json; charset=utf-8','Cache-Control':'public, max-age=30, stale-while-revalidate=30'});
      return response.end(JSON.stringify(data));
    } catch(error) { return json(response,502,{error:error.message||'North American weather warnings are unavailable.'}); }
  }
  if(url.pathname==='/api/nexrad-sites') {
    try {
      const upstream=await fetch('https://atmostorm.com/api/v1/nexrad/sites',{headers:{Accept:'application/json','User-Agent':'Atmos Weather Dashboard (single-site radar map)'},cache:'no-store'});
      if(!upstream.ok)return json(response,502,{error:'Single-site NEXRAD station list unavailable'});
      response.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=60, stale-while-revalidate=300'});
      return response.end(JSON.stringify(await upstream.json()));
    } catch { return json(response,502,{error:'Single-site NEXRAD station list unavailable'}); }
  }
  if(url.pathname==='/api/spc-map') {
    const day=Number(url.searchParams.get('day')||1);
    const hazard=url.searchParams.get('hazard')||'categorical';
    const layers={1:{categorical:1,tornado:3,hail:5,wind:7},2:{categorical:9,tornado:11,hail:13,wind:15},3:{categorical:17}};
    const layer=layers[day]?.[hazard];
    if(!layer)return json(response,200,{features:[],message:'SPC publishes a combined severe probability outlook for Day 3; separate tornado, wind, and hail layers are available on Days 1 and 2.'});
    try {
      const target=new URL(`https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer/${layer}/query`);
      target.searchParams.set('where','1=1');target.searchParams.set('outFields','*');target.searchParams.set('returnGeometry','true');target.searchParams.set('outSR','4326');target.searchParams.set('f','geojson');
      const upstream=await fetch(target,{headers:{Accept:'application/geo+json, application/json'},cache:'no-store'});
      const data=await upstream.json();
      if(!upstream.ok||data.error)return json(response,502,{error:'Official SPC map service is temporarily unavailable.'});
      response.writeHead(200,{'Content-Type':'application/geo+json; charset=utf-8','Cache-Control':'public, max-age=120, stale-while-revalidate=60'});
      return response.end(JSON.stringify(data));
    } catch {return json(response,502,{error:'Official SPC map service is temporarily unavailable.'});}
  }
  if(url.pathname==='/api/spc-outlook') {
    try {
      const days={};
      await Promise.all([1,2,3].map(async day=>{try{days[day]=await spcDay(day);}catch{}}));
      if(!Object.keys(days).length)return json(response,502,{error:'SPC source unavailable'});
      return json(response,200,{days,revision:days[1]?.revision||''});
    } catch { return json(response,502,{error:'SPC source unavailable'}); }
  }
  if(url.pathname==='/api/spc-image') {
    const day=Number(url.searchParams.get('day')||1);
    if(![1,2,3].includes(day)){response.writeHead(400);return response.end('Day must be 1, 2, or 3.');}
    try {
      const product=await spcDay(day);
      const image=await fetch(product.url,{cache:'no-store'});
      if(!image.ok)throw new Error('SPC image unavailable');
      response.writeHead(200,{'Content-Type':image.headers.get('content-type')||'image/png','Cache-Control':'public, max-age=120'});
      return response.end(Buffer.from(await image.arrayBuffer()));
    } catch { response.writeHead(502,{'Content-Type':'text/plain; charset=utf-8'});return response.end('SPC outlook image unavailable.'); }
  }
  if(url.pathname==='/api/satellite-image') {
    const satellite=url.searchParams.get('satellite')||'';
    const channel=url.searchParams.get('channel')||'';
    if(!['GOES18','GOES19'].includes(satellite)||!['GEOCOLOR','13','08','02'].includes(channel))return json(response,400,{error:'Unsupported GOES satellite or image channel.'});
    try {
      let imageUrl=`https://cdn.star.nesdis.noaa.gov/${satellite}/ABI/FD/GEOCOLOR/1808x1808.jpg`;
      if(channel!=='GEOCOLOR'){
        const satLabel=satellite==='GOES19'?'G19':'G18';
        const page=await fetch(`https://www.star.nesdis.noaa.gov/GOES/fulldisk_band.php?band=${channel}&length=12&sat=${satLabel}`,{cache:'no-store'});
        if(!page.ok){response.writeHead(502,{'Content-Type':'text/plain; charset=utf-8'});return response.end('NOAA satellite viewer unavailable.');}
        const html=await page.text();
        const imagePath=html.match(new RegExp(`/GOES${satellite.slice(4)}/ABI/FD/${channel}/[\\w.-]+\\.jpg`,'i'))?.[0];
        if(!imagePath){response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return response.end('NOAA is not currently serving imagery for this band.');}
        imageUrl=`https://cdn.star.nesdis.noaa.gov${imagePath}`;
      }
      const image=await fetch(imageUrl,{cache:'no-store'});
      if(!image.ok){response.writeHead(image.status,{'Content-Type':'text/plain; charset=utf-8'});return response.end('NOAA satellite image unavailable.');}
      response.writeHead(200,{'Content-Type':image.headers.get('content-type')||'image/jpeg','Cache-Control':'public, max-age=60'});
      return response.end(Buffer.from(await image.arrayBuffer()));
    } catch {response.writeHead(502,{'Content-Type':'text/plain; charset=utf-8'});return response.end('NOAA satellite image unavailable.');}
  }
  if(url.pathname==='/api/radar-stations') {
    try {
      const upstream=await fetch('https://api.weather.gov/radar/stations',{headers:{Accept:'application/geo+json','User-Agent':'Atmos Weather Dashboard (NWS radar display)'},cache:'no-store'});
      if(!upstream.ok)return json(response,upstream.status,{error:'NWS radar stations unavailable'});
      response.writeHead(200,{'Content-Type':'application/geo+json','Cache-Control':'public, max-age=300'});
      return response.end(JSON.stringify(await upstream.json()));
    } catch { return json(response,502,{error:'NWS radar stations unavailable'}); }
  }
  if(url.pathname==='/api/cameras') {
    const bbox=url.searchParams.get('bbox')||'';
    if(!/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(bbox))return json(response,400,{error:'A valid camera search area is required.'});
    try {
      const target=new URL('https://datumfeed.com/api/cameras');
      target.searchParams.set('bbox',bbox);target.searchParams.set('limit','100');target.searchParams.set('verificationStatus','auto_checked');
      const upstream=await fetch(target,{headers:{Accept:'application/json','User-Agent':'Atmos Weather Dashboard (public camera discovery)'},cache:'no-store'});
      const data=await upstream.json();
      if(!upstream.ok)return json(response,upstream.status,{error:data.error||'Public camera registry unavailable'});
      response.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=900'});
      return response.end(JSON.stringify(data));
    } catch { return json(response,502,{error:'Public camera registry unavailable'}); }
  }
  const dynamicApiName=url.pathname.startsWith('/api/')?url.pathname.slice('/api/'.length):'';
  const localServerlessApis=new Set(['radar-mosaic','europe-alerts','australia-alerts','gdacs-events','spc-reports','status']);
  if(localServerlessApis.has(dynamicApiName)){
    try{
      const module=await import(`./lib/api-handlers/${dynamicApiName}.js`);
      let statusCode=200;const headers={};
      const adapter={
        setHeader(name,value){headers[name]=value;return this;},
        status(code){statusCode=code;return this;},
        json(payload){if(response.writableEnded)return response;if(!headers['Content-Type'])headers['Content-Type']='application/json; charset=utf-8';response.writeHead(statusCode,headers);response.end(JSON.stringify(payload));return response;},
        writeHead(code,values={}){statusCode=code;Object.assign(headers,values||{});return this;},
        end(payload=''){if(response.writableEnded)return response;if(!response.headersSent)response.writeHead(statusCode,headers);response.end(payload);return response;},
        get writableEnded(){return response.writableEnded;}
      };
      await module.default({method:request.method,url:request.url,headers:request.headers},adapter);
      if(!response.writableEnded)adapter.status(204).end();
      return;
    }catch(error){if(!response.writableEnded)return json(response,502,{error:`Local ${dynamicApiName} route failed`,message:error?.message||'Unknown error'});return;}
  }
  return json(response,404,{error:'API route not found'});
}

http.createServer(async(request,response)=>{
  const url=new URL(request.url||'/',`http://${request.headers.host||'localhost'}`);
  if(url.pathname.startsWith('/api/'))return handleApi(request,response,url);
  let pathname;
  try { pathname=decodeURIComponent(url.pathname); } catch { response.writeHead(400);return response.end('Invalid path'); }
  let file=path.resolve(staticRoot,`.${pathname}`);
  if(file!==staticRoot&&!file.startsWith(`${staticRoot}${path.sep}`)){response.writeHead(403);return response.end('Forbidden');}
  try {
    const stats=await fs.stat(file);
    if(stats.isDirectory())file=path.join(file,'index.html');
    const data=await fs.readFile(file);
    response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});
    response.end(data);
  } catch {
    response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});
    response.end('Not found');
  }
}).listen(port,'127.0.0.1',()=>console.log(`Atmos local preview: http://127.0.0.1:${port}`));
