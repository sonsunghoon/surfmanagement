'use strict';

const SURF_SHOP_CONSTANTS = {
    API: {
        SHOPS:           '/api/shops',
        REGISTER:        '/api/members/register',
        MEMBER_LOGIN:    '/api/members/login',
        MEMBER_LOGOUT:   '/api/members/logout',
        MEMBER_ME:       '/api/members/me',
        ADMIN_LOGIN:     '/api/admin/login',
        ADMIN_LOGOUT:    '/api/admin/logout',
        ADMIN_DASHBOARD: '/api/admin/dashboard',
        ADMIN_MEMBERS:   '/api/admin/members',
        ADMIN_LESSONS_TODAY: '/api/admin/lessons/today',
        ADMIN_LESSONS:   '/api/admin/lessons',
        ADMIN_APPROVE:    (id) => `/api/admin/members/${id}/approve`,
        ADMIN_REJECT:     (id) => `/api/admin/members/${id}/reject`,
        ADMIN_MEMBERSHIP: (id) => `/api/admin/members/${id}/membership`,
        ADMIN_LESSONS_CREATE: '/api/admin/lessons',
        ADMIN_LESSON_DETAIL:  (id) => `/api/admin/lessons/${id}`,
        ADMIN_LESSONS_DELETE: '/api/admin/lessons',
        MEMBER_MY_LESSONS:       '/api/members/my-lessons',
        MEMBER_LESSONS_CALENDAR: '/api/members/lessons/calendar',
        MEMBER_LESSON_DETAIL: (id) => `/api/members/lessons/${id}`,
        MEMBER_RESERVE:   (id) => `/api/members/lessons/${id}/reserve`,
        MEMBER_CANCEL:    (id) => `/api/members/reservations/${id}`,
    },

    STORAGE: {
        TOKEN:        'sb_admin_token',
        SHOP_NAME:    'sb_shop_name',
        SHOP_ID:      'sb_shop_id',
        EMAIL:        'sb_admin_email',
        MEMBER_TOKEN: 'sb_member_token',
        MEMBER_ID:    'sb_member_id',
        MEMBER_NAME:  'sb_member_name',
        MEMBER_SHOP_ID:   'sb_member_shop_id',
        MEMBER_SHOP_NAME: 'sb_member_shop_name',
    },

    BOARD_TYPES: [
        { value: 'SHORTBOARD', label: '숏보드' },
        { value: 'LONGBOARD',  label: '롱보드' },
        { value: 'FUNBOARD',   label: '펀보드' },
        { value: 'SUP',        label: 'SUP' },
        { value: 'BODYBOARD',  label: '바디보드' },
    ],

    SURF_LEVELS: [
        { value: 'BEGINNER',     label: '입문자' },
        { value: 'INTERMEDIATE', label: '중급자' },
        { value: 'ADVANCED',     label: '고급자' },
        { value: 'EXPERT',       label: '전문가' },
    ],

    STATUS: {
        PENDING:  'PENDING',
        APPROVED: 'APPROVED',
        REJECTED: 'REJECTED',
    },

    MESSAGES: {
        REGISTER_SUCCESS:   '회원 가입 신청이 완료되었습니다.\n관리자의 승인 후 예약 서비스를 이용할 수 있습니다.',
        LOGIN_SUCCESS:      '로그인되었습니다.',
        LOGOUT_SUCCESS:     '로그아웃 되었습니다.',
        APPROVE_CONFIRM:    '이 회원을 승인하시겠습니까?',
        REJECT_CONFIRM:     '이 회원 신청을 반려하시겠습니까?',
        NETWORK_ERROR:      '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        REQUIRED_FIELDS:    '모든 필수 항목을 입력해주세요.',
        SELECT_SHOP:        '가입할 서핑샵을 선택해주세요.',
    },

    CAPACITY: {
        WARN_RATIO: 0.8,
    },
};
