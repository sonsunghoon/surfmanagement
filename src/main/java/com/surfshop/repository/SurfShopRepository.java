package com.surfshop.repository;

import com.surfshop.entity.SurfShop;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SurfShopRepository extends JpaRepository<SurfShop, Long> {
}
