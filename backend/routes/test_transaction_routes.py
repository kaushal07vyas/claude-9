from flask import Blueprint, jsonify, request
from db_connection import get_db_connection
import traceback

def as_int_bool(value):
    if value in (True, "1", 1, "true", "True"):
        return 1
    if value in (False, "0", 0, "false", "False"):
        return 0
    return None

test_tx_bp = Blueprint('test_tx_bp', __name__)

@test_tx_bp.route('/run-weather-flight-transaction', methods=['POST'])
def run_weather_flight_transaction():
    payload = request.json

    weather_date = payload.get("weather_date") or payload.get("date")
    fare_date = payload.get("fare_date") or payload.get("date")

    if not weather_date:
        return jsonify({"error": "Missing field: weather_date/date"}), 400

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Set isolation level
            cursor.execute("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED")
            conn.begin()

            # ---------------------------
            # Check flight existence
            # ---------------------------
            flight_id = payload.get("flight_id")
            if flight_id is None:
                raise ValueError("flight_id is required")

            cursor.execute("""
                SELECT f.flight_id
                FROM Flight f
                WHERE f.flight_id = %s
                FOR UPDATE
            """, (flight_id,))
            rows = cursor.fetchall()
            if len(rows) > 0:
                raise Exception("Flight already exists — aborting transaction.")

            # ---------------------------
            # Check airport existence
            # ---------------------------
            origin_airport = payload.get("origin_airport")
            if not origin_airport:
                raise ValueError("origin_airport is required")

            cursor.execute("""
                SELECT airport_code
                FROM Airport
                WHERE airport_code = %s
                FOR UPDATE
            """, (origin_airport,))
            row = cursor.fetchone()
            if not row:
                raise Exception(f"Origin airport '{origin_airport}' not found")

            # ---------------------------
            # Insert Daily Weather
            # ---------------------------
            cursor.execute("""
                INSERT INTO Daily_Weather (
                    station_id, date, prcp_mm, tmin_c, fog_flag, thunder_flag
                ) VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                payload.get("station_id"),
                weather_date,
                payload.get("prcp_mm") if payload.get("prcp_mm") is not None else None,
                payload.get("tmin_c") if payload.get("tmin_c") is not None else None,
                as_int_bool(payload.get("fog_flag")),
                as_int_bool(payload.get("thunder_flag"))
            ))

            # ---------------------------
            # Insert Flight
            # ---------------------------
            cursor.execute("""
                INSERT INTO Flight (
                    flight_id, flight_no, airline_id, origin_airport,
                    destination_airport, total_ops, percent_cancelled
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                flight_id,
                payload.get("flight_no"),
                payload.get("airline_id"),
                origin_airport,
                payload.get("destination_airport"),
                payload.get("total_ops"),
                payload.get("percent_cancelled")
            ))

            # ---------------------------
            # Insert Fare History
            # ---------------------------
            cursor.execute("""
                INSERT INTO Fare_History (
                    flight_id, fare_date, mean_fare, num_passenger
                ) VALUES (%s, %s, %s, %s)
            """, (
                flight_id,
                fare_date,
                payload.get("mean_fare"),
                payload.get("num_passenger")
            ))

            conn.commit()
            return jsonify({"message": "Transaction COMMITTED successfully"})

    except Exception as e:
        try:
            conn.rollback()
        except:
            pass
        print(f"EXCEPTION: {type(e).__name__}: {e}")
        print(traceback.format_exc())
        return jsonify({
            "message": "Transaction ROLLED BACK",
            "error": str(e),
            "error_type": type(e).__name__
        }), 500



# from flask import Blueprint, request, jsonify
# from db_connection import get_db_connection

# test_tx_bp = Blueprint("test_tx_bp", __name__)

# def as_int_bool(value):
#     if value in (True, "1", 1, "true", "True"):
#         return 1
#     if value in (False, "0", 0, "false", "False"):
#         return 0
#     return None   # Empty string, null, undefined → NULL


# @test_tx_bp.route('/run-weather-flight-transaction', methods=['POST'])
# def call_weather_flight_procedure():
#     payload = request.json

#     # Map frontend → backend (supports both weather_date | date)
#     weather_date = payload.get("weather_date") or payload.get("date")
#     fare_date = payload.get("fare_date") or payload.get("date")

#     if not weather_date:
#         return jsonify({"error": "Missing field: weather_date/date"}), 400

#     try:
#         with get_db_connection() as conn:
#             cursor = conn.cursor()

#             # Call stored procedure
#             cursor.callproc("run_weather_flight_transaction", [
#                 payload.get("station_id"),
#                 weather_date,

#                 # Weather fields
#                 payload.get("prcp_mm") or None,
#                 payload.get("tmin_c") or None,
#                 as_int_bool(payload.get("fog_flag")),
#                 as_int_bool(payload.get("thunder_flag")),

#                 # Flight fields
#                 payload.get("flight_id"),
#                 payload.get("flight_no"),
#                 payload.get("airline_id") or None,
#                 payload.get("origin_airport") or None,
#                 payload.get("destination_airport"),
#                 payload.get("total_ops") or None,
#                 payload.get("percent_cancelled") or None,

#                 # Fare fields
#                 fare_date,
#                 payload.get("mean_fare") or None,
#                 payload.get("num_passenger") or None
#             ])

#             # Move to the SELECT result set returned by the stored procedure
#             cursor.nextset()
#             result = cursor.fetchall()

#             conn.commit()

#             # Extract SELECT message
#             message = result[0][0] if result else "Transaction completed"

#             return jsonify({"message": message})

#     except Exception as e:
#         import traceback
#         traceback.print_exc()
#         return jsonify({
#             "message": "Transaction ROLLED BACK",
#             "error": str(e)
#         }), 500
