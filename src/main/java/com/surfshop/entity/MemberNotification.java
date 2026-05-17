package com.surfshop.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "member_notification")
@Getter @Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MemberNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MemberNotificationType type;

    @Column(nullable = false)
    private String message;

    private String lessonTitle;
    private String lessonDate;

    @Builder.Default
    @Column(name = "is_read")
    private boolean read = false;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public enum MemberNotificationType {
        WAITLIST_PROMOTED("대기→예약"),
        ADMIN_MESSAGE("관리자 메시지");

        private final String label;
        MemberNotificationType(String label) { this.label = label; }
        public String getLabel() { return label; }
    }
}
