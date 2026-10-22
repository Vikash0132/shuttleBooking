package com.srm.shuttle.dto;

public record TripRequest(
    String routeName,
    String pickupPoint,
    String dropPoint,
    String departureTime,
    int fare,
    int totalSeats
) {}
