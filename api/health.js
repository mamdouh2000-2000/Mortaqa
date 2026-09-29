"use strict";
const {fetchModels}=require('./_lib/ai');
module.exports=async(_req,res)=>{
  let modelCount=0,codecraft=false;
  try{const models=await fetchModels();modelCount=models.length;codecraft=!!process.env.CODECRAFT_API_KEY;}catch(e){codecraft=!!process.env.CODECRAFT_API_KEY;}
  const firebase=Boolean(process.env.FIREBASE_PROJECT_ID&&process.env.FIREBASE_CLIENT_EMAIL&&process.env.FIREBASE_PRIVATE_KEY);
  res.status(200).json({ok:true,service:'mortaqa-api',time:new Date().toISOString(),providers:{firebaseAdmin:firebase,codecraft,modelCount},version:process.env.MORTAQA_VERSION||'5.2.0'});
};
