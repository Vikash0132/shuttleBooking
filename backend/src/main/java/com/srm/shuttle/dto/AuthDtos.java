package com.srm.shuttle.dto;

public final class AuthDtos {
    private AuthDtos() {}
    public record RegisterRequest(String fullName, String registrationNumber, String password) {}
    public record LoginRequest(String registrationNumber, String password) {}
    public record AuthResponse(String token, String fullName, String registrationNumber, String role) {}
    public record UserResponse(String fullName, String registrationNumber, String role) {}
}
