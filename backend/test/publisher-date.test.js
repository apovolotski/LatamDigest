import test from 'node:test';
import assert from 'node:assert/strict';
import {originalPublisherDate,verifyPublisherArticle} from '../src/publisherArticle.js';
import {createFeedRequestContext,fetchPublisherArticles} from '../scripts/generate-static-feeds.mjs';
import {feedConfigs} from '../src/feedSearch.js';
import {articleID} from '../src/articleIdentity.js';
const title='Argentina technology researchers develop software',url='https://buenosairesherald.com/reviewed-story';
const date=days=>new Date(Date.now()-days*86400000).toISOString();
const source={hosts:['buenosairesherald.com']};
const article=()=>({id:articleID(url),title,url,publishedAt:date(0),sourceName:'Buenos Aires Herald'});
const page=(published,modified=date(0),headline=title)=>`<meta property="og:title" content="${headline}"><meta property="article:published_time" content="${published}"><script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':[{'@type':'NewsArticle',headline,datePublished:published,dateModified:modified}]})}</script>`;

test('publisher original dates replace RSS update times and never use dateModified',async()=>{
 const original=date(4),rss=article();const result=await verifyPublisherArticle(rss,source,{fetchImpl:async()=>new Response(page(original))});
 assert.equal(result.publishedAt,original);assert.equal(result.url,rss.url);assert.equal(result.id,rss.id);
 assert.equal(originalPublisherDate(`<script type="application/ld+json">${JSON.stringify({'@type':'NewsArticle',headline:title,dateModified:date(0)})}</script>`,title),null);
});

test('ambiguous, date-only, undated and unrelated primary metadata fail closed',()=>{
 assert.equal(originalPublisherDate(page(date(1))+`<meta property="article:published_time" content="${date(2)}">`,title),null);
 assert.equal(originalPublisherDate(page('2026-11-15'),title),null);
 assert.equal(originalPublisherDate(page(date(0),date(0),'Canada technology report'),title),null);
 assert.equal(originalPublisherDate('<html>Recent report without publication metadata</html>',title),null);
 assert.equal(originalPublisherDate(`<script type="application/ld+json">${JSON.stringify({'@type':'WebPage',datePublished:date(0),headline:title})}</script>`,title),null);
});

test('fresh RSS cannot renew a publisher article older than the 13-day publication limit',async()=>{
 const country={id:'AR',name:'Argentina'},feed=feedConfigs.find(f=>f.key==='tech');
 const rss=`<rss><channel><item><title>${title}</title><link>${url}</link><pubDate>${date(0)}</pubDate></item></channel></rss>`;
 for(const days of [14,-2]){
  const articles=await fetchPublisherArticles(country,feed,{fetchImpl:async u=>new Response(String(u)===url?page(date(days)):rss)});
  assert.equal(articles.length,0);
 }
 const original=date(3);
 const articles=await fetchPublisherArticles(country,feed,{fetchImpl:async u=>new Response(String(u)===url?page(original):rss)});
 assert.equal(articles.length,1);assert.equal(articles[0].publishedAt,original);
});

test('publisher redirects stay on exact HTTPS article hosts and have a bounded hop count',async()=>{
 for(const target of ['http://buenosairesherald.com/a','https://evil.example/a','https://buenosairesherald.com.evil.example/a','https://user:secret@buenosairesherald.com/a','http://127.0.0.1/']){
  let calls=0;const a=await verifyPublisherArticle(article(),source,{fetchImpl:async()=>{calls++;return new Response('',{status:302,headers:{location:target}});}});assert.equal(a,null);assert.equal(calls,1);
 }
 let calls=0;const original=date(2);
 const good=await verifyPublisherArticle(article(),source,{fetchImpl:async u=>{calls++;return String(u)===url?new Response('',{status:301,headers:{location:'/canonical-story'}}):new Response(page(original));}});
 assert.equal(calls,2);assert.equal(good.publishedAt,original);
 calls=0;assert.equal(await verifyPublisherArticle(article(),source,{fetchImpl:async()=>{calls++;return new Response('',{status:301,headers:{location:'/loop'}});}}),null);assert.equal(calls,4);
});

test('primary page evidence and failures are reused within one generation only, and cancellation stays fatal',async()=>{
 let calls=0;const requestContext=createFeedRequestContext(),fetchImpl=async()=>{calls++;return new Response('',{status:503});};
 assert.equal(await verifyPublisherArticle(article(),source,{requestContext,fetchImpl}),null);
 assert.equal(await verifyPublisherArticle(article(),source,{requestContext,fetchImpl}),null);assert.equal(calls,1);
 await verifyPublisherArticle(article(),source,{requestContext:createFeedRequestContext(),fetchImpl});assert.equal(calls,2);
 const controller=new AbortController();controller.abort();
 await assert.rejects(verifyPublisherArticle(article(),source,{signal:controller.signal,fetchImpl:async()=>{throw new Error('private transport detail');}}));
});

test('primary matching decodes text entities but ignores unrelated recommended-article dates',()=>{
 const headline='Trinidad & Tobago: artist’s film',original=date(2);
 const html=`<meta property="og:title" content="Trinidad &amp; Tobago: artist&#8217;s film"><meta property="article:published_time" content="${original}"><script type="application/ld+json">${JSON.stringify({'@type':'WebPage',itemListElement:[{'@type':'NewsArticle',headline,datePublished:date(0)}]})}</script>`;
 assert.equal(originalPublisherDate(html,headline),original);
});

test('principal WebPage mainEntity dates are accepted only for the matching article, not recommended stories',()=>{
 const title='Guyane accueille les victimes de violences',published='2026-11-14T20:19:59+01:00';
 const wrap=node=>`<script type="application/ld+json">${JSON.stringify(node)}</script>`;
 const article={'@type':'NewsArticle',headline:title,datePublished:published};
 assert.equal(originalPublisherDate(wrap({'@type':'WebPage',mainEntity:article}),title),'2026-11-14T19:19:59.000Z');
 assert.equal(originalPublisherDate(wrap({'@type':'WebPage',mainEntity:{...article,headline:'Another story'}}),title),null);
 assert.equal(originalPublisherDate(wrap({'@type':'WebPage',itemListElement:[article],datePublished:published}),title),null);
 assert.equal(originalPublisherDate(wrap({'@type':'WebPage',mainEntity:{...article,datePublished:undefined,dateModified:published}}),title),null);
});

test('publication precision differences retain the earliest stated instant, while conflicting dates still fail',()=>{
 const title='Puerto Rico technology report',meta=d=>`<meta property="og:title" content="${title}"><meta property="article:published_time" content="${d}">`;
 assert.equal(originalPublisherDate(meta('2026-11-14T20:53:38.984Z')+meta('2026-11-14T20:53:38Z'),title),'2026-11-14T20:53:38.000Z');
 for(const other of ['2026-11-14T20:53:39Z','2026-11-14T20:53:38.700Z','2026-11-13T20:53:38Z'])assert.equal(originalPublisherDate(meta('2026-11-14T20:53:38.984Z')+meta(other),title),null);
});

test('primary metadata may append an exact reviewed publisher credit without weakening headline identity',()=>{
 const title='Cartelera Cinemateca Boliviana – 12 al 18 de noviembre',published='2026-11-12T14:05:13-04:00';
 const html=t=>`<meta property="og:title" content="${t}"><meta property="article:published_time" content="${published}">`;
 assert.equal(originalPublisherDate(html(title+' - movidadealtura.com'),title,['movidadealtura.com']),'2026-11-12T18:05:13.000Z');
 assert.equal(originalPublisherDate(html(title+' - Unknown publisher'),title,['movidadealtura.com']),null);
 assert.equal(originalPublisherDate(html(title+' and unrelated new claim - movidadealtura.com'),title,['movidadealtura.com']),null);
 assert.equal(originalPublisherDate(html(title+' - movidadealtura.com'),title),null);
});
