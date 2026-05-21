package com.surfshop.service;

import com.surfshop.dto.ApiResponse;
import com.surfshop.dto.MemberLoginRequest;
import com.surfshop.dto.MemberLoginResponse;
import com.surfshop.dto.MemberRegistrationRequest;
import com.surfshop.entity.Member;
import com.surfshop.entity.Membership;
import com.surfshop.entity.SurfShop;
import com.surfshop.repository.MemberRepository;
import com.surfshop.repository.MembershipRepository;
import com.surfshop.repository.SurfShopRepository;
import com.surfshop.repository.ReservationRepository;
import com.surfshop.repository.WaitlistRepository;
import com.surfshop.repository.KeepingMembershipRepository;
import com.surfshop.repository.MemberNotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MemberService {

    private static final int TOKEN_EXPIRY_HOURS = 24;
    private static final String MSG_SHOP_NOT_FOUND = "존재하지 않는 서핑샵입니다.";
    private static final String MSG_DUPLICATE_PHONE = "해당 서핑샵에 이미 같은 전화번호로 신청된 회원이 있습니다.";
    private static final String MSG_DUPLICATE_EMAIL = "해당 서핑샵에 이미 같은 이메일로 신청된 회원이 있습니다.";
    private static final String MSG_REGISTER_SUCCESS = "회원 가입 신청이 완료되었습니다. 관리자의 승인 후 예약 서비스를 이용할 수 있습니다.";
    private static final String MSG_MEMBER_NOT_FOUND = "존재하지 않는 회원입니다.";
    private static final String MSG_LOGIN_FAIL = "이메일 또는 비밀번호가 올바르지 않습니다.";
    private static final String MSG_REJECTED = "승인이 거부된 회원입니다. 서핑샵에 문의해주세요.";
    private static final String MSG_PENDING = "관리자 승인 대기 중입니다.";

    private final MemberRepository memberRepository;
    private final MembershipRepository membershipRepository;
    private final SurfShopRepository surfShopRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final NotificationService notificationService;
    private final ReservationRepository reservationRepository;
    private final WaitlistRepository waitlistRepository;
    private final KeepingMembershipRepository keepingMembershipRepository;
    private final MemberNotificationRepository memberNotificationRepository;

    @Transactional
    public ApiResponse<?> register(MemberRegistrationRequest request) {
        SurfShop shop = surfShopRepository.findById(request.getShopId())
                .orElseThrow(() -> new IllegalArgumentException(MSG_SHOP_NOT_FOUND));

        if (memberRepository.existsByShopAndPhone(shop, request.getPhone())) {
            return ApiResponse.error(MSG_DUPLICATE_PHONE);
        }
        if (memberRepository.existsByShopAndEmail(shop, request.getEmail())) {
            return ApiResponse.error(MSG_DUPLICATE_EMAIL);
        }

        Member member = Member.builder()
                .shop(shop)
                .name(request.getName())
                .phone(request.getPhone())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .boardType(request.getBoardType())
                .surfLevel(request.getSurfLevel())
                .build();

        memberRepository.save(member);
        notificationService.createNewMember(shop, request.getName());
        return ApiResponse.success(MSG_REGISTER_SUCCESS);
    }

    @Transactional
    public ApiResponse<MemberLoginResponse> login(MemberLoginRequest request) {
        SurfShop shop = surfShopRepository.findById(request.getShopId()).orElse(null);
        if (shop == null) return ApiResponse.error(MSG_SHOP_NOT_FOUND);

        Member member = memberRepository.findByShopAndEmail(shop, request.getEmail()).orElse(null);
        if (member == null || !passwordEncoder.matches(request.getPassword(), member.getPassword())) {
            return ApiResponse.error(MSG_LOGIN_FAIL);
        }

        if (member.getStatus() == Member.MemberStatus.REJECTED) {
            return ApiResponse.error(MSG_REJECTED);
        }

        if (member.getStatus() == Member.MemberStatus.PENDING) {
            return ApiResponse.success(MSG_PENDING,
                    new MemberLoginResponse("PENDING", null, member.getId(),
                            member.getName(), shop.getId(), shop.getName()));
        }

        String token = UUID.randomUUID().toString();
        member.setAuthToken(token);
        member.setTokenExpiresAt(LocalDateTime.now().plusHours(TOKEN_EXPIRY_HOURS));

        return ApiResponse.success("로그인 성공",
                new MemberLoginResponse("APPROVED", token, member.getId(),
                        member.getName(), shop.getId(), shop.getName()));
    }

    @Transactional
    public void logout(String token) {
        memberRepository.findByAuthToken(token).ifPresent(m -> {
            m.setAuthToken(null);
            m.setTokenExpiresAt(null);
        });
    }

    @Transactional(readOnly = true)
    public Optional<Member> validateToken(String token) {
        return memberRepository.findByAuthToken(token)
                .filter(m -> m.getTokenExpiresAt() != null
                        && m.getTokenExpiresAt().isAfter(LocalDateTime.now()));
    }

    @Transactional
    public ApiResponse<?> approveMember(Long memberId) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException(MSG_MEMBER_NOT_FOUND));
        member.setStatus(Member.MemberStatus.APPROVED);
        member.setApprovedAt(LocalDateTime.now());
        return ApiResponse.success("회원이 승인되었습니다.");
    }

    @Transactional
    public ApiResponse<?> rejectMember(Long memberId) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException(MSG_MEMBER_NOT_FOUND));
        member.setStatus(Member.MemberStatus.REJECTED);
        return ApiResponse.success("회원 신청이 반려되었습니다.");
    }

    @Transactional(readOnly = true)
    public List<Member> getPendingMembers(SurfShop shop) {
        return memberRepository.findByShopAndStatusOrderByCreatedAtDesc(shop, Member.MemberStatus.PENDING);
    }

    @Transactional(readOnly = true)
    public List<Member> getMembersByStatus(SurfShop shop, Member.MemberStatus status) {
        return memberRepository.findByShopAndStatusOrderByCreatedAtDesc(shop, status);
    }

    @Transactional(readOnly = true)
    public List<Member> getAllMembers(SurfShop shop) {
        return memberRepository.findByShopOrderByCreatedAtDesc(shop);
    }

    @Transactional(readOnly = true)
    public Optional<Membership> getMembership(Member member) {
        return membershipRepository.findTopByMemberAndActiveTrueOrderByCreatedAtDesc(member);
    }

    @Transactional
    public void deleteMember(Member member) {
        memberNotificationRepository.deleteAllByMember(member);
        reservationRepository.deleteAllByMember(member);
        waitlistRepository.deleteAllByMember(member);
        membershipRepository.deleteAllByMember(member);
        keepingMembershipRepository.deleteAllByMember(member);
        memberRepository.delete(member);
    }
}
