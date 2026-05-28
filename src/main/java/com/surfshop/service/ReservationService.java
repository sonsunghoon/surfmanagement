package com.surfshop.service;

import com.surfshop.dto.ApiResponse;
import com.surfshop.entity.*;
import com.surfshop.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ReservationService {

    private final ReservationRepository reservationRepository;
    private final MembershipRepository membershipRepository;
    private final LessonRepository lessonRepository;
    private final WaitlistRepository waitlistRepository;
    private final NotificationService notificationService;
    private final MemberNotificationService memberNotificationService;

    @Transactional
    public ApiResponse<?> reserve(Member member, Lesson lesson) {
        if (lesson.getCurrentReservations() >= lesson.getMaxCapacity()) {
            return ApiResponse.error("정원이 꽉 찼습니다. 예약 대기를 신청해보세요.");
        }
        if (reservationRepository.existsByLessonAndMemberAndStatus(
                lesson, member, Reservation.ReservationStatus.CONFIRMED)) {
            return ApiResponse.error("이미 예약된 수업입니다.");
        }

        Membership ms = getValidMembership(member);
        if (ms == null) return ApiResponse.error("유효한 회원권이 없습니다.");

        if (ms.getType() == Membership.MembershipType.PERIOD) {
            if (ms.getEndDate() != null && ms.getEndDate().isBefore(LocalDate.now())) {
                return ApiResponse.error("기간권이 만료되었습니다.");
            }
        } else if (ms.getType() == Membership.MembershipType.SESSION) {
            int total = ms.getTotalSessions() != null ? ms.getTotalSessions() : 0;
            int remaining = total - ms.getUsedSessions();
            if (remaining <= 0) return ApiResponse.error("남은 횟수가 없습니다.");
            ms.setUsedSessions(ms.getUsedSessions() + 1);
        }

        lesson.setCurrentReservations(lesson.getCurrentReservations() + 1);
        lessonRepository.save(lesson);

        Reservation reservation = Reservation.builder()
                .lesson(lesson)
                .member(member)
                .build();
        reservationRepository.save(reservation);

        notificationService.createReservation(
                member.getShop(),
                member.getName(),
                lesson.getTitle(),
                lesson.getStartTime().toLocalDate().format(DateTimeFormatter.ofPattern("MM월 dd일"))
        );

        return ApiResponse.success("예약이 완료되었습니다.", reservation.getId());
    }

    @Transactional
    public ApiResponse<?> cancel(Member member, Long reservationId) {
        Reservation reservation = reservationRepository.findById(reservationId).orElse(null);
        if (reservation == null) return ApiResponse.error("예약을 찾을 수 없습니다.");
        if (!reservation.getMember().getId().equals(member.getId())) {
            return ApiResponse.error("본인의 예약만 취소할 수 있습니다.");
        }
        if (reservation.getStatus() == Reservation.ReservationStatus.CANCELLED) {
            return ApiResponse.error("이미 취소된 예약입니다.");
        }

        reservation.setStatus(Reservation.ReservationStatus.CANCELLED);
        Lesson lesson = reservation.getLesson();
        lesson.setCurrentReservations(Math.max(0, lesson.getCurrentReservations() - 1));
        lessonRepository.save(lesson);

        // 횟수권이면 횟수 복구
        membershipRepository.findTopByMemberAndActiveTrueOrderByCreatedAtDesc(member)
                .filter(ms -> ms.getType() == Membership.MembershipType.SESSION)
                .ifPresent(ms -> ms.setUsedSessions(Math.max(0, ms.getUsedSessions() - 1)));

        String lessonDateStr = lesson.getStartTime().toLocalDate().format(DateTimeFormatter.ofPattern("MM월 dd일"));
        notificationService.createCancellation(
                member.getShop(), member.getName(), lesson.getTitle(), lessonDateStr);

        // 대기자 자동 승격
        promoteFromWaitlist(lesson, lessonDateStr);

        return ApiResponse.success("예약이 취소되었습니다.");
    }

    @Transactional
    public ApiResponse<?> joinWaitlist(Member member, Lesson lesson) {
        if (lesson.getCurrentReservations() < lesson.getMaxCapacity()) {
            return ApiResponse.error("정원에 여유가 있습니다. 일반 예약을 이용해주세요.");
        }
        if (reservationRepository.existsByLessonAndMemberAndStatus(
                lesson, member, Reservation.ReservationStatus.CONFIRMED)) {
            return ApiResponse.error("이미 예약된 수업입니다.");
        }
        if (waitlistRepository.existsByLessonAndMemberAndStatus(
                lesson, member, WaitlistEntry.WaitlistStatus.WAITING)) {
            return ApiResponse.error("이미 대기 신청된 수업입니다.");
        }

        Membership ms = getValidMembership(member);
        if (ms == null) return ApiResponse.error("유효한 회원권이 없습니다.");

        WaitlistEntry entry = WaitlistEntry.builder()
                .lesson(lesson)
                .member(member)
                .build();
        waitlistRepository.save(entry);

        return ApiResponse.success("예약 대기 신청이 완료되었습니다.", entry.getId());
    }

    @Transactional
    public ApiResponse<?> cancelWaitlist(Member member, Long waitlistId) {
        WaitlistEntry entry = waitlistRepository.findById(waitlistId).orElse(null);
        if (entry == null) return ApiResponse.error("대기 신청을 찾을 수 없습니다.");
        if (!entry.getMember().getId().equals(member.getId())) {
            return ApiResponse.error("본인의 대기 신청만 취소할 수 있습니다.");
        }
        if (entry.getStatus() != WaitlistEntry.WaitlistStatus.WAITING) {
            return ApiResponse.error("취소 가능한 대기 신청이 아닙니다.");
        }
        entry.setStatus(WaitlistEntry.WaitlistStatus.CANCELLED);
        return ApiResponse.success("예약 대기가 취소되었습니다.");
    }

    @Transactional(readOnly = true)
    public Optional<Reservation> findConfirmedReservation(Member member, Lesson lesson) {
        return reservationRepository.findByLessonAndMemberAndStatus(
                lesson, member, Reservation.ReservationStatus.CONFIRMED);
    }

    @Transactional(readOnly = true)
    public Optional<WaitlistEntry> findWaitlistEntry(Member member, Lesson lesson) {
        return waitlistRepository.findByLessonAndMemberAndStatus(
                lesson, member, WaitlistEntry.WaitlistStatus.WAITING);
    }

    @Transactional(readOnly = true)
    public List<Reservation> getMyReservations(Member member) {
        return reservationRepository.findByMemberAndStatusOrderByLessonStartTimeDesc(
                member, Reservation.ReservationStatus.CONFIRMED);
    }

    @Transactional(readOnly = true)
    public List<WaitlistEntry> getMyWaitlist(Member member) {
        return waitlistRepository.findByMemberAndStatusOrderByCreatedAtDesc(
                member, WaitlistEntry.WaitlistStatus.WAITING);
    }

    private void promoteFromWaitlist(Lesson lesson, String lessonDateStr) {
        List<WaitlistEntry> waiting = waitlistRepository
                .findByLessonAndStatusOrderByCreatedAtAsc(lesson, WaitlistEntry.WaitlistStatus.WAITING);

        for (WaitlistEntry entry : waiting) {
            Member candidate = entry.getMember();
            Membership ms = getValidMembership(candidate);
            if (ms == null) {
                entry.setStatus(WaitlistEntry.WaitlistStatus.CANCELLED);
                continue;
            }
            if (ms.getType() == Membership.MembershipType.PERIOD) {
                if (ms.getEndDate() != null && ms.getEndDate().isBefore(LocalDate.now())) {
                    entry.setStatus(WaitlistEntry.WaitlistStatus.CANCELLED);
                    continue;
                }
            } else if (ms.getType() == Membership.MembershipType.SESSION) {
                int total = ms.getTotalSessions() != null ? ms.getTotalSessions() : 0;
                int remaining = total - ms.getUsedSessions();
                if (remaining <= 0) {
                    entry.setStatus(WaitlistEntry.WaitlistStatus.CANCELLED);
                    continue;
                }
                ms.setUsedSessions(ms.getUsedSessions() + 1);
            }

            entry.setStatus(WaitlistEntry.WaitlistStatus.PROMOTED);
            lesson.setCurrentReservations(lesson.getCurrentReservations() + 1);
            lessonRepository.save(lesson);

            reservationRepository.save(Reservation.builder()
                    .lesson(lesson)
                    .member(candidate)
                    .build());

            notificationService.createWaitlistPromoted(
                    candidate.getShop(), candidate.getName(), lesson.getTitle(), lessonDateStr);
            memberNotificationService.createWaitlistPromoted(candidate, lesson.getTitle(), lessonDateStr);
            break;
        }
    }

    private Membership getValidMembership(Member member) {
        return membershipRepository
                .findByMemberAndTypeInAndActiveTrueOrderByCreatedAtDesc(
                        member, java.util.List.of(Membership.MembershipType.PERIOD, Membership.MembershipType.SESSION))
                .stream().findFirst().orElse(null);
    }
}
