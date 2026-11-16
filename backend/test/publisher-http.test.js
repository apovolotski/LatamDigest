import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {publisherFetch} from '../src/publisherHttp.js';

function transport(t, respond) {
 const calls=[];
 t.mock.method(https,'get',(url,options,callback)=>{
  calls.push({url:String(url),options});const request=new EventEmitter();
  queueMicrotask(()=>{
   const data=respond(url,calls.length);
   if(data.error){request.emit('error',data.error);return;}
   const response=Readable.from(data.chunks??[Buffer.from(data.body??'ok')]);
   response.statusCode=data.status??200;response.headers=data.headers??{};callback(response);
  });
  return request;
 });
 return calls;
}

test('publisher transport rejects unsafe URLs before requesting, preserves TLS defaults and forwards cancellation',async t=>{
 const signal=new AbortController().signal,calls=transport(t,()=>({}));
 for(const url of ['http://publisher.example/a','https://user:secret@publisher.example/a','https://publisher.example:8443/a','file:///private/path'])await assert.rejects(publisherFetch(url));
 assert.equal(calls.length,0);
 const response=await publisherFetch('https://publisher.example/a',{signal,headers:{'user-agent':'test'}});
 assert.equal(await response.text(),'ok');assert.equal(calls[0].options.signal,signal);
 assert.equal(Object.hasOwn(calls[0].options,'rejectUnauthorized'),false);
 assert.equal(Object.hasOwn(calls[0].options,'auth'),false);
 assert.throws(()=>publisherFetch('https://publisher.example/a',{signal:AbortSignal.abort()}),{name:'AbortError'});
 assert.equal(calls.length,1);
});

test('publisher redirects require exact reviewed hosts, HTTPS, no credentials and a bounded hop count',async t=>{
 let location='/next';const calls=transport(t,()=>({status:302,headers:{location}}));
 const url='https://publisher.example/start',options={allowedHosts:['publisher.example']};
 for(const target of ['http://publisher.example/a','https://publisher.example.evil/a','https://private.example/a','https://user:secret@publisher.example/a','https://publisher.example:8443/a']){
  location=target;const count=calls.length;await assert.rejects(publisherFetch(url,options));assert.equal(calls.length,count+1);
 }
 location='/loop';const count=calls.length;await assert.rejects(publisherFetch(url,options));assert.equal(calls.length-count,4);
 const before=calls.length;const manual=await publisherFetch(url,{redirect:'manual',...options});assert.equal(manual.status,302);assert.equal(calls.length,before+1);
 await assert.rejects(publisherFetch(url,{redirect:'error',...options}));
});

test('publisher body size is capped while streaming and network errors remain failures',async t=>{
 let data={chunks:[Buffer.alloc(1_000_001),Buffer.alloc(1_000_001)]};transport(t,()=>data);
 await assert.rejects(publisherFetch('https://publisher.example/a'),/too large/);
 data={error:new Error('connection closed')};await assert.rejects(publisherFetch('https://publisher.example/a'),/connection closed/);
 data={status:204};assert.equal((await publisherFetch('https://publisher.example/a')).status,204);
});
