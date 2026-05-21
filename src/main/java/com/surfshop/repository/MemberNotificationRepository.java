package com.surfshop.repository;

import com.surfshop.entity.Member;
import com.surfshop.entity.MemberNotification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MemberNotificationRepository extends JpaRepository<MemberNotification, Long> {
    List<MemberNotification> findByMemberOrderByCreatedAtDesc(Member member);
    List<MemberNotification> findByMemberAndReadFalseOrderByCreatedAtDesc(Member member);
    long countByMemberAndReadFalse(Member member);
    void deleteAllByMember(Member member);
}
