package com.surfshop.repository;

import com.surfshop.entity.Member;
import com.surfshop.entity.Membership;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MembershipRepository extends JpaRepository<Membership, Long> {
    Optional<Membership> findTopByMemberAndActiveTrueOrderByCreatedAtDesc(Member member);
    void deleteAllByMember(Member member);
}
