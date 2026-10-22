# SRM Shuttle — Full-Stack Campus Shuttle Booking System

> **Project + viva handbook** for the SRM Shuttle academic demonstrator.
>
> This README explains the purpose of the application, how to run it, where each feature is implemented, how data flows through the system, and the reasoning behind the main technologies and design choices. Use the implementation files as the source of truth: if a feature is changed later, update this README as well.

## Contents

1. [Project overview](#1-project-overview)
2. [Features and user roles](#2-features-and-user-roles)
3. [Technology stack](#3-technology-stack)
4. [Architecture and request flow](#4-architecture-and-request-flow)
5. [Project folder map](#5-project-folder-map)
6. [Database design](#6-database-design)
7. [Backend file-by-file guide](#7-backend-file-by-file-guide)
8. [Frontend file-by-file guide](#8-frontend-file-by-file-guide)
9. [REST API reference](#9-rest-api-reference)
10. [Important workflows](#10-important-workflows)
11. [How to run locally on Windows](#11-how-to-run-locally-on-windows)
12. [Configuration and secrets](#12-configuration-and-secrets)
13. [Testing and debugging](#13-testing-and-debugging)
14. [Viva preparation: questions and answers](#14-viva-preparation-questions-and-answers)
15. [Limitations and honest design trade-offs](#15-limitations-and-honest-design-trade-offs)
16. [Syllabus mapping](#16-syllabus-mapping)
17. [Short viva presentation script](#17-short-viva-presentation-script)

---

## 1. Project overview

**SRM Shuttle** is a full-stack campus shuttle browsing and booking application. Students can view shuttle routes and departure times, register and sign in, reserve seats, view their tickets, and cancel their own bookings. Administrators can create, edit, and delete shuttle trips and review reservations.

The interface is built with React. A Java/Spring Boot REST API handles authentication, authorization, business rules, and persistence. Spring Data JPA/Hibernate maps Java entities to tables in MySQL.

### Problem statement

Students need a convenient way to find campus shuttle information and make a reservation. Managing routes and bookings manually can be confusing, and a simple web application makes the schedule, remaining capacity, booking record, and administrator actions visible in one place.

### Project objective

Build a maintainable, beginner-explainable full-stack application that demonstrates:

- A responsive client-side UI using React components, state, hooks, events, and API calls.
- REST endpoints implemented in Spring Boot.
- Layer separation between controllers, services, repositories, and entity models.
- Persistent relational data using MySQL and Spring Data JPA.
- Authentication using hashed passwords and signed bearer tokens.
- Role-based access for `STUDENT` and `ADMIN`.
- Basic CRUD (Create, Read, Update, Delete) for shuttle trips.
- A multi-step business workflow: booking seats, calculating the fare, recording the booking, and restoring seats on cancellation.

### What the application is not

This is an academic demonstration, not an official SRM transport system. It does not verify a student's real SRM identity, collect payments, send email/SMS, track buses using GPS, or implement a production-grade concurrent seat-allocation system. The backend is one Spring Boot application using a three-layer structure; it is **not** a microservices architecture.

---

## 2. Features and user roles

### Guest / unauthenticated visitor

- View the overview dashboard.
- Browse listed shuttle trips.
- Search by route name, pickup point, or destination.
- View departure times and remaining seat count.
- Open the login or student-registration modal.
- A guest cannot create a booking or manage routes.

### Student (`STUDENT` role)

- Register using a name, registration number, and password.
- Sign in and receive an authentication token.
- Browse route and departure lists.
- Choose a trip and request between one and six seats per booking.
- See a booking reference, route details, seat count, total fare, and booking status.
- View their own bookings.
- Cancel their own booking, which returns seats to the trip's available capacity.
- Sign out, which removes the saved token/profile from browser `localStorage`.

Public registration always creates the `STUDENT` role. It does not accept a user-supplied role, so a registrant cannot register themselves as an administrator through the public registration endpoint.

### Administrator (`ADMIN` role)

- Sign in through the same sign-in modal as students.
- See the `Manage trips` navigation item after the backend returns the `ADMIN` role.
- Create a new shuttle trip.
- Edit an existing trip's name, pickup point, destination, time, fare, and seat capacity.
- Delete a trip only if it has no booking records attached to it.
- View all bookings and cancel a booking if required.

**Important:** The frontend hiding an admin navigation item is only a UI convenience. The backend's Spring Security rules are what protect admin API endpoints.

---

## 3. Technology stack

| Technology | Where used | Why it is used |
|---|---|---|
| HTML | React markup in `frontend/src/App.jsx` | Defines semantic page structure through JSX. |
| CSS | `frontend/src/App.css`, `frontend/src/index.css` | Controls layout, colours, spacing, typography, responsive behavior, and UI states. |
| JavaScript | Frontend state and event handlers | Handles user interactions, filtering, form values, request/response processing, and conditional rendering. |
| React | `frontend/src/App.jsx` | Splits the interface into reusable components and rerenders when state changes. |
| Vite | Frontend dev/build tool | Starts the local frontend server and creates the production build. |
| Java | Backend source files | Implements the application and business logic. |
| Spring Boot | Backend app | Starts and configures the Spring application and embedded web server. |
| Spring Web / Spring MVC | Controllers | Maps HTTP requests to Java methods and serializes responses as JSON. |
| Spring Security | `SecurityConfig`, token filter | Applies authentication/authorization rules to API routes. |
| Spring Data JPA | Repository interfaces | Provides common database operations without writing the same SQL manually. |
| Hibernate | JPA implementation | Maps entity objects to relational database tables. |
| MySQL | Database | Persists accounts, trips, and bookings across application restarts. |
| Maven / Maven Wrapper | `backend/pom.xml`, `mvnw.cmd` | Resolves Java dependencies, compiles source, runs tests, and starts the app. |
| JJWT | `TokenService` | Creates and verifies signed JSON Web Tokens. |
| BCrypt | `PasswordEncoder` bean | Stores password hashes rather than plain-text passwords. |

The supplied pack's `backend/pom.xml` declares Spring Boot `4.1.1` and Java release `27`. The generated wrapper files in the existing backend folder should be preserved. The frontend is the React/Vite project created with the Vite React template; keep `package-lock.json` so npm dependency resolution is repeatable.

---

## 4. Architecture and request flow

### High-level architecture

```text
┌───────────────────────────────────┐
│ Browser                           │
│ React UI + CSS                    │
│ App.jsx / api.js                  │
└────────────────┬──────────────────┘
                 │ HTTP + JSON
                 │ Authorization: Bearer <token> for protected requests
                 ▼
┌───────────────────────────────────┐
│ Spring Boot / Spring MVC           │
│ Controllers: URL and HTTP mapping  │
└────────────────┬──────────────────┘
                 ▼
┌───────────────────────────────────┐
│ Service layer                      │
│ Validation + booking/business rules│
└────────────────┬──────────────────┘
                 ▼
┌───────────────────────────────────┐
│ Spring Data JPA repositories       │
│ Hibernate ORM                      │
└────────────────┬──────────────────┘
                 │ SQL / JDBC
                 ▼
┌───────────────────────────────────┐
│ MySQL                              │
│ app_users / shuttle_trips /        │
│ shuttle_bookings                   │
└───────────────────────────────────┘
```

### The three main layers

1. **Presentation layer — React:** renders screens and collects user input. It requests data rather than connecting directly to MySQL.
2. **Business/application layer — Spring Boot services:** checks rules such as permitted seat counts, availability, ownership of a booking, and whether a trip may be deleted.
3. **Data-access layer — repositories/JPA:** reads and writes entity records in MySQL.

Controllers form the HTTP/API boundary. They receive requests, call services, and return results. Keeping business logic in services avoids duplicating rules in each controller.

### Example: how a booking request travels

1. A student selects a trip and a seat count in React.
2. `App.jsx` calls `api("/api/bookings", { method: "POST", body: { tripId, seats } })`.
3. `api.js` JSON-encodes the request body and adds `Authorization: Bearer ...` from `localStorage`.
4. Spring Security's `TokenAuthenticationFilter` checks the bearer token and establishes the authenticated registration number and role.
5. `BookingController.create()` obtains the authenticated principal and passes it to `BookingService.create()`.
6. `BookingService` checks the requested seat count and whether the trip has enough available seats.
7. It decreases `availableSeats`, creates a booking reference, calculates `totalFare`, sets status to `CONFIRMED`, and saves the booking.
8. JPA/Hibernate sends the required SQL to MySQL.
9. The controller serializes a `BookingResponse` as JSON.
10. React displays confirmation, reloads trips and bookings, and opens the bookings page.

### Why not have React connect directly to MySQL?

A browser should not have the database username/password or direct database privileges. Putting those credentials in frontend code would expose them to anyone who downloads the page. The backend is the controlled layer through which clients request permitted operations.

---

## 5. Project folder map

The ZIP is an **implementation overlay** for the existing repository; it supplies source/configuration files to copy into matching `backend/` and `frontend/` locations. It is not a replacement for the Maven Wrapper, Vite package files, or your complete project folder.

```text
shuttleBooking/
├── backend/
│   ├── pom.xml
│   └── src/main/
│       ├── java/com/srm/shuttle/
│       │   ├── ShuttleBackendApplication.java
│       │   ├── config/
│       │   ├── controller/
│       │   ├── dto/
│       │   ├── model/
│       │   ├── repository/
│       │   └── service/
│       └── resources/application.properties
│   ├── mvnw
│   ├── mvnw.cmd
│   └── .mvn/
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── App.css
    │   ├── index.css
    │   └── api.js
    ├── package.json
    ├── package-lock.json
    ├── vite.config.js
    └── index.html
```

The actual repository can contain other Vite starter files. Keep those files when they are needed by the project.

### Backend file map

| File | Responsibility | If the examiner asks… |
|---|---|---|
| `ShuttleBackendApplication.java` | Entry point; calls `SpringApplication.run(...)`. | “Where does the Spring Boot app start?” |
| `config/SecurityConfig.java` | Defines API access rules, stateless sessions, CORS, and BCrypt encoder. | “Where are protected routes configured?” |
| `config/TokenService.java` | Creates and validates signed JWTs. | “How is a token generated and checked?” |
| `config/TokenAuthenticationFilter.java` | Reads the bearer token on a request and sets Spring Security's authentication context. | “How does the backend know who sent a request?” |
| `config/DataInitializer.java` | Adds the initial admin account if one does not exist; adds a sample trip when there are no trips. | “Where is the initial admin/sample data created?” |
| `controller/AuthController.java` | Registration, login, and `/me` profile endpoint. | “Where are login and registration handled?” |
| `controller/ShuttleTripController.java` | Trip listing, details, create, update, delete endpoints. | “Where are trip REST APIs declared?” |
| `controller/BookingController.java` | Booking create, own/all booking listing, and cancellation endpoints. | “Where is booking HTTP handling done?” |
| `service/ShuttleTripService.java` | Trip validation and trip CRUD/business rules. | “Why have a service layer?” |
| `service/BookingService.java` | Booking, fare calculation, seat count updates, ownership check, cancellation. | “Where is the booking logic implemented?” |
| `model/AppUser.java` | JPA entity mapped to `app_users`. | “How are application users stored?” |
| `model/ShuttleTrip.java` | JPA entity mapped to `shuttle_trips`. | “How are routes/schedules stored?” |
| `model/Booking.java` | JPA entity mapped to `shuttle_bookings`; links user and trip. | “How does a booking relate to a user and trip?” |
| `repository/AppUserRepository.java` | User lookups by registration number. | “Where does Spring query users?” |
| `repository/ShuttleTripRepository.java` | Trip database operations and departure-time ordering. | “Where is trip persistence handled?” |
| `repository/BookingRepository.java` | Find bookings by user, all bookings, and whether a trip has any bookings. | “How are bookings retrieved?” |
| `dto/AuthDtos.java` | Request/response records for registration, login, and user profiles. | “Why not expose the entity directly?” |
| `dto/TripRequest.java` | Fields accepted when creating/updating a trip. | “What data does the add-trip API expect?” |
| `dto/BookingRequest.java` | Booking request: `tripId`, `seats`. | “What data does a booking POST contain?” |
| `dto/BookingResponse.java` | Booking/ticket details returned to the UI. | “How is the ticket response assembled?” |
| `application.properties` | Database, port, CORS, JWT, admin-password settings. | “How is configuration separated from Java code?” |
| `pom.xml` | Backend dependencies and Java/Spring Boot build configuration. | “Where are the backend dependencies declared?” |

### Frontend file map

| File | Responsibility | If the examiner asks… |
|---|---|---|
| `src/App.jsx` | Main UI, navigation state, data-loading, search, auth, booking and admin actions, modal/forms, reusable child components. | “Where is the main website behavior?” |
| `src/App.css` | Page-specific visual design: sidebar, hero panel, trip cards, tickets, modals, forms, responsive breakpoints. | “Where is the layout/styling implemented?” |
| `src/index.css` | Global font, base colors, box sizing, body defaults, base element styling. | “Where are global styles set?” |
| `src/api.js` | Single fetch wrapper, API base URL, JSON serialization, bearer token header, error handling. | “How does React call the backend?” |
| `package.json` | npm scripts and frontend dependency declarations. | “How do you start/build React?” |
| `package-lock.json` | Locks exact dependency resolution. | “Why commit the npm lock file?” |
| `vite.config.js` | Vite development/build configuration. | “What runs the frontend dev server?” |
| `index.html` | Browser entry HTML, into which Vite loads React. | “Where does the React app attach to the page?” |

---

## 6. Database design

JPA entities are annotated Java classes that Hibernate maps to relational tables. With the current development setting `spring.jpa.hibernate.ddl-auto=update`, Hibernate attempts to create/update the tables from the entity definitions during startup. The application does not provide a hand-written schema migration script in this pack.

### 6.1 `app_users` — `AppUser.java`

| Field/property | Purpose |
|---|---|
| `id` | Auto-generated primary key (`Long`). |
| `fullName` | Display name for the user. |
| `registrationNumber` | Login identifier; unique and non-null. |
| `passwordHash` | BCrypt-encoded password; not the original password. |
| `role` | Role string, currently `STUDENT` or `ADMIN`. |

`registrationNumber` has a unique constraint, preventing multiple user rows from using the same registration number. The Java login and repository methods compare registration numbers ignoring letter case; registration normalizes the value to uppercase first.

### 6.2 `shuttle_trips` — `ShuttleTrip.java`

| Field/property | Purpose |
|---|---|
| `id` | Auto-generated primary key. |
| `routeName` | Human-readable trip/route title. |
| `pickupPoint` | Boarding/pickup location. |
| `dropPoint` | Destination. |
| `departureTime` | Scheduled time stored as a string such as `08:30`. |
| `fare` | Fare per seat, stored as an integer in the selected currency unit (the UI displays ₹). |
| `totalSeats` | Total capacity for this trip. |
| `availableSeats` | Seats remaining and bookable. |

All properties are non-nullable at the database column level in the current entity mapping. The code does not have a calendar date field, bus/vehicle assignment, recurring schedule rule, or route stop table. It currently models a simplified trip with one pickup, one destination, and one time.

### 6.3 `shuttle_bookings` — `Booking.java`

| Field/property | Purpose |
|---|---|
| `id` | Auto-generated primary key. |
| `bookingReference` | Human-visible booking reference; unique. |
| `user` | Required `@ManyToOne` relationship to `AppUser` via `user_id`. |
| `trip` | Required `@ManyToOne` relationship to `ShuttleTrip` via `trip_id`. |
| `seats` | Number of seats reserved in this booking. |
| `totalFare` | Fare for all seats in that booking. |
| `status` | `CONFIRMED` or `CANCELLED` in current logic. |
| `bookedAt` | Date/time of booking, generated in Java with `LocalDateTime.now()`. |

### Relationships

- One user can have many bookings.
- One trip can have many bookings.
- Each booking belongs to exactly one user and exactly one trip in the current mapping.

This is represented by `@ManyToOne` plus `@JoinColumn` in `Booking.java`. The booking table stores the foreign keys, rather than duplicating the whole user and trip records.

### Example booking arithmetic

If the fare per seat is ₹250 and a student books 3 seats:

- `totalFare = 3 × 250 = ₹750`
- `availableSeats = previous availableSeats - 3`
- A booking row is inserted with `seats = 3`, `totalFare = 750`, and `status = CONFIRMED`.

When the booking is cancelled, the service adds the booking's seat count back to the trip's available seats and sets the status to `CANCELLED`; it does not delete the booking record. Keeping the row preserves a simple history.

---

## 7. Backend file-by-file guide

### 7.1 Entry point: `ShuttleBackendApplication.java`

The main class is annotated with `@SpringBootApplication` and runs `SpringApplication.run(ShuttleBackendApplication.class, args)`.

`@SpringBootApplication` combines Spring Boot configuration, auto-configuration, and component scanning. Since all `controller`, `service`, `repository`, `model`, and `config` packages are below `com.srm.shuttle`, component scanning can discover the application classes without manually registering each one.

### 7.2 Controllers: the API boundary

The three controllers use `@RestController`, meaning return values are normally serialized directly as response bodies (JSON for these objects/collections).

- `AuthController`: `/api/auth` paths.
- `ShuttleTripController`: `/api/trips` paths.
- `BookingController`: `/api/bookings` paths.

`@RequestMapping` sets a shared path prefix. `@GetMapping`, `@PostMapping`, `@PutMapping`, and `@DeleteMapping` map Java methods to HTTP operations. `@PathVariable` obtains a value from a path such as `/api/trips/4`. `@RequestBody` converts request JSON into a Java record/object. `Authentication` and `Principal` expose the current authenticated identity.

### 7.3 Services: business logic

`ShuttleTripService`:

- Lists trips ordered by `departureTime`.
- Returns a trip by ID or reports 404 if not found.
- Validates required text fields and ranges: fare cannot be negative; total seats must be 1–200.
- Initializes a new trip's `availableSeats` to `totalSeats`.
- When editing a trip, computes already-booked seats as `totalSeats - availableSeats` and refuses to reduce capacity below the number already booked.
- Prevents deletion if a booking row exists for the trip, avoiding a broken booking relationship.

`BookingService`:

- Limits each booking to 1–6 seats.
- Ensures the trip exists and has enough available seats.
- Subtracts seats and saves the updated trip.
- Creates a reference using a shortened UUID string prefixed with `SH-`.
- Calculates the total fare and timestamps the booking.
- Lists bookings belonging to the authenticated user or lists all bookings for admin use.
- Allows students to cancel only their own bookings; admins may cancel any booking.
- Rejects attempts to cancel an already cancelled booking.
- Uses `@Transactional` for booking and cancellation operations so the related database updates are grouped into a transaction.

### 7.4 Repositories: database access

The repository interfaces extend `JpaRepository<Entity, IDType>`. Spring Data JPA provides commonly needed methods such as `findAll`, `findById`, `save`, `delete`, and `count`, based on the generic entity and ID type.

Some methods are derived from their names. For example:

- `findByRegistrationNumberIgnoreCase(...)`
- `existsByRegistrationNumberIgnoreCase(...)`
- `findAllByOrderByDepartureTimeAsc()`
- `findAllByUser_IdOrderByBookedAtDesc(...)`

Spring Data interprets these method names and creates the required query logic. This avoids a handwritten SQL query for every basic operation.

### 7.5 DTOs (Data Transfer Objects)

The `dto` package defines records that represent HTTP request and response shapes. DTOs let the API accept or return only the fields needed for that operation instead of directly accepting every field of a database entity.

- `RegisterRequest`: full name, registration number, password.
- `LoginRequest`: registration number and password.
- `AuthResponse`: signed token and the user's basic profile/role.
- `UserResponse`: public profile fields for `/api/auth/me`.
- `TripRequest`: route name, pickup point, drop point, departure time, fare, total seats.
- `BookingRequest`: trip ID and number of seats.
- `BookingResponse`: ticket/booking summary with route, student, seat, fare, state, and timestamp.

### 7.6 Spring auto-configuration and dependency injection

The dependencies in `pom.xml` activate suitable auto-configuration. Spring Boot configures the web server/web stack from Spring Web, and JPA/database infrastructure from Spring Data JPA and the MySQL driver, based on `application.properties`.

Dependency injection means classes receive dependencies from Spring rather than constructing them manually. For example, `BookingService` receives the booking, trip, and user repositories through its constructor. This makes the class easier to test and separates business logic from object creation.

---

## 8. Frontend file-by-file guide

### 8.1 `App.jsx`: main UI and state

`App.jsx` contains the main application component and several small reusable presentational components.

#### State variables to know

| State | Meaning |
|---|---|
| `trips` | Current list received from `/api/trips`. |
| `bookings` | Current user's bookings, or all bookings for admin. |
| `user` | Client-side profile object loaded from `localStorage` and validated with `/api/auth/me`. |
| `page` | Current section: `overview`, `routes`, `departures`, `bookings`, or `admin`. This is simple state-based navigation, not React Router. |
| `search` | Search text used to filter route name, pickup point, and destination. |
| `loadingTrips`, `error`, `notice` | UI status and feedback. |
| `authOpen`, `authMode`, `authForm`, `authBusy` | Login/registration modal state and form. |
| `selectedTrip`, `seatCount` | Selected trip and number of seats in the booking modal. |
| `tripForm`, `editingTripId`, `tripBusy` | Admin form values and whether the form is adding or editing a trip. |

#### React hooks used

- `useState`: stores values that can change and trigger a UI rerender.
- `useEffect`: loads trips on mount, validates a saved token when the app reloads, and loads bookings after a user is known.
- `useCallback`: keeps the `loadTrips` / `loadBookings` functions stable for their effect dependencies.
- `useMemo`: derives the filtered trip list from current trips, search text, and page. Departures are sorted by departure time.

#### Key functions in `App.jsx`

| Function | Purpose |
|---|---|
| `loadTrips()` | Calls `GET /api/trips` and stores results in React state. |
| `loadBookings()` | Calls `/api/bookings` for admin or `/api/bookings/my` for a student. |
| `logout()` | Removes token/profile from localStorage and resets client state. |
| `submitAuth()` | Sends login/register data; saves the returned token/profile and selects the correct initial page. |
| `startBooking(trip)` | Requires a signed-in student, rejects admin booking and unavailable trips, then opens the booking modal. |
| `confirmBooking()` | Posts trip ID and seat count, displays the booking reference, refreshes trips/bookings. |
| `cancelBooking(booking)` | Asks for confirmation, sends cancellation request, then reloads trips/bookings. |
| `editTrip(trip)` | Copies current trip fields into the admin form. |
| `saveTrip()` | Posts a new trip or puts updates to an existing trip. |
| `deleteTrip(trip)` | Confirms then deletes a trip. |

#### Reusable UI components in `App.jsx`

- `NavButton`: sidebar item with selected styling.
- `StatCard`: one overview statistic.
- `SectionTitle`: consistent eyebrow/title/description heading.
- `RouteSearch`: controlled search input.
- `TripList`: loading, error, empty, and trip-card display states.
- `BookingCard`: ticket display and cancellation action.
- `EmptyState`: reusable empty-list message.

### 8.2 `api.js`: single API wrapper

This file centralizes frontend HTTP requests.

1. It reads `VITE_API_URL`; if unset, it uses `http://localhost:8080`.
2. It reads `srmShuttleToken` from browser `localStorage`.
3. It adds `Authorization: Bearer <token>` when a token exists.
4. It adds JSON content type when the request has a body and stringifies JavaScript objects as JSON.
5. It parses the response as JSON where possible.
6. If the HTTP response is not successful, it throws an error using the backend error detail/message when available.

Centralizing this behavior prevents every component from having to hand-write token headers and error parsing.

### 8.3 CSS files

- `App.css` is the large page-specific design system: sidebar, header, hero, stats, route cards, route line, admin forms, tickets, dialogs, buttons, and responsive breakpoints.
- `index.css` provides global font imports, base colors, box sizing, body defaults, and default styling for controls.

The UI uses plain CSS rather than a large component framework, so the styling can be explained in terms of selectors, CSS Grid/Flexbox, spacing, hover states, and media queries.

### 8.4 Why use `localStorage`?

The browser saves the token as `srmShuttleToken` and the basic profile as `srmShuttleUser`. `localStorage` persists values after a page reload or browser restart. On reload, React restores the cached profile but also calls `/api/auth/me` to validate the token with the backend. Signing out removes both values.

The token is a bearer credential: any party who obtains it may be able to act as that user until it expires. `localStorage` is easy for an academic demo but is exposed to JavaScript running on the page, so a more security-sensitive system might prefer secure, HttpOnly cookies and stronger XSS protections. This is a trade-off to explain honestly in the viva.

---

## 9. REST API reference

Base URL locally: `http://localhost:8080`

All successful responses are JSON unless noted. Protected endpoints require:

```http
Authorization: Bearer <JWT>
```

### Authentication endpoints

| Method | Endpoint | Access | Request/behavior |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | JSON `{ "fullName": "Student Name", "registrationNumber": "RA1234567890", "password": "at-least-8-chars" }`. Creates a `STUDENT`; duplicate/invalid registration number is rejected. |
| `POST` | `/api/auth/login` | Public | JSON `{ "registrationNumber": "RA1234567890", "password": "..." }`. Verifies the password hash and returns a token/profile. |
| `GET` | `/api/auth/me` | Authenticated | Returns the signed-in user's name, registration number, and role. |

### Trip endpoints

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/trips` | Public | List all trips, sorted by departure-time text. |
| `GET` | `/api/trips/{id}` | Public | Retrieve one trip; 404 if not found. |
| `POST` | `/api/trips` | Admin | Create a trip. |
| `PUT` | `/api/trips/{id}` | Admin | Update an existing trip. Seat capacity cannot be lowered below already-booked seats. |
| `DELETE` | `/api/trips/{id}` | Admin | Delete a trip if no booking records exist for it; otherwise returns a conflict error. |

`POST /api/trips` and `PUT /api/trips/{id}` accept a JSON object such as:

```json
{
  "routeName": "Campus to Chennai Airport",
  "pickupPoint": "SRM Main Gate",
  "dropPoint": "Chennai Airport",
  "departureTime": "08:30",
  "fare": 250,
  "totalSeats": 30
}
```

The client does not send `id` or `availableSeats` for trip create/update. The service assigns the ID via JPA and initializes/recalculates available seats on the server.

### Booking endpoints

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/bookings` | Student | Creates a booking for a trip and seat count. Request `{ "tripId": 1, "seats": 2 }`. |
| `GET` | `/api/bookings/my` | Student or Admin | Returns bookings linked to the authenticated user. |
| `GET` | `/api/bookings` | Admin | Returns all bookings. |
| `POST` | `/api/bookings/{id}/cancel` | Student or Admin | A student may cancel only their own booking; admin may cancel any booking. |

### Important HTTP concepts

- `GET` reads data and should not make a booking or mutate state.
- `POST` is used here to create a booking, login/register, and trigger cancellation.
- `PUT` updates an existing trip.
- `DELETE` removes a trip record when deletion is allowed.
- `200` indicates success; `400` input is invalid; `401` authentication is missing/invalid; `403` caller lacks permission or is not the owner; `404` record is not found; `409` a business rule prevents an operation (e.g. seats insufficient, duplicate registration, existing booking prevents trip deletion).

---

## 10. Important workflows

### 10.1 Registration and login

1. The student enters their name, registration number, and password.
2. `App.jsx` calls the matching endpoint through `api.js`.
3. `AuthController.register()` normalizes the registration number and validates required values, a minimum eight-character password, and a 4–30 character registration number containing letters/numbers/hyphens.
4. `PasswordEncoder.encode()` generates the stored password hash.
5. `AppUserRepository` persists the new user with the role `STUDENT`.
6. `TokenService.createToken()` signs a JWT with the registration number as subject and role as a claim.
7. The frontend saves token/profile in localStorage.
8. On reload, the frontend validates its saved token using `/api/auth/me`.

For login, the server looks up the account and compares the submitted password to the stored BCrypt hash with `passwordEncoder.matches(...)`. It does not decrypt/recover the original password because a secure password hash is not reversible.

### 10.2 Administrator initialization

`DataInitializer` runs during Spring startup. If no account with registration number `ADMIN` exists, it creates `SRM Shuttle Administrator`, registration number `ADMIN`, role `ADMIN`, and a BCrypt hash of the configured `app.admin.password`. If the `ADMIN` row already exists, the initializer does not update its password. Likewise, if any trip exists, it does not add the sample trip again.

The current `application.properties` contains development fallback values to make local setup easier. Those defaults are not safe production credentials; override them before deployment and do not treat the README's demo setup as a secure real-world identity system.

### 10.3 Add/edit/delete a trip

- Add: admin enters trip fields; frontend sends `POST /api/trips`; security checks `ROLE_ADMIN`; service validates fields, sets available seats equal to total seats, saves through `ShuttleTripRepository`.
- Edit: frontend sends `PUT /api/trips/{id}`; service calculates already-booked seats as `totalSeats - availableSeats`; rejects a new total below booked capacity; then recalculates availability.
- Delete: frontend sends `DELETE /api/trips/{id}`; service checks `BookingRepository.existsByTrip_Id(id)`; if any booking row exists, delete is refused so the referenced trip remains available for booking history.

### 10.4 Book seats

Suppose a trip has 10 available seats and the student requests 3 seats. The backend checks `1 <= seats <= 6`, checks the trip exists, and checks `availableSeats >= seats`. If valid, it updates availability from 10 to 7, makes a reference such as `SH-A1B2C3D4`, computes the total fare, and saves a confirmed booking.

These checks are done on the backend because frontend validation alone can be bypassed by a user making a direct HTTP request.

### 10.5 Cancel a booking

1. React asks the user to confirm.
2. It posts to `/api/bookings/{id}/cancel` with the token.
3. The service loads the booking and checks ownership if the caller is not an admin.
4. It rejects already-cancelled records.
5. It restores the booking's seats, capped at the trip's total capacity, then changes status to `CANCELLED`.
6. React reloads trips and bookings so the seat counter and ticket status change.

The record is retained for a simple audit/history rather than physically deleted.

---

## 11. How to run locally on Windows

### Prerequisites

- Java JDK compatible with the `java.version` in `backend/pom.xml` (the supplied pack specifies Java 27).
- Node.js and npm.
- MySQL Server running locally or a reachable MySQL instance.
- MySQL database named `srm_shuttle`.
- VS Code (or another editor) and PowerShell/Command Prompt.

### Step A: create/check the database

In MySQL Workbench, connect to your local MySQL 9.4 instance and run:

```sql
CREATE DATABASE IF NOT EXISTS srm_shuttle;
```

### Step B: set backend configuration

Edit `backend/src/main/resources/application.properties`. Ensure `spring.datasource.password` resolves to the password for your local MySQL account. For local use, set an environment variable in the backend terminal instead of storing the password in the file:

```powershell
$env:DB_PASSWORD = "YOUR_MYSQL_PASSWORD"
```

For an existing database, preserve its actual username/password. Do not paste real secrets into this README or GitHub.

### Step C: run Spring Boot

Open a terminal in the repository root, then:

```powershell
cd .\backend
.\mvnw.cmd spring-boot:run
```

Keep the terminal open. Successful startup includes a message similar to `Tomcat started on port 8080` and `Started ShuttleBackendApplication`.

Test the public trip API in a browser:

- `http://localhost:8080/api/trips`
- `http://localhost:8080/api/trips/1` (assuming trip ID 1 exists)

### Step D: run React/Vite

Open a second terminal:

```powershell
cd .\frontend
npm install
npm run dev
```

Vite normally prints `http://localhost:5173/`. Open that URL in your browser. The frontend calls `http://localhost:8080` by default.

### Step E: test the seeded administrator

The login ID is `ADMIN`. The password comes from `app.admin.password`, which in the supplied development configuration defaults to a demo value. The account is created only if it does not already exist. If an ADMIN account already existed, changing the environment variable will not reset its current password.

Before public hosting, configure a new strong `ADMIN_PASSWORD`, a fresh `JWT_SECRET`, real database environment variables, and the deployed frontend origin. Never ship a known development secret as a production secret.

### Useful commands

```powershell
# Confirm Java
java -version

# Frontend dependencies and local dev server
cd frontend
npm install
npm run dev

# Frontend production build check
npm run build

# Frontend lint (if the script exists in the generated package.json)
npm run lint

# Backend
cd ..\backend
.\mvnw.cmd spring-boot:run
```

The two servers need separate terminals. If port `8080` is already being used, stop the other process/application before starting Spring Boot.

---

## 12. Configuration and secrets

`backend/src/main/resources/application.properties` supports these settings:

| Property/environment variable | Purpose | Local/deployment note |
|---|---|---|
| `DB_URL` | JDBC URL, e.g. `jdbc:mysql://localhost:3306/srm_shuttle` | Hosted API cannot connect to MySQL running only on your laptop; use a hosted database for public deployment. |
| `DB_USERNAME` | MySQL account name | Prefer a dedicated least-privilege database account rather than root for deployment. |
| `DB_PASSWORD` | MySQL password | Keep out of Git and logs. |
| `PORT` | HTTP port for the backend | Defaults to 8080. Some hosts supply a port automatically. |
| `FRONTEND_URL` | Exact allowed web origin for CORS | Local default is `http://localhost:5173`; configure the deployed frontend origin on hosting. |
| `JWT_SECRET` | Base64 secret used to sign tokens | Generate a fresh random secret and keep it private. The source fallback is known and is local-development-only. |
| `JWT_EXPIRATION_HOURS` | Token lifetime | Defaults to 12 hours. |
| `ADMIN_PASSWORD` | Password used when the initial admin account is created | Changing it later does not change the existing account's password. |
| `VITE_API_URL` | Frontend API base URL | Defaults to `http://localhost:8080`; for production use the deployed API origin, no trailing slash. |

### Git hygiene

Do not commit:

- Real `application.properties` credentials or environment files containing secrets.
- `node_modules/`, `frontend/dist/`, or `backend/target/`.
- Local backup folders created during file replacement.
- SQL dumps or logs containing personal information/credentials.
- Tokens, production JWT secrets, or actual student registration data.

Commit `package-lock.json`, source files, `pom.xml`, Maven Wrapper files, `.gitignore`, README, and a safe `.env.example` with placeholders. A `.gitignore` does not remove secrets that were committed previously. If a secret was pushed, rotate it and clean Git history if necessary.

---

## 13. Testing and debugging

### Manual acceptance checklist

- [ ] `GET /api/trips` returns a JSON array.
- [ ] Guest can browse routes and departures but cannot book.
- [ ] Student registration creates a STUDENT account.
- [ ] A duplicate registration number is rejected.
- [ ] A student can sign in and survive a page reload while the token is valid.
- [ ] A student can book 1–6 seats when enough seats remain.
- [ ] Booking updates `availableSeats` in the trip table.
- [ ] Student can see their own booking under My bookings.
- [ ] Student cannot cancel another user's booking by guessing its ID.
- [ ] Student can cancel their own active booking only once.
- [ ] Cancellation restores seats and marks the booking CANCELLED.
- [ ] Student cannot call admin-only trip CRUD APIs.
- [ ] Admin can add and edit a trip.
- [ ] Admin cannot lower total capacity below the number of already-booked seats.
- [ ] Admin cannot delete a trip with booking records attached.
- [ ] Invalid booking or trip data is rejected by backend validation.

The pack includes Spring Boot's test dependency, but it does not currently include comprehensive project-specific automated test classes. The checklist above is a manual verification plan, not proof that every scenario has already been tested.

### Common problems

**Problem: `mysql` is not recognized.**

The MySQL command-line executable may not be on PATH. If MySQL Workbench connects and the `srm_shuttle` database exists, the backend can still connect. Use Workbench to test the database or add the MySQL `bin` folder to PATH if you need the CLI.

**Problem: `Access denied for user`.**

The MySQL username/password in `application.properties` or environment variables is incorrect, or that account lacks permission on the database.

**Problem: `Communications link failure`.**

Check that the MySQL service is running, the JDBC host/port are correct, and the database server accepts local connections.

**Problem: browser reports CORS error.**

Check `app.cors.allowed-origin` / `FRONTEND_URL`. It must match the exact frontend origin, including scheme and port, e.g. `http://localhost:5173` (not a path). Restart/redeploy the backend after changing it.

**Problem: React says the backend is unreachable.**

Try opening `http://localhost:8080/api/trips` directly. If it does not respond, start the backend and check the backend terminal. If it responds, check `VITE_API_URL` and CORS.

**Problem: login returns 401.**

The registration number/password is incorrect, the token is expired/invalid, or the saved token is no longer accepted. Sign out and sign in again. For the initial admin account, remember that changing `ADMIN_PASSWORD` won't update an existing database row.

**Problem: startup reports missing/invalid JWT key.**

`TokenService` Base64-decodes `app.jwt.secret` and uses it as an HMAC key. Set a valid Base64-encoded cryptographically random secret of at least 32 decoded bytes, and restart the backend.

**Problem: port 8080 is already in use.**

Stop the earlier backend or e-commerce demo, or set `PORT` to a different free port. If the backend port changes, update `VITE_API_URL` accordingly.

**Problem: new trips or tables do not appear.**

Confirm the backend is connected to the expected `srm_shuttle` database, check startup logs, and open the correct MySQL connection/schema in Workbench. `ddl-auto=update` uses entity discovery; the correct package scan and `@Entity` declarations are required.

---

## 14. Viva preparation: questions and answers

Use the following answers as starting points. In a viva, explain the idea in your own words and point to the file where it is implemented.

### A. Project and architecture

**Q1. What problem does SRM Shuttle solve?**

It provides one web interface to browse campus shuttle trips, reserve seats, see/cancel bookings, and let an admin maintain route details. It demonstrates an end-to-end flow from UI to API to a relational database.

**Q2. Why is this a full-stack project?**

It has a frontend built with React, a backend built with Java/Spring Boot, and a MySQL database. The frontend sends HTTP requests to the backend, and the backend persists data.

**Q3. Explain the three-layer architecture.**

React is the presentation layer; Spring service classes form the business layer; repositories/JPA form the data-access layer. Controllers are the HTTP boundary between the frontend and the services.

**Q4. Why not put all logic in controllers?**

That mixes HTTP details with business rules, makes methods harder to reuse/test, and creates duplication. Services provide one place for rules such as seat validation, cancellation ownership, and trip deletion restrictions.

**Q5. Is this microservices architecture?**

No. It is a layered monolithic Spring Boot backend plus a separate React frontend. Splitting the backend into separately deployed services would be a different architecture. The project can be extended later with a notification service if a microservices demonstration is required.

**Q6. What is the request flow for a button click?**

A React event handler calls `api.js`; `api.js` sends HTTP/JSON; Spring Security authenticates protected requests; a controller delegates to a service; repositories persist/read through JPA; the controller returns JSON; React updates state and rerenders.

### B. HTML, CSS, JavaScript and React

**Q7. What is HTML used for?**

HTML describes the structural content of a web document. In this project, JSX inside `App.jsx` expresses the page structure and React turns it into browser elements.

**Q8. What is CSS used for?**

CSS controls presentation: layout, colours, spacing, typography, borders, responsive behavior, and hover/active states. `App.css` has component/page design; `index.css` sets global defaults.

**Q9. What is the DOM?**

The Document Object Model represents a webpage as a tree of nodes. React updates the rendered UI when state changes instead of requiring the developer to manually modify every element.

**Q10. What is JSX?**

JSX is JavaScript syntax that looks like HTML and is transformed by the build tool into JavaScript calls for React elements. It allows the component's UI structure to live next to its logic.

**Q11. What is a React component?**

A component is a reusable UI unit. Examples here include `TripList`, `BookingCard`, `RouteSearch`, `StatCard`, and `NavButton`, as well as the top-level `App`.

**Q12. What does `useState` do?**

It stores component state. When its setter changes state, React rerenders the component so the UI reflects the new value. This is used for trips, the active page, form values, the user, seat count, notices, and loading/error states.

**Q13. What does `useEffect` do here?**

It runs side effects after render. The app uses it to fetch trips on startup, validate a saved token through `/api/auth/me`, and load bookings when the signed-in user changes.

**Q14. What does `useMemo` do here?**

It memoizes the derived filtered/sorted trip list until its dependencies change. This keeps the filtering logic declarative. For a tiny dataset, it is not strictly necessary, but it demonstrates a built-in React hook.

**Q15. Why is `key={trip.id}` used when mapping trips?**

React uses stable keys to associate rendered list items with their data across updates. A database ID is more stable than the array index.

**Q16. What is controlled input?**

An input whose value is tied to React state through `value` and `onChange`. The admin form, search field, and auth form use controlled values so React owns the current form data.

**Q17. What is `fetch` used for?**

It sends network requests from JavaScript. Here the wrapper in `api.js` calls the Spring Boot endpoints and receives JSON responses.

**Q18. What is the role of Vite?**

Vite is the frontend development server and build tool. It serves the application locally during development and bundles the code for production builds. It is not the backend API server.

**Q19. How does the search work?**

The search input updates `search` state. `useMemo` filters trips whose route name, pickup point, or destination contains the lowercase search query. Departures are then ordered by the departure-time string.

### C. Java and Spring Boot

**Q20. What is Spring Boot?**

Spring Boot builds on Spring and simplifies application setup with auto-configuration, starter dependencies, and embedded-server support.

**Q21. What does `@SpringBootApplication` do?**

It combines Spring Boot configuration, auto-configuration, and component scanning. It allows the application to discover controllers, services, repositories, configuration and entities in the relevant package structure.

**Q22. What is auto-configuration?**

Spring Boot configures suitable components based on dependencies and configuration. In this project, Spring Web activates web infrastructure, and Spring Data JPA plus the MySQL driver/configuration activates database access. Auto-configuration reduces manual wiring; it does not mean the business logic is generated automatically.

**Q23. What is an embedded Tomcat server?**

Tomcat is packaged/launched as part of the application, so the typical Spring Boot JAR can run without installing a separate Tomcat server manually. Locally the backend listens on port 8080 by default.

**Q24. What is dependency injection?**

A framework supplies an object with the dependencies it needs instead of the object constructing them itself. Constructor injection is used in services and controllers, improving separation and testability.

**Q25. What is `@RestController`?**

It marks a class as a web controller whose handler return values are written into the response body. Java objects and lists are serialized as JSON by Spring's HTTP message converters.

**Q26. Difference between GET, POST, PUT and DELETE?**

GET reads; POST submits/creates; PUT updates/replaces a resource; DELETE removes a resource. The route API uses these mappings for listing, creating, editing and deleting trips.

**Q27. What do `@PathVariable` and `@RequestBody` do?**

`@PathVariable` reads a value embedded in the URL, such as a trip ID. `@RequestBody` parses the HTTP request JSON into a Java object/record.

**Q28. What is the service layer's role?**

It implements rules that go beyond request mapping: validate trip fields, prevent capacity from being set below existing reservations, validate seat counts, calculate fares, enforce booking ownership during cancellation, and restore seats.

**Q29. What does `@Service` do?**

It marks the class as a Spring-managed service component, allowing Spring to discover it and inject it into other components.

**Q30. What does `@Transactional` do?**

It executes the method within a transaction boundary. For booking/cancellation, the related entity updates are intended to be committed or rolled back together if an exception occurs. It does not, by itself, solve all race conditions when many requests reserve the same last seat at once.

### D. JPA, Hibernate, repositories and SQL

**Q31. What is JPA?**

Jakarta Persistence (JPA) is a specification for mapping Java objects to relational database data. The project uses JPA annotations and Spring Data JPA interfaces.

**Q32. What is Hibernate?**

Hibernate is the ORM implementation used here. It maps entities to tables and translates persistence operations into SQL for MySQL.

**Q33. What is an ORM?**

Object-relational mapping connects application objects/classes with relational tables/rows. Here `ShuttleTrip` maps to `shuttle_trips`, `AppUser` to `app_users`, and `Booking` to `shuttle_bookings`.

**Q34. What does `@Entity` mean?**

It marks a class as a persistent JPA entity. Hibernate maps its fields/annotations into database columns.

**Q35. What do `@Id` and `@GeneratedValue` mean?**

`@Id` identifies a row's primary key. `@GeneratedValue(strategy = GenerationType.IDENTITY)` tells JPA to use the database's identity/auto-increment style to generate a key.

**Q36. What is `JpaRepository`?**

It gives common operations like `save`, `findAll`, `findById`, `delete`, and `count` for a given entity and ID type. Spring Data creates an implementation at runtime, so we don't manually write a class for every basic query.

**Q37. What are derived query methods?**

Spring Data interprets method names. `findByRegistrationNumberIgnoreCase` looks up a registration number without case sensitivity; `findAllByOrderByDepartureTimeAsc` sorts trips by departure-time field in ascending order.

**Q38. What is a foreign key relationship here?**

`Booking` has two `@ManyToOne` associations: `user` joins through `user_id` and `trip` through `trip_id`. These columns point to rows in `app_users` and `shuttle_trips`.

**Q39. What does `ddl-auto=update` do?**

Hibernate attempts to update the schema to match discovered entity definitions. It is convenient for a local learning project, but a production system should prefer reviewed, versioned database migrations such as Flyway or Liquibase.

**Q40. Difference between primary key and unique constraint?**

A primary key uniquely identifies each row and cannot be null. A unique constraint prevents duplicate values in a column or column combination. The user `id` is the primary key; registration numbers and booking references are also unique.

### E. Security and authentication

**Q41. What happens when a student registers?**

`AuthController.register` validates fields, normalizes the registration number, checks duplicates, hashes the password with BCrypt, and saves an account with role `STUDENT`. Then it issues a JWT and returns a safe user profile.

**Q42. Why hash passwords?**

Passwords should not be stored as plain text. BCrypt is a password hashing function designed to make offline guessing more expensive and uses a salt as part of the hash format. The app uses `PasswordEncoder.matches` to verify a password without decrypting a stored password.

**Q43. What is JWT?**

A JSON Web Token is a signed token that can carry claims. Here the subject contains the registration number, the role is a claim, and an expiration timestamp limits how long the token is valid. The server verifies the signature before trusting claims.

**Q44. Is a JWT encrypted?**

Not necessarily. A typical signed JWT is encoded and signed, not encrypted, so its payload should not contain secrets. The signature helps detect tampering; HTTPS is still important in deployment.

**Q45. Why use stateless authentication?**

The backend doesn't rely on a server-side HTTP session for each logged-in user. Each protected request supplies a signed bearer token, which the filter validates. This is a common approach for REST APIs.

**Q46. What does `TokenAuthenticationFilter` do?**

It checks the `Authorization` header for `Bearer ...`, asks `TokenService` to validate/parse it, creates a Spring `Authentication` with a registration number and `ROLE_...` authority, and puts it in the security context for the current request.

**Q47. What is the difference between authentication and authorization?**

Authentication answers “who are you?”; authorization answers “what are you allowed to do?” Login/token validation authenticates the caller. Rules such as `hasRole("ADMIN")` authorize access to trip-management APIs.

**Q48. Why can't a student make themselves admin in registration?**

The registration controller constructs the account with the literal role `STUDENT`, rather than accepting a role from the request. The admin account is initialized through `DataInitializer`; security rules protect admin-only endpoints.

**Q49. What is CORS?**

Cross-Origin Resource Sharing is a browser security mechanism controlling which origins can read responses from a server. The frontend dev origin (`http://localhost:5173`) and API (`http://localhost:8080`) have different ports and therefore different origins; the backend configuration explicitly allows the configured frontend origin.

**Q50. Why is `localStorage` a security trade-off?**

It persists the token over reloads and is easy to implement, but JavaScript on the origin can read it. A script-injection/XSS issue can expose it. An HttpOnly secure cookie can reduce direct JavaScript access, although cookie-based auth has its own CSRF/configuration requirements.

### F. Business logic and edge cases

**Q51. How is the total fare calculated?**

`BookingService.create` uses `request.seats() * trip.getFare()`. The backend calculates this itself; it does not trust a total supplied by the browser.

**Q52. Why validate capacity on the backend if the UI already prevents selecting too many seats?**

Client-side restrictions can be bypassed by direct HTTP requests or browser tools. Backend checks are authoritative and protect data integrity.

**Q53. Why can a trip with bookings not be deleted?**

The application wants to preserve booking history and avoid a booking referencing a deleted trip. `BookingRepository.existsByTrip_Id` detects the relationship and `ShuttleTripService.deleteTrip` refuses deletion with a conflict response.

**Q54. How does cancellation restore capacity?**

It adds the booking's `seats` back to `availableSeats`, capped at `totalSeats`, and changes status to `CANCELLED`. The record remains so the user/admin can see the history.

**Q55. What if a student tries to cancel another student's booking?**

`BookingService.cancel` compares the booking owner's ID with the authenticated user's ID. If the caller isn't an admin and doesn't own the booking, it returns a forbidden response.

**Q56. What happens if not enough seats remain?**

The service compares the requested seats with `trip.getAvailableSeats()` and returns HTTP 409 Conflict if capacity is insufficient.

**Q57. Does the app prevent two students from taking the very last seat at exactly the same time?**

Not robustly under high concurrency. The method is transactional, but this implementation does not add an explicit pessimistic lock, optimistic version field, or atomic conditional SQL update to coordinate simultaneous reservations. That would be a production improvement.

### G. Build, configuration and operation

**Q58. What is Maven?**

Maven manages Java dependencies and build lifecycle steps such as compile, test, and package. The dependencies are described in `backend/pom.xml`.

**Q59. What is Maven Wrapper?**

The wrapper scripts (`mvnw`, `mvnw.cmd`, and `.mvn/`) let the project run a configured Maven distribution without requiring a separate global Maven installation.

**Q60. Why use environment variables for secrets?**

Environment variables let the environment supply passwords/secrets without committing those values into source code. A deployed backend must have the matching variables configured in the hosting service.

**Q61. What is the purpose of `VITE_API_URL`?**

It allows the frontend to point at different API base URLs in local and production environments. Vite exposes variables prefixed with `VITE_` to frontend code, so these values must never be secrets.

**Q62. What would you improve if given more time?**

Add automated service/controller tests, database migrations, proper password reset and rate limiting, stronger registration verification, concurrency-safe seat allocation, dated schedules, pagination, audit logs, and monitoring. A separate notification service could be used if the assignment requires a microservices demonstration.

---

## 15. Limitations and honest design trade-offs

Knowing the limitations often earns more trust in a viva than claiming that a student demo is production-ready.

1. **No date per trip:** `departureTime` is a string, not a dated departure timestamp. “Upcoming departures” lists and sorts stored times; it does not calculate the next calendar departure.
2. **Simplified trip model:** one pickup and one destination; no stop list, vehicle/driver assignment, route geometry, or live location tracking.
3. **No payment:** the UI explicitly states that it does not collect payment.
4. **No SRM identity verification:** a registration number is collected but is not verified against an official student database.
5. **Development secrets:** the supplied `application.properties` contains fallbacks for a demo JWT secret and admin password. Replace those before any public deployment and keep credentials outside Git.
6. **Existing admin password does not auto-reset:** `DataInitializer` creates `ADMIN` only when absent. Editing the configuration later does not overwrite the database hash.
7. **Concurrent booking race risk:** transaction boundaries alone are not sufficient to guarantee last-seat safety under simultaneous requests. Add database locking/atomic reservation logic for a real system.
8. **Local storage token:** token persists in browser storage; an XSS weakness could expose it. This is an implementation simplicity trade-off.
9. **No broad automated test suite yet:** the project has the test dependency, but comprehensive feature-specific tests still need to be written and run.
10. **JPA schema auto-update:** convenient for a demonstration, not a substitute for controlled production schema migrations.
11. **Single backend service:** no independent backend microservices are implemented. The React app and API are separate parts, but that alone does not mean the backend uses microservices.
12. **No email/SMS notifications:** booking confirmation is displayed in the UI, not sent externally.

---

## 16. Syllabus mapping

The course handout for Full Stack Web Development (21CSE354T) includes HTML/CSS, JavaScript and DOM fundamentals, React and hooks, SQL, JDBC/database connectivity, Spring Boot and testing, three-layer application architecture, Spring Data JPA, and microservices. The current app demonstrates several of these directly and leaves others as future work.

| Syllabus area | Where this project demonstrates it | Notes for viva |
|---|---|---|
| HTML document structure/images/links | JSX page markup in `frontend/src/App.jsx`, root `frontend/index.html` | JSX is compiled by the React toolchain; `index.html` is Vite's entry page. |
| CSS and responsive layout | `frontend/src/App.css`, `frontend/src/index.css` | Explain Grid/Flexbox, selectors, spacing, hover states, and media queries. |
| JavaScript, arrays, conditions, event handlers, DOM/UI updates | `App.jsx` state handlers; `api.js` request wrapper | React handles UI updates from state rather than requiring direct DOM edits for most changes. |
| React components, JSX, events, forms, hooks | `App.jsx` (`useState`, `useEffect`, `useCallback`, `useMemo`) | Explain state-driven UI and effect-based data loading. |
| API integration | `frontend/src/api.js` and calls inside `App.jsx` | JSON requests and responses connect React and Spring Boot. |
| SQL / relational modelling | MySQL tables inferred from `AppUser`, `ShuttleTrip`, `Booking` entities | Verify generated schema in Workbench. No extensive hand-written SQL/query report is included. |
| JDBC/database connectivity | `application.properties`, MySQL Connector/J dependency in `pom.xml`, JPA/Hibernate | Spring Boot/JPA use JDBC underneath; application code mostly calls repositories rather than raw JDBC APIs. |
| Spring Boot REST application | `controller/*`, `ShuttleBackendApplication.java` | Explain REST mappings, JSON, port 8080 and auto-configuration. |
| Testing basics | `spring-boot-starter-test` dependency in `pom.xml` | Feature-specific automated tests are a recommended next step; do not claim they exist if none were added. |
| Three-tier/MVC-oriented structure | controller/service/repository/model packages | Demonstrate separation of request handling, business rules, and persistence. |
| Spring Data JPA entities/repositories/CRUD | `model/*`, `repository/*`, `service/ShuttleTripService.java` | Explain `@Entity`, `@Id`, repository-derived methods and `save/findAll/findById/delete`. |
| Microservices | Not implemented in the current backend | Be transparent. Optional extension: split notifications or another bounded feature into a separately deployed service communicating via REST. |

**Viva caution:** JDBC is used indirectly through MySQL Connector/J under Hibernate/JPA. The present application does not demonstrate explicit raw JDBC code using `DriverManager`, `Connection`, `PreparedStatement`, and `ResultSet`. If your examiner specifically asks for a JDBC practical, explain that distinction rather than claiming this code manually uses those classes.

---

## 17. Short viva presentation script

> SRM Shuttle is a full-stack campus shuttle booking demonstrator. The frontend is built with React and CSS, and it communicates with a Java Spring Boot REST API using HTTP and JSON. The backend is divided into controllers, services, repositories, and JPA entity models. MySQL persists users, shuttle trips, and bookings. Spring Security protects APIs using a signed bearer token, and passwords are hashed with BCrypt. A student can register, sign in, browse routes, book seats, see a ticket, and cancel a booking. An admin can create, update, and delete eligible trips and review reservations. The main business rule is that bookings must respect available seat capacity and cancellation restores seats. It is a layered monolith rather than a microservices system; production improvements would include concurrency-safe seat allocation, migration-managed schema, stronger credential handling, and automated tests.

### A 60-second code-navigation demo

When asked to show how one feature works, use this sequence:

1. **Frontend event:** `frontend/src/App.jsx` — point to `confirmBooking()` or `saveTrip()`.
2. **API wrapper:** `frontend/src/api.js` — show JSON serialization and bearer token header.
3. **Controller:** `backend/src/main/java/com/srm/shuttle/controller/BookingController.java` or `ShuttleTripController.java`.
4. **Service:** show `BookingService.create()` or `ShuttleTripService.createTrip()` for actual rules.
5. **Repository:** show `BookingRepository` or `ShuttleTripRepository`.
6. **Entity/database mapping:** show `Booking.java` or `ShuttleTrip.java` and explain the corresponding table.
7. **Security:** for protected actions, show `SecurityConfig.java` and `TokenAuthenticationFilter.java`.

A good explanation follows data from the UI to storage and back. Don't merely list file names—explain why each layer exists and what data crosses its boundary.

---

## Final study advice

Be ready to explain these five flows without reading the code:

1. **Login:** submitted credentials → password hash comparison → JWT → localStorage → bearer token on later requests.
2. **Load trips:** React effect → `api.js` → public `GET /api/trips` → service/repository → MySQL → JSON → route cards.
3. **Add trip:** admin form → `POST /api/trips` → `ROLE_ADMIN` security rule → validation in `ShuttleTripService` → JPA save → refreshed list.
4. **Book seats:** student token → `POST /api/bookings` → capacity check → seat decrement + booking insert in transaction → booking reference and total fare.
5. **Cancel booking:** ownership/admin check → reject duplicate cancellation → restore seats → mark record cancelled → refreshed UI.

For every feature, remember three things: **where it is triggered in React, where the business rule is enforced in Java, and where the final record is stored in MySQL.**
