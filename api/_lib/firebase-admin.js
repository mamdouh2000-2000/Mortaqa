"use strict";
const admin=require('firebase-admin');
function getAdminApp(){
  if(admin.apps.length)return admin.app();
  const projectId=process.env.FIREBASE_PROJECT_ID;
  const clientEmail=process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey=(process.env.FIREBASE_PRIVATE_KEY||'').replace(/\\n/g,'\n');
  if(!projectId||!clientEmail||!privateKey)throw Object.assign(new Error('Firebase Admin credentials are not configured.'),{status:503});
  return admin.initializeApp({credential:admin.credential.cert({projectId,clientEmail,privateKey}),storageBucket:process.env.FIREBASE_STORAGE_BUCKET||undefined});
}
function getFirestore(){return admin.firestore(getAdminApp());}
module.exports={admin,getAdminApp,getFirestore};
