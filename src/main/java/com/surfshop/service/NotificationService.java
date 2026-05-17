package com.surfshop.service;

import com.surfshop.entity.Notification;
import com.surfshop.entity.SurfShop;
import com.surfshop.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;

    @Transactional
    public void createReservation(SurfShop shop, String memberName, String lessonTitle, String lessonDate) {
        save(shop, Notification.NotificationType.RESERVATION, memberName, lessonTitle, lessonDate,
                memberName + " 님이 " + lessonDate + " " + lessonTitle + " 수업을 예약했습니다.");
    }

    @Transactional
    public void createCancellation(SurfShop shop, String memberName, String lessonTitle, String lessonDate) {
        save(shop, Notification.NotificationType.CANCELLATION, memberName, lessonTitle, lessonDate,
                memberName + " 님이 " + lessonDate + " " + lessonTitle + " 수업 예약을 취소했습니다.");
    }

    @Transactional
    public void createNewMember(SurfShop shop, String memberName) {
        save(shop, Notification.NotificationType.NEW_MEMBER, memberName, null, null,
                memberName + " 님이 회원 가입을 신청했습니다.");
    }

    @Transactional
    public void createWaitlistPromoted(SurfShop shop, String memberName, String lessonTitle, String lessonDate) {
        save(shop, Notification.NotificationType.WAITLIST_PROMOTED, memberName, lessonTitle, lessonDate,
                memberName + " 님이 대기에서 예약으로 자동 전환되었습니다. (" + lessonDate + " " + lessonTitle + ")");
    }

    @Transactional(readOnly = true)
    public List<Notification> getNotifications(SurfShop shop) {
        return notificationRepository.findByShopOrderByCreatedAtDesc(shop);
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(SurfShop shop) {
        return notificationRepository.countByShopAndReadFalse(shop);
    }

    @Transactional
    public void markAllRead(SurfShop shop) {
        notificationRepository.findByShopAndReadFalseOrderByCreatedAtDesc(shop)
                .forEach(n -> n.setRead(true));
    }

    @Transactional
    public void markRead(Long id) {
        notificationRepository.findById(id).ifPresent(n -> n.setRead(true));
    }

    private void save(SurfShop shop, Notification.NotificationType type, String memberName,
                      String lessonTitle, String lessonDate, String message) {
        notificationRepository.save(Notification.builder()
                .shop(shop)
                .type(type)
                .memberName(memberName)
                .lessonTitle(lessonTitle)
                .lessonDate(lessonDate)
                .message(message)
                .build());
    }
}
