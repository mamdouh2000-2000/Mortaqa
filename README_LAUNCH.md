# Mortaqa 5.2 — Final Launch Pack

## What is included
- Responsive premium UI: index.html + style.css
- Main client engine: script.js
- Public runtime config: mortaqa-config.js
- Firebase Firestore/Auth rules + indexes
- CodeCraft secure AI gateway (server-side key only)
- Model discovery endpoint `/api/models`
- Secure compatibility proxy `/api/ai-proxy` for legacy AI UI calls
- AI endpoints: `/api/ai`, `/api/research`, `/api/points`, `/api/embeddings`, `/api/models`, `/api/ai-proxy`
- Current 2026 Egyptian higher-education institution catalog
- Curriculum seed + exact Foundation 1 blueprint provided in the project materials
- PWA service worker + manifest
- Seeding/bootstrap scripts

## Required secrets
Put secrets in Vercel Environment Variables only. Never put CodeCraft keys or Firebase Admin keys in `script.js`, HTML, CSS, GitHub, or client config.

Required server vars: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `ADMIN_EMAILS`, `CODECRAFT_API_KEY`, `CODECRAFT_BASE_URL`.

Optional model IDs: `CODECRAFT_MODEL_GENERAL`, `CODECRAFT_MODEL_FAST`, `CODECRAFT_MODEL_REASONING`, `CODECRAFT_MODEL_VISION`, `CODECRAFT_MODEL_RESEARCH`. The app can discover available models from CodeCraft `/v1/models` and route by capability.

## Firebase
Create a new Firebase project for production. Enable Authentication (Email/Password) and Firestore. Storage is optional; external materials links work without it. Do not delete the old legacy project until migration/testing is complete.

## Admins
The two intended super-admin emails are configured as: `mmdwhrdwan82@gmail.com` and `smha13334@gmail.com`. They still need to exist in Firebase Auth before running `npm run bootstrap-admins`.

## Curriculum behavior
Curriculum and resources are strict-path scoped. A student only receives a curriculum or resource matching their academicPathKey, unless a resource is explicitly marked `global` or belongs to an allowed group. There is no generic cross-university fallback.

## Important catalog limitation
The supplied academic architecture document contains a sector-level faculty/department taxonomy but does not enumerate every faculty offered by every Egyptian institution. This final pack therefore does **not** fabricate institution-specific faculty lists. The verified institution catalog is complete for the source enumeration; institution-specific faculty/curriculum packs can be added in Firestore/Admin later.

## CodeCraft key rotation
The API key shared in the conversation must be revoked/rotated because it was exposed in chat history. Create a fresh key and place only the fresh value in Vercel.
