package com.surfshop.scheduler;

import com.surfshop.entity.Member;
import com.surfshop.entity.Membership;
import com.surfshop.repository.MembershipRepository;
import com.surfshop.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class ExpiryNotificationScheduler {

    private final MembershipRepository membershipRepository;
    private final EmailService emailService;

    @Scheduled(cron = "0 0 9 * * *")
    public void sendExpiryWarnings() {
        sendExpiryWarningsForDays(7);
    }

    @Transactional(readOnly = true)
    public int sendExpiryWarningsForDays(long targetDays) {
        LocalDate today = LocalDate.now();
        List<Membership> activeMemberships = membershipRepository.findAllActiveWithEndDate();
        int count = 0;
        for (Membership ms : activeMemberships) {
            if (ms.getEndDate() == null) continue;
            long daysLeft = ChronoUnit.DAYS.between(today, ms.getEndDate());
            if (daysLeft == targetDays) {
                Member member = ms.getMember();
                emailService.sendMembershipExpiryWarning(
                    member.getEmail(), member.getName(),
                    member.getShop().getName(), ms.getEndDate().toString(), (int) daysLeft
                );
                log.info("만료 알림 발송: {} → {} ({}일 남음)", member.getName(), member.getEmail(), daysLeft);
                count++;
            }
        }
        return count;
    }
}
