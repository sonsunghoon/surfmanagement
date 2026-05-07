package com.surfshop.repository;

import com.surfshop.entity.Member;
import com.surfshop.entity.SurfShop;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MemberRepository extends JpaRepository<Member, Long> {
    boolean existsByShopAndPhone(SurfShop shop, String phone);
    boolean existsByShopAndEmail(SurfShop shop, String email);
    Optional<Member> findByShopAndEmail(SurfShop shop, String email);
    Optional<Member> findByAuthToken(String authToken);
    List<Member> findByShopAndStatusOrderByCreatedAtDesc(SurfShop shop, Member.MemberStatus status);
    List<Member> findByShopOrderByCreatedAtDesc(SurfShop shop);
}
