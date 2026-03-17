from flask import Blueprint, request, jsonify
from db_connection import execute_transaction, get_db_connection

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

@admin_bp.post('/flights')
def add_flight():
    data = request.json

    flight_number = data.get('flight_number')
    airline_id = data.get('airline_id')
    departure_airport = data.get('departure_airport')
    arrival_airport = data.get('arrival_airport')
    departure_time = data.get('departure_time')
    arrival_time = data.get('arrival_time')
    price = data.get('price')

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT flight_number FROM Flight WHERE flight_no = %s",
            (flight_number,)
        )
        existing = cursor.fetchone()
        cursor.close()
        conn.close()

        if existing:
            return jsonify({
                "status": "error",
                "message": f"Flight {flight_number} already exists."
            }), 400

    # ----------
        queries = [
            (
                """INSERT INTO Flight (flight_number, airline_id, price)
                   VALUES (%s, %s, %s)""",
                (flight_number, airline_id, price)
            ),
            (
                """INSERT INTO Flight_Schedule 
                   (flight_number, departure_time, arrival_time) 
                   VALUES (%s, %s, %s)""",
                (flight_number, departure_time, arrival_time)
            ),
            (
                """INSERT INTO Airport_Departure (flight_number, airport_code)
                   VALUES (%s, %s)""",
                (flight_number, departure_airport)
            ),
            (
                """INSERT INTO Airport_Arrival (flight_number, airport_code)
                   VALUES (%s, %s)""",
                (flight_number, arrival_airport)
            )
        ]

        execute_transaction(queries)

        return jsonify({
            "status": "success",
            "message": "Flight added successfully"
        })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@admin_bp.delete('/flights/<string:flight_number>')
def delete_flight(flight_number):
    try:
        queries = [
            ("DELETE FROM Airport_Arrival WHERE flight_number = %s", (flight_number,)),
            ("DELETE FROM Airport_Departure WHERE flight_number = %s", (flight_number,)),
            ("DELETE FROM Flight_Schedule WHERE flight_number = %s", (flight_number,)),
            ("DELETE FROM Flight WHERE flight_number = %s", (flight_number,))
        ]

        execute_transaction(queries)

        return jsonify({"status": "success", "message": "Flight deleted successfully"})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    
@admin_bp.post('/flights/update-price')
def update_flight_price():
    data = request.json

    flight_number = data.get('flight_number')
    new_price = data.get('new_price')

    try:
        queries = [
            (
                """INSERT INTO Fare_History 
                   (flight_number, old_price, new_price, changed_at)
                   SELECT flight_number, price, %s, NOW()
                   FROM Flight
                   WHERE flight_number = %s""",
                (new_price, flight_number)
            ),
            (
                """UPDATE Flight SET price = %s WHERE flight_number = %s""",
                (new_price, flight_number)
            )
        ]

        execute_transaction(queries)

        return jsonify({
            "status": "success",
            "message": "Price updated and history recorded."
        })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400