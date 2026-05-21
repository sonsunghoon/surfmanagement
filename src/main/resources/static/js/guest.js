'use strict';

const C = SURF_SHOP_CONSTANTS;

let selectedShop = null;
let shopsData = [];

/* ── API Helper ── */
async function api(url, options = {}) {
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
    });
    return res.json();
}

/* ── DOM Helpers ── */
const $ = (id) => document.getElementById(id);
const show = (id) => $(id).classList.remove('hidden');
const hide = (id) => $(id).classList.add('hidden');

function showAlert(containerId, message, type = 'danger') {
    const el = $(containerId);
    el.className = `alert alert-${type}`;
    el.textContent = message;
    el.classList.remove('hidden');
}

function hideAlert(id) { $(id).classList.add('hidden'); }

/* ── Main Tab Switch ── */
function switchMainTab(tab) {
    document.querySelectorAll('.tabs .tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });
    hide('tab-register');
    hide('tab-login');
    show(`tab-${tab}`);

    if (tab === 'login') loadLoginShops();
    if (tab === 'register') loadShops();
}

/* ══════════════════════
   회원 가입 플로우
══════════════════════ */

function goToStep(step) {
    hide('step-shop');
    hide('step-form');
    hide('step-success');
    show(`step-${step}`);
    updateStepIndicator(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateStepIndicator(step) {
    const map = { shop: 1, form: 2, success: 3 };
    const stepNum = map[step] || 1;
    const dots = document.querySelectorAll('.step-dot');
    const lines = document.querySelectorAll('.step-line');
    dots.forEach((dot, i) => {
        const n = i + 1;
        dot.classList.remove('active', 'done');
        if (n < stepNum) dot.classList.add('done');
        else if (n === stepNum) dot.classList.add('active');
    });
    lines.forEach((line, i) => line.classList.toggle('done', i + 1 < stepNum));
}

async function loadShops() {
    const grid = $('shop-grid');
    grid.innerHTML = '<div class="text-center mt-16"><span class="spinner dark"></span></div>';
    try {
        const data = await api(C.API.SHOPS);
        if (!data.success || !data.data.length) {
            grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🏄</div><p>등록된 서핑샵이 없습니다.</p></div>';
            return;
        }
        shopsData = data.data;
        const icons = ['🌊', '🏄', '🐚'];
        grid.innerHTML = data.data.map((shop, i) => `
            <div class="shop-card fade-in" data-id="${shop.id}" data-name="${escapeAttr(shop.name)}"
                 style="animation-delay:${i * 0.08}s" onclick="selectShop(this, ${shop.id}, '${escapeAttr(shop.name)}')">
                <div class="shop-icon">${icons[i % icons.length]}</div>
                <div class="shop-info">
                    <div class="shop-name">${escapeHtml(shop.name)}</div>
                    <div class="shop-location">📍 ${escapeHtml(shop.location)}</div>
                    ${shop.description ? `<div class="shop-desc">${escapeHtml(shop.description)}</div>` : ''}
                </div>
                <div class="select-arrow">›</div>
            </div>
        `).join('');
    } catch {
        grid.innerHTML = `<div class="alert alert-danger">${C.MESSAGES.NETWORK_ERROR}</div>`;
    }
}

function selectShop(el, shopId, shopName) {
    document.querySelectorAll('.shop-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    selectedShop = { id: shopId, name: shopName };
    $('btn-next').disabled = false;
}

function goToForm() {
    if (!selectedShop) { alert(C.MESSAGES.SELECT_SHOP); return; }
    $('selected-shop-name').textContent = selectedShop.name;
    populateSelects();
    goToStep('form');
}

function populateSelects() {
    const boardSelect = $('board-type');
    const levelSelect = $('surf-level');
    if (!boardSelect.options.length || boardSelect.options[0].value === '') {
        boardSelect.innerHTML = '<option value="">선택하세요</option>' +
            C.BOARD_TYPES.map(b => `<option value="${b.value}">${b.label}</option>`).join('');
    }
    if (!levelSelect.options.length || levelSelect.options[0].value === '') {
        levelSelect.innerHTML = '<option value="">선택하세요</option>' +
            C.SURF_LEVELS.map(l => `<option value="${l.value}">${l.label}</option>`).join('');
    }
}

async function submitRegistration(e) {
    e.preventDefault();
    hideAlert('form-alert');
    const name = $('name').value.trim(), phone = $('phone').value.trim();
    const email = $('email').value.trim(), password = $('password').value;
    const board = $('board-type').value, level = $('surf-level').value;
    if (!name || !phone || !email || !password || !board || !level) {
        showAlert('form-alert', C.MESSAGES.REQUIRED_FIELDS); return;
    }
    const btn = $('btn-submit');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> 신청 중...';
    try {
        const data = await api(C.API.REGISTER, {
            method: 'POST',
            body: JSON.stringify({ shopId: selectedShop.id, name, phone, email, password, boardType: board, surfLevel: level }),
        });
        if (data.success) { goToStep('success'); }
        else { showAlert('form-alert', data.message || '신청 중 오류가 발생했습니다.'); }
    } catch { showAlert('form-alert', C.MESSAGES.NETWORK_ERROR); }
    finally { btn.disabled = false; btn.innerHTML = '신청하기'; }
}

/* ══════════════════════
   로그인 플로우
══════════════════════ */

async function loadLoginShops() {
    const sel = $('login-shop');
    if (sel.options.length > 1) return;
    try {
        const data = await api(C.API.SHOPS);
        if (data.success && data.data.length) {
            shopsData = data.data;
            sel.innerHTML = '<option value="">서핑샵을 선택하세요</option>' +
                data.data.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
        }
    } catch { /* silent */ }
}

async function submitLogin(e) {
    e.preventDefault();
    hideAlert('login-alert');
    const shopId = $('login-shop').value;
    const email = $('login-email').value.trim();
    const password = $('login-password').value;
    if (!shopId || !email || !password) {
        showAlert('login-alert', C.MESSAGES.REQUIRED_FIELDS); return;
    }
    const btn = $('btn-login');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> 로그인 중...';
    try {
        const data = await api(C.API.MEMBER_LOGIN, {
            method: 'POST',
            body: JSON.stringify({ shopId: Number(shopId), email, password }),
        });
        if (data.success) {
            const d = data.data;
            if (d.statusCode === 'PENDING') {
                showPendingScreen(d.memberName);
            } else {
                localStorage.setItem(C.STORAGE.MEMBER_TOKEN, d.token);
                localStorage.setItem(C.STORAGE.MEMBER_ID, String(d.memberId));
                localStorage.setItem(C.STORAGE.MEMBER_NAME, d.memberName);
                localStorage.setItem(C.STORAGE.MEMBER_SHOP_ID, String(d.shopId));
                localStorage.setItem(C.STORAGE.MEMBER_SHOP_NAME, d.shopName);
                window.location.href = '/member.html';
            }
        } else {
            showAlert('login-alert', data.message || '로그인에 실패했습니다.');
        }
    } catch { showAlert('login-alert', C.MESSAGES.NETWORK_ERROR); }
    finally { btn.disabled = false; btn.innerHTML = '로그인'; }
}

function showPendingScreen(name) {
    $('pending-msg').textContent = `${escapeHtml(name)}님, 관리자의 승인을 기다리고 있습니다.\n승인 후 서비스를 이용하실 수 있습니다.`;
    hide('login-section');
    show('pending-section');
}

/* ══════════════════════
   관리자(샵) 등록 플로우
══════════════════════ */

async function submitAdminRegister(e) {
    e.preventDefault();
    hideAlert('admin-reg-alert');

    const shopName     = $('ar-shop-name').value.trim();
    const shopLocation = $('ar-shop-location').value.trim();
    const shopDesc     = $('ar-shop-desc').value.trim();
    const email        = $('ar-email').value.trim();
    const password     = $('ar-password').value;
    const password2    = $('ar-password2').value;

    if (!shopName || !shopLocation || !email || !password || !password2) {
        showAlert('admin-reg-alert', '필수 항목을 모두 입력해주세요.'); return;
    }
    if (password !== password2) {
        showAlert('admin-reg-alert', '비밀번호가 일치하지 않습니다.'); return;
    }
    if (password.length < 8) {
        showAlert('admin-reg-alert', '비밀번호는 8자 이상이어야 합니다.'); return;
    }

    const btn = $('btn-admin-reg');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> 개설 중...';
    try {
        const data = await api(C.API.ADMIN_REGISTER, {
            method: 'POST',
            body: JSON.stringify({ email, password, shopName, shopLocation, shopDescription: shopDesc }),
        });
        if (data.success) {
            const d = data.data;
            localStorage.setItem('sb_admin_token', d.token);
            localStorage.setItem('sb_shop_name', d.shopName);
            localStorage.setItem('sb_shop_id', String(d.shopId));
            localStorage.setItem('sb_admin_email', d.adminEmail);
            window.location.href = '/admin.html';
        } else {
            showAlert('admin-reg-alert', data.message || '등록 중 오류가 발생했습니다.');
        }
    } catch { showAlert('admin-reg-alert', C.MESSAGES.NETWORK_ERROR); }
    finally { btn.disabled = false; btn.innerHTML = '서핑샵 개설하기'; }
}

/* ── Escape Helpers ── */
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(str) { return String(str).replace(/'/g, "\\'"); }

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
    loadLoginShops();
    updateStepIndicator('shop');

    document.querySelectorAll('.tabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchMainTab(btn.dataset.tab));
    });

    $('btn-next').addEventListener('click', goToForm);
    $('btn-back').addEventListener('click', () => goToStep('shop'));
    $('btn-restart').addEventListener('click', () => {
        selectedShop = null;
        document.querySelectorAll('.shop-card').forEach(c => c.classList.remove('selected'));
        $('btn-next').disabled = true;
        $('reg-form').reset();
        goToStep('shop');
    });
    $('reg-form').addEventListener('submit', submitRegistration);
    $('login-form').addEventListener('submit', submitLogin);
    $('btn-pending-back').addEventListener('click', () => {
        hide('pending-section');
        show('login-section');
        $('login-form').reset();
    });

    $('phone').addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length <= 3) e.target.value = v;
        else if (v.length <= 7) e.target.value = `${v.slice(0,3)}-${v.slice(3)}`;
        else e.target.value = `${v.slice(0,3)}-${v.slice(3,7)}-${v.slice(7,11)}`;
    });
});
