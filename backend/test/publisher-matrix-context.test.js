import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isRelevantArticle,feedConfigs} from '../src/feedSearch.js';
import {fetchPublisherArticles,toArticle} from '../scripts/generate-static-feeds.mjs';
import {publisherSourcesFor} from '../src/publisherSources.js';
const countries=JSON.parse(await readFile(new URL('../../LatamDigest/Resources/Countries.json',import.meta.url)));
const cases=[
 ['HN','business','Casos de hondureños arrestados por ICE retratan firme política migratoria de EEUU','Honduras firms announce new investment'],
 ['MX','business','Miguel Angel Felix Gallardo, architect of Mexico’s drug trade, dies age 80','Mexico pharmaceutical companies expand investment'],
 ['MX','culture','Fernando Buen Abad Domínguez: Ondas cortas y ondas largas en la cultura Fobaproa de México','México abre exposición de arte sobre la cultura Fobaproa'],
 ['GY','culture','Protecting Guyana’s Natural Heritage','Guyana art exhibition explores natural heritage'],
 ['VE','crime','Primero Justicia aprovechó furor por estreno de GTA 6 para cuestionar los retrasos de obras públicas en Venezuela','Venezuela investiga asesinato de dirigente de Primero Justicia'],
 ['UY','crime','Justicia desestimó millonaria demanda de Luisana Lopilato por un comercial en Uruguay','Uruguay investiga asesinato y demanda por uso de imagen comercial']
];
for(const [id,key,rejected,retained]of cases)test(`publisher review ${id}/${key}: ambiguous words require independent category evidence in live and cached recovery`,async()=>{
 const c=countries.find(c=>c.id===id),f=feedConfigs.find(f=>f.key===key),source=publisherSourcesFor(c,f)[0],date=new Date().toISOString();
 const make=title=>toArticle({title,source:source.name,pubDate:date,link:`https://${source.hosts[0]}/${encodeURIComponent(title)}`},c,f);
 const bad=make(rejected),good=make(retained);
 assert.equal(isRelevantArticle(bad,c,f,{lookbackDays:13}),false);
 assert.equal(isRelevantArticle(good,c,f,{lookbackDays:13}),true);
 assert.equal(isRelevantArticle(bad,c,feedConfigs[0],{lookbackDays:13}),true,'general news remains eligible');
 const articles=await fetchPublisherArticles(c,f,{verifyPublisherArticle: async article => article, fetchImpl:async()=>new Response(`<rss><channel>${[bad,good].map(a=>`<item><title><![CDATA[${a.title}]]></title><link>${a.url}</link><pubDate>${a.publishedAt}</pubDate></item>`).join('')}</channel></rss>`)});
 assert.deepEqual(articles.map(a=>a.title),[retained]);
});
