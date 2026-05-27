package com.surfshop.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String fromEmail;

    public void sendMembershipExpiryWarning(String toEmail, String memberName,
                                             String shopName, String expiryDate, int daysLeft) {
        if (fromEmail.isBlank() || toEmail.contains("@surfbook.local")) return;
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(fromEmail);
            msg.setTo(toEmail);
            msg.setSubject("[" + shopName + "] 회원권 만료 " + daysLeft + "일 전 안내");
            msg.setText(
                memberName + " 님, 안녕하세요.\n\n" +
                shopName + " 회원권이 " + daysLeft + "일 후(" + expiryDate + ") 만료됩니다.\n\n" +
                "만료 전 담당자에게 문의하여 회원권을 갱신해 주세요.\n\n" +
                "감사합니다.\n" + shopName
            );
            mailSender.send(msg);
        } catch (Exception e) {
            log.warn("이메일 발송 실패: {} → {}", toEmail, e.getMessage());
        }
    }
}
