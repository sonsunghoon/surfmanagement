package com.surfshop.controller;

import com.surfshop.dto.*;
import com.surfshop.dto.AdminAddMemberRequest;
import com.surfshop.entity.*;
import com.surfshop.repository.KeepingMembershipRepository;
import com.surfshop.repository.MembershipRepository;
import com.surfshop.repository.ReservationRepository;
import com.surfshop.repository.WaitlistRepository;
import com.surfshop.scheduler.ExpiryNotificationScheduler;
import com.surfshop.service.*;
import com.surfshop.repository.MemberRepository;
import org.springframework.transaction.annotation.Transactional;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;
    private final ExpiryNotificationScheduler expiryNotificationScheduler;
    private final MemberService memberService;
    private final LessonService lessonService;
    private final MembershipService membershipService;
    private final NotificationService notificationService;
    private final MemberNotificationService memberNotificationService;
    private final ReservationRepository reservationRepository;
    private final WaitlistRepository waitlistRepository;
    private final KeepingMembershipRepository keepingMembershipRepository;
    private final MembershipRepository membershipRepository;
    private final MemberRepository memberRepository;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AdminLoginResponse>> register(@Valid @RequestBody AdminRegisterRequest request) {
        ApiResponse<AdminLoginResponse> response = adminService.register(request);
        if (response.isSuccess()) return ResponseEntity.ok(response);
        return ResponseEntity.badRequest().body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AdminLoginResponse>> login(@Valid @RequestBody AdminLoginRequest request) {
        ApiResponse<AdminLoginResponse> response = adminService.login(request);
        if (response.isSuccess()) return ResponseEntity.ok(response);
        return ResponseEntity.badRequest().body(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<?>> logout(HttpServletRequest request) {
        String token = extractToken(request);
        if (token != null) adminService.logout(token);
        return ResponseEntity.ok(ApiResponse.success("로그아웃 되었습니다."));
    }

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getDashboard(HttpServletRequest request) {
        Admin admin = (Admin) request.getAttribute("currentAdmin");
        SurfShop shop = admin.getShop();

        List<Member> pendingMembers = memberService.getPendingMembers(shop);
        List<Lesson> todayLessons = lessonService.getTodayLessons(shop);
        List<Member> allMembers = memberService.getAllMembers(shop);
        long approvedCount = allMembers.stream()
                .filter(m -> m.getStatus() == Member.MemberStatus.APPROVED).count();

        int weekParticipants = lessonService.getWeekParticipants(shop);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("shopName", shop.getName());
        data.put("pendingCount", pendingMembers.size());
        data.put("approvedCount", approvedCount);
        data.put("todayLessonCount", todayLessons.size());
        data.put("totalMemberCount", allMembers.size());
        data.put("weekParticipants", weekParticipants);
        data.put("unreadNotifications", notificationService.getUnreadCount(shop));

        return ResponseEntity.ok(ApiResponse.success("대시보드 조회 성공", data));
    }

    @GetMapping("/members")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getMembers(
            @RequestParam(defaultValue = "ALL") String status,
            HttpServletRequest request) {
        Admin admin = (Admin) request.getAttribute("currentAdmin");
        SurfShop shop = admin.getShop();

        List<Member> members;
        switch (status) {
            case "PENDING":
                members = memberService.getPendingMembers(shop);
                break;
            case "APPROVED":
                members = memberService.getMembersByStatus(shop, Member.MemberStatus.APPROVED);
                break;
            case "REJECTED":
                members = memberService.getMembersByStatus(shop, Member.MemberStatus.REJECTED);
                break;
            default:
                members = memberService.getAllMembers(shop);
        }

        List<Map<String, Object>> result = members.stream().map(m -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", m.getId());
            map.put("name", m.getName());
            map.put("phone", m.getPhone());
            map.put("email", m.getEmail());
            map.put("boardType", m.getBoardType().getLabel());
            map.put("surfLevel", m.getSurfLevel().getLabel());
            map.put("status", m.getStatus().getLabel());
            map.put("statusCode", m.getStatus().name());
            map.put("createdAt", m.getCreatedAt().toString());
            membershipService.getActiveMembership(m.getId()).ifPresentOrElse(
                    ms -> map.put("membership", buildMembershipMap(ms)),
                    () -> map.put("membership", null));
            membershipService.getActiveSeasonMembership(m.getId()).ifPresentOrElse(
                    ms -> map.put("seasonMembership", buildMembershipMap(ms)),
                    () -> map.put("seasonMembership", null));
            keepingMembershipRepository.findTopByMemberAndActiveTrueOrderByCreatedAtDesc(m)
                    .ifPresentOrElse(
                            k -> map.put("keeping", buildKeepingMap(k)),
                            () -> map.put("keeping", null));
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success("회원 목록 조회 성공", result));
    }

    @PutMapping("/members/{id}/approve")
    public ResponseEntity<ApiResponse<?>> approveMember(@PathVariable Long id) {
        return ResponseEntity.ok(memberService.approveMember(id));
    }

    @PutMapping("/members/{id}/reject")
    public ResponseEntity<ApiResponse<?>> rejectMember(@PathVariable Long id) {
        return ResponseEntity.ok(memberService.rejectMember(id));
    }

    @PostMapping("/members/{id}/membership")
    public ResponseEntity<ApiResponse<?>> assignMembership(
            @PathVariable Long id, @RequestBody MembershipAssignRequest request) {
        ApiResponse<?> response = membershipService.assignMembership(id, request);
        if (response.isSuccess()) return ResponseEntity.ok(response);
        return ResponseEntity.badRequest().body(response);
    }

    @GetMapping("/members/{id}/membership")
    public ResponseEntity<ApiResponse<?>> getMembership(@PathVariable Long id) {
        Optional<Membership> msOpt = membershipService.getActiveMembership(id);
        if (msOpt.isPresent()) {
            return ResponseEntity.ok(ApiResponse.success("회원권 조회 성공", buildMembershipMap(msOpt.get())));
        }
        return ResponseEntity.ok(ApiResponse.success("회원권 없음", null));
    }

    @GetMapping("/members/{id}/season")
    public ResponseEntity<ApiResponse<?>> getSeasonMembership(@PathVariable Long id) {
        Optional<Membership> msOpt = membershipService.getActiveSeasonMembership(id);
        if (msOpt.isPresent()) {
            return ResponseEntity.ok(ApiResponse.success("시즌방 조회 성공", buildMembershipMap(msOpt.get())));
        }
        return ResponseEntity.ok(ApiResponse.success("시즌방 없음", null));
    }

    @PostMapping("/members/{id}/season")
    public ResponseEntity<ApiResponse<?>> assignSeasonMembership(
            @PathVariable Long id, @RequestBody MembershipAssignRequest request) {
        request.setType(Membership.MembershipType.SEASON);
        ApiResponse<?> response = membershipService.assignMembership(id, request);
        if (response.isSuccess()) return ResponseEntity.ok(response);
        return ResponseEntity.badRequest().body(response);
    }

    /* ── 키핑권 ── */
    @GetMapping("/members/{id}/keeping")
    public ResponseEntity<ApiResponse<?>> getKeeping(@PathVariable Long id) {
        Optional<KeepingMembership> opt = keepingMembershipRepository.findTopByMemberIdAndActiveTrueOrderByCreatedAtDesc(id);
        if (opt.isPresent()) {
            return ResponseEntity.ok(ApiResponse.success("키핑권 조회", buildKeepingMap(opt.get())));
        }
        return ResponseEntity.ok(ApiResponse.success("키핑권 없음", null));
    }

    @PostMapping("/members/{id}/keeping")
    @Transactional
    public ResponseEntity<ApiResponse<?>> assignKeeping(
            @PathVariable Long id, @RequestBody KeepingAssignRequest request,
            HttpServletRequest httpRequest) {
        Admin admin = (Admin) httpRequest.getAttribute("currentAdmin");
        Member member = memberService.getAllMembers(admin.getShop()).stream()
                .filter(m -> m.getId().equals(id)).findFirst().orElse(null);
        if (member == null) {
            return ResponseEntity.badRequest().body(ApiResponse.error("회원을 찾을 수 없습니다."));
        }
        if (request.getStartDate() == null) {
            return ResponseEntity.badRequest().body(ApiResponse.error("시작일을 입력해주세요."));
        }
        // 기존 키핑권 비활성화
        keepingMembershipRepository.findByMemberIdAndActiveTrue(id)
                .forEach(k -> k.setActive(false));

        keepingMembershipRepository.save(KeepingMembership.builder()
                .member(member)
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .boardBrand(request.getBoardBrand())
                .boardImageUrl(request.getBoardImageUrl())
                .build());
        return ResponseEntity.ok(ApiResponse.success("키핑권이 등록되었습니다."));
    }

    /* ── 회원에게 알림 보내기 ── */
    @PostMapping("/members/{id}/notify")
    public ResponseEntity<ApiResponse<?>> notifyMember(
            @PathVariable Long id, @RequestBody Map<String, String> body,
            HttpServletRequest request) {
        Admin admin = (Admin) request.getAttribute("currentAdmin");
        String message = body.get("message");
        if (message == null || message.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("메시지를 입력해주세요."));
        }
        Member member = memberRepository.findById(id).orElse(null);
        if (member == null || !member.getShop().getId().equals(admin.getShop().getId())) {
            return ResponseEntity.badRequest().body(ApiResponse.error("회원을 찾을 수 없습니다."));
        }
        memberNotificationService.createAdminMessage(member, message);
        return ResponseEntity.ok(ApiResponse.success("알림이 전송되었습니다."));
    }

    /* ── 회원권 만료 현황 ── */
    @GetMapping("/expiry-dashboard")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<Map<String, Object>>> getExpiryDashboard(HttpServletRequest request) {
        Admin admin = (Admin) request.getAttribute("currentAdmin");
        SurfShop shop = admin.getShop();
        LocalDate today = LocalDate.now();

        List<Membership> activeMemberships = membershipRepository.findAllActiveByShop(shop);

        List<Map<String, Object>> d7Members = new ArrayList<>();
        List<Map<String, Object>> d30Members = new ArrayList<>();
        int activeCount = 0;

        for (Membership ms : activeMemberships) {
            Map<String, Object> memberMap = buildExpiryMemberMap(ms, today);
            if (ms.getType() == Membership.MembershipType.PERIOD) {
                long daysLeft = ChronoUnit.DAYS.between(today, ms.getEndDate());
                if (daysLeft < 0) continue;
                if (daysLeft <= 7)  d7Members.add(memberMap);
                else if (daysLeft <= 30) d30Members.add(memberMap);
                else activeCount++;
            } else {
                int sessLeft = ms.getTotalSessions() - ms.getUsedSessions();
                if (sessLeft <= 0) continue;
                if (sessLeft <= 2)  d7Members.add(memberMap);
                else if (sessLeft <= 5) d30Members.add(memberMap);
                else activeCount++;
            }
        }

        d7Members.sort(Comparator.comparingLong(m -> ((Number) ((Map<?,?>) m).get("sortKey")).longValue()));
        d30Members.sort(Comparator.comparingLong(m -> ((Number) ((Map<?,?>) m).get("sortKey")).longValue()));

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("d7Count", d7Members.size());
        data.put("d30Count", d30Members.size());
        data.put("activeCount", activeCount);
        data.put("d7Members", d7Members);
        data.put("d30Members", d30Members);

        return ResponseEntity.ok(ApiResponse.success("만료 현황 조회 성공", data));
    }

    private Map<String, Object> buildExpiryMemberMap(Membership ms, LocalDate today) {
        Member member = ms.getMember();
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("memberId", member.getId());
        map.put("name", member.getName());
        map.put("phone", member.getPhone());
        map.put("membershipType", ms.getType().getLabel());

        if (ms.getType() == Membership.MembershipType.PERIOD) {
            long daysLeft = ChronoUnit.DAYS.between(today, ms.getEndDate());
            map.put("endDate", ms.getEndDate().toString());
            map.put("daysLeft", daysLeft);
            map.put("urgencyLabel", daysLeft <= 7 ? "D-" + daysLeft : daysLeft + "일 남음");
            map.put("urgencyClass", daysLeft <= 7 ? "danger" : "warn");
            map.put("sortKey", daysLeft);
        } else {
            int sessLeft = ms.getTotalSessions() - ms.getUsedSessions();
            map.put("sessionsLeft", sessLeft);
            map.put("totalSessions", ms.getTotalSessions());
            map.put("urgencyLabel", sessLeft + "회 남음");
            map.put("urgencyClass", sessLeft <= 2 ? "danger" : "warn");
            map.put("sortKey", (long) sessLeft);
        }
        return map;
    }

    /* ── 알림 ── */
    @GetMapping("/notifications")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getNotifications(HttpServletRequest request) {
        Admin admin = (Admin) request.getAttribute("currentAdmin");
        List<Notification> list = notificationService.getNotifications(admin.getShop());
        List<Map<String, Object>> result = list.stream().map(n -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", n.getId());
            map.put("type", n.getType().name());
            map.put("typeLabel", n.getType().getLabel());
            map.put("memberName", n.getMemberName());
            map.put("lessonTitle", n.getLessonTitle());
            map.put("lessonDate", n.getLessonDate());
            map.put("message", n.getMessage());
            map.put("read", n.isRead());
            map.put("createdAt", n.getCreatedAt().toString());
            return map;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success("알림 조회", result));
    }

    @GetMapping("/notifications/count")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getNotificationCount(HttpServletRequest request) {
        Admin admin = (Admin) request.getAttribute("currentAdmin");
        long count = notificationService.getUnreadCount(admin.getShop());
        return ResponseEntity.ok(ApiResponse.success("안읽은 알림", Map.of("count", count)));
    }

    @PutMapping("/notifications/read-all")
    public ResponseEntity<ApiResponse<?>> markAllRead(HttpServletRequest request) {
        Admin admin = (Admin) request.getAttribute("currentAdmin");
        notificationService.markAllRead(admin.getShop());
        return ResponseEntity.ok(ApiResponse.success("전체 읽음 처리되었습니다."));
    }

    @PutMapping("/notifications/{id}/read")
    public ResponseEntity<ApiResponse<?>> markRead(@PathVariable Long id) {
        notificationService.markRead(id);
        return ResponseEntity.ok(ApiResponse.success("읽음 처리되었습니다."));
    }

    /* ── 수업 ── */
    @PostMapping("/lessons")
    public ResponseEntity<ApiResponse<?>> createLesson(
            @Valid @RequestBody LessonCreateRequest request, HttpServletRequest httpRequest) {
        Admin admin = (Admin) httpRequest.getAttribute("currentAdmin");
        ApiResponse<?> response = lessonService.createLesson(admin.getShop(), request);
        if (response.isSuccess()) return ResponseEntity.ok(response);
        return ResponseEntity.badRequest().body(response);
    }

    @Transactional(readOnly = true)
    @GetMapping("/lessons/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getLessonDetail(
            @PathVariable Long id, HttpServletRequest request) {
        Admin admin = (Admin) request.getAttribute("currentAdmin");
        Lesson lesson = lessonService.findById(id).orElse(null);
        if (lesson == null || !lesson.getShop().getId().equals(admin.getShop().getId())) {
            return ResponseEntity.badRequest().body(ApiResponse.error("수업을 찾을 수 없습니다."));
        }

        List<Map<String, Object>> memberList = reservationRepository
                .findByLessonOrderByCreatedAtAsc(lesson).stream()
                .filter(r -> r.getStatus() == Reservation.ReservationStatus.CONFIRMED)
                .map(r -> {
                    Member m = r.getMember();
                    Map<String, Object> mm = new LinkedHashMap<>();
                    mm.put("name", m.getName());
                    mm.put("boardType", m.getBoardType().getLabel());
                    memberService.getMembership(m).ifPresentOrElse(ms -> {
                        mm.put("membershipType", ms.getType().getLabel());
                        if (ms.getType() == Membership.MembershipType.PERIOD || ms.getType() == Membership.MembershipType.SEASON) {
                            long remain = ms.getEndDate() != null
                                    ? java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), ms.getEndDate())
                                    : 0;
                            mm.put("membershipDetail", remain < 0 ? "만료" : remain + "일 남음");
                            mm.put("membershipExpired", remain < 0);
                        } else {
                            int remain = ms.getTotalSessions() - ms.getUsedSessions();
                            mm.put("membershipDetail", remain + "회 남음");
                            mm.put("membershipExpired", remain <= 0);
                        }
                    }, () -> {
                        mm.put("membershipType", "없음");
                        mm.put("membershipDetail", "-");
                        mm.put("membershipExpired", false);
                    });
                    return mm;
                }).collect(Collectors.toList());

        List<Map<String, Object>> waitlist = waitlistRepository
                .findByLessonAndStatusOrderByCreatedAtAsc(lesson, WaitlistEntry.WaitlistStatus.WAITING)
                .stream().map(w -> {
                    Map<String, Object> wm = new LinkedHashMap<>();
                    wm.put("id", w.getId());
                    wm.put("name", w.getMember().getName());
                    wm.put("boardType", w.getMember().getBoardType().getLabel());
                    wm.put("waitingSince", w.getCreatedAt().toString());
                    return wm;
                }).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", lesson.getId());
        result.put("title", lesson.getTitle());
        result.put("instructor", lesson.getInstructor());
        result.put("lessonType", lesson.getLessonType().getLabel());
        result.put("startTime", lesson.getStartTime().toString());
        result.put("endTime", lesson.getEndTime().toString());
        result.put("maxCapacity", lesson.getMaxCapacity());
        result.put("currentReservations", lesson.getCurrentReservations());
        result.put("members", memberList);
        result.put("waitlist", waitlist);
        return ResponseEntity.ok(ApiResponse.success("수업 상세 조회", result));
    }

    @PostMapping("/members")
    public ResponseEntity<ApiResponse<?>> addMember(
            @Valid @RequestBody AdminAddMemberRequest req, HttpServletRequest request) {
        Admin admin = (Admin) request.getAttribute("currentAdmin");
        return ResponseEntity.ok(memberService.addMemberByAdmin(admin.getShop(), req));
    }

    @DeleteMapping("/members/{id}")
    public ResponseEntity<ApiResponse<?>> deleteMember(@PathVariable Long id, HttpServletRequest request) {
        Admin admin = (Admin) request.getAttribute("currentAdmin");
        Member member = memberRepository.findById(id).orElse(null);
        if (member == null || !member.getShop().getId().equals(admin.getShop().getId())) {
            return ResponseEntity.badRequest().body(ApiResponse.error("존재하지 않는 회원입니다."));
        }
        memberService.deleteMember(member);
        return ResponseEntity.ok(ApiResponse.success("회원이 삭제되었습니다."));
    }

    @DeleteMapping("/me")
    public ResponseEntity<ApiResponse<?>> deleteAdminAccount(HttpServletRequest request) {
        Admin admin = (Admin) request.getAttribute("currentAdmin");
        adminService.deleteAdminAccount(admin);
        return ResponseEntity.ok(ApiResponse.success("계정이 삭제되었습니다."));
    }

    @DeleteMapping("/lessons")
    public ResponseEntity<ApiResponse<?>> deleteLessons(
            @RequestBody Map<String, List<Long>> body, HttpServletRequest request) {
        Admin admin = (Admin) request.getAttribute("currentAdmin");
        List<Long> ids = body.get("ids");
        if (ids == null || ids.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("삭제할 수업을 선택해주세요."));
        }
        lessonService.deleteLessons(ids, admin.getShop());
        return ResponseEntity.ok(ApiResponse.success(ids.size() + "개 수업이 삭제되었습니다."));
    }

    @GetMapping("/lessons/today")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getTodayLessons(HttpServletRequest request) {
        Admin admin = (Admin) request.getAttribute("currentAdmin");
        return ResponseEntity.ok(ApiResponse.success("오늘 수업 일정 조회 성공",
                mapLessons(lessonService.getTodayLessons(admin.getShop()))));
    }

    @GetMapping("/lessons")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getAllLessons(HttpServletRequest request) {
        Admin admin = (Admin) request.getAttribute("currentAdmin");
        return ResponseEntity.ok(ApiResponse.success("수업 목록 조회 성공",
                mapLessons(lessonService.getAllLessons(admin.getShop()))));
    }

    /* ── Helpers ── */
    private Map<String, Object> buildMembershipMap(Membership ms) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", ms.getId());
        m.put("type", ms.getType().name());
        m.put("typeLabel", ms.getType().getLabel());
        m.put("startDate", ms.getStartDate().toString());
        if (ms.getType() == Membership.MembershipType.PERIOD || ms.getType() == Membership.MembershipType.SEASON) {
            m.put("endDate", ms.getEndDate() != null ? ms.getEndDate().toString() : null);
            long remainDays = ms.getEndDate() != null
                    ? java.time.temporal.ChronoUnit.DAYS.between(java.time.LocalDate.now(), ms.getEndDate())
                    : 0;
            m.put("remainDays", Math.max(remainDays, 0));
            m.put("expired", remainDays < 0);
        } else {
            m.put("totalSessions", ms.getTotalSessions());
            m.put("usedSessions", ms.getUsedSessions());
            m.put("remainSessions", ms.getTotalSessions() - ms.getUsedSessions());
        }
        return m;
    }

    private Map<String, Object> buildKeepingMap(KeepingMembership k) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", k.getId());
        m.put("startDate", k.getStartDate().toString());
        m.put("endDate", k.getEndDate() != null ? k.getEndDate().toString() : null);
        m.put("boardBrand", k.getBoardBrand());
        m.put("boardImageUrl", k.getBoardImageUrl());
        m.put("active", k.isActive());
        if (k.getEndDate() != null) {
            long remain = java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), k.getEndDate());
            m.put("expired", remain < 0);
            m.put("remainDays", Math.max(remain, 0));
        } else {
            m.put("expired", false);
            m.put("remainDays", null);
        }
        return m;
    }

    private List<Map<String, Object>> mapLessons(List<Lesson> lessons) {
        return lessons.stream().map(l -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", l.getId());
            map.put("title", l.getTitle());
            map.put("instructor", l.getInstructor());
            map.put("lessonType", l.getLessonType().getLabel());
            map.put("lessonTypeCode", l.getLessonType().name());
            map.put("startTime", l.getStartTime().toString());
            map.put("endTime", l.getEndTime().toString());
            map.put("maxCapacity", l.getMaxCapacity());
            map.put("currentReservations", l.getCurrentReservations());
            map.put("availableSpots", l.getMaxCapacity() - l.getCurrentReservations());
            map.put("targetLevel", l.getTargetLevel() != null ? l.getTargetLevel().getLabel() : null);
            map.put("targetBoardType", l.getTargetBoardType() != null ? l.getTargetBoardType().getLabel() : null);
            map.put("waveSize", l.getWaveSize());
            map.put("wavePeriod", l.getWavePeriod());
            map.put("windInfo", l.getWindInfo());
            return map;
        }).collect(Collectors.toList());
    }

    @PostMapping("/test/send-expiry-email")
    public ResponseEntity<ApiResponse<?>> testExpiryEmail(
            @RequestParam(defaultValue = "7") long days,
            HttpServletRequest request) {
        int count = expiryNotificationScheduler.sendExpiryWarningsForDays(days);
        return ResponseEntity.ok(ApiResponse.success(count + "건 발송 완료 (만료 " + days + "일 전 기준)"));
    }

    private String extractToken(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")) {
            return authorization.substring(7);
        }
        return null;
    }
}
