package com.surfshop.service;

import com.surfshop.dto.AdminLoginRequest;
import com.surfshop.dto.AdminLoginResponse;
import com.surfshop.dto.ApiResponse;
import com.surfshop.entity.Admin;
import com.surfshop.repository.AdminRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminService {

    private static final int TOKEN_EXPIRY_HOURS = 24;
    private static final String MSG_LOGIN_FAIL = "이메일 또는 비밀번호가 올바르지 않습니다.";

    private final AdminRepository adminRepository;
    private final BCryptPasswordEncoder passwordEncoder;

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
}
