package com.srm.shuttle.service;

import com.srm.shuttle.dto.BookingRequest;
import com.srm.shuttle.dto.BookingResponse;
import com.srm.shuttle.model.AppUser;
import com.srm.shuttle.model.Booking;
import com.srm.shuttle.model.ShuttleTrip;
import com.srm.shuttle.repository.AppUserRepository;
import com.srm.shuttle.repository.BookingRepository;
import com.srm.shuttle.repository.ShuttleTripRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class BookingService {
    private final BookingRepository bookings;
    private final ShuttleTripRepository trips;
    private final AppUserRepository users;

    public BookingService(BookingRepository bookings, ShuttleTripRepository trips, AppUserRepository users) {
        this.bookings = bookings;
        this.trips = trips;
        this.users = users;
    }

    @Transactional
    public BookingResponse create(String registrationNumber, BookingRequest request) {
        AppUser user = getUser(registrationNumber);
        if (request == null || request.tripId() == null || request.seats() < 1 || request.seats() > 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose between 1 and 6 seats");
        }
        ShuttleTrip trip = trips.findById(request.tripId()).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found"));
        if (trip.getAvailableSeats() < request.seats()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Not enough seats are available");
        }

        trip.setAvailableSeats(trip.getAvailableSeats() - request.seats());
        trips.save(trip);

        Booking booking = new Booking();
        booking.setBookingReference("SH-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT));
        booking.setUser(user);
        booking.setTrip(trip);
        booking.setSeats(request.seats());
        booking.setTotalFare(request.seats() * trip.getFare());
        booking.setStatus("CONFIRMED");
        booking.setBookedAt(LocalDateTime.now());
        return toResponse(bookings.save(booking));
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> mine(String registrationNumber) {
        AppUser user = getUser(registrationNumber);
        return bookings.findAllByUser_IdOrderByBookedAtDesc(user.getId()).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> all() {
        return bookings.findAllByOrderByBookedAtDesc().stream().map(this::toResponse).toList();
    }

    @Transactional
    public BookingResponse cancel(Long id, String registrationNumber, boolean admin) {
        AppUser user = getUser(registrationNumber);
        Booking booking = bookings.findById(id).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        if (!admin && !booking.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only cancel your own booking");
        }
        if ("CANCELLED".equals(booking.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This booking is already cancelled");
        }
        ShuttleTrip trip = booking.getTrip();
        trip.setAvailableSeats(Math.min(trip.getTotalSeats(), trip.getAvailableSeats() + booking.getSeats()));
        trips.save(trip);
        booking.setStatus("CANCELLED");
        return toResponse(bookings.save(booking));
    }

    private AppUser getUser(String registrationNumber) {
        return users.findByRegistrationNumberIgnoreCase(registrationNumber).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in again"));
    }

    private BookingResponse toResponse(Booking booking) {
        ShuttleTrip trip = booking.getTrip();
        AppUser user = booking.getUser();
        return new BookingResponse(booking.getId(), booking.getBookingReference(), trip.getId(),
            trip.getRouteName(), trip.getPickupPoint(), trip.getDropPoint(), trip.getDepartureTime(),
            booking.getSeats(), booking.getTotalFare(), booking.getStatus(), booking.getBookedAt(),
            user.getFullName(), user.getRegistrationNumber());
    }
}
