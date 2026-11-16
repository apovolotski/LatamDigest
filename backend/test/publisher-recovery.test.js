import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fetchPublisherArticles, fetchArticlesForFeed, generateFeeds, toArticle } from '../scripts/generate-static-feeds.mjs';
import { refreshFeeds } from '../scripts/refresh-static-feeds.mjs';
import { feedConfigs, searchPlans, isRelevantArticle } from '../src/feedSearch.js';
import { FeedRequestError, UpstreamUnavailableError } from '../src/rssClient.js';
import { checkCoverage } from '../scripts/check-feed-coverage.mjs';
import { validateHealth } from '../src/watchdogPolicy.js';

const tt = { id: 'TT', name: 'Trinidad and Tobago' }, gf = { id: 'GF', name: 'French Guiana' };
const politics = feedConfigs.find(f => f.key === 'politics'), economy = feedConfigs.find(f => f.key === 'economy');
const ttTitle = 'US Assistant Secretary Of State Juan Pablo Segura To Visit T&T On November 16th';
const gfTitle = "Les entreprises guyanaises ont créé 1,8 milliard d'euros de valeur ajoutée en 2024";
const instant = async () => {};
const date = days => new Date(Date.now() - days * 86400000).toISOString();
const item = (title = ttTitle, link = 'https://www.ttt.live/reviewed-report/', days = 2) => ({ title, link, pubDate: date(days) });
const xml = items => `<rss><channel>${items.map(i => `<item><title><![CDATA[${i.title}]]></title><link><![CDATA[${i.link}]]></link><pubDate>${i.pubDate}</pubDate></item>`).join('')}</channel></rss>`;
const direct = items => async () => new Response(xml(items));
const outage = () => { throw new UpstreamUnavailableError(new FeedRequestError('http', {status: 503, retryable: true})); };

async function fixture(t) {
  const folder = await mkdtemp(path.join(tmpdir(), 'latam-publisher-recovery-'));
  t.after(() => rm(folder, {recursive: true, force: true}));
  const options = {destination: path.join(folder, 'api'), countries: [tt], summaryFile: path.join(folder, 'summary')};
  const generic = toArticle({ ...item('Trinidad and Tobago politics business sports technology culture crime economy diplomacy'), source: 'Example' }, tt, politics);
  await generateFeeds({...options, fetchFeed: async () => [generic]});
  const file = path.join(options.destination, 'countries/TT/category/politics.json');
  const old = {...generic, title: 'Workers Protest Policies of Trinidad and Tobago Government', publishedAt: date(13.2)};
  await writeFile(file, JSON.stringify([old]));
  const manifestFile = path.join(options.destination, 'manifest.json');
  const before = JSON.parse(await readFile(manifestFile));
  const recover = o => generateFeeds({...o, source: 'Direct publisher RSS with verified cache', fetchFeed: (c, f) => f.key !== "politics" ? [] : fetchPublisherArticles(c, f, {verifyPublisherArticle: async article => article, fetchImpl: direct([item()]), sleep: instant})});
  const snapshot = async () => Promise.all((await readdir(options.destination, {recursive:true})).filter(f=>f.endsWith('.json')).sort().map(async f=>[f,await readFile(path.join(options.destination,f),'utf8')]));
  return {options, file, manifestFile, before, recover, snapshot};
}

test('incident 43740770176: sparse TT politics and GF economy rotate distinct bounded search terms', () => {
  const p = searchPlans(tt, politics), e = searchPlans(gf, economy);
  assert.equal(p.length, 2); assert.equal(e.length, 3);
  assert.match(p[1].query, /"Tobago".*"prime minister".*"secretary of state".*when:14d/);
  assert.match(e[1].query, /"Guyane".*"valeur ajoutée".*when:14d/);
  assert.notEqual(p[0].query.replace('7d','14d'),p[1].query);
});

test('new political-office and quantified value-added evidence retains country and category boundaries', () => {
  for (const [c,f,title] of [[tt,politics,ttTitle],[gf,economy,gfTitle]]) {
    const a=toArticle({...item(title),source:'Example'},c,f);
    assert.equal(isRelevantArticle(a,c,f,{lookbackDays:13}),true);
    assert.equal(isRelevantArticle({...a,publishedAt:date(13.1)},c,f,{lookbackDays:13}),false);
    assert.equal(isRelevantArticle({...a,publishedAt:date(-2)},c,f,{lookbackDays:13}),false);
    assert.equal(isRelevantArticle(a,c,feedConfigs.find(x=>x.key==='sports'),{lookbackDays:13}),false);
  }
  for(const title of ['Tobago school secretary organises a concert','Secretary Of State Visits Canada'])
    assert.equal(isRelevantArticle(toArticle({...item(title),source:'Example'},tt,politics),tt,politics,{lookbackDays:13}),false);
  for(const title of ["L'art est une valeur ajoutée pour la Guyane", "Les entreprises martiniquaises ont créé 1,8 milliard d'euros de valeur ajoutée"])
    assert.equal(isRelevantArticle(toArticle({...item(title),source:'Example'},gf,economy),gf,economy,{lookbackDays:13}),false);
});

test('publisher fallback preserves the original date and stable URL while rejecting unsafe and unrelated items', async () => {
  const good=item(ttTitle,'https://www.ttt.live/reviewed-report/?utm_source=rss&utm_medium=rss');
  const articles=await fetchPublisherArticles(tt,politics,{verifyPublisherArticle: async article => article, fetchImpl:direct([good,
    item(ttTitle, 'https://evil.example/report'),item(ttTitle,'https://www.ttt.live.evil.example/report'),
    item(ttTitle,'https://user:secret@www.ttt.live/report'),item(ttTitle,'http://www.ttt.live/report'),
    item(ttTitle,'https://www.ttt.live/old',14),item(ttTitle,'https://www.ttt.live/future',-2),
    item('Tobago football championship'),item('US Secretary Of State visits Canada')])});
  assert.equal(articles.length,1); assert.equal(articles[0].publishedAt,good.pubDate);
  assert.equal(articles[0].url,'https://www.ttt.live/reviewed-report/');
  assert.equal(articles[0].sourceName,'TTT News'); assert.doesNotMatch(articles[0].snippet,/Google/);
  assert.equal(articles[0].id,toArticle({...good,link:articles[0].url,source:'TTT News'},tt,politics).id);
});

test('actual WordPress CDATA entities preserve national evidence and do not corrupt stable URLs', async () => {
  const encoded = item(ttTitle.replace('T&T', 'T&#038;T'), 'https://www.ttt.live/reviewed-report/?utm_source=rss&#038;utm_medium=rss');
  const a = await fetchPublisherArticles(tt, politics, {verifyPublisherArticle: async article => article, fetchImpl: direct([encoded])});
  assert.equal(a.length, 1); assert.equal(a[0].title, ttTitle);
  assert.equal(a[0].url, 'https://www.ttt.live/reviewed-report/');
  assert.equal(a[0].publishedAt, encoded.pubDate);
});

test('publisher economy feed does not turn its entire section into Guyane economic news', async () => {
  const good=item(gfTitle,'https://www.franceguyane.fr/actualite/economie-consommation/report.php',3);
  const articles=await fetchPublisherArticles(gf,economy,{verifyPublisherArticle: async article => article, fetchImpl:direct([good,
    item('France inflation en hausse','https://www.franceguyane.fr/france.php'),
    item('Guyane Cup : Trois duos brésiliens en finale','https://www.franceguyane.fr/sports.php'),
    item(gfTitle,'https://www.franceguyane.fr/old.php',14)])});
  assert.equal(articles.length,1);assert.equal(articles[0].publishedAt,good.pubDate);
});

for(const status of [200,503]) test(`independent publisher replaces an empty or failed Google response (${status})`,async()=>{
  let google=0,publisher=0;
  const a=await fetchArticlesForFeed(tt,politics,{sleep:instant,verifyPublisherArticle: async article => article, fetchImpl:async url=>{
    if(url.hostname==='news.google.com'){google++;return new Response(status===200?xml([]):'private outage body',{status});}
    publisher++;return new Response(xml([item()]));
  }});
  assert.equal(a.length,1);assert.equal(a[0].sourceName,'TTT News');
  assert.ok(google>0);assert.ok(publisher>0);assert.deepEqual(a.coverage.publishers,['TTT News']);
});

test('failed independent publisher preserves the original provider error without exposing response bodies',async()=>{
  await assert.rejects(fetchArticlesForFeed(tt,politics,{sleep:instant,verifyPublisherArticle: async article => article, fetchImpl:async()=>new Response('private body',{status:503})}),e=>e instanceof FeedRequestError && e.status===503 && !e.message.includes('private'));
  const abort=new AbortController();abort.abort();
  await assert.rejects(fetchPublisherArticles(tt,politics,{signal:abort.signal,verifyPublisherArticle: async article => article, fetchImpl:()=>assert.fail('aborted request')}));
});

test('incident 43748698009: primary outage plus aging singleton recovers atomically using a fresh publisher report',async t=>{
  const f=await fixture(t);
  const status=await refreshFeeds({...f.options,generate:outage,recover:f.recover,sleep:instant});
  assert.equal(status.refreshedFeeds,1);assert.equal(status.cachedFeeds,9);assert.equal(status.mode,'refreshed');assert.equal(status.state,'degraded');
  const current=JSON.parse(await readFile(f.manifestFile));
  for(const [key,s] of Object.entries(current.countries[0].feeds)){
    if(key==='politics'){assert.equal(s.stale,false);assert.ok(Date.parse(s.updatedAt)>=Date.parse(f.before.countries[0].feeds[key].updatedAt));}
    else{assert.equal(s.stale,true);assert.equal(s.updatedAt,f.before.countries[0].feeds[key].updatedAt);}
  }
  assert.equal(JSON.parse(await readFile(f.file))[0].title,ttTitle);
  assert.deepEqual((await checkCoverage({...f.options,minimumFreshnessMs:86400000})).issues,[]);
  assert.deepEqual(validateHealth({manifest:current,health:status,now:Date.now(),total:10}).issues,[]);
});

test('publisher recovery still blocks expired cache in any other feed and preserves the old publication',async t=>{
  const f=await fixture(t),m=JSON.parse(await readFile(f.manifestFile));
  m.countries[0].feeds.tech.updatedAt=date(2);await writeFile(f.manifestFile,JSON.stringify(m));
  const before=await f.snapshot();
  await assert.rejects(refreshFeeds({...f.options,generate:outage,recover:f.recover,sleep:instant}),/TT\/tech: empty feed/);
  assert.deepEqual(await f.snapshot(),before);
});

test('both providers failing cannot renew an aging singleton or claim a successful refresh',async t=>{
  const f=await fixture(t),before=await f.snapshot();
  await assert.rejects(refreshFeeds({...f.options,generate:outage,recover:async()=>({succeeded:0}),sleep:instant}),/TT\/politics: empty feed/);
  assert.deepEqual(await f.snapshot(),before);
});

test('programming and validation failures do not trigger publisher recovery',async t=>{
  const f=await fixture(t),before=await f.snapshot();
  await assert.rejects(refreshFeeds({...f.options,generate:async()=>{throw new Error('invalid configuration')},recover:()=>assert.fail('must not recover')}),/invalid configuration/);
  assert.deepEqual(await f.snapshot(),before);
});


test('a publisher duplicate supplies its original date and URL instead of an aggregator crawl timestamp',async()=>{
  const original=item(gfTitle,'https://www.franceguyane.fr/report.php',3);
  const google={...original,link:'https://news.google.com/rss/articles/copy',pubDate:date(1)};
  const result=await fetchArticlesForFeed(gf,economy,{verifyPublisherArticle: async article => article, fetchImpl:async url=>new Response(url.hostname==='news.google.com'?
    `<rss><channel><item><title><![CDATA[${google.title}]]></title><link>${google.link}</link><source>franceguyane.fr</source><pubDate>${google.pubDate}</pubDate></item></channel></rss>`:xml([original]))});
  assert.equal(result.length,1);assert.equal(result[0].url,original.link);assert.equal(result[0].publishedAt,original.pubDate);
  assert.deepEqual(result.coverage.publishers,['franceguyane.fr']);
});
