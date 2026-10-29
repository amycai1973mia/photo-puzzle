// Firestore 集合脚手架：users / progress / levels（结构可再调整）
import { getDb, getFs, isFirebaseConfigured } from './firebase-app.js';
export const COL = { users: 'users', progress: 'progress', levels: 'levels' };
const guard = () => { if (!isFirebaseConfigured()) throw new Error('请先填写 firebase-config.js'); };

// users/{uid}: { uid, email, displayName, locale, createdAt, updatedAt, guestPuzzlesUsed? }
export async function upsertUser(uid, data = {}) {
  guard(); const db = await getDb(), f = await getFs();
  const ref = f.doc(db, COL.users, uid);
  const snap = await f.getDoc(ref);
  const base = { uid, locale: 'zh-CN', ...data, updatedAt: f.serverTimestamp() };
  if (!snap.exists()) base.createdAt = f.serverTimestamp();
  await f.setDoc(ref, base, { merge: true });
  return uid;
}
// progress/{userId}_{puzzleId}: { userId, puzzleId, n, pos, correct, playMs, updatedAt }
export const progressId = (userId, puzzleId) => `${userId}_${puzzleId}`;
export async function saveProgress(userId, puzzleId, data = {}) {
  guard(); const db = await getDb(), f = await getFs();
  await f.setDoc(f.doc(db, COL.progress, progressId(userId, puzzleId)),
    { userId, puzzleId, ...data, updatedAt: f.serverTimestamp() }, { merge: true });
}
export async function loadProgress(userId, puzzleId) {
  guard(); const db = await getDb(), f = await getFs();
  if (puzzleId) { const s = await f.getDoc(f.doc(db, COL.progress, progressId(userId, puzzleId))); return s.exists() ? s.data() : null; }
  const q = f.query(f.collection(db, COL.progress), f.where('userId', '==', userId));
  return (await f.getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
}
// levels/{id}: { id, name, grid:{rows,cols}, order, ... }
export async function listLevels() {
  guard(); const db = await getDb(), f = await getFs();
  const q = f.query(f.collection(db, COL.levels), f.orderBy('order'));
  return (await f.getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
}
// 以后：deleteAllUserData(uid) —— 删除照片（Storage）+ progress + users 文档，再 deleteUser
