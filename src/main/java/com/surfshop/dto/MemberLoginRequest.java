package com.surfshop.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class MemberLoginRequest {

    @NotNull
    private Long shopId;

    @NotBlank
    @Email
    private String email;

    @NotBlank
    private String password;
}
