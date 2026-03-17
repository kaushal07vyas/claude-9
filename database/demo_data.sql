
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE Fare_History;
TRUNCATE TABLE Daily_Weather;
TRUNCATE TABLE Checks;
TRUNCATE TABLE Flight;
TRUNCATE TABLE Airport;
TRUNCATE TABLE Airline_Carrier;
TRUNCATE TABLE `User`;
SET FOREIGN_KEY_CHECKS = 1;


-- ===========================================================
-- Demo Data for Claude-9 Flight Tracker
-- ===========================================================
-- This script populates the database with sample data for testing
-- ===========================================================

-- ===========================================================
-- 1. AIRLINE_CARRIER Data
-- ===========================================================

INSERT INTO Airline_Carrier (airline_id, airline_name) VALUES
('AA', 'American Airlines Inc.'),
('DL', 'Delta Air Lines Inc.'),
('UA', 'United Air Lines Inc.'),
('WN', 'Southwest Airlines Co.'),
('AS', 'Alaska Airlines Inc.'),
('B6', 'JetBlue Airways'),
('F9', 'Frontier Airlines Inc.'),
('NK', 'Spirit Air Lines'),
('PSA', 'PSA Airlines Inc.'),
('YX', 'Republic Airways');

-- ===========================================================
-- 2. AIRPORT Data
-- ===========================================================

INSERT INTO Airport (airport_code, airport_name, city, country) VALUES
('JFK', 'John F. Kennedy International Airport', 'New York', 'USA'),
('LAX', 'Los Angeles International Airport', 'Los Angeles', 'USA'),
('ORD', 'Chicago O''Hare International Airport', 'Chicago', 'USA'),
('DFW', 'Dallas/Fort Worth International Airport', 'Dallas', 'USA'),
('DEN', 'Denver International Airport', 'Denver', 'USA'),
('ATL', 'Hartsfield-Jackson Atlanta International Airport', 'Atlanta', 'USA'),
('SFO', 'San Francisco International Airport', 'San Francisco', 'USA'),
('SEA', 'Seattle-Tacoma International Airport', 'Seattle', 'USA'),
('BWI', 'Baltimore/Washington International Airport', 'Baltimore', 'USA'),
('BNA', 'Nashville International Airport', 'Nashville', 'USA'),
('COS', 'Colorado Springs Airport', 'Colorado Springs', 'USA'),
('AVP', 'Wilkes-Barre/Scranton International Airport', 'Scranton', 'USA'),
('MIA', 'Miami International Airport', 'Miami', 'USA'),
('PHX', 'Phoenix Sky Harbor International Airport', 'Phoenix', 'USA'),
('LAS', 'McCarran International Airport', 'Las Vegas', 'USA');

-- ===========================================================
-- 3. USER Data
-- ===========================================================

-- Note: Passwords are hashed using bcrypt. Default password for all users: "password123"
-- In production, use proper password hashing. For demo, using simple hash representation.
INSERT INTO `User` (user_name, user_email, state, country, dob, phone_number, password, role) VALUES
('John Doe', 'john.doe@example.com', 'California', 'USA', '1990-05-15', '555-0101', 'user123', 'User'),
('Jane Smith', 'jane.smith@example.com', 'New York', 'USA', '1985-08-22', '555-0102', 'user123', 'User'),
('Admin User', 'admin@example.com', 'Texas', 'USA', '1980-01-10', '555-0001', 'admin123', 'Admin'),
('Bob Johnson', 'bob.johnson@example.com', 'Florida', 'USA', '1992-11-30', '555-0103', 'user123', 'User'),
('Alice Brown', 'alice.brown@example.com', 'Washington', 'USA', '1988-03-20', '555-0104', 'user123', 'User');

-- ===========================================================
-- 4. FLIGHT Data
-- ===========================================================

INSERT INTO Flight (flight_id, flight_no, airline_id, origin_airport, destination_airport, total_ops, percent_cancelled) VALUES
-- Major Hub Routes
('AA101-JFK-LAX-2024', 'AA101', 'AA', 'JFK', 'LAX', 150, 2),
('AA102-JFK-DFW-2024', 'AA102', 'AA', 'JFK', 'DFW', 180, 1),
('AA103-JFK-ORD-2024', 'AA103', 'AA', 'JFK', 'ORD', 200, 2),
('AA104-JFK-ATL-2024', 'AA104', 'AA', 'JFK', 'ATL', 170, 1),
('AA105-JFK-MIA-2024', 'AA105', 'AA', 'JFK', 'MIA', 100, 1),
('AA106-JFK-SFO-2024', 'AA106', 'AA', 'JFK', 'SFO', 160, 3),
('AA107-LAX-DFW-2024', 'AA107', 'AA', 'LAX', 'DFW', 220, 2),
('AA108-LAX-ORD-2024', 'AA108', 'AA', 'LAX', 'ORD', 190, 2),
('AA109-LAX-ATL-2024', 'AA109', 'AA', 'LAX', 'ATL', 180, 1),
('AA110-LAX-JFK-2024', 'AA110', 'AA', 'LAX', 'JFK', 150, 2),

-- Delta Routes
('DL201-ATL-JFK-2024', 'DL201', 'DL', 'ATL', 'JFK', 200, 1),
('DL202-ATL-DEN-2024', 'DL202', 'DL', 'ATL', 'DEN', 200, 1),
('DL203-ATL-LAX-2024', 'DL203', 'DL', 'ATL', 'LAX', 250, 2),
('DL204-ATL-ORD-2024', 'DL204', 'DL', 'ATL', 'ORD', 210, 1),
('DL205-ATL-DFW-2024', 'DL205', 'DL', 'ATL', 'DFW', 190, 1),
('DL206-ATL-SEA-2024', 'DL206', 'DL', 'ATL', 'SEA', 140, 2),
('DL207-ATL-SFO-2024', 'DL207', 'DL', 'ATL', 'SFO', 160, 2),
('DL208-ATL-MIA-2024', 'DL208', 'DL', 'ATL', 'MIA', 120, 1),
('DL209-DEN-ATL-2024', 'DL209', 'DL', 'DEN', 'ATL', 200, 1),
('DL210-DEN-LAX-2024', 'DL210', 'DL', 'DEN', 'LAX', 180, 2),

-- United Routes
('UA301-ORD-JFK-2024', 'UA301', 'UA', 'ORD', 'JFK', 200, 2),
('UA302-ORD-LAX-2024', 'UA302', 'UA', 'ORD', 'LAX', 190, 2),
('UA303-ORD-SFO-2024', 'UA303', 'UA', 'ORD', 'SFO', 180, 3),
('UA304-ORD-DEN-2024', 'UA304', 'UA', 'ORD', 'DEN', 170, 2),
('UA305-ORD-ATL-2024', 'UA305', 'UA', 'ORD', 'ATL', 160, 1),
('UA306-ORD-DFW-2024', 'UA306', 'UA', 'ORD', 'DFW', 150, 2),
('UA307-ORD-SEA-2024', 'UA307', 'UA', 'ORD', 'SEA', 140, 2),
('UA308-SFO-ORD-2024', 'UA308', 'UA', 'SFO', 'ORD', 180, 3),
('UA309-SFO-LAX-2024', 'UA309', 'UA', 'SFO', 'LAX', 120, 1),
('UA310-SFO-DEN-2024', 'UA310', 'UA', 'SFO', 'DEN', 130, 2),

-- Southwest Routes
('WN401-DEN-LAX-2024', 'WN401', 'WN', 'DEN', 'LAX', 160, 1),
('WN402-DEN-ORD-2024', 'WN402', 'WN', 'DEN', 'ORD', 150, 1),
('WN403-DEN-ATL-2024', 'WN403', 'WN', 'DEN', 'ATL', 140, 1),
('WN404-DEN-BWI-2024', 'WN404', 'WN', 'DEN', 'BWI', 120, 0),
('WN405-DEN-DFW-2024', 'WN405', 'WN', 'DEN', 'DFW', 130, 1),
('WN406-DEN-SEA-2024', 'WN406', 'WN', 'DEN', 'SEA', 110, 1),
('WN407-LAX-DEN-2024', 'WN407', 'WN', 'LAX', 'DEN', 160, 1),
('WN408-LAX-ORD-2024', 'WN408', 'WN', 'LAX', 'ORD', 170, 2),
('WN409-LAX-DFW-2024', 'WN409', 'WN', 'LAX', 'DFW', 180, 1),
('WN410-BWI-DEN-2024', 'WN410', 'WN', 'BWI', 'DEN', 120, 0),

-- Popular Routes (Nashville, Dallas, etc.)
('AA501-BNA-DFW-2024', 'AA501', 'AA', 'BNA', 'DFW', 100, 1),
('AA502-BNA-ATL-2024', 'AA502', 'AA', 'BNA', 'ATL', 90, 1),
('AA503-BNA-ORD-2024', 'AA503', 'AA', 'BNA', 'ORD', 85, 2),
('AA504-BNA-JFK-2024', 'AA504', 'AA', 'BNA', 'JFK', 80, 2),
('DL501-DFW-BNA-2024', 'DL501', 'DL', 'DFW', 'BNA', 100, 1),
('DL502-DFW-ATL-2024', 'DL502', 'DL', 'DFW', 'ATL', 150, 1),
('DL503-DFW-LAX-2024', 'DL503', 'DL', 'DFW', 'LAX', 200, 2),
('DL504-DFW-ORD-2024', 'DL504', 'DL', 'DFW', 'ORD', 180, 1),
('DL505-DFW-JFK-2024', 'DL505', 'DL', 'DFW', 'JFK', 170, 2),
('DL506-DFW-DEN-2024', 'DL506', 'DL', 'DFW', 'DEN', 160, 1),

-- More Popular Routes
('UA501-SEA-LAX-2024', 'UA501', 'UA', 'SEA', 'LAX', 140, 1),
('UA502-SEA-SFO-2024', 'UA502', 'UA', 'SEA', 'SFO', 120, 1),
('UA503-SEA-DEN-2024', 'UA503', 'UA', 'SEA', 'DEN', 130, 2),
('UA504-SEA-ORD-2024', 'UA504', 'UA', 'SEA', 'ORD', 150, 2),
('UA505-MIA-JFK-2024', 'UA505', 'UA', 'MIA', 'JFK', 110, 1),
('UA506-MIA-ATL-2024', 'UA506', 'UA', 'MIA', 'ATL', 100, 1),
('UA507-MIA-ORD-2024', 'UA507', 'UA', 'MIA', 'ORD', 95, 2),
('UA508-MIA-LAX-2024', 'UA508', 'UA', 'MIA', 'LAX', 120, 2),
('UA1418-DEN-COS-2024', '1418', 'UA', 'DEN', 'COS', 75, 2),
('PSA5464-BNA-AVP-2024', '5464', 'PSA', 'BNA', 'AVP', 50, 0),

-- Additional Popular Routes
('WN501-PHX-LAX-2024', 'WN501', 'WN', 'PHX', 'LAX', 130, 1),
('WN502-PHX-DEN-2024', 'WN502', 'WN', 'PHX', 'DEN', 120, 1),
('WN503-PHX-DFW-2024', 'WN503', 'WN', 'PHX', 'DFW', 110, 1),
('WN504-LAS-LAX-2024', 'WN504', 'WN', 'LAS', 'LAX', 100, 0),
('WN505-LAS-DEN-2024', 'WN505', 'WN', 'LAS', 'DEN', 90, 1),
('WN506-LAS-PHX-2024', 'WN506', 'WN', 'LAS', 'PHX', 85, 0),
('AS501-SEA-LAX-2024', 'AS501', 'AS', 'SEA', 'LAX', 140, 1),
('AS502-SEA-SFO-2024', 'AS502', 'AS', 'SEA', 'SFO', 120, 1),
('AS503-SEA-DEN-2024', 'AS503', 'AS', 'SEA', 'DEN', 110, 2),
('B6501-JFK-LAX-2024', 'B6501', 'B6', 'JFK', 'LAX', 150, 2),

('AA505-JFK-MIA-2024', 'AA505', 'AA', 'JFK', 'MIA', 95, 1),
('DL606-ATL-LAX-2024', 'DL606', 'DL', 'ATL', 'LAX', 240, 2),
('UA707-ORD-DEN-2024', 'UA707', 'UA', 'ORD', 'DEN', 165, 2),
('WN808-DEN-SEA-2024', 'WN808', 'WN', 'DEN', 'SEA', 105, 1);

-- ===========================================================
-- 5. CHECKS Data (User tracking flights)
-- ===========================================================

INSERT INTO Checks (user_id, flight_id) VALUES
(1, 'AA101-JFK-LAX-2024'),
(1, 'DL202-ATL-DEN-2024'),
(1, 'AA501-BNA-DFW-2024'),
(1, 'PSA5464-BNA-AVP-2024'),
(2, 'UA303-ORD-SFO-2024'),
(2, 'WN404-DEN-BWI-2024'),
(2, 'DL501-DFW-BNA-2024'),
(2, 'UA1418-DEN-COS-2024'),
(3, 'AA505-JFK-MIA-2024'),
(3, 'AA102-JFK-DFW-2024'),
(4, 'DL606-ATL-LAX-2024'),
(4, 'UA707-ORD-DEN-2024'),
(4, 'DL203-ATL-LAX-2024'),
(5, 'WN808-DEN-SEA-2024'),
(5, 'WN401-DEN-LAX-2024');

-- ===========================================================
-- 6. FARE_HISTORY Data
-- ===========================================================

-- Flight AA101 - Showing fare drop
INSERT INTO Fare_History (flight_id, fare_date, mean_fare, num_passenger, quarter, Year) VALUES
('AA101-JFK-LAX-2024', '2024-01-15', 450.00, 150, 'Q1', 2024),
('AA101-JFK-LAX-2024', '2024-02-15', 420.00, 145, 'Q1', 2024),
('AA101-JFK-LAX-2024', '2024-03-15', 380.00, 140, 'Q1', 2024),
('AA101-JFK-LAX-2024', '2024-04-15', 350.00, 135, 'Q2', 2024);

-- Flight DL202
INSERT INTO Fare_History (flight_id, fare_date, mean_fare, num_passenger, quarter, Year) VALUES
('DL202-ATL-DEN-2024', '2024-01-20', 320.00, 180, 'Q1', 2024),
('DL202-ATL-DEN-2024', '2024-02-20', 310.00, 175, 'Q1', 2024),
('DL202-ATL-DEN-2024', '2024-03-20', 300.00, 170, 'Q1', 2024);

-- Flight UA303
INSERT INTO Fare_History (flight_id, fare_date, mean_fare, num_passenger, quarter, Year) VALUES
('UA303-ORD-SFO-2024', '2024-01-10', 480.00, 160, 'Q1', 2024),
('UA303-ORD-SFO-2024', '2024-02-10', 460.00, 155, 'Q1', 2024),
('UA303-ORD-SFO-2024', '2024-03-10', 440.00, 150, 'Q1', 2024);

-- Flight WN404 - Showing fare drop
INSERT INTO Fare_History (flight_id, fare_date, mean_fare, num_passenger, quarter, Year) VALUES
('WN404-DEN-BWI-2024', '2024-01-25', 280.00, 110, 'Q1', 2024),
('WN404-DEN-BWI-2024', '2024-02-25', 250.00, 105, 'Q1', 2024),
('WN404-DEN-BWI-2024', '2024-03-25', 220.00, 100, 'Q1', 2024);

-- Flight AA505
INSERT INTO Fare_History (flight_id, fare_date, mean_fare, num_passenger, quarter, Year) VALUES
('AA505-JFK-MIA-2024', '2024-02-01', 350.00, 90, 'Q1', 2024),
('AA505-JFK-MIA-2024', '2024-03-01', 340.00, 85, 'Q1', 2024);

-- Flight DL606
INSERT INTO Fare_History (flight_id, fare_date, mean_fare, num_passenger, quarter, Year) VALUES
('DL606-ATL-LAX-2024', '2024-01-05', 520.00, 220, 'Q1', 2024),
('DL606-ATL-LAX-2024', '2024-02-05', 510.00, 215, 'Q1', 2024),
('DL606-ATL-LAX-2024', '2024-03-05', 500.00, 210, 'Q1', 2024);

-- Flight UA707
INSERT INTO Fare_History (flight_id, fare_date, mean_fare, num_passenger, quarter, Year) VALUES
('UA707-ORD-DEN-2024', '2024-02-10', 290.00, 130, 'Q1', 2024),
('UA707-ORD-DEN-2024', '2024-03-10', 280.00, 125, 'Q1', 2024);

-- Flight WN808
INSERT INTO Fare_History (flight_id, fare_date, mean_fare, num_passenger, quarter, Year) VALUES
('WN808-DEN-SEA-2024', '2024-01-15', 320.00, 80, 'Q1', 2024),
('WN808-DEN-SEA-2024', '2024-02-15', 310.00, 75, 'Q1', 2024);

-- Flight PSA5464 - Showing significant fare drop (for demo)
INSERT INTO Fare_History (flight_id, fare_date, mean_fare, num_passenger, quarter, Year) VALUES
('PSA5464-BNA-AVP-2024', '2024-07-15', 450.00, 45, 'Q3', 2024),
('PSA5464-BNA-AVP-2024', '2024-07-29', 228.37, 40, 'Q3', 2024);

-- Flight UA1418 - Showing significant fare drop (for demo)
INSERT INTO Fare_History (flight_id, fare_date, mean_fare, num_passenger, quarter, Year) VALUES
('UA1418-DEN-COS-2024', '2024-08-15', 375.80, 70, 'Q3', 2024),
('UA1418-DEN-COS-2024', '2024-09-03', 159.10, 65, 'Q3', 2024);

-- Additional fare history for weather analysis (last 90 days)
INSERT INTO Fare_History (flight_id, fare_date, mean_fare, num_passenger, quarter, Year) VALUES
('AA101-JFK-LAX-2024', '2025-01-15', 360.00, 140, 'Q1', 2025),
('DL202-ATL-DEN-2024', '2025-01-20', 295.00, 175, 'Q1', 2025),
('UA303-ORD-SFO-2024', '2025-01-10', 430.00, 155, 'Q1', 2025),
('WN404-DEN-BWI-2024', '2025-01-25', 210.00, 100, 'Q1', 2025);

-- Fare history for new popular routes (BNA-DFW, etc.)
INSERT INTO Fare_History (flight_id, fare_date, mean_fare, num_passenger, quarter, Year) VALUES
-- BNA-DFW route (Nashville to Dallas - popular route)
('AA501-BNA-DFW-2024', '2024-01-10', 280.00, 95, 'Q1', 2024),
('AA501-BNA-DFW-2024', '2024-02-10', 270.00, 90, 'Q1', 2024),
('AA501-BNA-DFW-2024', '2024-03-10', 260.00, 85, 'Q1', 2024),
('DL501-DFW-BNA-2024', '2024-01-15', 275.00, 100, 'Q1', 2024),
('DL501-DFW-BNA-2024', '2024-02-15', 265.00, 95, 'Q1', 2024),
('DL501-DFW-BNA-2024', '2024-03-15', 255.00, 90, 'Q1', 2024),

-- More popular routes
('AA102-JFK-DFW-2024', '2024-01-05', 420.00, 170, 'Q1', 2024),
('AA102-JFK-DFW-2024', '2024-02-05', 410.00, 165, 'Q1', 2024),
('AA103-JFK-ORD-2024', '2024-01-08', 380.00, 190, 'Q1', 2024),
('AA103-JFK-ORD-2024', '2024-02-08', 370.00, 185, 'Q1', 2024),
('AA104-JFK-ATL-2024', '2024-01-12', 350.00, 160, 'Q1', 2024),
('AA104-JFK-ATL-2024', '2024-02-12', 340.00, 155, 'Q1', 2024),
('DL201-ATL-JFK-2024', '2024-01-18', 360.00, 190, 'Q1', 2024),
('DL201-ATL-JFK-2024', '2024-02-18', 350.00, 185, 'Q1', 2024),
('DL203-ATL-LAX-2024', '2024-01-22', 480.00, 230, 'Q1', 2024),
('DL203-ATL-LAX-2024', '2024-02-22', 470.00, 225, 'Q1', 2024),
('DL204-ATL-ORD-2024', '2024-01-25', 320.00, 200, 'Q1', 2024),
('DL204-ATL-ORD-2024', '2024-02-25', 310.00, 195, 'Q1', 2024),
('DL205-ATL-DFW-2024', '2024-01-28', 300.00, 180, 'Q1', 2024),
('DL205-ATL-DFW-2024', '2024-02-28', 290.00, 175, 'Q1', 2024),
('UA301-ORD-JFK-2024', '2024-01-06', 390.00, 190, 'Q1', 2024),
('UA301-ORD-JFK-2024', '2024-02-06', 380.00, 185, 'Q1', 2024),
('UA302-ORD-LAX-2024', '2024-01-09', 450.00, 180, 'Q1', 2024),
('UA302-ORD-LAX-2024', '2024-02-09', 440.00, 175, 'Q1', 2024),
('UA304-ORD-DEN-2024', '2024-01-11', 330.00, 160, 'Q1', 2024),
('UA304-ORD-DEN-2024', '2024-02-11', 320.00, 155, 'Q1', 2024),
('UA305-ORD-ATL-2024', '2024-01-14', 310.00, 150, 'Q1', 2024),
('UA305-ORD-ATL-2024', '2024-02-14', 300.00, 145, 'Q1', 2024),
('WN401-DEN-LAX-2024', '2024-01-16', 290.00, 150, 'Q1', 2024),
('WN401-DEN-LAX-2024', '2024-02-16', 280.00, 145, 'Q1', 2024),
('WN402-DEN-ORD-2024', '2024-01-19', 270.00, 140, 'Q1', 2024),
('WN402-DEN-ORD-2024', '2024-02-19', 260.00, 135, 'Q1', 2024),
('WN403-DEN-ATL-2024', '2024-01-21', 250.00, 130, 'Q1', 2024),
('WN403-DEN-ATL-2024', '2024-02-21', 240.00, 125, 'Q1', 2024),
('WN405-DEN-DFW-2024', '2024-01-24', 230.00, 120, 'Q1', 2024),
('WN405-DEN-DFW-2024', '2024-02-24', 220.00, 115, 'Q1', 2024),
('DL502-DFW-ATL-2024', '2024-01-26', 310.00, 140, 'Q1', 2024),
('DL502-DFW-ATL-2024', '2024-02-26', 300.00, 135, 'Q1', 2024),
('DL503-DFW-LAX-2024', '2024-01-29', 380.00, 190, 'Q1', 2024),
('DL503-DFW-LAX-2024', '2024-02-29', 370.00, 185, 'Q1', 2024),
('DL504-DFW-ORD-2024', '2024-02-01', 320.00, 170, 'Q1', 2024),
('DL504-DFW-ORD-2024', '2024-03-01', 310.00, 165, 'Q1', 2024),
('DL505-DFW-JFK-2024', '2024-02-03', 400.00, 160, 'Q1', 2024),
('DL505-DFW-JFK-2024', '2024-03-03', 390.00, 155, 'Q1', 2024),
('DL506-DFW-DEN-2024', '2024-02-05', 280.00, 150, 'Q1', 2024),
('DL506-DFW-DEN-2024', '2024-03-05', 270.00, 145, 'Q1', 2024);

-- ===========================================================
-- 7. DAILY_WEATHER Data (Last 90 days for analysis)
-- ===========================================================

-- Weather data for various airports (last 90 days)
INSERT INTO Daily_Weather (station_id, date, prcp_mm, snow_mm, snow_depth_mm, tmin_c, fog_flag, thunder_flag, cloud_day_frac, gust_ms, wsf2_ms, awwnd_ms) VALUES
-- JFK weather
('JFK', DATE_SUB(CURDATE(), INTERVAL 30 DAY), 5.2, 0, 0, 2.5, 0, 0, 0.3, 12.5, 15.2, 8.3),
('JFK', DATE_SUB(CURDATE(), INTERVAL 20 DAY), 8.1, 0, 0, 1.2, 1, 0, 0.6, 18.3, 20.1, 12.5),
('JFK', DATE_SUB(CURDATE(), INTERVAL 10 DAY), 12.5, 0, 0, -1.0, 1, 1, 0.8, 22.1, 25.3, 15.8),

-- LAX weather
('LAX', DATE_SUB(CURDATE(), INTERVAL 30 DAY), 0.5, 0, 0, 12.3, 0, 0, 0.2, 8.2, 10.5, 6.1),
('LAX', DATE_SUB(CURDATE(), INTERVAL 20 DAY), 2.1, 0, 0, 10.8, 0, 0, 0.4, 9.5, 11.2, 7.3),
('LAX', DATE_SUB(CURDATE(), INTERVAL 10 DAY), 0.0, 0, 0, 14.5, 0, 0, 0.1, 7.8, 9.2, 5.5),

-- DEN weather (more adverse conditions)
('DEN', DATE_SUB(CURDATE(), INTERVAL 30 DAY), 15.3, 25.4, 50.2, -5.2, 1, 0, 0.7, 25.3, 28.5, 18.2),
('DEN', DATE_SUB(CURDATE(), INTERVAL 20 DAY), 8.7, 12.1, 30.5, -2.1, 1, 1, 0.9, 30.1, 32.8, 20.5),
('DEN', DATE_SUB(CURDATE(), INTERVAL 10 DAY), 20.5, 35.2, 75.8, -8.5, 1, 1, 1.0, 35.2, 38.9, 22.1),

-- ATL weather
('ATL', DATE_SUB(CURDATE(), INTERVAL 30 DAY), 10.2, 0, 0, 8.5, 0, 1, 0.5, 15.3, 18.2, 10.5),
('ATL', DATE_SUB(CURDATE(), INTERVAL 20 DAY), 6.8, 0, 0, 6.2, 0, 0, 0.3, 12.1, 14.5, 8.7),
('ATL', DATE_SUB(CURDATE(), INTERVAL 10 DAY), 14.5, 0, 0, 5.8, 1, 1, 0.7, 20.3, 23.1, 13.2),

-- ORD weather
('ORD', DATE_SUB(CURDATE(), INTERVAL 30 DAY), 12.8, 15.2, 30.5, -3.5, 1, 0, 0.6, 22.5, 25.8, 15.3),
('ORD', DATE_SUB(CURDATE(), INTERVAL 20 DAY), 18.2, 28.5, 55.8, -6.2, 1, 1, 0.8, 28.3, 31.2, 18.5),
('ORD', DATE_SUB(CURDATE(), INTERVAL 10 DAY), 9.5, 12.1, 25.3, -1.8, 0, 0, 0.4, 16.2, 19.5, 11.8),

-- BWI weather
('BWI', DATE_SUB(CURDATE(), INTERVAL 30 DAY), 7.5, 0, 0, 3.2, 0, 0, 0.4, 13.2, 16.1, 9.5),
('BWI', DATE_SUB(CURDATE(), INTERVAL 20 DAY), 11.2, 2.5, 5.1, 1.5, 1, 0, 0.6, 17.8, 20.3, 12.1),
('BWI', DATE_SUB(CURDATE(), INTERVAL 10 DAY), 5.8, 0, 0, 4.5, 0, 0, 0.3, 11.5, 14.2, 8.3),

-- SFO weather
('SFO', DATE_SUB(CURDATE(), INTERVAL 30 DAY), 3.2, 0, 0, 8.5, 1, 0, 0.5, 14.2, 17.5, 10.2),
('SFO', DATE_SUB(CURDATE(), INTERVAL 20 DAY), 6.8, 0, 0, 7.2, 0, 0, 0.3, 12.8, 15.3, 9.1),
('SFO', DATE_SUB(CURDATE(), INTERVAL 10 DAY), 2.1, 0, 0, 9.8, 0, 0, 0.2, 10.5, 13.2, 7.8),

-- BNA weather
('BNA', DATE_SUB(CURDATE(), INTERVAL 30 DAY), 9.5, 0, 0, 5.5, 0, 1, 0.4, 15.8, 18.5, 11.2),
('BNA', DATE_SUB(CURDATE(), INTERVAL 20 DAY), 4.2, 0, 0, 7.2, 0, 0, 0.2, 11.2, 13.8, 8.5),
('BNA', DATE_SUB(CURDATE(), INTERVAL 10 DAY), 13.5, 0, 0, 4.8, 1, 1, 0.7, 19.5, 22.1, 13.8),

-- COS weather
('COS', DATE_SUB(CURDATE(), INTERVAL 30 DAY), 6.2, 8.5, 15.3, -2.5, 0, 0, 0.4, 18.2, 21.5, 12.8),
('COS', DATE_SUB(CURDATE(), INTERVAL 20 DAY), 10.8, 15.2, 28.5, -4.2, 1, 0, 0.6, 22.5, 25.8, 15.3),
('COS', DATE_SUB(CURDATE(), INTERVAL 10 DAY), 8.5, 12.1, 22.8, -1.8, 0, 0, 0.5, 19.8, 23.2, 14.1),

-- AVP weather
('AVP', DATE_SUB(CURDATE(), INTERVAL 30 DAY), 11.5, 18.2, 35.5, -3.8, 1, 0, 0.7, 20.5, 24.2, 14.8),
('AVP', DATE_SUB(CURDATE(), INTERVAL 20 DAY), 7.2, 10.5, 20.2, -1.5, 0, 0, 0.4, 16.8, 19.5, 12.2),
('AVP', DATE_SUB(CURDATE(), INTERVAL 10 DAY), 14.2, 22.8, 45.2, -5.5, 1, 1, 0.9, 26.5, 30.2, 18.5);
