import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import "./App.css";

const emptyTrip = {
  routeName: "", pickupPoint: "SRM Main Gate", dropPoint: "",
  departureTime: "08:30", fare: 100, totalSeats: 30,
};

function Icon({ children, className = "" }) {
  return <span className={`icon ${className}`} aria-hidden="true">{children}</span>;
}

function App() {
  const [trips, setTrips] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("srmShuttleUser") || "null"); }
    catch { return null; }
  });
  const [page, setPage] = useState("overview");
  const [search, setSearch] = useState("");
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ fullName: "", registrationNumber: "", password: "" });
  const [authBusy, setAuthBusy] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [seatCount, setSeatCount] = useState(1);
  const [tripForm, setTripForm] = useState(emptyTrip);
  const [editingTripId, setEditingTripId] = useState(null);
  const [tripBusy, setTripBusy] = useState(false);

  const isAdmin = user?.role === "ADMIN";
  const isStudent = user?.role === "STUDENT";

  const loadTrips = useCallback(async () => {
    setLoadingTrips(true);
    try {
      const data = await api("/api/trips");
      setTrips(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to connect to the shuttle server.");
    } finally {
      setLoadingTrips(false);
    }
  }, []);

  const loadBookings = useCallback(async (currentUser = user) => {
    if (!currentUser) { setBookings([]); return; }
    try {
      const data = await api(currentUser.role === "ADMIN" ? "/api/bookings" : "/api/bookings/my");
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err.message?.includes("401") || err.message?.toLowerCase().includes("unauthorized")) logout();
      setBookings([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.registrationNumber, user?.role]);

  useEffect(() => { loadTrips(); }, [loadTrips]);

  useEffect(() => {
    const token = localStorage.getItem("srmShuttleToken");
    if (!token) return;
    api("/api/auth/me")
      .then((profile) => {
        setUser(profile);
        localStorage.setItem("srmShuttleUser", JSON.stringify(profile));
      })
      .catch(() => logout());
  // run once to validate a saved token on reload
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (user) loadBookings(user); }, [user, loadBookings]);

  const filteredTrips = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matching = trips.filter((trip) =>
      [trip.routeName, trip.pickupPoint, trip.dropPoint].some((v) => (v || "").toLowerCase().includes(q))
    );
    return page === "departures"
      ? [...matching].sort((a, b) => (a.departureTime || "").localeCompare(b.departureTime || ""))
      : matching;
  }, [trips, search, page]);

  function logout() {
    localStorage.removeItem("srmShuttleToken");
    localStorage.removeItem("srmShuttleUser");
    setUser(null);
    setBookings([]);
    setPage("overview");
    setNotice("You have been signed out.");
  }

  async function submitAuth(event) {
    event.preventDefault();
    setAuthBusy(true);
    setNotice("");
    try {
      const path = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload = authMode === "login"
        ? { registrationNumber: authForm.registrationNumber, password: authForm.password }
        : authForm;
      const result = await api(path, { method: "POST", body: payload });
      localStorage.setItem("srmShuttleToken", result.token);
      const profile = { fullName: result.fullName, registrationNumber: result.registrationNumber, role: result.role };
      localStorage.setItem("srmShuttleUser", JSON.stringify(profile));
      setUser(profile);
      setAuthOpen(false);
      setAuthForm({ fullName: "", registrationNumber: "", password: "" });
      setNotice(authMode === "login" ? `Welcome back, ${profile.fullName}.` : "Account created successfully. Welcome to SRM Shuttle!");
      setPage(profile.role === "ADMIN" ? "admin" : "overview");
      await loadBookings(profile);
    } catch (err) {
      setNotice(err.message || "Unable to sign in. Please try again.");
    } finally {
      setAuthBusy(false);
    }
  }

  function startBooking(trip) {
    if (!user) {
      setAuthMode("login");
      setAuthOpen(true);
      setNotice("Sign in with your student account to book a shuttle.");
      return;
    }
    if (isAdmin) {
      setNotice("Admin accounts manage routes. Sign in as a student to make a booking.");
      return;
    }
    if (trip.availableSeats < 1) {
      setNotice("This shuttle is fully booked.");
      return;
    }
    setSeatCount(1);
    setSelectedTrip(trip);
  }

  async function confirmBooking() {
    try {
      const booking = await api("/api/bookings", {
        method: "POST", body: { tripId: selectedTrip.id, seats: seatCount },
      });
      setSelectedTrip(null);
      setNotice(`Booking confirmed — reference ${booking.bookingReference}.`);
      await Promise.all([loadTrips(), loadBookings(user)]);
      setPage("bookings");
    } catch (err) {
      setNotice(err.message || "Unable to complete booking.");
      await loadTrips();
    }
  }

  async function cancelBooking(booking) {
    if (!window.confirm(`Cancel booking ${booking.bookingReference}?`)) return;
    try {
      await api(`/api/bookings/${booking.id}/cancel`, { method: "POST" });
      setNotice(`Booking ${booking.bookingReference} cancelled. Seats have been released.`);
      await Promise.all([loadTrips(), loadBookings(user)]);
    } catch (err) {
      setNotice(err.message || "Unable to cancel this booking.");
    }
  }

  function editTrip(trip) {
    setEditingTripId(trip.id);
    setTripForm({
      routeName: trip.routeName, pickupPoint: trip.pickupPoint,
      dropPoint: trip.dropPoint, departureTime: trip.departureTime,
      fare: trip.fare, totalSeats: trip.totalSeats,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveTrip(event) {
    event.preventDefault();
    setTripBusy(true);
    try {
      const body = { ...tripForm, fare: Number(tripForm.fare), totalSeats: Number(tripForm.totalSeats) };
      if (editingTripId) {
        await api(`/api/trips/${editingTripId}`, { method: "PUT", body });
        setNotice("Shuttle route updated successfully.");
      } else {
        await api("/api/trips", { method: "POST", body });
        setNotice("New shuttle route added successfully.");
      }
      setTripForm(emptyTrip);
      setEditingTripId(null);
      await loadTrips();
    } catch (err) {
      setNotice(err.message || "Unable to save the route.");
    } finally {
      setTripBusy(false);
    }
  }

  async function deleteTrip(trip) {
    if (!window.confirm(`Delete route “${trip.routeName}”?`)) return;
    try {
      await api(`/api/trips/${trip.id}`, { method: "DELETE" });
      setNotice("Route deleted.");
      await loadTrips();
    } catch (err) {
      setNotice(err.message || "Unable to delete this route.");
    }
  }

  const pageTitle = {
    overview: "Shuttle dashboard", routes: "Shuttle routes",
    departures: "Upcoming departures", bookings: "My bookings", admin: "Admin workspace",
  }[page] || "Shuttle dashboard";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setPage("overview")} aria-label="SRM Shuttle home">
          <span className="brand-icon">S</span>
          <span>SRM <b>SHUTTLE</b></span>
        </button>
        <p className="menu-label">WORKSPACE</p>
        <nav className="sidebar-nav">
          <NavButton active={page === "overview"} onClick={() => setPage("overview")} icon="▦">Overview</NavButton>
          <NavButton active={page === "routes"} onClick={() => setPage("routes")} icon="↗">Shuttle routes</NavButton>
          <NavButton active={page === "departures"} onClick={() => setPage("departures")} icon="◷">Departures</NavButton>
          {user && <NavButton active={page === "bookings"} onClick={() => setPage("bookings")} icon="▤">{isAdmin ? "All bookings" : "My bookings"}</NavButton>}
          {isAdmin && <NavButton active={page === "admin"} onClick={() => setPage("admin")} icon="⚙">Manage trips</NavButton>}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><span className="help-icon">i</span><strong>Need assistance?</strong><p>Campus transport, made simpler.</p></div>
          <div className="profile-row">
            <span className="avatar">{user ? user.fullName?.slice(0, 1).toUpperCase() : "SR"}</span>
            <div className="profile-copy"><strong>{user?.fullName || "Guest visitor"}</strong><p>{user ? (isAdmin ? "Administrator" : user.registrationNumber) : "Explore campus routes"}</p></div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">CAMPUS MOBILITY</p><h2>{pageTitle}</h2></div>
          <div className="topbar-actions">
            <span className="service-pill"><span className="live-dot"/> Transport portal</span>
            {user ? <button className="outline-button small" onClick={logout}>Sign out</button> : <button className="primary-button small" onClick={() => { setAuthMode("login"); setAuthOpen(true); }}>Sign in</button>}
          </div>
        </header>

        {notice && <div className="notice-banner" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss message">×</button></div>}

        {page === "overview" && <>
          <section className="hero-panel">
            <div className="hero-copy"><p className="hero-kicker">YOUR CAMPUS. YOUR JOURNEY.</p><h1>Every journey<br/>starts here.</h1><p className="hero-description">Find your route, explore departures and plan your next journey from campus.</p><button className="hero-button" onClick={() => setPage("routes")}>Explore shuttles <span>↗</span></button></div>
            <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-circle"><span>SRM</span><div className="bus"><div className="bus-windows"><i/><i/><i/></div><div className="bus-body"/><div className="bus-wheel wheel-one"/><div className="bus-wheel wheel-two"/></div></div><span className="floating-tag">YOUR RIDE, SORTED.</span></div>
          </section>
          <section className="stats-grid">
            <StatCard icon="↗" tone="blue" label="Listed routes" value={trips.length}/>
            <StatCard icon="✓" tone="green" label="Available seats" value={trips.reduce((sum, trip) => sum + Number(trip.availableSeats || 0), 0)}/>
            <StatCard icon="₹" tone="purple" label="Starting fare" value={trips.length ? `₹${Math.min(...trips.map((trip) => Number(trip.fare)))}` : "—"}/>
          </section>
          <section className="section-block" id="routes"><SectionTitle eyebrow="FIND YOUR RIDE" title="Available shuttles" description="Trips available for your next campus journey." action={<button className="text-button" onClick={() => setPage("routes")}>View all routes →</button>}/><RouteSearch value={search} onChange={setSearch}/><TripList trips={filteredTrips.slice(0, 3)} loading={loadingTrips} error={error} onBook={startBooking} user={user}/></section>
          <section className="cta-strip"><div><span className="cta-mark">S</span><div><strong>Ready for your next journey?</strong><p>Keep your campus commute in one place.</p></div></div><button className="primary-button" onClick={() => user ? setPage("routes") : (setAuthMode("register"), setAuthOpen(true))}>{user ? "Browse shuttles" : "Create student account"} <span>→</span></button></section>
        </>}

        {page === "routes" && <section className="section-block page-section"><SectionTitle eyebrow="ROUTE DIRECTORY" title="Shuttle routes" description="Browse routes and check available capacity."/><RouteSearch value={search} onChange={setSearch}/><TripList trips={filteredTrips} loading={loadingTrips} error={error} onBook={startBooking} user={user}/></section>}

        {page === "departures" && <section className="section-block page-section"><SectionTitle eyebrow="PLAN YOUR DEPARTURE" title="Upcoming departures" description="Browse trips by departure time. Times follow the published schedule."/><RouteSearch value={search} onChange={setSearch}/><div className="departure-note"><span className="departure-note-icon">◷</span><span><strong>Check your boarding point</strong><p>Arrive at the pickup point a few minutes before departure.</p></span></div><TripList trips={filteredTrips} loading={loadingTrips} error={error} onBook={startBooking} user={user} showTime/></section>}

        {page === "bookings" && <section className="section-block page-section"><SectionTitle eyebrow="TRIP HISTORY" title={isAdmin ? "All bookings" : "My bookings"} description={isAdmin ? "Review reservations made by students." : "Review your tickets and manage confirmed bookings."}/>{!user ? <EmptyState title="Sign in to see your bookings" text="Your shuttle tickets will be listed here." action={<button className="primary-button" onClick={() => setAuthOpen(true)}>Sign in</button>}/> : bookings.length === 0 ? <EmptyState title="No bookings yet" text="Your confirmed shuttle reservations will appear here." action={<button className="primary-button" onClick={() => setPage("routes")}>Explore routes</button>}/> : <div className="booking-list">{bookings.map((booking) => <BookingCard key={booking.id} booking={booking} admin={isAdmin} onCancel={cancelBooking}/>)}</div>}</section>}

        {page === "admin" && isAdmin && <section className="section-block page-section"><SectionTitle eyebrow="ADMINISTRATION" title="Manage trips" description="Create, update and remove shuttle trips. Changes are saved in MySQL."/><div className="admin-layout"><form className="panel trip-form" onSubmit={saveTrip}><div className="panel-heading"><div><p className="eyebrow">ROUTE SETUP</p><h3>{editingTripId ? "Edit shuttle" : "Add a shuttle"}</h3></div>{editingTripId && <button type="button" className="text-button" onClick={() => { setEditingTripId(null); setTripForm(emptyTrip); }}>Cancel edit</button>}</div><label>Route name<input required value={tripForm.routeName} onChange={(e) => setTripForm({...tripForm, routeName: e.target.value})} placeholder="e.g. Campus to Chennai Airport"/></label><div className="form-two-col"><label>Pickup point<input required value={tripForm.pickupPoint} onChange={(e) => setTripForm({...tripForm, pickupPoint: e.target.value})} placeholder="SRM Main Gate"/></label><label>Destination<input required value={tripForm.dropPoint} onChange={(e) => setTripForm({...tripForm, dropPoint: e.target.value})} placeholder="Chennai Airport"/></label></div><div className="form-two-col"><label>Departure time<input required type="time" value={tripForm.departureTime} onChange={(e) => setTripForm({...tripForm, departureTime: e.target.value})}/></label><label>One-way fare (₹)<input required type="number" min="0" value={tripForm.fare} onChange={(e) => setTripForm({...tripForm, fare: e.target.value})}/></label></div><label>Total seats<input required type="number" min="1" max="200" value={tripForm.totalSeats} onChange={(e) => setTripForm({...tripForm, totalSeats: e.target.value})}/></label><button className="primary-button full-width" disabled={tripBusy}>{tripBusy ? "Saving…" : editingTripId ? "Save changes" : "Add shuttle route"}</button></form><div className="panel admin-trips"><div className="panel-heading"><div><p className="eyebrow">LIVE DATABASE</p><h3>Current routes <span className="count-chip">{trips.length}</span></h3></div></div>{trips.map((trip) => <div className="admin-trip-row" key={trip.id}><div className="mini-route-icon">↗</div><div className="admin-trip-copy"><strong>{trip.routeName}</strong><p>{trip.departureTime} · {trip.availableSeats}/{trip.totalSeats} seats · ₹{trip.fare}</p></div><button className="icon-button" aria-label={`Edit ${trip.routeName}`} onClick={() => editTrip(trip)}>✎</button><button className="icon-button danger" aria-label={`Delete ${trip.routeName}`} onClick={() => deleteTrip(trip)}>×</button></div>)}</div></div></section>}

        <footer className="footer"><span>SRM SHUTTLE</span><span>Campus mobility, made simpler.</span><span>React · Spring Boot · MySQL</span></footer>
      </main>

      {authOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false); }}><section className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="Close">×</button><div className="modal-brand brand-icon">S</div><p className="eyebrow">SRM CAMPUS MOBILITY</p><h2 id="auth-title">{authMode === "login" ? "Welcome back" : "Create your student account"}</h2><p className="modal-subtitle">{authMode === "login" ? "Sign in to manage your shuttle journeys." : "Register with your college registration number to book a shuttle."}</p><form className="auth-form" onSubmit={submitAuth}>{authMode === "register" && <label>Full name<input autoComplete="name" required value={authForm.fullName} onChange={(e) => setAuthForm({...authForm, fullName: e.target.value})} placeholder="Your full name"/></label>}<label>Registration number<input autoComplete="username" required value={authForm.registrationNumber} onChange={(e) => setAuthForm({...authForm, registrationNumber: e.target.value})} placeholder={authMode === "login" ? "College registration number" : "e.g. RA1234567890"}/></label><label>Password<input autoComplete={authMode === "login" ? "current-password" : "new-password"} type="password" required minLength={8} value={authForm.password} onChange={(e) => setAuthForm({...authForm, password: e.target.value})} placeholder="At least 8 characters"/></label>{authMode === "login" && <p className="admin-hint">Administrator access is configured by the project owner. Use the administrator credentials supplied by your team.</p>}<button className="primary-button full-width" disabled={authBusy}>{authBusy ? "Please wait…" : authMode === "login" ? "Sign in" : "Create account"}</button></form><p className="auth-switch">{authMode === "login" ? "New to SRM Shuttle?" : "Already have an account?"} <button onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setNotice(""); }}>{authMode === "login" ? "Create account" : "Sign in"}</button></p></section></div>}

      {selectedTrip && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTrip(null); }}><section className="modal booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title"><button className="modal-close" onClick={() => setSelectedTrip(null)} aria-label="Close">×</button><p className="eyebrow">RESERVE YOUR SEAT</p><h2 id="booking-title">{selectedTrip.routeName}</h2><div className="booking-route-line"><span>{selectedTrip.pickupPoint}</span><span className="line-dash"/><span>{selectedTrip.dropPoint}</span></div><div className="booking-facts"><div><small>DEPARTURE</small><strong>{selectedTrip.departureTime}</strong></div><div><small>FARE / SEAT</small><strong>₹{selectedTrip.fare}</strong></div><div><small>SEATS LEFT</small><strong>{selectedTrip.availableSeats}</strong></div></div><div className="seat-stepper"><div><strong>Seats to book</strong><p>Choose up to 6 seats per booking.</p></div><div className="stepper-controls"><button onClick={() => setSeatCount((count) => Math.max(1, count - 1))} disabled={seatCount <= 1}>−</button><strong>{seatCount}</strong><button onClick={() => setSeatCount((count) => Math.min(6, selectedTrip.availableSeats, count + 1))} disabled={seatCount >= 6 || seatCount >= selectedTrip.availableSeats}>+</button></div></div><div className="total-line"><span>Total payable</span><strong>₹{seatCount * selectedTrip.fare}</strong></div><button className="primary-button full-width" onClick={confirmBooking}>Confirm booking <span>→</span></button><p className="fine-print">Demo project: no payment is collected.</p></section></div>}
    </div>
  );
}

function NavButton({ active, onClick, icon, children }) {
  return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}><span className="nav-icon">{icon}</span>{children}</button>;
}

function StatCard({ icon, tone, label, value }) {
  return <div className="stat-card"><span className={`stat-icon ${tone}`}>{icon}</span><div><p>{label}</p><h3>{value}</h3></div></div>;
}

function SectionTitle({ eyebrow, title, description, action }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p className="section-description">{description}</p></div>{action}</div>;
}

function RouteSearch({ value, onChange }) {
  return <div className="search-box"><Icon>⌕</Icon><input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search by route, pickup or destination…" aria-label="Search shuttle routes"/>{value && <button className="clear-search" onClick={() => onChange("")}>Clear</button>}</div>;
}

function TripList({ trips, loading, error, onBook, user, showTime = false }) {
  if (loading) return <div className="empty-state"><span className="spinner"/><h3>Loading shuttle routes</h3><p>Connecting to the campus transport system…</p></div>;
  if (error) return <div className="empty-state"><h3>Couldn't load routes</h3><p>{error}</p><p>Check that the Spring Boot backend is running on port 8080.</p></div>;
  if (!trips.length) return <EmptyState title="No matching shuttles" text="Try a different search, or check back when more trips are listed."/>;
  return <div className="route-list">{trips.map((trip) => <article className="route-card" key={trip.id}><div className="route-icon">↗</div><div className="route-details"><span className="route-badge">CAMPUS SHUTTLE {showTime && "· SCHEDULE"}</span><h3>{trip.routeName}</h3><div className="journey"><div className="journey-point"><span className="point-dot"/><div><small>PICKUP</small><p>{trip.pickupPoint}</p></div></div><div className="journey-line"/><div className="journey-point"><span className="point-dot destination"/><div><small>DESTINATION</small><p>{trip.dropPoint}</p></div></div></div><div className="route-meta"><span>◷ {trip.departureTime}</span><span className={trip.availableSeats > 0 ? "seat-available" : "seat-full"}>{trip.availableSeats > 0 ? `${trip.availableSeats} seats available` : "Fully booked"}</span></div></div><div className="route-action"><p className="fare-label">ONE-WAY FARE</p><h3>₹{trip.fare}</h3><button className="book-button" disabled={trip.availableSeats < 1} onClick={() => onBook(trip)}>{user?.role === "ADMIN" ? "Admin view" : "View trip"}<span>→</span></button></div></article>)}</div>;
}

function BookingCard({ booking, admin, onCancel }) {
  const cancelled = booking.status === "CANCELLED";
  return <article className="booking-card"><div className="ticket-left"><span className="ticket-label">BOOKING REFERENCE</span><strong className="booking-reference">{booking.bookingReference}</strong><span className={`status-pill ${cancelled ? "cancelled" : "confirmed"}`}>{booking.status}</span></div><div className="ticket-main"><div className="ticket-main-top"><div><p className="eyebrow">{admin ? `${booking.studentName} · ${booking.registrationNumber}` : "YOUR SHUTTLE TICKET"}</p><h3>{booking.routeName}</h3></div><strong className="ticket-total">₹{booking.totalFare}</strong></div><div className="ticket-route"><div><small>FROM</small><strong>{booking.pickupPoint}</strong></div><span className="line-dash"/><div><small>TO</small><strong>{booking.dropPoint}</strong></div></div><div className="ticket-bottom"><span>Departure <b>{booking.departureTime}</b></span><span>Seats <b>{booking.seats}</b></span><span>{booking.bookedAt ? new Date(booking.bookedAt).toLocaleDateString() : ""}</span>{!cancelled && <button className="cancel-button" onClick={() => onCancel(booking)}>{admin ? "Cancel booking" : "Cancel ticket"}</button>}</div></div></article>;
}

function EmptyState({ title, text, action }) {
  return <div className="empty-state"><span className="empty-icon">⌁</span><h3>{title}</h3><p>{text}</p>{action}</div>;
}

export default App;
