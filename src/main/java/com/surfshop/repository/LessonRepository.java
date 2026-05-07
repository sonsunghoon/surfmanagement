package com.surfshop.repository;

import com.surfshop.entity.Lesson;
import com.surfshop.entity.SurfShop;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface LessonRepository extends JpaRepository<Lesson, Long> {
    List<Lesson> findByShopAndStartTimeBetweenOrderByStartTimeAsc(
            SurfShop shop, LocalDateTime start, LocalDateTime end);
    List<Lesson> findByShopOrderByStartTimeAsc(SurfShop shop);
}
