package com.srm.shuttle.repository;

import com.srm.shuttle.model.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface BookingRepository extends JpaRepository<Booking, Long> {
    List<Booking> findAllByUser_IdOrderByBookedAtDesc(Long userId);
    List<Booking> findAllByOrderByBookedAtDesc();
    boolean existsByTrip_Id(Long tripId);
}
