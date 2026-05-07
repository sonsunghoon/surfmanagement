package com.surfshop.dto;

import com.surfshop.entity.Member;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter @Setter
@NoArgsConstructor
public class MemberRegistrationRequest {

    @NotNull(message = "서핑샵을 선택해주세요.")
    private Long shopId;

    @NotBlank(message = "이름을 입력해주세요.")
    private String name;

    @NotBlank(message = "전화번호를 입력해주세요.")
    @Pattern(regexp = "^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$", message = "올바른 전화번호를 입력해주세요.")
    private String phone;

    @NotBlank(message = "이메일을 입력해주세요.")
    @Email(message = "올바른 이메일을 입력해주세요.")
    private String email;

    @NotBlank(message = "비밀번호를 입력해주세요.")
    @Size(min = 8, message = "비밀번호는 8자 이상이어야 합니다.")
    private String password;

    @NotNull(message = "보드 종류를 선택해주세요.")
    private Member.BoardType boardType;

    @NotNull(message = "서핑 레벨을 선택해주세요.")
    private Member.SurfLevel surfLevel;
}
