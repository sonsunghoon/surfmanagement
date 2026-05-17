package com.surfshop.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "notification")
@Getter @Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shop_id", nullable = false)
    private SurfShop shop;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NotificationType type;

    @Column(nullable = false)
    private String memberName;

    private String lessonTitle;
    private String lessonDate;

    @Column(nullable = false)
    private String message;

    @Builder.Default
    @Column(name = "is_read")
    private boolean read = false;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public enum NotificationType {
        RESERVATION("예약"),
        CANCELLATION("예약취소"),
        NEW_MEMBER("신규회원"),
        WAITLIST_PROMOTED("대기→예약");

        private final String label;
        NotificationType(String label) { this.label = label; }
        public String getLabel() { return label; }
    }
}
