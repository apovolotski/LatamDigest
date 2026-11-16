import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isRelevantArticle,feedConfigs} from '../src/feedSearch.js';
import {fetchPublisherArticles,toArticle} from '../scripts/generate-static-feeds.mjs';
import {publisherSourcesFor} from '../src/publisherSources.js';
const countries=JSON.parse(await readFile(new URL('../../LatamDigest/Resources/Countries.json',import.meta.url)));
const cases=[
 ['CO','culture','Precio del dólar en Colombia: qué pasará con la moneda durante la concertación del aumento del salario mínimo de 2027','Colombia abre un concierto de música durante la concertación cultural'],
 ['PY','culture','Paraguay. Sindicatos exigen incautar patrimonio de imputados relacionados a Ueno Bank','Paraguay recupera patrimonio cultural de un museo durante una investigación'],
 ['GF','culture',"La Collectivité territoriale de Guyane s'explique après la polémique sur une opération de dépistage du cancer du sein","Guyane : les opéras et la musique au théâtre de Cayenne"],
 ['GF','business',"L'Empreinte #2 : les artistes investissent le quartier de la Rénovation urbaine à Cayenne","Les artistes investissent deux millions dans une entreprise à Cayenne"],
 ['HN','business','Casos de hondureños arrestados por ICE retratan firme política migratoria de EEUU','Honduras firms announce new investment'],
 ['MX','business','Miguel Angel Felix Gallardo, architect of Mexico’s drug trade, dies age 80','Mexico pharmaceutical companies expand investment'],
 ['MX','culture','Fernando Buen Abad Domínguez: Ondas cortas y ondas largas en la cultura Fobaproa de México','México abre exposición de arte sobre la cultura Fobaproa'],
 ['GY','culture','Protecting Guyana’s Natural Heritage','Guyana art exhibition explores natural heritage'],
 ['VE','crime','Primero Justicia aprovechó furor por estreno de GTA 6 para cuestionar los retrasos de obras públicas en Venezuela','Venezuela investiga asesinato de dirigente de Primero Justicia'],
 ['UY','crime','Justicia desestimó millonaria demanda de Luisana Lopilato por un comercial en Uruguay','Uruguay investiga asesinato y demanda por uso de imagen comercial']
];
for(const [id,key,rejected,retained]of cases)test(`publisher review ${id}/${key}: ambiguous words require independent category evidence in live and cached recovery`,async()=>{
 const c=countries.find(c=>c.id===id),f=feedConfigs.find(f=>f.key===key),source=publisherSourcesFor(c,f).find(source=>!source.kind),date=new Date().toISOString();
 const make=title=>toArticle({title,source:source.name,pubDate:date,link:`https://${source.hosts[0]}/${encodeURIComponent(title)}`},c,f);
 const bad=make(rejected),good=make(retained);
 assert.equal(isRelevantArticle(bad,c,f,{lookbackDays:13}),false);
 assert.equal(isRelevantArticle(good,c,f,{lookbackDays:13}),true);
 assert.equal(isRelevantArticle(bad,c,feedConfigs[0],{lookbackDays:13}),true,'general news remains eligible');
 const articles=await fetchPublisherArticles(c,f,{verifyPublisherArticle: async article => article, fetchImpl:async()=>new Response(`<rss><channel>${[bad,good].map(a=>`<item><title><![CDATA[${a.title}]]></title><link>${a.url}</link><pubDate>${a.publishedAt}</pubDate></item>`).join('')}</channel></rss>`)});
 assert.deepEqual(articles.map(a=>a.title),[retained]);
});
