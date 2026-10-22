package com.srm.shuttle.controller;

import com.srm.shuttle.config.TokenService;
import com.srm.shuttle.dto.AuthDtos.AuthResponse;
import com.srm.shuttle.dto.AuthDtos.LoginRequest;
import com.srm.shuttle.dto.AuthDtos.RegisterRequest;
import com.srm.shuttle.dto.AuthDtos.UserResponse;
import com.srm.shuttle.model.AppUser;
import com.srm.shuttle.repository.AppUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.Locale;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AppUserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;

    public AuthController(AppUserRepository users, PasswordEncoder passwordEncoder, TokenService tokenService) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
    }

    @PostMapping("/register")
    public AuthResponse register(@RequestBody RegisterRequest request) {
        if (request == null || blank(request.fullName()) || blank(request.registrationNumber())
            || request.password() == null || request.password().length() < 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Enter your name, registration number and a password of at least 8 characters");
        }
        String reg = request.registrationNumber().trim().toUpperCase(Locale.ROOT);
        if (!reg.matches("[A-Z0-9-]{4,30}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Registration number must be 4–30 letters, numbers or hyphens");
        }
        if (reg.equals("ADMIN") || users.existsByRegistrationNumberIgnoreCase(reg)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "That registration number is already registered");
        }
        AppUser user = users.save(new AppUser(request.fullName().trim(), reg,
            passwordEncoder.encode(request.password()), "STUDENT"));
        return new AuthResponse(tokenService.createToken(user), user.getFullName(), user.getRegistrationNumber(), user.getRole());
    }

    @PostMapping("/login")
    public AuthResponse login(@RequestBody LoginRequest request) {
        if (request == null || blank(request.registrationNumber()) || request.password() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter your registration number and password");
        }
        String reg = request.registrationNumber().trim().toUpperCase(Locale.ROOT);
        AppUser user = users.findByRegistrationNumberIgnoreCase(reg).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Incorrect registration number or password"));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Incorrect registration number or password");
        }
        return new AuthResponse(tokenService.createToken(user), user.getFullName(), user.getRegistrationNumber(), user.getRole());
    }

    @GetMapping("/me")
    public UserResponse me(Principal principal) {
        AppUser user = users.findByRegistrationNumberIgnoreCase(principal.getName()).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
        return new UserResponse(user.getFullName(), user.getRegistrationNumber(), user.getRole());
    }

    private boolean blank(String value) { return value == null || value.isBlank(); }
}
