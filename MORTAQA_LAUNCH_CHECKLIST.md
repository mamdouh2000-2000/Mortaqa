# Mortaqa 5.2 — Launch Checklist

## 1. Firebase Production
- [ ] Create a **new** Firebase project for Mortaqa production. Keep the legacy `stem-battle` project as backup until migration is complete.
- [ ] Enable Authentication → Email/Password.
- [ ] Create Firestore Database.
- [ ] Storage is optional for launch; external resource URLs remain supported.
- [ ] Add the new Firebase Web App config to `mortaqa-config.js` (client-safe config only).
- [ ] Add Firebase Admin service-account values to Vercel Environment Variables only.
- [ ] Deploy `firestore.rules` and `firestore.indexes.json`.

## 2. Admins
- [ ] Create `mmdwhrdwan82@gmail.com` in Firebase Auth.
- [ ] Create `smha13334@gmail.com` in Firebase Auth.
- [ ] Set `ADMIN_EMAILS=mmdwhrdwan82@gmail.com,smha13334@gmail.com` on the server.
- [ ] Run `npm run bootstrap-admins`.
- [ ] Both admins sign out/in once so their refreshed ID token carries the `super_admin` claim.

## 3. CodeCraft AI
- [ ] Revoke/rotate any API key that was exposed in chat history.
- [ ] Put the fresh key in Vercel as `CODECRAFT_API_KEY`.
- [ ] Set `CODECRAFT_BASE_URL=https://codecraftapi.com/v1`.
- [ ] Optional: pin model IDs in `CODECRAFT_MODEL_*`; otherwise Mortaqa auto-selects from `/v1/models`.
- [ ] Test `/api/health`, `/api/models`, `/api/ai`.

## 4. Data
- [ ] Run `npm run seed`.
- [ ] Verify the current 2026 institution catalog appears as choices.
- [ ] Verify Monufia National Medicine Foundation 1 exact path loads its supplied structure.
- [ ] Add verified university-specific curriculum packs before publishing them as exact academic content.
- [ ] Review AI-researched resources before publication.

## 5. Product QA
- [ ] School student never receives university curriculum.
- [ ] University student only receives exact institution/year/term curriculum when published.
- [ ] Public / group / private exam visibility works.
- [ ] Point events issue once per source event.
- [ ] Group membership capped at 20.
- [ ] Tablet / laptop / mobile onboarding scroll works.
- [ ] AI image/PDF/tutor paths work after provider credentials are configured.
- [ ] Admin-only research and competition pages are blocked for non-admins.
- [ ] Add Firebase App Check before broad public rollout.
