package com.surfshop.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class MemberLoginResponse {
    private String statusCode;
    private String token;
    private Long memberId;
    private String memberName;
    private Long shopId;
    private String shopName;
}
