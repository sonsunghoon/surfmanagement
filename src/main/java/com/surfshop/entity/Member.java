package com.surfshop.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "member")
@Getter @Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Member {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "shop_id", nullable = false)
    private SurfShop shop;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String phone;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BoardType boardType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SurfLevel surfLevel;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MemberStatus status = MemberStatus.PENDING;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime approvedAt;

    private String authToken;

    private LocalDateTime tokenExpiresAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public enum BoardType {
        SHORTBOARD("숏보드"),
        LONGBOARD("롱보드"),
        FUNBOARD("펀보드"),
        SUP("SUP"),
        BODYBOARD("바디보드");

        private final String label;
        BoardType(String label) { this.label = label; }
        public String getLabel() { return label; }
    }

    public enum SurfLevel {
        BEGINNER("입문자"),
        INTERMEDIATE("중급자"),
        ADVANCED("고급자"),
        EXPERT("전문가");

        private final String label;
        SurfLevel(String label) { this.label = label; }
        public String getLabel() { return label; }
    }

    public enum MemberStatus {
        PENDING("대기중"),
        APPROVED("승인"),
        REJECTED("반려");

        private final String label;
        MemberStatus(String label) { this.label = label; }
        public String getLabel() { return label; }
    }
}
