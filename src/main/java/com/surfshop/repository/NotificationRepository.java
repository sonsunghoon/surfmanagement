package com.surfshop.repository;

import com.surfshop.entity.Notification;
import com.surfshop.entity.SurfShop;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByShopOrderByCreatedAtDesc(SurfShop shop);
    List<Notification> findByShopAndReadFalseOrderByCreatedAtDesc(SurfShop shop);
    long countByShopAndReadFalse(SurfShop shop);
}
