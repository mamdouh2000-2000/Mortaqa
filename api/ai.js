"use strict";
const {requireAuth}=require('./_lib/auth');
const {handleMode}=require('./_lib/ai');
module.exports=async(req,res)=>{
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const decoded=await requireAuth(req);
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const mode=String(body.mode||'').trim(); if(!mode)return res.status(400).json({error:'Missing AI mode.'});
    const payload=body.payload&&typeof body.payload==='object'?{...body.payload}:{};
    payload._requester={uid:decoded.uid,email:decoded.email||null,role:decoded.role||null};
    const data=await handleMode(mode,payload);
    return res.status(200).json({ok:true,mode,data});
  }catch(err){const status=Number(err.status)||500;console.error('[Mortaqa AI]',err);return res.status(status).json({ok:false,error:err.message||'AI request failed.'});}
};
