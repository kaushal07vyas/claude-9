from .airline_routes import airline_bp
from .airport_routes import airport_bp
from .flight_routes import flight_bp
from .fare_history_routes import fare_history_bp
from .daily_weather_routes import daily_weather_bp
from .auth_routes import auth_bp
from .admin_routes import admin_bp
from .flight_insights_routes import flight_insights_bp
from .user_routes import user_bp 

def register_routes(app):
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(airline_bp, url_prefix='/api/airlines')
    app.register_blueprint(airport_bp, url_prefix='/api/airports')
    app.register_blueprint(flight_bp, url_prefix='/api/flights')
    app.register_blueprint(fare_history_bp, url_prefix='/api/fare_history')
    app.register_blueprint(daily_weather_bp, url_prefix='/api/daily_weather')
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(flight_insights_bp, url_prefix='/api/flight_insights')
    app.register_blueprint(user_bp, url_prefix='/api/users')
