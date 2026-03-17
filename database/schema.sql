-- ===========================================================
-- Claude-9 Flight Tracker Database Schema
-- ===========================================================
-- This script creates the complete database schema for the
-- Flight Tracker application.
-- ===========================================================

-- Create database (uncomment if needed)
-- CREATE DATABASE IF NOT EXISTS Claude9_demo;
-- USE Claude9_demo;

-- ===========================================================
-- 1. AIRLINE_CARRIER
-- ===========================================================

CREATE TABLE IF NOT EXISTS Airline_Carrier (
    airline_id   VARCHAR(20) PRIMARY KEY,
    airline_name VARCHAR(200) NOT NULL
);

-- ===========================================================
-- 2. AIRPORT
-- ===========================================================

CREATE TABLE IF NOT EXISTS Airport (
    airport_code VARCHAR(10) PRIMARY KEY,
    airport_name VARCHAR(200) NOT NULL,
    city         VARCHAR(120) NOT NULL,
    country      VARCHAR(120) NOT NULL
);

-- ===========================================================
-- 3. USER (with role + password)
-- ===========================================================

CREATE TABLE IF NOT EXISTS `User` (
    id            INT NOT NULL AUTO_INCREMENT,
    user_name     VARCHAR(120) NOT NULL,
    user_email    VARCHAR(254) NOT NULL,
    state         VARCHAR(80),
    country       VARCHAR(120),
    dob           DATE,
    phone_number  VARCHAR(40),
    password      VARCHAR(255) NOT NULL,
    role          ENUM('Admin','User') NOT NULL DEFAULT 'User',
    PRIMARY KEY (id),
    UNIQUE KEY unique_user_email (user_email)
);

-- ===========================================================
-- 4. FLIGHT
-- ===========================================================

CREATE TABLE IF NOT EXISTS Flight (
    flight_id           VARCHAR(40) PRIMARY KEY,
    flight_no           VARCHAR(20) NOT NULL,
    airline_id          VARCHAR(20) NOT NULL,
    origin_airport      VARCHAR(10) NOT NULL,
    destination_airport VARCHAR(10) NOT NULL,
    total_ops           INT,
    percent_cancelled   INT DEFAULT 0,
    CONSTRAINT fk_flight_airline
        FOREIGN KEY (airline_id)
        REFERENCES Airline_Carrier(airline_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_flight_origin
        FOREIGN KEY (origin_airport)
        REFERENCES Airport(airport_code)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_flight_dest
        FOREIGN KEY (destination_airport)
        REFERENCES Airport(airport_code)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- ===========================================================
-- 5. CHECKS (User ↔ Flight)
-- ===========================================================

CREATE TABLE IF NOT EXISTS Checks (
    user_id   INT NOT NULL,
    flight_id VARCHAR(40) NOT NULL,
    PRIMARY KEY (user_id, flight_id),
    CONSTRAINT fk_checks_user
        FOREIGN KEY (user_id)
        REFERENCES `User`(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_checks_flight
        FOREIGN KEY (flight_id)
        REFERENCES Flight(flight_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

-- ===========================================================
-- 6. FARE_HISTORY (with FK to Flight)
-- ===========================================================

CREATE TABLE IF NOT EXISTS Fare_History (
    flight_id      VARCHAR(40) NOT NULL,
    fare_date      DATE NOT NULL,
    mean_fare      DECIMAL(10,2) NOT NULL,
    num_passenger  INT DEFAULT NULL,
    quarter        VARCHAR(2) DEFAULT NULL,
    Year           INT DEFAULT NULL,
    PRIMARY KEY (flight_id, fare_date),
    CONSTRAINT fk_farehistory_flight
        FOREIGN KEY (flight_id)
        REFERENCES Flight(flight_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

-- ===========================================================
-- 7. DAILY_WEATHER
-- ===========================================================

CREATE TABLE IF NOT EXISTS Daily_Weather (
    station_id      VARCHAR(10) NOT NULL,
    date            DATE NOT NULL,
    prcp_mm         NUMERIC(7,2),
    snow_mm         NUMERIC(7,2),
    snow_depth_mm   NUMERIC(7,2),
    tmin_c          NUMERIC(5,2),
    fog_flag        BOOLEAN,
    thunder_flag    BOOLEAN,
    cloud_day_frac  NUMERIC(4,2),
    gust_ms         NUMERIC(5,2),
    wsf2_ms         NUMERIC(5,2),
    awwnd_ms        NUMERIC(5,2),
    PRIMARY KEY (station_id, date),
    CONSTRAINT fk_dailyweather_airport
        FOREIGN KEY (station_id)
        REFERENCES Airport(airport_code)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

--Constraints:
ALTER TABLE User
ADD CONSTRAINT chk_user_name_nonempty CHECK (CHAR_LENGTH(user_name) > 0),
ADD CONSTRAINT chk_email_valid CHECK (user_email LIKE '%@%');


ALTER TABLE Daily_Weather
ADD CONSTRAINT chk_prcp CHECK (prcp_mm >= 0),
ADD CONSTRAINT chk_snow CHECK (snow_mm >= 0),
ADD CONSTRAINT chk_snow_depth CHECK (snow_depth_mm >= 0),
ADD CONSTRAINT chk_tmin CHECK (tmin_c BETWEEN -100 AND 100),
ADD CONSTRAINT chk_cloud CHECK (cloud_day_frac BETWEEN 0 AND 1),
ADD CONSTRAINT chk_gust CHECK (gust_ms >= 0),
ADD CONSTRAINT chk_wsf2 CHECK (wsf2_ms >= 0),
ADD CONSTRAINT chk_awwnd CHECK (awwnd_ms >= 0),
ADD CONSTRAINT chk_fog CHECK (fog_flag IN (0,1)),
ADD CONSTRAINT chk_thunder CHECK (thunder_flag IN (0,1));



ALTER TABLE Fare_History
ADD CONSTRAINT chk_mean_fare CHECK (mean_fare >= 0),
ADD CONSTRAINT chk_num_passenger CHECK (num_passenger >= 0),
ADD CONSTRAINT chk_passenger_upper_bound CHECK (num_passenger <= 1000000);

