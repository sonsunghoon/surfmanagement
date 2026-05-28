package com.surfshop.service;

import com.surfshop.dto.ApiResponse;
import com.surfshop.dto.MembershipAssignRequest;
import com.surfshop.entity.Member;
import com.surfshop.entity.Membership;
import com.surfshop.repository.MemberRepository;
import com.surfshop.repository.MembershipRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class MembershipService {

    private final MemberRepository memberRepository;
    private final MembershipRepository membershipRepository;

    @Transactional
    public ApiResponse<?> assignMembership(Long memberId, MembershipAssignRequest req) {
        Member member = memberRepository.findById(memberId).orElse(null);
        if (member == null) return ApiResponse.error("존재하지 않는 회원입니다.");
        if (member.getStatus() != Member.MemberStatus.APPROVED) {
            return ApiResponse.error("승인된 회원에게만 회원권을 부여할 수 있습니다.");
        }

        List<Membership.MembershipType> lessonTypes = List.of(Membership.MembershipType.PERIOD, Membership.MembershipType.SESSION);

        // ── 기존 회원권 수정 (type == null) ──
        if (req.getType() == null) {
            Optional<Membership> existingOpt = membershipRepository
                    .findByMemberAndTypeInAndActiveTrueOrderByCreatedAtDesc(member, lessonTypes)
                    .stream().findFirst();
            if (existingOpt.isEmpty()) return ApiResponse.error("수정할 활성 수업 회원권이 없습니다.");
            Membership ms = existingOpt.get();

            if (ms.getType() == Membership.MembershipType.PERIOD) {
                if (req.getStartDate() != null) ms.setStartDate(req.getStartDate());
                if (req.getEndDate() != null) {
                    if (req.getEndDate().isBefore(ms.getStartDate())) {
                        return ApiResponse.error("종료일은 시작일보다 이후여야 합니다.");
                    }
                    ms.setEndDate(req.getEndDate());
                }
            } else if (ms.getType() == Membership.MembershipType.SESSION) {
                if (req.getSessionAdjustment() == null) return ApiResponse.error("조정 횟수를 입력해주세요.");
                int current = ms.getTotalSessions() != null ? ms.getTotalSessions() : 0;
                int newTotal = current + req.getSessionAdjustment();
                if (newTotal < ms.getUsedSessions()) {
                    return ApiResponse.error("사용한 횟수(" + ms.getUsedSessions() + "회)보다 적게 설정할 수 없습니다.");
                }
                if (newTotal <= 0) return ApiResponse.error("총 횟수는 1 이상이어야 합니다.");
                ms.setTotalSessions(newTotal);
            }
            membershipRepository.save(ms);
            return ApiResponse.success("회원권이 수정되었습니다.");
        }

        // ── 신규 발급 (같은 카테고리만 비활성화) ──
        if (req.getType() == Membership.MembershipType.SEASON) {
            membershipRepository.findTopByMemberAndTypeAndActiveTrueOrderByCreatedAtDesc(member, Membership.MembershipType.SEASON)
                    .ifPresent(m -> m.setActive(false));
        } else {
            membershipRepository.findByMemberAndTypeInAndActiveTrueOrderByCreatedAtDesc(member, lessonTypes)
                    .stream().findFirst().ifPresent(m -> m.setActive(false));
        }

        if (req.getType() == Membership.MembershipType.PERIOD) {
            if (req.getStartDate() == null || req.getEndDate() == null) {
                return ApiResponse.error("시작일과 종료일을 입력해주세요.");
            }
            if (!req.getEndDate().isAfter(req.getStartDate())) {
                return ApiResponse.error("종료일은 시작일보다 이후여야 합니다.");
            }
            membershipRepository.save(Membership.builder()
                    .member(member)
                    .type(Membership.MembershipType.PERIOD)
                    .startDate(req.getStartDate())
                    .endDate(req.getEndDate())
                    .build());
        } else if (req.getType() == Membership.MembershipType.SEASON) {
            if (req.getStartDate() == null) {
                return ApiResponse.error("시작일을 입력해주세요.");
            }
            membershipRepository.save(Membership.builder()
                    .member(member)
                    .type(Membership.MembershipType.SEASON)
                    .startDate(req.getStartDate())
                    .endDate(req.getStartDate().plusYears(1))
                    .periodMonths(12)
                    .build());
        } else {
            if (req.getTotalSessions() == null || req.getTotalSessions() <= 0) {
                return ApiResponse.error("횟수를 입력해주세요.");
            }
            if (req.getStartDate() == null) {
                return ApiResponse.error("시작일을 입력해주세요.");
            }
            membershipRepository.save(Membership.builder()
                    .member(member)
                    .type(Membership.MembershipType.SESSION)
                    .totalSessions(req.getTotalSessions())
                    .startDate(req.getStartDate())
                    .build());
        }
        return ApiResponse.success("회원권이 발급되었습니다.");
    }

    @Transactional(readOnly = true)
    public Optional<Membership> getActiveMembership(Long memberId) {
        List<Membership.MembershipType> lessonTypes = List.of(Membership.MembershipType.PERIOD, Membership.MembershipType.SESSION);
        return memberRepository.findById(memberId).flatMap(m ->
                membershipRepository.findByMemberAndTypeInAndActiveTrueOrderByCreatedAtDesc(m, lessonTypes)
                        .stream().findFirst());
    }

    @Transactional(readOnly = true)
    public Optional<Membership> getActiveSeasonMembership(Long memberId) {
        return memberRepository.findById(memberId).flatMap(m ->
                membershipRepository.findTopByMemberAndTypeAndActiveTrueOrderByCreatedAtDesc(m, Membership.MembershipType.SEASON));
    }
}
