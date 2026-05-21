package com.surfshop.controller;

import com.surfshop.dto.ApiResponse;
import com.surfshop.dto.ShopResponse;
import com.surfshop.repository.SurfShopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/shops")
@RequiredArgsConstructor
public class ShopController {

    private final SurfShopRepository surfShopRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ShopResponse>>> getAllShops() {
        List<ShopResponse> shops = surfShopRepository.findAll().stream()
                .map(ShopResponse::new)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success("서핑샵 목록 조회 성공", shops));
    }
}
