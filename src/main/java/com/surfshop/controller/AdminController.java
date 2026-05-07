package com.surfshop.controller;

import com.surfshop.dto.AdminLoginRequest;
import com.surfshop.dto.AdminLoginResponse;
import com.surfshop.dto.ApiResponse;
import com.surfshop.dto.LessonCreateRequest;
import com.surfshop.dto.MembershipAssignRequest;
import com.surfshop.entity.*;
import com.surfshop.repository.ReservationRepository;
import com.surfshop.service.AdminService;
import com.surfshop.service.LessonService;
import com.surfshop.service.MemberService;
import com.surfshop.service.MembershipService;
import org.springframework.transaction.annotation.Transactional;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.LocalDate;
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
    private final MemberService memberService;
    private final LessonService lessonService;
    private final MembershipService membershipService;
    private final ReservationRepository reservationRepository;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AdminLoginResponse>> login(@Valid @RequestBody AdminLoginRequest request) {
        ApiResponse<AdminLoginResponse> response = adminService.login(request);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<?>> logout(HttpServletRequest request) {
        String token = extractToken(request);
        if (token != null) {
            adminService.logout(token);
        }
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

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("shopName", shop.getName());
        data.put("pendingCount", pendingMembers.size());
        data.put("approvedCount", approvedCount);
        data.put("todayLessonCount", todayLessons.size());
        data.put("totalMemberCount", allMembers.size());

        return ResponseEntity.ok(ApiResponse.success("대시보드 조회 성공", data));
    }

    @GetMapping("/members")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getMembers(
            @RequestParam(defaultValue = "ALL") String status,
            HttpServletRequest request) {
        Admin admin = (Admin) request.getAttribute("currentAdmin");
        SurfShop shop = admin.getShop();

        List<Member> members = "PENDING".equals(status)
                ? memberService.getPendingMembers(shop)
                : memberService.getAllMembers(shop);

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
            memberService.getMembership(m).ifPresentOrElse(ms -> {
                Map<String, Object> msMap = buildMembershipMap(ms);
                map.put("membership", msMap);
            }, () -> map.put("membership", null));
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
            @PathVariable Long id,
            @RequestBody MembershipAssignRequest request) {
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

    @PostMapping("/lessons")
    public ResponseEntity<ApiResponse<?>> createLesson(
            @Valid @RequestBody LessonCreateRequest request,
            HttpServletRequest httpRequest) {
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
                        if (ms.getType() == Membership.MembershipType.PERIOD) {
                            long remain = java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), ms.getEndDate());
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
        return ResponseEntity.ok(ApiResponse.success("수업 상세 조회", result));
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

    private Map<String, Object> buildMembershipMap(Membership ms) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", ms.getId());
        m.put("type", ms.getType().name());
        m.put("typeLabel", ms.getType().getLabel());
        m.put("startDate", ms.getStartDate().toString());
        if (ms.getType() == Membership.MembershipType.PERIOD) {
            m.put("endDate", ms.getEndDate().toString());
            long remainDays = java.time.temporal.ChronoUnit.DAYS.between(
                    java.time.LocalDate.now(), ms.getEndDate());
            m.put("remainDays", Math.max(remainDays, 0));
            m.put("expired", remainDays < 0);
        } else {
            m.put("totalSessions", ms.getTotalSessions());
            m.put("usedSessions", ms.getUsedSessions());
            m.put("remainSessions", ms.getTotalSessions() - ms.getUsedSessions());
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

    private String extractToken(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")) {
            return authorization.substring(7);
        }
        return null;
    }
}
