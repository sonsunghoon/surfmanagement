package com.surfshop.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DatabaseMigration {

    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void fixMembershipTypeConstraint() {
        try {
            jdbcTemplate.execute("ALTER TABLE membership DROP CONSTRAINT IF EXISTS membership_type_check");
            log.info("membership_type_check 제약 제거 완료 (SEASON 타입 허용)");
        } catch (Exception e) {
            log.warn("membership_type_check 제약 제거 실패 (무시): {}", e.getMessage());
        }
    }
}
