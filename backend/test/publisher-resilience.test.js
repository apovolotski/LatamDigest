import test from 'node:test';import assert from 'node:assert/strict';
import {newsSitemapItems,fetchPublisherNewsSitemap} from '../src/publisherNewsSitemap.js';
import {publisherIndexLinks,fetchPublisherIndex} from '../src/publisherIndex.js';
import {fetchPublisherArticles,createFeedRequestContext,toArticle} from '../scripts/generate-static-feeds.mjs';
import {feedConfigs,isRelevantArticle} from '../src/feedSearch.js';
const date=days=>new Date(Date.now()-days*86400000).toISOString(),instant=async()=>{};
const source={url:'https://publisher.example/news.xml',name:'Publisher',hosts:['publisher.example']};
const sitemap=(body,p='news')=>`<urlset xmlns:${p}="http://www.google.com/schemas/sitemap-news/0.9">${body}</urlset>`;
const entry=(title='Brazil technology research',pub=date(2),url='https://publisher.example/story',p='news')=>`<url><loc>${url}</loc><lastmod>${date(0)}</lastmod><${p}:news><${p}:title>${title}</${p}:title><${p}:publication_date>${pub}</${p}:publication_date></${p}:news></url>`;
const xml=(host,n=3)=>`<rss><channel>${Array.from({length:n},(_,i)=>`<item><title>Brazil technology research ${i}</title><link>https://${host}/story/${i}</link><pubDate>${date(1)}</pubDate></item>`).join('')}</channel></rss>`;

test('publisher recovery continues beyond three stories from one publisher to an independent publisher',async()=>{
 const calls=[],c={id:'BR',name:'Brazil'},f=feedConfigs.find(f=>f.key==='tech');
 const articles=await fetchPublisherArticles(c,f,{sleep:instant,verifyPublisherArticle:async a=>a,fetchImpl:async u=>{
  calls.push(u.hostname);if(u.hostname==='agenciabrasil.ebc.com.br')return new Response(xml(u.hostname));
  if(u.hostname==='g1.globo.com')return new Response(xml(u.hostname,1));return new Response(xml('invalid.example',0));
 }});
 assert.ok(calls.includes('g1.globo.com'));assert.equal(new Set(articles.map(a=>a.sourceName)).size,2);assert.equal(articles.length,4);
});

test('one unavailable publisher does not prevent the next independent backup and sparse valid results remain supported',async()=>{
 const c={id:'BR',name:'Brazil'},f=feedConfigs.find(f=>f.key==='tech');
 for(const onlyOne of[false,true]){
  const a=await fetchPublisherArticles(c,f,{sleep:instant,verifyPublisherArticle:async a=>a,fetchImpl:async u=>{
   if(u.hostname==='agenciabrasil.ebc.com.br')return new Response(xml(u.hostname,onlyOne?1:3));
   if(u.hostname==='g1.globo.com')return new Response('unavailable',{status:503});
   if(!onlyOne&&u.hostname==='www.brasildefato.com.br'&&u.pathname==='/feed/')return new Response(xml(u.hostname,1));
   return new Response(xml('invalid.example',0));
  }});assert.equal(a.length,onlyOne?1:4);assert.equal(new Set(a.map(x=>x.sourceName)).size,onlyOne?1:2);
 }
});

test('news sitemap namespaces and exact article hosts are validated; lastmod never substitutes for publication',()=>{
 const published=date(6),valid=newsSitemapItems(sitemap(entry('Original report',published,undefined,'n'),'n'),source);
 assert.equal(valid.length,1);assert.equal(valid[0].pubDate,published);
 for(const url of['http://publisher.example/a','https://publisher.example.evil/a','https://user:pass@publisher.example/a','https://publisher.example:8443/a'])assert.deepEqual(newsSitemapItems(sitemap(entry('x',published,url)),source),[]);
 assert.deepEqual(newsSitemapItems(sitemap('<url><loc>https://publisher.example/a</loc><lastmod>'+date(0)+'</lastmod></url>'),source),[]);
 assert.deepEqual(newsSitemapItems(sitemap(entry('x','2026-11-17')),source),[]);
 assert.deepEqual(newsSitemapItems(sitemap(entry()).replace('http://www.google.com/schemas/sitemap-news/0.9','https://untrusted.example'),source),[]);
});

test('news sitemap parsing is bounded and never follows an index or external entity',()=>{
 for(const value of['<!DOCTYPE x [<!ENTITY e SYSTEM "file:///private/example">]>'+sitemap(entry()),sitemap(entry().repeat(1001)),'<sitemapindex><sitemap><loc>https://attacker.example/private</loc></sitemap></sitemapindex>','x'.repeat(2_000_001)])assert.deepEqual(newsSitemapItems(value,source),[]);
});

test('publisher sitemap fetches share one generation cache and honor throttling without replay',async()=>{
 const context=createFeedRequestContext();let calls=0;
 const o={requestContext:context,fetchImpl:async()=>{calls++;return new Response(sitemap(entry()));}};
 await fetchPublisherNewsSitemap(source,o);await fetchPublisherNewsSitemap(source,o);assert.equal(calls,1);
 const result=await fetchPublisherNewsSitemap(source,{requestContext:createFeedRequestContext(),fetchImpl:async()=>{calls++;return new Response('throttled',{status:429,headers:{'retry-after':'120'}});}});
 assert.equal(calls,2);assert.deepEqual(result.rss.channel.item,[]);
});

test('publisher-rendered indexes discover only bounded exact-host article cards, never navigation or arbitrary links',()=>{
 const s={...source,url:'https://publisher.example/',articlePathPrefix:'/actualites/'};
 const card=(u,t='Brazil technology')=>`<a href="${u}"><h3>${t}</h3><span>today</span></a>`;
 const valid=publisherIndexLinks(card('/actualites/story')+card('/actualites/rubrique/spatial')+card('https://attacker.example/actualites/story')+card('/actualites/story?tracking=1')+card('/actualites/story'),s);
 assert.equal(valid.length,1);assert.equal(valid[0].url,'https://publisher.example/actualites/story');
 const variants=publisherIndexLinks('<h2><a href="/actualites/headline">Original headline</a></h2><ol class="plus-lus"><li><a href="/actualites/report">Popular report</a></li></ol><nav><a href="/actualites/navigation">Not a card</a></nav>',s);
 assert.deepEqual(variants.map(a=>a.title),['Original headline','Popular report']);
 assert.equal(publisherIndexLinks(Array.from({length:100},(_,i)=>card('/actualites/story-'+i)).join(''),s).length,40);
});

test('publisher index timestamps come from original pages, not listing labels, and undated pages are excluded',async()=>{
 const s={...source,url:'https://publisher.example/',articlePathPrefix:'/actualites/'},published=date(6),calls=[];
 const result=await fetchPublisherIndex(s,{requestContext:createFeedRequestContext(),fetchImpl:async u=>{
  calls.push(u.href);if(u.pathname==='/')return new Response('<a href="/actualites/original"><h3>Brazil technology original</h3><time>today</time></a><a href="/actualites/undated"><h3>Brazil technology undated</h3></a>');
  return new Response(`<meta property="og:title" content="Brazil technology ${u.pathname.split('/').pop()}">${u.pathname.endsWith('original')?`<meta property="article:published_time" content="${published}">`:''}`);
 }});assert.equal(result.rss.channel.item.length,1);assert.equal(result.rss.channel.item[0].pubDate,published);assert.equal(calls.length,3);
 const c={id:'BR',name:'Brazil'},f=feedConfigs.find(f=>f.key==='tech'),a=toArticle({...result.rss.channel.item[0],pubDate:date(13.1)},c,f);
 assert.equal(isRelevantArticle(a,c,f,{lookbackDays:13}),false);
});

const relevance=(id,key,title)=>isRelevantArticle({title,url:'https://example.com/article',sourceName:'Example',publishedAt:date(1)}, {id,name:id},feedConfigs.find(f=>f.key===key),{lookbackDays:13});
test('backup discovery retains category boundaries for figurative culture, political business and wildlife ambassadors',()=>{
 for(const[id,key,title]of[
  ['PA','culture','Panamá | ASEP fortalece la cultura de ciberseguridad entre sus colaboradores'],
  ['HN','culture','Honduras destaca su potencial de aviturismo en festival internacional de observación de aves en Texas'],
  ['CL','business','El discurso sobre el negocio político del cáncer en el Congreso chileno'],
  ['CL','world','El gato de Geoffroy es el Embajador de la Fauna Chilena 2027'],
  ['HN','sports','Hondureña deportada reflexiona sobre el dinero que ganó en EE. UU.'],
  ['PR','crime','Ministro de Justicia dominicano visita Puerto Rico para fortalecer cooperación institucional'],
  ['PY','tech','Paraguay | Viceministro de Tecnologías participó en mesa para protección en casos de violencia familiar']
 ])assert.equal(relevance(id,key,title),false,title);
 for(const[id,key,title]of[
  ['PA','culture','Panamá expone obras de arte sobre la cultura de ciberseguridad'],['HN','culture','Honduras abre museo de arte durante festival de aviturismo'],
  ['CL','business','Empresa chilena investiga negocios políticos y anuncia inversiones'],['CL','world','Embajador de la fauna chilena conversa con la embajada de Canadá'],
  ['HN','sports','Deportistas hondureñas ganan torneo de fútbol'],['PR','crime','Ministro de Justicia visita Puerto Rico para investigar homicidios'],
  ['PY','tech','Paraguay: Viceministro de Tecnologías anuncia programa de ciberseguridad']
 ])assert.equal(relevance(id,key,title),true,title);
});


test('the reviewed RPP gambling advertorial is excluded without blocking gambling news reporting',()=>{
 const c={id:'PE',name:'Peru'},f=feedConfigs.find(f=>f.key==='sports');
 const a={title:'Stake apuestas deportivas Perú 2026: mercados, funciones y opiniones',sourceName:'RPP',url:'https://rpp.pe/apuestas-deportivas/publirreportaje/example',publishedAt:date(1)};
 assert.equal(isRelevantArticle(a,c,f,{lookbackDays:13}),false);
 assert.equal(isRelevantArticle({...a,title:'Perú investiga apuestas ilegales en el fútbol profesional'},c,f,{lookbackDays:13}),true);
});

test('readiness counts independent publishers with expiry headroom, not endpoints or article volume',async()=>{
 const {publisherReadiness}=await import('../scripts/audit-publisher-coverage.mjs');
 const now=Date.now(),article=(sourceName,days)=>({sourceName,publishedAt:new Date(now-days*86400000).toISOString()});
 assert.equal(publisherReadiness([article('A',1),article('A',2),article('A',3)],now).thin,true);
 assert.equal(publisherReadiness([article('A',1),article('A',2),article('B',12)],now).thin,true);
 assert.equal(publisherReadiness([article('A',1),article('A',2),article('B',10)],now).thin,false);
});

test('the all-feed readiness audit uses only publisher recovery with one shared generation context',async()=>{
 const {auditPublisherCoverage}=await import('../scripts/audit-publisher-coverage.mjs');
 const countries=[{id:'AR',name:'Argentina'},{id:'BR',name:'Brazil'},{id:'CL',name:'Chile'},{id:'PE',name:'Peru'}];
 const contexts=new Set();let active=0,peak=0;
 const report=await auditPublisherCoverage({countries,feeds:feedConfigs,fetchPublisherArticles:async(c,f,o)=>{
  contexts.add(o.requestContext);peak=Math.max(peak,++active);
  assert.equal(o.minimumPublishers,2);assert.equal(o.minimumHeadroomHours,48);
  await new Promise(resolve=>setTimeout(resolve,1));active--;
  return c.id==='PE'&&f.key==='tech'?[]:[{sourceName:'A',publishedAt:date(1)},{sourceName:'A',publishedAt:date(2)},{sourceName:'B',publishedAt:date(2)}];
 }});
 assert.equal(report.completed,40);assert.equal(contexts.size,1);assert.ok(peak<=3);
 assert.deepEqual(report.empty,['PE/tech']);assert.deepEqual(report.thin,['PE/tech']);
});


test('ministerial-title disambiguation preserves independent abuse, prison and criminal-operation reporting',()=>{
 for(const[id,title]of[
  ['CL','Ministro de Justicia de Chile enfrenta críticas por rebajar penas a pederastas y agentes de la dictadura: oposición pidió iniciar juicio político'],
  ['PR','Ministro de Justicia visita Puerto Rico en busca de solución a la crisis penitenciaria'],
  ['SV','Ministro de Justicia de Haití destaca apoyo salvadoreño en operativos contra grupos armados']
 ])assert.equal(relevance(id,'crime',title),true,title);
 assert.equal(relevance('SV','crime','Ministro de Justicia de Haití llegará este lunes a El Salvador'),false);
});


test('a football field converted to a military base does not count as sports reporting',()=>{
 assert.equal(relevance('SV','sports','De campo de fútbol a base militar: Haití y El Salvador recapturan el principal estadio de Puerto Príncipe'),false);
 assert.equal(relevance('SV','sports','El Salvador inaugura torneo de fútbol en una antigua base militar'),true);
});

test('new sitemap discovery cannot refresh an article whose original publisher page is expired',async()=>{
 const c={id:'BO',name:'Bolivia'},f=feedConfigs.find(f=>f.key==='tech');
 for(const age of [1,14]){
  const articles=await fetchPublisherArticles(c,f,{sleep:instant,fetchImpl:async u=>{
   if(u.hostname==='eldeber.com.bo'&&u.pathname==='/sitemap-news.xml')return new Response(sitemap(entry('Bolivia technology research',date(1),'https://eldeber.com.bo/report')));
   if(u.hostname==='eldeber.com.bo'&&u.pathname==='/report')return new Response(`<meta property="og:title" content="Bolivia technology research"><meta property="article:published_time" content="${date(age)}">`);
   return new Response('<rss><channel></channel></rss>');
  }});
  assert.equal(articles.length,age===1?1:0);
  if(articles.length)assert.equal(articles[0].sourceName,'El Deber');
 }
});


test('a professional-order presidency needs independent political evidence for politics placement',()=>{
 assert.equal(relevance('GF','politics',"En Guyane, Naïké Bouchaut achève sa présidence de l'Ordre des experts-comptables sur un bilan tourné vers le développement économique du territoire"),false);
 assert.equal(relevance('GF','politics',"En Guyane, la présidence de l'Ordre des experts-comptables rencontre le ministre"),true);
});
