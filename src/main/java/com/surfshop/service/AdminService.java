package com.surfshop.service;

import com.surfshop.dto.AdminLoginRequest;
import com.surfshop.dto.AdminLoginResponse;
import com.surfshop.dto.AdminRegisterRequest;
import com.surfshop.dto.ApiResponse;
import com.surfshop.entity.Admin;
import com.surfshop.entity.SurfShop;
import com.surfshop.repository.AdminRepository;
import com.surfshop.repository.MemberRepository;
import com.surfshop.repository.SurfShopRepository;
import com.surfshop.repository.NotificationRepository;
import com.surfshop.repository.LessonRepository;
import com.surfshop.repository.ReservationRepository;
import com.surfshop.repository.WaitlistRepository;
import com.surfshop.repository.MembershipRepository;
import com.surfshop.repository.KeepingMembershipRepository;
import com.surfshop.repository.MemberNotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminService {

    private static final int TOKEN_EXPIRY_HOURS = 24;
    private static final String MSG_LOGIN_FAIL = "이메일 또는 비밀번호가 올바르지 않습니다.";

    private final AdminRepository adminRepository;
    private final SurfShopRepository surfShopRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final MemberRepository memberRepository;
    private final NotificationRepository notificationRepository;
    private final LessonRepository lessonRepository;
    private final ReservationRepository reservationRepository;
    private final WaitlistRepository waitlistRepository;
    private final MembershipRepository membershipRepository;
    private final KeepingMembershipRepository keepingMembershipRepository;
    private final MemberNotificationRepository memberNotificationRepository;

    @Transactional
    public ApiResponse<AdminLoginResponse> register(AdminRegisterRequest request) {
        if (adminRepository.findByEmail(request.getEmail()).isPresent()) {
            return ApiResponse.error("이미 사용 중인 이메일입니다.");
        }

        SurfShop shop = surfShopRepository.save(SurfShop.builder()
                .name(request.getShopName())
                .location(request.getShopLocation())
                .description(request.getShopDescription())
                .build());

        String token = UUID.randomUUID().toString();
        Admin admin = adminRepository.save(Admin.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .shop(shop)
                .authToken(token)
                .tokenExpiresAt(LocalDateTime.now().plusHours(TOKEN_EXPIRY_HOURS))
                .build());

        return ApiResponse.success("관리자 계정이 생성되었습니다.",
                new AdminLoginResponse(token, shop.getName(), shop.getId(), admin.getEmail()));
    }

    @Transactional
    public ApiResponse<AdminLoginResponse> login(AdminLoginRequest request) {
        Admin admin = adminRepository.findByEmail(request.getEmail()).orElse(null);

        if (admin == null || !passwordEncoder.matches(request.getPassword(), admin.getPassword())) {
            return ApiResponse.error(MSG_LOGIN_FAIL);
        }

        String token = UUID.randomUUID().toString();
        admin.setAuthToken(token);
        admin.setTokenExpiresAt(LocalDateTime.now().plusHours(TOKEN_EXPIRY_HOURS));

        return ApiResponse.success("로그인 성공",
                new AdminLoginResponse(token, admin.getShop().getName(), admin.getShop().getId(), admin.getEmail()));
    }

    @Transactional
    public void logout(String token) {
        adminRepository.findByAuthToken(token).ifPresent(admin -> {
            admin.setAuthToken(null);
            admin.setTokenExpiresAt(null);
        });
    }

    @Transactional(readOnly = true)
    public Optional<Admin> validateToken(String token) {
        return adminRepository.findByAuthToken(token)
                .filter(admin -> admin.getTokenExpiresAt() != null
                        && admin.getTokenExpiresAt().isAfter(LocalDateTime.now()));
    }

    @Transactional
    public void deleteAdminAccount(Admin admin) {
        SurfShop shop = admin.getShop();
        List<com.surfshop.entity.Member> members = memberRepository.findByShop(shop);
        for (com.surfshop.entity.Member member : members) {
            memberNotificationRepository.deleteAllByMember(member);
            reservationRepository.deleteAllByMember(member);
            waitlistRepository.deleteAllByMember(member);
            membershipRepository.deleteAllByMember(member);
            keepingMembershipRepository.deleteAllByMember(member);
        }
        memberRepository.deleteAll(members);
        List<com.surfshop.entity.Lesson> lessons = lessonRepository.findByShopOrderByStartTimeAsc(shop);
        for (com.surfshop.entity.Lesson lesson : lessons) {
            reservationRepository.deleteAllByLesson(lesson);
            waitlistRepository.deleteAllByLesson(lesson);
        }
        lessonRepository.deleteAll(lessons);
        notificationRepository.deleteAllByShop(shop);
        adminRepository.delete(admin);
        surfShopRepository.delete(shop);
    }
}
