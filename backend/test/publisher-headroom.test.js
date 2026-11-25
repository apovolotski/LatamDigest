import test from 'node:test';
import assert from 'node:assert/strict';
import {countryPublisherFeeds,regionalPublisherFeeds} from '../src/publisherSources.js';
import {fetchPublisherArticles} from '../scripts/generate-static-feeds.mjs';
import {feedConfigs} from '../src/feedSearch.js';

test('default discovery continues past two nearly expired publishers while preserving valid sparse fallback',async t=>{
 const previous=countryPublisherFeeds.MX,regional=[...regionalPublisherFeeds];
 t.after(()=>{countryPublisherFeeds.MX=previous;regionalPublisherFeeds.splice(0,regionalPublisherFeeds.length,...regional);});
 const hosts=['old-a.example','old-b.example','fresh.example'];
 countryPublisherFeeds.MX=hosts.map(host=>({url:`https://${host}/feed`,name:host,hosts:[host]}));regionalPublisherFeeds.length=0;
 const oldDate=new Date(Date.now()-12*86400000).toISOString(),freshDate=new Date(Date.now()-86400000).toISOString();
 const titles=['México: empresas anuncian contratos','México: empresas amplían negocios','México: empresas crean nuevas tiendas','México: empresas anuncian nuevas inversiones'];
 const stories=hosts.flatMap((host,i)=>(i===0?[0,1]:[i+1]).map(n=>({title:titles[n],url:`https://${host}/article-${n}`,publishedAt:i===2?freshDate:oldDate})));
 function network(fresh=true){return async u=>{
  if(u.hostname==='fresh.example'&&!fresh)return new Response('mock unavailable',{status:503});
  const exact=stories.find(a=>a.url===u.href);
  if(exact)return new Response(`<meta property="og:title" content="${exact.title}"><meta property="article:published_time" content="${exact.publishedAt}">`);
  return new Response(`<rss><channel>${stories.filter(a=>new URL(a.url).hostname===u.hostname).map(a=>`<item><title>${a.title}</title><link>${a.url}</link><pubDate>${a.publishedAt}</pubDate></item>`).join('')}</channel></rss>`);
 };}
 const country={id:'MX',name:'Mexico'},feed=feedConfigs.find(f=>f.key==='business');
 const result=await fetchPublisherArticles(country,feed,{fetchImpl:network(),sleep:async()=>{}});
 assert.equal(result.length,4);assert.equal(result[0].publishedAt,freshDate);assert.equal(result[0].sourceName,'fresh.example');
 const limited=await fetchPublisherArticles(country,feed,{fetchImpl:network(false),sleep:async()=>{}});
 assert.equal(limited.length,3);assert.ok(limited.every(a=>a.publishedAt===oldDate));
});
