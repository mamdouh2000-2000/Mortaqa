"use strict";
const {requireAuth}=require('./_lib/auth');
const {proxyOpenAICompatible}=require('./_lib/ai');
module.exports=async(req,res)=>{
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    await requireAuth(req);
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const out=await proxyOpenAICompatible(body);
    if(out instanceof Response){
      res.statusCode=out.status;
      if(out.headers.get('content-type'))res.setHeader('Content-Type',out.headers.get('content-type'));
      const reader=out.body?.getReader();
      if(!reader)return res.end(await out.text());
      const pump=async()=>{const {done,value}=await reader.read();if(done)return res.end();res.write(Buffer.from(value));return pump();};
      return pump();
    }
    return res.status(200).json({ok:true,choices:out.data?.choices||[],model:out.model});
  }catch(err){const status=Number(err.status)||500;console.error('[Mortaqa AI Proxy]',err);return res.status(status).json({ok:false,error:err.message||'AI proxy failed.'});}
};
