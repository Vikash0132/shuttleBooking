package com.srm.shuttle.controller;

import com.srm.shuttle.dto.BookingRequest;
import com.srm.shuttle.dto.BookingResponse;
import com.srm.shuttle.service.BookingService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/bookings")
public class BookingController {
    private final BookingService service;

    public BookingController(BookingService service) {
        this.service = service;
    }

    @PostMapping
    public BookingResponse create(@RequestBody BookingRequest request, Authentication authentication) {
        return service.create(authentication.getName(), request);
    }

    @GetMapping("/my")
    public List<BookingResponse> mine(Authentication authentication) {
        return service.mine(authentication.getName());
    }

    @GetMapping
    public List<BookingResponse> all() {
        return service.all();
    }

    @PostMapping("/{id}/cancel")
    public BookingResponse cancel(@PathVariable Long id, Authentication authentication) {
        boolean admin = authentication.getAuthorities().stream()
            .anyMatch(authority -> authority.getAuthority().equals("ROLE_ADMIN"));
        return service.cancel(id, authentication.getName(), admin);
    }
}
