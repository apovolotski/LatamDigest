import {publisherFetch} from './publisherHttp.js';
import {articleID} from './articleIdentity.js';

function decode(value) {
  return String(value ?? '').replace(/&(?:amp|quot|apos|lt|gt|nbsp|#\d+|#x[0-9a-f]+);/gi, entity => {
    const named = {'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' '};
    if(named[entity.toLowerCase()])return named[entity.toLowerCase()];
    const point=entity[2].toLowerCase()==='x'?parseInt(entity.slice(3,-1),16):Number(entity.slice(2,-1));
    return point>=32&&point<=0x10ffff&&!(point>=0xd800&&point<=0xdfff)?String.fromCodePoint(point):entity;
  });
}
const headlineKey=value=>decode(decode(value)).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function attributes(tag) {
  const result={};
  for(const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))result[match[1].toLowerCase()]=decode(match[2]??match[3]);
  return result;
}
function instant(value) {
  // Date-only values cannot prove an instant. Do not invent a timezone/time,
  // use dateModified, or substitute the page retrieval time.
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(value))return null;
  const time=Date.parse(value);return Number.isFinite(time)?new Date(time).toISOString():null;
}

export function originalPublisherDate(html, expectedTitle, publisherNames=[]) {
  const titles=[],dates=[];
  const metas=[...html.matchAll(/<meta\b[^>]*>/gi)].map(m=>attributes(m[0]));
  for(const m of metas)if(['og:title','twitter:title'].includes(m.property??m.name))titles.push(m.content);
  for(const m of html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi))titles.push(m[1].replace(/<[^>]+>/g,''));
  const matchesTitle=title=>{
    if(headlineKey(title)===headlineKey(expectedTitle))return true;
    // Metadata sometimes appends its exact publisher/site name. Remove only
    // that reviewed trailing credit; never accept partial article headlines.
    const value=decode(decode(title)).trim();
    for(const name of publisherNames.filter(n=>typeof n==='string'&&n))for(const separator of [' - ',' | ',' – ',' — ']){
      const suffix=separator+name;
      if(value.toLowerCase().endsWith(suffix.toLowerCase())&&headlineKey(value.slice(0,-suffix.length))===headlineKey(expectedTitle))return true;
    }
    return false;
  };
  if(titles.some(matchesTitle))for(const m of metas)if(['article:published_time','datepublished'].includes((m.property??m.name??'').toLowerCase()))dates.push(m.content);
  function visit(node) {
    if(!node||typeof node!=='object')return;
    if(Array.isArray(node)){node.forEach(visit);return;}
    const types=[node['@type']].flat();
    if(types.some(t=>typeof t==='string'&&/^(?:https?:\/\/schema\.org\/)?(?:NewsArticle|Article|BlogPosting|ReportageNewsArticle|OpinionNewsArticle)$/.test(t))&&matchesTitle(node.headline))dates.push(node.datePublished);
    // Only root article objects / their graph, never unrelated recommended
    // stories nested in a page's item lists or arbitrary dateModified fields.
    if(node['@graph'])visit(node['@graph']);
    // A WebPage may identify its principal article using mainEntity. This is
    // not a recursive crawl through recommendations or arbitrary child dates.
    if(types.some(t=>/^(?:https?:\/\/schema\.org\/)?WebPage$/.test(t))&&node.mainEntity)visit(node.mainEntity);
  }
  for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
    if(attributes(m[1]).type?.toLowerCase()!=='application/ld+json')continue;
    try{visit(JSON.parse(m[2]));}catch{}
  }
  const valid=[...new Set(dates.map(instant).filter(Boolean))];
  if(valid.length===1)return valid[0];
  // Some publishers emit the same publication second with and without
  // fractional precision. Keep the earliest explicit value (never make it
  // fresher). Two different fractional values or different seconds conflict.
  if(valid.length===2){
    const times=valid.map(Date.parse).sort((a,b)=>a-b);
    if(times[0]%1000===0&&Math.floor(times[0]/1000)===Math.floor(times[1]/1000))return new Date(times[0]).toISOString();
  }
  return null;
}

export async function verifyPublisherArticle(article, source, options={}) {
  const cache=options.requestContext?.publisherArticles??new Map();
  const key=`${article.url}\n${headlineKey(article.title)}`;
  if(!cache.has(key))cache.set(key,(async()=>{
    const timeout=AbortSignal.timeout(Math.min(options.timeoutMs??5000,5000));
    const signal=options.signal?AbortSignal.any([options.signal,timeout]):timeout;
    let url=new URL(article.url);
    try {
      // Follow only a small number of reviewed-host HTTPS redirects. A publisher
      // redirect may never turn this into a request to another/private host.
      for(let hop=0;hop<4;hop++){
        if(url.protocol!=='https:'||!source.hosts.includes(url.hostname)||url.username||url.password||url.port)return null;
        const response=await (options.fetchImpl??publisherFetch)(url,{signal,redirect:'manual',headers:{'user-agent':'LatamDigestStaticFeedGenerator/1.0'}});
        if([301,302,303,307,308].includes(response.status)){
          const location=response.headers.get('location');await response.body?.cancel();
          if(!location)return null;url=new URL(location,url);continue;
        }
        if(!response.ok){await response.body?.cancel();return null;}
        const body=await response.text();if(body.length>2_000_000)return null;
        return originalPublisherDate(body,article.title,[source.name,...source.hosts]);
      }
      return null;
    }catch{options.signal?.throwIfAborted();return null;}
  })());
  const publishedAt=await cache.get(key);
  return publishedAt?{...article,id:articleID(article.url),publishedAt}:null;
}
