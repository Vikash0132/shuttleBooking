package com.srm.shuttle.dto;

import java.time.LocalDateTime;

public record BookingResponse(
    Long id,
    String bookingReference,
    Long tripId,
    String routeName,
    String pickupPoint,
    String dropPoint,
    String departureTime,
    int seats,
    int totalFare,
    String status,
    LocalDateTime bookedAt,
    String studentName,
    String registrationNumber
) {}
