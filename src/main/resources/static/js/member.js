'use strict';

const C = SURF_SHOP_CONSTANTS;
const $ = (id) => document.getElementById(id);
const show = (id) => $(id).classList.remove('hidden');
const hide = (id) => $(id).classList.add('hidden');

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const memberToken = localStorage.getItem(C.STORAGE.MEMBER_TOKEN);

/* ── 인증 API 헬퍼 ── */
async function authApi(url, options = {}) {
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${memberToken}`, ...(options.headers || {}) },
        ...options,
    });
    if (res.status === 401) { redirectToLogin(); return null; }
    return res.json();
}

/* ── 페이지 로드 ── */
let memberData = null;
let calYear, calMonth;
let calLessons = {};   // { "2026-05-07": [...] }
let selectedDate = null;

async function loadMyInfo() {
    if (!memberToken) { redirectToLogin(); return; }
    const data = await authApi(C.API.MEMBER_ME);
    if (!data || !data.success) { showError(data?.message || '정보를 불러오지 못했습니다.'); return; }
    memberData = data.data;
    renderPage(memberData);
}

function renderPage(d) {
    $('header-name').textContent = d.name;
    $('header-shop').textContent = d.shopName;
    renderMembershipCard(d.membership);
    renderMemberInfo(d);
    const now = new Date();
    calYear  = now.getFullYear();
    calMonth = now.getMonth() + 1;
    hide('loading-view');
    show('content-view');
}

/* ── 탭 전환 ── */
function switchMemberTab(tab) {
    document.querySelectorAll('.tabs .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    hide('tab-profile'); hide('tab-mylessons'); hide('tab-reserve');
    show(`tab-${tab}`);
    if (tab === 'reserve') loadCalendar();
    if (tab === 'mylessons') loadMyLessons();
}

/* ══════════════
   나의 수업
══════════════ */
async function loadMyLessons() {
    const container = $('my-lessons-list');
    container.innerHTML = '<div class="text-center mt-16"><span class="spinner dark"></span></div>';

    const data = await authApi(C.API.MEMBER_MY_LESSONS);
    if (!data || !data.success) {
        container.innerHTML = '<div class="alert alert-danger">수업 목록을 불러오지 못했습니다.</div>';
        return;
    }

    const lessons = data.data;
    if (!lessons.length) {
        container.innerHTML = `
            <div class="empty-state mt-16">
                <div class="empty-icon">🏄</div>
                <p>예약된 수업이 없습니다.</p>
                <button class="btn btn-primary btn-sm mt-8" onclick="switchMemberTab('reserve')">수업 예약하러 가기</button>
            </div>`;
        return;
    }

    // 예정된 수업 / 완료된 수업 분리
    const upcoming = lessons.filter(l => !l.isPast);
    const past     = lessons.filter(l => l.isPast);

    let html = '';
    if (upcoming.length) {
        html += `<p class="section-title" style="font-size:14px;margin-bottom:10px">📅 예정된 수업 (${upcoming.length})</p>`;
        html += upcoming.map(l => renderMyLessonCard(l)).join('');
    }
    if (past.length) {
        html += `<p class="section-title" style="font-size:14px;margin:18px 0 10px">✅ 완료된 수업 (${past.length})</p>`;
        html += past.map(l => renderMyLessonCard(l)).join('');
    }
    container.innerHTML = html;
}

function renderMyLessonCard(l) {
    const dateStr = formatDate(l.startTime);
    const start   = formatTime(l.startTime);
    const end     = formatTime(l.endTime);
    const typeClass = l.lessonTypeCode === 'PRIVATE' ? 'badge-private' : 'badge-group';
    const waveRow = [
        l.waveSize   ? `🌊 ${escapeHtml(l.waveSize)}`   : '',
        l.wavePeriod ? `⏱ ${escapeHtml(l.wavePeriod)}` : '',
        l.windInfo   ? `💨 ${escapeHtml(l.windInfo)}`   : '',
    ].filter(Boolean).join('  ');

    let actionArea;
    if (l.isPast) {
        actionArea = `<div class="lesson-complete-badge">✓ 수업 완료</div>`;
    } else {
        actionArea = `<button class="btn btn-danger btn-sm" onclick="cancelReserve(${l.myReservationId}, '${escapeHtml(l.title)}', true)">예약 취소</button>`;
    }

    return `
        <div class="reserve-lesson-card ${l.isPast ? 'past' : 'reserved'} fade-in">
            <div class="lesson-header">
                <div style="flex:1;min-width:0">
                    <div class="lesson-date-label">${escapeHtml(dateStr)}</div>
                    <div class="lesson-title">${escapeHtml(l.title)}</div>
                    <div class="lesson-meta" style="margin-top:4px">
                        <span>🕐 ${start} ~ ${end}</span>
                        <span>👤 ${escapeHtml(l.instructor || '-')}</span>
                        <span class="badge ${typeClass}">${escapeHtml(l.lessonType)}</span>
                        ${l.targetLevel ? `<span class="badge badge-group">${escapeHtml(l.targetLevel)}</span>` : ''}
                    </div>
                </div>
                <div style="flex-shrink:0;margin-left:10px">${actionArea}</div>
            </div>
            ${waveRow ? `<div class="lesson-wave-info">${waveRow}</div>` : ''}
            <div class="lesson-capacity">
                <div class="capacity-bar">
                    <div class="capacity-fill ${l.availableSpots <= 0 ? 'full' : ''}"
                         style="width:${Math.round((l.currentReservations/l.maxCapacity)*100)}%"></div>
                </div>
                <div class="capacity-text">신청 ${l.currentReservations}명 | 전체 ${l.maxCapacity}명</div>
            </div>
        </div>`;
}

/* ══════════════
   달력
══════════════ */
async function loadCalendar() {
    renderCalendarShell();
    const data = await authApi(`${C.API.MEMBER_LESSONS_CALENDAR}?year=${calYear}&month=${calMonth}`);
    if (!data || !data.success) return;
    calLessons = data.data.lessons || {};
    renderCalendarDays(data.data);
}

function renderCalendarShell() {
    $('cal-title').textContent = `${calYear}년 ${calMonth}월`;
    $('cal-grid').innerHTML = '';
    $('day-lessons').innerHTML = '';
    selectedDate = null;
}

function renderCalendarDays(calData) {
    const { daysInMonth, firstDayOfWeek } = calData;
    const grid = $('cal-grid');

    // 요일 헤더
    const headers = ['일','월','화','수','목','금','토'];
    grid.innerHTML = headers.map(d =>
        `<div class="cal-header-cell">${d}</div>`).join('') +
        // 첫 날 빈 칸
        Array.from({ length: firstDayOfWeek }, () => '<div class="cal-cell empty"></div>').join('') +
        // 날짜 셀
        Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dateKey = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const hasLesson = !!calLessons[dateKey]?.length;
            const hasReserved = hasLesson && calLessons[dateKey].some(l => l.reserved);
            const isToday = isDateToday(calYear, calMonth, day);
            let cls = 'cal-cell';
            if (isToday) cls += ' cal-today';
            if (hasLesson) cls += ' cal-has-lesson';
            return `<div class="${cls}" data-date="${dateKey}" onclick="selectDay('${dateKey}')">
                <span class="cal-day-num">${day}</span>
                ${hasReserved ? '<span class="cal-dot cal-dot-reserved"></span>' : hasLesson ? '<span class="cal-dot"></span>' : ''}
            </div>`;
        }).join('');
}

function isDateToday(y, m, d) {
    const t = new Date();
    return t.getFullYear() === y && t.getMonth() + 1 === m && t.getDate() === d;
}

function selectDay(dateKey) {
    // 이전 선택 해제
    document.querySelectorAll('.cal-cell.selected').forEach(c => c.classList.remove('selected'));
    const cell = document.querySelector(`.cal-cell[data-date="${dateKey}"]`);
    if (cell) cell.classList.add('selected');
    selectedDate = dateKey;
    renderDayLessons(dateKey);
}

function renderDayLessons(dateKey) {
    const container = $('day-lessons');
    const lessons = calLessons[dateKey] || [];
    const [y, m, d] = dateKey.split('-');
    const title = `${Number(m)}월 ${Number(d)}일`;

    if (!lessons.length) {
        container.innerHTML = `<p class="section-subtitle text-center">${title} — 예정된 수업이 없습니다.</p>`;
        return;
    }

    container.innerHTML = `
        <p class="section-title" style="font-size:14px;margin-bottom:10px">${title} 수업</p>
        ${lessons.map(l => renderLessonItem(l)).join('')}`;
}

function renderLessonItem(l) {
    const start = formatTime(l.startTime), end = formatTime(l.endTime);
    const isFull = l.availableSpots <= 0 && !l.reserved;
    const typeClass = l.lessonTypeCode === 'PRIVATE' ? 'badge-private' : 'badge-group';
    const waveRow = [
        l.waveSize   ? `🌊 ${escapeHtml(l.waveSize)}`   : '',
        l.wavePeriod ? `⏱ ${escapeHtml(l.wavePeriod)}` : '',
        l.windInfo   ? `💨 ${escapeHtml(l.windInfo)}`   : '',
    ].filter(Boolean).join('  ');

    let btn;
    if (l.isPast) {
        btn = l.reserved
            ? `<div class="lesson-complete-badge">✓ 예약완료</div>`
            : `<button class="btn btn-outline btn-sm" disabled style="opacity:0.5">종료된 수업</button>`;
    } else if (l.reserved) {
        btn = `<button class="btn btn-danger btn-sm" onclick="cancelReserve(${l.myReservationId}, '${escapeHtml(l.title)}')">예약 취소</button>`;
    } else if (isFull) {
        btn = `<button class="btn btn-outline btn-sm" disabled>마감</button>`;
    } else {
        btn = `<button class="btn btn-primary btn-sm" onclick="doReserve(${l.id}, '${escapeHtml(l.title)}')">예약하기</button>`;
    }

    return `
        <div class="reserve-lesson-card ${l.isPast ? 'past' : l.reserved ? 'reserved' : ''} fade-in">
            <div class="lesson-header">
                <div>
                    <div class="lesson-title">${escapeHtml(l.title)}</div>
                    <div class="lesson-meta">
                        <span>🕐 ${start} ~ ${end}</span>
                        <span>👤 ${escapeHtml(l.instructor || '-')}</span>
                        <span class="badge ${typeClass}">${escapeHtml(l.lessonType)}</span>
                        ${l.targetLevel ? `<span class="badge badge-group">${escapeHtml(l.targetLevel)}</span>` : ''}
                    </div>
                </div>
                <div style="text-align:right;flex-shrink:0">${btn}</div>
            </div>
            ${waveRow ? `<div class="lesson-wave-info">${waveRow}</div>` : ''}
            <div class="lesson-capacity">
                <div class="capacity-bar">
                    <div class="capacity-fill ${l.availableSpots <= 0 ? 'full' : ''}"
                         style="width:${Math.round((l.currentReservations/l.maxCapacity)*100)}%"></div>
                </div>
                <div class="capacity-text">신청 ${l.currentReservations}명 | 전체 ${l.maxCapacity}명 | 잔여 ${Math.max(0,l.availableSpots)}명</div>
            </div>
            ${l.reserved ? '<div class="reserve-confirmed-badge">✓ 예약됨</div>' : ''}
        </div>`;
}

/* ── 예약 ── */
async function doReserve(lessonId, title) {
    if (!confirm(`"${title}" 수업을 예약하시겠습니까?`)) return;
    const data = await authApi(C.API.MEMBER_RESERVE(lessonId), { method: 'POST' });
    if (data?.success) {
        alert('예약이 완료되었습니다.');
        await loadCalendar();
        if (selectedDate) renderDayLessons(selectedDate);
        // 회원권 횟수 갱신
        const info = await authApi(C.API.MEMBER_ME);
        if (info?.success) { memberData = info.data; renderMembershipCard(memberData.membership); }
    } else {
        alert(data?.message || '예약에 실패했습니다.');
    }
}

async function cancelReserve(reservationId, title) {
    if (!confirm(`"${title}" 예약을 취소하시겠습니까?`)) return;
    const data = await authApi(C.API.MEMBER_CANCEL(reservationId), { method: 'DELETE' });
    if (data?.success) {
        alert('예약이 취소되었습니다.');
        await loadCalendar();
        if (selectedDate) renderDayLessons(selectedDate);
        const info = await authApi(C.API.MEMBER_ME);
        if (info?.success) { memberData = info.data; renderMembershipCard(memberData.membership); }
    } else {
        alert(data?.message || '취소에 실패했습니다.');
    }
}

/* ── 달력 이전/다음 ── */
function prevMonth() {
    calMonth--;
    if (calMonth < 1) { calMonth = 12; calYear--; }
    loadCalendar();
}
function nextMonth() {
    calMonth++;
    if (calMonth > 12) { calMonth = 1; calYear++; }
    loadCalendar();
}

/* ══════════════
   회원권 카드
══════════════ */
function renderMembershipCard(ms) {
    const card = $('membership-card');
    const hint = '<div style="font-size:11px;opacity:0.6;margin-top:6px">탭하여 수업 예약 →</div>';
    if (!ms) {
        card.innerHTML = `<div class="ms-card ms-card-none">
            <div class="ms-icon">🏄</div>
            <div class="ms-body">
                <div class="ms-type">회원권 없음</div>
                <div class="ms-detail">담당 관리자에게 회원권 발급을 요청하세요.</div>
                <div class="ms-status ms-status-warn">예약 불가</div>
                ${hint}
            </div></div>`;
        return;
    }
    if (ms.type === 'PERIOD') {
        const expired = ms.expired, remain = ms.remainDays;
        card.innerHTML = `<div class="ms-card ${expired ? 'ms-card-expired' : 'ms-card-period'}">
            <div class="ms-icon">📅</div>
            <div class="ms-body">
                <div class="ms-type">기간권</div>
                <div class="ms-detail">${escapeHtml(ms.startDate)} ~ ${escapeHtml(ms.endDate)}</div>
                ${expired
                    ? `<div class="ms-status ms-status-danger">만료됨 · 예약 불가</div>`
                    : `<div class="ms-remain"><span class="ms-remain-num">${remain}</span>일 남음</div>
                       <div class="ms-status ${remain <= 7 ? 'ms-status-warn' : 'ms-status-ok'}">${ms.canReserve ? '예약 가능' : '예약 불가'}</div>`
                }
                ${hint}
            </div></div>`;
    } else {
        const remain = ms.remainSessions;
        card.innerHTML = `<div class="ms-card ${remain === 0 ? 'ms-card-expired' : 'ms-card-session'}">
            <div class="ms-icon">🎫</div>
            <div class="ms-body">
                <div class="ms-type">횟수권</div>
                <div class="ms-detail">총 ${ms.totalSessions}회 · 사용 ${ms.usedSessions}회</div>
                <div class="ms-remain"><span class="ms-remain-num">${remain}</span>회 남음</div>
                <div class="ms-status ${remain > 0 ? 'ms-status-ok' : 'ms-status-danger'}">
                    ${remain > 0 ? '예약 가능' : '예약 불가 (횟수 소진)'}
                </div>
                ${renderSessionDots(ms.totalSessions, ms.usedSessions)}
                ${hint}
            </div></div>`;
    }
}

function renderSessionDots(total, used) {
    return `<div class="session-dots">${
        Array.from({ length: total }, (_, i) =>
            `<span class="session-dot ${i < used ? 'used' : ''}"></span>`).join('')
    }</div>`;
}

/* ── 내 정보 ── */
function renderMemberInfo(d) {
    $('member-info-body').innerHTML = `<div class="info-grid">
        ${row('이름', d.name)}
        ${row('이메일', d.email)}
        ${row('전화번호', d.phone)}
        ${row('보드 종류', d.boardType)}
        ${row('서핑 레벨', d.surfLevel)}
        ${d.approvedAt ? row('승인일', d.approvedAt) : ''}
    </div>`;
}
function row(label, value) {
    return `<div class="info-row"><span class="info-label">${label}</span><span class="info-value">${escapeHtml(value)}</span></div>`;
}

/* ── 기타 ── */
function formatTime(iso) {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function formatDate(iso) {
    const d = new Date(iso);
    const days = ['일','월','화','수','목','금','토'];
    return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

function showError(msg) { $('error-msg').textContent = msg; hide('loading-view'); show('error-view'); }
function redirectToLogin() { clearMemberStorage(); window.location.href = '/guest.html'; }
function clearMemberStorage() {
    [C.STORAGE.MEMBER_TOKEN, C.STORAGE.MEMBER_ID, C.STORAGE.MEMBER_NAME,
     C.STORAGE.MEMBER_SHOP_ID, C.STORAGE.MEMBER_SHOP_NAME].forEach(k => localStorage.removeItem(k));
}

async function logout() {
    if (memberToken) {
        try { await fetch(C.API.MEMBER_LOGOUT, { method: 'POST', headers: { 'Authorization': `Bearer ${memberToken}` } }); }
        catch { /* ignore */ }
    }
    clearMemberStorage();
    window.location.href = '/guest.html';
}

document.addEventListener('DOMContentLoaded', () => {
    $('btn-logout').addEventListener('click', logout);
    $('btn-refresh').addEventListener('click', loadMyInfo);
    document.querySelectorAll('.tabs .tab-btn').forEach(btn =>
        btn.addEventListener('click', () => switchMemberTab(btn.dataset.tab)));
    $('cal-prev').addEventListener('click', prevMonth);
    $('cal-next').addEventListener('click', nextMonth);
    loadMyInfo();
});
