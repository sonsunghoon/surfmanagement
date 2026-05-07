package com.surfshop.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.surfshop.dto.ApiResponse;
import com.surfshop.entity.Member;
import com.surfshop.service.MemberService;
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
public class MemberAuthInterceptor implements HandlerInterceptor {

    private final MemberService memberService;
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
        Optional<Member> memberOpt = memberService.validateToken(token);

        if (memberOpt.isEmpty()) {
            sendUnauthorized(response);
            return false;
        }

        request.setAttribute("currentMember", memberOpt.get());
        return true;
    }

    private void sendUnauthorized(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8");
        response.getWriter().write(objectMapper.writeValueAsString(ApiResponse.error("인증이 필요합니다.")));
    }
}
