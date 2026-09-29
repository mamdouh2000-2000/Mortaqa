"use strict";
const {requireAuth}=require('./_lib/auth');
const {codeCraftEmbedding}=require('./_lib/ai');
module.exports=async(req,res)=>{
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{await requireAuth(req);const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});if(body.input==null)return res.status(400).json({error:'Missing input.'});const data=await codeCraftEmbedding(body.input,body.model);return res.status(200).json({ok:true,...data});}
  catch(err){const status=Number(err.status)||500;return res.status(status).json({ok:false,error:err.message||'Embedding request failed.'});}
};
