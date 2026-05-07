package com.surfshop.service;

import com.surfshop.dto.ApiResponse;
import com.surfshop.entity.Lesson;
import com.surfshop.entity.Member;
import com.surfshop.entity.Membership;
import com.surfshop.entity.Reservation;
import com.surfshop.repository.LessonRepository;
import com.surfshop.repository.MembershipRepository;
import com.surfshop.repository.ReservationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ReservationService {

    private final ReservationRepository reservationRepository;
    private final MembershipRepository membershipRepository;
    private final LessonRepository lessonRepository;

    @Transactional
    public ApiResponse<?> reserve(Member member, Lesson lesson) {
        if (lesson.getCurrentReservations() >= lesson.getMaxCapacity()) {
            return ApiResponse.error("정원이 꽉 찼습니다.");
        }
        if (reservationRepository.existsByLessonAndMemberAndStatus(
                lesson, member, Reservation.ReservationStatus.CONFIRMED)) {
            return ApiResponse.error("이미 예약된 수업입니다.");
        }

        Optional<Membership> msOpt = membershipRepository
                .findTopByMemberAndActiveTrueOrderByCreatedAtDesc(member);
        if (msOpt.isEmpty()) {
            return ApiResponse.error("유효한 회원권이 없습니다.");
        }

        Membership ms = msOpt.get();
        if (ms.getType() == Membership.MembershipType.PERIOD) {
            if (ms.getEndDate() != null && ms.getEndDate().isBefore(LocalDate.now())) {
                return ApiResponse.error("기간권이 만료되었습니다.");
            }
        } else {
            int remaining = ms.getTotalSessions() - ms.getUsedSessions();
            if (remaining <= 0) {
                return ApiResponse.error("남은 횟수가 없습니다.");
            }
            ms.setUsedSessions(ms.getUsedSessions() + 1);
        }

        lesson.setCurrentReservations(lesson.getCurrentReservations() + 1);
        lessonRepository.save(lesson);

        Reservation reservation = Reservation.builder()
                .lesson(lesson)
                .member(member)
                .build();
        reservationRepository.save(reservation);

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

        return ApiResponse.success("예약이 취소되었습니다.");
    }

    @Transactional(readOnly = true)
    public Optional<Reservation> findConfirmedReservation(Member member, Lesson lesson) {
        return reservationRepository.findByLessonAndMemberAndStatus(
                lesson, member, Reservation.ReservationStatus.CONFIRMED);
    }

    @Transactional(readOnly = true)
    public List<Reservation> getMyReservations(Member member) {
        return reservationRepository.findByMemberAndStatusOrderByLessonStartTimeDesc(
                member, Reservation.ReservationStatus.CONFIRMED);
    }
}
