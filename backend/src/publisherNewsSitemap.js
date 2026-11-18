import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {setTimeout as delay} from 'node:timers/promises';
import {publisherFetch} from './publisherHttp.js';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',parseTagValue:false});
const namespace='http://www.google.com/schemas/sitemap-news/0.9';

// These are publisher-hosted XML documents, not a request to Google. A sitemap
// is discovery only; the original article page must independently prove its
// matching headline and original publication instant. Never use lastmod.
export function newsSitemapItems(xml,source){
 if(typeof xml!=='string'||xml.length>2_000_000||/<!DOCTYPE/i.test(xml)||XMLValidator.validate(xml)!==true)return [];
 let root;try{root=parser.parse(xml)?.urlset;}catch{return [];}
 if(!root||typeof root!=='object')return [];
 const prefixes=Object.entries(root).filter(([key,value])=>key.startsWith('@_xmlns:')&&value===namespace).map(([key])=>key.slice(8));
 if(prefixes.length!==1)return [];
 const p=prefixes[0],entries=[root.url??[]].flat();if(entries.length>1000)return [];
 const items=[],seen=new Set();
 for(const entry of entries){
  const news=entry?.[`${p}:news`],link=entry?.loc,title=news?.[`${p}:title`],date=news?.[`${p}:publication_date`];
  if(typeof link!=='string'||typeof title!=='string'||!title.trim()||typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/.test(date)||!Number.isFinite(Date.parse(date)))continue;
  let url;try{url=new URL(link);}catch{continue;}
  if(url.protocol!=='https:'||!source.hosts.includes(url.hostname)||url.username||url.password||url.port||seen.has(url.href))continue;
  seen.add(url.href);items.push({title:title.trim(),link:url.href,pubDate:date});
 }
 return items.sort((a,b)=>Date.parse(b.pubDate)-Date.parse(a.pubDate));
}

export async function fetchPublisherNewsSitemap(source,options={}){
 const cache=options.requestContext?.publisherRSS??new Map(),key=`news-sitemap:${source.url}`;
 if(!cache.has(key))cache.set(key,(async()=>{
  const empty={rss:{channel:{item:[]}}};
  for(let attempt=0;attempt<2;attempt++){
   options.signal?.throwIfAborted();
   const timeout=AbortSignal.timeout(8000),signal=options.signal?AbortSignal.any([options.signal,timeout]):timeout;
   try{
    const url=new URL(source.url);if(url.protocol!=='https:'||url.username||url.password||url.port)return empty;
    const response=await(options.fetchImpl??publisherFetch)(url,{signal,redirect:'error',headers:{'user-agent':'LatamDigestStaticFeedGenerator/1.0'}});
    if(!response.ok){await response.body?.cancel();if(response.status<500||response.headers.get('retry-after'))return empty;throw new Error('publisher unavailable');}
    return {rss:{channel:{item:newsSitemapItems(await response.text(),source)}}};
   }catch{options.signal?.throwIfAborted();if(!attempt)await(options.sleep??delay)(1000,undefined,{signal:options.signal});}
  }
  return empty;
 })());
 return cache.get(key);
}
