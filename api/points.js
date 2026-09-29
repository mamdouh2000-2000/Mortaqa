'use strict';
const { requireAuth, requireRole } = require('./_lib/auth');
const { getFirestore, admin } = require('./_lib/firebase-admin');

const ALLOWED_KINDS = new Set(['onboarding','task','focus','exam','competition','project','flashcard','spiritual','adhkar','entertainment','penalty','activity']);
const ALLOWED_SOURCE_TYPES = new Set(['system','task','focus','exam','competition','project','flashcard','spiritual','adhkar','arcade','admin','curriculum']);

async function alreadyIssued(db, uid, sourceId) {
  if (!sourceId) return false;
  const snap = await db.collection('pointEvents').where('userUid','==',uid).where('sourceId','==',sourceId).limit(1).get();
  return !snap.empty;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const decoded = await requireAuth(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const db = getFirestore();
    const kind = String(body.kind || 'activity');
    const sourceType = String(body.sourceType || kind);
    const reason = String(body.reason || '').slice(0, 500);
    const sourceId = String(body.sourceId || '').slice(0, 200);
    const visibility = ['private','group','public'].includes(body.visibility) ? body.visibility : 'private';
    const date = new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo'}).format(new Date());
    let points = Number(body.points);
    if (!Number.isFinite(points) || !ALLOWED_KINDS.has(kind) || !ALLOWED_SOURCE_TYPES.has(sourceType)) return res.status(400).json({ error: 'Invalid point event.' });
    if (kind === 'onboarding') sourceId = sourceId || 'onboarding';
    if (sourceType === 'adhkar') sourceId = sourceId || `adhkar:${date}:${String(body.meta?.period || 'unknown')}`;
    if (kind !== 'penalty' && points < 0) return res.status(400).json({ error: 'Positive points required.' });
    if (kind === 'penalty') points = -Math.abs(points);

    // Source-aware caps and verification.
    if (sourceType === 'task' && sourceId) {
      const snap = await db.doc(`tasks/${sourceId}`).get();
      if (!snap.exists) return res.status(400).json({ error: 'Task not found.' });
      const task = snap.data();
      const visible = task.ownerUid === decoded.uid || task.ownerUid === decoded.uid || (task.memberUids || []).includes(decoded.uid);
      if (!visible) return res.status(403).json({ error: 'You do not have access to this task.' });
      const claimed = Number(task.points);
      if (Number.isFinite(claimed) && claimed >= 0) points = Math.min(500, Math.round(claimed));
    }
    if (sourceType === 'project' && sourceId) {
      const snap = await db.doc(`projects/${sourceId}`).get();
      if (!snap.exists) return res.status(400).json({ error: 'Project not found.' });
      const project = snap.data();
      if (!(project.members || []).includes(decoded.uid)) return res.status(403).json({ error: 'You do not belong to this project.' });
      if (project.status !== 'done') return res.status(400).json({ error: 'Project is not complete yet.' });
      points = 500;
    }
    if (sourceType === 'focus' || sourceType === 'arcade') points = Math.min(points, sourceType === 'focus' ? 400 : 10);
    if (sourceType === 'adhkar' || kind === 'spiritual') points = Math.min(points, 1000);
    if (kind === 'competition') points = Math.min(points, 1000);
    if (kind === 'onboarding') points = Math.min(points, 25);
    if (kind === 'penalty' && !['super_admin','content_admin','moderator'].includes(decoded.role || '')) return res.status(403).json({ error: 'Only authorized staff can issue penalties.' });

    if (await alreadyIssued(db, decoded.uid, sourceId)) return res.status(409).json({ error: 'This point event has already been issued.' });

    const ref = db.collection('pointEvents').doc();
    const event = {
      userUid: decoded.uid,
      points,
      kind,
      sourceType,
      sourceId,
      reason,
      visibility,
      meta: body.meta && typeof body.meta === 'object' ? body.meta : {},
      date,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await ref.set(event);
    return res.status(200).json({ ok:true, data:{ id:ref.id, ...event, createdAt:new Date().toISOString() } });
  } catch (err) {
    const status = Number(err.status) || 500;
    console.error('[Mortaqa Points]', err);
    return res.status(status).json({ ok:false, error:err.message || 'Points request failed.' });
  }
};
