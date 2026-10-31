// V1.9 云端账号：登录/注册/游客 + 进度云同步（照片仍只存在本机）
// Firebase 加载失败时什么都不影响：游客照常离线玩。
import { isFirebaseConfigured, getAuthInstance, signOutUser, onAuthChange } from './firebase-app.js';
import { upsertUser, saveProgress, loadProgress } from './firestore-api.js';

const $ = id => document.getElementById(id);
// 用游戏自带的 onTap（处理触屏 + 吞幽灵点击），没有就退回 click
const tap = (el, fn) => el && (typeof window.onTap === 'function' ? window.onTap(el, fn) : el.addEventListener('click', fn));
const LG = () => { const l = localStorage.getItem('pz_lang'); return l === 'en' || l === 'fr' ? l : 'zh'; };
const zh = () => LG() === 'zh';
// V1.12：三语 T(中文, English, Français)；没给法语就用英文
const T = (a, b, c) => ({ zh: a, en: b, fr: c || b })[LG()];
let user = null, authMods = null;
const AM = async () => authMods || (authMods = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'));

// V1.12：登录表单放在 index.html 的开屏 #s-entry；账号栏放在设置页 #acctSlot
function ui() {
  const bar = document.createElement('div'); bar.id = 'acctBar';
  const slot = $('acctSlot'); slot.innerHTML = ''; slot.appendChild(bar);
  tap($('authIn'), () => email(false)); tap($('authUp'), () => email(true)); tap($('authForgot'), forgot);
  render();
  window.addEventListener('pz-lang', () => setTimeout(render, 0));
}
function eye(force) { const p = $('authPw'), show = typeof force === 'boolean' ? force : p.type === 'password';
  p.type = show ? 'text' : 'password'; const b = $('authEye'); b.textContent = show ? '🙈' : '👁️'; b.setAttribute('aria-pressed', show);
  b.setAttribute('aria-label', show ? T('隐藏密码', 'Hide password') : T('显示密码', 'Show password')); }
// 第1条：换人登录 / 退出时，清掉表单和登录残留，回到干净游客状态（不动本机照片和成绩）
function clearAuthForm() { ['authEmail', 'authPw'].forEach(id => { const e = $(id); if (e) e.value = ''; });
  if ($('authPw')) eye(false); if ($('authMsg')) msg(''); }
async function logout() { clearAuthForm(); Object.values(timers).forEach(clearTimeout); timers = {};
  try { await signOutUser(); } catch (e) { console.warn('signout', e); }
  try { for (const k of Object.keys(sessionStorage)) if (/firebase|pz_auth/i.test(k)) sessionStorage.removeItem(k); } catch (e) {}
  user = null; try { sessionStorage.removeItem('pz_entered'); sessionStorage.removeItem('pz_entry'); } catch (e) {}
  render(); window.go && window.go('s-entry'); }
function open() { clearAuthForm(); render(); window.go && window.go('s-entry'); }
function close() { clearAuthForm(); window.enterHome && window.enterHome(); }
function msg(t, ok) { const e = $('authMsg'); e.textContent = t; e.className = ok ? 'ok' : ''; }
function render() {
  const bar = $('acctBar'); if (!bar) return;
  if (user) {
    bar.innerHTML = `<span class="who">☁️ ${T('已登录：', 'Signed in: ', 'Connecté : ')}${(user.displayName || user.email || '').replace(/[<>&]/g, '')}</span><button class="btn small" id="acctOut">${T('退出登录', 'Sign out', 'Se déconnecter')}</button>`;
    tap($('acctOut'), logout);
  } else {
    bar.innerHTML = `<span class="who">👤 ${T('游客模式（进度存在本机）', 'Guest (saved on this device)', 'Invité (enregistré sur cet appareil)')}</span><button class="btn small" id="acctIn">🔑 ${T('登录 / 注册', 'Sign in / Register', 'Connexion / Inscription')}</button>`;
    tap($('acctIn'), open);
  }
  trialBar(bar);
}
const ERR = { 'auth/invalid-email': ['邮箱格式不对', 'Invalid email', 'E-mail invalide'], 'auth/invalid-credential': ['邮箱或密码不对', 'Wrong email or password', 'E-mail ou mot de passe incorrect'],
  'auth/wrong-password': ['密码不对', 'Wrong password', 'Mot de passe incorrect'], 'auth/user-not-found': ['这个邮箱还没注册', 'No account for this email', 'Aucun compte pour cet e-mail'],
  'auth/email-already-in-use': ['这个邮箱已经注册过，请直接登录', 'Email already registered — please sign in', 'E-mail déjà inscrit — connectez-vous'],
  'auth/weak-password': ['密码太短，至少6位', 'Password too short (6+)', 'Mot de passe trop court (6 min.)'], 'auth/popup-closed-by-user': ['登录窗口被关掉了', 'Sign-in window closed', 'Fenêtre fermée'],
  'auth/network-request-failed': ['网络不通，请稍后再试', 'Network error, try later', 'Erreur réseau, réessayez'], 'auth/too-many-requests': ['试太多次了，请稍后再试', 'Too many tries, try later', 'Trop d’essais, réessayez plus tard'] };
const errTxt = c => { const e = ERR[c]; return e ? T(e[0], e[1], e[2]) : T('出错了：', 'Error: ', 'Erreur : ') + c; };
async function email(reg) {
  const em = $('authEmail').value.trim(), pw = $('authPw').value;
  if (!em || !pw) return msg(T('请填邮箱和密码', 'Enter email and password', 'Saisissez e-mail et mot de passe'));
  try { const m = await AM(), a = await getAuthInstance();
    await (reg ? m.createUserWithEmailAndPassword : m.signInWithEmailAndPassword)(a, em, pw); close();
  } catch (e) { msg(errTxt(e.code || e.message)); }
}
async function forgot() {
  const em = $('authEmail').value.trim(); if (!em) return msg(T('先在上面填好邮箱', 'Enter your email above first', 'Saisissez d’abord votre e-mail'));
  try { const m = await AM(); await m.sendPasswordResetEmail(await getAuthInstance(), em);
    msg(T('重设密码的邮件已发出，请查收邮箱', 'Reset email sent — check your inbox', 'E-mail de réinitialisation envoyé'), true);
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
    await upsertUser(user.uid, { email: user.email || '', displayName: user.displayName || '', locale: LG(), ...up });
    window.dispatchEvent(new Event('pz-cloud-sync'));
  } catch (e) { console.warn('cloud pull', e); }
}
window.pzCloud = { onSave, onBest, get user() { return user; }, load: () => user ? loadProgress(user.uid) : Promise.resolve([]) };


// ---- 第2条：7天免费试玩链接 ----  trials/{token}: { createdBy, createdAt, expiresAt(ms) }
const DAY = 864e5, TK = 'pz_trial';
const myTrial = () => { try { return JSON.parse(localStorage.getItem(TK) || 'null'); } catch (e) { return null; } };
const daysLeft = t => t ? Math.ceil((t.expiresAt - Date.now()) / DAY) : 0;
function trialBar(bar) {
  const t = myTrial();
  if (t && daysLeft(t) > 0) bar.insertAdjacentHTML('beforeend', `<span class="who" id="trialLeft">🎁 ${T('免费试玩还剩 ' + daysLeft(t) + ' 天', 'Free trial: ' + daysLeft(t) + ' days left', 'Essai gratuit : ' + daysLeft(t) + ' jours restants')}</span>`);
  else if (t) bar.insertAdjacentHTML('beforeend', `<span class="who" id="trialLeft">🎁 ${T('免费试玩已结束，仍可当游客玩', 'Trial ended — guest play still works', 'Essai terminé — le mode invité reste disponible')}</span>`);
  // V1.12：送朋友7天只放在通关页
}
// 共用：首页按钮和拼完页都走这里。没登录先提示登录（建链接需要登录）
async function shareTrial() {
  if (!user) { if (confirm(T('送朋友7天免费玩，需要先登录。\n现在去登录吗？', 'Please log in first to share a 7-day free trial.\nLog in now?', 'Connectez-vous pour offrir 7 jours gratuits.\nSe connecter ?'))) open(); window.__trialNeedLogin = true; return; }
  try { const { getDb, getFs } = await import('./firebase-app.js'); const f = await getFs(), db = await getDb();
    const token = Array.from(crypto.getRandomValues(new Uint8Array(9)), b => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
    const now = Date.now();
    await f.setDoc(f.doc(db, 'trials', token), { createdBy: user.uid, createdAt: now, expiresAt: now + 7 * DAY });
    const url = location.origin + location.pathname + '?trial=' + token; window.__lastTrial = url;
    const text = T('送你7天免费玩「照片拼图」：', 'Play Photo Puzzle free for 7 days: ', 'Jouez gratuitement à Photo Puzzle pendant 7 jours : ');
    if (navigator.share) { try { await navigator.share({ title: T('照片拼图', 'Photo Puzzle', 'Photo Puzzle'), text, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(url); alert(T('链接已复制，发给朋友就行：\n', 'Link copied:\n', 'Lien copié :\n') + url); }
    catch (e) { prompt(T('长按复制这个链接：', 'Copy this link:', 'Copiez ce lien :'), url); }
  } catch (e) { console.warn('trial', e); alert(T('生成链接失败，请稍后再试', 'Could not create link, try later', 'Impossible de créer le lien')); }
}
async function redeemTrial() {
  const token = new URLSearchParams(location.search).get('trial'); if (!token) return;
  history.replaceState(null, '', location.pathname); // 链接用一次就从地址栏去掉
  if (myTrial()) return render(); // 每台设备只领一次
  try { const { getDb, getFs } = await import('./firebase-app.js'); const f = await getFs(), db = await getDb();
    const s = await f.getDoc(f.doc(db, 'trials', token)); if (!s.exists()) return;
    const d = s.data(); if (!(d.expiresAt > Date.now())) return;
    // 7天从领取当天起算
    localStorage.setItem(TK, JSON.stringify({ token, redeemedAt: Date.now(), expiresAt: Date.now() + 7 * DAY })); render();
  } catch (e) { console.warn('redeem', e); }
}
window.pzTrial = { get: myTrial, daysLeft: () => daysLeft(myTrial()) };

// ---- 第3条：玩完后 1–5 星 + 100字以内反馈 → Firestore feedback，并可发邮件 ----
const FB_EMAIL = 'minicomoffice@gmail.com';
let lastDone = null, stars = 0;
function fbUI() {
  const m = document.createElement('div'); m.className = 'modal'; m.id = 'fbBox';
  m.innerHTML = `<div class="box" style="max-width:min(94vw,460px);text-align:center"><h2 id="fbTitle" style="white-space:normal"></h2>
    <div id="fbStars" style="font-size:2.4em;display:flex;justify-content:center;gap:6px">${[1,2,3,4,5].map(i => `<button class="lnk" data-s="${i}" style="font-size:1em;background:none;border:0;cursor:pointer;min-width:52px">☆</button>`).join('')}</div>
    <textarea id="fbText" maxlength="100" rows="3" style="width:100%;font:inherit;padding:8px;border:3px solid #1E1E1E;border-radius:14px;box-sizing:border-box"></textarea>
    <div id="fbCount" class="tip"></div><div id="fbMsg" style="min-height:1.4em;font-weight:700"></div>
    <button class="btn primary" id="fbSend" style="width:100%"></button><button class="btn small" id="fbClose"></button></div>`;
  document.body.appendChild(m);
  m.querySelectorAll('#fbStars button').forEach(b => tap(b, () => { stars = +b.dataset.s; paintStars(); $('fbMsg').textContent = ''; }));
  $('fbText').addEventListener('input', () => { const e = $('fbText'); if (e.value.length > 100) e.value = e.value.slice(0, 100); $('fbCount').textContent = e.value.length + ' / 100'; });
  tap($('fbSend'), sendFb); tap($('fbClose'), () => m.classList.remove('on'));
}
const paintStars = () => document.querySelectorAll('#fbStars button').forEach(b => { b.textContent = +b.dataset.s <= stars ? '⭐' : '☆'; });
function fbOpen() {
  stars = 0; paintStars(); $('fbText').value = ''; $('fbCount').textContent = '0 / 100'; $('fbMsg').textContent = '';
  $('fbTitle').textContent = T('觉得好玩吗？给我们打个分', 'Enjoyed it? Rate us', 'Ça vous a plu ? Notez-nous');
  $('fbText').placeholder = T('想说点什么？（可不填，最多100字）', 'Any comments? (optional, max 100)', 'Un commentaire ? (facultatif, 100 max)');
  $('fbSend').textContent = T('发送反馈', 'Send feedback', 'Envoyer'); $('fbClose').textContent = T('不用了', 'No thanks', 'Non merci');
  $('fbBox').classList.add('on');
}
async function sendFb() {
  if (!stars) { $('fbMsg').style.color = '#B02A00'; $('fbMsg').textContent = T('请先点星星打分', 'Tap the stars first', 'Touchez d’abord les étoiles'); return; }
  const d = lastDone || {}, text = $('fbText').value.trim().slice(0, 100);
  const rec = { stars, text, n: d.n || 0, grid: d.grid || '', ms: d.ms || 0, lang: LG(), uid: user ? user.uid : '', at: Date.now() };
  window.__lastFb = rec; let saved = false;
  if (isFirebaseConfigured()) try { const { getDb, getFs } = await import('./firebase-app.js'); const f = await getFs(), db = await getDb();
    await f.addDoc(f.collection(db, 'feedback'), rec); saved = true; } catch (e) { console.warn('feedback', e); }
  window.__lastFb.saved = saved;
  // Spark 免费版没有云函数，不能后台自动发信：用 mailto 打开对方手机邮件 App，点发送即可
  const sec = Math.round(rec.ms / 1000), body = `${'⭐'.repeat(stars)} (${stars}/5)\n${text}\n\n${T('难度', 'Level')}: ${rec.grid} (${rec.n})\n${T('用时', 'Time')}: ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}\n${T('语言', 'Language')}: ${rec.lang}`;
  window.__lastMailto = `mailto:${FB_EMAIL}?subject=${encodeURIComponent(T('照片拼图反馈 ', 'Photo Puzzle feedback ', 'Avis Photo Puzzle ') + stars + '★')}&body=${encodeURIComponent(body)}`;
  $('fbMsg').style.color = '#2B7A3D'; $('fbMsg').textContent = T('谢谢你的反馈！', 'Thank you!', 'Merci !');
  if (!saved && !window.__noMailto) location.href = window.__lastMailto;
  setTimeout(() => $('fbBox').classList.remove('on'), 1500);
}
fbUI();
window.addEventListener('pz-done', e => { lastDone = e.detail;
  const g = document.getElementById('endLinks'); if (g && !$('fbOpen')) { const b = document.createElement('button'); b.className = 'lnk'; b.id = 'fbOpen'; g.prepend(b); tap(b, fbOpen); }
  if ($('fbOpen')) $('fbOpen').textContent = '⭐ ' + T('给个评价', 'Rate this game', 'Donner un avis'); });
window.pzFb = { open: fbOpen };

if (isFirebaseConfigured()) {
  ui(); redeemTrial();
  onAuthChange(u => { user = u; render(); if (u) { pullBest(); if ($('s-entry').classList.contains('on')) window.enterHome && window.enterHome(); } });
}

window.PZshareTrial = shareTrial;
