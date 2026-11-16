import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchPublisherArchive} from '../src/publisherArchive.js';
import {fetchPublisherArticles,createFeedRequestContext} from '../scripts/generate-static-feeds.mjs';
import {countryPublisherFeeds} from '../src/publisherSources.js';
import {feedConfigs,isRelevantArticle} from '../src/feedSearch.js';
import {verifyPublisherArticle} from '../src/publisherArticle.js';
const source={url:'https://publisher.example/wp-json/wp/v2/posts',kind:'wordpress'};
const instant=async()=>{};
const date=days=>new Date(Date.now()-days*86400000).toISOString();
const post=(id=1)=>({id,date_gmt:date(2).slice(0,19),link:`https://publisher.example/news/${id}`,title:{rendered:`Report ${id}`}});

test('publisher archives discover beyond short RSS lists, preserve GMT publication dates and share one bounded request set',async()=>{
 const calls=[],requestContext=createFeedRequestContext();
 const fetchImpl=async u=>{calls.push(u);return new Response(JSON.stringify(u.searchParams.get('page')==='1'?Array.from({length:100},(_,i)=>post(i+1)):[post(101)]));};
 const a=await fetchPublisherArchive(source,{requestContext,fetchImpl});
 assert.equal(a.rss.channel.item.length,101);assert.equal(a.rss.channel.item[0].pubDate,post().date_gmt+'Z');
 assert.ok(calls.every(u=>u.hostname==='publisher.example'&&u.searchParams.get('orderby')==='date'&&u.searchParams.has('after')&&!u.searchParams.has('modified_after')));
 await fetchPublisherArchive(source,{requestContext,fetchImpl});assert.equal(calls.length,2);
 await fetchPublisherArchive(source,{fetchImpl});assert.equal(calls.length,4);
});

test('archive pagination cannot loop, expand into response URLs or exceed eight 100-item pages',async()=>{
 let calls=0;
 const a=await fetchPublisherArchive(source,{fetchImpl:async u=>{calls++;return new Response(JSON.stringify(Array.from({length:100},(_,i)=>post(i+100*Number(u.searchParams.get('page'))))));}});
 assert.equal(calls,8);assert.equal(a.rss.channel.item.length,800);
 calls=0;await fetchPublisherArchive(source,{fetchImpl:async()=>{calls++;return new Response(JSON.stringify(Array.from({length:100},(_,i)=>post(i))));}});assert.equal(calls,2);
});

test('archive discovery rejects undated, local-time-only, malformed and modified-only records',async()=>{
 const bad=[{...post(),date_gmt:undefined,date:'2026-11-15T12:00:00',modified_gmt:post().date_gmt},{...post(2),date_gmt:'2026-11-15'},{...post(3),title:{rendered:null}}];
 const a=await fetchPublisherArchive(source,{fetchImpl:async()=>new Response(JSON.stringify(bad))});assert.equal(a.rss.channel.item.length,0);
 for(const body of ['null','<html>unavailable</html>','{"message":"private response"}',JSON.stringify(Array.from({length:101},(_,i)=>post(i)))]){
  let calls=0;assert.equal((await fetchPublisherArchive(source,{fetchImpl:async()=>{calls++;return new Response(body);}})).rss.channel.item.length,0);assert.equal(calls,1);
 }
});

test('archive outages are bounded, respect throttling and Retry-After, and never hide cancellation',async()=>{
 let calls=0;const context=createFeedRequestContext();
 await fetchPublisherArchive(source,{requestContext:context,sleep:instant,fetchImpl:async()=>{calls++;return new Response('unavailable',{status:503});}});assert.equal(calls,2);
 await fetchPublisherArchive(source,{requestContext:context,fetchImpl:async()=>{throw new Error('must reuse failure')}});
 for(const status of [401,403,429,503]){calls=0;await fetchPublisherArchive(source,{sleep:instant,fetchImpl:async()=>{calls++;return new Response('private response',{status,headers:{'retry-after':'120'}});}});assert.equal(calls,1);}
 await assert.rejects(fetchPublisherArchive(source,{signal:AbortSignal.abort()}),{name:'AbortError'});
});

test('Outremers discovery is bounded and uses published Atlantic articles with original primary verification still required',async()=>{
 const s={url:'https://api.outremers360.com/api/articles',kind:'outremers'};let calls=0;
 const a=await fetchPublisherArchive(s,{fetchImpl:async u=>{calls++;assert.equal(u.hostname,'api.outremers360.com');return new Response(JSON.stringify({'hydra:member':[{id:1,title:'Guyane technologie',alias:'guyane-technologie',createdAt:date(2),status:'publish',category:[{alias:'bassin-atlantique-appli'}]},{id:2,title:'draft',alias:'draft',createdAt:date(2),status:'draft',category:[]}],'hydra:view':{'hydra:next':'https://attacker.example/steal'}}));}});
 assert.equal(a.rss.channel.item.length,1);assert.equal(calls,2);assert.equal(a.rss.channel.item[0].link,'https://outremers360.com/bassin-atlantique-appli/guyane-technologie');
});

test('an archive cannot substitute fresh API dates for an expired original publisher article',async()=>{
 const c={id:'CR',name:'Costa Rica'},f=feedConfigs.find(f=>f.key==='tech');
 const s=countryPublisherFeeds.CR.find(s=>s.kind==='wordpress'),title='Costa Rica launches cybersecurity technology',url=`https://${s.hosts[0]}/verified-test`;
 const result=await fetchPublisherArticles(c,f,{sleep:instant,fetchImpl:async u=>{
  if(u.href===url)return new Response(`<meta property="og:title" content="${title}"><meta property="article:published_time" content="${date(14)}">`);
  if(u.href.startsWith(s.url))return new Response(JSON.stringify([{...post(),title:{rendered:title},link:url}]));
  return new Response('<rss><channel/></rss>');
 }});assert.equal(result.length,0);
});

test('primary date proof is bound to both the original URL and the matching headline',async()=>{
 const context=createFeedRequestContext(),a={url:'https://publisher.example/story',title:'Original news'};
 const options={requestContext:context,fetchImpl:async()=>new Response(`<meta property="og:title" content="Original news"><meta property="article:published_time" content="${date(1)}">`)};
 assert.ok(await verifyPublisherArticle(a,{hosts:['publisher.example']},options));
 assert.equal(await verifyPublisherArticle({...a,title:'Unrelated replacement headline'},{hosts:['publisher.example']},options),null);
});

test('French victim and domestic-violence reports retain independent country and criminal context',()=>{
 const c={id:'GF',name:'French Guiana'},f=feedConfigs.find(f=>f.key==='crime');
 const a={title:'Le Carbet des femmes accueille les victimes de violences à Saint-Laurent-du-Maroni',sourceName:'Outre-mer La 1ère',url:'https://la1ere.franceinfo.fr/guyane/test',publishedAt:date(1)};
 assert.equal(isRelevantArticle(a,c,f,{lookbackDays:13}),true);
 assert.equal(isRelevantArticle({...a,title:'Les victimes de violences à Paris'},c,f,{lookbackDays:13}),false);
 assert.equal(isRelevantArticle({...a,publishedAt:date(14)},c,f,{lookbackDays:13}),false);
 assert.equal(isRelevantArticle({...a,title:'Guyane : une décision de justice civile sur un contrat commercial'},c,f,{lookbackDays:13}),false);
});

test('malformed archive records cannot interrupt other publisher recovery',async()=>{
 const source={url:'https://api.outremers360.com/api/articles',kind:'outremers'};
 const a=await fetchPublisherArchive(source,{fetchImpl:async()=>new Response(JSON.stringify({'hydra:member':[
  {id:1,status:'publish',title:'Guyane',alias:'guyane',createdAt:date(1),category:{}},
  {id:2,status:'publish',title:'Guyane',alias:'guyane',createdAt:date(1),category:[null]},null
 ]}))});assert.equal(a.rss.channel.item.length,0);
});


test('an explicitly dated older embassy reprint cannot gain a fresh date from its republication page',()=>{
 const c={id:'PA',name:'Panama'},f=feedConfigs.find(f=>f.key==='world');
 const a={title:'Press Release from the United States Embassy in Panama Oct 26, 2026.',sourceName:'Newsroom Panama',url:'https://newsroompanama.com/2026/11/03/press-release-from-the-united-states-embassy-in-panama-oct-26-2026/',publishedAt:date(1)};
 assert.equal(isRelevantArticle(a,c,f,{lookbackDays:13}),false);
 assert.equal(isRelevantArticle(a,c,feedConfigs[0],{lookbackDays:13}),false);
 assert.equal(isRelevantArticle({...a,title:'United States Embassy in Panama announces new cooperation agreement'},c,f,{lookbackDays:13}),true);
});


test('a reviewed musical tour still needs both its artist and tour identity, national relevance and a fresh original date',()=>{
 const c={id:'PY',name:'Paraguay'},f=feedConfigs.find(f=>f.key==='culture');
 const a={title:'Cuenta regresiva: En 18 días Gorillaz vuelve a Paraguay con su The Mountain Tour',sourceName:'Última Hora',url:'https://www.ultimahora.com/cuenta-regresiva-en-18-dias-gorillaz-vuelve-a-paraguay-con-su-the-mountain-tour',publishedAt:date(1)};
 assert.equal(isRelevantArticle(a,c,f,{lookbackDays:13}),true);
 for(const title of ['The Mountain Tour llega a Paraguay','Gorillaz anuncia resultados financieros en Paraguay','Gorillaz llega a México con The Mountain Tour','El tour de ciclismo llega a Paraguay'])assert.equal(isRelevantArticle({...a,title},c,f,{lookbackDays:13}),false);
 assert.equal(isRelevantArticle({...a,publishedAt:date(14)},c,f,{lookbackDays:13}),false);
 assert.equal(isRelevantArticle(a,c,feedConfigs.find(f=>f.key==='world'),{lookbackDays:13}),false);
});
