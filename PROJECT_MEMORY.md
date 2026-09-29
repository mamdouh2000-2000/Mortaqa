# Mortaqa 5.2 — Source of Truth

Vision: Personalized Learning OS for Egyptian school and university students.

Core modules: Auth, Adaptive Onboarding, Curriculum Engine, Materials, Tasks/Points, Schedule/Focus, Projects, Exams, Competitions, Leaderboard, Analytics, Study Buddy/Groups/Chat, Flashcards, AI Tutor/Mentor/Analyzer, Spiritual/Prayer/Adhkar, Admin Center, Research/Moderation, Entertainment Arcade, History/Time Machine.

Design: Premium dark navy glass system using cyan/amber/violet accents, responsive across phone/tablet/laptop.

Security: Firebase Auth + Firestore Rules + Storage Rules; server-side CodeCraft key only; Admin roles via custom claims.

Data rule: student path controls visibility. Never use a generic curriculum fallback across academic systems/universities.

Academic sources: user-supplied curriculum architecture + current 2026 Ministry/SIS institution lists.

Known data boundary: the supplied DOCX provides institution categories and sector-level faculty/department structures, but not every institution's complete faculty catalog. Do not invent missing institution-specific offerings; add verified packs later.
