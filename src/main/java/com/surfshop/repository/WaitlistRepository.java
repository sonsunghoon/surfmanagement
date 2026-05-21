package com.surfshop.repository;

import com.surfshop.entity.Lesson;
import com.surfshop.entity.Member;
import com.surfshop.entity.WaitlistEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WaitlistRepository extends JpaRepository<WaitlistEntry, Long> {
    boolean existsByLessonAndMemberAndStatus(Lesson lesson, Member member, WaitlistEntry.WaitlistStatus status);
    Optional<WaitlistEntry> findByLessonAndMemberAndStatus(Lesson lesson, Member member, WaitlistEntry.WaitlistStatus status);
    List<WaitlistEntry> findByLessonAndStatusOrderByCreatedAtAsc(Lesson lesson, WaitlistEntry.WaitlistStatus status);
    List<WaitlistEntry> findByMemberAndStatusOrderByCreatedAtDesc(Member member, WaitlistEntry.WaitlistStatus status);
    void deleteAllByLesson(Lesson lesson);
    void deleteAllByMember(Member member);
}
