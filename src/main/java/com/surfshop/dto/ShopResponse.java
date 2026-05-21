package com.surfshop.dto;

import com.surfshop.entity.SurfShop;
import lombok.Getter;

@Getter
public class ShopResponse {
    private final Long id;
    private final String name;
    private final String location;
    private final String description;

    public ShopResponse(SurfShop shop) {
        this.id = shop.getId();
        this.name = shop.getName();
        this.location = shop.getLocation();
        this.description = shop.getDescription();
    }
}
