DELIMITER $$

DROP PROCEDURE IF EXISTS GenerateFareDropReport$$
CREATE PROCEDURE `GenerateFareDropReport`()
BEGIN
    
    DECLARE done INT DEFAULT FALSE;
    DECLARE cur_fid VARCHAR(40);

    -- cursor declaration
    DECLARE cur CURSOR FOR
        SELECT DISTINCT flight_id FROM Fare_History;

    -- handler for cursor end
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

   
    CREATE TEMPORARY TABLE IF NOT EXISTS tmp_processed_flights (
        flight_id VARCHAR(40) PRIMARY KEY
    );

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO cur_fid;
        IF done THEN
            LEAVE read_loop;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM tmp_processed_flights WHERE flight_id = cur_fid
        ) THEN
            INSERT INTO tmp_processed_flights (flight_id)
            VALUES (cur_fid);
        END IF;

    END LOOP;

    CLOSE cur;

   
    SELECT
        ac.airline_name,
        f.flight_no,
        f.origin_airport AS origin,
        f.destination_airport AS dest,
        d.fare_date,
        ROUND(d.prev_fare, 2) AS prev_fare,
        ROUND(d.mean_fare, 2) AS new_fare,
        ROUND(100 * d.pct_change, 1) AS pct_change_pct,
        COUNT(DISTINCT c.user_id) AS users_tracking
    FROM (
        SELECT
            x.flight_id,
            x.fare_date,
            x.mean_fare,
            x.prev_fare,
            (x.mean_fare - x.prev_fare) / x.prev_fare AS pct_change
        FROM (
            SELECT
                fh.flight_id,
                fh.fare_date,
                fh.mean_fare,
                (
                    SELECT fhp.mean_fare
                    FROM Fare_History AS fhp
                    WHERE fhp.flight_id = fh.flight_id
                      AND fhp.fare_date = (
                          SELECT MAX(fh2.fare_date)
                          FROM Fare_History AS fh2
                          WHERE fh2.flight_id = fh.flight_id
                            AND fh2.fare_date < fh.fare_date
                      )
                ) AS prev_fare
            FROM Fare_History AS fh
        ) AS x
        WHERE x.prev_fare IS NOT NULL
          AND (x.mean_fare - x.prev_fare) / x.prev_fare <= -0.10
    ) AS d
    JOIN Flight f ON f.flight_id = d.flight_id
    LEFT JOIN Checks c ON c.flight_id = d.flight_id
    JOIN Airline_Carrier ac ON ac.airline_id = f.airline_id
    GROUP BY
        ac.airline_name, f.flight_no, f.origin_airport, f.destination_airport,
        d.fare_date, d.prev_fare, d.mean_fare, d.pct_change
    HAVING COUNT(DISTINCT c.user_id) >= 1
    ORDER BY d.fare_date DESC, pct_change_pct ASC
    LIMIT 15;

    
    SELECT 
        ac.airline_name,
        ROUND(AVG(f.percent_cancelled), 2) AS avg_cancel_rate,
        ROUND(AVG(fh.mean_fare), 2) AS avg_fare,
        ROUND(SUM(CASE WHEN dw.thunder_flag OR dw.fog_flag THEN 1 ELSE 0 END) / COUNT(*), 2) AS bad_weather_ratio
    FROM Flight f
    JOIN Airline_Carrier ac ON ac.airline_id = f.airline_id
    JOIN Fare_History fh ON fh.flight_id = f.flight_id
    JOIN Daily_Weather dw ON dw.station_id = f.origin_airport AND dw.date = fh.fare_date
    WHERE fh.fare_date BETWEEN CURDATE() - INTERVAL 90 DAY AND CURDATE()
    GROUP BY ac.airline_name
    ORDER BY bad_weather_ratio DESC, avg_cancel_rate DESC
    LIMIT 15;

    DROP TEMPORARY TABLE IF EXISTS tmp_processed_flights;

END$$
DELIMITER ;