"use strict";
const {requireAuth,requireRole}=require('./_lib/auth');
const {handleMode}=require('./_lib/ai');
module.exports=async(req,res)=>{
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const decoded=await requireAuth(req);
    const role=decoded.role||decoded.adminRole||'';
    const allowed=['super_admin','content_admin','competition_admin','moderator'];
    const email=(decoded.email||'').trim().toLowerCase();
    const admins=(process.env.ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
    if(!allowed.includes(role)&&!admins.includes(email))return res.status(403).json({error:'Admin access required.'});
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const data=await handleMode('admin_research',{...(body.payload||body||{}),_requester:{uid:decoded.uid,email,role}});
    return res.status(200).json({ok:true,data});
  }catch(err){const status=Number(err.status)||500;console.error('[Mortaqa Research]',err);return res.status(status).json({ok:false,error:err.message||'Research failed.'});}
};
