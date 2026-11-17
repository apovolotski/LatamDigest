import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {publisherSourcesFor} from '../src/publisherSources.js';
import {feedConfigs, isRelevantArticle, searchPlans} from '../src/feedSearch.js';
import {fetchArticlesForFeed, generateFeeds, toArticle} from '../scripts/generate-static-feeds.mjs';
import {refreshFeeds} from '../scripts/refresh-static-feeds.mjs';
import {checkCoverage} from '../scripts/check-feed-coverage.mjs';

const country={id:'GF',name:'French Guiana'}, world=feedConfigs.find(f=>f.key==='world');
const title='Guyane. Fonds européens : logement, eau, défense, les nouvelles orientations de la Collectivité Territoriale';
const url='https://www.karibinfo.com/news/guyane-fonds-europeens-logement-eau-defense-les-nouvelles-orientations-de-la-collectivite-territoriale/';
const date=days=>new Date(Date.now()-days*86400000).toISOString();
const article=(days=6)=>toArticle({title,link:url,pubDate:date(days),source:'KARIBINFO'},country,world);
const instant=async()=>{};

function publisherFixture({googleStatus=200,originalDate=date(6),archiveDate=date(1)}={}) {
  const calls=[];
  const fetchImpl=async address=>{
    const u=new URL(address);calls.push(u.href);
    if(u.hostname==='news.google.com')return new Response(googleStatus===200?'<rss><channel/></rss>':'unavailable',{status:googleStatus});
    if(u.href===url)return new Response(`<meta property="og:title" content="${title} - KARIBINFO"><script type="application/ld+json">${JSON.stringify({'@type':'NewsArticle',headline:title,datePublished:originalDate})}</script>`);
    if(u.hostname==='www.karibinfo.com'&&u.pathname==='/wp-json/wp/v2/posts')return new Response(JSON.stringify([{id:184330,date_gmt:archiveDate.slice(0,19),link:url,title:{rendered:title}}]));
    return new Response('<rss><channel/></rss>');
  };
  return {calls,fetchImpl,sleep:instant};
}

test('EU public funding needs independent national and institutional evidence, with the same date and category limits',()=>{
  const a=article();
  assert.equal(isRelevantArticle(a,country,world,{lookbackDays:13}),true);
  for(const t of ['Guyane : des fonds européens investissent dans une entreprise privée','Guyane : festival européen de musique','Fonds européens : les orientations de la Collectivité Territoriale de Martinique','Guyane : la Collectivité Territoriale inaugure une école'])
    assert.equal(isRelevantArticle({...a,title:t},country,world,{lookbackDays:13}),false,t);
  assert.equal(isRelevantArticle(article(13.1),country,world,{lookbackDays:13}),false);
  assert.equal(isRelevantArticle(article(-2),country,world,{lookbackDays:13}),false);
  assert.equal(isRelevantArticle(a,country,feedConfigs.find(f=>f.key==='sports'),{lookbackDays:13}),false);
});

test('all ten Guyane categories can discover the added archive; widened searches remain bounded and country scoped',()=>{
  for(const feed of feedConfigs){
    const s=publisherSourcesFor(country,feed).find(s=>s.name==='KARIBINFO');
    assert.ok(s);assert.equal(s.kind,'wordpress');assert.deepEqual(s.hosts,['www.karibinfo.com']);
    assert.equal(new URL(s.url).searchParams.get('search'),'Guyane');
  }
  const plans=searchPlans(country,world);assert.equal(plans.length,3);
  assert.match(plans[1].query,/"Guyane".*"fonds européens".*when:14d/);
  assert.equal((plans[1].query.match(/ OR /g)??[]).length,5);
});

for(const googleStatus of [200,503])test(`incident 44173537851: fresh original reporting replaces an aging singleton when Google returns ${googleStatus}`,async()=>{
  const originalDate=date(6),options=publisherFixture({googleStatus,originalDate});
  const a=await fetchArticlesForFeed(country,world,options);
  assert.equal(a.length,1);assert.equal(a[0].url,url);assert.equal(a[0].publishedAt,originalDate);
  assert.equal(a[0].sourceName,'KARIBINFO');assert.deepEqual(a.coverage.publishers,['KARIBINFO']);
  assert.ok(options.calls.some(u=>u.startsWith('https://www.karibinfo.com/wp-json/wp/v2/posts?search=Guyane')));
});

test('fresh archive discovery cannot renew an expired original Karibinfo story',async()=>{
  const a=await fetchArticlesForFeed(country,world,publisherFixture({originalDate:date(14),archiveDate:date(1)}));
  assert.equal(a.length,0);
});

test('aging Guyane world singleton recovers through the atomic pipeline without using expired feed cache',async t=>{
  const dir=await mkdtemp(path.join(tmpdir(),'latam-guyane-world-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const destination=path.join(dir,'api'),countries=[country];
  const generic=toArticle({title:'Guyane politics business football technology music crime economy diplomacy',link:'https://example.com/guyane',source:'Example',pubDate:date(1)},country,world);
  await generateFeeds({destination,countries,fetchFeed:async()=>[generic]});
  const manifestFile=path.join(destination,'manifest.json'),m=JSON.parse(await readFile(manifestFile));
  for(const status of Object.values(m.countries[0].feeds))status.updatedAt=date(49/24);
  await writeFile(manifestFile,JSON.stringify(m));
  const worldFile=path.join(destination,'countries/GF/category/world.json');
  await writeFile(worldFile,JSON.stringify([{...generic,title:'Guyane : la Commission européenne en visite',publishedAt:date(13.2)}]));
  const originalDate=date(6);
  const live=publisherFixture({googleStatus:503,originalDate});
  const status=await refreshFeeds({destination,countries,summaryFile:path.join(dir,'summary'),sleep:instant,
    generate:o=>generateFeeds({...o,fetchFeed:(c,f)=>f.key==='world'?fetchArticlesForFeed(c,f,live):[generic]})});
  assert.equal(status.state,'healthy');assert.equal(status.refreshedFeeds,10);assert.equal(status.cachedFeeds,0);
  const current=JSON.parse(await readFile(worldFile));assert.equal(current[0].publishedAt,originalDate);assert.equal(current[0].url,url);
  const horizon=await checkCoverage({destination,countries,now:Date.now()+86400000});assert.deepEqual(horizon.issues,[]);
});
