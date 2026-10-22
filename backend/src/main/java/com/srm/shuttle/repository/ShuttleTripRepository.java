package com.srm.shuttle.repository;

import com.srm.shuttle.model.ShuttleTrip;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ShuttleTripRepository extends JpaRepository<ShuttleTrip, Long> {
    List<ShuttleTrip> findAllByOrderByDepartureTimeAsc();
}
