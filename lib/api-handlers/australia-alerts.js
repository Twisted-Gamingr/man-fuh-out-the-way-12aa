const BOM_FEEDS = {
  NSW: 'https://www.bom.gov.au/fwo/IDZ00054.warnings_nsw.xml',
  ACT: 'https://www.bom.gov.au/fwo/IDZ00054.warnings_nsw.xml',
  VIC: 'https://www.bom.gov.au/fwo/IDZ00059.warnings_vic.xml',
  QLD: 'https://www.bom.gov.au/fwo/IDZ00056.warnings_qld.xml',
  WA: 'https://www.bom.gov.au/fwo/IDZ00060.warnings_wa.xml',
  SA: 'https://www.bom.gov.au/fwo/IDZ00057.warnings_sa.xml',
  TAS: 'https://www.bom.gov.au/fwo/IDZ00058.warnings_tas.xml',
  NT: 'https://www.bom.gov.au/fwo/IDZ00055.warnings_nt.xml'
};
const STATE_KEYS = [['new south wales','NSW'],['nsw','NSW'],['australian capital territory','ACT'],['canberra','ACT'],['victoria','VIC'],['melbourne','VIC'],['queensland','QLD'],['brisbane','QLD'],['western australia','WA'],['perth','WA'],['south australia','SA'],['adelaide','SA'],['tasmania','TAS'],['hobart','TAS'],['northern territory','NT'],['darwin','NT']];
function decode(value='') { return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim(); }
function tag(block,name){return block.match(new RegExp(`<${name}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${name}>`,'i'))?.[1]||'';}
export default async function handler(request,response){
  if(request.method!=='GET'){response.setHeader('Allow','GET');return response.status(405).json({error:'Method not allowed'});}
  const url=new URL(request.url,'https://atmos.invalid');
  const requested=`${url.searchParams.get('region')||''}`.toLowerCase();
  const code=STATE_KEYS.find(([name])=>requested.includes(name))?.[1]||'NSW';
  try{
    const upstream=await fetch(BOM_FEEDS[code],{headers:{Accept:'application/rss+xml, application/xml, text/xml','User-Agent':'Atmos Weather Dashboard (BOM RSS warning feed)'},cache:'no-store',signal:AbortSignal.timeout(6500)});
    if(!upstream.ok)throw new Error(`BOM returned ${upstream.status}`);
    const xml=await upstream.text();
    const features=[...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match,index)=>{
      const b=match[1],title=decode(tag(b,'title'))||'Bureau of Meteorology warning',description=decode(tag(b,'description'));
      const published=decode(tag(b,'pubDate'));const href=b.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i)?.[1];
      return {type:'Feature',id:`AU:${code}:${published}:${index}`,geometry:null,properties:{country:'REGIONAL',countryCode:'AU',source:'Bureau of Meteorology',event:title,headline:title,description,areaDesc:code,sent:published?new Date(published).toISOString():'',web:decode(href)||'https://www.bom.gov.au/warnings/',severity:/emergency|extreme|cyclone|severe/i.test(title)?'Severe':'Moderate',certainty:'Official BOM RSS feed'}};
    });
    response.setHeader('Cache-Control','public, s-maxage=90, stale-while-revalidate=180');
    return response.status(200).json({source:'Bureau of Meteorology',status:'live',country:'AU',region:code,features,updatedAt:new Date().toISOString()});
  }catch{return response.status(502).json({source:'Bureau of Meteorology',status:'unavailable',country:'AU',region:code,features:[],error:'BOM warning RSS could not be reached.'});}
}
