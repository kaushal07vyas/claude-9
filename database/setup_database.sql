

SOURCE schema.sql;
SOURCE generate_fare_drop_report.sql;
SOURCE flight_triggers.sql;

SOURCE demo_data.sql;


SELECT 'Database setup completed successfully!' AS status;
SELECT COUNT(*) AS airline_count FROM Airline_Carrier;
SELECT COUNT(*) AS airport_count FROM Airport;
SELECT COUNT(*) AS user_count FROM `User`;
SELECT COUNT(*) AS flight_count FROM Flight;
SELECT COUNT(*) AS fare_history_count FROM Fare_History;
SELECT COUNT(*) AS weather_count FROM Daily_Weather;

