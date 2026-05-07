package com.surfshop.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class AdminLoginResponse {
    private String token;
    private String shopName;
    private Long shopId;
    private String adminEmail;
}
