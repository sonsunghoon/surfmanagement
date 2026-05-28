'use strict';

const C = SURF_SHOP_CONSTANTS;

let currentToken = null;
let currentTab   = 'members';
let memberFilter = 'ALL';
let modalMemberId = null;
let keepingMemberId = null;
let memberNotifTargetId = null;
let selectedLessons = new Set();
let notifPanelOpen = false;
let notifPollTimer = null;

/* ── Storage ── */
const store = {
    get:      (k) => localStorage.getItem(C.STORAGE[k]),
    set:      (k, v) => localStorage.setItem(C.STORAGE[k], v),
    remove:   (k) => localStorage.removeItem(C.STORAGE[k]),
    clearAll: () => Object.keys(C.STORAGE)
        .filter(k => !k.startsWith('MEMBER'))
        .forEach(k => localStorage.removeItem(C.STORAGE[k])),
};

/* ── API Helper ── */
async function api(url, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;
    const res = await fetch(url, { headers, ...options });
    if (res.status === 401) { logout(); return null; }
    return res.json();
}

/* ── DOM ── */
const $    = (id) => document.getElementById(id);
const show = (id) => $(id).classList.remove('hidden');
const hide = (id) => $(id).classList.add('hidden');

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ── Login ── */
async function handleLogin(e) {
    e.preventDefault();
    hide('login-error');
    const email = $('admin-email').value.trim();
    const password = $('admin-password').value;
    if (!email || !password) { showLoginError('이메일과 비밀번호를 입력해주세요.'); return; }

    const btn = $('btn-login');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> 로그인 중...';
    try {
        const data = await fetch(C.API.ADMIN_LOGIN, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        }).then(r => r.json());

        if (data.success) {
            currentToken = data.data.token;
            store.set('TOKEN', currentToken);
            store.set('SHOP_NAME', data.data.shopName);
            store.set('SHOP_ID', String(data.data.shopId));
            store.set('EMAIL', data.data.adminEmail);
            showDashboard();
        } else {
            showLoginError(data.message || '로그인에 실패했습니다.');
        }
    } catch { showLoginError(C.MESSAGES.NETWORK_ERROR); }
    finally { btn.disabled = false; btn.innerHTML = '로그인'; }
}

function showLoginError(msg) { $('login-error').textContent = msg; show('login-error'); }

/* ── Admin Login Tab Switch ── */
/* ── Mobile Sidebar ── */
function toggleSidebar() {
    $('sidebar').classList.toggle('open');
    $('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
    $('sidebar').classList.remove('open');
    $('sidebar-overlay').classList.remove('open');
}

function switchAdminTab(tab) {
    $('tab-btn-login').classList.toggle('active', tab === 'login');
    $('tab-btn-register').classList.toggle('active', tab === 'register');
    if (tab === 'login') {
        show('admin-login-section');
        hide('admin-register-section');
    } else {
        hide('admin-login-section');
        show('admin-register-section');
    }
}

/* ── Admin Shop Register ── */
async function handleAdminRegister(e) {
    e.preventDefault();
    hide('admin-reg-error');
    const shopName     = $('ar-shop-name').value.trim();
    const shopLocation = $('ar-shop-location').value.trim();
    const shopDesc     = $('ar-shop-desc').value.trim();
    const email        = $('ar-email').value.trim();
    const password     = $('ar-password').value;
    const password2    = $('ar-password2').value;

    if (!shopName || !shopLocation || !email || !password || !password2) {
        showRegError('필수 항목을 모두 입력해주세요.'); return;
    }
    if (password !== password2) {
        showRegError('비밀번호가 일치하지 않습니다.'); return;
    }
    if (password.length < 8) {
        showRegError('비밀번호는 8자 이상이어야 합니다.'); return;
    }

    const btn = $('btn-admin-reg');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> 개설 중...';
    try {
        const data = await fetch(C.API.ADMIN_REGISTER, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, shopName, shopLocation, shopDescription: shopDesc }),
        }).then(r => r.json());

        if (data.success) {
            const d = data.data;
            currentToken = d.token;
            store.set('TOKEN', d.token);
            store.set('SHOP_NAME', d.shopName);
            store.set('SHOP_ID', String(d.shopId));
            store.set('EMAIL', d.adminEmail);
            showDashboard();
        } else {
            showRegError(data.message || '등록 중 오류가 발생했습니다.');
        }
    } catch { showRegError(C.MESSAGES.NETWORK_ERROR); }
    finally { btn.disabled = false; btn.innerHTML = '서핑샵 개설하기'; }
}

function showRegError(msg) { $('admin-reg-error').textContent = msg; show('admin-reg-error'); }

/* ── Dashboard ── */
function showDashboard() {
    hide('login-view');
    show('dashboard-view');
    const shopName = store.get('SHOP_NAME') || '';
    const email    = store.get('EMAIL') || '';
    $('header-shop').textContent = shopName;
    $('header-email').textContent = email;
    // Sidebar user section
    const sidebarShop  = $('sidebar-shop-name');
    const sidebarEmail = $('sidebar-user-email');
    const sidebarAva   = $('sidebar-ava');
    if (sidebarShop)  sidebarShop.textContent  = shopName;
    if (sidebarEmail) sidebarEmail.textContent = email;
    if (sidebarAva && shopName) sidebarAva.textContent = shopName.substring(0, 2);

    const dashShop = $('dashboard-shop-name');
    if (dashShop) dashShop.textContent = shopName;
    const dashDate = $('dashboard-date');
    if (dashDate) {
        const now = new Date();
        const days = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
        dashDate.textContent = `${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일 ${days[now.getDay()]}`;
    }

    loadDashboardStats();
    switchTab('members');
    startNotifPoll();
}

async function loadDashboardStats() {
    try {
        const data = await api(C.API.ADMIN_DASHBOARD);
        if (!data || !data.success) return;
        const d = data.data;
        const pending = d.pendingCount ?? 0;
        $('stat-pending').textContent  = pending;
        $('stat-approved').textContent = d.approvedCount  ?? '-';
        $('stat-lessons').textContent  = d.todayLessonCount ?? '-';
        $('stat-week-participants').textContent = d.weekParticipants ?? '-';
        // Sidebar badge for pending count
        const badge = $('sidebar-badge-pending');
        if (badge) {
            badge.textContent = pending;
            badge.classList.toggle('visible', pending > 0);
        }
        updateNotifBadge(d.unreadNotifications ?? 0);
    } catch { /* silent */ }
}

/* ── Tabs ── */
function switchTab(tab) {
    currentTab = tab;
    closeSidebar();
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    hide('tab-members'); hide('tab-lessons'); hide('tab-expiry');
    show(`tab-${tab}`);
    if (tab === 'members') loadMembers();
    if (tab === 'lessons') loadLessons();
    if (tab === 'expiry') loadExpiryDashboard();
}

/* ── Members ── */
async function loadMembers() {
    const list = $('member-list');
    list.innerHTML = '<div class="text-center mt-16"><span class="spinner dark"></span></div>';
    try {
        const data = await api(`${C.API.ADMIN_MEMBERS}?status=${memberFilter}`);
        if (!data || !data.success) { list.innerHTML = emptyState('회원 정보를 불러오지 못했습니다.'); return; }
        const members = data.data;
        if (!members.length) {
            list.innerHTML = emptyState(memberFilter === C.STATUS.PENDING ? '대기 중인 회원 신청이 없습니다.' : '회원이 없습니다.');
            return;
        }
        list.innerHTML = `<ul class="member-list">${members.map(renderMemberItem).join('')}</ul>`;
    } catch {
        list.innerHTML = `<div class="alert alert-danger">${C.MESSAGES.NETWORK_ERROR}</div>`;
    }
}

function renderMemberItem(m) {
    const initial = m.name ? m.name.charAt(0) : '?';
    const badgeClass = { PENDING: 'badge-pending', APPROVED: 'badge-approved', REJECTED: 'badge-rejected' }[m.statusCode] || 'badge-pending';

    let approveRejectBtns = '';
    if (m.statusCode === C.STATUS.PENDING) {
        approveRejectBtns = `
            <button class="btn btn-success btn-sm" onclick="approveMember(${m.id})">승인</button>
            <button class="btn btn-danger btn-sm" onclick="rejectMember(${m.id})">반려</button>`;
    }
    const deleteMemberBtn = `<button class="btn btn-sm" style="color:#ef4444;border:1px solid #ef4444;background:transparent" onclick="deleteMemberAccount(${m.id}, '${escapeHtml(m.name)}')">삭제</button>`;

    const membershipHtml = renderMembershipBadge(m.membership);
    const seasonHtml = m.seasonMembership ? `<span class="badge badge-period" style="background:#e0f2fe;color:#0369a1">🏄 시즌방 ${m.seasonMembership.remainDays}일</span>` : '';
    const keepingHtml = m.keeping ? renderKeepingBadge(m.keeping) : '';

    const membershipBtn = m.statusCode === C.STATUS.APPROVED
        ? `<button class="btn btn-outline btn-sm" onclick="openMembershipModal(${m.id}, '${escapeHtml(m.name)}')">
               ${m.membership ? '수업권 변경' : '수업권 부여'}
           </button>
           <button class="btn btn-outline btn-sm" style="color:#0369a1;border-color:#0369a1" onclick="openSeasonModal(${m.id}, '${escapeHtml(m.name)}')">
               ${m.seasonMembership ? '시즌방 변경' : '시즌방 등록'}
           </button>
           <button class="btn btn-outline btn-sm" style="color:#3B82F6;border-color:#3B82F6" onclick="openKeepingModal(${m.id}, '${escapeHtml(m.name)}')">
               ${m.keeping ? '키핑권 변경' : '키핑권 부여'}
           </button>
           <button class="btn btn-outline btn-sm" style="color:#0066FF;border-color:#0066FF" onclick="openMemberNotifModal(${m.id}, '${escapeHtml(m.name)}')">
               알림 보내기
           </button>`
        : '';

    return `
        <li class="member-item">
            <div class="member-avatar">${escapeHtml(initial)}</div>
            <div class="member-info">
                <div class="member-name">${escapeHtml(m.name)}</div>
                <div class="member-meta">
                    <span>${escapeHtml(m.phone)}</span>
                    <span style="color:var(--gray-300)">·</span>
                    <span>${escapeHtml(m.boardType)}</span>
                    <span style="color:var(--gray-300)">·</span>
                    <span>${escapeHtml(m.surfLevel)}</span>
                </div>
                <div class="member-meta" style="margin-top:5px">
                    <span class="badge ${badgeClass}">${escapeHtml(m.status)}</span>
                    ${membershipHtml}
                    ${seasonHtml}
                    ${keepingHtml}
                </div>
                <div style="font-size:11px;color:var(--fg-neutral-tertiary);margin-top:3px">${escapeHtml(m.email)}</div>
            </div>
            <div class="member-actions">
                ${approveRejectBtns}
                ${membershipBtn}
                ${deleteMemberBtn}
            </div>
        </li>`;
}

function renderMembershipBadge(ms) {
    if (!ms) return '<span class="badge badge-no-ms">회원권 없음</span>';
    if (ms.type === 'PERIOD') {
        const expired = ms.expired;
        if (expired) return '<span class="badge badge-ms-expired">기간권 만료</span>';
        return `<span class="badge badge-ms-period">기간권 · ${ms.remainDays}일 남음</span>`;
    } else {
        const remain = ms.remainSessions;
        if (remain === 0) return '<span class="badge badge-ms-expired">횟수권 소진</span>';
        return `<span class="badge badge-ms-session">횟수권 · ${remain}회 남음</span>`;
    }
}

function renderKeepingBadge(k) {
    if (!k) return '';
    if (k.expired) return '<span class="badge badge-ms-expired">키핑권 만료</span>';
    const remain = k.remainDays !== null ? ` · ${k.remainDays}일 남음` : '';
    return `<span class="badge" style="background:#EFF6FF;color:#3B82F6;border:1px solid #BFDBFE">🏄‍♂️ 키핑권${remain}</span>`;
}

async function approveMember(id) {
    if (!confirm(C.MESSAGES.APPROVE_CONFIRM)) return;
    const data = await api(C.API.ADMIN_APPROVE(id), { method: 'PUT' });
    if (data?.success) { loadMembers(); loadDashboardStats(); }
    else alert(data?.message || '오류가 발생했습니다.');
}

async function rejectMember(id) {
    if (!confirm(C.MESSAGES.REJECT_CONFIRM)) return;
    const data = await api(C.API.ADMIN_REJECT(id), { method: 'PUT' });
    if (data?.success) { loadMembers(); loadDashboardStats(); }
    else alert(data?.message || '오류가 발생했습니다.');
}

/* ── 관리자 회원 추가 ── */
function openAddMemberModal() {
    $('add-member-modal').classList.remove('hidden');
    $('add-member-form').reset();
    $('add-member-error').classList.add('hidden');
}
function closeAddMemberModal() {
    $('add-member-modal').classList.add('hidden');
}
async function submitAddMember(e) {
    e.preventDefault();
    const name = $('add-member-name').value.trim();
    const phone = $('add-member-phone').value.trim();
    if (!name || !phone) { $('add-member-error').textContent = '이름과 전화번호를 입력해주세요.'; $('add-member-error').classList.remove('hidden'); return; }
    const btn = $('btn-add-member-submit');
    btn.disabled = true; btn.textContent = '추가 중...';
    try {
        const data = await api(C.API.ADMIN_MEMBER_ADD, { method: 'POST', body: JSON.stringify({ name, phone }) });
        if (data?.success) { closeAddMemberModal(); loadMembers(); loadDashboardStats(); }
        else { $('add-member-error').textContent = data?.message || '오류가 발생했습니다.'; $('add-member-error').classList.remove('hidden'); }
    } catch { $('add-member-error').textContent = C.MESSAGES.NETWORK_ERROR; $('add-member-error').classList.remove('hidden'); }
    finally { btn.disabled = false; btn.textContent = '추가'; }
}

async function deleteMemberAccount(id, name) {
    if (!confirm(`${name} 회원을 완전히 삭제하시겠습니까?\n모든 예약 및 데이터가 삭제됩니다.`)) return;
    const data = await api(C.API.ADMIN_MEMBER_DELETE(id), { method: 'DELETE' });
    if (data?.success) { loadMembers(); loadDashboardStats(); }
    else alert(data?.message || '오류가 발생했습니다.');
}

async function deleteAdminAccount() {
    if (!confirm('관리자 계정과 서핑샵 전체 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
    const data = await api(C.API.ADMIN_DELETE_ME, { method: 'DELETE' });
    if (data?.success) {
        store.clearAll();
        window.location.href = '/admin.html';
    } else {
        alert(data?.message || '오류가 발생했습니다.');
    }
}

function setFilter(filter) {
    memberFilter = filter;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('active', c.dataset.filter === filter));
    loadMembers();
}

/* ── Lessons ── */
async function loadLessons() {
    const container = $('lesson-list');
    container.innerHTML = '<div class="text-center mt-16"><span class="spinner dark"></span></div>';
    selectedLessons.clear();
    updateDeleteBtn();
    try {
        const data = await api(C.API.ADMIN_LESSONS);
        if (!data || !data.success) { container.innerHTML = emptyState('수업 정보를 불러오지 못했습니다.'); return; }
        const lessons = data.data;
        if (!lessons.length) { container.innerHTML = emptyState('등록된 수업이 없습니다.'); return; }
        container.innerHTML = lessons.map(renderLessonCard).join('');
    } catch {
        container.innerHTML = `<div class="alert alert-danger">${C.MESSAGES.NETWORK_ERROR}</div>`;
    }
}

function toggleLesson(id, checked) {
    if (checked) selectedLessons.add(id);
    else selectedLessons.delete(id);
    updateDeleteBtn();
}

function updateDeleteBtn() {
    const btn = $('btn-delete-lessons');
    const n = selectedLessons.size;
    btn.disabled = n === 0;
    btn.textContent = n > 0 ? `수업 삭제 (${n})` : '수업 삭제';
}

async function deleteLessons() {
    if (selectedLessons.size === 0) return;
    if (!confirm(`선택한 ${selectedLessons.size}개 수업을 삭제하시겠습니까?\n예약된 수업은 예약도 함께 취소됩니다.`)) return;
    const data = await api(C.API.ADMIN_LESSONS_DELETE, {
        method: 'DELETE',
        body: JSON.stringify({ ids: Array.from(selectedLessons) }),
    });
    if (data?.success) {
        selectedLessons.clear();
        loadLessons();
        loadDashboardStats();
    } else {
        alert(data?.message || '삭제에 실패했습니다.');
    }
}

function renderLessonCard(l) {
    const ratio = l.maxCapacity > 0 ? l.currentReservations / l.maxCapacity : 0;
    const isFull = ratio >= 1, isWarn = ratio >= C.CAPACITY.WARN_RATIO;
    const fillClass = isFull ? 'full' : isWarn ? 'warn' : '';
    const fillWidth = Math.round(ratio * 100);
    const dateStr = formatDate(l.startTime);
    const start = formatTime(l.startTime), end = formatTime(l.endTime);
    const typeClass = l.lessonTypeCode === 'PRIVATE' ? 'badge-private' : 'badge-group';
    const waveInfo = [
        l.waveSize ? `🌊 ${escapeHtml(l.waveSize)}` : '',
        l.wavePeriod ? `⏱ ${escapeHtml(l.wavePeriod)}` : '',
        l.windInfo ? `💨 ${escapeHtml(l.windInfo)}` : '',
    ].filter(Boolean).join(' &nbsp;');
    const tags = [
        l.targetLevel ? `<span class="badge badge-group">${escapeHtml(l.targetLevel)}</span>` : '',
        l.targetBoardType ? `<span class="badge badge-private">${escapeHtml(l.targetBoardType)}</span>` : '',
    ].filter(Boolean).join('');

    return `
        <div class="lesson-card-wrapper fade-in">
            <label class="lesson-checkbox-wrap" onclick="event.stopPropagation()">
                <input type="checkbox" onchange="toggleLesson(${l.id}, this.checked)">
            </label>
            <div class="lesson-card ${isFull ? 'full' : ''}" onclick="openLessonDetail(${l.id})" style="cursor:pointer;flex:1;margin-bottom:0">
                <div class="lesson-header">
                    <div>
                        <div class="lesson-date-label">${escapeHtml(dateStr)}</div>
                        <div class="lesson-title">${escapeHtml(l.title)}</div>
                    </div>
                    <span class="badge ${typeClass}">${escapeHtml(l.lessonType)}</span>
                </div>
                <div class="lesson-meta">
                    <span>⏱ ${start} ~ ${end}</span>
                    <span>👤 ${escapeHtml(l.instructor || '-')}</span>
                    ${tags}
                </div>
                ${waveInfo ? `<div class="lesson-wave-info">${waveInfo}</div>` : ''}
                <div class="lesson-capacity">
                    <div class="capacity-bar">
                        <div class="capacity-fill ${fillClass}" style="width:${fillWidth}%"></div>
                    </div>
                    <div class="capacity-text">${l.currentReservations}/${l.maxCapacity}명${isFull ? ' · <span style="color:var(--danger);font-weight:600">마감</span>' : ''}</div>
                </div>
            </div>
        </div>`;
}

function formatDate(isoString) {
    const d = new Date(isoString);
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

function formatTime(isoString) {
    const d = new Date(isoString);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function formatDateTime(isoString) {
    const d = new Date(isoString);
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

/* ── Membership Modal ── */
async function openMembershipModal(memberId, memberName) {
    modalMemberId = memberId;
    $('modal-title').textContent = `${memberName} — 회원권`;
    $('modal-body').innerHTML = '<div class="text-center"><span class="spinner dark"></span></div>';
    const btn = $('btn-assign-ms');
    btn.disabled = false; btn.textContent = '저장';
    show('modal-overlay');

    const data = await api(C.API.ADMIN_MEMBERSHIP(memberId));
    const ms = (data?.success) ? data.data : null;
    renderMembershipForm(ms);
}

function renderMembershipForm(ms) {
    const today = new Date().toISOString().split('T')[0];

    if (!ms) {
        $('modal-body').innerHTML = `
            <div id="modal-alert" class="alert alert-danger hidden"></div>
            <div class="form-group">
                <label class="form-label">회원권 종류 <span class="required">*</span></label>
                <div class="radio-group">
                    <label class="radio-label"><input type="radio" name="ms-type" value="PERIOD" checked onchange="onNewTypeChange()"><span>기간권</span></label>
                    <label class="radio-label"><input type="radio" name="ms-type" value="SESSION" onchange="onNewTypeChange()"><span>횟수권</span></label>
                </div>
            </div>
            <div id="new-period-opts">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">시작일 <span class="required">*</span></label>
                        <input type="date" id="ms-start" class="form-control" value="${today}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">종료일 <span class="required">*</span></label>
                        <input type="date" id="ms-end" class="form-control">
                    </div>
                </div>
                <div style="display:flex;gap:8px;margin-top:4px">
                    <button type="button" class="btn btn-outline btn-sm" onclick="autoSetEndDate('ms-start','ms-end',12)">1년</button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="autoSetEndDate('ms-start','ms-end',6)">6개월</button>
                </div>
            </div>
            <div id="new-session-opts" class="hidden">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">횟수 <span class="required">*</span></label>
                        <input type="number" id="ms-sessions" class="form-control" min="1" value="10">
                    </div>
                    <div class="form-group">
                        <label class="form-label">시작일 <span class="required">*</span></label>
                        <input type="date" id="ms-start2" class="form-control" value="${today}">
                    </div>
                </div>
            </div>
            <div id="new-season-opts" class="hidden">
                <div class="form-group">
                    <label class="form-label">시작일 <span class="required">*</span></label>
                    <input type="date" id="ms-season-start" class="form-control" value="${today}">
                    <small style="color:var(--gray-500);font-size:12px">종료일은 시작일로부터 1년 후 자동 설정됩니다.</small>
                </div>
            </div>`;
        $('btn-assign-ms').textContent = '회원권 발급';
        return;
    }

    if (ms.type === 'PERIOD') {
        const expired = ms.expired;
        $('modal-body').innerHTML = `
            <div id="modal-alert" class="alert alert-danger hidden"></div>
            <div class="ms-current-info ${expired ? 'ms-card-expired' : 'ms-card-period'}" style="padding:12px 14px;border-radius:var(--radius);margin-bottom:16px">
                <div style="font-weight:700;margin-bottom:4px">📅 현재 기간권</div>
                <div style="font-size:13px;opacity:0.85">${escapeHtml(ms.startDate)} ~ ${escapeHtml(ms.endDate)}
                    &nbsp;·&nbsp; ${expired ? '<span style="color:var(--danger)">만료됨</span>' : `<b>${ms.remainDays}일 남음</b>`}</div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">시작일</label>
                    <input type="date" id="ms-mod-start" class="form-control" value="${escapeHtml(ms.startDate)}">
                </div>
                <div class="form-group">
                    <label class="form-label">종료일 <span class="required">*</span></label>
                    <input type="date" id="ms-mod-end" class="form-control" value="${escapeHtml(ms.endDate)}">
                </div>
            </div>
            <button class="btn btn-outline btn-sm" style="margin-top:4px" onclick="switchToNewMembership('PERIOD')">새로 발급하기</button>`;
        $('btn-assign-ms').textContent = '기간 변경';
    } else if (ms.type === 'SEASON') {
        const expired = ms.expired;
        $('modal-body').innerHTML = `
            <div id="modal-alert" class="alert alert-danger hidden"></div>
            <div class="ms-current-info ${expired ? 'ms-card-expired' : 'ms-card-period'}" style="padding:12px 14px;border-radius:var(--radius);margin-bottom:16px">
                <div style="font-weight:700;margin-bottom:4px">🏄 현재 시즌방</div>
                <div style="font-size:13px;opacity:0.85">${escapeHtml(ms.startDate)} ~ ${escapeHtml(ms.endDate)}
                    &nbsp;·&nbsp; ${expired ? '<span style="color:var(--danger)">만료됨</span>' : `<b>${ms.remainDays}일 남음</b>`}</div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">시작일</label>
                    <input type="date" id="ms-mod-start" class="form-control" value="${escapeHtml(ms.startDate)}">
                </div>
                <div class="form-group">
                    <label class="form-label">종료일 <span class="required">*</span></label>
                    <input type="date" id="ms-mod-end" class="form-control" value="${escapeHtml(ms.endDate)}">
                </div>
            </div>
            <button class="btn btn-outline btn-sm" style="margin-top:4px" onclick="switchToNewMembership('SEASON')">새로 발급하기</button>`;
        $('btn-assign-ms').textContent = '기간 변경';
    } else {
        const remain = ms.remainSessions;
        $('modal-body').innerHTML = `
            <div id="modal-alert" class="alert alert-danger hidden"></div>
            <div class="ms-current-info ${remain === 0 ? 'ms-card-expired' : 'ms-card-session'}" style="padding:12px 14px;border-radius:var(--radius);margin-bottom:16px">
                <div style="font-weight:700;margin-bottom:4px">🎫 현재 횟수권</div>
                <div style="font-size:13px;opacity:0.85">총 ${ms.totalSessions}회 · 사용 ${ms.usedSessions}회
                    &nbsp;·&nbsp; <b>${remain}회 남음</b></div>
            </div>
            <div class="form-group">
                <label class="form-label">횟수 조정 <span class="required">*</span></label>
                <div style="display:flex;gap:8px;align-items:center">
                    <input type="number" id="ms-adj" class="form-control" value="0" style="max-width:120px" oninput="updateAdjPreview()">
                    <span id="ms-adj-preview" style="font-size:13px;color:var(--gray-500)">변동 없음</span>
                </div>
                <div style="font-size:12px;color:var(--gray-500);margin-top:4px">양수(+) 추가 · 음수(-) 차감 · 현재 잔여: ${remain}회</div>
            </div>
            <button class="btn btn-outline btn-sm" style="margin-top:4px" onclick="switchToNewMembership('SESSION')">새로 발급하기</button>`;
        $('btn-assign-ms').textContent = '횟수 조정';
    }
}

function updateAdjPreview() {
    const adj = parseInt($('ms-adj').value) || 0;
    const preview = $('ms-adj-preview');
    if (adj === 0) { preview.textContent = '변동 없음'; preview.style.color = 'var(--gray-500)'; }
    else if (adj > 0) { preview.textContent = `+${adj}회 추가`; preview.style.color = 'var(--success)'; }
    else { preview.textContent = `${adj}회 차감`; preview.style.color = 'var(--danger)'; }
}

function autoSetEndDate(startId, endId, months) {
    const startVal = $(startId)?.value;
    if (!startVal) return;
    const d = new Date(startVal);
    d.setMonth(d.getMonth() + months);
    $(endId).value = d.toISOString().split('T')[0];
}

function onNewTypeChange() {
    const type = document.querySelector('input[name="ms-type"]:checked')?.value;
    if (type === 'PERIOD') { show('new-period-opts'); hide('new-session-opts'); hide('new-season-opts'); }
    else if (type === 'SEASON') { hide('new-period-opts'); hide('new-session-opts'); show('new-season-opts'); }
    else { hide('new-period-opts'); show('new-session-opts'); hide('new-season-opts'); }
}

function switchToNewMembership(currentType) {
    const today = new Date().toISOString().split('T')[0];
    $('modal-body').innerHTML = `
        <div id="modal-alert" class="alert alert-danger hidden"></div>
        <div class="alert" style="background:#FFF9E6;border:1px solid #F5C518;border-radius:var(--radius);padding:10px 14px;font-size:13px;margin-bottom:14px">
            ⚠️ 기존 회원권이 비활성화되고 새로 발급됩니다.
        </div>
        <div class="form-group">
            <label class="form-label">회원권 종류 <span class="required">*</span></label>
            <div class="radio-group">
                <label class="radio-label"><input type="radio" name="ms-type" value="PERIOD" ${currentType==='PERIOD'?'checked':''} onchange="onNewTypeChange()"><span>기간권</span></label>
                <label class="radio-label"><input type="radio" name="ms-type" value="SESSION" ${currentType==='SESSION'?'checked':''} onchange="onNewTypeChange()"><span>횟수권</span></label>
                <label class="radio-label"><input type="radio" name="ms-type" value="SEASON" ${currentType==='SEASON'?'checked':''} onchange="onNewTypeChange()"><span>시즌방 (1년)</span></label>
            </div>
        </div>
        <div id="new-period-opts" ${currentType!=='PERIOD'?'class="hidden"':''}>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">시작일 <span class="required">*</span></label>
                    <input type="date" id="ms-start" class="form-control" value="${today}">
                </div>
                <div class="form-group">
                    <label class="form-label">종료일 <span class="required">*</span></label>
                    <input type="date" id="ms-end" class="form-control">
                </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:4px">
                <button type="button" class="btn btn-outline btn-sm" onclick="autoSetEndDate('ms-start','ms-end',12)">1년</button>
                <button type="button" class="btn btn-outline btn-sm" onclick="autoSetEndDate('ms-start','ms-end',6)">6개월</button>
            </div>
        </div>
        <div id="new-session-opts" ${currentType!=='SESSION'?'class="hidden"':''}>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">횟수 <span class="required">*</span></label>
                    <input type="number" id="ms-sessions" class="form-control" min="1" value="10">
                </div>
                <div class="form-group">
                    <label class="form-label">시작일 <span class="required">*</span></label>
                    <input type="date" id="ms-start2" class="form-control" value="${today}">
                </div>
            </div>
        </div>
        <div id="new-season-opts" ${currentType!=='SEASON'?'class="hidden"':''}>
            <div class="form-group">
                <label class="form-label">시작일 <span class="required">*</span></label>
                <input type="date" id="ms-season-start" class="form-control" value="${today}">
                <small style="color:var(--gray-500);font-size:12px">종료일은 시작일로부터 1년 후 자동 설정됩니다.</small>
            </div>
        </div>`;
    $('btn-assign-ms').textContent = '새로 발급';
}

async function submitNewMembership() {
    const type = document.querySelector('input[name="ms-type"]:checked')?.value;
    let body;
    if (type === 'PERIOD') {
        const startDate = $('ms-start')?.value;
        const endDate = $('ms-end')?.value;
        if (!startDate || !endDate) { showModalAlert('시작일과 종료일을 입력해주세요.'); return; }
        body = { type, startDate, endDate };
    } else if (type === 'SEASON') {
        const startDate = $('ms-season-start')?.value;
        if (!startDate) { showModalAlert('시작일을 입력해주세요.'); return; }
        body = { type, startDate };
    } else {
        const sessions = parseInt($('ms-sessions')?.value);
        const startDate = $('ms-start2')?.value;
        if (!sessions || sessions <= 0) { showModalAlert('횟수를 입력해주세요.'); return; }
        if (!startDate) { showModalAlert('시작일을 입력해주세요.'); return; }
        body = { type, totalSessions: sessions, startDate };
    }
    await submitMembership(body);
}

async function submitModifyPeriod() {
    const startDate = $('ms-mod-start')?.value;
    const endDate = $('ms-mod-end')?.value;
    if (!endDate) { showModalAlert('종료일을 입력해주세요.'); return; }
    await submitMembership({ startDate, endDate });
}

async function submitAdjustSession() {
    const adj = parseInt($('ms-adj')?.value);
    if (isNaN(adj) || adj === 0) { showModalAlert('조정할 횟수를 입력해주세요.'); return; }
    await submitMembership({ sessionAdjustment: adj });
}

async function submitMembership(body) {
    const btn = $('btn-assign-ms');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
    try {
        const data = await api(C.API.ADMIN_MEMBERSHIP(modalMemberId), {
            method: 'POST',
            body: JSON.stringify(body),
        });
        if (data?.success) {
            closeModal();
            loadMembers();
        } else {
            showModalAlert(data?.message || '오류가 발생했습니다.');
            btn.disabled = false; btn.textContent = '저장';
        }
    } catch {
        showModalAlert(C.MESSAGES.NETWORK_ERROR);
        btn.disabled = false; btn.textContent = '저장';
    }
}

function handleMembershipSave() {
    if ($('ms-adj')) submitAdjustSession();
    else if (document.querySelector('input[name="ms-type"]')) submitNewMembership();
    else submitModifyPeriod();
}

function showModalAlert(msg) {
    const el = $('modal-alert');
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function closeModal() {
    hide('modal-overlay');
    modalMemberId = null;
}

/* ── Keeping Modal ── */
async function openKeepingModal(memberId, memberName) {
    keepingMemberId = memberId;
    $('keeping-modal-title').textContent = `${memberName} — 키핑권`;
    $('keeping-modal-body').innerHTML = '<div class="text-center"><span class="spinner dark"></span></div>';
    const btnK = $('btn-save-keeping');
    btnK.disabled = false; btnK.textContent = '등록';
    show('keeping-modal-overlay');

    const data = await api(C.API.ADMIN_KEEPING(memberId));
    const k = (data?.success) ? data.data : null;
    renderKeepingForm(k);
}

function renderKeepingForm(k) {
    const today = new Date().toISOString().split('T')[0];
    $('keeping-modal-body').innerHTML = `
        <div id="keeping-modal-alert" class="alert alert-danger hidden"></div>
        ${k ? `<div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:var(--radius);padding:12px 14px;margin-bottom:16px;font-size:13px">
            <div style="font-weight:700;margin-bottom:4px">🏄‍♂️ 현재 키핑권</div>
            <div>${k.boardBrand ? `브랜드: ${escapeHtml(k.boardBrand)} &nbsp;|&nbsp; ` : ''}${escapeHtml(k.startDate)} ~ ${k.endDate ? escapeHtml(k.endDate) : '종료일 없음'}
            ${k.expired ? '<span style="color:var(--danger);margin-left:8px">만료됨</span>' : ''}</div>
            ${k.boardImageUrl ? `<img src="${escapeHtml(k.boardImageUrl)}" style="height:60px;margin-top:8px;border-radius:4px" onerror="this.style.display='none'">` : ''}
        </div>` : ''}
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">시작일 <span class="required">*</span></label>
                <input type="date" id="k-start" class="form-control" value="${today}">
            </div>
            <div class="form-group">
                <label class="form-label">종료일</label>
                <input type="date" id="k-end" class="form-control" value="${k?.endDate || ''}">
            </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:4px;margin-bottom:12px">
            <button type="button" class="btn btn-outline btn-sm" onclick="autoSetEndDate('k-start','k-end',12)">1년</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="autoSetEndDate('k-start','k-end',6)">6개월</button>
        </div>
        <div class="form-group">
            <label class="form-label">보드 브랜드</label>
            <input type="text" id="k-brand" class="form-control" placeholder="예: Firewire, JS Industries" value="${escapeHtml(k?.boardBrand || '')}">
        </div>
        <div class="form-group">
            <label class="form-label">보드 사진 URL</label>
            <input type="url" id="k-image" class="form-control" placeholder="https://example.com/board.jpg" value="${escapeHtml(k?.boardImageUrl || '')}">
            <div style="font-size:12px;color:var(--gray-500);margin-top:4px">이미지 URL을 입력하면 회원 화면에 사진이 표시됩니다.</div>
        </div>`;
    $('btn-save-keeping').textContent = k ? '키핑권 변경' : '키핑권 등록';
    $('btn-save-keeping')
}

async function submitKeeping() {
    const startDate = $('k-start')?.value;
    if (!startDate) { showKeepingAlert('시작일을 입력해주세요.'); return; }

    const body = {
        startDate,
        endDate: $('k-end')?.value || null,
        boardBrand: $('k-brand')?.value.trim() || null,
        boardImageUrl: $('k-image')?.value.trim() || null,
    };

    const btn = $('btn-save-keeping');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
    try {
        const data = await api(C.API.ADMIN_KEEPING(keepingMemberId), {
            method: 'POST',
            body: JSON.stringify(body),
        });
        if (data?.success) {
            closeKeepingModal();
            loadMembers();
        } else {
            showKeepingAlert(data?.message || '오류가 발생했습니다.');
            btn.disabled = false; btn.textContent = '등록';
        }
    } catch {
        showKeepingAlert(C.MESSAGES.NETWORK_ERROR);
        btn.disabled = false; btn.textContent = '등록';
    }
}

function showKeepingAlert(msg) {
    const el = $('keeping-modal-alert');
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function closeKeepingModal() {
    hide('keeping-modal-overlay');
    keepingMemberId = null;
}

/* ── Season Modal ── */
let seasonMemberId = null;

async function openSeasonModal(memberId, memberName) {
    seasonMemberId = memberId;
    $('season-modal-title').textContent = `${memberName} — 시즌방`;
    $('season-modal-body').innerHTML = '<div class="text-center"><span class="spinner dark"></span></div>';
    const btnS = $('btn-save-season');
    btnS.disabled = false; btnS.textContent = '등록';
    show('season-modal-overlay');
    const data = await api(C.API.ADMIN_SEASON(memberId));
    renderSeasonForm((data?.success) ? data.data : null);
}

function closeSeasonModal() {
    hide('season-modal-overlay');
    seasonMemberId = null;
}

function renderSeasonForm(s) {
    const today = new Date().toISOString().split('T')[0];
    $('season-modal-body').innerHTML = `
        <div id="season-modal-alert" class="alert alert-danger hidden"></div>
        ${s ? `<div style="background:#e0f2fe;border:1px solid #7dd3fc;border-radius:var(--radius);padding:12px 14px;margin-bottom:16px;font-size:13px">
            <div style="font-weight:700;margin-bottom:4px">🏄 현재 시즌방</div>
            <div>${escapeHtml(s.startDate)} ~ ${escapeHtml(s.endDate)}
            &nbsp;·&nbsp; ${s.expired ? '<span style="color:var(--danger)">만료됨</span>' : `<b>${s.remainDays}일 남음</b>`}</div>
        </div>` : ''}
        <div class="form-group">
            <label class="form-label">시작일 <span class="required">*</span></label>
            <input type="date" id="s-start" class="form-control" value="${today}">
            <small style="color:var(--gray-500);font-size:12px;margin-top:4px;display:block">종료일은 시작일로부터 1년 후 자동 설정됩니다.</small>
        </div>`;
    $('btn-save-season').textContent = s ? '시즌방 변경' : '시즌방 등록';
}

async function submitSeason() {
    const startDate = $('s-start')?.value;
    if (!startDate) { showSeasonAlert('시작일을 입력해주세요.'); return; }
    const btn = $('btn-save-season');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
    try {
        const data = await api(C.API.ADMIN_SEASON(seasonMemberId), {
            method: 'POST',
            body: JSON.stringify({ startDate }),
        });
        if (data?.success) { closeSeasonModal(); loadMembers(); }
        else { showSeasonAlert(data?.message || '오류가 발생했습니다.'); btn.disabled = false; btn.textContent = '등록'; }
    } catch { showSeasonAlert(C.MESSAGES.NETWORK_ERROR); btn.disabled = false; btn.textContent = '등록'; }
}

function showSeasonAlert(msg) {
    const el = $('season-modal-alert');
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

/* ── Lesson Modal ── */
function openLessonModal() {
    hide('lesson-modal-alert');
    const today = new Date().toISOString().split('T')[0];
    $('ls-date').value = today;
    $('ls-title').value = '';
    $('ls-instructor').value = '';
    $('ls-start').value = '09:00';
    $('ls-end').value = '11:00';
    $('ls-capacity').value = '8';
    $('ls-level').value = '';
    $('ls-board').value = '';
    $('ls-wave-size').value = '';
    $('ls-wave-period').value = '';
    $('ls-wind').value = '';
    show('lesson-modal-overlay');
}

function closeLessonModal() { hide('lesson-modal-overlay'); }

async function saveLesson() {
    hide('lesson-modal-alert');
    const title = $('ls-title').value.trim();
    const date  = $('ls-date').value;
    const start = $('ls-start').value;
    const end   = $('ls-end').value;
    const cap   = $('ls-capacity').value;
    if (!title || !date || !start || !end || !cap) {
        showLessonModalAlert('수업명, 날짜, 시간, 정원은 필수입니다.'); return;
    }

    const body = {
        title,
        instructor: $('ls-instructor').value.trim() || null,
        lessonType: $('ls-type').value,
        date,
        startTime: start + ':00',
        endTime:   end   + ':00',
        maxCapacity: Number(cap),
        targetLevel:      $('ls-level').value || null,
        targetBoardType:  $('ls-board').value || null,
        waveSize:   $('ls-wave-size').value.trim()   || null,
        wavePeriod: $('ls-wave-period').value.trim() || null,
        windInfo:   $('ls-wind').value.trim()        || null,
    };

    const btn = $('btn-save-lesson');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
    try {
        const data = await api(C.API.ADMIN_LESSONS_CREATE, { method: 'POST', body: JSON.stringify(body) });
        if (data?.success) {
            closeLessonModal();
            loadLessons();
            loadDashboardStats();
        } else {
            showLessonModalAlert(data?.message || '수업 생성에 실패했습니다.');
        }
    } catch { showLessonModalAlert(C.MESSAGES.NETWORK_ERROR); }
    finally { btn.disabled = false; btn.innerHTML = '수업 생성'; }
}

function showLessonModalAlert(msg) { $('lesson-modal-alert').textContent = msg; show('lesson-modal-alert'); }

/* ── Lesson Detail ── */
async function openLessonDetail(id) {
    $('lesson-detail-title').textContent = '수업 상세';
    $('lesson-detail-body').innerHTML = '<div class="text-center mt-8"><span class="spinner dark"></span></div>';
    show('lesson-detail-overlay');

    const data = await api(C.API.ADMIN_LESSON_DETAIL(id));
    if (!data || !data.success) {
        $('lesson-detail-body').innerHTML = '<div class="alert alert-danger">수업 정보를 불러오지 못했습니다.</div>';
        return;
    }

    const l = data.data;
    $('lesson-detail-title').textContent = l.title;

    const members = l.members || [];
    const waitlist = l.waitlist || [];

    let membersHtml;
    if (!members.length) {
        membersHtml = '<div class="empty-state" style="padding:20px 0"><div class="empty-icon">👥</div><p>예약한 회원이 없습니다.</p></div>';
    } else {
        membersHtml = `
            <table class="detail-table">
                <thead><tr><th>이름</th><th>보드</th><th>이용권</th><th>잔여</th></tr></thead>
                <tbody>
                    ${members.map(m => `
                        <tr>
                            <td style="font-weight:600">${escapeHtml(m.name)}</td>
                            <td>${escapeHtml(m.boardType)}</td>
                            <td>${escapeHtml(m.membershipType)}</td>
                            <td style="color:${m.membershipExpired ? 'var(--danger)' : 'inherit'}">${escapeHtml(m.membershipDetail)}</td>
                        </tr>`).join('')}
                </tbody>
            </table>`;
    }

    let waitlistHtml = '';
    if (waitlist.length > 0) {
        waitlistHtml = `
            <div style="font-size:14px;font-weight:700;margin:16px 0 10px">⏳ 예약 대기 (${waitlist.length}명)</div>
            <table class="detail-table">
                <thead><tr><th>순서</th><th>이름</th><th>보드</th><th>대기 신청일시</th></tr></thead>
                <tbody>
                    ${waitlist.map((w, i) => `
                        <tr>
                            <td style="font-weight:700;color:var(--primary)">${i+1}번</td>
                            <td style="font-weight:600">${escapeHtml(w.name)}</td>
                            <td>${escapeHtml(w.boardType)}</td>
                            <td style="font-size:12px;color:var(--gray-500)">${escapeHtml(formatDateTime(w.waitingSince))}</td>
                        </tr>`).join('')}
                </tbody>
            </table>`;
    }

    $('lesson-detail-body').innerHTML = `
        <div class="info-grid" style="margin-bottom:16px">
            <div class="info-row"><span class="info-label">일시</span><span class="info-value">${escapeHtml(formatDate(l.startTime))} ${escapeHtml(formatTime(l.startTime))} ~ ${escapeHtml(formatTime(l.endTime))}</span></div>
            <div class="info-row"><span class="info-label">강사</span><span class="info-value">${escapeHtml(l.instructor || '-')}</span></div>
            <div class="info-row"><span class="info-label">유형</span><span class="info-value">${escapeHtml(l.lessonType)}</span></div>
            <div class="info-row"><span class="info-label">정원</span><span class="info-value">${l.currentReservations} / ${l.maxCapacity}명</span></div>
        </div>
        <div style="font-size:14px;font-weight:700;margin-bottom:10px">📋 신청 회원 (${members.length}명)</div>
        ${membersHtml}
        ${waitlistHtml}`;
}

function closeLessonDetail() { hide('lesson-detail-overlay'); }

/* ═══════════════════
   알림 시스템
═══════════════════ */
function updateNotifBadge(count) {
    const badge = $('notif-badge');
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function startNotifPoll() {
    pollNotifCount();
    notifPollTimer = setInterval(pollNotifCount, 30000);
}

async function pollNotifCount() {
    try {
        const data = await api(C.API.ADMIN_NOTIFICATIONS_COUNT);
        if (data?.success) updateNotifBadge(data.data.count);
    } catch { /* silent */ }
}

async function toggleNotifPanel() {
    notifPanelOpen = !notifPanelOpen;
    if (notifPanelOpen) {
        show('notif-panel');
        await loadNotifications();
    } else {
        hide('notif-panel');
    }
}

async function loadNotifications() {
    $('notif-list').innerHTML = '<div class="text-center" style="padding:20px"><span class="spinner dark"></span></div>';
    const data = await api(C.API.ADMIN_NOTIFICATIONS);
    if (!data || !data.success) {
        $('notif-list').innerHTML = '<div style="padding:16px;text-align:center;color:var(--gray-500)">알림을 불러오지 못했습니다.</div>';
        return;
    }
    const notifs = data.data;
    if (!notifs.length) {
        $('notif-list').innerHTML = '<div style="padding:24px;text-align:center;color:var(--gray-500)">알림이 없습니다.</div>';
        return;
    }
    const typeIcon = { RESERVATION: '📅', CANCELLATION: '❌', NEW_MEMBER: '👋', WAITLIST_PROMOTED: '✅' };
    $('notif-list').innerHTML = notifs.map(n => `
        <div class="notif-item ${n.read ? 'notif-read' : 'notif-unread'}" onclick="readNotif(${n.id}, this)">
            <span class="notif-icon">${typeIcon[n.type] || '🔔'}</span>
            <div class="notif-content">
                <div class="notif-msg">${escapeHtml(n.message)}</div>
                <div class="notif-time">${escapeHtml(formatDateTime(n.createdAt))}</div>
            </div>
            ${!n.read ? '<span class="notif-dot"></span>' : ''}
        </div>`).join('');
}

async function readNotif(id, el) {
    await api(C.API.ADMIN_NOTIFICATION_READ(id), { method: 'PUT' });
    el.classList.remove('notif-unread');
    el.classList.add('notif-read');
    el.querySelector('.notif-dot')?.remove();
    pollNotifCount();
}

async function markAllNotifRead() {
    await api(C.API.ADMIN_NOTIFICATIONS_READ_ALL, { method: 'PUT' });
    await loadNotifications();
    updateNotifBadge(0);
}

/* ═══════════════════
   회원권 만료 대시보드
═══════════════════ */
let expiryCache = null;
let currentExpirySegment = 'd7';

async function loadExpiryDashboard() {
    const container = $('expiry-dashboard-content');
    container.innerHTML = '<div class="text-center mt-16"><span class="spinner dark"></span></div>';
    try {
        const data = await api(C.API.ADMIN_EXPIRY_DASHBOARD);
        if (!data || !data.success) {
            container.innerHTML = '<div class="alert alert-danger">만료 현황을 불러오지 못했습니다.</div>';
            return;
        }
        expiryCache = data.data;
        renderExpiryDashboard(expiryCache, 'd7');
    } catch {
        container.innerHTML = `<div class="alert alert-danger">${C.MESSAGES.NETWORK_ERROR}</div>`;
    }
}

function renderExpiryDashboard(d, activeSegment) {
    const container = $('expiry-dashboard-content');
    container.innerHTML = `
        <div class="seg-tiles">
            <div class="seg-tile danger ${activeSegment === 'd7' ? 'active' : ''}" id="seg-d7" onclick="showExpirySegment('d7')">
                <div class="seg-label">D-7 이내</div>
                <div class="seg-num">${d.d7Count}</div>
                <div class="seg-sub">즉시 조치 필요</div>
            </div>
            <div class="seg-tile warn ${activeSegment === 'd30' ? 'active' : ''}" id="seg-d30" onclick="showExpirySegment('d30')">
                <div class="seg-label">D-30 이내</div>
                <div class="seg-num">${d.d30Count}</div>
                <div class="seg-sub">리마인드 권장</div>
            </div>
            <div class="seg-tile safe ${activeSegment === 'active' ? 'active' : ''}" id="seg-active" onclick="showExpirySegment('active')">
                <div class="seg-label">활성</div>
                <div class="seg-num">${d.activeCount}</div>
                <div class="seg-sub">유효 회원권</div>
            </div>
        </div>
        <div id="expiry-member-section" class="mt-8"></div>`;
    showExpirySegment(activeSegment);
}

function showExpirySegment(segment) {
    if (!expiryCache) return;
    currentExpirySegment = segment;
    document.querySelectorAll('.seg-tile').forEach(t => t.classList.remove('active'));
    const tileEl = $(`seg-${segment}`);
    if (tileEl) tileEl.classList.add('active');

    const section = $('expiry-member-section');
    if (segment === 'active') {
        section.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><p>활성 회원 ${expiryCache.activeCount}명은 회원권 잔여가 충분합니다.</p></div>`;
        return;
    }

    const members = segment === 'd7' ? expiryCache.d7Members : expiryCache.d30Members;
    const title   = segment === 'd7' ? '🔴 D-7 이내 만료 회원' : '🟡 D-30 이내 만료 회원';

    if (!members.length) {
        section.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><p>해당 구간의 회원이 없습니다.</p></div>`;
        return;
    }

    section.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px">
            ${members.map(renderExpiryMemberRow).join('')}
        </div>`;
}

function renderExpiryMemberRow(m) {
    const isPeriod  = m.membershipType === 'PERIOD';
    const detail    = isPeriod
        ? `${escapeHtml(m.endDate)} 만료 · D-${m.daysLeft}`
        : `잔여 ${m.sessionsLeft}회 / 총 ${m.totalSessions}회`;
    const badgeCls  = m.urgencyClass === 'danger' ? 'expiry-urgency-badge danger' : 'expiry-urgency-badge warn';
    const chipColor = isPeriod ? '#ECE7FE' : '#FFEDD6';
    const chipText  = isPeriod ? '#6541F2' : '#F97316';
    const msLabel   = isPeriod ? '기간권' : '횟수권';

    return `
        <div class="member-row fade-in">
            <div class="member-avatar">${escapeHtml(m.name.charAt(0))}</div>
            <div class="info">
                <div class="name">${escapeHtml(m.name)}</div>
                <div class="meta-line">
                    <span>${escapeHtml(m.phone)}</span>
                </div>
                <div class="meta-chips">
                    <span class="badge" style="background:${chipColor};color:${chipText}">${msLabel}</span>
                    <span class="badge badge-no-ms">${escapeHtml(detail)}</span>
                </div>
            </div>
            <div style="flex-shrink:0">
                <span class="${badgeCls}">${escapeHtml(m.urgencyLabel)}</span>
            </div>
        </div>`;
}

/* ═══════════════════
   회원 알림 보내기
═══════════════════ */
function openMemberNotifModal(memberId, memberName) {
    memberNotifTargetId = memberId;
    $('member-notif-modal-title').textContent = `알림 보내기 — ${memberName}`;
    $('member-notif-target-name').textContent = memberName;
    $('member-notif-message').value = '';
    hide('member-notif-modal-alert');
    show('member-notif-modal-overlay');
}

function closeMemberNotifModal() {
    hide('member-notif-modal-overlay');
    memberNotifTargetId = null;
}

async function sendMemberNotif() {
    const message = $('member-notif-message').value.trim();
    if (!message) {
        $('member-notif-modal-alert').textContent = '메시지를 입력해주세요.';
        show('member-notif-modal-alert');
        return;
    }
    const btn = $('btn-send-member-notif');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
    try {
        const data = await api(C.API.ADMIN_MEMBER_NOTIFY(memberNotifTargetId), {
            method: 'POST',
            body: JSON.stringify({ message }),
        });
        if (data?.success) {
            closeMemberNotifModal();
            alert('알림이 전송되었습니다.');
        } else {
            $('member-notif-modal-alert').textContent = data?.message || '전송에 실패했습니다.';
            show('member-notif-modal-alert');
        }
    } catch {
        $('member-notif-modal-alert').textContent = C.MESSAGES.NETWORK_ERROR;
        show('member-notif-modal-alert');
    } finally {
        btn.disabled = false; btn.textContent = '보내기';
    }
}

/* ── Logout ── */
async function logout() {
    if (notifPollTimer) clearInterval(notifPollTimer);
    if (currentToken) {
        try { await api(C.API.ADMIN_LOGOUT, { method: 'POST' }); } catch { /* ignore */ }
    }
    currentToken = null;
    store.clearAll();
    hide('dashboard-view');
    show('login-view');
    $('login-form').reset();
    hide('login-error');
    notifPanelOpen = false;
}

/* ── Helpers ── */
function emptyState(msg) {
    return `<div class="empty-state"><div class="empty-icon">📋</div><p>${escapeHtml(msg)}</p></div>`;
}

/* ── Close panel when clicking outside ── */
document.addEventListener('click', (e) => {
    if (!notifPanelOpen) return;
    const panel = $('notif-panel');
    const btn   = $('btn-notifications');
    if (panel && btn && !panel.contains(e.target) && !btn.contains(e.target)) {
        hide('notif-panel');
        notifPanelOpen = false;
    }
});

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
    currentToken = store.get('TOKEN');

    if (currentToken) { showDashboard(); }
    else { show('login-view'); hide('dashboard-view'); }

    $('login-form').addEventListener('submit', handleLogin);
    $('admin-reg-form').addEventListener('submit', handleAdminRegister);
    document.querySelectorAll('.sidebar-link').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
    document.querySelectorAll('.filter-chip').forEach(chip => chip.addEventListener('click', () => setFilter(chip.dataset.filter)));
    $('btn-logout').addEventListener('click', logout);
    $('btn-refresh').addEventListener('click', () => {
        loadDashboardStats();
        if (currentTab === 'members') loadMembers();
        if (currentTab === 'lessons') loadLessons();
        if (currentTab === 'expiry') loadExpiryDashboard();
    });
    $('btn-create-lesson').addEventListener('click', openLessonModal);
    $('btn-save-lesson').addEventListener('click', saveLesson);
    $('btn-delete-lessons').addEventListener('click', deleteLessons);
    $('btn-send-member-notif').addEventListener('click', sendMemberNotif);
});
