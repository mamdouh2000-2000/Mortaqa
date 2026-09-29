import admin from 'firebase-admin';
const { initializeApp, cert, getApps } = admin;
const { getAuth } = admin;
const { getFirestore } = admin;

const raw = process.env.ADMIN_EMAILS || '';
const emails = raw.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
if (emails.length !== 2) throw new Error('Set ADMIN_EMAILS to exactly two comma-separated emails.');
if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) throw new Error('Firebase Admin env is incomplete.');

const app = getApps().length ? getApps()[0] : initializeApp({credential:cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n')})});
const auth = getAuth(app); const db = getFirestore(app);

for (const email of emails) {
  const user = await auth.getUserByEmail(email);
  await auth.setCustomUserClaims(user.uid, { role:'super_admin' });
  await db.doc(`users/${user.uid}`).set({ uid:user.uid, email, role:'super_admin', updatedAt:new Date() }, {merge:true});
  console.log(`Super admin configured: ${email} (${user.uid})`);
}
console.log('Done. Ask the admins to sign out/in once so a fresh ID token carries the custom claim.');
