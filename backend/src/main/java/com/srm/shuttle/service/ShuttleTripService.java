package com.srm.shuttle.service;

import com.srm.shuttle.dto.TripRequest;
import com.srm.shuttle.model.ShuttleTrip;
import com.srm.shuttle.repository.BookingRepository;
import com.srm.shuttle.repository.ShuttleTripRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class ShuttleTripService {
    private final ShuttleTripRepository trips;
    private final BookingRepository bookings;

    public ShuttleTripService(ShuttleTripRepository trips, BookingRepository bookings) {
        this.trips = trips;
        this.bookings = bookings;
    }

    public List<ShuttleTrip> getAllTrips() {
        return trips.findAllByOrderByDepartureTimeAsc();
    }

    public ShuttleTrip getTrip(Long id) {
        return trips.findById(id).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found"));
    }

    public ShuttleTrip createTrip(TripRequest request) {
        validate(request);
        ShuttleTrip trip = new ShuttleTrip();
        copy(request, trip);
        trip.setAvailableSeats(request.totalSeats());
        return trips.save(trip);
    }

    @Transactional
    public ShuttleTrip updateTrip(Long id, TripRequest request) {
        validate(request);
        ShuttleTrip trip = getTrip(id);
        int bookedSeats = trip.getTotalSeats() - trip.getAvailableSeats();
        if (request.totalSeats() < bookedSeats) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Total seats cannot be lower than seats already booked");
        }
        copy(request, trip);
        trip.setAvailableSeats(request.totalSeats() - bookedSeats);
        return trips.save(trip);
    }

    @Transactional
    public void deleteTrip(Long id) {
        ShuttleTrip trip = getTrip(id);
        if (bookings.existsByTrip_Id(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "This trip has bookings. Keep the trip and manage its availability instead.");
        }
        trips.delete(trip);
    }

    private void validate(TripRequest request) {
        if (request == null || blank(request.routeName()) || blank(request.pickupPoint())
            || blank(request.dropPoint()) || blank(request.departureTime())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please fill in all trip details");
        }
        if (request.fare() < 0 || request.totalSeats() < 1 || request.totalSeats() > 200) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Fare must be non-negative and total seats must be between 1 and 200");
        }
    }

    private boolean blank(String value) { return value == null || value.isBlank(); }

    private void copy(TripRequest request, ShuttleTrip trip) {
        trip.setRouteName(request.routeName().trim());
        trip.setPickupPoint(request.pickupPoint().trim());
        trip.setDropPoint(request.dropPoint().trim());
        trip.setDepartureTime(request.departureTime().trim());
        trip.setFare(request.fare());
        trip.setTotalSeats(request.totalSeats());
    }
}
