"use strict";
const {admin,getAdminApp}=require('./firebase-admin');
function getBearerToken(req){const h=req.headers.authorization||req.headers.Authorization||'';return h.startsWith('Bearer ')?h.slice(7).trim()||null:null;}
async function requireAuth(req){const app=getAdminApp();const token=getBearerToken(req);if(!token){throw Object.assign(new Error('Authentication required.'),{status:401});}try{return await admin.auth(app).verifyIdToken(token,true);}catch{throw Object.assign(new Error('Invalid or expired authentication token.'),{status:401});}}
function requireRole(decoded,roles=[]){if(!roles.length)return true;const role=decoded?.role||decoded?.adminRole||'';if(!roles.includes(role))throw Object.assign(new Error('Insufficient permissions.'),{status:403});return true;}
module.exports={getBearerToken,requireAuth,requireRole};
