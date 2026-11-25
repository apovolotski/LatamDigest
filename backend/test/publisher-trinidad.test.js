import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchArticlesForFeed} from '../scripts/generate-static-feeds.mjs';
import {feedConfigs,isRelevantArticle} from '../src/feedSearch.js';
const country={id:'TT',name:'Trinidad and Tobago'},date=new Date(Date.now()-3*86400000).toISOString();
const culturalTitle='𝐈𝐧𝐝𝐢𝐚𝐧 𝐖𝐨𝐦𝐞𝐧’𝐬 𝐆𝐫𝐨𝐮𝐩 𝐨𝐟 𝐓𝐫𝐢𝐧𝐢𝐝𝐚𝐝 𝐃𝐢𝐯𝐚𝐥𝐢 𝐂𝐞𝐥𝐞𝐛𝐫𝐚𝐭𝐢𝐨𝐧 𝐚𝐧𝐝 𝐋𝐮𝐧𝐜𝐡𝐞𝐨𝐧';
const affairsTitle='Trinidad and Tobago denies talks with US to accept third-country deportees';
const stories={culture:{title:culturalTitle,url:'https://icdn.today/reviewed-culture'},world:{title:affairsTitle,url:'https://www.caribbeannationalweekly.com/posts/reviewed-affairs'}};
test('TT business recovers from CANA with Google, TTT and Caribbean Times unavailable, retaining the original date',async()=>{
 const title='Trinidad and Tobago government to shut down scrap iron industry',url='https://www.cananews.com/reviewed-industry/';
 const fetchImpl=async u=>{
  if(u.href===url)return new Response(`<meta property="og:title" content="${title}"><meta property="article:published_time" content="${date}">`);
  if(u.hostname==='www.cananews.com')return new Response(`<rss><channel><item><title>${title}</title><link>${url}</link><pubDate>${new Date().toISOString()}</pubDate></item></channel></rss>`);
  return new Response('mock previous providers unavailable',{status:503});
 };
 const articles=await fetchArticlesForFeed(country,feedConfigs.find(f=>f.key==='business'),{fetchImpl,sleep:async()=>{}});
 assert.equal(articles.length,1);assert.equal(articles[0].url,url);assert.equal(articles[0].publishedAt,date);
});
for(const key of ['culture','world'])test(`TT/${key} recovers when Google, TTT and all previous publishers are down`,async()=>{
 const story=stories[key],calls=[];
 const fetchImpl=async u=>{
  calls.push(u.hostname);
  if(u.href===story.url)return new Response(`<meta property="og:title" content="${story.title}"><meta property="article:published_time" content="${date}">`);
  if(u.hostname==='icdn.today')return new Response(JSON.stringify([{id:1,title:{rendered:culturalTitle},link:stories.culture.url,date_gmt:date.slice(0,19)}]));
  if(u.hostname==='www.caribbeannationalweekly.com')return new Response(`<a href="${stories.world.url}"><h3>${affairsTitle}</h3></a>`);
  return new Response('mock unavailable',{status:503});
 };
 const articles=await fetchArticlesForFeed(country,feedConfigs.find(f=>f.key===key),{fetchImpl,sleep:async()=>{}});
 assert.equal(articles.length,1);assert.equal(articles[0].publishedAt,date);assert.equal(articles[0].url,story.url);assert.ok(calls.includes('news.google.com'));
});
const relevant=(key,title,id='TT')=>isRelevantArticle({title,url:title===affairsTitle?stories.world.url:'https://example.com/a',publishedAt:date},{id,name:id},feedConfigs.find(f=>f.key===key),{lookbackDays:13});
test('typographic letters preserve the same country/category meaning without accepting unrelated celebrations or brands',()=>{
 assert.equal(relevant('culture',culturalTitle),true);
 assert.equal(relevant('culture','Trinidad Divali celebration and luncheon'),true);
 for(const title of ['Canada Divali celebration and luncheon','Trinidad Divali electronics store discounts','Trinidad safety culture workshop'])assert.equal(relevant('culture',title),false);
 assert.equal(relevant('culture',culturalTitle,'GF'),false);
});
test('third-country migration diplomacy needs explicit foreign negotiations; domestic minister assignments do not qualify',()=>{
 assert.equal(relevant('world',affairsTitle),true);
 for(const title of ['Trinidad talks with local councils about third-country deportees','Trinidad business sells US deportees T-shirts','Trinidad attorney general, foreign affairs minister assigned additional responsibilities'])assert.equal(relevant('world',title),false);
 assert.equal(relevant('politics','Trinidad government assigns additional responsibilities to foreign affairs minister'),true);
 assert.equal(relevant('world','Trinidad foreign affairs minister assigned additional responsibilities ahead of bilateral talks'),true);
});
