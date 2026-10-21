function parseCsvLine(line) {
  const out=[];let value='',quoted=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'&&line[i+1]==='"'&&quoted){value+='"';i++;}
    else if(ch==='"')quoted=!quoted;
    else if(ch===','&&!quoted){out.push(value.trim());value='';}
    else value+=ch;
  }
  out.push(value.trim());return out;
}
export default async function handler(request,response){
  if(request.method!=='GET'){response.setHeader('Allow','GET');return response.status(405).json({error:'Method not allowed'});}
  const now=new Date();const year=now.getUTCFullYear(),yyyymmdd=`${year}${String(now.getUTCMonth()+1).padStart(2,'0')}${String(now.getUTCDate()).padStart(2,'0')}`;
  const yesterday=new Date(now.getTime()-86400000);const yyyymmddYesterday=`${yesterday.getUTCFullYear()}${String(yesterday.getUTCMonth()+1).padStart(2,'0')}${String(yesterday.getUTCDate()).padStart(2,'0')}`;
  const urls=[`https://www.spc.noaa.gov/climo/reports/${year}/${yyyymmdd}_rpts.csv`,`https://www.spc.noaa.gov/climo/reports/${year}/${yyyymmddYesterday}_rpts.csv`,`https://www.spc.noaa.gov/climo/reports/today.csv`];
  for(const url of urls){
    try{
      const upstream=await fetch(url,{headers:{Accept:'text/csv, text/plain','User-Agent':'Atmos Weather Dashboard (SPC preliminary storm reports)'},cache:'no-store',signal:AbortSignal.timeout(5500)});
      if(!upstream.ok)continue;
      const text=await upstream.text();
      const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
      if(lines.length<2)continue;
      const header=parseCsvLine(lines[0]).map(x=>x.toLowerCase());
      const rows=lines.slice(1).map((line,index)=>{
        const values=parseCsvLine(line);const properties={};header.forEach((key,i)=>properties[key||`column_${i}`]=values[i]||'');
        return {id:`SPC:${yyyymmdd}:${index}`,properties};
      }).filter(row=>Object.values(row.properties).some(Boolean));
      if(rows.length){response.setHeader('Cache-Control','public, s-maxage=120, stale-while-revalidate=180');return response.status(200).json({status:'live',source:url,rows:rows.slice(0,100),updatedAt:new Date().toISOString()});}
    }catch{}
  }
  response.setHeader('Cache-Control','no-store');return response.status(200).json({status:'unavailable',source:'https://www.spc.noaa.gov/climo/reports/',rows:[],message:'SPC preliminary report CSV is not available at the expected endpoint. Use the official report page.'});
}
