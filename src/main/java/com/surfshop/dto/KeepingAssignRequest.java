package com.surfshop.dto;

import lombok.Getter;
import java.time.LocalDate;

@Getter
public class KeepingAssignRequest {
    private LocalDate startDate;
    private LocalDate endDate;
    private String boardBrand;
    private String boardImageUrl;
}
