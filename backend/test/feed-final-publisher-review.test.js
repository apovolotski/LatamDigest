import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {feedConfigs,isRelevantArticle} from '../src/feedSearch.js';
import {fetchArticlesForFeed,generateFeeds} from '../scripts/generate-static-feeds.mjs';
const cases=[
 ['TT','world','Trinidad and Tobago denies talks with US to accept third-country deportees','Caribbean National Weekly','www.caribbeannationalweekly.com'],
 ['TT','culture','German tourist alleges $11K fraud over undelivered Tobago Carnival package','Trinidad Guardian','www.guardian.co.tt'],
 ['SV','crime','El salvadoreño Iván Barton llevó justicia en un partido de gran importancia en Egipto','La Prensa Gráfica',null]
];
const feed=key=>feedConfigs.find(f=>f.key===key),country=id=>({id,name:id});
const article=(title,sourceName,url='https://news.google.com/rss/articles/reviewed')=>({title,sourceName,url,publishedAt:new Date(Date.now()-86400000).toISOString()});
const relevant=(id,key,a)=>isRelevantArticle(a,country(id),feed(key),{lookbackDays:13});
for(const [id,key,title,sourceName,host] of cases.slice(0,2))test(`reviewed ${sourceName} timestamp discrepancy requires direct original-date verification`,()=>{
 assert.equal(relevant(id,key,article(title,sourceName)),false);
 assert.equal(relevant(id,'top',article(title,sourceName)),false);
 assert.equal(relevant(id,key,article(title,sourceName,`https://${host}/reviewed`)),true);
 assert.equal(relevant(id,key,article(title,sourceName,`https://${host}.evil.example/reviewed`)),false);
 assert.equal(relevant(id,key,article(id==='TT'&&key==='world'?'Trinidad announces new bilateral cooperation':'Trinidad presents a new music festival',sourceName)),true);
});
test('refereeing justice does not establish crime while independent criminal evidence remains eligible',()=>{
 const [id,key,title,sourceName]=cases[2];
 assert.equal(relevant(id,key,article(title,sourceName)),false);
 assert.equal(relevant(id,'top',article(title,sourceName)),true);
 assert.equal(relevant(id,key,article(title+': investigan un delito',sourceName)),true);
 assert.equal(relevant(id,key,article('El Salvador: árbitro reclama justicia en un partido de fútbol',sourceName)),false);
});
test('live Google selection rejects reviewed misdates and figurative referee justice',async()=>{
 for(const [id,key,title,sourceName] of cases){
  const a=article(title,sourceName),xml=`<rss><channel><item><title><![CDATA[${title}]]></title><link>${a.url}</link><source>${sourceName}</source><pubDate>${a.publishedAt}</pubDate></item></channel></rss>`;
  const fetchImpl=async u=>u.hostname==='news.google.com'?new Response(xml):new Response('mock no publisher evidence',{status:503});
  assert.equal((await fetchArticlesForFeed(country(id),feed(key),{fetchImpl,sleep:async()=>{}})).length,0);
 }
});
test('cached recovery cannot restore reviewed misdates or a referee crime placement',async t=>{
 for(const [id,key,title,sourceName] of cases){
  const destination=await mkdtemp(path.join(tmpdir(),'latam-final-review-'));t.after(()=>rm(destination,{recursive:true,force:true}));
  const options={destination,countries:[country(id)],feeds:[feed(key),feed('top')]};
  await generateFeeds({...options,fetchFeed:async()=>[article(title,sourceName)]});
  await generateFeeds({...options,fetchFeed:async(_,f)=>f.key===key?[]:[article(id==='TT'?'Trinidad announces reforms':'El Salvador anuncia reformas','Example')]});
  const manifest=JSON.parse(await readFile(path.join(destination,'manifest.json')));
  assert.equal(manifest.countries[0].feeds[key].count,0);
  assert.equal(manifest.countries[0].feeds[key].updatedAt,null);
 }
});
