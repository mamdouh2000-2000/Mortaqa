"use strict";

const MAX_IN = Number(process.env.AI_MAX_INPUT_CHARS || 60000);
const MAX_OUT = Number(process.env.AI_MAX_OUTPUT_TOKENS || 6000);
const MODEL_TTL_MS = 5 * 60 * 1000;
let modelCache = { at: 0, models: [] };

function json(v){ return JSON.stringify(v,(_k,x)=>x instanceof Date?x.toISOString():x); }
function compact(v){ const s=typeof v==='string'?v:json(v); return s.length>MAX_IN?s.slice(0,MAX_IN)+'\n[TRUNCATED]':s; }
function err(message,status=500){ return Object.assign(new Error(message),{status}); }

async function fetchModels(force=false){
  if(!force && Date.now()-modelCache.at<MODEL_TTL_MS && modelCache.models.length) return modelCache.models;
  const key=process.env.CODECRAFT_API_KEY;
  if(!key) throw err('CODECRAFT_API_KEY is not configured.',503);
  const base=(process.env.CODECRAFT_BASE_URL||'https://codecraftapi.com/v1').replace(/\/$/,'');
  const r=await fetch(`${base}/models`,{headers:{Authorization:`Bearer ${key}`,Accept:'application/json'}});
  const raw=await r.text();
  let data; try{data=JSON.parse(raw)}catch{data={raw};}
  if(!r.ok) throw err(data?.error?.message||`CodeCraft models HTTP ${r.status}`,r.status>=500?502:r.status);
  const models=Array.isArray(data?.data)?data.data:Array.isArray(data?.models)?data.models:[];
  modelCache={at:Date.now(),models};
  return models;
}

function caps(m){
  const c=m?.capabilities||{};
  if(Array.isArray(c)) return c.map(x=>String(x).toLowerCase());
  return Object.entries(c).filter(([,v])=>Boolean(v)).map(([k])=>String(k).toLowerCase());
}
function supports(m,cap){ return caps(m).includes(String(cap).toLowerCase()); }
function modelId(m){ return m?.id||m?.name||m?.model||''; }

function scoreModel(m,task){
  const c=caps(m), id=modelId(m).toLowerCase(); let s=0;
  if(task==='vision') s += supports(m,'vision')?80:0;
  if(task==='reasoning') s += supports(m,'reasoning')?70:0;
  if(task==='research') s += supports(m,'web_search')?100:0;
  if(task==='structured') s += (supports(m,'json_mode')||supports(m,'structured_outputs'))?40:0;
  if(supports(m,'tools')) s+=10;
  if(supports(m,'streaming')) s+=5;
  if(task==='fast'){ if(/flash|mini|small|nano|fast/.test(id))s+=45; }
  if(task==='general' && /pro|opus|sonnet|gpt-5|reasoning/.test(id))s+=20;
  const ctx=Number(m?.context_length||m?.context_window||m?.max_context_tokens||0); if(ctx)s+=Math.min(ctx/100000,20);
  return s;
}

async function chooseModel(task='general'){
  const models=await fetchModels();
  if(!models.length) throw err('CodeCraft returned no available models.',502);
  const envMap={
    general:process.env.CODECRAFT_MODEL_GENERAL,
    fast:process.env.CODECRAFT_MODEL_FAST,
    reasoning:process.env.CODECRAFT_MODEL_REASONING,
    vision:process.env.CODECRAFT_MODEL_VISION,
    research:process.env.CODECRAFT_MODEL_RESEARCH
  };
  const preferred=envMap[task];
  if(preferred && models.some(m=>modelId(m)===preferred)) return preferred;
  const pool=task==='vision'?models.filter(m=>supports(m,'vision')):task==='research'?models.filter(m=>supports(m,'web_search')):task==='reasoning'?models.filter(m=>supports(m,'reasoning')):models;
  const ranked=(pool.length?pool:models).slice().sort((a,b)=>scoreModel(b,task)-scoreModel(a,task));
  return modelId(ranked[0]);
}

async function codeCraftChat({model,messages,responseFormat,temperature=0.2,maxTokens=MAX_OUT,tools,stream=false}){
  const key=process.env.CODECRAFT_API_KEY; if(!key) throw err('CODECRAFT_API_KEY is not configured.',503);
  const base=(process.env.CODECRAFT_BASE_URL||'https://codecraftapi.com/v1').replace(/\/$/,'');
  const chosen=model||await chooseModel(responseFormat?'structured':'general');
  const body={model:chosen,messages,temperature,max_tokens:maxTokens,stream:!!stream};
  if(responseFormat) body.response_format=responseFormat;
  if(Array.isArray(tools)&&tools.length) body.tools=tools;
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),Number(process.env.AI_REQUEST_TIMEOUT_MS||60000));
  try{
    const r=await fetch(`${base}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json',Accept:stream?'text/event-stream':'application/json'},body:JSON.stringify(body),signal:controller.signal});
    if(stream){ if(!r.ok){const raw=await r.text(); let d; try{d=JSON.parse(raw)}catch{d={raw}}; throw err(d?.error?.message||`CodeCraft HTTP ${r.status}`,r.status>=500?502:r.status); } return r; }
    const raw=await r.text(); let data; try{data=JSON.parse(raw)}catch{data={raw}};
    if(!r.ok) throw err(data?.error?.message||`CodeCraft HTTP ${r.status}`,r.status>=500?502:r.status);
    const content=data?.choices?.[0]?.message?.content??'';
    return {content,data,model:chosen};
  }finally{clearTimeout(timer);}
}

function parseJson(content){
  const s=String(content||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  try{return JSON.parse(s)}catch{throw err('CodeCraft returned invalid structured JSON.',502);}
}
function languageInstruction(language){
  if(language==='en') return 'Write every user-visible exam field exclusively in English. Do not use Arabic text except standard scientific symbols and notation.';
  if(language==='ar') return 'Write every user-visible exam field exclusively in Arabic. Keep scientific symbols and equations standard.';
  if(language==='both') return 'Use bilingual Arabic and English only where explicitly requested, keeping each question internally consistent.';
  return 'Infer the user-facing language from the academic path and payload, then keep it consistent.';
}

const examSchema={name:'mortaqa_exam',schema:{type:'object',properties:{title:{type:'string'},description:{type:'string'},language:{type:'string',enum:['ar','en','both']},visibility:{type:'string',enum:['public','group','private']},questions:{type:'array',items:{type:'object',properties:{id:{type:'string'},type:{type:'string',enum:['mcq']},question:{type:'string'},passage:{type:'string'},options:{type:'array',items:{type:'string'}},answerIndex:{type:'integer',minimum:0,maximum:5},explanation:{type:'string'},topic:{type:'string'}},required:['id','type','question','passage','options','answerIndex','explanation','topic'],additionalProperties:false}}},required:['title','description','language','visibility','questions'],additionalProperties:false}};
const taskScoreSchema={name:'mortaqa_task_score',schema:{type:'object',properties:{points:{type:'integer',minimum:5,maximum:500},effortBand:{type:'string',enum:['tiny','light','medium','heavy','major']},reason:{type:'string'}},required:['points','effortBand','reason'],additionalProperties:false}};
const scheduleSchema={name:'mortaqa_schedule',schema:{type:'object',properties:{schedule:{type:'array',items:{type:'object',properties:{time:{type:'string'},endTime:{type:'string'},title:{type:'string'},durationMinutes:{type:'integer',minimum:5,maximum:240},taskId:{type:'string'},subject:{type:'string'},reason:{type:'string'}},required:['time','endTime','title','durationMinutes','taskId','subject','reason'],additionalProperties:false}}},required:['schedule'],additionalProperties:false}};
const flashcardSchema={name:'mortaqa_flashcards',schema:{type:'object',properties:{cards:{type:'array',items:{type:'object',properties:{front:{type:'string'},back:{type:'string'},topic:{type:'string'},difficulty:{type:'string',enum:['easy','medium','hard']}},required:['front','back','topic','difficulty'],additionalProperties:false}}},required:['cards'],additionalProperties:false}};
const mentorSchema={name:'mortaqa_mentor',schema:{type:'object',properties:{summary:{type:'string'},strengths:{type:'array',items:{type:'string'}},weaknesses:{type:'array',items:{type:'string'}},actions:{type:'array',items:{type:'string'}},prioritySubjects:{type:'array',items:{type:'string'}}},required:['summary','strengths','weaknesses','actions','prioritySubjects'],additionalProperties:false}};
const analysisSchema={name:'mortaqa_exam_analysis',schema:{type:'object',properties:{score:{type:'number'},summary:{type:'string'},strengths:{type:'array',items:{type:'string'}},weakTopics:{type:'array',items:{type:'string'}},errorPatterns:{type:'array',items:{type:'string'}},nextSteps:{type:'array',items:{type:'string'}}},required:['score','summary','strengths','weakTopics','errorPatterns','nextSteps'],additionalProperties:false}};

async function structuredCall({schema,task,messages,model}){
  const r=await codeCraftChat({model:model||await chooseModel(task),messages,responseFormat:{type:'json_object'},temperature:0.2});
  return parseJson(r.content);
}

async function handleMode(mode,payload={}){
  const profile=payload.profile||{};
  const path=payload.academicPath||[profile.system,profile.grade,profile.track,profile.university,profile.faculty,profile.department].filter(Boolean).join(' / ');
  const shared=`Student academic path: ${path||'unknown'}\nStudent profile: ${compact(profile)}`;
  switch(mode){
    case 'generate_exam': return structuredCall({schema:examSchema,task:'reasoning',messages:[
      {role:'system',content:`You are Mortaqa's production exam engine. Build coherent MCQs from supplied curriculum/source only. Never invent a curriculum unit that is absent. Validate answerIndex. Keep difficulty varied and academically appropriate. ${languageInstruction(payload.language||'auto')} Return JSON only.`},
      {role:'user',content:`${shared}\nRequested language: ${payload.language||'auto'}\nTitle: ${payload.title||'Practice Exam'}\nCount: ${payload.questionCount||10}\nSubject: ${payload.subject||''}\nCurriculum key: ${payload.curriculumPath||''}\nSettings: ${compact(payload.settings||{})}\nSource:\n${compact(payload.sourceText||'')}`}
    ]});
    case 'score_task': return structuredCall({schema:taskScoreSchema,task:'fast',model:process.env.CODECRAFT_MODEL_FAST,messages:[
      {role:'system',content:'You are Mortaqa Task Scorer. Assign fair points from estimated effort, time, complexity, cognitive load, and evidence. Do not inflate points. Stay within 5-500. Return JSON only.'},
      {role:'user',content:`${shared}\nTask title: ${compact(payload.title)}\nDescription: ${compact(payload.description)}\nRequested: ${payload.requestedPoints??'none'}\nCurriculum: ${payload.curriculumPath||''}`}
    ]});
    case 'schedule': return structuredCall({schema:scheduleSchema,task:'reasoning',messages:[
      {role:'system',content:'You are Mortaqa Planner. Use only supplied tasks. Avoid impossible overlaps. Use wake time, available hours and requested morning/evening windows. Return JSON only.'},
      {role:'user',content:`${shared}\nWake: ${payload.wakeTime||'07:00'}\nHours: ${payload.availableHours||2}\nDate: ${payload.date||''}\nTasks: ${compact(payload.tasks||[])}`}
    ]});
    case 'generate_flashcards': return structuredCall({schema:flashcardSchema,task:'fast',messages:[
      {role:'system',content:'You are Mortaqa Flashcard Engine. Extract atomic high-yield concepts from the supplied source only. Keep each card answer accurate to the source.'},
      {role:'user',content:`${shared}\nCount: ${payload.count||12}\nLanguage: ${payload.language||'auto'}\nSource:\n${compact(payload.text||'')}`}
    ]});
    case 'mentor_report': return structuredCall({schema:mentorSchema,task:'reasoning',messages:[
      {role:'system',content:'You are Mortaqa AI Mentor. Analyze only observed study/assessment data. Do not diagnose conditions. State when data is sparse.'},
      {role:'user',content:`${shared}\nAnalytics: ${compact(payload.analytics||{})}\nAttempts: ${compact(payload.attempts||[])}\nTasks: ${compact(payload.tasks||[])}`}
    ]});
    case 'exam_analysis': return structuredCall({schema:analysisSchema,task:'reasoning',messages:[
      {role:'system',content:'You are Mortaqa Super AI Analyzer. Identify topic weaknesses only when supported by attempt details. Do not claim certainty from sparse evidence.'},
      {role:'user',content:`${shared}\nAttempt: ${compact(payload.attempt||{})}\nExam: ${compact(payload.exam||{})}`}
    ]});
    case 'clone_exam': return structuredCall({schema:examSchema,task:'reasoning',messages:[
      {role:'system',content:`You are Mortaqa Clone Exam Engine. Create a fresh exam targeting the same weak concepts with new wording/examples. Do not copy answer keys. ${languageInstruction(payload.language||'auto')}`},
      {role:'user',content:`${shared}\nAnalysis: ${compact(payload.analysis||{})}\nBase exam: ${compact(payload.baseExam||{})}`}
    ]});
    case 'explain_answer': return (await codeCraftChat({task:'general',messages:[
      {role:'system',content:'You are Mortaqa Tutor. Explain the supplied question and why the correct answer is correct. Do not expose hidden reasoning. Use the supplied context only.'},
      {role:'user',content:`${shared}\nQuestion: ${compact(payload.question)}\nOptions: ${compact(payload.options||[])}\nChosen: ${payload.chosenIndex??'none'}\nCorrect: ${payload.correctIndex??'unknown'}\nContext: ${compact(payload.context||{})}`}
    ]})).content;
    case 'tutor': return (await codeCraftChat({task:payload.image?'vision':'general',messages:[
      {role:'system',content:'You are Mortaqa AI Tutor. Teach clearly from supplied material. Preserve equations using LaTeX when useful. Do not invent citations.'},
      {role:'user',content:payload.image?[{type:'text',text:`${shared}\nQuestion/instruction: ${payload.message||'Explain this.'}\nMaterial context:\n${compact(payload.text||'')}`},{type:'image_url',image_url:{url:payload.image}}]:`${shared}\nLanguage: ${payload.language||'auto'}\nFormat: ${payload.format||'markdown'}\nLaTeX: ${payload.latex!==false}\nMaterial:\n${compact(payload.text||'')}`}
    ]})).content;
    case 'assistant': return (await codeCraftChat({task:'general',messages:[
      {role:'system',content:'You are Mortaqa Platform Assistant. Answer questions about the student study plan, curriculum, tasks, progress, exams, points, projects and groups using only supplied context. Never expose secrets or security rules.'},
      {role:'user',content:`${shared}\nAnalytics: ${compact(payload.analytics||{})}\nTasks: ${compact(payload.tasks||[])}\nGroups: ${compact(payload.groups||[])}\nCurriculum: ${compact(payload.curriculum||{})}\nQuestion: ${compact(payload.message||'')}`}
    ]})).content;
    case 'onboarding_quote': return (await codeCraftChat({task:'general',messages:[
      {role:'system',content:'Return one verified Quran verse OR one verified hadith from a supplied safe library only. If the supplied library is empty, say SAFE_FALLBACK. Do not fabricate religious text.'},
      {role:'user',content:`Student path: ${path}\nGoal: ${payload.goal||''}\nProfile: ${compact(profile)}\nSafe quote library: ${compact(payload.quoteLibrary||[])}`}
    ]})).content;
    case 'admin_research': {
      const query=compact(payload.query||'');
      const prompt=`Research this educational content request: ${query}. Academic path: ${path}. Return a JSON object with candidates [{title,url,type,reason,confidence,source}] and notes. Prefer first-party/official sources, identify conflicts, and never claim a source was verified if you did not inspect it.`;
      let researchModel=await chooseModel('research');
      const tools=[{type:'web_search'}];
      try{
        const r=await codeCraftChat({model:researchModel,task:'research',tools,messages:[{role:'system',content:'You are Mortaqa Admin Research Agent. Research only for content curation. Keep URLs and source names. Do not publish automatically.'},{role:'user',content:prompt}],responseFormat:{type:'json_object'},temperature:0.1});
        return parseJson(r.content);
      }catch(e){
        e.message=`Research model/tool failed: ${e.message}`; throw e;
      }
    }
    default: throw err(`Unsupported AI mode: ${mode}`,400);
  }
}

async function proxyOpenAICompatible(body){
  const models=await fetchModels();
  const requested=body?.model||'';
  const exists=models.some(m=>modelId(m)===requested);
  let task='general';
  const messages=body?.messages||[];
  const txt=JSON.stringify(messages).toLowerCase();
  if(/image_url|vision|image/.test(txt)) task='vision';
  else if(/reason|analysis|exam|mentor|curriculum/.test(txt)) task='reasoning';
  const model=exists?requested:await chooseModel(task);
  const safeBody={...body,model};
  // Never allow clients to bypass our server-side key; remove unsupported/legacy provider fields if present.
  delete safeBody.api_key; delete safeBody.authorization;
  return codeCraftChat({model,messages:safeBody.messages||[],responseFormat:safeBody.response_format,temperature:safeBody.temperature,maxTokens:safeBody.max_tokens||MAX_OUT,tools:safeBody.tools,stream:!!safeBody.stream});
}


async function codeCraftEmbedding(input,model){
  const key=process.env.CODECRAFT_API_KEY; if(!key) throw err('CODECRAFT_API_KEY is not configured.',503);
  const base=(process.env.CODECRAFT_BASE_URL||'https://codecraftapi.com/v1').replace(/\/$/,'');
  const models=await fetchModels();
  const chosen=model || process.env.CODECRAFT_MODEL_EMBEDDING || modelId(models.find(m=>supports(m,'embeddings'))||{});
  if(!chosen) throw err('No embeddings-capable CodeCraft model is available.',503);
  const r=await fetch(`${base}/embeddings`,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({model:chosen,input})});
  const raw=await r.text(); let data; try{data=JSON.parse(raw)}catch{data={raw};}
  if(!r.ok) throw err(data?.error?.message||`CodeCraft embeddings HTTP ${r.status}`,r.status>=500?502:r.status);
  return data;
}

module.exports={handleMode,compact,fetchModels,chooseModel,codeCraftChat,codeCraftEmbedding,proxyOpenAICompatible,modelId,caps,supports};
