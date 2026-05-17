package com.surfshop.repository;

import com.surfshop.entity.KeepingMembership;
import com.surfshop.entity.Member;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface KeepingMembershipRepository extends JpaRepository<KeepingMembership, Long> {
    Optional<KeepingMembership> findTopByMemberAndActiveTrueOrderByCreatedAtDesc(Member member);
    Optional<KeepingMembership> findTopByMemberIdAndActiveTrueOrderByCreatedAtDesc(Long memberId);
    List<KeepingMembership> findByMemberIdAndActiveTrue(Long memberId);
    void deleteAllByMember(Member member);
}
