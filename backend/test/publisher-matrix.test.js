import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {countryPublisherFeeds, publisherSourcesFor} from '../src/publisherSources.js';
import {feedConfigs, isRelevantArticle} from '../src/feedSearch.js';
import {createFeedRequestContext, fetchArticlesForFeed, fetchPublisherArticles, generateFeeds, toArticle} from '../scripts/generate-static-feeds.mjs';
import {refreshFeeds} from '../scripts/refresh-static-feeds.mjs';
import {checkCoverage} from '../scripts/check-feed-coverage.mjs';
import {validateHealth} from '../src/watchdogPolicy.js';
const countries=JSON.parse(await readFile(new URL('../../LatamDigest/Resources/Countries.json',import.meta.url)));
const instant=async()=>{};
const date=days=>new Date(Date.now()-days*86400000).toISOString();
const title=(c,f)=>`${c.id==='GF'?'Guyane':c.name}: ${{top:'news report',latest:'news update',politics:'election results',business:'company expands business',sports:'football team wins',tech:'technology researchers develop software',culture:'museum opens art exhibition',crime:'police arrest murder suspect',economy:'inflation falls as economy grows',world:'diplomacy and foreign relations with Canada'}[f.key]}`;
const story=(c,f,host=publisherSourcesFor(c,f)[0].hosts[0])=>({title:title(c,f),link:`https://${host}/test/${c.id}/${f.key}`,pubDate:date(1)});
const xml=items=>`<rss><channel><lastBuildDate>${date(0)}</lastBuildDate>${items.map(i=>`<item><title><![CDATA[${i.title}]]></title><link><![CDATA[${i.link}]]></link>${i.pubDate?`<pubDate>${i.pubDate}</pubDate>`:''}</item>`).join('')}</channel></rss>`;

function publisherNetwork(googleStatus=503) {
  const calls=new Map();
  const fetchImpl=async url=>{
    const u=String(url);calls.set(u,(calls.get(u)??0)+1);
    if(url.hostname==='news.google.com')return new Response(googleStatus===200?xml([]):'mock outage',{status:googleStatus});
    if (url.pathname.startsWith('/test/')) {
      const [id,key]=url.pathname.slice(6).split('/'),c=countries.find(c=>c.id===id),f=feedConfigs.find(f=>f.key===key);
      return new Response(`<meta property="og:title" content="${title(c,f)}"><meta property="article:published_time" content="${date(1)}">`);
    }
    const items=[];
    for(const c of countries)for(const f of feedConfigs){
      const source=publisherSourcesFor(c,f).find(s=>s.url===u);
      if(source)items.push(story(c,f,source.hosts[0]));
    }
    return new Response(xml(items));
  };
  return {calls,fetchImpl};
}

test('publisher registry covers the exact 24-country by 10-category production matrix with independent hosts',()=>{
  assert.equal(countries.length*feedConfigs.length,240);
  assert.deepEqual(Object.keys(countryPublisherFeeds).sort(),countries.map(c=>c.id).sort());
  for(const c of countries)for(const f of feedConfigs){
    const sources=publisherSourcesFor(c,f);
    assert.ok(countryPublisherFeeds[c.id].length>0,`${c.id} needs a national publisher`);
    assert.ok(new Set(sources.flatMap(s=>s.hosts)).size>=2,`${c.id}/${f.key}`);
    assert.equal(new Set(sources.map(s=>s.url)).size,sources.length);
    for(const s of sources){const u=new URL(s.url);assert.equal(u.protocol,'https:');assert.equal(u.username+u.password+u.port,'');assert.doesNotMatch(u.hostname,/google/);assert.ok(s.name);assert.ok(s.hosts.every(h=>new URL(`https://${h}`).host===h));}
  }
  assert.deepEqual(publisherSourcesFor({id:'UNKNOWN'},feedConfigs[0]),[]);
});

for(const status of [200,503])test(`every one of 240 feeds recovers from ${status===200?'empty Google results':'a Google HTTP 503'} with valid publisher news`,async()=>{
  const network=publisherNetwork(status),requestContext=createFeedRequestContext();
  for(const c of countries)for(const f of feedConfigs){
    const a=await fetchArticlesForFeed(c,f,{...network,requestContext,sleep:instant});
    assert.ok(a.length>0,`${c.id}/${f.key}`);
    assert.ok(a.every(x=>isRelevantArticle(x,c,f,{lookbackDays:13})),`${c.id}/${f.key}`);
    assert.ok(a.every(x=>!x.url.includes('news.google.com')));
    assert.ok(a.coverage.publishers.length>0);
  }
  const google=[...network.calls].filter(([u])=>new URL(u).hostname==='news.google.com').reduce((n,[,v])=>n+v,0);
  if(status===503)assert.equal(google,15,'stop the primary after five exhausted three-attempt requests');
  for(const [u,n]of network.calls)if(new URL(u).hostname!=='news.google.com')assert.equal(n,1,'reuse each RSS response across categories');
});

test('all 240 routes reject wrong-country, wrong-host, old, future, undated and unsafe publisher entries',async()=>{
  for(const c of countries)for(const f of feedConfigs){
    const good=story(c,f),bad=[
      {...good,title:'Canada news report about elections, football, technology and diplomacy'},
      {...good,link:'https://attacker.example/report'}, {...good,link:good.link.replace('https:','http:')},
      {...good,link:good.link.replace('https://','https://user:secret@')},
      {...good,pubDate:date(13.1)}, {...good,pubDate:date(-2)}, {...good,pubDate:null}
    ];
    const a=await fetchPublisherArticles(c,f,{fetchImpl:async()=>new Response(xml(bad))});
    assert.equal(a.length,0,`${c.id}/${f.key}`);
  }
});

test('a local publisher or section never supplies missing category evidence',async()=>{
  for(const c of countries)for(const f of feedConfigs.filter(f=>!['top','latest'].includes(f.key))){
    const item={...story(c,f),title:`${c.id==='GF'?'Guyane':c.name}: weather forecast for tomorrow`};
    assert.equal((await fetchPublisherArticles(c,f,{fetchImpl:async()=>new Response(xml([item]))})).length,0,`${c.id}/${f.key}`);
  }
});

test('cached publisher responses preserve item dates and stable IDs; new refresh contexts fetch again',async()=>{
  const c=countries[0], f=feedConfigs[0],item=story(c,f);let calls=0;
  const fetchImpl=async()=>{calls++;return new Response(xml([item]));},requestContext=createFeedRequestContext();
  const a=await fetchPublisherArticles(c,f,{fetchImpl,requestContext,verifyPublisherArticle:async a=>a});const once=calls;
  const b=await fetchPublisherArticles(c,feedConfigs[1],{fetchImpl,requestContext,verifyPublisherArticle:async a=>a});
  assert.equal(calls,once);assert.equal(a[0].publishedAt,item.pubDate);assert.equal(b[0].id,a[0].id);
  await fetchPublisherArticles(c,f,{fetchImpl,requestContext:createFeedRequestContext(),verifyPublisherArticle:async a=>a});assert.equal(calls,once*2);
});

test('failed publishers are also cached per refresh and one failed host does not stop the other sources',async()=>{
  const c=countries[0],f=feedConfigs[0],sources=publisherSourcesFor(c,f),failed=sources[0].url;
  const requestContext=createFeedRequestContext(),calls=new Map();
  const fetchImpl=async url=>{const u=String(url);calls.set(u,(calls.get(u)??0)+1);if(u===failed)return new Response('private response',{status:503});const s=sources.find(s=>s.url===u);return new Response(xml([story(c,f,s.hosts[0])]));};
  const a=await fetchPublisherArticles(c,f,{requestContext,fetchImpl,sleep:instant,verifyPublisherArticle:async a=>a});
  assert.ok(a.length);assert.equal(calls.get(failed),3);
  await fetchPublisherArticles(c,feedConfigs[1],{requestContext,fetchImpl,sleep:instant,verifyPublisherArticle:async a=>a});assert.equal(calls.get(failed),3);
  assert.ok(!JSON.stringify(a).includes('private response'));
});

test('successful primary requests reset the failure streak instead of permanently disabling a recovered provider',async()=>{
  const c=countries[0],f=feedConfigs[0],requestContext=createFeedRequestContext();let fail=true;
  const options={requestContext,sleep:instant,fetchPublisher:async()=>[],fetchImpl:async()=>new Response(fail?'':xml([1,2,3].map(n=>({...story(c,f),title:`${title(c,f)} ${n}`,link:`https://example.com/${n}`}))),{status:fail?503:200})};
  for(let i=0;i<4;i++)await assert.rejects(fetchArticlesForFeed(c,f,options));
  fail=false;assert.equal((await fetchArticlesForFeed(c,f,options)).length,3);assert.equal(requestContext.primary.failures,0);
  fail=true;await assert.rejects(fetchArticlesForFeed(c,f,options));assert.equal(requestContext.primary.blocked,false);
});

test('full primary outage publishes all 240 freshly fetched publisher feeds through the real atomic validation path',async t=>{
  const folder=await mkdtemp(path.join(tmpdir(),'latam-all-publisher-'));t.after(()=>rm(folder,{recursive:true,force:true}));
  const destination=path.join(folder,'api'),network=publisherNetwork();
  const status=await refreshFeeds({destination,countries,sleep:instant,summaryFile:path.join(folder,'summary'),
    generate:o=>generateFeeds({...o,fetchFeed:(c,f,options)=>fetchArticlesForFeed(c,f,{...options,...network,sleep:instant})})});
  assert.equal(status.refreshedFeeds,240);assert.equal(status.cachedFeeds,0);assert.equal(status.state,'healthy');
  assert.deepEqual((await checkCoverage({destination,countries,minimumFreshnessMs:86400000})).issues,[]);
  const manifest=JSON.parse(await readFile(path.join(destination,'manifest.json')));
  assert.deepEqual(validateHealth({manifest,health:status,now:Date.now(),total:240}).issues,[]);
  assert.equal([...network.calls].filter(([u])=>new URL(u).hostname==='news.google.com').reduce((n,[,v])=>n+v,0),15);
});

test('empty publishers after the Google circuit opens still reach every country before safely retaining the cache',async t=>{
  const folder=await mkdtemp(path.join(tmpdir(),'latam-empty-publisher-'));t.after(()=>rm(folder,{recursive:true,force:true}));
  const destination=path.join(folder,'api');
  await generateFeeds({destination,countries,fetchFeed:async(c,f)=>[toArticle({...story(c,f),source:'Example'},c,f)]});
  const before=JSON.parse(await readFile(path.join(destination,'manifest.json'))),reached=new Set();
  const status=await refreshFeeds({destination,countries,sleep:instant,summaryFile:path.join(folder,'summary'),recover:async()=>({succeeded:0}),
    generate:o=>generateFeeds({...o,fetchFeed:(c,f,options)=>fetchArticlesForFeed(c,f,{...options,sleep:instant,
      fetchImpl:async()=>new Response('mock outage',{status:503}),fetchPublisher:async(c,f)=>{reached.add(`${c.id}/${f.key}`);return [];}})})});
  assert.equal(reached.size,240);assert.equal(status.cachedFeeds,240);assert.equal(status.refreshedFeeds,0);assert.equal(status.state,'degraded');
  const after=JSON.parse(await readFile(path.join(destination,'manifest.json')));assert.equal(after.generatedAt,before.generatedAt);
  for(let i=0;i<countries.length;i++)for(const f of feedConfigs)assert.equal(after.countries[i].feeds[f.key].updatedAt,before.countries[i].feeds[f.key].updatedAt);
  const file=path.join(destination,'countries/GF/category/world.json');await writeFile(file,JSON.stringify([{...toArticle({...story(countries.at(-1),feedConfigs.at(-1)),source:'Example'},countries.at(-1),feedConfigs.at(-1)),publishedAt:date(14)}]));
  await assert.rejects(refreshFeeds({destination,countries,sleep:instant,recover:async()=>({succeeded:0}),generate:async()=>{throw new (await import('../src/rssClient.js')).UpstreamUnavailableError(new (await import('../src/rssClient.js')).FeedRequestError('http',{status:503,retryable:true}));}}),/GF\/world: empty feed/);
});

test('publisher transport is bounded to three concurrent requests and honors cancellation',async()=>{
 const c=countries.find(c=>c.id==='SR'),f=feedConfigs.find(f=>f.key==='tech');let active=0,max=0;
 const result=await fetchPublisherArticles(c,f,{fetchImpl:async()=>{active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,2));active--;return new Response(xml([]));}});
 assert.equal(result.length,0);assert.ok(max<=3);assert.ok(max>1);
 const controller=new AbortController();controller.abort();
 await assert.rejects(fetchPublisherArticles(c,f,{signal:controller.signal,fetchImpl:()=>assert.fail('aborted transport must not fetch')}));
});
