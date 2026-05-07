package com.surfshop.dto;

import com.surfshop.entity.Lesson;
import com.surfshop.entity.Member;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalTime;

@Getter @Setter
public class LessonCreateRequest {

    @NotBlank
    private String title;

    private String instructor;

    @NotNull
    private Lesson.LessonType lessonType;

    @NotNull
    private LocalDate date;

    @NotNull
    private LocalTime startTime;

    @NotNull
    private LocalTime endTime;

    @NotNull
    @Min(1)
    private Integer maxCapacity;

    private Member.SurfLevel targetLevel;

    private Member.BoardType targetBoardType;

    private String waveSize;

    private String wavePeriod;

    private String windInfo;
}
