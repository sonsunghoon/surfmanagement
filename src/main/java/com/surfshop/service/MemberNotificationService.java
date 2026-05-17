package com.surfshop.service;

import com.surfshop.entity.Member;
import com.surfshop.entity.MemberNotification;
import com.surfshop.repository.MemberNotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MemberNotificationService {

    private final MemberNotificationRepository memberNotificationRepository;

    @Transactional
    public void createWaitlistPromoted(Member member, String lessonTitle, String lessonDate) {
        save(member, MemberNotification.MemberNotificationType.WAITLIST_PROMOTED,
                lessonDate + " " + lessonTitle + " 수업이 예약 대기에서 예약으로 전환되었습니다.",
                lessonTitle, lessonDate);
    }

    @Transactional
    public void createAdminMessage(Member member, String message) {
        save(member, MemberNotification.MemberNotificationType.ADMIN_MESSAGE, message, null, null);
    }

    @Transactional(readOnly = true)
    public List<MemberNotification> getNotifications(Member member) {
        return memberNotificationRepository.findByMemberOrderByCreatedAtDesc(member);
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(Member member) {
        return memberNotificationRepository.countByMemberAndReadFalse(member);
    }

    @Transactional
    public void markAllRead(Member member) {
        memberNotificationRepository.findByMemberAndReadFalseOrderByCreatedAtDesc(member)
                .forEach(n -> n.setRead(true));
    }

    @Transactional
    public void markRead(Long id) {
        memberNotificationRepository.findById(id).ifPresent(n -> n.setRead(true));
    }

    private void save(Member member, MemberNotification.MemberNotificationType type,
                      String message, String lessonTitle, String lessonDate) {
        memberNotificationRepository.save(MemberNotification.builder()
                .member(member)
                .type(type)
                .message(message)
                .lessonTitle(lessonTitle)
                .lessonDate(lessonDate)
                .build());
    }
}
