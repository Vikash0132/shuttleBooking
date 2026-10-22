package com.srm.shuttle.config;

import com.srm.shuttle.model.AppUser;
import com.srm.shuttle.model.ShuttleTrip;
import com.srm.shuttle.repository.AppUserRepository;
import com.srm.shuttle.repository.ShuttleTripRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataInitializer {
    @Bean
    CommandLineRunner seedDatabase(AppUserRepository users, ShuttleTripRepository trips,
                                   PasswordEncoder encoder,
                                   @Value("${app.admin.password}") String adminPassword) {
        return args -> {
            if (!users.existsByRegistrationNumberIgnoreCase("ADMIN")) {
                users.save(new AppUser("SRM Shuttle Administrator", "ADMIN",
                    encoder.encode(adminPassword), "ADMIN"));
                System.out.println("SRM Shuttle admin account initialized (login ID: ADMIN). Set ADMIN_PASSWORD before deployment.");
            }
            if (trips.count() == 0) {
                ShuttleTrip trip = new ShuttleTrip();
                trip.setRouteName("Campus to Chennai Airport");
                trip.setPickupPoint("SRM Main Gate");
                trip.setDropPoint("Chennai Airport");
                trip.setDepartureTime("08:30");
                trip.setFare(250);
                trip.setTotalSeats(30);
                trip.setAvailableSeats(30);
                trips.save(trip);
            }
        };
    }
}
