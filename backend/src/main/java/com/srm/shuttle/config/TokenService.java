package com.srm.shuttle.config;

import com.srm.shuttle.model.AppUser;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.util.Date;

@Service
public class TokenService {
    private final SecretKey key;
    private final long expirationHours;

    public TokenService(
        @Value("${app.jwt.secret}") String secret,
        @Value("${app.jwt.expiration-hours:12}") long expirationHours
    ) {
        this.key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
        this.expirationHours = expirationHours;
    }

    public String createToken(AppUser user) {
        Instant now = Instant.now();
        return Jwts.builder()
            .subject(user.getRegistrationNumber())
            .claim("role", user.getRole())
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(expirationHours * 3600)))
            .signWith(key)
            .compact();
    }

    public TokenDetails parse(String token) throws JwtException {
        Claims claims = Jwts.parser().verifyWith(key).build()
            .parseSignedClaims(token).getPayload();
        return new TokenDetails(claims.getSubject(), claims.get("role", String.class));
    }

    public record TokenDetails(String registrationNumber, String role) {}
}
