import test from 'node:test';
import assert from 'node:assert/strict';
import {publisherIndexLinks} from '../src/publisherIndex.js';
import {fetchArticlesForFeed} from '../scripts/generate-static-feeds.mjs';
import {feedConfigs} from '../src/feedSearch.js';
const source={url:'https://diario.elmundo.sv/nacionales',hosts:['diario.elmundo.sv'],articlePathPrefix:'/nacionales/'};
const title='El Salvador registra 61 homicidios en lo que va del año',url='https://diario.elmundo.sv/nacionales/homicidios-el-salvador';
const card=(u,t)=>`<div class="article-title"><a href="${u}">${t}</a></div>`;
test('reviewed El Mundo title cards are bounded identities, not navigation, dates or external links',()=>{
 const html=card(url,title)+card('https://evil.example/nacionales/fake','El Salvador crimen')+card(url+'?tracking=1',title)+card('http://diario.elmundo.sv/nacionales/unsafe',title)+`<div class="article-date">2099-01-01</div><a href="https://diario.elmundo.sv/nacionales/nav">El Salvador crimen</a>`;
 assert.deepEqual(publisherIndexLinks(html,source),[{title,url}]);
 assert.deepEqual(publisherIndexLinks(html,{...source,hosts:['other.example']}),[]);
});
test('SV crime survives earlier publishers failing and retains verified original dates instead of listing dates',async()=>{
 const publishedAt=new Date(Date.now()-4*86400000).toISOString();
 const fetchImpl=async u=>{
  if(u.href===url)return new Response(`<meta property="og:title" content="${title}"><meta property="article:published_time" content="${publishedAt}">`);
  if(u.hostname==='diario.elmundo.sv')return new Response(card(url,title)+card('https://diario.elmundo.sv/nacionales/undated','El Salvador homicidios sin fecha')+'<div class="article-date">2099-01-01</div>');
  return new Response('mock unavailable',{status:503});
 };
 const articles=await fetchArticlesForFeed({id:'SV',name:'El Salvador'},feedConfigs.find(f=>f.key==='crime'),{fetchImpl,sleep:async()=>{}});
 assert.equal(articles.length,1);assert.equal(articles[0].url,url);assert.equal(articles[0].publishedAt,publishedAt);assert.equal(articles[0].sourceName,'Diario El Mundo');
});
