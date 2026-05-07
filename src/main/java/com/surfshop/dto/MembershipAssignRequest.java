package com.surfshop.dto;

import com.surfshop.entity.Membership;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter @Setter
public class MembershipAssignRequest {

    // null이면 기존 회원권 수정, non-null이면 신규 발급
    private Membership.MembershipType type;

    // 공통
    private LocalDate startDate;

    // 기간권
    private LocalDate endDate;

    // 횟수권 신규 발급
    private Integer totalSessions;

    // 횟수권 조정 (+/-)
    private Integer sessionAdjustment;
}
