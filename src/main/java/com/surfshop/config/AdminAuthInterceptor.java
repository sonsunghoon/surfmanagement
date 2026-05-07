package com.surfshop.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.surfshop.dto.ApiResponse;
import com.surfshop.entity.Admin;
import com.surfshop.service.AdminService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class AdminAuthInterceptor implements HandlerInterceptor {

    private final AdminService adminService;
    private final ObjectMapper objectMapper;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws IOException {
        String authorization = request.getHeader("Authorization");

        if (authorization == null || !authorization.startsWith("Bearer ")) {
            sendUnauthorized(response);
            return false;
        }

        String token = authorization.substring(7);
        Optional<Admin> adminOpt = adminService.validateToken(token);

        if (adminOpt.isEmpty()) {
            sendUnauthorized(response);
            return false;
        }

        request.setAttribute("currentAdmin", adminOpt.get());
        return true;
    }

    private void sendUnauthorized(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8");
        response.getWriter().write(objectMapper.writeValueAsString(ApiResponse.error("인증이 필요합니다.")));
    }
}
