package com.surfshop.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "lesson")
@Getter @Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Lesson {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shop_id", nullable = false)
    private SurfShop shop;

    @Column(nullable = false)
    private String title;

    private String instructor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LessonType lessonType;

    @Column(nullable = false)
    private LocalDateTime startTime;

    @Column(nullable = false)
    private LocalDateTime endTime;

    @Column(nullable = false)
    private int maxCapacity;

    @Builder.Default
    @Column(nullable = false)
    private int currentReservations = 0;

    @Enumerated(EnumType.STRING)
    private Member.SurfLevel targetLevel;

    @Enumerated(EnumType.STRING)
    private Member.BoardType targetBoardType;

    private String waveSize;

    private String wavePeriod;

    private String windInfo;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public enum LessonType {
        GROUP("그룹"),
        PRIVATE("1:1");

        private final String label;
        LessonType(String label) { this.label = label; }
        public String getLabel() { return label; }
    }
}
