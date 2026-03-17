from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
from routes import register_routes
from routes.test_transaction_routes import test_tx_bp   # import your new transaction route

load_dotenv()

app = Flask(__name__)

# CORS configuration
CORS(app)

# Register ALL normal routes
register_routes(app)

# Register your new transaction test route
app.register_blueprint(test_tx_bp, url_prefix='/api/test')

@app.route('/')
def health_check():
    return {'status': 'ok', 'message': 'Flight Tracker API is running'}

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5001, debug=True)
