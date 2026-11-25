import test from 'node:test';
import assert from 'node:assert/strict';
import {publisherIndexLinks} from '../src/publisherIndex.js';
import {fetchArticlesForFeed} from '../scripts/generate-static-feeds.mjs';
import {feedConfigs,isRelevantArticle} from '../src/feedSearch.js';
const source={url:'https://www.lanacion.com.py/',hosts:['www.lanacion.com.py'],articlePathPrefix:'/politica/'};
const title='Javier Milei visitará Paraguay y se reunirá con el presidente Pedro Alliana',url='https://www.lanacion.com.py/politica/2026/11/24/reunion-bilateral/';
const card=(u,t)=>`<a href="${u}"><h3>${t}</h3></a>`;
test('La Nacion political news cards permit only reviewed dated HTTPS article paths',()=>{
 const html=card(url,title)+card('https://evil.example/politica/2026/11/24/fake/',title)+card(url+'?x=1',title)+card('https://www.lanacion.com.py/politica/2026/99/24/fake/',title)+card('https://www.lanacion.com.py/politica/2026/11/24/file.php/',title);
 assert.deepEqual(publisherIndexLinks(html,source),[{title,url}]);
 assert.deepEqual(publisherIndexLinks(card(url,title),{...source,hosts:['other.example']}),[]);
});
test('PY world survives rolling RSS eviction using a separate publisher and original article metadata',async()=>{
 const publishedAt=new Date(Date.now()-2*86400000).toISOString();
 const fetchImpl=async u=>{
  if(u.href===url)return new Response(`<script type="application/ld+json">${JSON.stringify({'@type':'NewsArticle',headline:title,datePublished:publishedAt,url})}</script>`);
  if(u.href===source.url)return new Response(card(url,title));
  return new Response('mock empty or unavailable discovery',{status:503});
 };
 const articles=await fetchArticlesForFeed({id:'PY',name:'Paraguay'},feedConfigs.find(f=>f.key==='world'),{fetchImpl,sleep:async()=>{}});
 assert.equal(articles.length,1);assert.equal(articles[0].url,url);assert.equal(articles[0].publishedAt,publishedAt);
 const relevant=t=>isRelevantArticle({title:t,url,publishedAt},{id:'PY',name:'Paraguay'},feedConfigs.find(f=>f.key==='world'),{lookbackDays:13});
 assert.equal(relevant(title),true);
 for(const t of ['Javier Milei visitará Paraguay para un programa de televisión','Paraguay: actor imita a Javier Milei en una comedia','Javier Milei visitará Paraguay y se reunirá con empresarios'])assert.equal(relevant(t),false);
});
