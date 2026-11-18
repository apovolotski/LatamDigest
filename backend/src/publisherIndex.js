import {publisherFetch} from './publisherHttp.js';
import {verifyPublisherArticle} from './publisherArticle.js';

// Bounded discovery from reviewed publisher-rendered news cards. Page headings
// supply only identity. Dates come exclusively from each original article via
// the same verifier as RSS/archives, never from listing dates or retrieval time.
export function publisherIndexLinks(html,source){
 if(typeof html!=='string'||html.length>2_000_000||!source.articlePathPrefix)return [];
 const found=[],seen=new Set();
 // The reviewed site renders both anchors wrapping headings and headings
 // wrapping anchors, plus a labelled most-read news list. Ignore other links.
 const headingLinks = [...html.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)]
  .flatMap(m => [...m[1].matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)])
  .map(m => `<a ${m[1]}><h3>${m[2]}</h3></a>`).join('');
 const mostRead = [...html.matchAll(/<ol\b[^>]*class="plus-lus"[^>]*>([\s\S]*?)<\/ol>/gi)]
  .flatMap(m => [...m[1].matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)])
  .map(m => `<a ${m[1]}><h3>${m[2]}</h3></a>`).join('');
 for(const m of (html + headingLinks + mostRead).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const href=/\bhref="([^"]+)"/i.exec(m[1])?.[1],heading=/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/i.exec(m[2])?.[1];
  if(!href||!heading)continue;
  let url;try{url=new URL(href,source.url);}catch{continue;}
  const slug=url.pathname.slice(source.articlePathPrefix.length);
  if(url.protocol!=='https:'||!source.hosts.includes(url.hostname)||url.username||url.password||url.port||url.search||url.hash||!url.pathname.startsWith(source.articlePathPrefix)||!slug||!/^[a-z0-9-]+$/.test(slug)||seen.has(url.href))continue;
  const title=heading.replace(/<[^>]+>/g,'').trim();if(!title)continue;
  seen.add(url.href);found.push({title,url:url.href});if(found.length===40)break;
 }
 return found;
}

export async function fetchPublisherIndex(source,options={}){
 const cache=options.requestContext?.publisherRSS??new Map(),key=`publisher-index:${source.url}`;
 if(!cache.has(key))cache.set(key,(async()=>{
  const empty={rss:{channel:{item:[]}}},timeout=AbortSignal.timeout(8000),signal=options.signal?AbortSignal.any([options.signal,timeout]):timeout;
  let links;
  try{
   const response=await(options.fetchImpl??publisherFetch)(new URL(source.url),{signal,redirect:'error',headers:{'user-agent':'LatamDigestStaticFeedGenerator/1.0'}});
   if(!response.ok){await response.body?.cancel();return empty;}
   links=publisherIndexLinks(await response.text(),source);
  }catch{options.signal?.throwIfAborted();return empty;}
  const items=[];
  for(let i=0;i<links.length;i+=3){
   options.signal?.throwIfAborted();
   const checked=await Promise.all(links.slice(i,i+3).map(a=>verifyPublisherArticle(a,source,options)));
   for(const a of checked)if(a)items.push({title:a.title,link:a.url,pubDate:a.publishedAt});
  }
  return {rss:{channel:{item:items}}};
 })());
 return cache.get(key);
}
