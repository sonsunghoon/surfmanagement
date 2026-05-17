package com.surfshop.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

    private final AdminAuthInterceptor adminAuthInterceptor;
    private final MemberAuthInterceptor memberAuthInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(adminAuthInterceptor)
                .addPathPatterns("/api/admin/**")
                .excludePathPatterns("/api/admin/login");

        registry.addInterceptor(memberAuthInterceptor)
                .addPathPatterns(
                    "/api/members/me",
                    "/api/members/logout",
                    "/api/members/lessons/calendar",
                    "/api/members/lessons/*",
                    "/api/members/lessons/*/reserve",
                    "/api/members/lessons/*/waitlist",
                    "/api/members/reservations",
                    "/api/members/reservations/*",
                    "/api/members/waitlist/*",
                    "/api/members/my-lessons",
                    "/api/members/my-waitlist"
                );
    }
}
