package com.srm.shuttle.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "shuttle_bookings", uniqueConstraints = @UniqueConstraint(name = "uk_booking_reference", columnNames = "booking_reference"))
public class Booking {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "booking_reference", nullable = false, unique = true)
    private String bookingReference;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trip_id", nullable = false)
    private ShuttleTrip trip;

    @Column(nullable = false)
    private int seats;

    @Column(nullable = false)
    private int totalFare;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(nullable = false)
    private LocalDateTime bookedAt;

    public Booking() {}
    public Long getId() { return id; }
    public String getBookingReference() { return bookingReference; }
    public void setBookingReference(String bookingReference) { this.bookingReference = bookingReference; }
    public AppUser getUser() { return user; }
    public void setUser(AppUser user) { this.user = user; }
    public ShuttleTrip getTrip() { return trip; }
    public void setTrip(ShuttleTrip trip) { this.trip = trip; }
    public int getSeats() { return seats; }
    public void setSeats(int seats) { this.seats = seats; }
    public int getTotalFare() { return totalFare; }
    public void setTotalFare(int totalFare) { this.totalFare = totalFare; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getBookedAt() { return bookedAt; }
    public void setBookedAt(LocalDateTime bookedAt) { this.bookedAt = bookedAt; }
}
