package com.surfshop.controller;

import com.surfshop.dto.ApiResponse;
import com.surfshop.entity.SurfShop;
import com.surfshop.repository.SurfShopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/shops")
@RequiredArgsConstructor
public class ShopController {

    private final SurfShopRepository surfShopRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<SurfShop>>> getAllShops() {
        return ResponseEntity.ok(ApiResponse.success("서핑샵 목록 조회 성공", surfShopRepository.findAll()));
    }
}
