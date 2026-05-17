package com.surfshop.controller;

import com.surfshop.dto.ApiResponse;
import com.surfshop.dto.MemberLoginRequest;
import com.surfshop.dto.MemberLoginResponse;
import com.surfshop.dto.MemberRegistrationRequest;
import com.surfshop.entity.*;
import com.surfshop.repository.KeepingMembershipRepository;
import com.surfshop.repository.MemberNotificationRepository;
import com.surfshop.repository.WaitlistRepository;
import com.surfshop.service.LessonService;
import com.surfshop.service.MemberNotificationService;
import com.surfshop.service.MemberService;
import com.surfshop.service.ReservationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/members")
@RequiredArgsConstructor
public class GuestController {

    private final MemberService memberService;
    private final LessonService lessonService;
    private final ReservationService reservationService;
    private final MemberNotificationService memberNotificationService;
    private final WaitlistRepository waitlistRepository;
    private final KeepingMembershipRepository keepingMembershipRepository;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<?>> register(@Valid @RequestBody MemberRegistrationRequest request) {
        ApiResponse<?> response = memberService.register(request);
        if (response.isSuccess()) return ResponseEntity.ok(response);
        return ResponseEntity.badRequest().body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<MemberLoginResponse>> login(@Valid @RequestBody MemberLoginRequest request) {
        ApiResponse<MemberLoginResponse> response = memberService.login(request);
        if (response.isSuccess()) return ResponseEntity.ok(response);
        return ResponseEntity.badRequest().body(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<?>> logout(HttpServletRequest request) {
        String token = extractToken(request);
        if (token != null) memberService.logout(token);
        return ResponseEntity.ok(ApiResponse.success("로그아웃 되었습니다."));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getMyInfo(HttpServletRequest request) {
        Member member = (Member) request.getAttribute("currentMember");
        return ResponseEntity.ok(ApiResponse.success("회원 정보 조회 성공", buildMemberInfo(member)));
    }

    /* ── 달력: 월별 수업 목록 ── */
    @Transactional(readOnly = true)
    @GetMapping("/lessons/calendar")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getLessonsCalendar(
            @RequestParam int year, @RequestParam int month, HttpServletRequest request) {
        Member member = (Member) request.getAttribute("currentMember");
        List<Lesson> lessons = lessonService.getLessonsForMonth(member.getShop(), year, month);

        DateTimeFormatter dateFmt = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        Map<String, List<Map<String, Object>>> byDate = new LinkedHashMap<>();

        for (Lesson l : lessons) {
            String dateKey = l.getStartTime().toLocalDate().format(dateFmt);
            Optional<Reservation> myRes = reservationService.findConfirmedReservation(member, l);
            Optional<WaitlistEntry> myWait = reservationService.findWaitlistEntry(member, l);
            byDate.computeIfAbsent(dateKey, k -> new ArrayList<>())
                    .add(buildLessonMap(l, myRes.orElse(null), myWait.orElse(null)));
        }

        YearMonth ym = YearMonth.of(year, month);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("year", year);
        result.put("month", month);
        result.put("daysInMonth", ym.lengthOfMonth());
        result.put("firstDayOfWeek", ym.atDay(1).getDayOfWeek().getValue() % 7);
        result.put("lessons", byDate);

        return ResponseEntity.ok(ApiResponse.success("달력 조회 성공", result));
    }

    /* ── 수업 상세 ── */
    @GetMapping("/lessons/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getLessonDetail(
            @PathVariable Long id, HttpServletRequest request) {
        Member member = (Member) request.getAttribute("currentMember");
        Lesson lesson = lessonService.findById(id).orElse(null);
        if (lesson == null || !lesson.getShop().getId().equals(member.getShop().getId())) {
            return ResponseEntity.badRequest().body(ApiResponse.error("수업을 찾을 수 없습니다."));
        }
        Optional<Reservation> myRes = reservationService.findConfirmedReservation(member, lesson);
        Optional<WaitlistEntry> myWait = reservationService.findWaitlistEntry(member, lesson);
        return ResponseEntity.ok(ApiResponse.success("수업 조회 성공",
                buildLessonMap(lesson, myRes.orElse(null), myWait.orElse(null))));
    }

    /* ── 예약 ── */
    @PostMapping("/lessons/{id}/reserve")
    public ResponseEntity<ApiResponse<?>> reserve(
            @PathVariable Long id, HttpServletRequest request) {
        Member member = (Member) request.getAttribute("currentMember");
        Lesson lesson = lessonService.findById(id).orElse(null);
        if (lesson == null) return ResponseEntity.badRequest().body(ApiResponse.error("수업을 찾을 수 없습니다."));
        ApiResponse<?> response = reservationService.reserve(member, lesson);
        if (response.isSuccess()) return ResponseEntity.ok(response);
        return ResponseEntity.badRequest().body(response);
    }

    /* ── 예약 취소 ── */
    @DeleteMapping("/reservations/{reservationId}")
    public ResponseEntity<ApiResponse<?>> cancelReservation(
            @PathVariable Long reservationId, HttpServletRequest request) {
        Member member = (Member) request.getAttribute("currentMember");
        ApiResponse<?> response = reservationService.cancel(member, reservationId);
        if (response.isSuccess()) return ResponseEntity.ok(response);
        return ResponseEntity.badRequest().body(response);
    }

    /* ── 예약 대기 신청 ── */
    @PostMapping("/lessons/{id}/waitlist")
    public ResponseEntity<ApiResponse<?>> joinWaitlist(
            @PathVariable Long id, HttpServletRequest request) {
        Member member = (Member) request.getAttribute("currentMember");
        Lesson lesson = lessonService.findById(id).orElse(null);
        if (lesson == null) return ResponseEntity.badRequest().body(ApiResponse.error("수업을 찾을 수 없습니다."));
        ApiResponse<?> response = reservationService.joinWaitlist(member, lesson);
        if (response.isSuccess()) return ResponseEntity.ok(response);
        return ResponseEntity.badRequest().body(response);
    }

    /* ── 예약 대기 취소 ── */
    @DeleteMapping("/waitlist/{waitlistId}")
    public ResponseEntity<ApiResponse<?>> cancelWaitlist(
            @PathVariable Long waitlistId, HttpServletRequest request) {
        Member member = (Member) request.getAttribute("currentMember");
        ApiResponse<?> response = reservationService.cancelWaitlist(member, waitlistId);
        if (response.isSuccess()) return ResponseEntity.ok(response);
        return ResponseEntity.badRequest().body(response);
    }

    /* ── 내 수업 목록 ── */
    @Transactional(readOnly = true)
    @GetMapping("/my-lessons")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getMyLessons(HttpServletRequest request) {
        Member member = (Member) request.getAttribute("currentMember");
        List<Reservation> reservations = reservationService.getMyReservations(member);

        List<Map<String, Object>> result = reservations.stream().map(r -> {
            Lesson l = r.getLesson();
            boolean isPast = l.getStartTime().isBefore(java.time.LocalDateTime.now());
            Map<String, Object> map = buildLessonMap(l, r, null);
            map.put("reservationId", r.getId());
            map.put("reservedAt", r.getCreatedAt().toString());
            map.put("isPast", isPast);
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success("나의 수업 목록", result));
    }

    /* ── 내 예약 대기 목록 ── */
    @Transactional(readOnly = true)
    @GetMapping("/my-waitlist")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getMyWaitlist(HttpServletRequest request) {
        Member member = (Member) request.getAttribute("currentMember");
        List<WaitlistEntry> entries = reservationService.getMyWaitlist(member);
        List<Map<String, Object>> result = entries.stream().map(w -> {
            Lesson l = w.getLesson();
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("waitlistId", w.getId());
            map.put("lessonId", l.getId());
            map.put("title", l.getTitle());
            map.put("startTime", l.getStartTime().toString());
            map.put("endTime", l.getEndTime().toString());
            map.put("instructor", l.getInstructor());
            map.put("waitingSince", w.getCreatedAt().toString());
            map.put("isPast", l.getStartTime().isBefore(java.time.LocalDateTime.now()));
            return map;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success("대기 목록", result));
    }

    /* ── 내 예약 목록 (stub) ── */
    @GetMapping("/reservations")
    public ResponseEntity<ApiResponse<?>> getMyReservations(HttpServletRequest request) {
        Member member = (Member) request.getAttribute("currentMember");
        return ResponseEntity.ok(ApiResponse.success("예약 목록", List.of()));
    }

    /* ── 회원 알림 ── */
    @GetMapping("/notifications")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getMyNotifications(HttpServletRequest request) {
        Member member = (Member) request.getAttribute("currentMember");
        List<Map<String, Object>> result = memberNotificationService.getNotifications(member).stream()
                .map(n -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("id", n.getId());
                    map.put("type", n.getType().name());
                    map.put("typeLabel", n.getType().getLabel());
                    map.put("message", n.getMessage());
                    map.put("lessonTitle", n.getLessonTitle());
                    map.put("lessonDate", n.getLessonDate());
                    map.put("read", n.isRead());
                    map.put("createdAt", n.getCreatedAt().toString());
                    return map;
                }).collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success("알림 조회", result));
    }

    @GetMapping("/notifications/count")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getMyNotificationCount(HttpServletRequest request) {
        Member member = (Member) request.getAttribute("currentMember");
        long count = memberNotificationService.getUnreadCount(member);
        return ResponseEntity.ok(ApiResponse.success("안읽은 알림", Map.of("count", count)));
    }

    @PutMapping("/notifications/read-all")
    public ResponseEntity<ApiResponse<?>> markAllMyNotificationsRead(HttpServletRequest request) {
        Member member = (Member) request.getAttribute("currentMember");
        memberNotificationService.markAllRead(member);
        return ResponseEntity.ok(ApiResponse.success("전체 읽음 처리되었습니다."));
    }

    @PutMapping("/notifications/{id}/read")
    public ResponseEntity<ApiResponse<?>> markMyNotificationRead(@PathVariable Long id) {
        memberNotificationService.markRead(id);
        return ResponseEntity.ok(ApiResponse.success("읽음 처리되었습니다."));
    }

    /* ── Helpers ── */
    private Map<String, Object> buildLessonMap(Lesson l, Reservation myReservation, WaitlistEntry myWaitlist) {
        long waitlistCount = waitlistRepository.findByLessonAndStatusOrderByCreatedAtAsc(
                l, WaitlistEntry.WaitlistStatus.WAITING).size();
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
        map.put("myReservationId", myReservation != null ? myReservation.getId() : null);
        map.put("reserved", myReservation != null);
        map.put("onWaitlist", myWaitlist != null);
        map.put("myWaitlistId", myWaitlist != null ? myWaitlist.getId() : null);
        map.put("waitlistCount", waitlistCount);
        map.put("isPast", l.getStartTime().isBefore(java.time.LocalDateTime.now()));
        return map;
    }

    private Map<String, Object> buildMemberInfo(Member member) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", member.getId());
        data.put("name", member.getName());
        data.put("email", member.getEmail());
        data.put("phone", member.getPhone());
        data.put("boardType", member.getBoardType().getLabel());
        data.put("surfLevel", member.getSurfLevel().getLabel());
        data.put("shopName", member.getShop().getName());
        data.put("shopId", member.getShop().getId());
        data.put("approvedAt", member.getApprovedAt() != null ? member.getApprovedAt().toLocalDate().toString() : null);

        memberService.getMembership(member).ifPresentOrElse(ms -> {
            Map<String, Object> msData = new LinkedHashMap<>();
            msData.put("id", ms.getId());
            msData.put("type", ms.getType().name());
            msData.put("typeLabel", ms.getType().getLabel());
            msData.put("startDate", ms.getStartDate().toString());
            if (ms.getType() == Membership.MembershipType.PERIOD) {
                msData.put("endDate", ms.getEndDate().toString());
                long remainDays = ChronoUnit.DAYS.between(LocalDate.now(), ms.getEndDate());
                msData.put("remainDays", Math.max(remainDays, 0));
                msData.put("expired", remainDays < 0);
                msData.put("canReserve", remainDays >= 0);
            } else {
                int remaining = ms.getTotalSessions() - ms.getUsedSessions();
                msData.put("totalSessions", ms.getTotalSessions());
                msData.put("usedSessions", ms.getUsedSessions());
                msData.put("remainSessions", remaining);
                msData.put("canReserve", remaining > 0);
            }
            data.put("membership", msData);
        }, () -> data.put("membership", null));

        keepingMembershipRepository.findTopByMemberAndActiveTrueOrderByCreatedAtDesc(member)
                .ifPresentOrElse(k -> {
                    Map<String, Object> kData = new LinkedHashMap<>();
                    kData.put("id", k.getId());
                    kData.put("startDate", k.getStartDate().toString());
                    kData.put("endDate", k.getEndDate() != null ? k.getEndDate().toString() : null);
                    kData.put("boardBrand", k.getBoardBrand());
                    kData.put("boardImageUrl", k.getBoardImageUrl());
                    if (k.getEndDate() != null) {
                        long remainDays = ChronoUnit.DAYS.between(LocalDate.now(), k.getEndDate());
                        kData.put("expired", remainDays < 0);
                        kData.put("remainDays", Math.max(remainDays, 0));
                    } else {
                        kData.put("expired", false);
                        kData.put("remainDays", null);
                    }
                    data.put("keeping", kData);
                }, () -> data.put("keeping", null));

        return data;
    }

    private String extractToken(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")) {
            return authorization.substring(7);
        }
        return null;
    }
}
