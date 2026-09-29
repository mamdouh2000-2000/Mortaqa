// ==========================================
// 1. Firebase Configuration & Utils
// ==========================================
const runtimeFirebaseConfig = window.MORTAQA_CONFIG?.firebase || {};
const firebaseConfig = runtimeFirebaseConfig;
let db = null;
let firebaseReady = false;
try {
  if (window.firebase?.apps && window.firebase.apps.length === 0 && firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId) {
    firebase.initializeApp(firebaseConfig);
  }
  if (window.firebase?.apps?.length) { db = firebase.firestore(); firebaseReady = true; }
} catch (e) { console.warn('[Mortaqa] Firebase client not configured yet.', e); }

function showToast(message, type="info") {
    const tc = document.getElementById('toast-container');
    if(!tc) return;
    const toast = document.createElement('div');
    
    let icon = '<i class="fas fa-info-circle"></i>';
    if(type === 'success') icon = '<i class="fas fa-check-circle"></i>';
    if(type === 'error') icon = '<i class="fas fa-exclamation-triangle"></i>';
    if(type === 'challenge') icon = '<i class="fas fa-crosshairs"></i>';

    toast.className = `toast ${type}`;
    toast.innerHTML = `${icon} <span>${message}</span>`;
    
    tc.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideDown 0.3s ease-in reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, type === 'challenge' ? 8000 : 4000);
}

// ==========================================
// 2. Data Models, Time & Constants
// ==========================================
let currentUser = null;

function getEgyptBattleDate() {
    let now = new Date();
    now.setHours(now.getHours() - 2); 
    return now.toISOString().split('T')[0];
}

let todayStr = getEgyptBattleDate();
let currentDate = todayStr;

const masterTaskTypes = [
    { key: 'URT_Pieces', label: 'قطعة URT' },
    { key: 'URT_Full', label: 'امتحان URT كامل' },
    { key: 'TOC_Normal', label: 'شيت TOC (عادي)' },
    { key: 'TOC_Essay', label: 'شيت TOC (مقال)' },
    { key: 'Sessions', label: 'مذاكرة سيشن' },
    { key: 'Essay_Writing', label: 'تعبير / Essay' },
    { key: 'Vocab', label: 'حفظ كلمات (الكلمة = 2 نقطة)' }
];

const subjectsList = ['Arabic', 'English', 'German', 'French', 'Math', 'Mechanics', 'Physics', 'Chemistry', 'Biology', 'Geo'];

const finalsCurriculum = {
    'Arabic': {
        'النصوص': ['غربة وحنين', 'المساء', 'النسور', 'رثاء مي', 'من أنت يا نفس', 'أهواك يا وطني', 'الكنيسة نورت'],
        'الأدب (المدارس)': ['الواقعية', 'المهاجر', 'الرومانتيكية', 'الكلاسيكية', 'الديوان', 'أبولو'],
        'النحو': ['الوحدة الأولى', 'الوحدة الثانية', 'الوحدة الثالثة', 'الوحدة الرابعة', 'الوحدة الخامسة', 'الوحدة السادسة', 'الوحدة السابعة'],
        'البلاغة': ['مراجعة بلاغة شاملة']
    },
    'English': {
        'Vocab': ['Upstream Unit 1', 'Upstream Unit 2', 'Upstream Unit 4', 'Upstream Unit 7', 'Upstream Unit 8', 'Sec School U1', 'Sec School U2', 'Sec School U3', 'Sec School U4', 'Sec School U5', 'Sec School U6', 'Sec School U7', 'Sec School U8', 'Sec School U9', 'Sec School U10', 'Sec School U11', 'Sec School U12'],
        'Grammar': ['Upstream Unit 1', 'Upstream Unit 2', 'Upstream Unit 4', 'Upstream Unit 7', 'Upstream Unit 8', 'Sec School U1', 'Sec School U2', 'Sec School U3', 'Sec School U4', 'Sec School U5', 'Sec School U6', 'Sec School U7', 'Sec School U8', 'Sec School U9', 'Sec School U10', 'Sec School U11', 'Sec School U12']
    },
    'Languages': {
        'Grammar': ['Lektion/Unit 1', 'Lektion/Unit 2', 'Lektion/Unit 3', 'Lektion/Unit 4', 'Lektion/Unit 5', 'Lektion/Unit 6'],
        'Vocab': ['Lektion/Unit 1', 'Lektion/Unit 2', 'Lektion/Unit 3', 'Lektion/Unit 4', 'Lektion/Unit 5', 'Lektion/Unit 6']
    }
};

const defaultSubjects = {};
subjectsList.forEach(sub => {
    defaultSubjects[sub] = { URT_Pieces: 0, URT_Full: 0, TOC_Normal: 0, TOC_Essay: 0, Essay_Writing: 0, Sessions: 0, Expression: 0, Vocab: 0 };
});

const defaultSpiritual = {
    'صلاة الفجر': { done: false, delay: 0, type: 'fard' },
    'صلاة الصبح': { done: false, delay: 0, type: 'fard' },
    'صلاة الظهر': { done: false, delay: 0, type: 'fard' },
    'صلاة العصر': { done: false, delay: 0, type: 'fard' },
    'صلاة المغرب': { done: false, delay: 0, type: 'fard' },
    'صلاة العشاء': { done: false, delay: 0, type: 'fard' },
    'نافلة الظهر': { done: false, delay: 0, rakat: 0, type: 'nafl' },
    'نافلة الفجر': { done: false, delay: 0, rakat: 0, type: 'nafl' },
    'نافلة المغرب': { done: false, delay: 0, rakat: 0, type: 'nafl' },
    'نافلة العشاء': { done: false, delay: 0, rakat: 0, type: 'nafl' },
    'قيام الليل': { done: false, delay: 0, rakat: 0, type: 'qiyam' },
    'الورد (قرآن)': { done: false, delay: 0, type: 'wird' },
    'الحديث': { done: false, delay: 0, type: 'fard' }
};
let localData = {
    points: 0,
    subjects: JSON.parse(JSON.stringify(defaultSubjects)),
    spiritual: JSON.parse(JSON.stringify(defaultSpiritual)),
    dailySelection: [], 
    customTaskStates: {} 
};

let partnerData = { subjects: {}, customTaskStates: {} }; 
let sharedCustomTasks = []; 
let sharedExams = []; 
let sharedProjects = []; 
let activeExamData = null;

let materialsUnsubscribe = null;
let currentMaterialSubject = "";
let storage = null; try { storage = firebaseReady && window?.MORTAQA_CONFIG?.features?.firebaseStorage && firebase.storage ? firebase.storage() : null; } catch(e) { storage = null; } 

let examTimerInterval = null;
let myFlashcards = [];
let dueFlashcards = [];
let currentStudyIndex = 0;
let activeFCQuiz = null;
let pomodoroInterval = null;
let pomodoroTimeLeft = 0;

let charts = { radar: null, bar: null, doughnut: null };
let unsubscribeShared = null; 
let unsubscribePartner = null; 
let unsubscribeCustom = null;
let unsubscribeExams = null;
let unsubscribeFlashcards = null;
let unsubscribeProjects = null;
let unsubscribePartnerStatus = null;
let unsubscribeMyChallenge = null;

// ==========================================
// 3. Login & Navigation
// ==========================================
// ==========================================
// ==========================================
// 🔐 MORTAQA ONBOARDING WIZARD & AI ENGINE
// ==========================================

// Legacy auto-login disabled in final build; Firebase Auth boot owns session restoration.

function showLoginPanel() {
    document.getElementById('login-choice-screen').classList.add('hidden');
    document.getElementById('login-panel').classList.remove('hidden');
}

function backToMainChoice() {
    document.getElementById('login-panel').classList.add('hidden');
    document.getElementById('wizard-screen').classList.add('hidden');
    document.getElementById('login-choice-screen').classList.remove('hidden');
}

async function processLogin() {
    const username = document.getElementById('login-username').value.trim();
    const pin = document.getElementById('login-pin').value.trim();
    if(!username || !pin) return showToast("برجاء إدخال اسم المستخدم والرقم السري", "error");
    if(!db) return showToast("قاعدة البيانات غير متصلة!", "error");

    try {
        const docRef = await db.collection('users').doc(username).get();
        if(docRef.exists && docRef.data().pin === pin) {
            localStorage.setItem('mortaqa_active_user', username);
            completeLogin(username, true);
        } else {
            showToast("البيانات غير صحيحة", "error");
        }
    } catch(err) { showToast("خطأ في الاتصال", "error"); }
}

// ------------------------------------------
// 🧠 شجرة المناهج المعمارية والمحرك الديناميكي
// ------------------------------------------
const eduTree = {
    stages: [
        { id: "prep", label: "المرحلة الإعدادية (عام)" },
        { id: "sec_ar", label: "الثانوية العامة (عربي)" },
        { id: "sec_lang", label: "الثانوية العامة (لغات)" },
        { id: "igcse", label: "الشهادة البريطانية (IGCSE)" },
        { id: "american", label: "الدبلومة الأمريكية (American Diploma)" },
        { id: "stem", label: "مدارس المتفوقين (STEM)" },
        { id: "agri", label: "التعليم الفني الزراعي" },
        { id: "university", label: "مرحلة التعليم الجامعي والمعاهد" }
    ],
    prep_grades: [{ id: "prep_1", label: "الأول الإعدادي" }, { id: "prep_2", label: "الثاني الإعدادي" }, { id: "prep_3", label: "الثالث الإعدادي (الشهادة)" }],
    sec_grades: [{ id: "sec_1", label: "الأول الثانوي" }, { id: "sec_2", label: "الثاني الثانوي" }, { id: "sec_3", label: "الثالث الثانوي" }],
    sec_1_system: [{ id: "sec_1_new", label: "نظام البكالوريا الجديد (6 مواد)" }, { id: "sec_1_old", label: "باقٍ للإعادة (النظام القديم)" }],
    sec_2_branches: [{ id: "sec_2_sci", label: "الشعبة العلمية" }, { id: "sec_2_art", label: "الشعبة الأدبية" }],
    sec_3_branches: [{ id: "sec_3_sci", label: "علمي علوم" }, { id: "sec_3_math", label: "علمي رياضة" }, { id: "sec_3_art", label: "أدبي" }],
    igcse_levels: [{ id: "ig_10", label: "Year 10 (O-Level)" }, { id: "ig_11", label: "Year 11 (O-Level + AS)" }, { id: "ig_12", label: "Year 12 (AS / A-Level)" }],
    target_sector: [{ id: "target_med", label: "القطاع الطبي" }, { id: "target_eng", label: "القطاع الهندسي" }, { id: "target_arts", label: "القطاع النظري" }],
    american_tests: [{ id: "est", label: "الاختبار المصري EST" }, { id: "sat", label: "الاختبار الأمريكي SAT" }, { id: "act", label: "الاختبار الأمريكي ACT" }],
    stem_grades: [{ id: "stem_10", label: "Grade 10" }, { id: "stem_11", label: "Grade 11" }, { id: "stem_12", label: "Grade 12 (تخصص)" }],
    stem_12_branches: [{ id: "stem_12_sci", label: "مجموعة العلوم (طبي)" }, { id: "stem_12_math", label: "مجموعة الرياضيات (هندسي)" }],
    agri_system: [{ id: "agri_3", label: "نظام 3 سنوات" }, { id: "agri_5", label: "نظام 5 سنوات" }],
    agri_branches: [{ id: "agri_plant", label: "إنتاج نباتي" }, { id: "agri_animal", label: "إنتاج حيواني" }, { id: "agri_food", label: "صناعات غذائية" }, { id: "agri_mech", label: "ميكنة زراعية" }, { id: "agri_land", label: "استصلاح أراضي" }],
    uni_types: [{ id: "uni_gov", label: "جامعات حكومية" }, { id: "uni_priv", label: "جامعات خاصة" }, { id: "uni_nat", label: "جامعات أهلية" }, { id: "uni_tech", label: "جامعات تكنولوجية" }, { id: "uni_intl", label: "باتفاقيات دولية" }, { id: "uni_inst", label: "معاهد عليا خاصة" }],
    gov_unis: ["القاهرة", "الإسكندرية", "عين شمس", "أسيوط", "طنطا", "المنصورة", "الزقازيق", "حلوان", "المنيا", "المنوفية", "قناة السويس", "بنها", "كفر الشيخ", "بورسعيد", "دمياط", "السويس"].map(u => ({ id: `gov_${u}`, label: `جامعة ${u}` })),
    faculties: [{ id: "fac_eng", label: "كلية الهندسة" }, { id: "fac_pharm", label: "كلية الصيدلة (PharmD)" }, { id: "fac_med", label: "الطب البشري" }, { id: "fac_dent", label: "طب الأسنان / علاج طبيعي" }, { id: "fac_health", label: "المعهد الفني الصحي" }, { id: "fac_other", label: "كليات أخرى" }],
    eng_branches: [{ id: "eng_prep", label: "إعدادي هندسة" }, { id: "eng_civil", label: "هندسة مدنية/معمارية" }, { id: "eng_mech", label: "هندسة ميكانيكية" }, { id: "eng_elec", label: "هندسة كهربائية/اتصالات" }, { id: "eng_cs", label: "حاسبات وبرمجيات" }],
    health_inst_branches: [{ id: "hi_xray", label: "أشعة وتصوير" }, { id: "hi_lab", label: "مختبرات (تحاليل)" }, { id: "hi_dent", label: "تركيبات أسنان" }, { id: "hi_device", label: "صيانة أجهزة طبية" }, { id: "hi_nurs", label: "تمريض" }],
    likert_scale: [{ id: "5", label: "دائماً" }, { id: "4", label: "غالباً" }, { id: "3", label: "أحياناً" }, { id: "2", label: "نادراً" }, { id: "1", label: "أبداً" }],
    academic_level: [{ id: "advanced", label: "طالب متفوق - أبحث عن تحديات" }, { id: "intermediate", label: "متوسط - أحتاج مراجعات" }, { id: "support", label: "بحاجة لدعم وتأسيس" }],
    hobbies: [{ id: "h_code", label: "البرمجة والتكنولوجيا 💻" }, { id: "h_read", label: "الأدب والتاريخ 📚" }, { id: "h_games", label: "الألعاب والتصميم 🎮" }, { id: "h_sport", label: "الرياضة ⚽" }],
    marketing: [{ id: "m_social", label: "سوشيال ميديا" }, { id: "m_video", label: "يوتيوب / تيك توك" }, { id: "m_friend", label: "ترشيح من صديق" }, { id: "m_search", label: "بحث جوجل" }]
};

let wizardSteps = [];
let currentStepIndex = 0;
let userProfile = {};
function startWizard() {
    userProfile = {};
    // بنحط الخطوة الأولى بس في البداية
    wizardSteps = [
        {
            id: 'basic_info', title: 'بياناتك الأساسية 📝', subtitle: 'لنبدأ بتجهيز ملفك الشخصي.', type: 'form',
            fields: [
                { id: 'u_name', type: 'text', label: 'اسم المستخدم (للدخول)', placeholder: 'مثال: Mido2026', dir: 'ltr' },
                { id: 'u_pin', type: 'password', label: 'الرقم السري (PIN)', placeholder: '****', dir: 'ltr' },
                { id: 'u_phone', type: 'tel', label: 'رقم الهاتف (+20)', placeholder: '010XXXXXXXX', dir: 'ltr' }
            ]
        }
    ];
    currentStepIndex = 0;
    document.getElementById('login-choice-screen').classList.add('hidden');
    document.getElementById('wizard-screen').classList.remove('hidden');
    
    // استدعاء الدالة دي هنا بيخلي الكود يجهز خطوة "المرحلة الدراسية" عشان زرار "التالي" يظهر
    determineNextSteps(); 
    renderCurrentStep();
}

function determineNextSteps() {
    let currentStep = wizardSteps[currentStepIndex];
    let selectedVal = currentStep.key ? userProfile[currentStep.key] : null;

    // تنظيف الخطوات اللي قدام لو الطالب رجع غير رأيه
    wizardSteps = wizardSteps.slice(0, currentStepIndex + 1);

    // 1. من البيانات الأساسية -> للمرحلة
    if (currentStep.id === 'basic_info') {
        addStep('main_stage', 'ما هي مرحلتك الدراسية؟ 🎓', eduTree.stages, 'stage');
    }
    // 2. من المرحلة -> للتفاصيل
    else if (currentStep.id === 'main_stage') {
        if (selectedVal === 'prep') addStep('prep_grade', 'أي صف إعدادي؟', eduTree.prep_grades, 'grade');
        else if (selectedVal === 'sec_ar' || selectedVal === 'sec_lang') addStep('sec_grade', 'أي صف ثانوي؟', eduTree.sec_grades, 'grade');
        else if (selectedVal === 'igcse') addStep('ig_level', 'حدد المستوى (Year)', eduTree.igcse_levels, 'grade');
        else if (selectedVal === 'american') addStep('am_test', 'نوع الاختبار القياسي؟', eduTree.american_tests, 'system');
        else if (selectedVal === 'stem') addStep('stem_grade', 'في أي Grade تدرس؟', eduTree.stem_grades, 'grade');
        else if (selectedVal === 'agri') addStep('agri_sys', 'ما هو نظام مدرستك؟', eduTree.agri_system, 'system');
        else if (selectedVal === 'university') addStep('uni_type', 'تصنيف جامعتك؟', eduTree.uni_types, 'uni_type');
    }
    
    // --- مسار الجامعة ---
    else if (currentStep.id === 'uni_type') {
        if (selectedVal === 'uni_gov') addStep('uni_name', 'اختر جامعتك الحكومية', eduTree.gov_unis, 'university');
        else addStep('faculty', 'ما هي كليتك؟', eduTree.faculties, 'faculty'); // لو أهلية أو خاصة يدخل ع الكلية علطول
    }
    else if (currentStep.id === 'uni_name') {
        addStep('faculty', 'ما هي كليتك؟', eduTree.faculties, 'faculty');
    }
    else if (currentStep.id === 'faculty') {
        if (selectedVal === 'fac_eng') addStep('eng_br', 'قسمك الهندسي؟', eduTree.eng_branches, 'branch');
        else if (selectedVal === 'fac_health') addStep('hi_br', 'تخصص المعهد الفني؟', eduTree.health_inst_branches, 'branch');
        else triggerPsychologicalSteps(); // كليات تانية تنهي المسار
    }
    else if (currentStep.id === 'eng_br' || currentStep.id === 'hi_br') triggerPsychologicalSteps();

    // --- مسار الثانوي ---
    else if (currentStep.id === 'sec_grade') {
        if (selectedVal === 'sec_1') addStep('sec_1_sys', 'نظام البكالوريا أم إعادة؟', eduTree.sec_1_system, 'system');
        else if (selectedVal === 'sec_2') addStep('sec_2_br', 'ما هي شعبتك؟', eduTree.sec_2_branches, 'branch');
        else if (selectedVal === 'sec_3') addStep('sec_3_br', 'ما هي شعبتك؟', eduTree.sec_3_branches, 'branch');
    }
    else if (currentStep.id === 'sec_1_sys' || currentStep.id === 'sec_2_br' || currentStep.id === 'sec_3_br') triggerPsychologicalSteps();
    
    // --- مسارات أخرى ---
    else if (currentStep.id === 'prep_grade') triggerPsychologicalSteps();
    else if (currentStep.id === 'ig_level') addStep('target_sector', 'القطاع الجامعي المستهدف؟', eduTree.target_sector, 'sector');
    else if (currentStep.id === 'am_test') addStep('target_sector', 'القطاع الجامعي المستهدف؟', eduTree.target_sector, 'sector');
    else if (currentStep.id === 'target_sector') triggerPsychologicalSteps();
    
    else if (currentStep.id === 'stem_grade') {
        if (selectedVal === 'stem_12') addStep('stem_branch', 'المجموعة التخصصية؟', eduTree.stem_12_branches, 'branch');
        else triggerPsychologicalSteps();
    }
    else if (currentStep.id === 'stem_branch') triggerPsychologicalSteps();
    
    else if (currentStep.id === 'agri_sys') addStep('agri_branch', 'تخصصك الزراعي؟', eduTree.agri_branches, 'branch');
    else if (currentStep.id === 'agri_branch') triggerPsychologicalSteps();

    // --- الأسئلة النفسية بالتتابع المتسلسل ---
    else if (currentStep.id === 'psy_1') addStep('academic_lvl', 'كيف تقيم مستواك الأكاديمي؟', eduTree.academic_level, 'acad_level');
    else if (currentStep.id === 'academic_lvl') addStep('hobbies', 'أهم اهتماماتك؟ (اختر ما تشاء)', eduTree.hobbies, 'hobbies', true);
    else if (currentStep.id === 'hobbies') addStep('marketing', 'كيف تعرفت علينا؟', eduTree.marketing, 'source');
}

// دالة مساعدة لنداء أول سؤال نفسي بعد نهاية أي مسار أكاديمي
function triggerPsychologicalSteps() {
    addStep('psy_1', 'أثناء المذاكرة أواجه صعوبة في الجلوس لفترات طويلة...', eduTree.likert_scale, 'adhd_1');
}

function addStep(id, title, options, key, isMulti = false) { wizardSteps.push({ id, title, subtitle: '', type: 'cards', options, key, multi: isMulti }); }

function renderCurrentStep() {
    const step = wizardSteps[currentStepIndex];
    const area = document.getElementById('wizard-content-area');
    document.getElementById('wizard-progress').style.width = `${Math.min(100, ((currentStepIndex + 1) / wizardSteps.length) * 100)}%`;
    
    let html = `<div style="animation: slideIn 0.3s ease-out; text-align: center;"><h2 class="text-cyan mb-10" style="font-size:22px;">${step.title}</h2><p class="text-muted mb-20">${step.subtitle}</p>`;
    
    if (step.type === 'form') {
        html += `<div style="text-align: right; direction: rtl;">`;
        step.fields.forEach(f => {
            html += `<label class="text-muted" style="font-size:12px; display:block; margin-bottom:5px;">${f.label}</label>
                     <input type="${f.type}" id="inp_${f.id}" class="input-dark mb-15" placeholder="${f.placeholder}" dir="${f.dir||'auto'}" value="${userProfile[f.id] || ''}" oninput="validateForm()">`;
        });
        html += `</div>`;
    } else {
        html += `<div class="wizard-grid ${step.options.length > 4 ? 'grid-2' : ''}" style="max-height: 40vh; overflow-y: auto; padding: 5px;">`;
        step.options.forEach(opt => {
            let isSelected = step.multi ? (userProfile[step.key] && userProfile[step.key].includes(opt.id)) : (userProfile[step.key] === opt.id);
            html += `<div class="wiz-card ${isSelected ? 'selected' : ''}" onclick="selectOption('${step.key}', '${opt.id}', ${step.multi})">${opt.label}</div>`;
        });
        html += `</div>`;
    }
    area.innerHTML = html + `</div>`;
    updateButtons();
}

function selectOption(key, valId, isMulti) {
    if (isMulti) {
        if (!userProfile[key]) userProfile[key] = [];
        let idx = userProfile[key].indexOf(valId);
        if (idx > -1) userProfile[key].splice(idx, 1); else userProfile[key].push(valId);
    } else { userProfile[key] = valId; }
    renderCurrentStep();
    if (!isMulti && userProfile[key]) setTimeout(() => nextWizardStep(), 300);
}

function validateForm() {
    let isValid = true;
    wizardSteps[currentStepIndex].fields.forEach(f => {
        let el = document.getElementById(`inp_${f.id}`);
        if (!el || el.value.trim() === '') isValid = false;
        userProfile[f.id] = el ? el.value.trim() : '';
    });
    document.getElementById('wizard-btn-next').disabled = !isValid;
}

function updateButtons() {
    const step = wizardSteps[currentStepIndex];
    document.getElementById('wizard-btn-prev').classList.toggle('hidden', currentStepIndex === 0);
    
    let btnNext = document.getElementById('wizard-btn-next');
    let btnSub = document.getElementById('wizard-btn-submit');
    
    if (currentStepIndex === wizardSteps.length - 1) {
        btnNext.classList.add('hidden'); btnSub.classList.remove('hidden');
        btnSub.disabled = step.multi ? !(userProfile[step.key] && userProfile[step.key].length > 0) : !userProfile[step.key];
    } else {
        btnSub.classList.add('hidden'); btnNext.classList.remove('hidden');
        if(step.type === 'form') validateForm();
        else btnNext.disabled = step.multi ? !(userProfile[step.key] && userProfile[step.key].length > 0) : !userProfile[step.key];
    }
}

function nextWizardStep() {
    if (document.getElementById('wizard-btn-next').disabled) return;
    if (wizardSteps[currentStepIndex].type === 'form') validateForm();
    determineNextSteps();
    currentStepIndex++; renderCurrentStep();
}

function prevWizardStep() { if (currentStepIndex > 0) { currentStepIndex--; renderCurrentStep(); } }

async function submitRegistration() {
    const btn = document.getElementById('wizard-btn-submit');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> إعداد ملفك...'; btn.disabled = true;

    const sysApiKey = '';
    let finalQuote = "رَّبِّ أَدْخِلْنِي مُدْخَلَ صِدْقٍ وَأَخْرِجْنِي مُخْرَجَ صِدْقٍ";
    const prompt = `أمامك طالب مصري في مسار: ${userProfile.stage}. استخرج آية قرآنية واحدة ملهمة بالتشكيل تناسبه للنجاح والتفوق. (النص بالتشكيل فقط دون شرح أو إضافات).`;

    try {
        const response = await fetch(`/api/ai-proxy`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sysApiKey}` },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: "user", content: prompt }], temperature: 0.5 })
        });
        const data = await response.json();
        if(!data.error) finalQuote = data.choices[0].message.content.trim().replace(/"/g, '');
        
        if(db) {
            await db.collection('users').doc(userProfile.u_name).set({
                username: userProfile.u_name, pin: userProfile.u_pin, phone: userProfile.u_phone,
                profileData: userProfile, aiQuote: finalQuote, createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch(e) { console.log(e); }

    localStorage.setItem('mortaqa_active_user', userProfile.u_name);
    localStorage.setItem('personal_quote_' + userProfile.u_name, finalQuote);
    
    document.getElementById('wizard-screen').classList.add('hidden');
    completeLogin(userProfile.u_name, true);
}

function completeLogin(user, showWelcome) {
    currentUser = user;
    document.getElementById('login-choice-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    document.getElementById('current-user-name').innerText = user.toUpperCase();
    
    let savedQuote = localStorage.getItem('personal_quote_' + user);
    if(savedQuote) document.getElementById('quote-personal').innerText = savedQuote;

    if (showWelcome) showToast(`مرحباً بك في مرتقى يا ${user}!`, 'info');
    fetchData(todayStr); startChatEngine(); 
}

function logout() { localStorage.removeItem('mortaqa_active_user'); location.reload(); }

function switchTab(tabId, btnElement) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(b => {
        b.classList.remove('active', 'cyan-border', 'orange-border', 'magenta-border');
        b.style.borderBottom = "none";
    });

    document.getElementById(tabId).classList.remove('hidden');
    if(btnElement) btnElement.classList.add('active');
    
    if(tabId === 'view-dashboard' && btnElement) btnElement.classList.add('cyan-border');
    if(tabId === 'view-history' && btnElement) btnElement.classList.add('orange-border');
    if(tabId === 'view-exams' && btnElement) btnElement.classList.add('magenta-border');
    if(tabId === 'view-flashcards' && btnElement) btnElement.style.borderBottom = "3px solid var(--cyan)";
    if(tabId === 'view-lab' && btnElement) btnElement.style.borderBottom = "3px solid #00E5FF";
    if(tabId === 'view-kanban' && btnElement) btnElement.style.borderBottom = "3px solid #00E676";
    if(tabId === 'view-leaderboard') {
        if(btnElement) btnElement.classList.add('cyan-border');
        loadLeaderboard('today');
    }
}

// ==========================================
// 4. Firebase Data Fetching & Sync
// ==========================================
async function fetchData(dateStr) {
    if(!db) return renderUI();
    
    // Fetch Local Data
    const docRef = db.collection('users').doc(currentUser).collection('daily_records').doc(dateStr);
    const doc = await docRef.get();
    
if (doc.exists) {
        let dbData = doc.data();
        localData.points = dbData.points || 0;
        localData.subjects = { ...JSON.parse(JSON.stringify(defaultSubjects)), ...(dbData.subjects || {}) };
        
        // 🟢 المترجم السحري المُعدل (قاتل العفاريت القديمة) 🟢
        let fetchedSpiritual = dbData.spiritual || {};
        const keyMap = {
            'Fajr': 'صلاة الفجر', 'Sobh': 'صلاة الصبح', 'Dhuhr': 'صلاة الظهر',
            'Asr': 'صلاة العصر', 'Maghrib': 'صلاة المغرب', 'Isha': 'صلاة العشاء',
            'Wird': 'الورد (قرآن)', 'Hadith': 'الحديث'
        };
        
        Object.keys(keyMap).forEach(oldKey => {
            if (fetchedSpiritual[oldKey] !== undefined) {
                // لو الصلاة بالعربي لسه متسجلتش، انقل بتاعت الإنجليزي مكانها
                if (fetchedSpiritual[keyMap[oldKey]] === undefined) {
                    fetchedSpiritual[keyMap[oldKey]] = fetchedSpiritual[oldKey];
                }
                // امسح الإنجليزي عشان ميقرفناش ويمسح الجديد
                delete fetchedSpiritual[oldKey];
            }
        });

        localData.spiritual = { ...JSON.parse(JSON.stringify(defaultSpiritual)), ...fetchedSpiritual };
        localData.customTaskStates = dbData.customTaskStates || {};
    } else {
        localData.points = 0;
        localData.subjects = JSON.parse(JSON.stringify(defaultSubjects));
        localData.spiritual = JSON.parse(JSON.stringify(defaultSpiritual));
        localData.customTaskStates = {};
    }

    let partnerUser = currentUser === 'Mamdouh' ? 'Sama' : 'Mamdouh';
    
    // Partner Daily Data
    if(unsubscribePartner) unsubscribePartner();
    unsubscribePartner = db.collection('users').doc(partnerUser).collection('daily_records').doc(dateStr).onSnapshot(pDoc => {
        if(pDoc.exists) partnerData = pDoc.data();
        else partnerData = { subjects: {}, customTaskStates: {} };
        renderSharedPoll(); 
        renderSharedCustomTasks();
    });

    // Partner Focus Status
    if(unsubscribePartnerStatus) unsubscribePartnerStatus();
    unsubscribePartnerStatus = db.collection('users').doc(partnerUser).onSnapshot(snap => {
        if(snap.exists) {
            let pStatus = snap.data().isFocusing;
            const banner = document.getElementById('partner-sync-banner');
            const bannerText = document.getElementById('sync-banner-text');
            if(banner && bannerText) {
                if(pStatus) {
                    bannerText.innerText = `${partnerUser} is in Deep Work Mode 🧠!`;
                    banner.classList.remove('hidden');
                } else {
                    banner.classList.add('hidden');
                }
            }
        }
    });

    // My Pending Challenges
    if(unsubscribeMyChallenge) unsubscribeMyChallenge();
    unsubscribeMyChallenge = db.collection('users').doc(currentUser).onSnapshot(snap => {
        if(snap.exists) {
            let data = snap.data();
            let descEl = document.getElementById('challenge-desc');
            let modal = document.getElementById('challenge-modal');
            if(data.pendingChallenge && descEl && modal) {
                descEl.innerText = `${partnerUser} challenged you to: ${data.pendingChallenge.examTitle}! 🥊`;
                modal.classList.remove('hidden');
                modal.dataset.examId = data.pendingChallenge.examId;
            }
        }
    });

    // Shared Polls
    if(unsubscribeShared) unsubscribeShared(); 
    unsubscribeShared = db.collection('shared_polls').doc(dateStr).onSnapshot((sharedDoc) => {
        if(sharedDoc.exists) localData.dailySelection = sharedDoc.data().tasks || [];
        else localData.dailySelection = [];
        renderSharedPoll();
        populateExamTaskDropdown(); 
    });

    // Shared Missions
    if(unsubscribeCustom) unsubscribeCustom();
    unsubscribeCustom = db.collection('shared_custom_tasks').doc(dateStr).onSnapshot((customDoc) => {
        if(customDoc.exists) sharedCustomTasks = customDoc.data().tasks || [];
        else sharedCustomTasks = [];
        renderSharedCustomTasks();
    });

    // Shared Exams
    if(unsubscribeExams) unsubscribeExams();
    unsubscribeExams = db.collection('shared_exams').orderBy('createdAt', 'desc').onSnapshot(snap => {
        sharedExams = [];
        snap.forEach(doc => sharedExams.push({id: doc.id, ...doc.data()}));
        renderExamsList();
    });

    // Neural Flashcards
    if(unsubscribeFlashcards) unsubscribeFlashcards();
    unsubscribeFlashcards = db.collection('users').doc(currentUser).collection('flashcards').onSnapshot(snap => {
        myFlashcards = [];
        snap.forEach(doc => myFlashcards.push({id: doc.id, ...doc.data()}));
        checkDueFlashcards();
    });

    // Kanban Projects
    if(unsubscribeProjects) unsubscribeProjects();
    unsubscribeProjects = db.collection('shared_projects').orderBy('createdAt', 'desc').onSnapshot(snap => {
        sharedProjects = [];
        snap.forEach(doc => sharedProjects.push({id: doc.id, ...doc.data()}));
        renderKanban();
    });

    // استماع لإشعارات الشات فقط
    db.collection('users').doc(currentUser).onSnapshot(snap => {
        if(snap.exists && snap.data().pendingChatAlert) {
            let alertData = snap.data().pendingChatAlert;
            showToast(`New msg from ${alertData.from}: ${alertData.msg}`, "info");
            db.collection('users').doc(currentUser).set({ pendingChatAlert: null }, { merge: true });
        }
    });

    renderUI();
}

async function saveToDB() {
    calculatePoints();
    if(!db) return;
    const docRef = db.collection('users').doc(currentUser).collection('daily_records').doc(currentDate);
    await docRef.set({
        points: localData.points,
        subjects: localData.subjects,
        spiritual: localData.spiritual,
        customTaskStates: localData.customTaskStates
    }, { merge: true });
}

function calculatePoints() {
    let total = 0;
    for (const [sub, tasks] of Object.entries(localData.subjects)) {
        
        for (const [taskKey, count] of Object.entries(tasks)) {
            if(count === 0) continue;

            // 🧪 حساب المهام العلمية المنفصلة للـ URT
            if (taskKey.startsWith('SciStd_')) {
                if (taskKey === 'SciStd_URT_Full') total += count * 500;
                else if (taskKey === 'SciStd_URT_Piece') total += count * 50;
                else if (taskKey === 'SciStd_Session_URT') total += count * 50;
            }
            // 🧪 حساب باقي المهام العلمية المدمجة (TOC / Sessions)
            else if (taskKey.startsWith('Sci_')) {
                let parts = taskKey.split('_'); 
                let mode = parts[2];
                if (mode && mode.includes('Session')) total += count * 50; // سيشن TOC أو شرح = 50
                else if (mode === 'SelfTOC') total += count * 1; // TOC عادي
            }
            // 📖 حساب نقاط اللغة العربية الأساسية
            else if (taskKey.startsWith('Arb_')) {
                if(taskKey.includes('URTFull')) total += count * 1000;
                else if(taskKey.includes('URTPiece')) total += count * 100;
                else if(taskKey.includes('TOCNormal')) total += count * 2;
                else if(taskKey.includes('Expression')) total += count * 50;
            }
            // 💬 حساب نقاط اللغات (انجلش ولغات) الأساسية
            else if (taskKey.startsWith('Lang_')) {
                if(taskKey.includes('URTFull')) total += count * 1000;
                else if(taskKey.includes('URTPiece')) total += count * 100;
                else if(taskKey.includes('TOCNormal')) total += count * 2;
                else if(taskKey.includes('Essay')) total += count * 50;
                else if(taskKey.includes('Vocab')) total += count * 2; 
            }
            // ⚙️ المهام المتقدمة (المنهج العربي واللغات)
            else if (taskKey.startsWith('Adv_')) {
                let parts = taskKey.split('_'); 
                let subj = parts[1];
                let cat = parts[2];
                let mode = parts[4]; 

                if (subj === 'Arabic') {
                    if (cat === 'النصوص') total += count * (mode === 'Session' ? 70 : 200);
                    else if (cat === 'الأدب (المدارس)') total += count * (mode === 'Session' ? 100 : 350);
                    else if (cat === 'النحو') total += count * (mode === 'Session' ? 100 : 120);
                    else if (cat === 'البلاغة') total += count * 300;
                } else if (subj === 'English' || subj === 'German' || subj === 'French') {
                    if (mode === 'Session') total += count * 400;
                    else if (cat === 'Grammar') total += count * 150;
                    else if (cat === 'Vocab') total += count * 350; 
                }
            }
        }
    }
    
    // 🕌 نقاط الروحانيات والنوافل والقيام 
    for (const [key, data] of Object.entries(localData.spiritual)) {
        if (data.done) {
            let base = 25; 
            if (data.type === 'wird') base = 200; 
            else if (key === 'الحديث') base = 40;
            else if (data.type === 'nafl') base = (data.rakat || 0) * 15; 
            else if (data.type === 'qiyam') base = (data.rakat || 0) * 100; 

            if (data.delay === 0) total += base;
            else if (data.delay === 1) total += Math.floor(base * 0.7);
            else if (data.delay === 2) total += Math.floor(base * 0.5);
            else if (data.delay === 3) total += Math.floor(base * 0.4);
        }
    }
    
    sharedCustomTasks.forEach(ct => {
        if(localData.customTaskStates[ct.id]) total += parseInt(ct.points);
    });

    localData.points = total;
    if(currentDate === todayStr) {
        let el = document.getElementById('header-score');
        if(el) el.innerText = total;
    }
}

// ==========================================
// 4.5 POMODORO SYNC ENGINE
// ==========================================
function startPomodoro() {
    let mins = document.getElementById('pomo-minutes').value;
    if(!mins || mins <= 0) return showToast("Enter a valid time.", "error");

    pomodoroTimeLeft = parseInt(mins) * 60;
    document.getElementById('pomo-setup').classList.add('hidden');
    document.getElementById('pomo-running').classList.remove('hidden');
    
    if(db) db.collection('users').doc(currentUser).set({ isFocusing: true }, { merge: true });
    showToast("Deep Work Mode Activated. Let's go!", "success");

    pomodoroInterval = setInterval(() => {
        let m = Math.floor(pomodoroTimeLeft / 60);
        let s = pomodoroTimeLeft % 60;
        document.getElementById('pomo-timer-display').innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
        
        if(pomodoroTimeLeft <= 0) stopPomodoro(true);
        pomodoroTimeLeft--;
    }, 1000);
}

function stopPomodoro(finished = false) {
    clearInterval(pomodoroInterval);
    document.getElementById('pomo-running').classList.add('hidden');
    document.getElementById('pomo-setup').classList.remove('hidden');
    
    if(db) db.collection('users').doc(currentUser).set({ isFocusing: false }, { merge: true });
    
    if(finished) {
        showToast("Session Finished! You earned 50 Points.", "success");
        localData.points += 50;
        saveToDB();
    } else {
        showToast("Session aborted.", "info");
    }
}

// ==========================================
// 5. Shared Poll Logic
// ==========================================
function openSelectorModal() {
    const container = document.getElementById('master-task-selector');
    container.innerHTML = '<h4 class="text-center text-cyan mb-10">اختر المادة / Select Subject</h4><div id="subject-btns" style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center;"></div><div id="adv-menu-area" class="mt-20"></div>';

    const btnsArea = document.getElementById('subject-btns');
    subjectsList.forEach(sub => {
        let btn = document.createElement('button');
        btn.className = 'btn-primary-small';
        btn.innerText = sub;
        btn.onclick = () => renderAdvancedMenu(sub);
        btnsArea.appendChild(btn);
    });
    document.getElementById('selector-modal').classList.remove('hidden');
}

// 🟢 دالة مساعدة لجمع المهام العلمية
// 🟢 دالة مساعدة لجمع المهام العلمية
// 🟢 دالة مساعدة لجمع المهام العلمية
// 🟢 دالة مساعدة لجمع المهام العلمية
// 🟢 دالة مساعدة لجمع المهام العلمية
window.addScientificTask = function(subject) {
    const modeSelect = document.getElementById('sci-mode-select');
    const mode = modeSelect.value;
    const modeLabel = modeSelect.options[modeSelect.selectedIndex].text;
    
    const checkboxes = document.querySelectorAll('#sci-topics-area input:checked');
    let selectedTopics = Array.from(checkboxes).map(cb => cb.value).join(' + ');
    
    if(!selectedTopics) return showToast('Please select at least one Target (or General Revision)!', 'error'); 

    const key = `Sci_${subject}_${mode}_${selectedTopics.replace(/\s/g,'')}`;
    const label = `${subject} | ${modeLabel} [${selectedTopics}]`;
    addToSharedPoll(subject, key, label);
};

function renderAdvancedMenu(subject) {
    const area = document.getElementById('adv-menu-area');
    area.innerHTML = `<h4 class="text-orange mb-10 border-top pt-10 text-center">${subject} Menu</h4>`;

    // 🟢 مصنع الزراير السحرية (بيخلي أي زرار ينور أخضر)
    const createMagicButton = (text, onClickCallback) => {
        let btn = document.createElement('button');
        btn.className = 'selector-item-btn';
        btn.style.margin = '3px';
        btn.innerText = text;
        btn.onclick = function() {
            onClickCallback();
            this.style.background = 'var(--success)';
            this.style.color = '#000';
            this.innerText = '✔ ' + text.replace('+ ', '');
            this.disabled = true;
        };
        return btn;
    };

    // ==========================================
    // 🧪 1. نظام المواد العلمية
    // ==========================================
    if (['Physics', 'Chemistry', 'Math', 'Mechanics', 'Biology', 'Geo'].includes(subject)) {
        area.innerHTML += `
            <div style="background: rgba(0,0,0,0.5); padding: 15px; border-radius: 8px; margin-bottom: 15px; text-align: left; direction: ltr;">
                <h5 class="text-cyan mb-10">1. Select Mode (Study & TOC Only):</h5>
                <select id="sci-mode-select" class="input-dark w-100 mb-15" style="padding:8px; font-size:14px;">
                    <option value="StudySession">Study Session (50 pts)</option>
                    <option value="SolveSessionTOC">Solve Session TOC (50 pts)</option>
                    <option value="SelfTOC">Solve TOC (Self)</option>
                </select>

                <h5 class="text-cyan mb-10">2. Select Targets (Multi-select allowed):</h5>
                <div id="sci-topics-area" style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:15px; background:rgba(255,255,255,0.05); padding:10px; border-radius:5px;">
                </div>
                <button class="btn-primary w-100" onclick="addScientificTask('${subject}')">Add ${subject} Task</button>
            </div>
            
            <h5 class="text-warning mt-20 mb-10 text-center">${subject} URT Tasks</h5>
            <div id="sci-standard-area" style="display:flex; flex-wrap:wrap; gap:5px; justify-content:center; direction:ltr;"></div>
        `;
        
        const topicsArea = document.getElementById('sci-topics-area');
        topicsArea.innerHTML += `<label style="color:#ffcc00; cursor:pointer; font-weight:bold; margin-right: 15px;"><input type="checkbox" value="General Revision"> General Revision</label>`;
        
        if (subject === 'Physics') {
            for(let i=1; i<=14; i++) topicsArea.innerHTML += `<label style="color:#fff; cursor:pointer;"><input type="checkbox" value="LO ${i}"> LO ${i}</label>`;
        } else if (subject === 'Chemistry') {
            for(let i=1; i<=4; i++) topicsArea.innerHTML += `<label style="color:#fff; cursor:pointer;"><input type="checkbox" value="Mod ${i}"> Module ${i}</label>`;
        } else {
            ['Sec 3 Term 1', 'Sec 3 Term 2', 'Grade 10 (URT)', 'Grade 11 (URT)'].forEach(t => {
                topicsArea.innerHTML += `<label style="color:#fff; cursor:pointer;"><input type="checkbox" value="${t}"> ${t}</label>`;
            });
        }

        const stdArea = document.getElementById('sci-standard-area');
        [
            {k: 'SciStd_URT_Piece', txt: '+ URT Piece', lbl: `${subject} - URT Piece (Self)`},
            {k: 'SciStd_URT_Full', txt: '+ Full URT Exam', lbl: `${subject} - Full URT Exam (Self)`},
            {k: 'SciStd_Session_URT', txt: '+ Solve Session URT', lbl: `${subject} - Solve Session URT`}
        ].forEach(task => {
            stdArea.appendChild(createMagicButton(task.txt, () => addToSharedPoll(subject, task.k, task.lbl)));
        });
    } 
    // ==========================================
    // 📖 2. نظام اللغة العربية
    // ==========================================
    else if (subject === 'Arabic') {
        area.innerHTML += `
            <div style="background: rgba(0,0,0,0.5); padding: 15px; border-radius: 8px; margin-bottom: 15px; text-align: right; direction: rtl;">
                <label style="display:flex; align-items:center; justify-content:center; cursor:pointer; color:#E040FB; font-weight:bold; font-size: 16px;">
                    <input type="checkbox" id="is-session-check" style="margin-left:10px; transform:scale(1.5);">
                    ذاكرتها من سيشن؟
                </label>
            </div>
            <div id="arabic-dynamic-area"></div>
            <h5 class="text-warning mt-20 mb-10 text-center">المهام الأساسية (عربي)</h5>
            <div id="arb-standard-area" style="display:flex; flex-wrap:wrap; gap:5px; justify-content:center; direction:rtl;"></div>
        `;

        let dynamicArea = document.getElementById('arabic-dynamic-area');
        let cur = finalsCurriculum['Arabic'];
        for (const [category, lessons] of Object.entries(cur)) {
            let catDiv = document.createElement('div');
            catDiv.style.marginBottom = '15px';
            catDiv.style.direction = 'rtl';
            catDiv.style.textAlign = 'right';
            catDiv.innerHTML = `<strong class="text-cyan" style="display:block; margin-bottom:8px;">${category}</strong>`;
            lessons.forEach(les => {
                catDiv.appendChild(createMagicButton(`+ ${les}`, () => {
                    let isSession = document.getElementById('is-session-check') ? document.getElementById('is-session-check').checked : false;
                    addToSharedPoll('Arabic', `Adv_Arabic_${category}_${les}_${isSession?'Session':'Self'}`, `عربي | ${category}: ${les} (${isSession?'سيشن':'مذاكرة'})`);
                }));
            });
            dynamicArea.appendChild(catDiv);
        }

        const stdArea = document.getElementById('arb-standard-area');
        [
            {k: 'Arb_URTPiece', txt: '+ حل قطعة URT', lbl: 'عربي - قطعة URT'},
            {k: 'Arb_URTFull', txt: '+ حل امتحان URT كامل', lbl: 'عربي - امتحان URT كامل'},
            {k: 'Arb_TOCNormal', txt: '+ شيت TOC', lbl: 'عربي - شيت TOC'},
            {k: 'Arb_Expression', txt: '+ موضوع تعبير', lbl: 'عربي - موضوع تعبير'}
        ].forEach(task => {
            stdArea.appendChild(createMagicButton(task.txt, () => addToSharedPoll('Arabic', task.k, task.lbl)));
        });
    } 
    // ==========================================
    // 💬 3. نظام اللغات (English / German / French)
    // ==========================================
    else {
        let isEng = subject === 'English';
        let cur = isEng ? finalsCurriculum['English'] : finalsCurriculum['Languages'];
        
        area.innerHTML += `
            <div style="background: rgba(0,0,0,0.5); padding: 15px; border-radius: 8px; margin-bottom: 15px; text-align: left; direction: ltr;">
                <label style="display:flex; align-items:center; justify-content:center; cursor:pointer; color:#E040FB; font-weight:bold; font-size: 16px;">
                    <input type="checkbox" id="is-session-check" style="margin-right:10px; transform:scale(1.5);">
                    Studied with a Session?
                </label>
            </div>
            <div id="languages-dynamic-area"></div>
            <h5 class="text-warning mt-20 mb-10 text-center">${subject} Standard Tasks</h5>
            <div id="lang-standard-area" style="display:flex; flex-wrap:wrap; gap:5px; justify-content:center; direction:ltr;"></div>
        `;

        let dynamicArea = document.getElementById('languages-dynamic-area');
        for (const [category, lessons] of Object.entries(cur)) {
            let catDiv = document.createElement('div');
            catDiv.style.marginBottom = '15px';
            catDiv.style.direction = 'ltr';
            catDiv.innerHTML = `<strong class="text-cyan" style="display:block; margin-bottom:8px;">${category}</strong>`;
            lessons.forEach(les => {
                catDiv.appendChild(createMagicButton(`+ ${les}`, () => {
                    let isSession = document.getElementById('is-session-check') ? document.getElementById('is-session-check').checked : false;
                    addToSharedPoll(subject, `Adv_${subject}_${category}_${les}_${isSession?'Session':'Self'}`, `${subject} | ${category}: ${les} (${isSession?'Session':'Self'})`);
                }));
            });
            dynamicArea.appendChild(catDiv);
        }

        const stdArea = document.getElementById('lang-standard-area');
        [
            {k: 'Lang_URTPiece', txt: '+ URT Piece', lbl: `${subject} - URT Piece`},
            {k: 'Lang_URTFull', txt: '+ Full URT Exam', lbl: `${subject} - Full URT Exam`},
            {k: 'Lang_TOCNormal', txt: '+ TOC Sheet', lbl: `${subject} - TOC Sheet`},
            {k: 'Lang_Essay', txt: '+ Essay Writing', lbl: `${subject} - Essay Writing`},
            {k: 'Lang_Vocab', txt: '+ Memorize Words', lbl: `${subject} - Memorize Words (2 Pts/Word)`}
        ].forEach(task => {
            stdArea.appendChild(createMagicButton(task.txt, () => addToSharedPoll(subject, task.k, task.lbl)));
        });
    }
}
function closeSelectorModal() { document.getElementById('selector-modal').classList.add('hidden'); }

function addToSharedPoll(subject, key, label) {
    const exists = localData.dailySelection.find(t => t.subject === subject && t.key === key);
    if (!exists) {
        if(!localData.subjects[subject][key]) localData.subjects[subject][key] = 0; 
        
        localData.dailySelection.push({ subject: subject, key: key, label: label });
        if(db) {
            const sharedTasks = localData.dailySelection.map(t => ({subject: t.subject, key: t.key, label: t.label}));
            db.collection('shared_polls').doc(currentDate).set({ tasks: sharedTasks }, { merge: true });
        }
        renderSharedPoll();
        populateExamTaskDropdown();
        showToast(`Added ${label} to poll`, 'success');
    }
}

function toggleSharedPoll(index) {
    const task = localData.dailySelection[index];
    let currentVal = localData.subjects[task.subject][task.key];
    
    if(task.key === 'Vocab' && currentVal === 0) {
        let num = prompt("How many words did you memorize?", "25");
        if(num !== null && !isNaN(num) && num > 0) {
            localData.subjects[task.subject][task.key] = parseInt(num);
        } else { return; }
    } else {
        if (currentVal === 0) localData.subjects[task.subject][task.key] = 1; 
        else localData.subjects[task.subject][task.key] = 0; 
    }
    saveToDB(); 
    renderSharedPoll();
    renderSubjects();
}

function renderSharedPoll() {
    const container = document.getElementById('my-poll-list');
    if (localData.dailySelection.length === 0) {
        container.innerHTML = `<p class="text-muted text-center p-15">No shared tasks selected yet.</p>`;
        return;
    }
    container.innerHTML = '';
    localData.dailySelection.forEach((task, index) => {
        let myQuantity = localData.subjects[task.subject] ? localData.subjects[task.subject][task.key] || 0 : 0;
        let isDone = myQuantity > 0;
        let partnerQuantity = partnerData.subjects && partnerData.subjects[task.subject] ? partnerData.subjects[task.subject][task.key] || 0 : 0;
        let partnerDone = partnerQuantity > 0;
        let mDone = currentUser === 'Mamdouh' ? isDone : partnerDone;
        let sDone = currentUser === 'Sama' ? isDone : partnerDone;

        container.innerHTML += `
            <div class="poll-item-row ${isDone ? 'is-done' : ''}" style="display:flex; align-items:center; padding:15px; border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer;">
                <div class="poll-checkbox" onclick="toggleSharedPoll(${index})" style="margin-right:15px; font-size:20px;">
                    ${isDone ? '<i class="fas fa-check-circle text-success"></i>' : '<i class="far fa-circle text-muted"></i>'}
                </div>
                <div class="poll-text" onclick="toggleSharedPoll(${index})" style="flex-grow:1;">
                    <span class="poll-label" style="font-weight:bold; ${isDone ? 'text-decoration:line-through; opacity:0.5;' : ''}">${task.label} ${isDone && task.key==='Vocab' ? `(${myQuantity} words)` : ''}</span>
                </div>
                <div class="poll-indicators" style="display:flex; gap:5px;">
                    <span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: ${mDone ? 'rgba(0, 229, 255, 0.2)' : '#222'}; color: ${mDone ? '#00E5FF' : '#555'}; border: 1px solid ${mDone ? '#00E5FF' : '#111'}">M</span>
                    <span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: ${sDone ? 'rgba(255, 61, 0, 0.2)' : '#222'}; color: ${sDone ? '#FF3D00' : '#555'}; border: 1px solid ${sDone ? '#FF3D00' : '#111'}">S</span>
                </div>
            </div>`;
    });
}

// ==========================================
// 6. Shared Personal Custom Tasks 
// ==========================================
function openCustomTaskModal() { document.getElementById('custom-task-modal').classList.remove('hidden'); }
function closeCustomTaskModal() { document.getElementById('custom-task-modal').classList.add('hidden'); }

function createCustomTask() {
    let name = document.getElementById('custom-task-name').value;
    let pts = document.getElementById('custom-task-points').value;
    if(name && pts && db) {
        let newTask = { id: Date.now().toString(), label: name, points: parseInt(pts) };
        db.collection('shared_custom_tasks').doc(currentDate).set({
            tasks: firebase.firestore.FieldValue.arrayUnion(newTask)
        }, { merge: true });
        
        document.getElementById('custom-task-name').value = '';
        document.getElementById('custom-task-points').value = '';
        closeCustomTaskModal();
        showToast('Mission created successfully', 'success');
    }
}

function toggleSharedCustomTask(taskId) {
    localData.customTaskStates[taskId] = !localData.customTaskStates[taskId];
    saveToDB();
    renderSharedCustomTasks();
}

function renderSharedCustomTasks() {
    const container = document.getElementById('custom-tasks-list');
    if (sharedCustomTasks.length === 0) {
        container.innerHTML = `<p class="text-muted text-center p-15">No shared missions. Create one above!</p>`;
        return;
    }
    container.innerHTML = '';
    sharedCustomTasks.forEach((task) => {
        let isDone = !!localData.customTaskStates[task.id];
        let partnerDone = partnerData.customTaskStates ? !!partnerData.customTaskStates[task.id] : false;
        
        let mDone = currentUser === 'Mamdouh' ? isDone : partnerDone;
        let sDone = currentUser === 'Sama' ? isDone : partnerDone;

        container.innerHTML += `
            <div class="poll-item-row ${isDone ? 'is-done' : ''}" style="display:flex; align-items:center; padding:15px; border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer;">
                <div class="poll-checkbox" onclick="toggleSharedCustomTask('${task.id}')" style="margin-right:15px; font-size:20px;">
                    ${isDone ? '<i class="fas fa-check-circle text-success"></i>' : '<i class="far fa-circle text-muted"></i>'}
                </div>
                <div class="poll-text" onclick="toggleSharedCustomTask('${task.id}')" style="flex-grow:1;">
                    <span class="poll-label" style="font-weight:bold; color:var(--success); ${isDone ? 'text-decoration:line-through; opacity:0.5;' : ''}">${task.label}</span>
                    <span style="font-size:12px; color:var(--text-muted); margin-left:10px;">(+${task.points} pts)</span>
                </div>
                <div class="poll-indicators" style="display:flex; gap:5px;">
                    <span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: ${mDone ? 'rgba(0, 229, 255, 0.2)' : '#222'}; color: ${mDone ? '#00E5FF' : '#555'}; border: 1px solid ${mDone ? '#00E5FF' : '#111'}">M</span>
                    <span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: ${sDone ? 'rgba(255, 61, 0, 0.2)' : '#222'}; color: ${sDone ? '#FF3D00' : '#555'}; border: 1px solid ${sDone ? '#FF3D00' : '#111'}">S</span>
                </div>
            </div>`;
    });
}

// ==========================================
// 6.5. KANBAN PROJECTS TRACKER 
// ==========================================
function openProjectModal() { document.getElementById('project-modal').classList.remove('hidden'); }
function closeProjectModal() { document.getElementById('project-modal').classList.add('hidden'); }

async function createProject() {
    const title = document.getElementById('project-title').value;
    const desc = document.getElementById('project-desc').value;
    if(!title || !db) return showToast("Project title required", "error");

    await db.collection('shared_projects').add({
        title: title, desc: desc, status: 'todo', createdBy: currentUser,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(), pointsAwarded: false 
    });

    document.getElementById('project-title').value = '';
    document.getElementById('project-desc').value = '';
    closeProjectModal();
    showToast("Project added to Kanban!", "success");
}

async function moveProject(id, newStatus, currentPointsAwarded) {
    if(!db) return;
    let updates = { status: newStatus };
    if(newStatus === 'done' && !currentPointsAwarded) {
        localData.points += 500;
        await db.collection('users').doc(currentUser).collection('daily_records').doc(currentDate).set({ points: localData.points }, { merge: true });
        updates.pointsAwarded = true;
        document.getElementById('header-score').innerText = localData.points;
        showToast("Massive Action! +500 Points Awarded! 🎉", "success");
    }
    await db.collection('shared_projects').doc(id).update(updates);
}

async function deleteProject(id) {
    if(confirm("Delete this project from Kanban?")) {
        await db.collection('shared_projects').doc(id).delete();
        showToast("Project removed.", "info");
    }
}

function renderKanban() {
    const todoList = document.getElementById('kb-list-todo');
    const progList = document.getElementById('kb-list-progress');
    const doneList = document.getElementById('kb-list-done');
    if(!todoList) return; 

    todoList.innerHTML = ''; progList.innerHTML = ''; doneList.innerHTML = '';
    if(typeof sharedProjects === 'undefined') return;

    sharedProjects.forEach(proj => {
        let actions = '';
        if (proj.status === 'todo') {
            actions = `<button class="btn-primary-small bg-orange" style="font-size:10px; padding:3px;" onclick="moveProject('${proj.id}', 'progress', ${proj.pointsAwarded})">Start</button>`;
        } else if (proj.status === 'progress') {
            actions = `<button class="btn-primary-small bg-success" style="font-size:10px; padding:3px;" onclick="moveProject('${proj.id}', 'done', ${proj.pointsAwarded})">Done!</button>`;
        }
        let delBtn = `<button class="delete-exam-btn" style="padding:0; font-size:12px;" onclick="deleteProject('${proj.id}')"><i class="fas fa-trash"></i></button>`;

        let html = `
            <div class="kanban-card">
                <div style="display:flex; justify-content:space-between;">
                    <strong class="text-cyan">${proj.title}</strong>
                    ${delBtn}
                </div>
                <span class="text-muted">${proj.desc}</span>
                <div class="kanban-actions">${actions}</div>
            </div>
        `;
        if (proj.status === 'todo') todoList.innerHTML += html;
        else if (proj.status === 'progress') progList.innerHTML += html;
        else if (proj.status === 'done') doneList.innerHTML += html;
    });
}

// ==========================================
// 7. AI LAB PIPELINE (VISION & ROUTING)
// ==========================================
let labCurrentText = "";

function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

async function analyzeInLab() {
    const apiKey = 'server-proxy';
    if(!apiKey) return showToast("Save Groq API Key in Exams tab first.", "error");
    
    let rawText = document.getElementById('lab-raw-text').value;
    const fileInput = document.getElementById('lab-image-input');
    const file = fileInput ? fileInput.files[0] : null;

    if(!rawText && !file) return showToast("Provide text or a file to analyze.", "error");

    document.getElementById('btn-lab-explain').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
    document.getElementById('btn-lab-explain').disabled = true;
    document.getElementById('lab-result-container').classList.add('hidden');

    try {
        let messagesContent = [];
        let modelToUse = document.getElementById('ai-model-select') ? document.getElementById('ai-model-select').value : 'llama-3.3-70b-versatile';

        if (file) {
            if (file.type === "application/pdf") {
                showToast("Extracting text from PDF...", "info");
                rawText = await extractTextFromPDF(file);
                
                if(rawText.length > 5000) {
                     showToast("PDF is very long. Analyzing the first part.", "info");
                     rawText = rawText.substring(0, 5000) + "... [Text truncated]";
                }
                
                messagesContent = `Explain and summarize the key concepts from this text extracted from a PDF: "${rawText}"`;
            } 
            else if (file.type.startsWith("image/")) {
                modelToUse = 'llama-3.2-90b-vision-preview'; 
                const base64Image = await convertFileToBase64(file);
                let textPrompt = rawText ? rawText : "Explain this image in detail, extract key concepts, and structure it with bullet points.";
                
                messagesContent = [
                  { type: "text", text: textPrompt },
                  { type: "image_url", image_url: { url: base64Image } }
                ];
            } else {
                throw new Error("Unsupported file type. Please upload a PDF or an image.");
            }
        } else {
             messagesContent = `Explain this concept in a highly structured, simple, and engaging way. Break it down using bullet points: "${rawText}"`;
        }

        let requestBody = {
            model: modelToUse,
            messages: [
                { role: "system", content: "You are an elite tutor. Explain everything in EXTREME detail. Provide comprehensive breakdowns, examples, and deep analysis. Do not summarize. Write long, detailed responses formatted with bullet points and bold text." },
                { role: "user", content: messagesContent }
            ],
            temperature: 0.6, 
            max_tokens: 8000 
        };
        const response = await fetch(`/api/ai-proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        const data = await response.json();
        if(data.error) throw new Error(data.error.message);

        let aiOutput = data.choices[0].message.content;
        labCurrentText = aiOutput; 
        
        let formattedHTML = aiOutput;
        if(typeof marked !== 'undefined') {
             formattedHTML = marked.parse(aiOutput);
        }
        
        formattedHTML = formattedHTML.replace(/<strong>(.*?)<\/strong>/g, '<strong class="text-cyan">$1</strong>');
        const explanationDiv = document.getElementById('lab-explanation-text');
        explanationDiv.innerHTML = formattedHTML;
        
        if (window.MathJax) {
            MathJax.typesetPromise([explanationDiv]).catch((err) => console.log('MathJax error: ', err));
        }

        document.getElementById('lab-result-container').classList.remove('hidden');
        showToast("Analysis Complete! 🔬", "success");

    } catch(err) {
        showToast("Lab Error: " + err.message, "error");
        console.error(err);
    } finally {
        document.getElementById('btn-lab-explain').innerHTML = '<i class="fas fa-magic"></i> Analyze & Explain';
        document.getElementById('btn-lab-explain').disabled = false;
    }
}

async function extractTextFromPDF(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function() {
            try {
                const typedarray = new Uint8Array(this.result);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                let fullText = "";
                
                const numPages = Math.min(pdf.numPages, 5); 
                
                for (let i = 1; i <= numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + "\n";
                }
                resolve(fullText);
            } catch (err) {
                reject(err);
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

function routeLabToExam() {
    switchTab('view-exams', document.querySelectorAll('.nav-item')[2]);
    document.getElementById('exam-creator-section').classList.remove('hidden');
    document.getElementById('exam-raw-text').value = "Create a comprehensive multiple-choice exam based entirely on this study material:\n\n" + labCurrentText;
    document.getElementById('exam-title-input').value = "Lab Concept Exam";
    showToast("Initializing Exam Pipeline...", "info");
    generateExamWithAI(); 
}

function routeLabToCards() {
    switchTab('view-flashcards', document.querySelectorAll('.nav-item')[3]);
    document.getElementById('fc-creator-section').classList.remove('hidden');
    document.getElementById('fc-raw-text').value = labCurrentText;
    document.getElementById('fc-count-input').value = "5";
    showToast("Extracting Neural Flashcards...", "info");
    generateFlashcardsWithAI(); 
}

// ==========================================
// 8. AI EXAM ENGINE & PVP CHALLENGES
// ==========================================
function populateExamTaskDropdown() {
    const sel = document.getElementById('exam-linked-task');
    if(!sel) return;
    sel.innerHTML = '<option value="">🔗 Optional: Link to a Daily Task...</option>';
    localData.dailySelection.forEach(task => {
        sel.innerHTML += `<option value="${task.subject}|${task.key}">${task.label}</option>`;
    });
}

function saveApiKey() {
    const section=document.getElementById('api-key-section');
    const creator=document.getElementById('exam-creator-section');
    if(section) section.classList.add('hidden');
    if(creator) creator.classList.remove('hidden');
    showToast('Mortaqa AI is secured on the server — no browser API key is needed.', 'success');
}

function changeApiKey() {
    const input=document.getElementById('ai-api-key'); if(input) input.value='';
    document.getElementById('exam-creator-section')?.classList.add('hidden');
    document.getElementById('api-key-section')?.classList.remove('hidden');
}

function toggleExamCreator() { document.getElementById('exam-creator-section').classList.toggle('hidden'); }

function backToExams() {
    clearInterval(examTimerInterval);
    document.getElementById('active-exam-container').classList.add('hidden');
    document.getElementById('available-exams-list').classList.remove('hidden');
    document.getElementById('exam-timer-display').classList.add('hidden');
    activeExamData = null;
}

async function deleteExam(examId, event) {
    event.stopPropagation();
    if(confirm("Are you sure you want to permanently delete this exam? No points will be deducted.")) {
        await db.collection('shared_exams').doc(examId).delete();
        showToast("Exam Deleted", "info");
    }
}

function retakeExam() {
    if(!activeExamData || !activeExamData.results || !activeExamData.results[currentUser]) return;
    if(confirm("Retaking the exam will deduct your previous points from your total. Proceed?")) {
        let earnedPoints = activeExamData.results[currentUser].points;
        localData.points -= earnedPoints;
        let updatedResults = { ...activeExamData.results };
        delete updatedResults[currentUser];
        db.collection('users').doc(currentUser).collection('daily_records').doc(currentDate).set({ points: localData.points }, { merge: true });
        db.collection('shared_exams').doc(activeExamData.id).set({ results: updatedResults }, { merge: true }).then(() => {
            document.getElementById('header-score').innerText = localData.points;
            activeExamData.results = updatedResults;
            startExam(activeExamData.id); 
            showToast("Ready for Retake!", "info");
        });
    }
}

function sendChallenge(examId, examTitle, event) {
    event.stopPropagation();
    let partnerUser = currentUser === 'Mamdouh' ? 'Sama' : 'Mamdouh';
    if(db) {
        db.collection('users').doc(partnerUser).set({
            pendingChallenge: { examId: examId, examTitle: examTitle, from: currentUser, timestamp: Date.now() }
        }, { merge: true });
        showToast(`Challenge sent to ${partnerUser}! Waiting for acceptance... ⚔️`, 'info');
    }
}

function acceptChallenge() {
    let modal = document.getElementById('challenge-modal');
    if(!modal) return;
    let examId = modal.dataset.examId;
    modal.classList.add('hidden');
    if(db) db.collection('users').doc(currentUser).set({ pendingChallenge: null }, { merge: true });
    
    let navItems = document.querySelectorAll('.nav-item');
    if(navItems.length > 2) switchTab('view-exams', navItems[2]);
    startExam(examId);
    showToast("Battle Started! 🥊", "success");
}

function ignoreChallenge() {
    let modal = document.getElementById('challenge-modal');
    if(modal) modal.classList.add('hidden');
    if(db) db.collection('users').doc(currentUser).set({ pendingChallenge: null }, { merge: true });
}

async function generateExamWithAI() {
    const apiKey = 'server-proxy';
    const title = document.getElementById('exam-title-input').value;
    const rawText = document.getElementById('exam-raw-text').value;
    const timeLimitInput = document.getElementById('exam-timer-input').value;
    const timeLimit = timeLimitInput ? parseInt(timeLimitInput) : 0;
    
    const linkedTaskSelect = document.getElementById('exam-linked-task');
    const linkedTaskVal = linkedTaskSelect.value;
    const linkedTaskText = linkedTaskSelect.options[linkedTaskSelect.selectedIndex] ? linkedTaskSelect.options[linkedTaskSelect.selectedIndex].text : "";
    
    const selectedModel = document.getElementById('ai-model-select') ? document.getElementById('ai-model-select').value : 'llama-3.3-70b-versatile';

    if(!apiKey) return showToast("Please enter and save Groq API Key first.", "error");
    if(!title || !rawText) return showToast("Please enter exam title and text.", "error");

    document.getElementById('ai-loading-text').classList.remove('hidden');
    document.getElementById('btn-generate-exam').disabled = true;

    const isURT = linkedTaskText.toUpperCase().includes("URT");
    let systemPrompt = "";

    if (isURT) {
        systemPrompt = `You are an expert AI exam generator. The user will provide a reading passage followed by questions.
        YOUR TASK: Separate the pure reading passage from the questions.
        Format MUST be exactly a JSON object with two keys:
        {"passage": "Only the pure reading text here without any questions or options", "questions": [{"q": "Question string", "opts": ["Option 1", "Option 2", "Option 3", "Option 4"], "ans": 0}]}
        'ans' is the 0-based index of the correct option.
        CRITICAL RULES FOR MATH: 
        1. You MUST double-escape all backslashes in LaTeX (e.g., write \\\\frac instead of \\frac).
        2. You MUST wrap ALL math formulas, variables, and symbols in $ for inline math or $$ for display math.
        3. DO NOT wrap the output in markdown code blocks. Output ONLY raw valid JSON.`;
    } 
    else {
        systemPrompt = `You are an expert AI exam generator and parser. Based on the text provided by the user, generate a multiple-choice exam. 
        Format MUST be exactly a JSON array: [{"q": "Question string", "opts": ["A", "B", "C", "D"], "ans": 0}]. 'ans' is the 0-based index of the correct option.
        CRITICAL RULES FOR MATH: 
        1. You MUST double-escape all backslashes in LaTeX (e.g., write \\\\frac instead of \\frac).
        2. You MUST wrap ALL math formulas, variables, and symbols in $ for inline math or $$ for display math.
        3. DO NOT wrap the output in markdown code blocks. Output ONLY raw valid JSON.`;
    }
    
    try {
        const response = await fetch(`/api/ai-proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: selectedModel, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: rawText }], temperature: 0.1 })
        });
        
        const data = await response.json();
        if (data.error) {
            if(data.error.message.includes('API key') || data.error.message.includes('Unauthorized')) changeApiKey();
            throw new Error(data.error.message);
        }

        let rawOutput = data.choices[0].message.content;
        rawOutput = rawOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        let aiOutput = rawOutput;
        const jsonMatch = rawOutput.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (jsonMatch) {
            aiOutput = jsonMatch[0];
        }
        
        let parsedData;
        try { 
            parsedData = JSON.parse(aiOutput); 
        } 
        catch (parseError) { 
            throw new Error("AI format error. The AI did not follow strict JSON formatting."); 
        }

        let questionsArray = [];
        let cleanPassage = rawText;

        if (Array.isArray(parsedData)) {
            questionsArray = parsedData;
        } else if (parsedData && parsedData.questions && Array.isArray(parsedData.questions)) {
            questionsArray = parsedData.questions;
            if (parsedData.passage) cleanPassage = parsedData.passage;
        }

        if(db && questionsArray.length > 0) {
            await db.collection('shared_exams').add({
                title: title, 
                questions: questionsArray, 
                createdBy: currentUser, 
                timeLimit: timeLimit,
                linkedTask: linkedTaskVal, 
                isURT: isURT, 
                savedPassage: cleanPassage, 
                createdAt: firebase.firestore.FieldValue.serverTimestamp(), 
                results: {} 
            });
            document.getElementById('exam-title-input').value = '';
            document.getElementById('exam-raw-text').value = '';
            document.getElementById('exam-timer-input').value = '';
            toggleExamCreator();
            showToast("Exam generated successfully!", "success");
        }
    } catch(err) {
        showToast("AI Processing Failed: " + err.message, "error");
    } finally {
        document.getElementById('ai-loading-text').classList.add('hidden');
        document.getElementById('btn-generate-exam').disabled = false;
    }
}

function renderExamsList() {
    const list = document.getElementById('available-exams-list');
    if(!list) return;
    list.innerHTML = '';
    sharedExams.forEach(exam => {
        let mRes = exam.results && exam.results['Mamdouh'] ? `<span class="text-cyan">M: ${exam.results['Mamdouh'].correct}✅ ${exam.results['Mamdouh'].wrong}❌</span>` : `<span class="text-muted">M: ⏳</span>`;
        let sRes = exam.results && exam.results['Sama'] ? `<span class="text-orange">S: ${exam.results['Sama'].correct}✅ ${exam.results['Sama'].wrong}❌</span>` : `<span class="text-muted">S: ⏳</span>`;

        let isTaken = exam.results && exam.results[currentUser];
        let btnClass = isTaken ? "bg-cyan" : "bg-success";
        let btnText = isTaken ? "Review" : "Take";
        let timeLabel = exam.timeLimit ? ` • ⏱️ ${exam.timeLimit}m` : '';
        let linkLabel = exam.linkedTask ? ` • 🔗 Linked` : '';

        let challengeBtn = !isTaken ? `<button class="btn-primary-small bg-orange" style="margin-left:5px; padding:5px 10px;" onclick="sendChallenge('${exam.id}', '${exam.title.replace(/'/g, "\\'")}', event)" title="Challenge Partner"><i class="fas fa-crosshairs"></i></button>` : '';

        list.innerHTML += `
            <div class="card-glass exam-card" onclick="startExam('${exam.id}')">
                <div style="flex-grow: 1;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h4 class="text-white">${exam.title}</h4>
                        <button class="delete-exam-btn" onclick="deleteExam('${exam.id}', event)"><i class="fas fa-trash"></i></button>
                    </div>
                    <span class="text-muted" style="font-size:12px;">${exam.questions.length} Qs${timeLabel}${linkLabel} • By ${exam.createdBy}</span>
                    <div class="exam-stats">
                        ${mRes} | ${sRes}
                    </div>
                </div>
                <div style="display:flex; align-items:center;">
                    <button class="btn-primary-small ${btnClass}" style="margin-left:15px; min-width:60px;">${btnText}</button>
                    ${challengeBtn}
                </div>
            </div>
        `;
    });
    if (typeof loadCompletedExamsForAI === 'function') {
        loadCompletedExamsForAI();
    }
}

function startExam(examId) {
    clearInterval(examTimerInterval); 
    activeExamData = sharedExams.find(e => e.id === examId);
    if(!activeExamData) return;

    document.getElementById('api-key-section').classList.add('hidden');
    document.getElementById('exam-creator-section').classList.add('hidden');
    document.getElementById('available-exams-list').classList.add('hidden');
    
    const container = document.getElementById('active-exam-container');
    container.classList.remove('hidden');
    document.getElementById('active-exam-title').innerText = activeExamData.title;

    const passageBox = document.getElementById('urt-passage-display');
    const passageContent = document.getElementById('urt-text-content');

    if (activeExamData.isURT) {
        const savedPassage = activeExamData.savedPassage || activeExamData.rawText; 
        if (savedPassage && savedPassage.trim().length > 10) {
            if(passageContent) passageContent.innerHTML = marked.parse(savedPassage); 
            if(passageBox) passageBox.classList.remove('hidden');
        } else {
            if(passageBox) passageBox.classList.add('hidden');
        }
    } else {
        if(passageBox) passageBox.classList.add('hidden');
    }

    const qaArea = document.getElementById('exam-questions-area');
    qaArea.innerHTML = '';
    const banner = document.getElementById('exam-result-banner');

    let isTaken = activeExamData.results && activeExamData.results[currentUser];
    let myAnswers = isTaken ? activeExamData.results[currentUser].answers : [];

    if (isTaken) {
        let res = activeExamData.results[currentUser];
        banner.innerHTML = `<h3 class="text-success mb-10">Exam Completed!</h3><p>Correct: ${res.correct} ✅ | Wrong: ${res.wrong} ❌</p><p class="text-cyan mt-10" style="font-weight:bold; font-size:18px;">Earned: +${res.points} Points</p>`;
        banner.classList.remove('hidden');
        document.getElementById('exam-timer-display').classList.add('hidden');
    } else {
        banner.classList.add('hidden');
        if (activeExamData.timeLimit > 0) {
            let timeLeft = activeExamData.timeLimit * 60;
            document.getElementById('exam-timer-display').classList.remove('hidden');
            examTimerInterval = setInterval(() => {
                let m = Math.floor(timeLeft / 60);
                let s = timeLeft % 60;
                document.getElementById('exam-timer-display').innerText = `⏳ ${m}:${s < 10 ? '0' : ''}${s}`;
                if(timeLeft <= 0) {
                    clearInterval(examTimerInterval);
                    showToast("Time is up! Auto-submitting exam.", "info");
                    submitExam();
                }
                timeLeft--;
            }, 1000);
        } else {
            document.getElementById('exam-timer-display').classList.add('hidden');
        }
    }

    const formatAwesome = (text, isInline) => {
        if (!text) return "";
        let mathBlocks = [];
        let safeText = text.replace(/\\\[([\s\S]*?)\\\]/g, (m, p1) => { mathBlocks.push(`$$${p1}$$`); return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`; })
                           .replace(/\\\(([\s\S]*?)\\\)/g, (m, p1) => { mathBlocks.push(`$${p1}$`); return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`; })
                           .replace(/\$\$([\s\S]*?)\$\$/g, (m) => { mathBlocks.push(m); return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`; })
                           .replace(/\$([\s\S]*?)\$/g, (m) => { mathBlocks.push(m); return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`; });

        let formatted = typeof marked !== 'undefined' ? (isInline ? marked.parseInline(safeText) : marked.parse(safeText)) : safeText;
        formatted = formatted.replace(/<strong>(.*?)<\/strong>/g, '<strong class="text-cyan">$1</strong>');
        
        mathBlocks.forEach((block, index) => {
            formatted = formatted.replace(`@@MATH_BLOCK_${index}@@`, block);
        });
        return formatted;
    };

    activeExamData.questions.forEach((qObj, qIndex) => {
        let optsHtml = '';
        let isWrongAnswer = false;

        qObj.opts.forEach((opt, optIndex) => {
            let extraClass = '';
            let isChecked = '';
            
            if (isTaken) {
                let ansInt = parseInt(qObj.ans);
                let myAnsInt = parseInt(myAnswers[qIndex]);
                if (optIndex === ansInt) { extraClass = 'opt-correct'; } 
                if (optIndex === myAnsInt && myAnsInt !== ansInt) { extraClass = 'opt-wrong'; isWrongAnswer = true; }
                if (optIndex === myAnsInt) { isChecked = 'checked'; }
            }
            
            let formattedOptText = formatAwesome(opt, true);

            optsHtml += `
                <label class="option-label text-white ${extraClass}" style="font-size: 15px; display: block; margin-bottom: 10px; padding: 12px 15px; background: rgba(255,255,255,0.04); border-radius: 8px; cursor: pointer; transition: 0.3s; border: 1px solid rgba(255,255,255,0.05);">
                    <input type="radio" name="q_${qIndex}" value="${optIndex}" ${isChecked} ${isTaken ? 'disabled' : ''} style="margin-right: 12px; transform: scale(1.1);">
                    <span style="display: inline-block; vertical-align: middle;">${formattedOptText}</span>
                </label>
            `;
        });

        let explainBtnHtml = isTaken ? `<button id="explain-btn-${qIndex}" class="btn-primary-small" style="background: rgba(0, 229, 255, 0.1); color: var(--cyan); border: 1px solid var(--cyan); font-weight:bold; border-radius:6px; padding:6px 15px; transition: 0.3s;" onclick="explainAnswer(${qIndex})"><i class="fas fa-magic"></i> Explain</button>` : '';
        let makeCardBtnHtml = (isTaken && isWrongAnswer) ? 
            `<button id="make-card-btn-${qIndex}" class="btn-primary-small mt-10" style="background:#673AB7; font-size:12px; padding: 6px 15px; border-radius:6px;" onclick="convertWrongToCard(${qIndex})"><i class="fas fa-plus"></i> Flashcard</button>` : '';

        let formattedQuestion = formatAwesome(qObj.q, false);

        qaArea.innerHTML += `
            <div class="question-block" style="padding: 20px; background: rgba(0, 229, 255, 0.02); border: 1px solid rgba(0, 229, 255, 0.1); border-left: 4px solid var(--cyan); border-radius: 10px; margin-bottom: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                <div class="question-text" style="font-size: 16px; color: #fff; line-height: 1.7; margin-bottom: 20px;">
                    <span class="text-cyan" style="font-weight: 900; font-size: 18px; margin-right: 8px;">Q${qIndex + 1}.</span> 
                    <div style="display:inline-block; vertical-align:top; width:90%;">${formattedQuestion}</div>
                </div>
                
                <div style="padding-left: 5px;">
                    ${optsHtml}
                </div>
                
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:15px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;">
                    ${makeCardBtnHtml}
                    ${explainBtnHtml}
                </div>
                <div id="explain-box-${qIndex}" style="clear:both;"></div>
            </div>
        `;
    });

    const submitBtn = document.getElementById('submit-exam-btn');
    const retakeBtn = document.getElementById('retake-exam-btn');
    if (isTaken) {
        submitBtn.classList.add('hidden');
        retakeBtn.classList.remove('hidden');
    } else {
        submitBtn.classList.remove('hidden');
        retakeBtn.classList.add('hidden');
    }

    if (window.MathJax) {
        MathJax.typesetPromise([document.getElementById('active-exam-container')]).catch((err) => console.log('MathJax Error:', err));
    }
}

async function convertWrongToCard(qIndex) {
    const apiKey = 'server-proxy';
    if(!apiKey) return showToast("Please save Groq API Key first.", "error");

    const qObj = activeExamData.questions[qIndex];
    const btn = document.getElementById(`make-card-btn-${qIndex}`);
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Extracting...';
    btn.disabled = true;

    let ansInt = parseInt(qObj.ans);
    let correctAnsText = qObj.opts[ansInt];

    const prompt = `Extract the core educational concept or term from this question: "${qObj.q}" where the correct answer is "${correctAnsText}". Create a concise flashcard. Format strictly as JSON: {"front": "Concept/Term", "back": "Concise definition"}. No markdown.`;
    const selectedModel = document.getElementById('ai-model-select') ? document.getElementById('ai-model-select').value : 'llama-3.3-70b-versatile';

    try {
        const response = await fetch(`/api/ai-proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: selectedModel, messages: [{ role: "user", content: prompt }], temperature: 0.1 })
        });
        const data = await response.json();
        if(data.error) throw new Error(data.error.message);

        let aiOutput = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
        let cardData = JSON.parse(aiOutput);

        await db.collection('users').doc(currentUser).collection('flashcards').add({
            front: cardData.front, back: cardData.back, nextReview: Date.now()
        });
        showToast('Smart Flashcard Created!', 'success');
        btn.innerHTML = '<i class="fas fa-check"></i> Saved';
    } catch(err) {
        showToast("Card Gen Error", "error");
        btn.innerHTML = '<i class="fas fa-plus"></i> Save to Cards';
        btn.disabled = false;
    }
}

function submitExam() {
    if(!activeExamData) return;
    clearInterval(examTimerInterval); 
    
    let correctCount = 0; let wrongCount = 0; let userAnswers = [];

    activeExamData.questions.forEach((qObj, qIndex) => {
        const selected = document.querySelector(`input[name="q_${qIndex}"]:checked`);
        let ansIndex = selected ? parseInt(selected.value) : -1;
        userAnswers.push(ansIndex);
        if(ansIndex === parseInt(qObj.ans)) correctCount++; else wrongCount++;
    });

    let earnedPoints = (correctCount * 3) + (wrongCount * 1);
    localData.points += earnedPoints;
    
    if (activeExamData.linkedTask) {
        let parts = activeExamData.linkedTask.split('|');
        if(parts.length === 2 && localData.subjects[parts[0]] && localData.subjects[parts[0]][parts[1]] !== undefined) {
            localData.subjects[parts[0]][parts[1]] += 1;
            showToast(`Linked Task (${parts[0]} ${parts[1].replace('_',' ')}) done!`, 'success');
        }
    }

    if(!activeExamData.results) activeExamData.results = {};
    activeExamData.results[currentUser] = { correct: correctCount, wrong: wrongCount, points: earnedPoints, answers: userAnswers };

    if(db) {
        db.collection('users').doc(currentUser).collection('daily_records').doc(currentDate).set({ points: localData.points, subjects: localData.subjects }, { merge: true });
        db.collection('shared_exams').doc(activeExamData.id).set({ results: { [currentUser]: activeExamData.results[currentUser] } }, { merge: true });
    }
    
    document.getElementById('header-score').innerText = localData.points;
    renderSubjects(); renderSharedPoll(); startExam(activeExamData.id); 
    showToast(`Submitted! +${earnedPoints} Points`, 'success');
}

async function explainAnswer(qIndex) {
    const apiKey = 'server-proxy';
    if(!apiKey) return showToast("Save Groq API Key to use this.", "error");
    
    const qObj = activeExamData.questions[qIndex];
    const btn = document.getElementById(`explain-btn-${qIndex}`);
    const div = document.getElementById(`explain-box-${qIndex}`);
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Thinking...';
    btn.disabled = true;

    let ansInt = parseInt(qObj.ans);
    let correctAnsText = qObj.opts[ansInt] || "Unknown";
    const prompt = `Question: "${qObj.q}". Options: A)${qObj.opts[0]}, B)${qObj.opts[1]}, C)${qObj.opts[2]}, D)${qObj.opts[3]}. The correct answer is **${correctAnsText}**. 
    Explain in absolute maximum detail why this is the correct answer. Break down the reasoning step-by-step, explain why the other options are wrong, and give examples if necessary. Take your time and write a comprehensive explanation.`;
    
    const requestBody = {
        model: 'llama-3.3-70b-versatile', 
        messages: [
            { role: "system", content: "You are an elite tutor. Explain everything in EXTREME detail. Provide comprehensive breakdowns, examples, and deep analysis. Do not summarize. Write long, detailed responses formatted with bullet points and bold text. IMPORTANT: Wrap ALL math equations, variables, and formulas in $ for inline math and $$ for display math." },
            { role: "user", content: prompt }
        ], 
        temperature: 0.6,
        max_tokens: 8000
    };

    try {
        const response = await fetch(`/api/ai-proxy`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        const data = await response.json();
        if(data.error) throw new Error(data.error.message);
        
        let rawExplanation = data.choices[0].message.content;
        
        let mathBlocks = [];
        let safeText = rawExplanation;

        safeText = safeText.replace(/\\\[([\s\S]*?)\\\]/g, (m, p1) => {
            mathBlocks.push(`$$${p1}$$`);
            return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`;
        });
        safeText = safeText.replace(/\\\(([\s\S]*?)\\\)/g, (m, p1) => {
            mathBlocks.push(`$${p1}$`);
            return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`;
        });
        safeText = safeText.replace(/\$\$([\s\S]*?)\$\$/g, (m) => {
            mathBlocks.push(m);
            return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`;
        });
        safeText = safeText.replace(/\$([\s\S]*?)\$/g, (m) => {
            mathBlocks.push(m);
            return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`;
        });

        let formattedHTML = safeText;
        if(typeof marked !== 'undefined') {
            formattedHTML = marked.parse(safeText);
        }
        formattedHTML = formattedHTML.replace(/<strong>(.*?)<\/strong>/g, '<strong class="text-cyan">$1</strong>');
        
        mathBlocks.forEach((block, index) => {
            formattedHTML = formattedHTML.replace(`@@MATH_BLOCK_${index}@@`, block);
        });

        div.innerHTML = `<div style="margin-top:10px; padding:15px; background:rgba(0, 230, 118, 0.1); border-left:3px solid var(--success); font-size:15px; color:#fff; line-height: 1.8; border-radius: 0 8px 8px 0;">
            <div style="margin-bottom: 15px; font-size: 16px;">🤖 <b class="text-success">AI Tutor Analysis:</b></div>
            ${formattedHTML}
        </div>`;
        btn.classList.add('hidden');
        
        if (window.MathJax) {
            MathJax.typesetPromise([div]).catch((err) => console.log('MathJax Error:', err));
        }

    } catch(err) {
        showToast("Error: " + err.message, "error");
        btn.innerHTML = '<i class="fas fa-magic"></i> Explain Answer';
        btn.disabled = false;
    }
}
// ==========================================
// 9. FLASHCARDS SYSTEM 
// ==========================================
function toggleFlashcardCreator() { document.getElementById('fc-creator-section').classList.toggle('hidden'); }
function backToFCDashboard() {
    document.getElementById('active-fc-container').classList.add('hidden');
    document.getElementById('fc-quiz-container').classList.add('hidden');
    document.getElementById('fc-all-container').classList.add('hidden');
    document.getElementById('fc-dashboard').classList.remove('hidden');
    checkDueFlashcards();
}

async function generateFlashcardsWithAI() {
    const apiKey = 'server-proxy';
    const rawText = document.getElementById('fc-raw-text').value;
    const count = document.getElementById('fc-count-input').value || "5";
    const selectedModel = document.getElementById('ai-model-select') ? document.getElementById('ai-model-select').value : 'llama-3.3-70b-versatile';

    if(!apiKey) return showToast("Save Groq API Key first.", "error");
    if(!rawText) return showToast("Paste text to extract cards.", "error");

    document.getElementById('fc-loading-text').classList.remove('hidden');
    document.getElementById('btn-generate-fc').disabled = true;

    const systemPrompt = `You are a strict JSON parsing API. Extract exactly ${count} key concepts, rules, or questions from the user's text. Format MUST be exactly a JSON array: [{"front": "Question or Term", "back": "Concise Answer or Definition"}]. Keep 'back' concise. Output ONLY raw JSON without markdown.`;

    try {
        const response = await fetch(`/api/ai-proxy`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: selectedModel, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: rawText }], temperature: 0.1 })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        let cardsArray = JSON.parse(data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim());

        if(db && cardsArray.length > 0) {
            let batch = db.batch();
            cardsArray.forEach(card => {
                let newRef = db.collection('users').doc(currentUser).collection('flashcards').doc();
                batch.set(newRef, { front: card.front, back: card.back, nextReview: Date.now() });
            });
            await batch.commit();
            document.getElementById('fc-raw-text').value = ''; document.getElementById('fc-count-input').value = '';
            toggleFlashcardCreator(); showToast(`${cardsArray.length} Cards saved!`, 'success');
        }
    } catch(err) {
        showToast("Card Gen Failed: " + err.message, "error");
    } finally {
        document.getElementById('fc-loading-text').classList.add('hidden'); document.getElementById('btn-generate-fc').disabled = false;
    }
}

function checkDueFlashcards() {
    let now = Date.now();
    dueFlashcards = myFlashcards.filter(c => !c.nextReview || c.nextReview <= now);
    document.getElementById('fc-queue-count').innerText = dueFlashcards.length;
    if(dueFlashcards.length > 0) {
        document.getElementById('btn-start-study').classList.remove('hidden');
        document.getElementById('btn-fc-quiz').classList.remove('hidden');
    } else {
        document.getElementById('btn-start-study').classList.add('hidden');
        if(myFlashcards.length < 4) document.getElementById('btn-fc-quiz').classList.add('hidden'); 
    }
}

function startStudyingFlashcards() {
    if(dueFlashcards.length === 0) return showToast("No cards due!", "info");
    currentStudyIndex = 0;
    document.getElementById('fc-dashboard').classList.add('hidden');
    document.getElementById('active-fc-container').classList.remove('hidden');
    showCurrentFlashcard();
}

function showCurrentFlashcard() {
    let card = dueFlashcards[currentStudyIndex];
    document.getElementById('active-fc-card').classList.remove('is-flipped');
    document.getElementById('fc-front-text').innerText = card.front;
    document.getElementById('fc-back-text').innerText = card.back;
    document.getElementById('fc-study-controls').classList.add('hidden');
}

function flipActiveCard() {
    let cardEl = document.getElementById('active-fc-card');
    if(!cardEl.classList.contains('is-flipped')) {
        cardEl.classList.add('is-flipped');
        document.getElementById('fc-study-controls').classList.remove('hidden');
    }
}

async function markCard(isCorrect) {
    let card = dueFlashcards[currentStudyIndex];
    let nextTime = isCorrect ? Date.now() + (2*24*60*60*1000) : Date.now() + (3*60*60*1000);
    showToast(isCorrect ? "See you in 2 Days." : "Review in 3 Hours.", isCorrect ? "success" : "error");

    if(db) await db.collection('users').doc(currentUser).collection('flashcards').doc(card.id).update({ nextReview: nextTime });

    currentStudyIndex++;
    if (currentStudyIndex < dueFlashcards.length) showCurrentFlashcard();
    else { backToFCDashboard(); showToast("Session Complete!", "success"); }
}

function viewAllFlashcards() {
    document.getElementById('fc-dashboard').classList.add('hidden');
    document.getElementById('fc-all-container').classList.remove('hidden');
    const grid = document.getElementById('fc-all-grid');
    grid.innerHTML = '';
    if(myFlashcards.length === 0) { grid.innerHTML = '<p class="text-muted w-100">No cards yet.</p>'; return; }
    myFlashcards.forEach(c => {
        grid.innerHTML += `<div class="fc-mini-card"><strong class="text-cyan">${c.front}</strong><hr style="border-color: rgba(255,255,255,0.1); margin: 5px 0;"><span class="text-white">${c.back}</span></div>`;
    });
}

async function generateQuizFromCards() {
    if(myFlashcards.length < 4) return showToast("Need at least 4 flashcards.", "error");
    const apiKey = 'server-proxy';
    if(!apiKey) return showToast("Save Groq API Key first.", "error");

    document.getElementById('fc-dashboard').classList.add('hidden');
    document.getElementById('fc-quiz-container').classList.remove('hidden');
    const qaArea = document.getElementById('fc-quiz-area');
    qaArea.innerHTML = '<p class="text-center text-cyan"><i class="fas fa-spinner fa-spin"></i> Generating custom quiz...</p>';
    document.getElementById('submit-fc-quiz-btn').classList.add('hidden');

    let sample = myFlashcards.sort(() => 0.5 - Math.random()).slice(0, 10);
    let cardsData = JSON.stringify(sample.map(c => ({ id: c.id, concept: c.front, meaning: c.back })));

    const prompt = `Create a 4-option multiple-choice quiz based ONLY on these flashcards: ${cardsData}. Formulate a question where the correct answer is the meaning. Invent 3 wrong options. Format MUST be a JSON array: [{"id": "the_card_id", "q": "Question", "opts": ["A", "B", "C", "D"], "ans": 0}]. Output ONLY raw JSON.`;
    const selectedModel = document.getElementById('ai-model-select') ? document.getElementById('ai-model-select').value : 'llama-3.3-70b-versatile';

    try {
        const response = await fetch(`/api/ai-proxy`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: selectedModel, messages: [{ role: "user", content: prompt }], temperature: 0.2 })
        });
        const data = await response.json();
        if(data.error) throw new Error(data.error.message);

        activeFCQuiz = JSON.parse(data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim());

        qaArea.innerHTML = '';
        activeFCQuiz.forEach((qObj, qIndex) => {
            let optsHtml = '';
            qObj.opts.forEach((opt, optIndex) => {
                optsHtml += `<label class="option-label text-white"><input type="radio" name="fcq_${qIndex}" value="${optIndex}">${opt}</label>`;
            });
            qaArea.innerHTML += `<div class="question-block"><p class="question-text">${qIndex + 1}. ${qObj.q}</p>${optsHtml}</div>`;
        });
        document.getElementById('submit-fc-quiz-btn').classList.remove('hidden');
    } catch (err) { qaArea.innerHTML = `<p class="text-danger text-center">Quiz Failed: ${err.message}</p>`; }
}

async function submitFCQuiz() {
    if(!activeFCQuiz) return;
    let correct = 0; let batch = db.batch(); let now = Date.now();
    activeFCQuiz.forEach((qObj, qIndex) => {
        const selected = document.querySelector(`input[name="fcq_${qIndex}"]:checked`);
        let isRight = selected && parseInt(selected.value) === qObj.ans;
        let nextTime = isRight ? now + (2*24*60*60*1000) : now + (3*60*60*1000);
        if(isRight) correct++;
        if(qObj.id) batch.update(db.collection('users').doc(currentUser).collection('flashcards').doc(qObj.id), { nextReview: nextTime });
    });
    await batch.commit();
    showToast(`Quiz Complete! Scored ${correct}/${activeFCQuiz.length}. Spacing Updated.`, 'success');
    backToFCDashboard();
}

// ==========================================
// 10. Subjects Override & Sub-renders
// ==========================================
function renderUI() { renderSpiritual(); renderSubjects(); renderSharedPoll(); renderSharedCustomTasks(); calculatePoints(); }

function updateSub(sub, key, change) {
    if (localData.subjects[sub][key] + change >= 0) {
        localData.subjects[sub][key] += change;
        saveToDB(); renderSubjects(); renderSharedPoll(); 
    }
}
function manualSetSub(sub, key) {
    let val = prompt(`Amount for ${sub} ${key.replace('_', ' ')}:`, localData.subjects[sub][key]);
    if(val !== null && !isNaN(val) && val >= 0) { localData.subjects[sub][key] = parseInt(val); saveToDB(); renderSubjects(); renderSharedPoll(); }
}
function renderSubjects() {
    const container = document.getElementById('subjects-container'); container.innerHTML = '';
    let activeSubjects = {};
    localData.dailySelection.forEach(task => {
        let val = localData.subjects[task.subject][task.key];
        if (val > 0) { if (!activeSubjects[task.subject]) activeSubjects[task.subject] = {}; activeSubjects[task.subject][task.key] = val; }
    });
    if(Object.keys(activeSubjects).length === 0) return container.innerHTML = `<p class="text-muted text-center w-100" style="grid-column: span 2; margin-top:20px;">Complete a task from Daily Poll to unlock.</p>`;
    for (const [sub, tasks] of Object.entries(activeSubjects)) {
        let html = `<div class="card-glass subject-card"><h4 class="text-cyan mb-10">${sub}</h4>`;
        for (const [key, val] of Object.entries(tasks)) {
            html += `<div class="counter-row"><span>${key.replace('_', ' ')}</span><div class="controls"><button onclick="updateSub('${sub}', '${key}', -1)">-</button><span class="val" onclick="manualSetSub('${sub}', '${key}')">${val}</span><button onclick="updateSub('${sub}', '${key}', 1)">+</button></div></div>`;
        }
        container.innerHTML += html + `</div>`;
    }
}
function toggleSpiritual(key) { localData.spiritual[key].done = !localData.spiritual[key].done; saveToDB(); renderSpiritual(); }
function setDelay(key, delay) { localData.spiritual[key].delay = delay; saveToDB(); renderSpiritual(); }
function setRakat(key, val) { localData.spiritual[key].rakat = parseInt(val) || 0; saveToDB(); }

function renderSpiritual() {
    const container = document.getElementById('spiritual-container'); 
    if(!container) return;
    container.innerHTML = '';
    
    for (const [key, data] of Object.entries(localData.spiritual)) {
        let rakatHtml = '';
        if ((data.type === 'nafl' || data.type === 'qiyam') && data.done) {
            let ptsPerRakah = data.type === 'qiyam' ? 100 : 15; // تحديد سعر الركعة
            rakatHtml = `<div style="margin-top: 10px; text-align: right;"><input type="number" placeholder="عدد الركعات؟" value="${data.rakat || ''}" class="input-dark" style="width: 100px; padding: 5px; font-size:14px; text-align:center;" onchange="setRakat('${key}', this.value)"> <span style="font-size:12px; color:var(--success); font-weight:bold;">الركعة بـ ${ptsPerRakah} نقطة!</span></div>`;
        }

        container.innerHTML += `
            <div class="card-glass spirit-item" style="direction: rtl; text-align: right;">
                <div class="spirit-top" style="display:flex; justify-content:flex-start; align-items:center; gap: 12px;">
                    <input type="checkbox" ${data.done ? 'checked' : ''} onchange="toggleSpiritual('${key}')" style="transform: scale(1.3);">
                    <span style="flex-grow:1; font-size: 16px; font-weight: bold; ${data.done ? 'text-decoration:line-through; opacity:0.5;' : ''}">${key}</span>
                </div>
                ${rakatHtml}
                ${data.done && (!key.includes('الورد') && !key.includes('الحديث')) ? `
                <div class="delay-options" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;">
                    <button class="delay-btn ${data.delay===0?'active':''}" onclick="setDelay('${key}',0)">في وقتها</button>
                    <button class="delay-btn ${data.delay===1?'active':''}" onclick="setDelay('${key}',1)">تأخير 1س</button>
                    <button class="delay-btn ${data.delay===2?'active':''}" onclick="setDelay('${key}',2)">تأخير 2س</button>
                    <button class="delay-btn ${data.delay===3?'active':''}" onclick="setDelay('${key}',3)">أكثر</button>
                </div>` : ''}
            </div>`;
    }
}

// ضيف السطرين دول تحتها عشان نافذة الخصم تفتح وتقفل:
function openPenaltyModal() { document.getElementById('penalty-modal').classList.remove('hidden'); }
function closePenaltyModal() { document.getElementById('penalty-modal').classList.add('hidden'); }

// ==========================================
// 11. Analytics, Leaderboard & AI MENTOR
// ==========================================
function loadHistoryDate() { const dateVal = document.getElementById('history-date').value; if(dateVal) { currentDate = dateVal; fetchData(dateVal); } }

async function loadLeaderboard(filter) {
    if(!db) return;
    let mamdouhTotal = 0; let samaTotal = 0; let startDateStr = todayStr;
    if (filter === 'week') { const d = new Date(); d.setDate(d.getDate() - 7); startDateStr = d.toISOString().split('T')[0]; } 
    else if (filter === 'month') { const d = new Date(); d.setDate(d.getDate() - 30); startDateStr = d.toISOString().split('T')[0]; }

    async function fetchTotalPointsForUser(userName) {
        let sum = 0;
        if (filter === 'today') {
            let doc = await db.collection('users').doc(userName).collection('daily_records').doc(todayStr).get();
            if(doc.exists) sum = doc.data().points || 0;
        } else {
            let snapshot = await db.collection('users').doc(userName).collection('daily_records').where(firebase.firestore.FieldPath.documentId(), '>=', startDateStr).where(firebase.firestore.FieldPath.documentId(), '<=', todayStr).get();
            snapshot.forEach(doc => { sum += doc.data().points || 0; });
        }
        return sum;
    }
    mamdouhTotal = await fetchTotalPointsForUser('Mamdouh'); samaTotal = await fetchTotalPointsForUser('Sama');
    document.getElementById('lb-mamdouh-score').innerText = mamdouhTotal; document.getElementById('lb-sama-score').innerText = samaTotal;
    let max = Math.max(mamdouhTotal, samaTotal, 1);
    document.getElementById('bar-mamdouh').style.height = `${(mamdouhTotal/max)*150}px`; document.getElementById('bar-sama').style.height = `${(samaTotal/max)*150}px`;
    drawCharts(mamdouhTotal, samaTotal);
}
function setLeaderboardFilter(filter, btn) { document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); loadLeaderboard(filter); }

function drawCharts(mPts, sPts) {
    if (charts.radar) charts.radar.destroy();
    charts.radar = new Chart(document.getElementById('radarChart').getContext('2d'), { type: 'radar', data: { labels: ['URT', 'TOC', 'Sessions', 'Spiritual', 'Vocab/Exams'], datasets: [{ label: 'Mamdouh', data: [mPts*0.4, mPts*0.2, mPts*0.2, mPts*0.1, mPts*0.1], borderColor: '#00E5FF', backgroundColor: 'rgba(0, 229, 255, 0.2)' }, { label: 'Sama', data: [sPts*0.3, sPts*0.3, sPts*0.2, sPts*0.1, sPts*0.1], borderColor: '#FF3D00', backgroundColor: 'rgba(255, 61, 0, 0.2)' }] }, options: { responsive: true, maintainAspectRatio: false, plugins:{legend:{display:false}}, scales: { r: { grid: { color: '#333' }, pointLabels: { color: '#8A94A6', font:{size:10} } } } } });
    if (charts.bar) charts.bar.destroy();
    charts.bar = new Chart(document.getElementById('barChart').getContext('2d'), { type: 'bar', data: { labels: ['Total Score'], datasets: [{ label: 'Mamdouh', data: [mPts], backgroundColor: '#00E5FF', borderRadius: 5 }, { label: 'Sama', data: [sPts], backgroundColor: '#FF3D00', borderRadius: 5 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: '#333' }, beginAtZero: true }, x: { grid: { display: false } } } } });
    let myUrt = 0, myToc = 0, mySpirit = 0, myCustom = 0;
    for (const [sub, tasks] of Object.entries(localData.subjects)) { myUrt += (tasks.URT_Pieces * 50) + (tasks.URT_Full * 300); myToc += (tasks.TOC_Normal * 2) + (tasks.TOC_Essay * 3); }
    for (const data of Object.values(localData.spiritual)) { if(data.done) mySpirit += 25; }
    sharedCustomTasks.forEach(ct => { if(localData.customTaskStates[ct.id]) myCustom += ct.points; });
    if (charts.doughnut) charts.doughnut.destroy();
    charts.doughnut = new Chart(document.getElementById('doughnutChart').getContext('2d'), { type: 'doughnut', data: { labels: ['URT', 'TOC', 'Spiritual', 'Missions & Exams'], datasets: [{ data: [myUrt, myToc, mySpirit, myCustom], backgroundColor: ['#FF1744', '#00E676', '#FF3D00', '#E040FB'], borderWidth: 0, hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#fff', font:{size:10} } } } } });
}

// ==========================================
// 🔴 نظام العقوبات والخصم 
// ==========================================
function applyPenalty(amount, reason) {
    if(confirm(`هل أنت متأكد من خصم ${amount} نقطة بسبب: ${reason}؟`)) {
        localData.points -= amount;
        saveToDB();
        document.getElementById('header-score').innerText = localData.points;
        showToast(`تم خصم ${amount} نقطة! السبب: ${reason}`, 'error');
    }
}

function applyCustomPenalty() {
    let reason = document.getElementById('custom-penalty-reason').value || "خصم مخصص";
    let amount = parseInt(document.getElementById('custom-penalty-amount').value);
    if(!amount || amount <= 0) return showToast("أدخل عدد نقاط صحيح للخصم!", "info");
    applyPenalty(amount, reason);
    document.getElementById('custom-penalty-reason').value = '';
    document.getElementById('custom-penalty-amount').value = '';
}

// ==========================================
// 🧠 المحلل الخارق (AI MENTOR - FULL MONTH ANALYSIS)
// ==========================================
async function generateMentorReport() {
    const apiKey = 'server-proxy';
    if(!apiKey) return showToast("Please save Groq API Key first.", "error");

    const btn = document.getElementById('btn-mentor-report');
    const out = document.getElementById('mentor-report-output');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing Full Month Data...'; 
    btn.disabled = true; 
    out.classList.add('hidden');

    try {
        // 1. سحب بيانات آخر 30 يوم من الداتابيز ليك ولشريكك
        let d = new Date();
        d.setDate(d.getDate() - 30);
        let startDateStr = d.toISOString().split('T')[0];

        let mySnapshot = await db.collection('users').doc(currentUser).collection('daily_records')
            .where(firebase.firestore.FieldPath.documentId(), '>=', startDateStr).get();
        
        let partnerUser = currentUser === 'Mamdouh' ? 'Sama' : 'Mamdouh';
        let pSnapshot = await db.collection('users').doc(partnerUser).collection('daily_records')
            .where(firebase.firestore.FieldPath.documentId(), '>=', startDateStr).get();

        // 2. تجميع وتحليل البيانات بتاعتك
        let myTotalPts = 0; let myTotalUrt = 0; let myTotalSessions = 0; let myTotalTOC = 0;
        mySnapshot.forEach(doc => {
            let data = doc.data();
            myTotalPts += data.points || 0;
            if(data.subjects) {
                Object.values(data.subjects).forEach(tasks => {
                    myTotalUrt += (tasks.URT_Full || 0) + (tasks.URT_Pieces || 0);
                    myTotalTOC += (tasks.TOC_Normal || 0) + (tasks.TOC_Essay || 0);
                    Object.keys(tasks).forEach(k => {
                        if(k.includes('Session')) myTotalSessions += tasks[k];
                    });
                });
            }
        });

        // تجميع نقاط الشريك
        let pTotalPts = 0;
        pSnapshot.forEach(doc => { pTotalPts += doc.data().points || 0; });

        let examsTaken = typeof sharedExams !== 'undefined' ? sharedExams.filter(e => e.results && e.results[currentUser]).length : 0;
        let flashcardsCount = typeof myFlashcards !== 'undefined' ? myFlashcards.length : 0;

        // 3. تجهيز الداتا المرعبة للذكاء الاصطناعي
        let statsSummary = `
        Student: ${currentUser}
        Total Points (Last 30 Days): ${myTotalPts}
        Partner (${partnerUser}) Total Points: ${pTotalPts}
        Total URTs Solved: ${myTotalUrt}
        Total Study Sessions Watched: ${myTotalSessions}
        Total TOCs Solved: ${myTotalTOC}
        Total AI Exams Taken: ${examsTaken}
        Flashcards Created: ${flashcardsCount}
        `;

        const prompt = `Act as an elite, strict, but highly motivational STEM AI Mentor for ${currentUser} (a high school student in Egypt preparing for finals). 
        Analyze this comprehensive 30-day data: 
        ${statsSummary}
        
        YOUR MISSION:
        1. Give a deep, detailed analysis of their performance over the month (do not just repeat the numbers, analyze what they mean).
        2. Compare them fiercely but constructively with their partner (${partnerUser}). If they are losing, wake them up. If winning, tell them to crush it more.
        3. Point out exactly what they are doing well (e.g., URTs, Sessions) and what they might be neglecting.
        4. Give a strict, bulleted action plan for the next week.
        
        Respond in a mix of professional Arabic and motivational English. Use bullet points and bold text. Do NOT be brief; give a full, detailed, and powerful report.`;

        const selectedModel = document.getElementById('ai-model-select') ? document.getElementById('ai-model-select').value : 'llama-3.3-70b-versatile';

        const response = await fetch(`/api/ai-proxy`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ model: selectedModel, messages: [{ role: "user", content: prompt }], temperature: 0.5 }) 
        });
        
        const data = await response.json();
        if(data.error) throw new Error(data.error.message);
        
        out.innerHTML = data.choices[0].message.content.replace(/\*\*(.*?)\*\*/g, '<strong class="text-cyan">$1</strong>').replace(/\n/g, '<br>');
        out.classList.remove('hidden'); 
        showToast("Deep Mentor Report Generated!", "success");

    } catch(err) { 
        showToast("Mentor Error: " + err.message, "error"); 
    } finally { 
        btn.innerHTML = 'Generate Deep Report'; 
        btn.disabled = false; 
    }
}

// ==========================================
// 13. TEAM CHAT SYSTEM (V2 Bulletproof)
// ==========================================
const sendSound = new Audio('https://www.soundjay.com/buttons/sounds/button-09.mp3'); 
const receiveSound = new Audio('https://www.soundjay.com/buttons/sounds/button-10.mp3');

let replyContext = null; 

function setReply(msgId, text, sender) {
    replyContext = { id: msgId, text: text, sender: sender };
    let banner = document.getElementById('chat-reply-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'chat-reply-banner';
        banner.style.cssText = "background: rgba(0,229,255,0.1); padding: 8px 15px; border-left: 3px solid var(--cyan); border-radius: 8px 8px 0 0; font-size: 12px; color: #fff; display: flex; justify-content: space-between; align-items: center; margin-bottom: -10px; z-index: 10;";
        const inputArea = document.querySelector('.chat-input-area');
        inputArea.parentNode.insertBefore(banner, inputArea);
    }
    banner.innerHTML = `<span><i class="fas fa-reply text-cyan"></i> Replying to <b>${sender}</b>: ${text.substring(0,30)}...</span> 
                        <button onclick="cancelReply()" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size: 16px;"><i class="fas fa-times"></i></button>`;
    document.getElementById('chat-input').focus();
}

function cancelReply() {
    replyContext = null;
    let banner = document.getElementById('chat-reply-banner');
    if(banner) banner.remove();
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    if(!input) return;
    const text = input.value.trim();
    if(!text) return;
    
    input.value = ''; 
    
    let payload = {
        text: text,
        sender: currentUser,
        timestamp: Date.now()
    };

    if (replyContext) {
        payload.replyTo = replyContext;
        cancelReply();
    }
    
    if(db) {
        sendSound.play().catch(e => console.log("Audio blocked by browser, but message will send.")); 
        try {
            await db.collection('team_chat').add(payload);
            let partnerUser = currentUser === 'Mamdouh' ? 'Sama' : 'Mamdouh';
            db.collection('users').doc(partnerUser).set({
                pendingChatAlert: { from: currentUser, msg: text.substring(0,20)+"...", time: Date.now() }
            }, { merge: true });
        } catch(err) {
            console.error("Error sending message:", err);
            showToast("Failed to send message.", "error");
        }
    }
}

document.addEventListener('keydown', function (e) {
    if (e.target && e.target.id === 'chat-input') {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }
});

async function addReaction(docId, emoji) {
    let updateData = {};
    updateData[`reactions.${currentUser}`] = emoji;
    await db.collection('team_chat').doc(docId).set(updateData, { merge: true });
}

async function deleteMessage(docId) {
    if(confirm("Are you sure you want to delete this message?")) {
        await db.collection('team_chat').doc(docId).delete();
    }
}

let isChatInitialLoad = true;
let chatUnsubscribeFinal = null; 

function startChatEngine() {
    if(!db) return;
    
    // 🟢 قفل أي مستمع قديم عشان نمنع التكرار (Memory Leak)
    if(window.chatUnsubscribeFinal) {
        window.chatUnsubscribeFinal(); 
    }

    const chatArea = document.getElementById('chat-messages-area');
    if(!chatArea) return;
    
    // 🟢 نمسح الشاشة مرة واحدة بس في البداية
    chatArea.innerHTML = '';
    isChatInitialLoad = true;

    window.chatUnsubscribeFinal = db.collection('team_chat')
        .orderBy('timestamp', 'asc')
        .limit(100) // تقدر تقللها لـ 50 لو حابب توفر أكتر
        .onSnapshot(snapshot => {
            
            // 🟢 التعامل مع التغييرات "فقط" مش تحميل كل الرسايل
            snapshot.docChanges().forEach(change => {
                const data = change.doc.data();
                const docId = change.doc.id;
                const isSent = data.sender === currentUser;
                
                // 1. لو رسالة جديدة انضافت
                if (change.type === 'added') {
                    if (!isChatInitialLoad && !isSent) {
                        receiveSound.play().catch(e=>{});
                    }
                    
                    let reactionsHtml = '';
                    if(data.reactions) {
                        let emojis = Object.values(data.reactions).join(' ');
                        if(emojis) reactionsHtml = `<div class="reactions-box" style="font-size:14px; margin-top:5px; background:rgba(0,0,0,0.5); display:inline-block; padding:3px 10px; border-radius:15px; border: 1px solid rgba(255,255,255,0.1); cursor:default;">${emojis}</div>`;
                    }

                    let replyHtml = '';
                    if (data.replyTo) {
                        replyHtml = `<div style="font-size: 11px; background: rgba(0,0,0,0.3); padding: 8px; border-left: 3px solid ${isSent ? '#000' : 'var(--cyan)'}; border-radius: 4px; margin-bottom: 8px; opacity: 0.8;">
                            <b style="color: ${isSent ? '#333' : 'var(--cyan)'};">${data.replyTo.sender}</b><br>
                            ${data.replyTo.text.substring(0, 50)}...
                        </div>`;
                    }

                    let safeText = data.text.replace(/'/g, "\\'").replace(/"/g, '&quot;').substring(0, 50);
                    let actionsHtml = `<div class="msg-actions" style="display:none; font-size: 14px; margin-top: 5px; gap:12px; background: rgba(0,0,0,0.4); padding: 5px 15px; border-radius: 20px;">
                        <span style="cursor:pointer; transition: 0.2s;" title="Reply" onclick="setReply('${docId}', '${safeText}', '${data.sender}')">↩️</span>
                        <span style="cursor:pointer; transition: 0.2s;" title="Love" onclick="addReaction('${docId}', '❤️')">❤️</span>
                        <span style="cursor:pointer; transition: 0.2s;" title="Fire" onclick="addReaction('${docId}', '🔥')">🔥</span>
                        <span style="cursor:pointer; transition: 0.2s;" title="Rocket" onclick="addReaction('${docId}', '🚀')">🚀</span>
                        ${isSent ? `<span style="cursor:pointer; color:var(--danger);" title="Delete" onclick="deleteMessage('${docId}')">🗑️</span>` : ''}
                    </div>`;

                    // 🟢 إضافة الرسالة الجديدة في آخر الشات بدون مسح القديم
                    let msgDiv = document.createElement('div');
                    msgDiv.id = `msg-${docId}`;
                    msgDiv.className = "message-wrapper";
                    msgDiv.style.cssText = `display:flex; flex-direction:column; align-items: ${isSent ? 'flex-end' : 'flex-start'}; margin-bottom: 15px;`;
                    msgDiv.onmouseenter = function() { this.querySelector('.msg-actions').style.display='flex'; };
                    msgDiv.onmouseleave = function() { this.querySelector('.msg-actions').style.display='none'; };
                    
                    msgDiv.innerHTML = `
                        <div class="message-bubble ${isSent ? 'message-sent' : 'message-received'}" style="position: relative; min-width: 100px;">
                            ${replyHtml}
                            <div style="font-size:15px; font-weight: 500;">${data.text}</div>
                            ${reactionsHtml || '<div class="reactions-container"></div>'}
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            ${isSent ? actionsHtml : ''}
                            <span class="message-meta" style="font-size:10px; color:var(--text-muted);">${new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            ${!isSent ? actionsHtml : ''}
                        </div>
                    `;
                    chatArea.appendChild(msgDiv);
                    chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
                } 
                
                // 2. لو رسالة اتعدلت (مثلاً أخدت رياكشن)
                else if (change.type === 'modified') {
                    let msgDiv = document.getElementById(`msg-${docId}`);
                    if(msgDiv && data.reactions) {
                        let emojis = Object.values(data.reactions).join(' ');
                        let reactionsContainer = msgDiv.querySelector('.reactions-container') || msgDiv.querySelector('.reactions-box');
                        if (reactionsContainer) {
                            reactionsContainer.outerHTML = emojis ? `<div class="reactions-box" style="font-size:14px; margin-top:5px; background:rgba(0,0,0,0.5); display:inline-block; padding:3px 10px; border-radius:15px; border: 1px solid rgba(255,255,255,0.1); cursor:default;">${emojis}</div>` : '<div class="reactions-container"></div>';
                        }
                    }
                }

                // 3. لو رسالة اتمسحت
                else if (change.type === 'removed') {
                    let msgDiv = document.getElementById(`msg-${docId}`);
                    if(msgDiv) msgDiv.remove();
                }
            });
            
            isChatInitialLoad = false;
        });
}
// ==========================================
// 14. MATERIALS VAULT
// ==========================================
function openFolder(subjectName) {
    currentMaterialSubject = subjectName;
    document.getElementById('materials-folders').classList.add('hidden');
    document.getElementById('materials-files-view').classList.remove('hidden');
    document.getElementById('current-folder-title').innerHTML = `<i class="fas fa-folder-open"></i> ${subjectName} Vault`;
    
    loadFilesForSubject();
}

function backToFolders() {
    document.getElementById('materials-files-view').classList.add('hidden');
    document.getElementById('materials-folders').classList.remove('hidden');
    currentMaterialSubject = "";
}

function loadFilesForSubject() {
    if(!db) return;
    if(materialsUnsubscribe) materialsUnsubscribe();
    
    materialsUnsubscribe = db.collection('shared_materials')
                             .where('subject', '==', currentMaterialSubject)
                             .onSnapshot(snap => {
        const area = document.getElementById('files-list-area');
        if(!area) return;
        area.innerHTML = '';
        
        if(snap.empty) {
            area.innerHTML = `<p class="text-muted text-center mt-20">No files here yet. Upload some!</p>`;
            return;
        }

        let filesArray = [];
        snap.forEach(doc => {
            let data = doc.data();
            data.id = doc.id; 
            filesArray.push(data);
        });
        filesArray.sort((a, b) => b.timestamp - a.timestamp);

        filesArray.forEach(fileData => {
            let dateStr = new Date(fileData.timestamp).toLocaleDateString();
            
            let iconClass = 'fa-file-alt text-cyan';
            if(fileData.url.toLowerCase().includes('.pdf')) iconClass = 'fa-file-pdf text-danger';
            if(fileData.url.toLowerCase().includes('.jpg') || fileData.url.toLowerCase().includes('.png')) iconClass = 'fa-image text-success';
            
            area.innerHTML += `
                <div class="file-item">
                    <div class="file-item-name">
                        <strong style="font-size: 14px;"><i class="fas ${iconClass}"></i> ${fileData.fileName}</strong><br>
                        <span class="file-item-meta" style="font-size: 11px;">Uploaded by <b>${fileData.uploadedBy}</b> on ${dateStr}</span>
                    </div>
                    <button id="btn-down-${fileData.id}" class="btn-primary-small bg-cyan" style="padding: 6px 15px; color: black; font-weight: bold; border-radius: 6px; min-width: 115px;" onclick="downloadMaterial('${fileData.url}', '${fileData.fileName}', 'btn-down-${fileData.id}')">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
            `;
        });
    });
}

async function uploadMaterial() {
    const fileInput = document.getElementById('file-upload-input');
    const file = fileInput.files[0];
    const btn = document.getElementById('btn-upload-file');
    
    if(!file) return showToast("Please select a file first.", "error");
    if(!currentMaterialSubject) return showToast("Error: No subject selected.", "error");

    let fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Preparing to upload ${fileSizeMB} MB...`;

    const cloudName = "dtedxyodg"; 
    const uploadPreset = "stem_materials"; 
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    let startTime = Date.now();
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
            let progress = ((e.loaded / e.total) * 100).toFixed(1);
            let elapsedTime = (Date.now() - startTime) / 1000;
            let speed = e.loaded / elapsedTime;
            let remainingBytes = e.total - e.loaded;
            let estimatedTimeSec = remainingBytes / speed;

            let timeText = "";
            if (!isFinite(estimatedTimeSec) || estimatedTimeSec < 0) {
                timeText = "Calculating...";
            } else if(estimatedTimeSec > 60) {
                timeText = (estimatedTimeSec / 60).toFixed(1) + " Min";
            } else if (estimatedTimeSec > 1) {
                timeText = Math.ceil(estimatedTimeSec) + " Sec";
            } else {
                timeText = "Almost done...";
            }

            btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${progress}% of ${fileSizeMB}MB (Time: ${timeText})`;
        }
    };

    xhr.onload = async function() {
        if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            const downloadURL = response.secure_url;

            if(db) {
                await db.collection('shared_materials').add({
                    fileName: file.name,
                    url: downloadURL,
                    subject: currentMaterialSubject,
                    uploadedBy: currentUser,
                    timestamp: Date.now()
                });
            }

            showToast("File Uploaded Successfully!", "success");
            fileInput.value = '';
            btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Upload File';
            btn.disabled = false;
        } else {
            showToast("Upload failed from server.", "error");
            btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Upload File';
            btn.disabled = false;
        }
    };

    xhr.onerror = function() {
        showToast("Network Error!", "error");
        btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Upload File';
        btn.disabled = false;
    };

    xhr.send(formData);
}

function downloadMaterial(url, fileName, btnId) {
    const btn = document.getElementById(btnId);
    if(!btn) return;
    
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 0%`;

    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob'; 

    xhr.onprogress = function(e) {
        if (e.lengthComputable) {
            let progress = ((e.loaded / e.total) * 100).toFixed(0);
            btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${progress}%`;
        } else {
            btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Loading...`;
        }
    };

    xhr.onload = function() {
        if (xhr.status === 200) {
            const blob = xhr.response;
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = fileName; 
            document.body.appendChild(link);
            link.click(); 
            document.body.removeChild(link);
            window.URL.revokeObjectURL(link.href);

            btn.innerHTML = `<i class="fas fa-check"></i> Done`;
            btn.classList.replace('bg-cyan', 'bg-success');
            
            setTimeout(() => {
                btn.innerHTML = `<i class="fas fa-download"></i> Download`;
                btn.classList.replace('bg-success', 'bg-cyan');
                btn.disabled = false;
            }, 3000);
        } else {
            window.open(url, '_blank');
            btn.innerHTML = `<i class="fas fa-download"></i> Download`;
            btn.disabled = false;
        }
    };

    xhr.onerror = function() {
        window.open(url, '_blank');
        btn.innerHTML = `<i class="fas fa-download"></i> Download`;
        btn.disabled = false;
    };

    xhr.send();
}

// ==========================================
// 15. SUPER AI ANALYZER
// ==========================================
function loadCompletedExamsForAI() {
    const select = document.getElementById('super-ai-exam-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Choose a completed exam to analyze --</option>';
    
    const completedExams = sharedExams.filter(exam => exam.results && exam.results[currentUser]);
    
    if (completedExams.length === 0) {
        select.innerHTML = '<option value="">No completed exams found yet.</option>';
        return;
    }

    completedExams.forEach(exam => {
        let res = exam.results[currentUser];
        select.innerHTML += `<option value="${exam.id}">${exam.title} (Score: ${res.correct}/${exam.questions.length})</option>`;
    });
}

async function runSuperAnalysis() {
    const apiKey = 'server-proxy';
    if(!apiKey) return showToast("Please save Groq API Key first.", "error");

    const examId = document.getElementById('super-ai-exam-select').value;
    if(!examId) return showToast("Please select an exam.", "error");

    const examData = sharedExams.find(e => e.id === examId);
    const userResult = examData.results[currentUser];

    const btn = document.getElementById('btn-run-analysis');
    const resultBox = document.getElementById('super-analysis-result');
    const contentDiv = document.getElementById('super-ai-content');

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Brainstorming Analysis...';
    btn.disabled = true;
    resultBox.classList.add('hidden');

    let diagnosticData = `Exam Title: ${examData.title}\n`;
    diagnosticData += `Student Score: ${userResult.correct} correct, ${userResult.wrong} wrong out of ${examData.questions.length}.\n\n`;
    diagnosticData += `--- Detailed Performance ---\n`;

    examData.questions.forEach((q, index) => {
        let correctAnsText = q.opts[q.ans];
        let userAnsInt = userResult.answers[index];
        let userAnsText = userAnsInt !== null ? q.opts[userAnsInt] : "Skipped";
        let status = (userAnsInt === parseInt(q.ans)) ? "✅ CORRECT" : "❌ WRONG";

        diagnosticData += `Q${index + 1}: ${q.q}\n`;
        diagnosticData += `Correct Answer: ${correctAnsText}\n`;
        diagnosticData += `Student Answer: ${userAnsText} (${status})\n\n`;
    });

    const systemPrompt = `You are an elite academic diagnostician. The user is a STEM student in Egypt. Mix clear English with natural Egyptian Arabic.
    
    YOUR EXCLUSIVE MISSION:
    1. 🎯 Quick Overview: Briefly encourage the student based on their score.
    2. 🧠 THE AUTOPSY (Crucial): Focus ONLY on the WRONG answers. Iterate through EVERY single wrong question one by one.
       For EACH wrong question, strictly provide:
       - Question number & brief recap.
       - The Exact Concept/Law/Grammar Rule needed to solve it (Explain it perfectly).
       - The Formula or Definition clearly stated.
       - Why their specific wrong answer was incorrect.
    
    CRITICAL MATH RULES:
    - Double-escape all backslashes (e.g., \\\\frac).
    - Wrap ALL math in $ for inline and $$ for display math.`;

    try {
        const response = await fetch(`/api/ai-proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                model: 'llama-3.3-70b-versatile', 
                messages: [{ role: "system", content: systemPrompt }, { role: "user", content: diagnosticData }], 
                temperature: 0.4,
                max_tokens: 6000
            })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        let rawExplanation = data.choices[0].message.content;
        let mathBlocks = [];
        let safeText = rawExplanation.replace(/\\\[([\s\S]*?)\\\]/g, (m, p1) => { mathBlocks.push(`$$${p1}$$`); return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`; })
                                     .replace(/\\\(([\s\S]*?)\\\)/g, (m, p1) => { mathBlocks.push(`$${p1}$`); return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`; })
                                     .replace(/\$\$([\s\S]*?)\$\$/g, (m) => { mathBlocks.push(m); return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`; })
                                     .replace(/\$([\s\S]*?)\$/g, (m) => { mathBlocks.push(m); return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`; });

        let formattedHTML = typeof marked !== 'undefined' ? marked.parse(safeText) : safeText;
        formattedHTML = formattedHTML.replace(/<strong>(.*?)<\/strong>/g, '<strong class="text-cyan">$1</strong>');
        
        mathBlocks.forEach((block, index) => {
            formattedHTML = formattedHTML.replace(`@@MATH_BLOCK_${index}@@`, block);
        });

        contentDiv.innerHTML = formattedHTML;
        resultBox.classList.remove('hidden');

        if (window.MathJax) MathJax.typesetPromise([contentDiv]);

    } catch(err) {
        showToast("Analysis Failed: " + err.message, "error");
    } finally {
        btn.innerHTML = '<i class="fas fa-microchip"></i> Run Deep Analysis';
        btn.disabled = false;
    }
}

async function generateCloneExam() {
    const apiKey = 'server-proxy';
    const examId = document.getElementById('super-ai-exam-select').value;
    if(!examId || !apiKey) return showToast("Select an exam and save API key.", "error");

    const examData = sharedExams.find(e => e.id === examId);
    const userResult = examData.results[currentUser];
    const btn = document.getElementById('btn-clone-exam');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cloning...';
    btn.disabled = true;

    let promptData = `Original Exam Title: ${examData.title}\n`;
    examData.questions.forEach((q, i) => {
        let status = userResult.answers[i] === parseInt(q.ans) ? "Correct" : "Wrong";
        promptData += `Q${i+1} (${status}): ${q.q}\nOptions: ${JSON.stringify(q.opts)}\nCorrect Ans Index: ${q.ans}\n\n`;
    });

    const systemPrompt = `You are an elite AI exam cloner. Create a NEW exam based on the provided one.
    - Generate EXACTLY the same number of questions.
    - Test the EXACT SAME concepts, but change the numbers, names, and scenarios completely.
    - Pay special attention to questions marked "Wrong" and make sure to thoroughly test those weak concepts again.
    - Format MUST be exactly a JSON array: [{"q": "Question", "opts": ["A", "B", "C", "D"], "ans": 0}].
    CRITICAL MATH RULES: Double-escape backslashes (\\\\frac) and wrap math in $ or $$. DO NOT wrap in markdown. Output ONLY raw JSON.`;

    try {
        const response = await fetch(`/api/ai-proxy`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: "system", content: systemPrompt }, { role: "user", content: promptData }], temperature: 0.3 })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        let rawOutput = data.choices[0].message.content.replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonMatch = rawOutput.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        let parsedData = JSON.parse(jsonMatch ? jsonMatch[0] : rawOutput);
        let questionsArray = Array.isArray(parsedData) ? parsedData : parsedData.questions;

        if(db && questionsArray.length > 0) {
            await db.collection('shared_exams').add({
                title: "[Remix] " + examData.title,
                questions: questionsArray,
                createdBy: currentUser,
                timeLimit: examData.timeLimit,
                linkedTask: examData.linkedTask,
                isURT: examData.isURT,
                savedPassage: examData.savedPassage,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                results: {}
            });
            showToast("Clone Exam Ready! Go to Exams Tab.", "success");
        }
    } catch(err) {
        showToast("Cloning Failed: " + err.message, "error");
    } finally {
        btn.innerHTML = '<i class="fas fa-clone"></i> Generate Similar Exam';
        btn.disabled = false;
    }
}

async function saveWeaknessesAsCards() {
    const apiKey = 'server-proxy';
    const examId = document.getElementById('super-ai-exam-select').value;
    if(!examId || !apiKey) return;

    const examData = sharedExams.find(e => e.id === examId);
    const userResult = examData.results[currentUser];
    const btn = document.getElementById('btn-weakness-cards');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Extracting Cards...';
    btn.disabled = true;

    let wrongData = "";
    examData.questions.forEach((q, i) => {
        if (userResult.answers[i] !== parseInt(q.ans)) {
            wrongData += `Concept of Question: ${q.q}\nCorrect Answer was: ${q.opts[q.ans]}\n\n`;
        }
    });

    if(!wrongData) {
        showToast("No wrong answers to extract! You are perfect. 🌟", "success");
        btn.innerHTML = '<i class="fas fa-layer-group"></i> Save Weaknesses as Cards';
        btn.disabled = false;
        return;
    }

    const systemPrompt = `You are a flashcard generator. Look at these missed questions.
    Identify the core formula, vocabulary word, or scientific rule required for each.
    Generate a flashcard for EACH wrong concept.
    Format MUST be exactly a JSON array: [{"q": "Name of Formula/Concept/Word", "a": "The formula itself or definition"}].
    CRITICAL MATH RULES: Double-escape backslashes (\\\\frac) and wrap math in $ or $$. DO NOT wrap in markdown. Output ONLY raw JSON.`;

    try {
        const response = await fetch(`/api/ai-proxy`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: "system", content: systemPrompt }, { role: "user", content: wrongData }], temperature: 0.1 })
        });
        const data = await response.json();
        
        let rawOutput = data.choices[0].message.content.replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonMatch = rawOutput.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        let cardsArray = JSON.parse(jsonMatch ? jsonMatch[0] : rawOutput);

        if(db && cardsArray.length > 0) {
            let batch = db.batch();
            cardsArray.forEach(card => {
                let refMamdouh = db.collection('flashcards').doc();
                batch.set(refMamdouh, {
                    front: card.q, back: card.a, createdBy: "Mamdouh",
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    nextReview: new Date().toISOString(), interval: 1, easeFactor: 2.5
                });
                
                let refSama = db.collection('flashcards').doc();
                batch.set(refSama, {
                    front: card.q, back: card.a, createdBy: "Sama",
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    nextReview: new Date().toISOString(), interval: 1, easeFactor: 2.5
                });
            });
            await batch.commit();
            showToast(`${cardsArray.length} Cards added to BOTH your decks! 🚀`, "success");
        }
    } catch(err) {
        showToast("Extraction Failed: " + err.message, "error");
    } finally {
        btn.innerHTML = '<i class="fas fa-layer-group"></i> Save Weaknesses as Cards';
        btn.disabled = false;
    }
}

/* ===============================================================
   MORTAQA ELITE UPGRADE LAYER v4.0
   Extends and overrides the legacy engine without deleting legacy
   functionality. Browser secrets are never accepted here.
   =============================================================== */

(function MortaqaEliteCore(){
'use strict';

const root = window;
const M = root.MORTAQA_ELITE = root.MORTAQA_ELITE || {
  version:'5.2.0', booted:false, ready:false,
  config:{
    aiEndpoint:'/api/ai', researchEndpoint:'/api/research',
    maxGroupSize:20, defaultTaskPoints:50, maxTaskPoints:500,
    adhkarCompletionPoints:1000, focusSessionPointCap:400,
    examBasePoints:100, competitionBonusCap:1000,
    useLegacyDataFallback:true, enableLegacyPinLogin:false,
    aiTimeoutMs:45000
  },
  state:{
    authUser:null, profile:null, stage:null, curriculum:null,
    tasks:[], groups:[], group:null, notifications:[], exams:[],
    attempts:[], materials:[], projects:[], messages:[],
    flashcards:[], pointsEvents:[], analytics:null,
    leaderboard:[], currentView:'view-dashboard',
    currentRoom:null, currentGroup:null, currentExam:null,
    examIndex:0, examAnswers:{}, examStartedAt:null, examTimer:null,
    adhkarPeriod:null, adhkarItems:[], adhkarIndex:0, adhkarCompleted:false,
    fun:{index:0,score:0,best:0,questions:[],started:false},
    buddyResults:[], aiThread:[]
  },
  unsub:{}
};

M.log=(...a)=>console.debug('[Mortaqa]',...a);
M.warn=(...a)=>console.warn('[Mortaqa]',...a);
M.err=(...a)=>console.error('[Mortaqa]',...a);

function q(id){ return document.getElementById(id); }
function qs(s,r=document){ return r.querySelector(s); }
function qsa(s,r=document){ return [...r.querySelectorAll(s)]; }
function esc(v){ return String(v==null?'':v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function text(v){ return String(v==null?'':v); }
function safeNum(v,d=0){ const n=Number(v); return Number.isFinite(n)?n:d; }
function clamp(v,min,max){ return Math.max(min,Math.min(max,safeNum(v,min))); }
function uid(){ return (root.crypto&&crypto.randomUUID)?crypto.randomUUID():`m_${Date.now()}_${Math.random().toString(36).slice(2,10)}`; }
function now(){ return new Date(); }
function iso(){ return new Date().toISOString(); }
function today(){ return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo'}).format(new Date()); }
function localHour(){ return Number(new Intl.DateTimeFormat('en-US',{timeZone:'Africa/Cairo',hour:'2-digit',hour12:false}).format(new Date())); }
function debounce(fn,ms=250){ let t; return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}; }
function setText(id,v){ const el=q(id); if(el) el.textContent=text(v); }
function setHTML(id,v){ const el=q(id); if(el) el.innerHTML=text(v); }
function toggle(id,on){ const el=q(id); if(el) el.classList.toggle('hidden',!on); }
function show(id){ toggle(id,true); }
function hide(id){ toggle(id,false); }
function call(fn,...args){ try{return typeof root[fn]==='function'?root[fn](...args):undefined}catch(e){M.err(fn,e);return undefined;} }
function toast(message,type='info'){ if(typeof root.showToast==='function') root.showToast(message,type); else { const t=document.createElement('div');t.textContent=message;t.className=`mortaqa-toast ${type}`;document.body.appendChild(t);setTimeout(()=>t.remove(),3000);} }
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function cleanEmail(v){return text(v).trim().toLowerCase();}
function slug(v){return text(v).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g,'').trim().replace(/\s+/g,'-').slice(0,48)||'student';}
function deepClone(v){return JSON.parse(JSON.stringify(v));}

function adminEmails(){
  if(Array.isArray(root.MORTAQA_CONFIG?.adminEmails)) return root.MORTAQA_CONFIG.adminEmails.map(cleanEmail).filter(Boolean);
  const out=[];
  ['mortaqa-admin-email-1','mortaqa-admin-email-2'].forEach(id=>{const e=q(id);if(e?.content) out.push(cleanEmail(e.content));});
  return [...new Set(out.filter(x=>x && !x.startsWith('YOUR_') && !x.includes('@example')) )];
}
function currentRole(){
  return M.state.authUser?.claims?.role || M.state.profile?.role || '';
}
function isAdmin(profile=M.state.profile){
  const email=cleanEmail(profile?.email || M.state.authUser?.email);
  const role=currentRole();
  return ['super_admin','content_admin','competition_admin','moderator','analytics_admin'].includes(role) || (!!email && adminEmails().includes(email));
}
function assertAdmin(){ if(!isAdmin()){toast('هذه المنطقة مخصصة للإدارة المصرح لها.','error');return false;} return true; }
function userKey(){ return M.state.authUser?.uid || M.state.profile?.uid || M.state.profile?.username || cleanEmail(M.state.profile?.email); }
function profilePath(){return userKey()?`users/${userKey()}`:null;}
function profileName(){return M.state.profile?.name||M.state.profile?.displayName||M.state.authUser?.displayName||'Student';}
function academicPath(p=M.state.profile){
  if(!p) return '';
  return [p.system,p.stage,p.grade,p.track,p.university,p.faculty,p.department,p.academicYear,p.semester].filter(Boolean).join(' / ');
}
function pathKey(p=M.state.profile){return [p?.system,p?.stage,p?.grade,p?.track,p?.universityId||p?.university,p?.facultyId||p?.faculty,p?.departmentId||p?.department,p?.academicYear,p?.semester].filter(Boolean).map(x=>slug(x)).join('__');}
function defaultExamLanguage(p=M.state.profile){
  if(p?.examLanguage) return p.examLanguage;
  const s=`${p?.system||''} ${p?.stage||''} ${p?.track||''}`.toLowerCase();
  if(/stem|igcse|american|university|college|medical|engineering/.test(s)) return 'en';
  return 'ar';
}

function firestore(){
  return (root.firebase&&root.firebase.firestore)?root.firebase.firestore():null;
}
function auth(){return (root.firebase&&root.firebase.auth)?root.firebase.auth():null;}
function serverTimestamp(){return root.firebase?.firestore?.FieldValue?.serverTimestamp?root.firebase.firestore.FieldValue.serverTimestamp():new Date();}
function timestampNow(){return serverTimestamp();}
function col(name){const d=firestore();return d?d.collection(name):null;}
function doc(path){const d=firestore();return d?d.doc(path):null;}
async function getDoc(path){const d=doc(path);return d?d.get():null;}
async function setDoc(path,data,merge=true){const d=doc(path);if(!d) throw new Error('Firestore unavailable');return d.set(data,{merge});}
async function addDoc(name,data){const c=col(name);if(!c) throw new Error('Firestore unavailable');return c.add(data);}
async function safeGetQuery(query){try{const s=await query.get();return s.docs||[];}catch(e){M.warn('query',e);return [];}}
function canUseFirebase(){return !!(firestore()&&auth());}

async function audit(action,data={}){
  if(!userKey() || !firestore()) return;
  try{await addDoc('auditLogs',{actorUid:userKey(),actorEmail:cleanEmail(M.state.profile?.email),action,metadata:data,createdAt:timestampNow(),clientVersion:M.version});}
  catch(e){M.warn('audit skipped',e);}
}

async function writeNotification(targetUid,n){
  if(!targetUid||!firestore()) return;
  try{await addDoc('notifications',{targetUid,...n,read:false,createdAt:timestampNow()});}catch(e){M.warn('notification',e);}
}

async function aiRequest(mode,payload,{fallback=null,timeout=M.config.aiTimeoutMs}={}){
  const endpoint=M.config.aiEndpoint;
  if(!endpoint) return fallback;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const a=auth();
    const token=a?.currentUser?await a.currentUser.getIdToken():'';
    const body={mode,payload,context:{uid:userKey(),profile:M.state.profile?{system:M.state.profile.system,stage:M.state.profile.stage,grade:M.state.profile.grade,track:M.state.profile.track,university:M.state.profile.university,faculty:M.state.profile.faculty,department:M.state.profile.department}:null}};
    const headers={'Content-Type':'application/json','Accept':'application/json'};
    if(token) headers.Authorization=`Bearer ${token}`;
    const res=await fetch(endpoint,{method:'POST',headers,credentials:'include',body:JSON.stringify(body),signal:controller.signal});
    if(!res.ok) throw new Error(`AI ${res.status}`);
    const data=await res.json();
    if(data?.data!==undefined) return data.data;
    if(data?.output!==undefined) return parseMaybeJSON(data.output);
    if(data?.result!==undefined) return parseMaybeJSON(data.result);
    if(data?.choices?.[0]?.message?.content!==undefined) return parseMaybeJSON(data.choices[0].message.content);
    return data;
  }catch(e){M.warn('aiRequest',mode,e);return fallback;}
  finally{clearTimeout(timer);}
}
function parseMaybeJSON(v){
  if(typeof v!=='string') return v;
  const s=v.trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  try{return JSON.parse(s);}catch{return v;}
}

function mountUI(){
  if(!document.body) return;
  if(!q('mortaqa-elite-style')){
    const s=document.createElement('style');s.id='mortaqa-elite-style';s.textContent=`
      .mortaqa-toast{position:fixed;right:20px;bottom:20px;z-index:10001;padding:12px 16px;border-radius:14px;background:rgba(15,23,42,.95);color:#fff;border:1px solid rgba(255,255,255,.12);box-shadow:0 18px 50px rgba(0,0,0,.35);font:600 13px Tajawal,sans-serif}
      .mortaqa-ai-msg{padding:10px 12px;border-radius:14px;margin:8px 0;line-height:1.6}.mortaqa-ai-msg.user{background:rgba(0,229,255,.12);margin-left:15%}.mortaqa-ai-msg.ai{background:rgba(255,255,255,.06);margin-right:15%}
      .mortaqa-card{background:rgba(18,25,43,.76);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:15px;backdrop-filter:blur(16px)}
      .mortaqa-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.mortaqa-muted{opacity:.7;font-size:12px}.mortaqa-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.07);font-size:11px}.mortaqa-progress{height:8px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden}.mortaqa-progress>span{display:block;height:100%;background:linear-gradient(90deg,#00E5FF,#7C4DFF);border-radius:inherit}
      .mortaqa-list{display:flex;flex-direction:column;gap:8px}.mortaqa-list-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,.035);border-radius:12px}.mortaqa-actions{display:flex;gap:8px;flex-wrap:wrap}.mortaqa-btn{border:0;border-radius:10px;padding:9px 12px;cursor:pointer;font-weight:700}.mortaqa-btn.primary{background:#00E5FF;color:#071018}.mortaqa-btn.ghost{background:rgba(255,255,255,.07);color:#fff}.mortaqa-btn.warn{background:#FF9100;color:#111}.mortaqa-btn.danger{background:#FF1744;color:#fff}
      .mortaqa-kpi strong{display:block;font-size:24px;margin-top:4px}.mortaqa-kpi small{opacity:.65}.mortaqa-section-title{font-weight:800;margin-bottom:10px}.mortaqa-empty{padding:18px;text-align:center;opacity:.6}.mortaqa-badge{min-width:24px;height:24px;padding:0 7px;border-radius:8px;background:rgba(0,229,255,.14);display:inline-flex;align-items:center;justify-content:center}
      @media(max-width:700px){.mortaqa-grid{grid-template-columns:1fr 1fr}.mortaqa-kpi strong{font-size:19px}.mortaqa-ai-msg.user,.mortaqa-ai-msg.ai{margin-left:0;margin-right:0}}
    `;document.head.appendChild(s);
  }
}

function injectExamLanguageControl(){
  const host=q('exam-creator-section');if(!host||q('exam-language-select'))return;
  const wrap=document.createElement('div');wrap.className='card-glass p-15 mt-10';wrap.innerHTML=`
    <label style="display:block;margin-bottom:6px">Exam language</label>
    <select id="exam-language-select" class="input-dark"><option value="ar">العربية</option><option value="en">English</option><option value="both">Arabic + English</option></select>`;
  host.appendChild(wrap);const s=q('exam-language-select');if(s)s.value=defaultExamLanguage();
}

function bindGlobalEvents(){
  injectExamLanguageControl();
  const search=q('global-search-input');if(search&&!search.dataset.bound){search.dataset.bound='1';search.addEventListener('input',debounce(()=>globalSearch(search.value),250));}
  const ms=q('materials-search');if(ms&&!ms.dataset.bound){ms.dataset.bound='1';ms.addEventListener('input',debounce(()=>filterMaterials(ms.value),200));}
  const cmd=q('command-search');if(cmd&&!cmd.dataset.bound){cmd.dataset.bound='1';cmd.addEventListener('input',()=>renderCommandResults(cmd.value));}
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();call('openCommandPalette');}if(e.key==='Escape'){['command-palette','notifications-modal','ai-assistant-modal','adhkar-modal','study-buddy-modal','competition-modal','challenge-modal','admin-research-modal'].forEach(id=>hide(id));}});
}

async function bootAuth(){
  const a=auth();if(!a){M.warn('Firebase Auth SDK unavailable');return null;}
  return new Promise(resolve=>{
    let off=a.onAuthStateChanged(async user=>{
      off();
      M.state.authUser=user||null;
      if(user){
        try{
          const token=await user.getIdTokenResult(true);
          M.state.authUser.claims=token.claims||{};
        }catch(e){M.warn('claims read',e);}
        await hydrateUser(user);
      }
      resolve(user||null);
    });
  });
}

async function hydrateUser(user){
  if(!user) return;
  M.state.authUser=user;
  let profile={uid:user.uid,email:user.email||'',name:user.displayName||'',system:'',stage:'',grade:'',track:'',username:'',createdAt:timestampNow()};
  try{const snap=await doc(`users/${user.uid}`).get();if(snap.exists)profile={...profile,...snap.data()};}catch(e){M.warn('profile read',e);}
  M.state.profile=profile;
  localStorage.setItem('mortaqa_active_user_uid',user.uid);
  root.currentUser=profile.username||user.uid;
  setText('current-user-name',profileName());setText('sidebar-user-name',profileName());setText('sidebar-user-path',academicPath());
  renderProfileIdentity();
  await Promise.all([loadTasks(),loadGroups(),loadNotifications(),loadPoints(),loadCurriculumForStudent(),loadMaterialsContext(),loadProjects(),loadExams(),loadFlashcards(),loadAttempts()]);
  await refreshAllAnalytics();
  call('renderUI');
  renderEliteDashboard();
  M.ready=true;
}

function renderProfileIdentity(){
  const p=M.state.profile||{};
  setText('profile-stage',p.stage||p.grade||'—');setText('profile-grade',p.grade||'—');setText('profile-institution',p.institutionName||p.university||p.schoolType||'—');setText('profile-faculty',p.faculty||p.track||'—');
  const av=q('sidebar-avatar');if(av) av.textContent=(profileName().trim()[0]||'S').toUpperCase();
  setText('student-curriculum-title',p.faculty||p.university||p.grade||'My Curriculum');
  setText('student-curriculum-subtitle',academicPath());
}

async function loadPoints(){
  M.state.pointsEvents=[];if(!userKey())return;
  const docs=await safeGetQuery(col('pointEvents')?.where('userUid','==',userKey()).orderBy('createdAt','desc').limit(500));
  M.state.pointsEvents=docs.map(d=>({id:d.id,...d.data()}));
  if(!M.state.pointsEvents.length){
    const old=await safeGetQuery(col('dailyRecords')?.where('user','==',(M.state.profile?.username||userKey())).limit(200));
    const legacy=old.map(d=>{const x=d.data();return {id:d.id,userUid:userKey(),category:'legacy',points:safeNum(x.points),date:x.date,createdAt:x.createdAt||x.date};});
    M.state.pointsEvents=legacy;
  }
}
function pointTotal(kind=null){return M.state.pointsEvents.filter(x=>!kind||x.kind===kind).reduce((s,x)=>s+safeNum(x.points),0);}
async function addPointEvent({points,kind='activity',sourceType='system',sourceId='',reason='',visibility='private',meta={}}={}){
  const n=clamp(points,-5000,5000);if(!userKey()||!n)return {ok:false};
  try{
    const a=auth();
    if(!a?.currentUser) throw new Error('Not authenticated');
    const token=await a.currentUser.getIdToken();
    const res=await fetch('/api/points',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({points:n,kind,sourceType,sourceId,reason,visibility,meta})});
    const out=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(out?.error||`Points API ${res.status}`);
    const data=out?.data;
    if(data){M.state.pointsEvents.unshift(data);}
    await refreshScoreUI();
    return {ok:true,id:data?.id||out?.id};
  }catch(e){M.warn('point event',e);return {ok:false,error:e};}
}
async function refreshScoreUI(){
  const total=M.state.pointsEvents.reduce((s,x)=>s+safeNum(x.points),0);
  setText('header-score',total.toLocaleString());setText('lb-my-score',total.toLocaleString());setText('spirit-points-note',`${pointTotal('spiritual').toLocaleString()} spiritual points tracked privately unless shared.`);
}

function calculateStudentAnalytics(){
  const events=M.state.pointsEvents;
  const attempts=M.state.attempts||[];
  const tasks=M.state.tasks||[];
  const completed=tasks.filter(t=>t.completed||t.completionMap?.[userKey()]).length;
  const accuracy=attempts.length?attempts.reduce((s,a)=>s+(safeNum(a.percent)/100),0)/attempts.length:0;
  const focus=events.filter(e=>e.sourceType==='focus').reduce((s,e)=>s+safeNum(e.meta?.minutes),0);
  const last7=events.filter(e=>String(e.date||'')>=dateOffset(-6)).reduce((s,e)=>s+safeNum(e.points),0);
  const prior7=events.filter(e=>String(e.date||'')>=dateOffset(-13)&&String(e.date||'')<dateOffset(-6)).reduce((s,e)=>s+safeNum(e.points),0);
  const velocity=prior7?((last7-prior7)/prior7)*100:(last7?100:0);
  const consistency=computeConsistency(events);
  const retention=computeRetention(M.state.flashcards||[]);
  const streak=computeStreak(events);
  const mastery=computeSubjectMastery(attempts);
  return {totalPoints:events.reduce((s,e)=>s+safeNum(e.points),0),accuracy,focus,completedTasks:completed,taskTotal:tasks.length,consistency,retention,velocity,streak,mastery,last7,prior7};
}
function dateOffset(days){const d=new Date();d.setDate(d.getDate()+days);return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo'}).format(d);}
function computeConsistency(events){const set=new Set(events.map(e=>e.date).filter(Boolean));let n=0;for(let i=0;i<14;i++)if(set.has(dateOffset(-i)))n++;return Math.round(n/14*100);}
function computeStreak(events){const set=new Set(events.map(e=>e.date).filter(Boolean));let s=0;for(let i=0;i<365;i++){if(set.has(dateOffset(-i)))s++;else if(i>0)break;}return s;}
function computeRetention(cards){if(!cards.length)return 0;const mature=cards.filter(c=>safeNum(c.repetitions)>=2).length;return Math.round(mature/cards.length*100);}
function computeSubjectMastery(attempts){const map={};attempts.forEach(a=>{const subs=a.subjects||a.subject?([a.subject].filter(Boolean)):(a.tags||[]);const list=Array.isArray(subs)&&subs.length?subs:['General'];list.forEach(s=>{map[s]=map[s]||{correct:0,total:0};map[s].correct+=safeNum(a.correct);map[s].total+=safeNum(a.total);});});Object.keys(map).forEach(k=>map[k]=map[k].total?Math.round(map[k].correct/map[k].total*100):0);return map;}

async function refreshAllAnalytics(){
  M.state.analytics=calculateStudentAnalytics();
  refreshScoreUI();
  renderAnalyticsCards();
  drawEliteCharts();
}
function renderAnalyticsCards(){const a=M.state.analytics||calculateStudentAnalytics();
  [['dash-accuracy',`${Math.round(a.accuracy*100)}%`],['dash-focus-time',formatMinutes(a.focus)],['dash-streak',`${a.streak} days`],['dash-tasks-done',`${a.completedTasks}/${a.taskTotal}`],['analytics-accuracy',`${Math.round(a.accuracy*100)}%`],['analytics-consistency',`${a.consistency}%`],['analytics-retention',`${a.retention}%`],['analytics-velocity',`${a.velocity>=0?'+':''}${Math.round(a.velocity)}%`]].forEach(([id,v])=>setText(id,v));
}
function formatMinutes(m){m=safeNum(m);return m>=60?`${Math.floor(m/60)}h ${m%60}m`:`${m}m`;}
function chart(id,type,labels,datasets,opts={}){const el=q(id);if(!el||!root.Chart)return;const old=M.state.charts?.[id];if(old)try{old.destroy()}catch{};M.state.charts=M.state.charts||{};M.state.charts[id]=new root.Chart(el,{type,data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,...opts}});}
function drawEliteCharts(){
  const e=M.state.pointsEvents.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));const days=[...new Set(e.map(x=>x.date).filter(Boolean))].slice(-14);
  const totals=days.map(d=>e.filter(x=>x.date===d).reduce((s,x)=>s+safeNum(x.points),0));
  const labels=days.map(x=>x?.slice(5)||'');
  chart('dashboardTrendChart','line',labels,[{label:'Points',data:totals,tension:.35,borderWidth:2,fill:false}],{plugins:{legend:{display:false}}});
  chart('historyTrendChart','line',labels,[{label:'Daily activity',data:totals,tension:.3,borderWidth:2,fill:false}],{plugins:{legend:{display:false}}});
  const subs=Object.keys(M.state.analytics?.mastery||{});const vals=subs.map(s=>M.state.analytics.mastery[s]);
  chart('radarChart','radar',subs,[{label:'Mastery',data:vals,borderWidth:2,fill:true}],{scales:{r:{beginAtZero:true,max:100}}});
  chart('barChart','bar',['7d','Previous 7d'],[ {label:'Score',data:[M.state.analytics?.last7||0,M.state.analytics?.prior7||0],borderWidth:1} ],{plugins:{legend:{display:false}}});
  chart('doughnutChart','doughnut',['Focus','Tasks','Assessments'],[{data:[Math.min(100,M.state.analytics?.focus||0),M.state.analytics?.completedTasks||0,M.state.attempts?.length||0],borderWidth:0}],{plugins:{legend:{position:'bottom'}}});
}

async function loadTasks(){
  M.state.tasks=[];if(!userKey())return;
  const q1=col('tasks');if(!q1)return;
  const docs=await safeGetQuery(q1.where('status','in',['active','completed','published']).orderBy('createdAt','desc').limit(200));
  M.state.tasks=docs.map(d=>({id:d.id,...d.data()})).filter(t=>taskVisibleToUser(t));
  renderTaskList();
}
function taskVisibleToUser(t){
  const uid=userKey();if(!uid)return false;if(t.ownerUid===uid||t.assigneeUid===uid)return true;
  if(t.visibility==='public'||t.visibility==='global') return true;
  if(t.visibility==='group') return !!M.state.groups.some(g=>g.id===t.groupId);
  return false;
}
async function taskCompleted(task){
  if(task.completionMap?.[userKey()])return true;
  try{const s=await doc(`tasks/${task.id}/completions/${userKey()}`).get();return s.exists;}catch{return false;}
}
async function saveTaskCompletion(task,done=true){
  const uid=userKey();if(!uid)return;
  await setDoc(`tasks/${task.id}/completions/${uid}`,{uid,taskId:task.id,completed:done,completedAt:done?timestampNow():null},{merge:true});
  if(done){await addPointEvent({points:clamp(safeNum(task.points,M.config.defaultTaskPoints),5,M.config.maxTaskPoints),kind:'academic',sourceType:'task',sourceId:task.id,reason:task.title||'Task completed',visibility:'group'});}
}
function renderTaskList(){
  const host=q('dashboard-task-list')||q('custom-tasks-list');if(!host)return;
  const ts=M.state.tasks.slice(0,10);if(!ts.length){host.innerHTML='<div class="mortaqa-empty">No tasks yet. Your next task will appear here.</div>';return;}
  host.innerHTML=ts.map(t=>`<div class="mortaqa-list-row"><div><strong>${esc(t.title||t.name||'Task')}</strong><div class="mortaqa-muted">${esc(t.subject||t.type||'Study')} • ${safeNum(t.points)} pts</div></div><div class="mortaqa-actions"><button class="mortaqa-btn ${t.completed?'ghost':'primary'}" onclick="toggleSharedCustomTask('${esc(t.id)}')">${t.completed?'Done':'Complete'}</button></div></div>`).join('');
}

async function loadGroups(){
  M.state.groups=[];if(!userKey())return;
  const docs=await safeGetQuery(col('groups')?.where('memberUids','array-contains',userKey()).limit(20));
  M.state.groups=docs.map(d=>({id:d.id,...d.data()}));M.state.group=M.state.groups[0]||null;M.state.currentGroup=M.state.group;renderGroupContext();
}
function renderGroupContext(){setText('buddy-suggested-name',M.state.group?.name||'No active group');setText('learning-context-badge',M.state.group?`Group: ${M.state.group.name}`:'Personal workspace');}

async function loadNotifications(){
  M.state.notifications=[];if(!userKey())return;
  const docs=await safeGetQuery(col('notifications')?.where('targetUid','==',userKey()).orderBy('createdAt','desc').limit(30));M.state.notifications=docs.map(d=>({id:d.id,...d.data()}));renderNotifications();
}
function renderNotifications(){const host=q('notification-list');if(!host)return;if(!M.state.notifications.length){host.innerHTML='<div class="mortaqa-empty">You are all caught up.</div>';return;}host.innerHTML=M.state.notifications.map(n=>`<div class="mortaqa-list-row"><div><strong>${esc(n.title||'Mortaqa')}</strong><div class="mortaqa-muted">${esc(n.body||n.message||'')}</div></div><span class="mortaqa-badge">${n.read?'✓':'•'}</span></div>`).join('');}

async function loadCurriculumForStudent(){
  const p=M.state.profile;if(!p)return;
  const c=col('curricula');
  const key=pathKey(p);
  let docs=[];
  if(c&&key){
    docs=await safeGetQuery(c.where('pathKey','==',key).where('active','==',true).limit(1));
    if(!docs.length) docs=await safeGetQuery(c.where('pathKey','==',key).limit(1));
  }
  if(docs[0]){
    M.state.curriculum={id:docs[0].id,...docs[0].data()};
  }else{
    M.state.curriculum=await loadBundledCurriculum(p);
  }
  renderCurriculumSummary();
}
async function loadBundledCurriculum(profile){
  try{
    const r=await fetch('/data/curriculum.seed.json',{cache:'no-store'});
    if(!r.ok) return null;
    const data=await r.json();
    const list=Array.isArray(data.curricula)?data.curricula:[];
    const exact=pathKey(profile);
    const same=list.find(x=>x.pathKey===exact);
    if(same)return {id:same.id||`seed_${slug(exact)}`,...same,source:'bundled-seed'};
    const matches=list.filter(x=>seedCurriculumMatchesProfile(x,profile));
    return matches.sort((a,b)=>(safeNum(b.priority)-safeNum(a.priority)))[0]||null;
  }catch(e){M.warn('bundled curriculum',e);return null;}
}
function seedCurriculumMatchesProfile(c,p){
  const m=c.match||{};
  const pairs=[['system','system'],['stage','stage'],['grade','grade'],['track','track'],['university','university'],['faculty','faculty'],['department','department']];
  return pairs.every(([a,b])=>m[a]==null || String(m[a]).toLowerCase()===String(p?.[b]||'').toLowerCase());
}
function renderCurriculumSummary(){const panel=q('curriculum-tree-panel');if(!panel)return;const c=M.state.curriculum;if(!c){panel.innerHTML='<div class="mortaqa-empty">Curriculum will appear after your academic path is configured.</div>';return;}const subjects=c.subjects||c.courses||[];panel.innerHTML=`<div class="mortaqa-grid">${subjects.map(s=>`<button class="category-folder" onclick="openCurriculumDetails('${esc(s.id||s.name)}')"><i class="fas fa-book"></i><div>${esc(s.name||s.title)}</div><small>${esc((s.units||s.modules||[]).length)} units</small></button>`).join('')}</div>`;}

async function loadMaterialsContext(){await loadMaterials();}
async function loadMaterials(){
  M.state.materials=[];
  const c=col('resources');
  if(c){
    const docs=await safeGetQuery(c.where('status','in',['published','approved']).limit(300));
    M.state.materials=docs.map(d=>({id:d.id,...d.data()})).filter(resourceVisibleToUser);
  }
  if(!M.state.materials.length && c){
    const old=await safeGetQuery(col('materials'));
    M.state.materials=old.map(d=>({id:d.id,...d.data(),legacy:true})).filter(resourceVisibleToUser);
  }
  if(!M.state.materials.length && M.state.curriculum){
    M.state.materials=bundledResourcesFromCurriculum(M.state.curriculum);
  }
  renderMaterialsList('');
}
function bundledResourcesFromCurriculum(c){
  const out=[];
  const subjects=c?.subjects||c?.courses||[];
  subjects.forEach(subject=>{
    const subjectName=subject.name||subject.title||'Subject';
    (subject.units||subject.modules||[]).forEach(unit=>{
      const unitName=unit.name||unit.title||'Unit';
      (unit.topics||unit.lessons||[]).forEach(topic=>{
        const topicName=topic.name||topic.title||'Lesson';
        (topic.resources||[]).forEach(r=>out.push({...r,id:r.id||uid(),subject:subjectName,unit:unitName,topic:topicName,visibility:'public',status:'approved',bundled:true}));
      });
    });
  });
  return out;
}
function resourceMatchesProfile(r,p){
  if(!r)return false;
  const wanted=pathKey(p);
  if(r.pathKey&&wanted&&r.pathKey===wanted)return true;
  const fields=['system','stage','grade','track','institution','university','faculty','department','academicYear','semester'];
  const scoped=fields.filter(k=>r[k]!==undefined&&r[k]!==null&&String(r[k]).trim()!=='');
  return scoped.length>0&&scoped.every(k=>String(r[k]).toLowerCase()===String(p[k]??'').toLowerCase());
}
function resourceVisibleToUser(r){
  const p=M.state.profile||{};
  if(r.visibility==='group')return !!M.state.groups.find(g=>g.id===r.groupId);
  if(r.visibility==='private')return r.ownerUid===userKey();
  if(r.ownerUid===userKey())return true;
  if(r.visibility==='global')return true;
  const hasScope=!!r.pathKey||['system','stage','grade','track','institution','university','faculty','department','academicYear','semester'].some(k=>r[k]!==undefined&&r[k]!==null&&String(r[k]).trim()!=='');
  if(r.visibility==='public'||!r.visibility)return !hasScope||resourceMatchesProfile(r,p);
  return resourceMatchesProfile(r,p);
}
function filterMaterials(term){renderMaterialsList(text(term).toLowerCase());}
function renderMaterialsList(term=''){
  const tree=q('materials-folders');const grid=q('materials-files-view-grid');const empty=q('materials-files-view-empty');if(!tree&&!grid)return;
  const list=M.state.materials.filter(r=>!term||JSON.stringify(r).toLowerCase().includes(term));
  if(tree)tree.innerHTML=`<div class="mortaqa-grid">${['General','Courses','Videos','PDFs','Notes','Question Banks'].map(x=>`<button class="category-folder" onclick="openFolder('${x}')"><i class="fas fa-folder-open"></i><div>${x}</div></button>`).join('')}</div>`;
  if(grid)grid.innerHTML=list.length?list.slice(0,80).map(r=>`<div class="mortaqa-card"><div><strong>${esc(r.title||r.name||'Resource')}</strong><div class="mortaqa-muted">${esc(r.subject||r.course||r.type||'Resource')} ${r.unit?'• '+esc(r.unit):''}</div></div><div class="mortaqa-actions"><button class="mortaqa-btn primary" onclick="downloadMaterial('${esc(r.id)}')">Open</button></div></div>`).join(''):'<div class="mortaqa-empty">No resources found for your current path.</div>';
  if(empty)empty.classList.toggle('hidden',!!list.length);
}

function renderEliteDashboard(){
  const p=M.state.profile||{};const a=M.state.analytics||calculateStudentAnalytics();
  setText('dashboard-personal-message',p.aiGreeting||`Welcome back, ${profileName()}. Your workspace is ready.`);
  setText('dash-ai-insight-title','AI study insight');setText('dash-ai-insight-text',p.lastAIInsight||buildLocalInsight(a));
  setText('work-load-label',a.taskTotal?`${a.completedTasks}/${a.taskTotal} tasks`:'Ready');
  setText('partner-sync-banner','');
  const nowH=localHour();setText('dashboard-morning-status',nowH<16?'Available':'Completed');setText('dashboard-evening-status',nowH>=16?'Available':'Later');
  const pCount=Object.values(p.spiritual||{}).filter(x=>x?.done).length;setText('dashboard-prayer-count',`${pCount}/5`);setText('prayer-count-badge',pCount);
  setText('current-user-name',profileName());setText('header-score',a.totalPoints.toLocaleString());
  renderTaskList();renderGroupContext();
}
function buildLocalInsight(a){
  if(!a.taskTotal&&!(M.state.attempts||[]).length)return 'Start one focused session and one assessment. Mortaqa will build your baseline as you study.';
  if(a.accuracy<.6)return 'Your recent assessment accuracy is still developing. Use the AI explanation after each mistake, then revisit the same topic with a short quiz.';
  if(a.velocity>15)return 'Your activity is trending upward. Protect your focus blocks and avoid adding more tasks than you can finish.';
  if(a.consistency<50)return 'Consistency is your biggest lever right now. A small daily session is more valuable than occasional long sessions.';
  return 'Your study pattern is stable. Keep reviewing weak topics and use spaced repetition to convert progress into retention.';
}

root.MortaqaCore=M;

})();

// -------------------- FINAL MORTAQA 5.2 OVERRIDES --------------------
(function MortaqaFinal(){
  const root=window;
  const M=MORTAQA_ELITE;
  // Secure legacy provider compatibility: silently attach the Firebase ID token to client calls
  // that still use the old OpenAI-compatible proxy path. The provider secret never reaches the browser.
  if(!root.__mortaqaFetchPatched){
    const nativeFetch=root.fetch.bind(root); root.__mortaqaFetchPatched=true;
    root.fetch=async function(input,init={}){
      const url=typeof input==='string'?input:(input?.url||'');
      if(url.includes('/api/ai-proxy') && !((init.headers||{})['Authorization'] || (init.headers||{})['authorization'])){
        try{const a=auth();const user=a?.currentUser;if(user){const token=await user.getIdToken();const headers=new Headers(init.headers||{});headers.set('Authorization',`Bearer ${token}`);init={...init,headers};}}catch(e){}
      }
      return nativeFetch(input,init);
    };
  }
  let catalogPromise=null;
  const catalog={types:[],institutionsByType:{},faculties:[]};
  const SCHOOL_OPTIONS=[
    {v:'public-general',l:'Public / General School'},
    {v:'language-school',l:'Language School'},
    {v:'STEM-school',l:'STEM School'},
    {v:'technical-school',l:'Technical / Industrial / Agricultural'},
    {v:'other-school',l:'Other School Type'}
  ];
  async function loadCatalog(){
    if(catalogPromise)return catalogPromise;
    catalogPromise=Promise.all([
      fetch('/data/institution_catalog.json',{cache:'no-store'}).then(r=>r.ok?r.json():null),
      fetch('/data/faculty_catalog.json',{cache:'no-store'}).then(r=>r.ok?r.json():null)
    ]).then(([i,f])=>{
      catalog.types=i?.types||[]; catalog.types.forEach(t=>catalog.institutionsByType[t.id]=t.institutions||[]);
      catalog.faculties=f?.faculties||f||[];
      return catalog;
    }).catch(e=>{M.warn('catalog',e);return catalog;});
    return catalogPromise;
  }
  root.loadMortaqaCatalog=loadCatalog;
  function activeSystem(){return wizard.data.system||'';}
  function isUniversity(){return activeSystem()==='university';}
  function universityTypeOptions(){return catalog.types.filter(t=>!['government_academy'].includes(t.id)).map(t=>({v:t.id,l:t.label}));}
  function institutionOptions(){
    const type=wizard.data.universityType;
    return (catalog.institutionsByType[type]||[]).map(x=>({v:x.id,l:x.name,meta:x}));
  }
  function facultyOptions(){
    const list=Array.isArray(catalog.faculties)?catalog.faculties:[];
    return list.map(f=>({v:f.id,l:f.name,meta:f}));
  }
  function departmentOptions(){
    const f=facultyOptions().find(x=>x.v===wizard.data.facultyId)?.meta;
    if(Array.isArray(f?.departments))return f.departments.map(d=>({v:d.id,l:d.name,meta:d}));
    if(f?.id==='engineering') return ['civil','architecture','mechanical','electrical','computer-software','mechatronics-robotics','aerospace','biomedical','industrial-management','petroleum-mining-metals','chemical'].map(v=>({v,l:v.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}));
    if(f?.id==='pharmacy') return ['pharmd-general','pharmd-clinical'].map(v=>({v,l:v==='pharmd-general'?'PharmD General':'PharmD Clinical'}));
    if(f?.id==='computer-science') return ['computer-science','software-engineering','artificial-intelligence','cybersecurity','cloud-computing','computer-vision','bioinformatics','game-development','business-analytics'].map(v=>({v,l:v.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}));
    return [];
  }
  function stepDefs(){
    return [
      wizardStep('name','What should we call you?','اسم العرض الذي سيظهر في Mortaqa.','text'),
      wizardStep('email','Your email','البريد الإلكتروني للحساب والاسترجاع.','email'),
      wizardStep('password','Create a password','8 أحرف على الأقل. كلمة المرور لا تُخزّن في Firestore.','password'),
      wizardStep('system','What are you studying?','اختيار واحد يحدد شجرة الأسئلة بالكامل.','choice',[{v:'prep',l:'Middle School'},{v:'secondary_ar',l:'General Secondary — Arabic'},{v:'secondary_lang',l:'General Secondary — Languages'},{v:'igcse',l:'IGCSE'},{v:'american',l:'American Diploma'},{v:'stem',l:'STEM'},{v:'technical',l:'Technical / Agricultural'},{v:'university',l:'University / Institute'}]),
      wizardStep('grade','Current grade / year','اختار السنة الدراسية الحالية.','dynamic'),
      wizardStep('track','Track / specialization','يظهر فقط عندما يكون للمسار تشعب فعلي.','dynamic'),
      wizardStep('universityType','Institution type','نوع الجامعة/المؤسسة.','choiceDynamic'),
      wizardStep('institution','Choose your university / institution','اختيار من الكتالوج — لا يوجد إدخال حر.','choiceDynamic'),
      wizardStep('schoolType','School type','اختيار من أنواع المدارس المتاحة في المنصة.','choice',SCHOOL_OPTIONS),
      wizardStep('facultyId','Choose your faculty','نستخدم كتالوج القطاعات المتاح، والمحتوى المؤسسي الدقيق يمكن للإدارة اعتماده لاحقًا.','choiceDynamic'),
      wizardStep('department','Department / program','اختيار تخصص مسموح حسب الكلية عندما يكون متاحًا.','choiceDynamic'),
      wizardStep('academicYear','Academic year','مثال: 2026-2027','text'),
      wizardStep('semester','Semester / term','حدد الفصل الحالي.','choice',[{v:'fall',l:'Fall'},{v:'spring',l:'Spring'},{v:'summer',l:'Summer'}]),
      wizardStep('goal','Main goal','الهدف الرئيسي الذي سيستخدمه محرك التوصيات.','choice',[{v:'grades',l:'Improve grades'},{v:'consistency',l:'Build consistency'},{v:'exam',l:'Prepare for exams'},{v:'skills',l:'Build skills'},{v:'projects',l:'Finish projects'}]),
      wizardStep('learning','Learning preference','تخصيص العرض وليس تشخيصًا طبيًا.','choice',[{v:'visual',l:'Visual'},{v:'reading',l:'Reading / Notes'},{v:'practice',l:'Practice first'},{v:'mixed',l:'A mix'}]),
      wizardStep('focus','Study focus','شكل جلسات المذاكرة المفضل حاليًا.','choice',[{v:'short',l:'Short focused blocks'},{v:'medium',l:'25–45 min blocks'},{v:'deep',l:'60–90 min deep work'},{v:'variable',l:'Variable'}]),
      wizardStep('wake','Usual wake-up time','يُستخدم لبناء Schedule واقعي.','time'),
      wizardStep('hours','Available study time','عدد الساعات التقريبي يوميًا.','number'),
      wizardStep('finish','Your Mortaqa profile is ready','راجع المسار قبل إنشاء الحساب.','review')
    ];
  }
  function applicable(step){
    const s=activeSystem();
    if(step.id==='track') return ['secondary_ar','secondary_lang','igcse','american','stem'].includes(s);
    if(step.id==='universityType'||step.id==='institution') return s==='university';
    if(step.id==='schoolType') return s!=='university';
    if(step.id==='facultyId'||step.id==='department') return s==='university';
    return true;
  }
  function dynamicOptions(step){
    const d=wizard.data,s=d.system;
    if(step.id==='grade'){
      if(s==='stem')return ['Grade 10','Grade 11','Grade 12'];
      if(s==='igcse')return ['Year 10','Year 11','Year 12'];
      if(s==='american')return ['Grade 9','Grade 10','Grade 11','Grade 12'];
      if(s==='university')return ['Year 1','Year 2','Year 3','Year 4','Year 5','Internship'];
      if(s==='prep')return ['Prep 1','Prep 2','Prep 3'];
      if(s==='secondary_ar'||s==='secondary_lang')return ['Grade 10','Grade 11','Grade 12'];
      if(s==='technical')return ['Year 1','Year 2','Year 3','Year 4','Year 5'];
      return [];
    }
    if(step.id==='track'){
      if(s==='secondary_ar'||s==='secondary_lang'){
        if(d.grade==='Grade 10')return ['General / New System'];
        if(d.grade==='Grade 11')return ['Science','Literary'];
        if(d.grade==='Grade 12')return ['Science','Science — Mathematics','Literary'];
      }
      if(s==='stem'&&d.grade==='Grade 12')return ['Science Group','Mathematics Group'];
      if(s==='igcse'||s==='american')return ['Medical','Engineering','Theoretical'];
      return [];
    }
    return [];
  }
  function optionsFor(step){
    if(step.id==='universityType') return universityTypeOptions();
    if(step.id==='institution') return institutionOptions();
    if(step.id==='facultyId') return facultyOptions();
    if(step.id==='department') return departmentOptions();
    if(step.type==='choice') return step.options||[];
    return dynamicOptions(step).map(v=>({v,l:v}));
  }
  function visibleSteps(){return wizard.steps.filter(applicable);}
  function setProgress(){
    const steps=visibleSteps(), current=steps.indexOf(wizard.steps[wizard.index]); const pct=steps.length<=1?100:((current+1)/steps.length)*100;
    const bar=q('wizard-progress');if(bar)bar.style.width=`${Math.max(3,Math.min(100,pct))}%`;
    setText('wizard-progress-label',`${current+1} / ${steps.length}`);
  }
  function moveIndex(delta){
    let i=wizard.index+delta, guard=0;while(i>=0&&i<wizard.steps.length&&!applicable(wizard.steps[i])&&guard++<30)i+=delta;return Math.max(0,Math.min(wizard.steps.length-1,i));
  }
  function fieldPlaceholder(id){const d=wizard.data;if(id==='academicYear')return'2026-2027'; if(id==='hours')return'2'; if(id==='institution')return d.universityType?'اختيار الجامعة':'اختيار المدرسة';return'';}
  function pathLabel(){
    const d=wizard.data;return [d.system,d.grade,d.track,d.institutionName,d.facultyName,d.departmentName,d.academicYear,d.semester].filter(Boolean).join(' • ');
  }
  function render(){
    const st=wizard.steps[wizard.index]; if(!st||!q('wizard-content-area'))return; setProgress();
    const current=wizard.data[st.id]||''; let body='';
    if(st.type==='choice'||st.type==='dynamic'||st.type==='choiceDynamic'){
      const opts=optionsFor(st);
      if(!opts.length) body='<div class="mortaqa-empty">No options are available for this path yet. Back up and choose a different branch.</div>';
      else body=`<div class="mortaqa-grid">${opts.map(o=>`<button type="button" class="category-folder ${current===o.v?'border-magenta':''}" data-final-choice="${esc(o.v)}"><i class="fas ${st.id==='institution'?'fa-building-columns':st.id==='facultyId'?'fa-graduation-cap':st.id==='department'?'fa-sitemap':'fa-circle-check'}"></i><div>${esc(o.l)}</div></button>`).join('')}</div>`;
    }else if(st.type==='review'){
      body=`<div class="mortaqa-card"><div class="mortaqa-chip">READY TO PERSONALIZE</div><h3>${esc(wizard.data.name||'Student')}</h3><p class="mortaqa-muted">${esc(pathLabel()||'Academic path not fully selected')}</p><div class="mortaqa-list"><div class="mortaqa-list-row"><span>Goal</span><strong>${esc(wizard.data.goal||'')}</strong></div><div class="mortaqa-list-row"><span>Learning</span><strong>${esc(wizard.data.learning||'')}</strong></div><div class="mortaqa-list-row"><span>Focus</span><strong>${esc(wizard.data.focus||'')}</strong></div></div></div>`;
    }else{
      const type=st.type==='email'?'email':st.type==='password'?'password':st.type==='time'?'time':st.type==='number'?'number':'text';
      body=`<input id="wizard-value" class="input-dark" type="${type}" value="${esc(current)}" placeholder="${esc(fieldPlaceholder(st.id))}" autocomplete="off" ${type==='number'?'min="0.5" max="16" step="0.5"':''} ${type==='email'?'dir="ltr" style="text-align:left"':''}>`;
    }
    const title = st.id==='institution' && isUniversity() ? 'Choose your university / institution' : st.title;
    q('wizard-content-area').innerHTML=`<div class="mortaqa-card"><div class="mortaqa-chip">MORTAQA SETUP</div><h2 style="margin-top:10px">${esc(title)}</h2><p class="mortaqa-muted">${esc(st.subtitle)}</p><div style="margin-top:20px">${body}</div></div>`;
    qsa('[data-final-choice]').forEach(btn=>btn.addEventListener('click',()=>{
      const value=btn.dataset.finalChoice; wizard.data[st.id]=value;
      if(st.id==='universityType'){const meta=(catalog.institutionsByType[value]||[]); wizard.data.institution='';wizard.data.institutionName='';wizard.data.facultyId='';wizard.data.facultyName='';wizard.data.department='';wizard.data.departmentName='';if(!meta.length){toast('القائمة فارغة حاليًا.','error');return;} }
      if(st.id==='institution'){const meta=institutionOptions().find(x=>x.v===value)?.meta;wizard.data.institutionId=value;wizard.data.institutionName=meta?.name||'';wizard.data.university=value;}
      if(st.id==='facultyId'){const meta=facultyOptions().find(x=>x.v===value)?.meta;wizard.data.facultyId=value;wizard.data.facultyName=meta?.name||'';wizard.data.department='';wizard.data.departmentName='';}
      if(st.id==='department'){const meta=departmentOptions().find(x=>x.v===value)?.meta;wizard.data.department=value;wizard.data.departmentName=meta?.name||value;}
      if(st.id==='schoolType') wizard.data.institutionName=btn.textContent.trim();
      if(st.id==='system'){
        Object.assign(wizard.data,{grade:'',track:'',universityType:'',institution:'',institutionId:'',institutionName:'',university:'',facultyId:'',facultyName:'',faculty:'',department:'',departmentName:'',schoolType:'',academicYear:'',semester:''});
      }
      if(st.id==='grade')wizard.data.track='';
      render();
    }));
    const prev=q('wizard-btn-prev'),next=q('wizard-btn-next'),submit=q('wizard-btn-submit');
    if(prev)prev.classList.toggle('hidden',wizard.index===0);if(next)next.classList.toggle('hidden',st.type==='review');if(submit)submit.classList.toggle('hidden',st.type!=='review');
  }
  function readInput(){const st=wizard.steps[wizard.index],el=q('wizard-value');if(!el)return;wizard.data[st.id]=el.value.trim();}
  function validateStep(){
    const st=wizard.steps[wizard.index],d=wizard.data;
    if(st.type==='text'||st.type==='email'||st.type==='password'||st.type==='time'||st.type==='number')readInput();
    if(st.id==='name'&&(d.name||'').length<2){toast('اكتب اسمًا صالحًا.','error');return false;}
    if(st.id==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email||'')){toast('اكتب بريدًا إلكترونيًا صحيحًا.','error');return false;}
    if(st.id==='password'&&(d.password||'').length<8){toast('كلمة المرور يجب أن تكون 8 أحرف على الأقل.','error');return false;}
    if(['grade','system','track','universityType','institution','schoolType','facultyId','department','semester','goal','learning','focus'].includes(st.id)&&!d[st.id]){toast('اختار إجابة قبل المتابعة.','error');return false;}
    if(st.id==='institution'&&!d.institutionId)return false;
    if(st.id==='academicYear'&&!/^\d{4}-\d{4}$/.test(d.academicYear||'')){toast('اكتب السنة بصيغة 2026-2027.','error');return false;}
    return true;
  }
  root.startWizard=async function(){await loadCatalog();wizard={steps:stepDefs(),index:0,data:{}};hide('login-choice-screen');hide('login-panel');show('wizard-screen');render();q('wizard-content-area')?.scrollTo({top:0,behavior:'smooth'});};
  root.nextWizardStep=function(){if(!validateStep())return;wizard.index=moveIndex(1);render();q('wizard-content-area')?.scrollTo({top:0,behavior:'smooth'});};
  root.prevWizardStep=function(){readInput();wizard.index=moveIndex(-1);render();q('wizard-content-area')?.scrollTo({top:0,behavior:'smooth'});};
  root.backToMainChoice=function(){hide('login-panel');hide('wizard-screen');show('login-choice-screen');};
  root.showLoginPanel=function(){hide('login-choice-screen');show('login-panel');q('login-username')?.focus();};
  root.processLogin=async function(){
    const email=cleanEmail(q('login-username')?.value),pass=q('login-pin')?.value||'';if(!email||!pass)return toast('اكتب البريد وكلمة المرور.','error');
    const a=auth();if(!a)return toast('Firebase Authentication غير متصل. ضع Web App config الجديد أولًا.','error');
    try{await a.signInWithEmailAndPassword(email,pass);await hydrateUser(a.currentUser);hide('login-choice-screen');show('app-screen');switchTab('view-dashboard');toast('Welcome back to Mortaqa.','success');}
    catch(e){M.warn('login',e);toast(e?.code==='auth/invalid-credential'?'البريد أو كلمة المرور غير صحيحة.':'تعذر تسجيل الدخول الآن.','error');}
  };
  root.submitRegistration=async function(){
    if(!validateStep()) return;
    const d=wizard.data,a=auth();if(!a)return toast('Firebase Authentication غير متصل. ضع Web App config الجديد.','error');
    const uidPromise=loadCatalog();await uidPromise;
    try{
      const cred=await a.createUserWithEmailAndPassword(cleanEmail(d.email),d.password);
      const profile={uid:cred.user.uid,email:cleanEmail(d.email),name:d.name,displayName:d.name,username:`${slug(d.name)}-${cred.user.uid.slice(0,6)}`,system:d.system,stage:d.system,grade:d.grade,track:d.track||'',universityType:d.universityType||'',institutionId:d.institutionId||'',institution:d.institutionId||'',institutionName:d.institutionName||'',university:d.university||'',facultyId:d.facultyId||'',faculty:d.facultyName||'',departmentId:d.department||'',department:d.departmentName||d.department||'',schoolType:d.schoolType||'',academicYear:d.academicYear||'2026-2027',semester:d.semester||'fall',goal:d.goal,learningPreference:d.learning,focusPreference:d.focus,wakeTime:d.wake,availableHours:safeNum(d.hours,2),examLanguage:defaultExamLanguage(d),academicPathKey:'',createdAt:timestampNow(),updatedAt:timestampNow()};
      profile.academicPathKey=pathKey(profile);
      await setDoc(`users/${cred.user.uid}`,profile,true);
      await addPointEvent({points:25,kind:'onboarding',sourceType:'system',sourceId:'onboarding',reason:'Profile created',visibility:'private'});
      await hydrateUser(cred.user);hide('wizard-screen');show('app-screen');switchTab('view-dashboard');toast('ملفك جاهز — Mortaqa جهزت تجربتك حسب مسارك.','success');
    }catch(e){M.err(e);toast(e?.code==='auth/email-already-in-use'?'البريد مستخدم بالفعل.':'تعذر إنشاء الحساب.','error');}
  };
  async function discoverModels(){
    try{const a=auth(),token=a?.currentUser?await a.currentUser.getIdToken():'';const h=token?{Authorization:`Bearer ${token}`}:{};const r=await fetch(M.config.modelsEndpoint,{headers:h});if(!r.ok)throw new Error('models');return (await r.json()).data||[];}catch(e){M.warn('models',e);return[];}
  }
  root.getMortaqaModels=discoverModels;
  root.populateAIModelSelect=async function(){
    const sel=document.getElementById('ai-model-select'); if(!sel)return;
    const rows=await discoverModels(); const current=sel.value||'auto';
    sel.innerHTML='<option value="auto">Auto — Mortaqa selects by capability</option>'+rows.map(m=>{const id=m.id||m.name||m.model||'';return `<option value="${esc(id)}">${esc(id)}${Array.isArray(m.capabilities)?' • '+esc(m.capabilities.slice(0,3).join(', ')):''}</option>`;}).join('');
    sel.value=rows.some(m=>(m.id||m.name||m.model)===current)?current:'auto';
  };
  root.openModelDiagnostics=async function(){const rows=await discoverModels();toast(rows.length?`${rows.length} CodeCraft models are available.`:'No model catalog yet.','info');await root.populateAIModelSelect?.();return rows;};
  setTimeout(()=>root.populateAIModelSelect?.(),1500);
  root.requestMissingCurriculum=async function(reason=''){const p=M.state.profile;if(!userKey()||!p)return;try{await addDoc('curriculumRequests',{ownerUid:userKey(),pathKey:pathKey(p),academicPath:academicPath(p),reason:reason||'Missing curriculum',status:'pending',createdAt:timestampNow()});await audit('curriculum.request',{pathKey:pathKey(p)});toast('تم إرسال طلب إضافة المنهج للمراجعة.','success');}catch(e){toast('تعذر إرسال الطلب.','error');}};
  // Strict curriculum loader: no cross-education fallback.
  const originalLoad=window.loadCurriculumForStudent;
  root.loadCurriculumForStudent=async function(){
    const p=M.state.profile;if(!p){M.state.curriculum=null;return null;}const key=pathKey(p);let found=null;
    const c=col('curricula');
    if(c){const docs=await safeGetQuery(c.where('pathKey','==',key).where('active','==',true).limit(1));if(docs.length)found={id:docs[0].id,...docs[0].data()};}
    if(!found){const bundle=await loadBundledExact(p);found=bundle;}
    M.state.curriculum=found||null;renderCurriculumSummary();
    if(!found && p.system==='university')setText('curriculum-missing-note','This exact university/year curriculum is not published yet.');
    return found;
  };
  async function loadBundledExact(p){try{const r=await fetch('/data/curriculum.seed.json');if(!r.ok)return null;const d=await r.json();const key=pathKey(p);return (d.curricula||[]).filter(x=>x.active!==false&&x.pathKey===key).sort((a,b)=>(b.priority||0)-(a.priority||0))[0]||null;}catch{return null;}}
  // Resource guard: exact path match for scoped resources, global is the only deliberate cross-path scope.
  root.resourceVisibleToUser=function(r){
    const p=M.state.profile||{};if(r.visibility==='private')return r.ownerUid===userKey();if(r.visibility==='group')return !!M.state.groups.find(g=>g.id===r.groupId);if(r.visibility==='global')return true;if(r.ownerUid===userKey())return true;
    if(r.pathKey)return r.pathKey===pathKey(p);const keys=['system','stage','grade','track','institutionId','universityType','institution','university','facultyId','faculty','departmentId','department','academicYear','semester'];const scoped=keys.filter(k=>r[k]!==undefined&&r[k]!==null&&String(r[k]).trim()!=='');return scoped.length===0||scoped.every(k=>String(r[k]).toLowerCase()===String(p[k]??'').toLowerCase());
  };
  // Secure legacy AI calls: old UI payloads are forwarded to /api/ai-proxy, never directly to provider.
  root.MortaqaLegacyAIEndpoint='/api/ai-proxy';
  // Firebase Storage is optional until billing/storage is enabled; external links remain first-class.
  root.hasStorage=function(){return !!storage;};
  root.publishExternalResource=async function(data){if(!userKey())return toast('سجل الدخول أولًا.','error');const r={...data,ownerUid:userKey(),pathKey:pathKey(),status:'pending',visibility:data.visibility||'public',createdAt:timestampNow()};try{const ref=await addDoc('resources',r);toast('المصدر أُرسل للمراجعة.','success');return ref.id;}catch(e){toast('تعذر حفظ المصدر.','error');return null;}};
  root.renderCatalogSummary=function(){return {types:catalog.types.map(t=>({id:t.id,label:t.label,count:(t.institutions||[]).length})),facultyCount:catalog.faculties.length};};
})();

// -------------------- FINAL UI ALIASES --------------------
(function(){
  const root=window;
  root.closeChallengeModal=function(){document.getElementById('challenge-modal')?.classList.add('hidden');};
  root.openFlashcardCreator=function(){switchTab('view-flashcards');call('toggleFlashcardCreator');};
  root.submitFlashcardQuiz=root.submitFCQuiz;
  root.cloneExamFromAnalysis=root.generateCloneExam;
  root.makeWeaknessCards=root.saveWeaknessesAsCards;
})();
