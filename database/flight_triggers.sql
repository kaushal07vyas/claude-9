DELIMITER //

CREATE TRIGGER update_total_ops_after_fare
AFTER INSERT ON Fare_History
FOR EACH ROW
BEGIN
    IF NEW.num_passenger > 0 THEN
        UPDATE Flight
        SET total_ops = IFNULL(total_ops, 0) + 1
        WHERE flight_id = NEW.flight_id;
    END IF;
END;
//

DELIMITER ;