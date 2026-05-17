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

async function authApi(url, options = {}) {
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${memberToken}`, ...(options.headers || {}) },
        ...options,
    });
    if (res.status === 401) { redirectToLogin(); return null; }
    return res.json();
}

let memberData = null;
let calYear, calMonth;
let calLessons = {};
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
    renderKeepingCard(d.keeping);
    renderMemberInfo(d);
    const now = new Date();
    calYear  = now.getFullYear();
    calMonth = now.getMonth() + 1;
    hide('loading-view');
    show('content-view');
    checkExpiryWarning(d.membership);
    loadLifecycleStats();
}

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
    if (!lessons.length) {
        html = `<div class="empty-state mt-16">
            <div class="empty-icon">🏄</div>
            <p>예약된 수업이 없습니다.</p>
            <button class="btn btn-primary btn-sm mt-8" onclick="switchMemberTab('reserve')">수업 예약하러 가기</button>
        </div>`;
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

    const headers = ['일','월','화','수','목','금','토'];
    grid.innerHTML = headers.map(d => `<div class="cal-header-cell">${d}</div>`).join('') +
        Array.from({ length: firstDayOfWeek }, () => '<div class="cal-cell empty"></div>').join('') +
        Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dateKey = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const hasLesson = !!calLessons[dateKey]?.length;
            const hasReserved = hasLesson && calLessons[dateKey].some(l => l.reserved);
            const hasWaiting  = hasLesson && calLessons[dateKey].some(l => l.onWaitlist);
            const isToday = isDateToday(calYear, calMonth, day);
            let cls = 'cal-cell';
            if (isToday) cls += ' cal-today';
            if (hasLesson) cls += ' cal-has-lesson';
            return `<div class="${cls}" data-date="${dateKey}" onclick="selectDay('${dateKey}')">
                <span class="cal-day-num">${day}</span>
                ${hasReserved ? '<span class="cal-dot cal-dot-reserved"></span>' :
                  hasWaiting  ? '<span class="cal-dot cal-dot-waiting"></span>' :
                  hasLesson   ? '<span class="cal-dot"></span>' : ''}
            </div>`;
        }).join('');
}

function isDateToday(y, m, d) {
    const t = new Date();
    return t.getFullYear() === y && t.getMonth() + 1 === m && t.getDate() === d;
}

function selectDay(dateKey) {
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
    const isFull = l.availableSpots <= 0 && !l.reserved && !l.onWaitlist;
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
    } else if (l.onWaitlist) {
        btn = `<button class="btn btn-outline btn-sm" style="color:var(--warn,#F5A623);border-color:var(--warn,#F5A623)" onclick="cancelWaitlist(${l.myWaitlistId}, '${escapeHtml(l.title)}')">대기 취소</button>`;
    } else if (l.availableSpots <= 0) {
        btn = `<button class="btn btn-outline btn-sm" style="color:var(--warn,#F5A623);border-color:var(--warn,#F5A623)" onclick="doWaitlist(${l.id}, '${escapeHtml(l.title)}')">대기 신청</button>`;
    } else {
        btn = `<button class="btn btn-primary btn-sm" onclick="doReserve(${l.id}, '${escapeHtml(l.title)}')">예약하기</button>`;
    }

    const waitingBadge = l.waitlistCount > 0
        ? `<span class="badge badge-pending" style="font-size:11px">대기 ${l.waitlistCount}명</span>`
        : '';

    return `
        <div class="reserve-lesson-card ${l.isPast ? 'past' : l.reserved ? 'reserved' : l.onWaitlist ? 'waiting' : ''} fade-in">
            <div class="lesson-header">
                <div>
                    <div class="lesson-title">${escapeHtml(l.title)}</div>
                    <div class="lesson-meta">
                        <span>🕐 ${start} ~ ${end}</span>
                        <span>👤 ${escapeHtml(l.instructor || '-')}</span>
                        <span class="badge ${typeClass}">${escapeHtml(l.lessonType)}</span>
                        ${l.targetLevel ? `<span class="badge badge-group">${escapeHtml(l.targetLevel)}</span>` : ''}
                        ${waitingBadge}
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
            ${l.onWaitlist ? '<div class="reserve-confirmed-badge" style="background:var(--warn,#F5A623)">⏳ 대기중</div>' : ''}
        </div>`;
}

/* ── 예약 ── */
async function doReserve(lessonId, title) {
    if (!confirm(`"${title}" 수업을 예약하시겠습니까?`)) return;
    const data = await authApi(C.API.MEMBER_RESERVE(lessonId), { method: 'POST' });
    if (data?.success) {
        alert('예약이 완료되었습니다.');
        await refreshAfterAction();
    } else {
        alert(data?.message || '예약에 실패했습니다.');
    }
}

async function cancelReserve(reservationId, title) {
    if (!confirm(`"${title}" 예약을 취소하시겠습니까?`)) return;
    const data = await authApi(C.API.MEMBER_CANCEL(reservationId), { method: 'DELETE' });
    if (data?.success) {
        alert('예약이 취소되었습니다.');
        await refreshAfterAction();
    } else {
        alert(data?.message || '취소에 실패했습니다.');
    }
}

/* ── 대기 ── */
async function doWaitlist(lessonId, title) {
    if (!confirm(`"${title}" 수업 예약 대기를 신청하시겠습니까?\n자리가 생기면 자동으로 예약됩니다.`)) return;
    const data = await authApi(C.API.MEMBER_WAITLIST(lessonId), { method: 'POST' });
    if (data?.success) {
        alert('예약 대기 신청이 완료되었습니다.');
        await refreshAfterAction();
    } else {
        alert(data?.message || '대기 신청에 실패했습니다.');
    }
}

async function cancelWaitlist(waitlistId, title) {
    if (!confirm(`"${title}" 예약 대기를 취소하시겠습니까?`)) return;
    const data = await authApi(C.API.MEMBER_CANCEL_WAITLIST(waitlistId), { method: 'DELETE' });
    if (data?.success) {
        alert('대기 신청이 취소되었습니다.');
        await refreshAfterAction();
    } else {
        alert(data?.message || '취소에 실패했습니다.');
    }
}

async function refreshAfterAction() {
    await loadCalendar();
    if (selectedDate) renderDayLessons(selectedDate);
    const info = await authApi(C.API.MEMBER_ME);
    if (info?.success) {
        memberData = info.data;
        renderMembershipCard(memberData.membership);
        renderKeepingCard(memberData.keeping);
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
    const hint = '<div style="font-size:11px;opacity:0.55;margin-top:10px;letter-spacing:-0.2px">탭하여 수업 예약 →</div>';

    if (!ms) {
        card.innerHTML = `<div class="ms-card ms-card-none" style="padding:20px">
            <span class="ms-icon">🏄</span>
            <div class="ms-type">회원권 없음</div>
            <div class="ms-detail" style="color:var(--gray-600)">담당 관리자에게 회원권 발급을 요청하세요.</div>
            <div class="ms-status ms-status-warn" style="margin-top:10px">예약 불가</div>
            ${hint}
        </div>`;
        return;
    }

    if (ms.type === 'PERIOD') {
        const expired = ms.expired, remain = ms.remainDays;
        const cardCls = expired ? 'ms-card-expired' : 'ms-card-period';
        card.innerHTML = `<div class="ms-card ${cardCls}">
            <span class="ms-icon">📅</span>
            <div class="ms-type">기간권</div>
            ${expired
                ? `<div class="ms-detail">${escapeHtml(ms.startDate)} ~ ${escapeHtml(ms.endDate)}</div>
                   <div class="ms-status ms-status-danger" style="margin-top:6px">만료됨 · 예약 불가</div>`
                : `<div class="ms-remain">
                       <span class="ms-remain-num">${remain}</span>
                       <span class="ms-remain-unit">일 남음</span>
                   </div>
                   <div class="ms-detail">${escapeHtml(ms.startDate)} ~ ${escapeHtml(ms.endDate)}</div>
                   <div class="ms-status ${remain <= 7 ? 'ms-status-warn' : ''}">${ms.canReserve ? '예약 가능' : '예약 불가'}</div>`
            }
            ${hint}
        </div>`;
    } else {
        const remain = ms.remainSessions;
        const cardCls = remain === 0 ? 'ms-card-expired' : 'ms-card-session';
        card.innerHTML = `<div class="ms-card ${cardCls}">
            <span class="ms-icon">🎫</span>
            <div class="ms-type">횟수권</div>
            <div class="ms-remain">
                <span class="ms-remain-num">${remain}</span>
                <span class="ms-remain-unit">회 남음</span>
            </div>
            <div class="ms-detail">총 ${ms.totalSessions}회 · 사용 ${ms.usedSessions}회</div>
            <div class="ms-status ${remain > 0 ? '' : 'ms-status-danger'}">
                ${remain > 0 ? '예약 가능' : '예약 불가 (횟수 소진)'}
            </div>
            ${renderSessionDots(ms.totalSessions, ms.usedSessions)}
            ${hint}
        </div>`;
    }
}

function renderSessionDots(total, used) {
    if (total > 20) return '';
    return `<div class="session-dots">${
        Array.from({ length: total }, (_, i) =>
            `<span class="session-dot ${i < used ? 'used' : ''}"></span>`).join('')
    }</div>`;
}

/* ══════════════
   키핑권 카드
══════════════ */
function renderKeepingCard(k) {
    const card = $('keeping-card');
    if (!k) { card.innerHTML = ''; return; }

    const expired = k.expired;
    const remainText = k.remainDays !== null
        ? (expired ? '만료됨' : `${k.remainDays}일 남음`)
        : '기간 무제한';
    const statusCls = expired ? 'ms-status-danger' : 'ms-status-ok';

    card.innerHTML = `
        <div class="ms-card ${expired ? 'ms-card-expired' : ''}">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
                <div style="flex:1">
                    <span class="ms-icon">🏄‍♂️</span>
                    <div class="ms-type">키핑권 · 보드 보관</div>
                    ${k.boardBrand ? `<div class="ms-detail" style="font-weight:700;font-size:15px">🏂 ${escapeHtml(k.boardBrand)}</div>` : ''}
                    <div class="ms-detail">${escapeHtml(k.startDate)} ~ ${k.endDate ? escapeHtml(k.endDate) : '종료일 없음'}</div>
                    <div class="ms-status ${statusCls}" style="margin-top:8px">${remainText}</div>
                </div>
                ${k.boardImageUrl ? `<img src="${escapeHtml(k.boardImageUrl)}" alt="보드" style="width:72px;height:64px;object-fit:cover;border-radius:10px;flex-shrink:0;opacity:0.92" onerror="this.style.display='none'">` : ''}
            </div>
        </div>`;
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

/* ══════════════
   라이프사이클 통계
══════════════ */
async function loadLifecycleStats() {
    if (!memberData?.membership) return;
    const data = await authApi(C.API.MEMBER_MY_LESSONS);
    if (!data || !data.success) return;
    renderLifecycleStats(memberData.membership, data.data);
}

function renderLifecycleStats(ms, lessons) {
    const pastLessons = (lessons || []).filter(l => l.isPast);

    // Build last-6-month buckets
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        return { year: d.getFullYear(), month: d.getMonth() + 1, label: `${d.getMonth() + 1}월`, count: 0 };
    });
    pastLessons.forEach(l => {
        const d = new Date(l.startTime);
        const slot = months.find(s => s.year === d.getFullYear() && s.month === d.getMonth() + 1);
        if (slot) slot.count++;
    });
    const maxCount = Math.max(...months.map(m => m.count), 1);

    const sparkBars = months.map(m => {
        const h = Math.max(Math.round((m.count / maxCount) * 100), 4);
        return `<div class="spark-bar${m.count === maxCount && m.count > 0 ? ' hi' : ''}" style="height:${h}%"></div>`;
    }).join('');

    const monthBars = months.map(m => `
        <div class="month-bar-item">
            <div class="month-bar-count">${m.count || ''}</div>
            <div class="month-bar-track"><div class="month-bar-fill" style="height:${Math.round((m.count / maxCount) * 100)}%"></div></div>
            <div class="month-bar-label">${m.label}</div>
        </div>`).join('');

    let progressHtml = '';
    let paceHtml = '';
    if (ms.type === 'PERIOD' && !ms.expired) {
        const startMs   = new Date(ms.startDate).getTime();
        const endMs     = new Date(ms.endDate).getTime();
        const totalDays = Math.max((endMs - startMs) / 86400000, 1);
        const usedDays  = Math.max((Date.now() - startMs) / 86400000, 0);
        const pct       = Math.min(Math.round((usedDays / totalDays) * 100), 100);
        const avgPerMonth = pastLessons.length > 0 ? (pastLessons.length / 6).toFixed(1) : '0';
        const curMonth    = months[5].count;

        progressHtml = `
            <div class="period-progress">
                <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--fg-neutral-tertiary);margin-bottom:5px">
                    <span>${escapeHtml(ms.startDate)}</span>
                    <span>${ms.remainDays}일 남음</span>
                    <span>${escapeHtml(ms.endDate)}</span>
                </div>
                <div class="period-progress-bar"><div class="period-progress-fill" style="width:${pct}%"></div></div>
            </div>`;
        paceHtml = `<div class="lifecycle-pace">월 평균 ${avgPerMonth}회 · 이번 달 ${curMonth}회</div>`;
    }

    const el = document.createElement('div');
    el.className = 'lifecycle-card fade-in';
    el.innerHTML = `
        <div class="lifecycle-title">
            <span>📊 이용 통계</span>
            <span style="font-size:12px;color:var(--fg-neutral-tertiary)">누적 ${pastLessons.length}회</span>
        </div>
        <div class="spark">${sparkBars}</div>
        <div class="month-chart">${monthBars}</div>
        ${progressHtml}
        ${paceHtml}`;

    const msCard = $('membership-card');
    const next   = msCard.nextElementSibling;
    if (next && next.classList.contains('lifecycle-card')) {
        next.replaceWith(el);
    } else {
        msCard.insertAdjacentElement('afterend', el);
    }
}

/* ══════════════
   D-7 만료 경고
══════════════ */
function checkExpiryWarning(ms) {
    if (!ms) return;
    const KEY = 'sb_expiry_warned';
    if (sessionStorage.getItem(KEY)) return;

    let title, desc, info;
    if (ms.type === 'PERIOD' && !ms.expired && ms.remainDays <= 7 && ms.remainDays > 0) {
        title = '기간권 만료 임박';
        desc  = `회원권이 ${ms.remainDays}일 후 만료됩니다. 갱신하지 않으면 수업 예약이 불가합니다.`;
        info  = `<div class="expiry-info-row"><span>만료일</span><span>${escapeHtml(ms.endDate)}</span></div>
                 <div class="expiry-info-row"><span>잔여 일수</span><span style="color:var(--danger);font-weight:700">D-${ms.remainDays}</span></div>`;
    } else if (ms.type === 'SESSION' && ms.remainSessions > 0 && ms.remainSessions <= 2) {
        title = '횟수권 소진 임박';
        desc  = `횟수권 잔여 횟수가 ${ms.remainSessions}회밖에 남지 않았습니다. 추가 발급이 필요합니다.`;
        info  = `<div class="expiry-info-row"><span>잔여 횟수</span><span style="color:var(--danger);font-weight:700">${ms.remainSessions}회</span></div>
                 <div class="expiry-info-row"><span>사용 횟수</span><span>${ms.usedSessions} / ${ms.totalSessions}회</span></div>`;
    } else {
        return;
    }

    sessionStorage.setItem(KEY, '1');
    $('expiry-modal-title').textContent = title;
    $('expiry-modal-desc').textContent  = desc;
    $('expiry-modal-info').innerHTML    = info;
    show('expiry-modal-overlay');
}

function closeExpiryModal() { hide('expiry-modal-overlay'); }

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
