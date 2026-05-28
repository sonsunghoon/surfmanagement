package com.surfshop.repository;

import com.surfshop.entity.Member;
import com.surfshop.entity.Membership;
import com.surfshop.entity.SurfShop;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MembershipRepository extends JpaRepository<Membership, Long> {
    Optional<Membership> findTopByMemberAndActiveTrueOrderByCreatedAtDesc(Member member);
    Optional<Membership> findTopByMemberAndTypeAndActiveTrueOrderByCreatedAtDesc(Member member, Membership.MembershipType type);
    List<Membership> findByMemberAndTypeInAndActiveTrueOrderByCreatedAtDesc(Member member, List<Membership.MembershipType> types);
    void deleteAllByMember(Member member);

    @Query("SELECT m FROM Membership m WHERE m.active = true AND m.endDate IS NOT NULL")
    List<Membership> findAllActiveWithEndDate();

    @Query("SELECT m FROM Membership m WHERE m.active = true AND m.member.shop = :shop AND m.member.status = 'APPROVED'")
    List<Membership> findAllActiveByShop(@Param("shop") SurfShop shop);
}
