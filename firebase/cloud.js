// V1.9 云端账号：登录/注册/游客 + 进度云同步（照片仍只存在本机）
// Firebase 加载失败时什么都不影响：游客照常离线玩。
import { isFirebaseConfigured, getAuthInstance, signInWithGoogle, signOutUser, onAuthChange } from './firebase-app.js';
import { upsertUser, saveProgress, loadProgress } from './firestore-api.js';

const $ = id => document.getElementById(id);
// 用游戏自带的 onTap（处理触屏 + 吞幽灵点击），没有就退回 click
const tap = (el, fn) => el && (typeof window.onTap === 'function' ? window.onTap(el, fn) : el.addEventListener('click', fn));
const zh = () => (localStorage.getItem('pz_lang') || 'zh') === 'zh';
const T = (a, b) => zh() ? a : b;
let user = null, authMods = null;
const AM = async () => authMods || (authMods = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'));

const css = `#acctBar{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-items:center;margin:4px 0 6px;font-size:.9em}
#acctBar .who{font-weight:700;max-width:70vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#authBox .box{max-width:min(94vw,460px);text-align:center}
#authBox input{width:100%;min-height:56px;font:inherit;font-size:1em;padding:8px 12px;border:3px solid #1E1E1E;border-radius:14px;margin:6px 0;box-sizing:border-box}
#authBox .btn{width:100%;margin:6px 0}#authMsg{min-height:1.4em;color:#B02A00;font-weight:700;white-space:normal}
#authMsg.ok{color:#2B7A3D}#authBox .lnk{background:none;border:0;color:#1971C2;font:inherit;text-decoration:underline;cursor:pointer;padding:8px}`;

function ui() {
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const bar = document.createElement('div'); bar.id = 'acctBar';
  const h1 = document.querySelector('#s-home h1'); h1.after(bar);
  const m = document.createElement('div'); m.className = 'modal'; m.id = 'authBox';
  m.innerHTML = `<div class="box"><h2 id="authTitle" style="white-space:normal"></h2>
    <button class="btn" id="authG"></button><p class="tip" id="authOr"></p>
    <input id="authEmail" type="email" autocomplete="email"><input id="authPw" type="password" autocomplete="current-password" minlength="6">
    <div id="authMsg" role="status"></div>
    <button class="btn primary" id="authIn"></button><button class="btn" id="authUp"></button>
    <button class="lnk" id="authForgot"></button><button class="btn small" id="authClose"></button></div>`;
  document.body.appendChild(m);
  tap($('authG'), google); tap($('authIn'), () => email(false)); tap($('authUp'), () => email(true));
  tap($('authForgot'), forgot); tap($('authClose'), close);
  render();
  // 语言切换后刷新文字
  tap($('langBtn'), () => setTimeout(render, 0));
}
function open() { $('authMsg').textContent = ''; render(); $('authBox').classList.add('on'); }
function close() { $('authBox').classList.remove('on'); }
function msg(t, ok) { const e = $('authMsg'); e.textContent = t; e.className = ok ? 'ok' : ''; }
function render() {
  const bar = $('acctBar'); if (!bar) return;
  if (user) {
    bar.innerHTML = `<span class="who">☁️ ${T('已登录：', 'Signed in: ')}${(user.displayName || user.email || '').replace(/[<>&]/g, '')}</span><button class="btn small" id="acctOut">${T('退出登录', 'Sign out')}</button>`;
    tap($('acctOut'), () => signOutUser());
  } else {
    bar.innerHTML = `<span class="who">👤 ${T('游客模式（进度存在本机）', 'Guest (saved on this device)')}</span><button class="btn small" id="acctIn">🔑 ${T('登录 / 注册', 'Sign in / Register')}</button>`;
    tap($('acctIn'), open);
  }
  const s = (id, t) => { const e = $(id); if (e) e.textContent = t; };
  s('authTitle', T('登录后进度保存在云端，换手机也能接着玩', 'Sign in to save progress in the cloud'));
  s('authG', T('用 Google 账号登录', 'Continue with Google'));
  s('authOr', T('或者用邮箱和密码', 'or use email and password'));
  s('authIn', T('登录', 'Sign in')); s('authUp', T('注册新账号', 'Create account'));
  s('authForgot', T('忘记密码？', 'Forgot password?')); s('authClose', T('先当游客玩', 'Keep playing as guest'));
  $('authEmail') && ($('authEmail').placeholder = T('邮箱', 'Email'));
  $('authPw') && ($('authPw').placeholder = T('密码（至少6位）', 'Password (6+ characters)'));
}
const ERR = { 'auth/invalid-email': ['邮箱格式不对', 'Invalid email'], 'auth/invalid-credential': ['邮箱或密码不对', 'Wrong email or password'],
  'auth/wrong-password': ['密码不对', 'Wrong password'], 'auth/user-not-found': ['这个邮箱还没注册', 'No account for this email'],
  'auth/email-already-in-use': ['这个邮箱已经注册过，请直接登录', 'Email already registered — please sign in'],
  'auth/weak-password': ['密码太短，至少6位', 'Password too short (6+)'], 'auth/popup-closed-by-user': ['登录窗口被关掉了', 'Sign-in window closed'],
  'auth/network-request-failed': ['网络不通，请稍后再试', 'Network error, try later'], 'auth/too-many-requests': ['试太多次了，请稍后再试', 'Too many tries, try later'] };
const errTxt = c => { const e = ERR[c]; return e ? T(e[0], e[1]) : T('出错了：', 'Error: ') + c; };
async function google() {
  msg(T('正在打开 Google 登录…', 'Opening Google…'), true);
  let r = await signInWithGoogle();
  if (!r.ok && /popup-blocked|operation-not-supported/.test(r.error)) r = await signInWithGoogle({ redirect: true });
  if (r.ok) { if (!r.pending) close(); } else msg(errTxt(r.error));
}
async function email(reg) {
  const em = $('authEmail').value.trim(), pw = $('authPw').value;
  if (!em || !pw) return msg(T('请填邮箱和密码', 'Enter email and password'));
  try { const m = await AM(), a = await getAuthInstance();
    await (reg ? m.createUserWithEmailAndPassword : m.signInWithEmailAndPassword)(a, em, pw); close();
  } catch (e) { msg(errTxt(e.code || e.message)); }
}
async function forgot() {
  const em = $('authEmail').value.trim(); if (!em) return msg(T('先在上面填好邮箱', 'Enter your email above first'));
  try { const m = await AM(); await m.sendPasswordResetEmail(await getAuthInstance(), em);
    msg(T('重设密码的邮件已发出，请查收邮箱', 'Reset email sent — check your inbox'), true);
  } catch (e) { msg(errTxt(e.code || e.message)); }
}

// ---- 同步：只同步进度和成绩，不上传照片 ----
const pick = p => ({ n: p.n, pos: p.pos || null, correct: p.correct || 0, playMs: Math.round(p.playMs || 0), swaps: p.swaps || 0,
  done: p.done || {}, bestMs: p.bestMs || {}, label: (p.label && p.label.txt) || (typeof p.label === 'string' ? p.label : '') || '' });
let timers = {};
function onSave(p) {
  if (!user || !p || !p.id) return;
  clearTimeout(timers[p.id]);
  timers[p.id] = setTimeout(() => saveProgress(user.uid, p.id, pick(p)).catch(e => console.warn('cloud save', e)), 1500);
}
async function onBest(n, ms) {
  if (!user) return;
  try { await upsertUser(user.uid, { ['best_g' + n]: Math.round(ms) }); } catch (e) { console.warn('cloud best', e); }
}
async function pullBest() {
  // 登录后：云端最好成绩与本机合并（取更快的）
  try { const { getDb, getFs } = await import('./firebase-app.js'); const f = await getFs(), db = await getDb();
    const s = await f.getDoc(f.doc(db, 'users', user.uid)); const d = s.exists() ? s.data() : {};
    const up = {};
    for (const k of Object.keys(d)) if (k.startsWith('best_g')) { const loc = +localStorage.getItem('pz_' + k) || 0;
      if (!loc || d[k] < loc) localStorage.setItem('pz_' + k, d[k]); }
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('pz_best_g')) { const c = k.slice(3), v = +localStorage.getItem(k);
      if (!d[c] || v < d[c]) up[c] = v; } }
    await upsertUser(user.uid, { email: user.email || '', displayName: user.displayName || '', locale: zh() ? 'zh-CN' : 'en', ...up });
    window.dispatchEvent(new Event('pz-cloud-sync'));
  } catch (e) { console.warn('cloud pull', e); }
}
window.pzCloud = { onSave, onBest, get user() { return user; }, load: () => user ? loadProgress(user.uid) : Promise.resolve([]) };

if (isFirebaseConfigured()) {
  ui();
  onAuthChange(u => { user = u; render(); if (u) pullBest(); });
}
