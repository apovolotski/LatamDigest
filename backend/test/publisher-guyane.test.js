import test from 'node:test';
import assert from 'node:assert/strict';
import {originalPublisherDate} from '../src/publisherArticle.js';
import {publisherSourcesFor} from '../src/publisherSources.js';
import {feedConfigs,isRelevantArticle} from '../src/feedSearch.js';
import {fetchArticlesForFeed,fetchPublisherArticles} from '../scripts/generate-static-feeds.mjs';
import {publisherReadiness} from '../scripts/audit-publisher-coverage.mjs';
const world=feedConfigs.find(f=>f.key==='world'),country={id:'GF',name:'French Guiana'};
const title='Coopération entre l’Université de Guyane et l’UFPA : deux documents signés au Brésil';
const date=days=>new Date(Date.now()-days*86400000).toISOString();
const url='https://www.univ-guyane.fr/reviewed-cooperation';
const instant=async()=>{};
const rss=(headline=title,link=url,pub=date(0))=>`<rss><channel><item><title><![CDATA[${headline}]]></title><link>${link}</link><pubDate>${pub}</pubDate></item></channel></rss>`;
const page=pub=>`<meta property="og:title" content="${title}"><meta property="article:published_time" content="${pub}">`;
function network(kind,original=date(6),headline=title,link=url){
 return async u=>{
  if(String(u)===url)return new Response(page(original));
  if(u.hostname!=='www.univ-guyane.fr')return new Response('mock outage',{status:503});
  if(u.pathname==='/feed/')return new Response(kind==='rss'?rss(headline,link):'',{status:kind==='rss'?200:503});
  return new Response(JSON.stringify(kind==='archive'?[{id:1,date_gmt:date(0).slice(0,19),title:{rendered:headline},link}]:[]));
 };
}
for(const kind of ['rss','archive'])test(`GF/world independently recovers through ${kind} while Google and the other publishers are down`,async()=>{
 const original=date(6),articles=await fetchArticlesForFeed(country,world,{fetchImpl:network(kind,original),sleep:instant});
 assert.equal(articles.length,1);assert.equal(articles[0].publishedAt,original);assert.equal(articles[0].url,url);
 assert.equal(articles[0].sourceName,'Université de Guyane');
 assert.equal(publisherReadiness(articles).verifiedPublishers.length,1,'two transports never count as two publishers');
});
test('institutional discovery remains scoped and cannot replace original dates, country, category or safe hosts',async()=>{
 assert.ok(!publisherSourcesFor(country,feedConfigs.find(f=>f.key==='crime')).some(s=>s.name==='Université de Guyane'));
 for(const [original,headline,link] of [
  [date(14),title,url],['2026-11-18',title,url],[date(-2),title,url],
  [date(1),'Université de Guyane : élections étudiantes et offres de formation',url],
  [date(1),'Coopération entre les universités de Paris et de Lyon',url],
  [date(1),title,'https://attacker.example/story']
 ])assert.equal((await fetchPublisherArticles(country,world,{fetchImpl:network('archive',original,headline,link),sleep:instant})).length,0);
});
const mercoTitle='Uruguay will not announce its CPTPP accession this year and will consult business and unions';
const mercoBlock=(text='Monday, November 23rd 2026 - 21:36 UTC',headline=mercoTitle)=>`<h2 class="title">${headline}</h2><div class="content-data"><span>${text}</span><div class="tabs">Full article</div></div>`;
const names=['MercoPress','en.mercopress.com'];
test('MercoPress uses only the matching article header UTC publication time, never the live clock or recommendations',()=>{
 const html='<p class="date">Montevideo, November 24th 2026 - 23:02 UTC</p>'+mercoBlock()+mercoBlock('Tuesday, November 24th 2026 - 22:00 UTC','Unrelated recommendation');
 assert.equal(originalPublisherDate(html,mercoTitle,names),'2026-11-23T21:36:00.000Z');
 assert.equal(originalPublisherDate(html,mercoTitle,['unreviewed.example']),null);
 assert.equal(originalPublisherDate('<p class="date">November 24th 2026 - 23:02 UTC</p>',mercoTitle,names),null);
 assert.equal(originalPublisherDate(mercoBlock(undefined,'Other article'),mercoTitle,names),null);
});
test('MercoPress rejects missing timezone/time, invalid calendar dates, wrong weekday and conflicting publication evidence',()=>{
 for(const timestamp of ['Monday, November 23rd 2026','Monday, November 23rd 2026 - 21:36','Monday, November 23rd 2026 - 21:36 GMT-3','Monday, November 31st 2026 - 21:36 UTC','Tuesday, November 23rd 2026 - 21:36 UTC'])assert.equal(originalPublisherDate(mercoBlock(timestamp),mercoTitle,names),null);
 const conflict=`<meta property="og:title" content="${mercoTitle}"><meta property="article:published_time" content="2026-11-24T21:36:00Z">`;
 assert.equal(originalPublisherDate(mercoBlock()+conflict,mercoTitle,names),null);
 assert.equal(originalPublisherDate(mercoBlock()+mercoBlock('Tuesday, November 24th 2026 - 21:36 UTC'),mercoTitle,names),null);
});
test('international treaty accession is affairs evidence while acronym merchandise and unrelated geography remain rejected',()=>{
 const relevant=title=>isRelevantArticle({title,url:'https://example.com/a',publishedAt:date(1),sourceName:'Example'},{id:'UY',name:'Uruguay'},world,{lookbackDays:13});
 assert.ok(relevant(mercoTitle));assert.ok(relevant('Uruguay debates accession to the CPTPP'));
 for(const title of ['Uruguay sells CPTPP shirts at an international festival','Uruguay hosts CPTPP training courses','Canada debates CPTPP accession'])assert.equal(relevant(title),false);
});

test('new publisher discovery preserves civil-justice and criminal-exporter category boundaries',()=>{
 const article=title=>({title,url:'https://example.com/a',publishedAt:date(1),sourceName:'Example'});
 const relevant=(country,key,title)=>isRelevantArticle(article(title),{id:country,name:country},feedConfigs.find(f=>f.key===key),{lookbackDays:13});
 assert.equal(relevant('BR','crime','A batalha na Justiça para apagar homenagem a expoente do racismo científico no Brasil'),false);
 assert.equal(relevant('BR','crime','Brasil: batalha na Justiça para apagar homenagem após investigação de homicídio'),true);
 assert.equal(relevant('AR','economy',"Prosecutors: Argentina's top shrimp exporter dumped waste at sea through a hidden system"),false);
 assert.equal(relevant('AR','crime','Prosecutors charge Argentina exporter with murder'),true);
 assert.equal(relevant('AR','economy','Prosecutors investigate Argentina exporter as national exports fall'),true);
});
