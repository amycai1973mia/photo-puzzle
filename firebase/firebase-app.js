// Firebase 初始化模块（模块化 SDK v10，gstatic CDN ESM，无需打包工具）
// 主游戏以后用：import { isFirebaseConfigured, getDb } from './firebase/firebase-app.js';
import { firebaseConfig } from './firebase-config.js';
const V = '10.12.2';
const CDN = `https://www.gstatic.com/firebasejs/${V}`;

export function isFirebaseConfigured(cfg = firebaseConfig) {
  const req = ['apiKey','authDomain','projectId','appId'];
  return req.every(k => typeof cfg[k] === 'string' && cfg[k] && !cfg[k].startsWith('YOUR_'));
}

let _app, _db, _auth, _mods;
async function mods() {
  if (!_mods) {
    const [app, fs, auth] = await Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-firestore.js`),
      import(`${CDN}/firebase-auth.js`)
    ]);
    _mods = { app, fs, auth };
  }
  return _mods;
}
function notConfigured() { return new Error('请先填写 firebase-config.js（Firebase 尚未配置）'); }

export async function getFirebaseApp() {
  if (!isFirebaseConfigured()) throw notConfigured();
  if (!_app) { const { app } = await mods(); _app = app.getApps()[0] || app.initializeApp(firebaseConfig); }
  return _app;
}
export async function getDb() {
  if (!_db) { const a = await getFirebaseApp(); _db = (await mods()).fs.getFirestore(a); }
  return _db;
}
export async function getFs() { await mods(); return _mods.fs; }

// ---- Authentication 预留（以后：Google 登录 / 邮箱登录）----
export async function getAuthInstance() {
  if (!_auth) { const a = await getFirebaseApp(); _auth = (await mods()).auth.getAuth(a); }
  return _auth;
}
export async function signInWithGoogle({ redirect = false } = {}) {
  if (!isFirebaseConfigured()) return { ok: false, error: notConfigured().message };
  try {
    const auth = await getAuthInstance(); const m = _mods.auth;
    const provider = new m.GoogleAuthProvider();
    // 手机/App WebView 中弹窗常被拦截，用 redirect 更稳
    if (redirect) { await m.signInWithRedirect(auth, provider); return { ok: true, pending: true }; }
    const r = await m.signInWithPopup(auth, provider);
    return { ok: true, user: r.user };
  } catch (e) { return { ok: false, error: e.code || e.message }; }
}
export async function signOutUser() {
  if (!isFirebaseConfigured()) return;
  await _mods?.auth.signOut(await getAuthInstance());
}
export function onAuthChange(cb) {
  if (!isFirebaseConfigured()) { cb(null); return () => {}; }
  let unsub = () => {}, dead = false;
  getAuthInstance().then(a => { if (!dead) unsub = _mods.auth.onAuthStateChanged(a, cb); }).catch(() => cb(null));
  return () => { dead = true; unsub(); };
}
// 以后（不在本次）：邮箱魔法链接、忘记密码 sendPasswordResetEmail、注销 deleteUser
