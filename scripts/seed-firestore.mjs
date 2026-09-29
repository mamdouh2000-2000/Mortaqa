import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';
const {initializeApp,cert,getApps}=admin; const {getFirestore,FieldValue}=admin;
const __dirname=path.dirname(fileURLToPath(import.meta.url));
function req(name){const v=process.env[name];if(!v)throw new Error(`${name} is required.`);return v;}
const app=getApps().length?getApps()[0]:initializeApp({credential:cert({projectId:req('FIREBASE_PROJECT_ID'),clientEmail:req('FIREBASE_CLIENT_EMAIL'),privateKey:req('FIREBASE_PRIVATE_KEY').replace(/\\n/g,'\n')})});
const db=getFirestore(app);
async function writeDocs(collection,docs){let batch=db.batch(),n=0;for(const item of docs||[]){const id=item.id||item.pathKey||item.name;if(!id)continue;batch.set(db.collection(collection).doc(String(id).replace(/[\\/]/g,'_')),{...item,updatedAt:FieldValue.serverTimestamp()},{merge:true});n++;if(n%400===0){await batch.commit();batch=db.batch();}}if(n%400)await batch.commit();return n;}
const root=path.resolve(__dirname,'..');
const curriculum=JSON.parse(await fs.readFile(path.join(root,'data/curriculum.seed.json'),'utf8'));
const institutions=JSON.parse(await fs.readFile(path.join(root,'data/institution_catalog.json'),'utf8'));
const faculties=JSON.parse(await fs.readFile(path.join(root,'data/faculty_catalog.json'),'utf8'));
const tech=JSON.parse(await fs.readFile(path.join(root,'data/technical_colleges.seed.json'),'utf8'));
const materials=JSON.parse(await fs.readFile(path.join(root,'data/materials.seed.json'),'utf8'));
const registry=JSON.parse(await fs.readFile(path.join(root,'data/reference_registry.json'),'utf8'));
const allInstitutions=Object.entries(Object.fromEntries((institutions.types||[]).map(t=>[t.id,t]))).flatMap(([typeId,t])=>(t.institutions||[]).map(x=>({...x,typeId,typeLabel:t.label})));
const curriculumCount=await writeDocs('curricula',curriculum.curricula||[]);
const blueprintCount=await writeDocs('assessmentBlueprints',curriculum.assessmentBlueprints||[]);
const typeCount=await writeDocs('institutionTypes',(institutions.types||[]).map(t=>({id:t.id,label:t.label,source:'official-2026'})));
const institutionCount=await writeDocs('institutions',allInstitutions);
const facultyCount=await writeDocs('faculties',faculties.faculties||faculties||[]);
const techCount=await writeDocs('technicalColleges',tech.colleges||tech||[]);
const resourceItems=[...(materials.items||[]),...(registry.items||[])].map((x,i)=>({id:`seed_ref_${i+1}`,...x,ownerUid:'system',visibility:'public',status:x.status||'pending'}));
const resourceCount=await writeDocs('referenceLinks',resourceItems);
await db.doc('_meta/seed').set({schemaVersion:curriculum.schemaVersion,version:'5.2.0',seededAt:FieldValue.serverTimestamp(),counts:{curriculumCount,blueprintCount,typeCount,institutionCount,facultyCount,techCount,resourceCount}},{merge:true});
console.log(JSON.stringify({ok:true,curriculumCount,blueprintCount,typeCount,institutionCount,facultyCount,techCount,resourceCount},null,2));
