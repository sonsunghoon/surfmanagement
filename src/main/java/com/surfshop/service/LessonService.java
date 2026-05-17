package com.surfshop.service;

import com.surfshop.dto.ApiResponse;
import com.surfshop.dto.LessonCreateRequest;
import com.surfshop.entity.Lesson;
import com.surfshop.entity.SurfShop;
import com.surfshop.entity.Member;
import com.surfshop.repository.LessonRepository;
import com.surfshop.repository.ReservationRepository;
import com.surfshop.repository.WaitlistRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class LessonService {

    private final LessonRepository lessonRepository;
    private final ReservationRepository reservationRepository;
    private final WaitlistRepository waitlistRepository;

    @Transactional(readOnly = true)
    public List<Lesson> getTodayLessons(SurfShop shop) {
        LocalDate today = LocalDate.now();
        return lessonRepository.findByShopAndStartTimeBetweenOrderByStartTimeAsc(
                shop, today.atStartOfDay(), today.atTime(LocalTime.MAX));
    }

    @Transactional(readOnly = true)
    public List<Lesson> getAllLessons(SurfShop shop) {
        return lessonRepository.findByShopOrderByStartTimeAsc(shop);
    }

    @Transactional(readOnly = true)
    public List<Lesson> getLessonsForMonth(SurfShop shop, int year, int month) {
        LocalDate start = LocalDate.of(year, month, 1);
        LocalDate end = start.withDayOfMonth(start.lengthOfMonth());
        return lessonRepository.findByShopAndStartTimeBetweenOrderByStartTimeAsc(
                shop, start.atStartOfDay(), end.atTime(LocalTime.MAX));
    }

    @Transactional(readOnly = true)
    public Optional<Lesson> findById(Long id) {
        return lessonRepository.findById(id);
    }

    @Transactional
    public void deleteLessons(List<Long> ids, SurfShop shop) {
        for (Long id : ids) {
            lessonRepository.findById(id).ifPresent(lesson -> {
                if (lesson.getShop().getId().equals(shop.getId())) {
                    waitlistRepository.deleteAllByLesson(lesson);
                    reservationRepository.deleteAllByLesson(lesson);
                    lessonRepository.delete(lesson);
                }
            });
        }
    }

    @Transactional
    public ApiResponse<?> createLesson(SurfShop shop, LessonCreateRequest req) {
        if (req.getStartTime().isAfter(req.getEndTime()) || req.getStartTime().equals(req.getEndTime())) {
            return ApiResponse.error("종료 시간은 시작 시간보다 늦어야 합니다.");
        }
        Lesson lesson = Lesson.builder()
                .shop(shop)
                .title(req.getTitle())
                .instructor(req.getInstructor())
                .lessonType(req.getLessonType())
                .startTime(req.getDate().atTime(req.getStartTime()))
                .endTime(req.getDate().atTime(req.getEndTime()))
                .maxCapacity(req.getMaxCapacity())
                .targetLevel(req.getTargetLevel())
                .targetBoardType(req.getTargetBoardType())
                .waveSize(req.getWaveSize())
                .wavePeriod(req.getWavePeriod())
                .windInfo(req.getWindInfo())
                .build();
        lessonRepository.save(lesson);
        return ApiResponse.success("수업이 생성되었습니다.");
    }
}
