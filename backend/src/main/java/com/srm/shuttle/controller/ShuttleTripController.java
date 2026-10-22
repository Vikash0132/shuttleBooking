package com.srm.shuttle.controller;

import com.srm.shuttle.dto.TripRequest;
import com.srm.shuttle.model.ShuttleTrip;
import com.srm.shuttle.service.ShuttleTripService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/trips")
public class ShuttleTripController {
    private final ShuttleTripService service;

    public ShuttleTripController(ShuttleTripService service) {
        this.service = service;
    }

    @GetMapping
    public List<ShuttleTrip> getAllTrips() {
        return service.getAllTrips();
    }

    @GetMapping("/{id}")
    public ShuttleTrip getTrip(@PathVariable Long id) {
        return service.getTrip(id);
    }

    @PostMapping
    public ShuttleTrip addTrip(@RequestBody TripRequest request) {
        return service.createTrip(request);
    }

    @PutMapping("/{id}")
    public ShuttleTrip updateTrip(@PathVariable Long id, @RequestBody TripRequest request) {
        return service.updateTrip(id, request);
    }

    @DeleteMapping("/{id}")
    public void deleteTrip(@PathVariable Long id) {
        service.deleteTrip(id);
    }
}
