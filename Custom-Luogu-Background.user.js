// ==UserScript==
// @name         洛谷 - 自定义背景
// @namespace    https://www.luogu.com.cn/user/1523280
// @version      8.3.0
// @description  为你的洛谷自定义背景！
// @author       a_small_OIer
// @license      MIT
// @match        https://www.luogu.com.cn/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// @icon         https://fecdn.luogu.com.cn/favicon.ico
// ==/UserScript==

(function () {
    'use strict';

    const DB_NAME = 'LuoguBgDB', STORE_NAME = 'media';
    const MAX = 30;
    const DEFAULTS = {
        blur: 0, navOpacity: 0.82, cardOpacity: 0.88, footerOpacity: 0.70,
        bgBrightness: 1.0, bgSaturation: 1.0,
        articleTransparent: true, globalGlass: false,
        randomBg: true, currentBgId: null,
        enableBgLayer: true, panelCollapsed: false
    };

    function openDB() {
        return new Promise((resolve, reject) => {
            const r = indexedDB.open(DB_NAME, 1);
            r.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                }
            };
            r.onsuccess = e => resolve(e.target.result);
            r.onerror = e => reject(e.target.error);
        });
    }
    async function dbAdd(media) {
        const db = await openDB(), tx = db.transaction(STORE_NAME, 'readwrite'), store = tx.objectStore(STORE_NAME), req = store.add(media);
        return new Promise((res, rej) => { tx.oncomplete = () => res(req.result); tx.onerror = rej; req.onerror = rej; });
    }
    async function dbGet(id) {
        const db = await openDB(), tx = db.transaction(STORE_NAME, 'readonly'), store = tx.objectStore(STORE_NAME), req = store.get(Number(id));
        return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = rej; });
    }
    async function dbDelete(id) {
        const db = await openDB(), tx = db.transaction(STORE_NAME, 'readwrite'), store = tx.objectStore(STORE_NAME);
        store.delete(Number(id));
        return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
    }
    async function dbClear() {
        const db = await openDB(), tx = db.transaction(STORE_NAME, 'readwrite'), store = tx.objectStore(STORE_NAME);
        store.clear();
        return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
    }
    async function dbUpdate(id, updates) {
        const db = await openDB(), tx = db.transaction(STORE_NAME, 'readwrite'), store = tx.objectStore(STORE_NAME);
        const getReq = store.get(Number(id));
        getReq.onsuccess = () => {
            const m = getReq.result;
            if (m) { Object.assign(m, updates); store.put(m); }
        };
        return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
    }
    async function dbAllMedia() {
        const db = await openDB(), tx = db.transaction(STORE_NAME, 'readonly'), store = tx.objectStore(STORE_NAME), req = store.getAll();
        return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = rej; });
    }
    function blob2buf(blob) {
        return new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.onerror = rej;
            r.readAsArrayBuffer(blob);
        });
    }

    const urlCache = new Map();
    function media2url(media) {
        if (media.type === 'image' && typeof media.data === 'string') return media.data;
        if (urlCache.has(media.id)) return urlCache.get(media.id);
        const url = URL.createObjectURL(new Blob([media.data], { type: media.mime }));
        urlCache.set(media.id, url);
        return url;
    }
    function revokeURL(id) {
        const url = urlCache.get(id);
        if (url) { try { URL.revokeObjectURL(url); } catch (_) {} urlCache.delete(id); }
    }
    function revokeAllURL() {
        urlCache.forEach(url => { try { URL.revokeObjectURL(url); } catch (_) {} });
        urlCache.clear();
    }

    function loadSettings() {
        const s = {};
        for (const [k, d] of Object.entries(DEFAULTS)) {
            const v = GM_getValue(k, undefined);
            s[k] = (v !== undefined && v !== null) ? v : d;
        }
        return s;
    }
    function saveSettings(s) {
        Object.entries(s).forEach(([k, v]) => GM_setValue(k, v));
    }
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    const ICON_PATHS = {
        image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
        film: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>',
        x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
        plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
        upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
        trash2: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
        rotateCcw: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
        chevronDown: '<path d="m6 9 6 6 6-6"/>',
        crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
        check: '<path d="M20 6 9 17l-5-5"/>',
        repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
        play: '<polygon points="6 3 20 12 6 21 6 3"/>'
    };
    function icon(name, size = 16) {
        return `<svg class="lgb-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_PATHS[name] || ''}</svg>`;
    }

    let saving = false;
    function toast(status) {
        let el = document.getElementById('luogu-upload-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'luogu-upload-toast';
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            document.body.appendChild(el);
        }
        clearTimeout(el._hideTimer);
        el.classList.remove('is-saving', 'is-done', 'is-error', 'is-visible');
        if (status === 'start') {
            saving = true;
            el.classList.add('is-saving', 'is-visible');
            el.innerHTML = '<span class="lgb-toast-spinner"></span><span>正在保存…</span>';
        } else if (status === 'error') {
            saving = false;
            el.classList.add('is-error', 'is-visible');
            el.innerHTML = `${icon('x', 15)}<span>操作失败</span>`;
            el._hideTimer = setTimeout(() => el.classList.remove('is-visible'), 2500);
        } else {
            saving = false;
            el.classList.add('is-done', 'is-visible');
            el.innerHTML = `${icon('check', 15)}<span>已保存</span>`;
            el._hideTimer = setTimeout(() => {
                if (el.classList.contains('is-done')) el.classList.remove('is-visible');
            }, 2000);
        }
    }
    addEventListener('beforeunload', e => {
        if (saving) { e.preventDefault(); e.returnValue = '保存中背景图，离开将丢失背景'; }
    });

    function injectStyles() {
        GM_addStyle(`
#luogu-bg-layer{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:0;pointer-events:none;overflow:hidden}
#luogu-bg-layer .bg-inner{position:absolute;top:-30px;left:-30px;width:calc(100% + 60px);height:calc(100% + 60px);background-size:cover;background-position:center;background-repeat:no-repeat;transition:filter 0.4s ease}
#luogu-bg-layer video{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;transition:filter 0.4s ease}
#luogu-glass-overlay{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;background:rgba(var(--lgb-glass-rgb),0.3);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:none}

html, body { background: transparent !important; }
#app, .lfe-body { background: transparent !important; position: relative; z-index: 2; }

main, .main-container, .lside-nav, .main-container.lside-nav,
.theme-page, .theme-page.no-header, #app-old { background-color: transparent !important; background-image: none !important; }
.theme-page::before, .theme-page::after,
.theme-page.no-header::before, .theme-page.no-header::after { background: none !important; }
body::before, body::after { background: none !important; }

:root{
    --lgb-nav-opacity:0.82;--lgb-card-opacity:0.88;--lgb-footer-opacity:0.70;
    --lgb-surface-rgb:var(--lcolor--bg-container, 255, 255, 255);
    --lgb-elevated-rgb:var(--lcolor--bg-elevated, 255, 255, 255);
    --lgb-glass-rgb:255, 255, 255;
    --lgb-text:#333;--lgb-title:#2c3e50;--lgb-muted:#7f8c8d;--lgb-label:#555;--lgb-empty:#999;
    --lgb-border:#eee;--lgb-border-strong:#ddd;
    --lgb-panel-bg:rgba(255,255,255,0.97);
    --lgb-input-bg:#fdfdfd;--lgb-track:#e0e0e0;--lgb-thumb-border:#fff;
    --lgb-btn-bg:#f5f5f5;--lgb-btn-bg-hover:#e8e8e8;--lgb-btn-text:#666;--lgb-btn-border:#ddd;
    --lgb-upload-bg:#f0f0f0;--lgb-upload-bg-hover:#e0e0e0;
    --lgb-accent:#3498db;--lgb-accent-soft:rgba(52,152,219,.12);
    --lgb-crop-accent:#3b82f6;--lgb-crop-bg:#fff;--lgb-crop-stage:#f2f3f5;
    --lgb-scrollbar:#c9ced6;
}
html[data-lcolor-theme="dark"]{
    --lgb-glass-rgb:0, 0, 0;
    --lgb-text:#e8e8e8;--lgb-title:#f2f2f2;--lgb-muted:#a0a6ad;--lgb-label:#c9cdd2;--lgb-empty:#a0a6ad;
    --lgb-border:#3a3d42;--lgb-border-strong:#4a4d52;
    --lgb-panel-bg:rgba(29,32,37,0.97);
    --lgb-input-bg:rgba(40,43,48,0.9);--lgb-track:#3a3d42;--lgb-thumb-border:#1d2025;
    --lgb-btn-bg:#282b30;--lgb-btn-bg-hover:#303339;--lgb-btn-text:#d9d9d9;--lgb-btn-border:#4a4d52;
    --lgb-upload-bg:#282b30;--lgb-upload-bg-hover:#303339;
    --lgb-accent:#4aa3e0;--lgb-accent-soft:rgba(74,163,224,.16);
    --lgb-crop-accent:#3b82f6;--lgb-crop-bg:#1d2025;--lgb-crop-stage:#14171b;
    --lgb-scrollbar:#4a4d52;
}

.top-bar,
nav.sidebar.lside,
.user-nav.rside,
.sidebar.lside.bar {
    background-color: rgba(var(--lgb-surface-rgb), var(--lgb-nav-opacity)) !important;
    backdrop-filter: blur(calc((1 - var(--lgb-nav-opacity)) * 8px));
    -webkit-backdrop-filter: blur(calc((1 - var(--lgb-nav-opacity)) * 8px));
}

footer {
    background-color: rgba(var(--lgb-surface-rgb), var(--lgb-footer-opacity)) !important;
    backdrop-filter: blur(calc((1 - var(--lgb-footer-opacity)) * 8px));
    -webkit-backdrop-filter: blur(calc((1 - var(--lgb-footer-opacity)) * 8px));
}

.l-card,
.lg-article,
.am-panel,
.lg-index-stat,
.lg-index-contest,
section.am-panel {
    background-color: rgba(var(--lgb-surface-rgb), var(--lgb-card-opacity)) !important;
}
.lg-index-contest .am-panel-bd { background-color: transparent !important; }
.user-header-top{background-color:unset!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
div[style*="background-color: rgb(255, 255, 255)"]{background-color:transparent!important}
.l-card.type-burger { background-color:rgb(var(--lgb-surface-rgb))!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important }
.article-banner{background-color:transparent!important}
.top-progress{display:none!important}
.am-modal-dialog,.dropdown,.am-dropdown-content,.am-selected-content,[class*="dropdown"],.user-nav .dropdown{background-color:rgba(var(--lgb-elevated-rgb),0.98)!important;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.search-wrap input{background-color:rgba(var(--lgb-elevated-rgb),0.95)!important}
.reply-item,.comment-item,.l-card.reply-item{background-color:rgba(var(--lgb-surface-rgb),0.65)!important}

.lgb-icon{display:block;flex:0 0 auto}
.lgb-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;flex:0 0 auto;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--lgb-muted);cursor:pointer;transition:background-color .15s,color .15s,border-color .15s}
.lgb-icon-btn:hover{background:var(--lgb-btn-bg-hover);color:var(--lgb-title)}
.lgb-icon-btn:focus-visible{outline:2px solid var(--lgb-accent);outline-offset:1px}
.lgb-icon-btn .lgb-icon{width:16px;height:16px}
.lgb-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 12px;border:1px solid var(--lgb-btn-border);border-radius:7px;background:var(--lgb-btn-bg);color:var(--lgb-btn-text);font:inherit;font-size:12px;cursor:pointer;transition:background-color .15s,color .15s,border-color .15s,opacity .15s}
.lgb-btn:hover{background:var(--lgb-btn-bg-hover);color:var(--lgb-title)}
.lgb-btn:focus-visible{outline:2px solid var(--lgb-accent);outline-offset:1px}
.lgb-btn:disabled{opacity:.45;cursor:not-allowed}
.lgb-btn .lgb-icon{width:14px;height:14px}
.lgb-btn--primary{background:var(--lgb-crop-accent);border-color:var(--lgb-crop-accent);color:#fff}
.lgb-btn--primary:hover{background:#2563eb;border-color:#2563eb;color:#fff}
.lgb-btn--danger{background:transparent;border-color:rgba(192,57,43,.35);color:#c0392b}
.lgb-btn--danger:hover{background:rgba(192,57,43,.08);color:#c0392b}
html[data-lcolor-theme="dark"] .lgb-btn--danger{color:#f08080;border-color:rgba(240,128,128,.35)}
html[data-lcolor-theme="dark"] .lgb-btn--danger:hover{background:rgba(240,128,128,.1);color:#f08080}

#luogu-bg-panel{
    position:fixed;top:50%;right:24px;z-index:99998;transform:translateY(-50%);
    width:320px;max-width:calc(100vw - 48px);max-height:min(82vh,760px);
    display:flex;flex-direction:column;overflow:hidden;
    background:var(--lgb-panel-bg);border:1px solid var(--lgb-border);border-radius:12px;
    box-shadow:0 18px 48px -14px rgba(15,23,42,.32),0 2px 8px rgba(15,23,42,.06);
    color:var(--lgb-text);font-size:13px;line-height:1.45;
    font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei","Segoe UI",sans-serif;
    backdrop-filter:blur(18px) saturate(140%);-webkit-backdrop-filter:blur(18px) saturate(140%);
    visibility:visible;transition:opacity .24s ease,transform .24s ease,visibility 0s;
}
html[data-lcolor-theme="dark"] #luogu-bg-panel{box-shadow:0 18px 48px -14px rgba(0,0,0,.65),0 0 0 1px rgba(255,255,255,.03)}
#luogu-bg-panel.collapsed{opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-50%) translateX(calc(100% + 48px));transition:opacity .24s ease,transform .24s ease,visibility 0s linear .24s}
#luogu-bg-panel *{box-sizing:border-box}
#luogu-bg-panel .lgb-head{display:flex;align-items:center;gap:8px;flex:0 0 auto;padding:11px 12px 11px 14px;border-bottom:1px solid var(--lgb-border)}
#luogu-bg-panel .lgb-head-title{display:flex;align-items:center;gap:7px;min-width:0;font-size:13.5px;font-weight:600;color:var(--lgb-title)}
#luogu-bg-panel .lgb-head-title>.lgb-icon{color:var(--lgb-accent)}
#luogu-bg-panel .lgb-head .lgb-icon-btn{margin-left:auto}
#luogu-bg-panel .lgb-body{padding:12px 14px 14px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--lgb-scrollbar) transparent}
#luogu-bg-panel .lgb-body::-webkit-scrollbar{width:6px}
#luogu-bg-panel .lgb-body::-webkit-scrollbar-thumb{background:var(--lgb-scrollbar);border-radius:3px}
#luogu-bg-panel .lgb-body::-webkit-scrollbar-track{background:transparent}

#luogu-bg-panel .lgb-url-row{display:flex;align-items:center;gap:6px;margin-bottom:10px}
#luogu-bg-panel input[type="url"]{flex:1;min-width:0;height:32px;padding:0 10px;border:1px solid var(--lgb-border-strong);border-radius:7px;background:var(--lgb-input-bg);color:var(--lgb-text);font:inherit;font-size:12px;transition:border-color .15s,box-shadow .15s}
#luogu-bg-panel input[type="url"]::placeholder{color:var(--lgb-empty)}
#luogu-bg-panel input[type="url"]:focus{outline:none;border-color:var(--lgb-accent);box-shadow:0 0 0 3px var(--lgb-accent-soft)}
#luogu-bg-panel .lgb-url-row .lgb-icon-btn{width:32px;height:32px;border-color:var(--lgb-btn-border);background:var(--lgb-btn-bg);color:var(--lgb-btn-text)}
#luogu-bg-panel .lgb-url-row .lgb-icon-btn:hover{background:var(--lgb-btn-bg-hover);color:var(--lgb-title)}

#luogu-bg-panel .lgb-media-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:0 0 8px}
#luogu-bg-panel .lgb-media-title{font-size:12px;font-weight:600;color:var(--lgb-muted)}
#luogu-bg-panel .lgb-media-count{font-size:11px;color:var(--lgb-empty);font-variant-numeric:tabular-nums}
#luogu-bg-panel .lgb-media-list{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;min-height:52px}
#luogu-bg-panel .lgb-media-item{position:relative;aspect-ratio:1/1;overflow:hidden;border:1px solid var(--lgb-border-strong);border-radius:7px;background:var(--lgb-upload-bg);cursor:pointer;transition:border-color .15s,box-shadow .15s}
#luogu-bg-panel .lgb-media-item:hover{border-color:var(--lgb-accent)}
#luogu-bg-panel .lgb-media-item.is-active{border-color:var(--lgb-accent);box-shadow:0 0 0 2px var(--lgb-accent-soft)}
#luogu-bg-panel .lgb-media-item img{display:block;width:100%;height:100%;object-fit:cover}
#luogu-bg-panel .lgb-media-fallback{display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:var(--lgb-muted);background:var(--lgb-upload-bg)}
#luogu-bg-panel .lgb-media-actions{position:absolute;top:3px;right:3px;display:flex;gap:3px;opacity:0;pointer-events:none;transition:opacity .15s}
#luogu-bg-panel .lgb-media-item:hover .lgb-media-actions,
#luogu-bg-panel .lgb-media-item:focus-within .lgb-media-actions{opacity:1;pointer-events:auto}
#luogu-bg-panel .lgb-media-actions .lgb-icon-btn{width:20px;height:20px;border-radius:5px;background:rgba(15,18,22,.72);color:#fff}
#luogu-bg-panel .lgb-media-actions .lgb-icon-btn:hover{background:#c0392b;color:#fff}
#luogu-bg-panel .lgb-media-actions .lgb-icon{width:12px;height:12px}
#luogu-bg-panel .lgb-loop-btn{position:absolute;left:3px;bottom:3px;width:20px;height:20px;border-radius:5px;background:rgba(15,18,22,.72);color:#fff}
#luogu-bg-panel .lgb-loop-btn:hover{background:var(--lgb-accent);color:#fff}
#luogu-bg-panel .lgb-loop-btn .lgb-icon{width:12px;height:12px}
@media (hover:none){
    #luogu-bg-panel .lgb-media-actions{opacity:1;pointer-events:auto}
}
#luogu-bg-panel .lgb-empty{grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:16px 8px 14px;border:1px dashed var(--lgb-border-strong);border-radius:8px;color:var(--lgb-empty);font-size:12px;text-align:center}
#luogu-bg-panel .lgb-empty .lgb-icon{color:var(--lgb-empty);opacity:.7}
#luogu-bg-panel .lgb-empty-sub{font-size:11px;opacity:.8}

#luogu-bg-panel .lgb-section{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;margin:4px 0 0;padding:9px 0 8px;border:0;border-top:1px solid var(--lgb-border);background:none;color:var(--lgb-muted);font:inherit;font-size:12px;font-weight:600;text-align:left;cursor:pointer}
#luogu-bg-panel .lgb-section:hover{color:var(--lgb-text)}
#luogu-bg-panel .lgb-section .lgb-chevron{display:inline-flex;color:var(--lgb-empty);transition:transform .2s ease}
#luogu-bg-panel .lgb-section.collapsed .lgb-chevron{transform:rotate(-90deg)}
#luogu-bg-panel .lgb-block{overflow:hidden;max-height:500px;margin-bottom:2px;opacity:1;transition:max-height .28s ease,opacity .2s ease}
#luogu-bg-panel .lgb-block.collapsed{max-height:0;opacity:0}

#luogu-bg-panel .lgb-slider+.lgb-slider{margin-top:11px}
#luogu-bg-panel .lgb-slider-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}
#luogu-bg-panel .lgb-slider-head label{font-size:12px;color:var(--lgb-label)}
#luogu-bg-panel .lgb-value{min-width:38px;padding:1px 6px;border:1px solid var(--lgb-border);border-radius:4px;background:var(--lgb-btn-bg);color:var(--lgb-muted);font-size:11px;font-variant-numeric:tabular-nums;text-align:center}
#luogu-bg-panel input[type="range"]{-webkit-appearance:none;appearance:none;display:block;width:100%;height:16px;margin:0;padding:0;background:transparent;cursor:pointer}
#luogu-bg-panel input[type="range"]::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:var(--lgb-track)}
#luogu-bg-panel input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;margin-top:-5px;border:2px solid var(--lgb-accent);border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2)}
#luogu-bg-panel input[type="range"]::-moz-range-track{height:4px;border-radius:2px;background:var(--lgb-track)}
#luogu-bg-panel input[type="range"]::-moz-range-thumb{width:10px;height:10px;border:2px solid var(--lgb-accent);border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2)}
#luogu-bg-panel input[type="range"]:focus{outline:none}
#luogu-bg-panel input[type="range"]:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 3px var(--lgb-accent-soft)}
#luogu-bg-panel input[type="range"]:focus-visible::-moz-range-thumb{box-shadow:0 0 0 3px var(--lgb-accent-soft)}

#luogu-bg-panel .lgb-switch-row{position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid var(--lgb-border);cursor:pointer}
#luogu-bg-panel .lgb-switch-copy{display:flex;flex-direction:column;gap:1px;min-width:0}
#luogu-bg-panel .lgb-switch-title{font-size:12.5px;color:var(--lgb-label);line-height:1.35}
#luogu-bg-panel .lgb-switch-desc{font-size:11px;color:var(--lgb-empty);line-height:1.35}
#luogu-bg-panel .lgb-switch-row input{position:absolute;width:1px;height:1px;margin:0;opacity:0;pointer-events:none}
#luogu-bg-panel .lgb-switch{position:relative;flex:0 0 auto;width:34px;height:20px;border-radius:10px;background:var(--lgb-track);transition:background-color .18s}
#luogu-bg-panel .lgb-switch::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .18s}
#luogu-bg-panel .lgb-switch-row input:checked+.lgb-switch{background:var(--lgb-accent)}
#luogu-bg-panel .lgb-switch-row input:checked+.lgb-switch::after{transform:translateX(14px)}
#luogu-bg-panel .lgb-switch-row input:focus-visible+.lgb-switch{box-shadow:0 0 0 3px var(--lgb-accent-soft)}

#luogu-bg-panel .lgb-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}

@media (max-width:520px){
    #luogu-bg-panel{right:12px;width:calc(100vw - 24px);max-height:84vh}
}

#luogu-cropper-modal{position:fixed;inset:0;z-index:1000000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(12,15,20,.64);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);font-size:13px;line-height:1.45}
#luogu-cropper-modal .lgb-crop{width:min(94vw,1040px);max-height:92vh;display:flex;flex-direction:column;overflow:hidden;background:var(--lgb-crop-bg);border:1px solid var(--lgb-border);border-radius:14px;box-shadow:0 24px 80px rgba(0,0,0,.45);color:var(--lgb-text);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei","Segoe UI",sans-serif}
#luogu-cropper-modal .lgb-crop *{box-sizing:border-box}
#luogu-cropper-modal .lgb-crop__head{display:flex;align-items:center;gap:8px;flex:0 0 auto;padding:12px 14px;border-bottom:1px solid var(--lgb-border)}
#luogu-cropper-modal .lgb-crop__head>.lgb-icon{color:var(--lgb-crop-accent)}
#luogu-cropper-modal .lgb-crop__title{font-size:13.5px;font-weight:600;color:var(--lgb-title)}
#luogu-cropper-modal .lgb-crop__head .lgb-icon-btn{margin-left:auto}
#luogu-cropper-modal .lgb-crop__stage{position:relative;flex:1 1 auto;min-height:0;display:flex;align-items:center;justify-content:center;padding:18px;overflow:hidden;background:var(--lgb-crop-stage);touch-action:none;user-select:none;-webkit-user-select:none}
#luogu-cropper-modal .lgb-crop__canvas{position:relative;flex:0 0 auto;line-height:0}
#luogu-cropper-modal .lgb-crop__img{display:block;width:auto;height:auto;max-width:none!important;max-height:none!important;user-select:none;-webkit-user-drag:none;pointer-events:none}
#luogu-cropper-modal .lgb-crop__box{position:absolute;box-sizing:content-box;border:0;outline:2px solid var(--lgb-crop-accent);outline-offset:0;box-shadow:0 0 0 9999px rgba(8,11,16,.58);cursor:move;touch-action:none}
#luogu-cropper-modal .lgb-crop__box[hidden]{display:none}
#luogu-cropper-modal .lgb-crop__line{position:absolute;background:rgba(255,255,255,.38);pointer-events:none}
#luogu-cropper-modal .lgb-crop__line--v{top:0;bottom:0;width:1px}
#luogu-cropper-modal .lgb-crop__line--h{left:0;right:0;height:1px}
#luogu-cropper-modal .lgb-crop__handle{position:absolute;width:12px;height:12px;background:#fff;border:2px solid var(--lgb-crop-accent);border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,.3);touch-action:none}
#luogu-cropper-modal .lgb-crop__handle[data-dir="nw"]{left:-7px;top:-7px;cursor:nwse-resize}
#luogu-cropper-modal .lgb-crop__handle[data-dir="n"]{left:50%;top:-7px;transform:translateX(-50%);cursor:ns-resize}
#luogu-cropper-modal .lgb-crop__handle[data-dir="ne"]{right:-7px;top:-7px;cursor:nesw-resize}
#luogu-cropper-modal .lgb-crop__handle[data-dir="e"]{top:50%;right:-7px;transform:translateY(-50%);cursor:ew-resize}
#luogu-cropper-modal .lgb-crop__handle[data-dir="se"]{right:-7px;bottom:-7px;cursor:nwse-resize}
#luogu-cropper-modal .lgb-crop__handle[data-dir="s"]{left:50%;bottom:-7px;transform:translateX(-50%);cursor:ns-resize}
#luogu-cropper-modal .lgb-crop__handle[data-dir="sw"]{left:-7px;bottom:-7px;cursor:nesw-resize}
#luogu-cropper-modal .lgb-crop__handle[data-dir="w"]{top:50%;left:-7px;transform:translateY(-50%);cursor:ew-resize}
#luogu-cropper-modal .lgb-crop__foot{display:flex;align-items:center;gap:8px;flex:0 0 auto;padding:12px 14px;border-top:1px solid var(--lgb-border)}
#luogu-cropper-modal .lgb-crop__hint{margin-right:auto;color:var(--lgb-empty);font-size:11.5px}
@media (max-width:520px){
    #luogu-cropper-modal{padding:12px}
    #luogu-cropper-modal .lgb-crop__foot{flex-wrap:wrap}
    #luogu-cropper-modal .lgb-crop__hint{width:100%;margin-right:0}
}

#luogu-upload-toast{position:fixed;right:24px;bottom:24px;z-index:1000001;display:flex;align-items:center;gap:8px;padding:9px 14px;border-radius:8px;background:#1f2329;color:#f5f6f7;font-size:12.5px;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei","Segoe UI",sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.28);opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity .2s ease,transform .2s ease}
#luogu-upload-toast.is-visible{opacity:1;transform:translateY(0)}
#luogu-upload-toast .lgb-icon{color:#4ade80}
#luogu-upload-toast.is-error .lgb-icon{color:#f87171}
.lgb-toast-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,.25);border-top-color:#fff;border-radius:50%;animation:lgb-spin .7s linear infinite}
@keyframes lgb-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){
    #luogu-bg-panel,#luogu-upload-toast,#luogu-bg-panel .lgb-block,#luogu-bg-panel .lgb-switch,#luogu-bg-panel .lgb-switch::after{transition:none}
    .lgb-toast-spinner{animation-duration:1.4s}
}
`);
    }

    function createLayer() {
        let el = document.getElementById('luogu-bg-layer');
        if (el) el.remove();
        el = document.createElement('div');
        el.id = 'luogu-bg-layer';
        el.innerHTML = '<div class="bg-inner"></div>';
        document.body.insertBefore(el, document.body.firstChild);
    }

    function updateGlassOverlay(s) {
        let overlay = document.getElementById('luogu-glass-overlay');
        const isArticle = location.pathname.startsWith('/article/') && !location.pathname.startsWith('/article/mine');
        const isEdit = location.pathname.endsWith('/edit');
        const shouldShow = s.globalGlass || (!s.articleTransparent && isArticle && !isEdit);
        if (shouldShow) {
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'luogu-glass-overlay';
                document.body.insertBefore(overlay, document.querySelector('#app') || document.body.firstChild);
            }
            overlay.style.display = 'block';
        } else if (overlay) {
            overlay.style.display = 'none';
        }
    }

    function applyFilters(s) {
        const f = [];
        if (s.blur > 0) f.push(`blur(${s.blur}px)`);
        if (s.bgBrightness !== 1.0) f.push(`brightness(${s.bgBrightness})`);
        if (s.bgSaturation !== 1.0) f.push(`saturate(${s.bgSaturation})`);
        const filter = f.join(' ') || 'none';
        const inner = document.querySelector('#luogu-bg-layer .bg-inner');
        const video = document.querySelector('#luogu-bg-layer video');
        if (inner) inner.style.filter = filter;
        if (video) video.style.filter = filter;
    }

    function updateVars(s) {
        const r = document.documentElement.style;
        r.setProperty('--lgb-nav-opacity', s.navOpacity);
        r.setProperty('--lgb-card-opacity', s.cardOpacity);
        r.setProperty('--lgb-footer-opacity', s.footerOpacity);
    }

    function applyAppearance(s) {
        updateVars(s);
        applyFilters(s);
        updateGlassOverlay(s);
    }

    async function renderMedia(media, s) {
        const layer = document.getElementById('luogu-bg-layer');
        if (!layer) return;
        const inner = layer.querySelector('.bg-inner');
        if (!inner) return;

        layer.querySelectorAll('video').forEach(v => v.remove());
        inner.style.backgroundImage = '';

        if (!s.enableBgLayer) { layer.style.display = 'none'; return; }
        layer.style.display = '';

        try {
            const url = media2url(media);
            if (media.type === 'image') {
                inner.style.backgroundImage = `url("${url}")`;
            } else if (media.type === 'video') {
                const v = document.createElement('video');
                v.src = url;
                v.autoplay = true; v.muted = true; v.playsInline = true;
                v.loop = media.loop !== false;
                v.style.pointerEvents = 'none';
                layer.appendChild(v);
            }
        } catch (e) { console.error(e); }
        applyFilters(s);
    }

    async function setBackgroundById(id, s) {
        const media = await dbGet(id);
        if (!media) return;
        s.currentBgId = Number(id);
        saveSettings(s);
        await renderMedia(media, s);
    }

    async function pickRandomBackground(s, providedMedia) {
        const layer = document.getElementById('luogu-bg-layer');
        if (!layer) return;
        const inner = layer.querySelector('.bg-inner');
        if (!inner) return;

        layer.querySelectorAll('video').forEach(v => v.remove());
        inner.style.backgroundImage = '';

        if (!s.enableBgLayer) { layer.style.display = 'none'; return; }
        layer.style.display = '';

        const allMedia = providedMedia || await dbAllMedia();
        if (!allMedia.length) {
            inner.style.backgroundImage = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 30%, #0f3460 60%, #1a1a2e 100%)';
            s.currentBgId = null;
            saveSettings(s);
            applyFilters(s);
            return;
        }

        const now = Date.now();
        const weights = allMedia.map(m => Math.max(1, now - (m.lastUsed || 0)));
        const total = weights.reduce((a, b) => a + b, 0);
        let rand = Math.random() * total, idx = 0;
        for (let i = 0; i < weights.length; i++) {
            rand -= weights[i];
            if (rand <= 0) { idx = i; break; }
        }
        const media = allMedia[idx];
        s.currentBgId = media.id;
        saveSettings(s);
        await dbUpdate(media.id, { lastUsed: now });
        await renderMedia(media, s);
    }

    async function refreshBackground(s, providedMedia) {
        const allMedia = providedMedia || await dbAllMedia();
        const layer = document.getElementById('luogu-bg-layer');
        if (!layer) return;
        const inner = layer.querySelector('.bg-inner');
        if (!inner) return;

        if (!allMedia.length) {
            layer.querySelectorAll('video').forEach(v => v.remove());
            inner.style.backgroundImage = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 30%, #0f3460 60%, #1a1a2e 100%)';
            s.currentBgId = null;
            saveSettings(s);
            applyFilters(s);
            return;
        }

        if (s.randomBg || !s.currentBgId || !allMedia.some(m => m.id == s.currentBgId)) {
            await pickRandomBackground(s, allMedia);
        } else {
            const media = allMedia.find(m => m.id == s.currentBgId);
            if (media) {
                await dbUpdate(media.id, { lastUsed: Date.now() });
                await renderMedia(media, s);
            }
        }
    }

    function openFile() {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/*,video/mp4';
        inp.addEventListener('change', async e => {
            const f = e.target.files[0];
            if (!f) return;
            if (f.type.startsWith('video/')) {
                toast('start');
                try {
                    const buf = await blob2buf(f);
                    const count = (await dbAllMedia()).length;
                    if (count >= MAX) { alert(`最多只能添加 ${MAX} 个媒体`); toast('done'); return; }
                    await dbAdd({ type: 'video', mime: f.type, data: buf, loop: true, lastUsed: 0 });
                    const s = loadSettings();
                    await refreshBackground(s);
                    applyAppearance(s);
                    await refreshPanel();
                    toast('done');
                } catch (er) {
                    console.error(er);
                    toast('error');
                    alert('视频保存失败');
                }
            } else {
                const reader = new FileReader();
                reader.onload = ev => startCropper(ev.target.result);
                reader.onerror = () => alert('无法读取该文件');
                reader.readAsDataURL(f);
            }
        });
        inp.click();
    }

    function startCropper(src) {
        const modal = document.createElement('div');
        modal.id = 'luogu-cropper-modal';
        modal.innerHTML = `
<div class="lgb-crop" role="dialog" aria-modal="true" aria-label="裁剪背景图片">
    <div class="lgb-crop__head">
        ${icon('crop', 16)}
        <span class="lgb-crop__title">裁剪背景图片</span>
        <button type="button" class="lgb-icon-btn" data-close title="取消" aria-label="取消">${icon('x', 16)}</button>
    </div>
    <div class="lgb-crop__stage">
        <div class="lgb-crop__canvas">
            <img class="lgb-crop__img" alt="" draggable="false">
            <div class="lgb-crop__box" hidden>
                <span class="lgb-crop__line lgb-crop__line--v" style="left:33.333%"></span>
                <span class="lgb-crop__line lgb-crop__line--v" style="left:66.666%"></span>
                <span class="lgb-crop__line lgb-crop__line--h" style="top:33.333%"></span>
                <span class="lgb-crop__line lgb-crop__line--h" style="top:66.666%"></span>
                ${['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(d => `<span class="lgb-crop__handle" data-dir="${d}"></span>`).join('')}
            </div>
        </div>
    </div>
    <div class="lgb-crop__foot">
        <span class="lgb-crop__hint">正在加载图片…</span>
        <button type="button" class="lgb-btn" data-cancel>取消</button>
        <button type="button" class="lgb-btn lgb-btn--primary" data-confirm disabled>${icon('check', 14)}确认裁剪</button>
    </div>
</div>`;
        document.body.appendChild(modal);

        const wrap = modal.querySelector('.lgb-crop__canvas');
        const img = modal.querySelector('.lgb-crop__img');
        const boxEl = modal.querySelector('.lgb-crop__box');
        const confirmBtn = modal.querySelector('[data-confirm]');
        const hint = modal.querySelector('.lgb-crop__hint');

        const aspect = innerWidth / innerHeight;
        let naturalW = 0, naturalH = 0, viewW = 0, viewH = 0, ready = false, closed = false;
        const crop = { x: 0, y: 0, w: 0, h: 0 };
        const prevOverflow = document.body.style.overflow;
        const lastFocus = document.activeElement;
        document.body.style.overflow = 'hidden';

        const applyBox = () => {
            boxEl.style.left = crop.x + 'px';
            boxEl.style.top = crop.y + 'px';
            boxEl.style.width = crop.w + 'px';
            boxEl.style.height = crop.h + 'px';
        };

        const onKey = e => {
            if (e.key === 'Escape') { e.preventDefault(); close(); }
        };
        const close = () => {
            if (closed) return;
            closed = true;
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
            modal.remove();
            if (lastFocus && lastFocus.isConnected) lastFocus.focus();
        };
        document.addEventListener('keydown', onKey);

        modal.querySelector('[data-close]').addEventListener('click', close);
        modal.querySelector('[data-cancel]').addEventListener('click', close);
        modal.addEventListener('click', e => { if (e.target === modal) close(); });
        confirmBtn.addEventListener('click', async () => {
            if (!ready || confirmBtn.disabled) return;
            toast('start');
            confirmBtn.disabled = true;
            try {
                const count = (await dbAllMedia()).length;
                if (count >= MAX) {
                    alert(`最多只能添加 ${MAX} 个媒体`);
                    toast('done');
                    confirmBtn.disabled = false;
                    return;
                }
                const sx = (crop.x / viewW) * naturalW;
                const sy = (crop.y / viewH) * naturalH;
                const sw = (crop.w / viewW) * naturalW;
                const sh = (crop.h / viewH) * naturalH;
                const targetW = Math.max(1, Math.min(2560, Math.round(sw)));
                const targetH = Math.max(1, Math.round(targetW / aspect));
                const canvas = document.createElement('canvas');
                canvas.width = targetW;
                canvas.height = targetH;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, targetW, targetH);
                ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                await dbAdd({ type: 'image', data: dataUrl, lastUsed: 0 });
                const s = loadSettings();
                await refreshBackground(s);
                applyAppearance(s);
                await refreshPanel();
                toast('done');
                close();
            } catch (er) {
                console.error(er);
                toast('error');
                alert('裁剪失败，请重试');
                confirmBtn.disabled = false;
            }
        });

        boxEl.addEventListener('pointerdown', e => {
            if (!ready || e.target.closest('.lgb-crop__handle')) return;
            e.preventDefault();
            const startX = e.clientX, startY = e.clientY;
            const baseX = crop.x, baseY = crop.y;
            const onMove = ev => {
                crop.x = clamp(baseX + ev.clientX - startX, 0, viewW - crop.w);
                crop.y = clamp(baseY + ev.clientY - startY, 0, viewH - crop.h);
                applyBox();
            };
            const onUp = () => {
                boxEl.removeEventListener('pointermove', onMove);
                boxEl.removeEventListener('pointerup', onUp);
                boxEl.removeEventListener('pointercancel', onUp);
            };
            try { boxEl.setPointerCapture(e.pointerId); } catch (_) {}
            boxEl.addEventListener('pointermove', onMove);
            boxEl.addEventListener('pointerup', onUp);
            boxEl.addEventListener('pointercancel', onUp);
        });

        boxEl.querySelectorAll('.lgb-crop__handle').forEach(handle => {
            handle.addEventListener('pointerdown', e => {
                if (!ready) return;
                e.preventDefault();
                e.stopPropagation();
                const dir = handle.dataset.dir;
                const sx = dir.includes('e') ? 1 : dir.includes('w') ? -1 : 0;
                const sy = dir.includes('s') ? 1 : dir.includes('n') ? -1 : 0;
                const anchorX = sx === 1 ? crop.x : sx === -1 ? crop.x + crop.w : crop.x + crop.w / 2;
                const anchorY = sy === 1 ? crop.y : sy === -1 ? crop.y + crop.h : crop.y + crop.h / 2;

                const onMove = ev => {
                    let targetW;
                    if (sx !== 0) targetW = Math.abs(ev.clientX - anchorX);
                    else targetW = Math.abs(ev.clientY - anchorY) * aspect;
                    if (sx !== 0 && sy !== 0) {
                        targetW = Math.max(targetW, Math.abs(ev.clientY - anchorY) * aspect);
                    }
                    let maxW = Infinity;
                    if (sx === 1) maxW = Math.min(maxW, viewW - anchorX);
                    else if (sx === -1) maxW = Math.min(maxW, anchorX);
                    else maxW = Math.min(maxW, 2 * Math.min(anchorX, viewW - anchorX));
                    if (sy === 1) maxW = Math.min(maxW, (viewH - anchorY) * aspect);
                    else if (sy === -1) maxW = Math.min(maxW, anchorY * aspect);
                    else maxW = Math.min(maxW, 2 * Math.min(anchorY, viewH - anchorY) * aspect);
                    if (!isFinite(maxW) || maxW <= 0) return;
                    targetW = clamp(targetW, Math.min(48, maxW), maxW);
                    const targetH = targetW / aspect;
                    const x = sx === 1 ? anchorX : sx === -1 ? anchorX - targetW : anchorX - targetW / 2;
                    const y = sy === 1 ? anchorY : sy === -1 ? anchorY - targetH : anchorY - targetH / 2;
                    crop.x = clamp(x, 0, viewW - targetW);
                    crop.y = clamp(y, 0, viewH - targetH);
                    crop.w = targetW;
                    crop.h = targetH;
                    applyBox();
                };
                const onUp = () => {
                    handle.removeEventListener('pointermove', onMove);
                    handle.removeEventListener('pointerup', onUp);
                    handle.removeEventListener('pointercancel', onUp);
                };
                try { handle.setPointerCapture(e.pointerId); } catch (_) {}
                handle.addEventListener('pointermove', onMove);
                handle.addEventListener('pointerup', onUp);
                handle.addEventListener('pointercancel', onUp);
            });
        });

        img.addEventListener('load', () => {
            naturalW = img.naturalWidth;
            naturalH = img.naturalHeight;
            if (!naturalW || !naturalH) { hint.textContent = '无法读取图片尺寸'; return; }
            const maxW = Math.max(240, Math.min(innerWidth - 96, 1000));
            const maxH = Math.max(160, Math.min(innerHeight - 210, 680));
            const scale = Math.min(maxW / naturalW, maxH / naturalH);
            viewW = Math.max(1, Math.round(naturalW * scale));
            viewH = Math.max(1, Math.round(naturalH * scale));
            wrap.style.width = viewW + 'px';
            wrap.style.height = viewH + 'px';
            img.style.width = viewW + 'px';
            img.style.height = viewH + 'px';

            let bw = viewW * 0.82;
            let bh = bw / aspect;
            if (bh > viewH * 0.82) { bh = viewH * 0.82; bw = bh * aspect; }
            bw = Math.min(bw, viewW);
            bh = Math.min(bh, viewH);
            crop.w = Math.max(24, bw);
            crop.h = crop.w / aspect;
            if (crop.w > viewW) { crop.w = viewW; crop.h = crop.w / aspect; }
            if (crop.h > viewH) { crop.h = viewH; crop.w = crop.h * aspect; }
            crop.x = (viewW - crop.w) / 2;
            crop.y = (viewH - crop.h) / 2;
            applyBox();
            boxEl.hidden = false;
            confirmBtn.disabled = false;
            ready = true;
            hint.textContent = '拖动裁剪框移动，拖动边角调整大小';
            setTimeout(() => confirmBtn.focus(), 0);
        });
        img.addEventListener('error', () => {
            hint.textContent = '图片加载失败，请关闭后重试';
            confirmBtn.disabled = true;
        });
        img.src = src;
    }

    async function addUrl(url) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const blob = await res.blob();
            if (blob.type.startsWith('video/')) {
                toast('start');
                try {
                    const buf = await blob2buf(blob);
                    const count = (await dbAllMedia()).length;
                    if (count >= MAX) { alert(`最多只能添加 ${MAX} 个媒体`); toast('done'); return; }
                    await dbAdd({ type: 'video', mime: blob.type, data: buf, loop: true, lastUsed: 0 });
                    const s = loadSettings();
                    await refreshBackground(s);
                    applyAppearance(s);
                    await refreshPanel();
                    toast('done');
                } catch (er) {
                    console.error(er);
                    toast('error');
                    alert('视频保存失败');
                }
            } else {
                const reader = new FileReader();
                reader.onload = e => startCropper(e.target.result);
                reader.onerror = () => alert('无法读取该文件');
                reader.readAsDataURL(blob);
            }
        } catch (e) {
            console.error(e);
            toast('error');
            alert('无法加载该 URL');
        }
    }

    function sliderMarkup(id, valId, label, min, max, value, step, text) {
        return `<div class="lgb-slider">
            <div class="lgb-slider-head"><label for="${id}">${label}</label><span class="lgb-value" id="${valId}">${text}</span></div>
            <input type="range" id="${id}" min="${min}" max="${max}" value="${value}" step="${step}">
        </div>`;
    }

    function switchMarkup(id, title, desc, checked) {
        return `<label class="lgb-switch-row">
            <span class="lgb-switch-copy"><span class="lgb-switch-title">${title}</span><span class="lgb-switch-desc">${desc}</span></span>
            <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>
            <span class="lgb-switch"></span>
        </label>`;
    }

    function mediaItemMarkup(m) {
        const del = `<button type="button" class="lgb-icon-btn" data-delete="${m.id}" title="删除" aria-label="删除">${icon('trash2', 12)}</button>`;
        if (m.type === 'image') {
            return `<div class="lgb-media-item" data-id="${m.id}" title="点击设为背景">
                <img src="${media2url(m)}" alt="" loading="lazy" decoding="async">
                <span class="lgb-media-actions">${del}</span>
            </div>`;
        }
        const loop = m.loop !== false;
        return `<div class="lgb-media-item" data-id="${m.id}" title="点击设为背景">
            <span class="lgb-media-fallback">${icon('film', 20)}</span>
            <span class="lgb-media-actions">${del}</span>
            <button type="button" class="lgb-icon-btn lgb-loop-btn" data-loop="${m.id}" title="${loop ? '循环播放：开' : '循环播放：关'}" aria-label="切换循环播放">${icon(loop ? 'repeat' : 'play', 12)}</button>
        </div>`;
    }

    function emptyMediaMarkup() {
        return `<div class="lgb-empty">${icon('image', 22)}<span>还没有媒体</span><span class="lgb-empty-sub">粘贴链接或上传本地文件</span></div>`;
    }

    function buildPanel(s, allMedia) {
        const pct = v => Math.round(v * 100);
        return `<div class="lgb-head">
            <span class="lgb-head-title">${icon('image', 16)}<span>背景设置</span></span>
            <button type="button" class="lgb-icon-btn" id="btn-close-panel" title="收起面板" aria-label="收起面板">${icon('x', 16)}</button>
        </div>
        <div class="lgb-body">
            <div class="lgb-url-row">
                <input type="url" id="bg-url-input" placeholder="粘贴图片或视频链接" spellcheck="false" autocomplete="off">
                <button type="button" class="lgb-icon-btn" id="bg-add-url" title="从链接添加" aria-label="从链接添加">${icon('plus', 16)}</button>
                <button type="button" class="lgb-icon-btn" id="bg-upload-file" title="上传本地文件" aria-label="上传本地文件">${icon('upload', 16)}</button>
            </div>
            <div class="lgb-media-head">
                <span class="lgb-media-title">媒体库</span>
                <span class="lgb-media-count">${allMedia.length} / ${MAX}</span>
            </div>
            <div class="lgb-media-list" id="bg-image-list"></div>
            <button type="button" class="lgb-section collapsed" id="toggle-settings">
                <span>图片调整</span><span class="lgb-chevron">${icon('chevronDown', 14)}</span>
            </button>
            <div class="lgb-block collapsed" id="settings-block">
                ${sliderMarkup('blur-slider', 'blur-val', '模糊', 0, 40, Math.round(s.blur), 1, `${Math.round(s.blur)}px`)}
                ${sliderMarkup('brightness-slider', 'brightness-val', '亮度', 30, 200, pct(s.bgBrightness), 5, `${pct(s.bgBrightness)}%`)}
                ${sliderMarkup('saturation-slider', 'saturation-val', '饱和度', 0, 200, pct(s.bgSaturation), 5, `${pct(s.bgSaturation)}%`)}
            </div>
            <button type="button" class="lgb-section collapsed" id="toggle-transparency">
                <span>区域透明度</span><span class="lgb-chevron">${icon('chevronDown', 14)}</span>
            </button>
            <div class="lgb-block collapsed" id="transparency-block">
                ${sliderMarkup('nav-opacity-slider', 'nav-opacity-val', '导航栏', 15, 100, pct(s.navOpacity), 1, `${pct(s.navOpacity)}%`)}
                ${sliderMarkup('card-opacity-slider', 'card-opacity-val', '卡片', 15, 100, pct(s.cardOpacity), 1, `${pct(s.cardOpacity)}%`)}
                ${sliderMarkup('footer-opacity-slider', 'footer-opacity-val', '底部区域', 10, 100, pct(s.footerOpacity), 1, `${pct(s.footerOpacity)}%`)}
            </div>
            ${switchMarkup('article-transparent-check', '专栏全透明', '文章页完全透出背景', s.articleTransparent)}
            ${switchMarkup('global-glass-check', '毛玻璃效果', '在背景上叠加模糊遮罩', s.globalGlass)}
            ${switchMarkup('random-bg-check', '随机背景', '每次打开页面随机切换', s.randomBg)}
            <div class="lgb-actions">
                <button type="button" class="lgb-btn" id="btn-reset">${icon('rotateCcw', 14)}恢复默认</button>
                <button type="button" class="lgb-btn lgb-btn--danger" id="btn-clearall">${icon('trash2', 14)}清空媒体</button>
            </div>
        </div>`;
    }

    async function refreshPanel(allMedia) {
        const list = document.getElementById('bg-image-list');
        if (!list) return;
        const media = allMedia || await dbAllMedia();
        const countEl = document.querySelector('#luogu-bg-panel .lgb-media-count');
        if (countEl) countEl.textContent = `${media.length} / ${MAX}`;
        if (!media.length) { list.innerHTML = emptyMediaMarkup(); return; }
        list.innerHTML = media.map(mediaItemMarkup).join('');

        const current = loadSettings().currentBgId;
        list.querySelectorAll('.lgb-media-item').forEach(item => {
            if (current != null && item.dataset.id == current) item.classList.add('is-active');
            item.addEventListener('click', async e => {
                if (e.target.closest('[data-delete]') || e.target.closest('[data-loop]')) return;
                const id = item.dataset.id;
                const s = loadSettings();
                await setBackgroundById(id, s);
                list.querySelectorAll('.lgb-media-item').forEach(n => n.classList.toggle('is-active', n === item));
            });
        });

        list.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', async e => {
            e.stopPropagation();
            const id = Number(b.dataset.delete);
            await dbDelete(id);
            revokeURL(id);
            const s = loadSettings();
            if (s.currentBgId == id) s.currentBgId = null;
            saveSettings(s);
            await refreshBackground(s);
            applyAppearance(s);
            await refreshPanel();
        }));

        list.querySelectorAll('[data-loop]').forEach(b => b.addEventListener('click', async e => {
            e.stopPropagation();
            const id = b.dataset.loop;
            const m = await dbGet(id);
            if (m?.type === 'video') {
                const newLoop = m.loop === false;
                await dbUpdate(id, { loop: newLoop });
                b.innerHTML = icon(newLoop ? 'repeat' : 'play', 12);
                b.title = newLoop ? '循环播放：开' : '循环播放：关';
                const s = loadSettings();
                if (s.currentBgId == id) await renderMedia({ ...m, loop: newLoop }, s);
            }
        }));
    }

    function bindEvents(panel, settings, onChange) {
        const uploadBtn = panel.querySelector('#bg-upload-file');
        if (uploadBtn) uploadBtn.addEventListener('click', openFile);

        const urlInput = panel.querySelector('#bg-url-input');
        const addUrlBtn = panel.querySelector('#bg-add-url');
        const submitUrl = () => {
            const url = urlInput.value.trim();
            if (url) { addUrl(url); urlInput.value = ''; }
        };
        if (addUrlBtn) addUrlBtn.addEventListener('click', submitUrl);
        if (urlInput) {
            urlInput.addEventListener('keydown', e => {
                if (e.key === 'Enter') { e.preventDefault(); submitUrl(); }
            });
        }

        const bindS = (id, vid, get, set, fmt) => {
            const s = panel.querySelector(id), d = panel.querySelector(vid);
            if (!s || !d) return;
            s.addEventListener('input', () => {
                const v = get(s);
                set(settings, v);
                d.textContent = fmt(v);
                onChange(settings);
            });
        };
        bindS('#blur-slider', '#blur-val', s => parseInt(s.value), (s, v) => s.blur = v, v => `${v}px`);
        bindS('#brightness-slider', '#brightness-val', s => parseInt(s.value) / 100, (s, v) => s.bgBrightness = clamp(v, 0.3, 2.0), v => `${Math.round(v * 100)}%`);
        bindS('#saturation-slider', '#saturation-val', s => parseInt(s.value) / 100, (s, v) => s.bgSaturation = clamp(v, 0, 2.0), v => `${Math.round(v * 100)}%`);
        bindS('#nav-opacity-slider', '#nav-opacity-val', s => parseInt(s.value) / 100, (s, v) => s.navOpacity = clamp(v, 0.15, 1), v => `${Math.round(v * 100)}%`);
        bindS('#card-opacity-slider', '#card-opacity-val', s => parseInt(s.value) / 100, (s, v) => s.cardOpacity = clamp(v, 0.15, 1), v => `${Math.round(v * 100)}%`);
        bindS('#footer-opacity-slider', '#footer-opacity-val', s => parseInt(s.value) / 100, (s, v) => s.footerOpacity = clamp(v, 0.1, 1), v => `${Math.round(v * 100)}%`);

        const toggle1 = panel.querySelector('#toggle-settings'), block1 = panel.querySelector('#settings-block');
        if (toggle1 && block1) {
            toggle1.addEventListener('click', () => {
                const c = toggle1.classList.toggle('collapsed');
                block1.classList.toggle('collapsed', c);
            });
        }
        const toggle2 = panel.querySelector('#toggle-transparency'), block2 = panel.querySelector('#transparency-block');
        if (toggle2 && block2) {
            toggle2.addEventListener('click', () => {
                const c = toggle2.classList.toggle('collapsed');
                block2.classList.toggle('collapsed', c);
            });
        }

        panel.querySelector('#article-transparent-check').addEventListener('change', e => {
            settings.articleTransparent = e.target.checked;
            onChange(settings); saveSettings(settings);
        });
        panel.querySelector('#global-glass-check').addEventListener('change', e => {
            settings.globalGlass = e.target.checked;
            onChange(settings); saveSettings(settings);
        });
        panel.querySelector('#random-bg-check').addEventListener('change', e => {
            settings.randomBg = e.target.checked;
            saveSettings(settings);
            if (settings.randomBg) refreshBackground(settings);
        });

        panel.querySelector('#btn-reset').addEventListener('click', async () => {
            Object.assign(settings, DEFAULTS);
            settings.currentBgId = null;
            saveSettings(settings);
            refreshUI(panel, settings);
            await refreshBackground(settings);
            applyAppearance(settings);
            await refreshPanel();
        });

        panel.querySelector('#btn-clearall').addEventListener('click', async () => {
            if (confirm('确定清空所有媒体？')) {
                await dbClear();
                revokeAllURL();
                settings.currentBgId = null;
                saveSettings(settings);
                refreshUI(panel, settings);
                await refreshBackground(settings);
                applyAppearance(settings);
                await refreshPanel();
            }
        });

        panel.querySelector('#btn-close-panel').addEventListener('click', () => {
            settings.panelCollapsed = true;
            panel.classList.add('collapsed');
            saveSettings(settings);
        });
    }

    function refreshUI(panel, s) {
        const setV = (id, val) => { const el = panel.querySelector(id); if (el) el.value = Math.round(val); };
        setV('#blur-slider', s.blur);
        setV('#brightness-slider', s.bgBrightness * 100);
        setV('#saturation-slider', s.bgSaturation * 100);
        setV('#nav-opacity-slider', s.navOpacity * 100);
        setV('#card-opacity-slider', s.cardOpacity * 100);
        setV('#footer-opacity-slider', s.footerOpacity * 100);

        panel.querySelector('#blur-val').textContent = s.blur + 'px';
        panel.querySelector('#brightness-val').textContent = Math.round(s.bgBrightness * 100) + '%';
        panel.querySelector('#saturation-val').textContent = Math.round(s.bgSaturation * 100) + '%';
        panel.querySelector('#nav-opacity-val').textContent = Math.round(s.navOpacity * 100) + '%';
        panel.querySelector('#card-opacity-val').textContent = Math.round(s.cardOpacity * 100) + '%';
        panel.querySelector('#footer-opacity-val').textContent = Math.round(s.footerOpacity * 100) + '%';

        const artCheck = panel.querySelector('#article-transparent-check');
        if (artCheck) artCheck.checked = s.articleTransparent;
        const glassCheck = panel.querySelector('#global-glass-check');
        if (glassCheck) glassCheck.checked = s.globalGlass;
        const randomCheck = panel.querySelector('#random-bg-check');
        if (randomCheck) randomCheck.checked = s.randomBg;
    }

    function menu() {
        const side = document.querySelector('nav.sidebar.lside');
        if (!side) return;
        const grp = [...side.querySelectorAll('.nav-group')]
            .find(g => g.querySelector('.group-title .title')?.textContent.includes('更多功能'));
        if (!grp) return;
        const ul = grp.querySelector('ul');
        if (!ul || ul.querySelector('[data-bg-custom-menu]')) return;
        const ref = [...ul.children].find(li => li.textContent.includes('图片上传'));
        if (!ref) return;
        const li = ref.cloneNode(true);
        li.setAttribute('data-bg-custom-menu', 'true');
        const titleEl = li.querySelector('.title.minor');
        if (titleEl) titleEl.textContent = '背景设置';
        const a = li.querySelector('a');
        if (a) {
            a.removeAttribute('href');
            a.addEventListener('click', e => { e.preventDefault(); showPanel(); });
        }
        ul.insertBefore(li, ref);
    }

    function showPanel() {
        const p = document.getElementById('luogu-bg-panel');
        if (!p) return;
        const wasCollapsed = p.classList.contains('collapsed');
        p.classList.remove('collapsed');
        if (wasCollapsed) refreshPanel();
        const s = loadSettings();
        s.panelCollapsed = false;
        saveSettings(s);
    }

    let menuScheduled = false;
    let layerCheckScheduled = false;

    async function createPanel(settings, onChange, allMedia) {
        const old = document.getElementById('luogu-bg-panel');
        if (old) old.remove();
        const media = allMedia || await dbAllMedia();
        const panel = document.createElement('div');
        panel.id = 'luogu-bg-panel';
        if (settings.panelCollapsed) panel.classList.add('collapsed');
        panel.innerHTML = buildPanel(settings, media);
        document.body.appendChild(panel);
        bindEvents(panel, settings, onChange);
        if (!settings.panelCollapsed) await refreshPanel(media);
        return panel;
    }

    async function init() {
        injectStyles();
        const s = loadSettings();
        createLayer();

        let allMedia = [];
        try { allMedia = await dbAllMedia(); } catch (e) { console.error('读取本地媒体失败', e); }

        await refreshBackground(s, allMedia);
        applyAppearance(s);

        await createPanel(s, async upd => {
            applyAppearance(upd);
            saveSettings(upd);
        }, allMedia);

        menu();

        new MutationObserver(() => {
            if (menuScheduled) return;
            menuScheduled = true;
            requestAnimationFrame(() => { menuScheduled = false; menu(); });
        }).observe(document.body, { childList: true, subtree: true });

        new MutationObserver(() => {
            if (layerCheckScheduled) return;
            layerCheckScheduled = true;
            requestAnimationFrame(async () => {
                layerCheckScheduled = false;
                if (!document.getElementById('luogu-bg-layer')) {
                    createLayer();
                    const cur = loadSettings();
                    await refreshBackground(cur);
                    applyAppearance(cur);
                } else {
                    updateVars(s);
                    updateGlassOverlay(s);
                }
            });
        }).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
