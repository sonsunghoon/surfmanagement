'use strict';

const C = SURF_SHOP_CONSTANTS;

let currentToken = null;
let currentTab   = 'members';
let memberFilter = 'ALL';
let modalMemberId = null;
let selectedLessons = new Set();

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
    return String(str).replace(/[&<>"']/g, c =>
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

/* ── Dashboard ── */
function showDashboard() {
    hide('login-view');
    show('dashboard-view');
    $('header-shop').textContent = store.get('SHOP_NAME') || '';
    $('header-email').textContent = store.get('EMAIL') || '';
    loadDashboardStats();
    switchTab('members');
}

async function loadDashboardStats() {
    try {
        const data = await api(C.API.ADMIN_DASHBOARD);
        if (!data || !data.success) return;
        const d = data.data;
        $('stat-pending').textContent  = d.pendingCount   ?? '-';
        $('stat-approved').textContent = d.approvedCount  ?? '-';
        $('stat-lessons').textContent  = d.todayLessonCount ?? '-';
    } catch { /* silent */ }
}

/* ── Tabs ── */
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    hide('tab-members'); hide('tab-lessons');
    show(`tab-${tab}`);
    if (tab === 'members') loadMembers();
    if (tab === 'lessons') loadLessons();
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

    const membershipHtml = renderMembershipBadge(m.membership);

    const membershipBtn = m.statusCode === C.STATUS.APPROVED
        ? `<button class="btn btn-outline btn-sm" onclick="openMembershipModal(${m.id}, '${escapeHtml(m.name)}')">
               ${m.membership ? '회원권 변경' : '회원권 부여'}
           </button>`
        : '';

    return `
        <li class="member-item">
            <div class="member-avatar">${escapeHtml(initial)}</div>
            <div class="member-info">
                <div class="member-name">${escapeHtml(m.name)}</div>
                <div class="member-meta">
                    <span>${escapeHtml(m.phone)}</span>
                    <span>${escapeHtml(m.boardType)}</span>
                    <span>${escapeHtml(m.surfLevel)}</span>
                    <span class="badge ${badgeClass}">${escapeHtml(m.status)}</span>
                    ${membershipHtml}
                </div>
                <div class="text-muted mt-4">${escapeHtml(m.email)}</div>
            </div>
            <div class="member-actions">
                ${approveRejectBtns}
                ${membershipBtn}
            </div>
        </li>`;
}

function renderMembershipBadge(ms) {
    if (!ms) return '<span class="badge badge-no-ms">회원권 없음</span>';
    if (ms.type === 'PERIOD') {
        const expired = ms.expired;
        const remain = ms.remainDays;
        if (expired) return '<span class="badge badge-ms-expired">기간권 만료</span>';
        return `<span class="badge badge-ms-period">기간권 · ${remain}일 남음</span>`;
    } else {
        const remain = ms.remainSessions;
        if (remain === 0) return '<span class="badge badge-ms-expired">횟수권 소진</span>';
        return `<span class="badge badge-ms-session">횟수권 · ${remain}회 남음</span>`;
    }
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
                    <span>🕐 ${start} ~ ${end}</span>
                    <span>👤 ${escapeHtml(l.instructor || '-')}</span>
                    ${tags}
                </div>
                ${waveInfo ? `<div class="lesson-wave-info">${waveInfo}</div>` : ''}
                <div class="lesson-capacity">
                    <div class="capacity-bar">
                        <div class="capacity-fill ${fillClass}" style="width:${fillWidth}%"></div>
                    </div>
                    <div class="capacity-text">${l.currentReservations}/${l.maxCapacity}명
                        ${isFull ? '<span class="badge badge-rejected" style="margin-left:4px">마감</span>' : ''}</div>
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

/* ── Membership Modal ── */
async function openMembershipModal(memberId, memberName) {
    modalMemberId = memberId;
    $('modal-title').textContent = `${memberName} — 회원권`;
    $('modal-body').innerHTML = '<div class="text-center"><span class="spinner dark"></span></div>';
    $('btn-assign-ms').textContent = '저장';
    show('modal-overlay');

    const data = await api(C.API.ADMIN_MEMBERSHIP(memberId));
    const ms = (data?.success) ? data.data : null;
    renderMembershipForm(ms);
}

function renderMembershipForm(ms) {
    const today = new Date().toISOString().split('T')[0];

    if (!ms) {
        // ── 신규 발급 폼 ──
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
            </div>`;
        $('btn-assign-ms').textContent = '회원권 발급';
        $('btn-assign-ms').onclick = submitNewMembership;
        return;
    }

    if (ms.type === 'PERIOD') {
        // ── 기간권 수정 폼 ──
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
        $('btn-assign-ms').onclick = submitModifyPeriod;
    } else {
        // ── 횟수권 수정 폼 ──
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
        $('btn-assign-ms').onclick = submitAdjustSession;
    }
}

function updateAdjPreview() {
    const adj = parseInt($('ms-adj').value) || 0;
    const preview = $('ms-adj-preview');
    if (adj === 0) { preview.textContent = '변동 없음'; preview.style.color = 'var(--gray-500)'; }
    else if (adj > 0) { preview.textContent = `+${adj}회 추가`; preview.style.color = 'var(--success)'; }
    else { preview.textContent = `${adj}회 차감`; preview.style.color = 'var(--danger)'; }
}

function onNewTypeChange() {
    const type = document.querySelector('input[name="ms-type"]:checked')?.value;
    if (type === 'PERIOD') { show('new-period-opts'); hide('new-session-opts'); }
    else { hide('new-period-opts'); show('new-session-opts'); }
}

function switchToNewMembership(currentType) {
    const today = new Date().toISOString().split('T')[0];
    const otherType = currentType === 'PERIOD' ? 'SESSION' : 'PERIOD';
    $('modal-body').innerHTML = `
        <div id="modal-alert" class="alert alert-danger hidden"></div>
        <div class="alert" style="background:var(--warn-bg,#FFF9E6);border:1px solid #F5C518;border-radius:var(--radius);padding:10px 14px;font-size:13px;margin-bottom:14px">
            ⚠️ 기존 회원권이 비활성화되고 새로 발급됩니다.
        </div>
        <div class="form-group">
            <label class="form-label">회원권 종류 <span class="required">*</span></label>
            <div class="radio-group">
                <label class="radio-label"><input type="radio" name="ms-type" value="PERIOD" ${currentType==='PERIOD'?'checked':''} onchange="onNewTypeChange()"><span>기간권</span></label>
                <label class="radio-label"><input type="radio" name="ms-type" value="SESSION" ${currentType==='SESSION'?'checked':''} onchange="onNewTypeChange()"><span>횟수권</span></label>
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
        </div>`;
    $('btn-assign-ms').textContent = '새로 발급';
    $('btn-assign-ms').onclick = submitNewMembership;
}

async function submitNewMembership() {
    const type = document.querySelector('input[name="ms-type"]:checked')?.value;
    let body;
    if (type === 'PERIOD') {
        const startDate = $('ms-start')?.value;
        const endDate = $('ms-end')?.value;
        if (!startDate || !endDate) { showModalAlert('시작일과 종료일을 입력해주세요.'); return; }
        body = { type, startDate, endDate };
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

function showModalAlert(msg) {
    const el = $('modal-alert');
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function closeModal() {
    hide('modal-overlay');
    modalMemberId = null;
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

    $('lesson-detail-body').innerHTML = `
        <div class="info-grid" style="margin-bottom:16px">
            <div class="info-row"><span class="info-label">일시</span><span class="info-value">${escapeHtml(formatDate(l.startTime))} ${escapeHtml(formatTime(l.startTime))} ~ ${escapeHtml(formatTime(l.endTime))}</span></div>
            <div class="info-row"><span class="info-label">강사</span><span class="info-value">${escapeHtml(l.instructor || '-')}</span></div>
            <div class="info-row"><span class="info-label">유형</span><span class="info-value">${escapeHtml(l.lessonType)}</span></div>
            <div class="info-row"><span class="info-label">정원</span><span class="info-value">${l.currentReservations} / ${l.maxCapacity}명</span></div>
        </div>
        <div style="font-size:14px;font-weight:700;margin-bottom:10px">📋 신청 회원 (${members.length}명)</div>
        ${membersHtml}`;
}

function closeLessonDetail() { hide('lesson-detail-overlay'); }

/* ── Logout ── */
async function logout() {
    if (currentToken) {
        try { await api(C.API.ADMIN_LOGOUT, { method: 'POST' }); } catch { /* ignore */ }
    }
    currentToken = null;
    store.clearAll();
    hide('dashboard-view');
    show('login-view');
    $('login-form').reset();
    hide('login-error');
}

/* ── Helpers ── */
function emptyState(msg) {
    return `<div class="empty-state"><div class="empty-icon">📋</div><p>${escapeHtml(msg)}</p></div>`;
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
    currentToken = store.get('TOKEN');

    if (currentToken) { showDashboard(); }
    else { show('login-view'); hide('dashboard-view'); }

    $('login-form').addEventListener('submit', handleLogin);
    document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
    document.querySelectorAll('.filter-chip').forEach(chip => chip.addEventListener('click', () => setFilter(chip.dataset.filter)));
    $('btn-logout').addEventListener('click', logout);
    $('btn-refresh').addEventListener('click', () => {
        loadDashboardStats();
        if (currentTab === 'members') loadMembers();
        if (currentTab === 'lessons') loadLessons();
    });
    $('btn-create-lesson').addEventListener('click', openLessonModal);
    $('btn-save-lesson').addEventListener('click', saveLesson);
    $('btn-delete-lessons').addEventListener('click', deleteLessons);
});
