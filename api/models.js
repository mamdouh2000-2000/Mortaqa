"use strict";
const {requireAuth}=require('./_lib/auth');
const {fetchModels}=require('./_lib/ai');
module.exports=async(req,res)=>{
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  try{await requireAuth(req);const models=await fetchModels(req.query?.refresh==='1');return res.status(200).json({ok:true,data:models});}
  catch(err){const status=Number(err.status)||500;return res.status(status).json({ok:false,error:err.message||'Unable to list models.'});}
};
