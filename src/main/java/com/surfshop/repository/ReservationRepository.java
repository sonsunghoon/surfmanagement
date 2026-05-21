package com.surfshop.repository;

import com.surfshop.entity.Lesson;
import com.surfshop.entity.Member;
import com.surfshop.entity.Reservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, Long> {
    List<Reservation> findByLessonOrderByCreatedAtAsc(Lesson lesson);
    boolean existsByLessonAndMemberAndStatus(Lesson lesson, Member member, Reservation.ReservationStatus status);
    Optional<Reservation> findByLessonAndMemberAndStatus(Lesson lesson, Member member, Reservation.ReservationStatus status);
    List<Reservation> findByMemberAndStatusOrderByCreatedAtDesc(Member member, Reservation.ReservationStatus status);
    List<Reservation> findByMemberAndStatusOrderByLessonStartTimeDesc(Member member, Reservation.ReservationStatus status);
    void deleteAllByLesson(Lesson lesson);
    void deleteAllByMember(Member member);
}
