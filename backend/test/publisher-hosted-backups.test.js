import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchArticlesForFeed} from '../scripts/generate-static-feeds.mjs';
import {feedConfigs} from '../src/feedSearch.js';

const fixtures = [
  {id:'EC', key:'world', host:'elmercurio.com.ec', title:'Cancillería de Ecuador asumirá los costos de repatriación de ecuatorianos que fallecieron en Brooklyn'},
  {id:'PR', key:'crime', host:'noticiassin.com', title:'Acusan en Puerto Rico a 55 personas por narcotráfico, uso ilegal de armas y asesinatos'},
  {id:'PR', key:'world', host:'noticiassin.com', title:'República Dominicana y Puerto Rico buscan ampliar cooperación en justicia y sistema penitenciario'}
];

async function recover(fixture, {title=fixture.title, ageDays=3, pageDate=true, unsafe=false}={}) {
  const date=new Date(Date.now()-ageDays*86400000).toISOString().slice(0,19)+'.000Z';
  const url=`https://${unsafe?'unreviewed.example':fixture.host}/reviewed-news`;
  const calls=[];
  const fetchImpl=async u=>{
    calls.push(u.hostname);
    if(u.href===url) return new Response(`<meta property="og:title" content="${title}">${pageDate?`<meta property="article:published_time" content="${date}">`:''}`);
    if(u.hostname===fixture.host && u.pathname==='/wp-json/wp/v2/posts') return new Response(JSON.stringify([{id:1,title:{rendered:title},link:url,date_gmt:date.slice(0,19)}]));
    return new Response('mock Google and previous publishers unavailable',{status:503});
  };
  const articles=await fetchArticlesForFeed({id:fixture.id,name:fixture.id},feedConfigs.find(f=>f.key===fixture.key),{fetchImpl,sleep:async()=>{}});
  return {articles,date,url,calls};
}

for(const fixture of fixtures) test(`${fixture.id}/${fixture.key} has a separately owned backup when Google and prior publishers fail`,async()=>{
  const {articles,date,url,calls}=await recover(fixture);
  assert.equal(articles.length,1);
  assert.equal(articles[0].url,url);
  assert.equal(articles[0].publishedAt,date);
  assert.ok(calls.includes('news.google.com'));
});

test('new backups cannot substitute archive dates, renew expired stories, expand hosts or bypass country/category checks',async()=>{
  for(const fixture of fixtures) {
    for(const options of [{pageDate:false},{ageDays:14},{unsafe:true},{title:'Peru wins a football match'}]) {
      await assert.rejects(recover(fixture,options), /RSS http HTTP 503/);
    }
  }
});
