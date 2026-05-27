package com.surfshop.scheduler;

import com.surfshop.entity.Member;
import com.surfshop.entity.Membership;
import com.surfshop.repository.MembershipRepository;
import com.surfshop.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class ExpiryNotificationScheduler {

    private final MembershipRepository membershipRepository;
    private final EmailService emailService;

    // 매일 오전 9시 실행
    @Scheduled(cron = "0 0 9 * * *")
    public void sendExpiryWarnings() {
        LocalDate today = LocalDate.now();
        List<Membership> activeMemberships = membershipRepository.findAllActiveWithEndDate();

        for (Membership ms : activeMemberships) {
            if (ms.getEndDate() == null) continue;
            long daysLeft = ChronoUnit.DAYS.between(today, ms.getEndDate());

            if (daysLeft == 30 || daysLeft == 14 || daysLeft == 7 || daysLeft == 3) {
                Member member = ms.getMember();
                emailService.sendMembershipExpiryWarning(
                    member.getEmail(),
                    member.getName(),
                    member.getShop().getName(),
                    ms.getEndDate().toString(),
                    (int) daysLeft
                );
                log.info("만료 알림 발송: {} → {} ({}일 남음)", member.getName(), member.getEmail(), daysLeft);
            }
        }
    }
}
