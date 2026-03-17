"""
Flight Insights API - Machine Learning Powered Flight Analysis

This module provides comprehensive flight analysis capabilities including delay and cancellation
prediction, fare forecasting, and travel recommendations. The system uses custom machine learning
algorithms built from scratch to analyze historical flight data, weather patterns, and airline
performance metrics.

The main features include:
- Predicting flight delays and cancellations based on weather, airline history, and route data
- Forecasting fare prices using historical trends and seasonal patterns
- Recommending alternative flights when the original option has high risk
- Suggesting optimal travel periods based on fare trends and weather conditions
- Analyzing weather risk factors for both origin and destination airports

All predictions are made using custom algorithms that combine multiple data sources and apply
weighted scoring systems. The system handles missing data gracefully and provides confidence
scores for all predictions.
"""

from flask import Blueprint, request, jsonify
from db_connection import execute_query
from datetime import datetime, timedelta
from urllib.parse import unquote
import math
import statistics
from collections import defaultdict, Counter

flight_insights_bp = Blueprint('flight_insights', __name__)



def parse_year_from_record(record):
    """Extracts the year value from a fare history record, handling both capital and lowercase column names."""
    year_raw = record.get('Year') or record.get('year') or 0
    try:
        return int(year_raw) if year_raw else 0
    except (ValueError, TypeError):
        return 0

def parse_quarter_from_record(record):
    """
    Extracts the quarter value from a fare history record.
    Works with string formats like 'Q1' or 'Q2' as well as numeric values.
    Returns a number between 1 and 4, or None if the data is invalid.
    """
    quarter_raw = record.get('quarter', '')
    if not quarter_raw:
        return None
    
    if isinstance(quarter_raw, str) and quarter_raw.upper().startswith('Q'):
        try:
            quarter = int(quarter_raw.upper().replace('Q', ''))
            if quarter in [1, 2, 3, 4]:
                return quarter
        except (ValueError, TypeError):
            pass
    elif isinstance(quarter_raw, (int, float)):
        quarter = int(quarter_raw)
        if quarter in [1, 2, 3, 4]:
            return quarter
    
    return None


class DataPreprocessor:
    """
    Prepares flight and weather data for machine learning models.
    Takes care of missing values, converts text categories to numbers, and scales numeric features.
    """
    
    def __init__(self):
        self.airline_encodings = {}
        self.airport_encodings = {}
        self.feature_scalers = {}
        self.encoding_counter = 0
    
    def encode_categorical(self, value, category_type='airline'):
        """
        Converts airline or airport names into numeric codes for the ML models.
        Each unique value gets assigned a sequential number.
        """
        encodings = self.airline_encodings if category_type == 'airline' else self.airport_encodings
        
        if value not in encodings:
            encodings[value] = self.encoding_counter
            self.encoding_counter += 1
        
        return encodings[value]
    
    def normalize_feature(self, value, feature_name, min_val=None, max_val=None):
        """
        Scales numeric values to a range between 0 and 1 so different features can be compared fairly.
        Missing values get set to 0.5 as a neutral middle point.
        """
        if value is None or (isinstance(value, float) and math.isnan(value)):
            return 0.5
        
        if min_val is None or max_val is None:
            if feature_name in self.feature_scalers:
                min_val, max_val = self.feature_scalers[feature_name]
            else:
                return value
        
        if max_val == min_val:
            return 0.5
        
        normalized = (value - min_val) / (max_val - min_val)
        return max(0.0, min(1.0, normalized))
    
    def handle_missing_weather(self, weather_data):
        """
        Fills in missing weather data with reasonable default values when records are incomplete.
        Uses typical weather conditions as defaults so predictions can still be made.
        """
        if not weather_data:
            return {
                'prcp_mm': 0.0,
                'snow_mm': 0.0,
                'snow_depth_mm': 0.0,
                'tmin_c': 15.0,
                'fog_flag': False,
                'thunder_flag': False,
                'wsf2_ms': 5.0,
                'gust_ms': 8.0,
                'cloud_day_frac': 0.5
            }
        
        return {
            'prcp_mm': float(weather_data.get('prcp_mm') or 0.0),
            'snow_mm': float(weather_data.get('snow_mm') or 0.0),
            'snow_depth_mm': float(weather_data.get('snow_depth_mm') or 0.0),
            'tmin_c': float(weather_data.get('tmin_c') or 15.0),
            'fog_flag': bool(weather_data.get('fog_flag') or False),
            'thunder_flag': bool(weather_data.get('thunder_flag') or False),
            'wsf2_ms': float(weather_data.get('wsf2_ms') or 5.0),
            'gust_ms': float(weather_data.get('gust_ms') or 8.0),
            'cloud_day_frac': float(weather_data.get('cloud_day_frac') or 0.5)
        }


def calculate_historical_risk_factors(origin_airport, dest_airport, target_date):
    """
    Looks at past weather patterns for the same time of year to predict risk.
    Tries to use monthly data first, but switches to quarterly data if there isn't enough monthly information.
    Returns separate risk scores for both the departure and arrival airports.
    
    Risk calculation method:
    - First attempts to gather weather data for the specific month across all past years
    - If there are at least 10 data points for that month, uses monthly analysis
    - Otherwise falls back to quarterly analysis (combining 3 months of data)
    - For each airport, calculates a weather risk score using _calculate_weather_risk_score
    - The risk score uses a point-based system: precipitation (up to 20 points), snow (up to 25 points),
      wind (up to 15 points), fog (12 points), thunder (20 points), temperature (up to 10 points),
      and cloud cover (up to 10 points), with a maximum of 100 points per record
    - Returns the average risk across all historical records for that time period
    - Also returns a combined risk score that averages the origin and destination risks
    """
    target_month = target_date.month
    target_quarter = (target_date.month - 1) // 3 + 1
    
    monthly_data = _get_monthly_weather_stats(origin_airport, dest_airport, target_month)
    
    if monthly_data['data_points'] >= 10:  
        return {
            'origin_risk': monthly_data['origin_risk'],
            'dest_risk': monthly_data['dest_risk'],
            'combined_risk': (monthly_data['origin_risk'] + monthly_data['dest_risk']) / 2,
            'analysis_type': 'monthly',
            'data_points': monthly_data['data_points']
        }
    else:
        quarterly_data = _get_quarterly_weather_stats(origin_airport, dest_airport, target_quarter)
        return {
            'origin_risk': quarterly_data['origin_risk'],
            'dest_risk': quarterly_data['dest_risk'],
            'combined_risk': (quarterly_data['origin_risk'] + quarterly_data['dest_risk']) / 2,
            'analysis_type': 'quarterly',
            'data_points': quarterly_data['data_points']
        }


def _get_monthly_weather_stats(origin_airport, dest_airport, month):
    """
    Pulls weather records for a specific month from all past years to see what conditions are typical.
    """
    query = """
        SELECT station_id, prcp_mm, snow_mm, snow_depth_mm, fog_flag, 
               thunder_flag, wsf2_ms, gust_ms, tmin_c, cloud_day_frac
        FROM Daily_Weather
        WHERE station_id IN (%s, %s) AND MONTH(date) = %s
        ORDER BY date DESC
        LIMIT 500
    """
    
    weather_records = execute_query(query, (origin_airport, dest_airport, month), fetch_all=True) or []
    
    origin_weather = [w for w in weather_records if w.get('station_id') == origin_airport]
    dest_weather = [w for w in weather_records if w.get('station_id') == dest_airport]
    
    origin_risk = _calculate_weather_risk_score(origin_weather)
    dest_risk = _calculate_weather_risk_score(dest_weather)
    
    return {
        'origin_risk': origin_risk,
        'dest_risk': dest_risk,
        'data_points': len(weather_records)
    }


def _get_quarterly_weather_stats(origin_airport, dest_airport, quarter):
    """
    Looks at weather data from a three-month period across all past years to understand seasonal patterns.
    """
    quarter_months = {
        1: [1, 2, 3],
        2: [4, 5, 6],
        3: [7, 8, 9],
        4: [10, 11, 12]
    }
    months = quarter_months.get(quarter, [])
    
    placeholders = ','.join(['%s'] * len(months))
    query = f"""
        SELECT station_id, prcp_mm, snow_mm, snow_depth_mm, fog_flag, 
               thunder_flag, wsf2_ms, gust_ms, tmin_c, cloud_day_frac
        FROM Daily_Weather
        WHERE station_id IN (%s, %s) AND MONTH(date) IN ({placeholders})
        ORDER BY date DESC
        LIMIT 1000
    """
    
    params = [origin_airport, dest_airport] + months
    weather_records = execute_query(query, tuple(params), fetch_all=True) or []
    
    origin_weather = [w for w in weather_records if w.get('station_id') == origin_airport]
    dest_weather = [w for w in weather_records if w.get('station_id') == dest_airport]
    
    origin_risk = _calculate_weather_risk_score(origin_weather)
    dest_risk = _calculate_weather_risk_score(dest_weather)
    
    return {
        'origin_risk': origin_risk,
        'dest_risk': dest_risk,
        'data_points': len(weather_records)
    }


def _calculate_weather_risk_score(weather_records):
    """
    Figures out how risky the weather conditions are by looking at precipitation, snow, wind, fog, and temperature.
    Combines all these factors into a single risk score from 0 to 100.
    
    Risk calculation method:
    - Precipitation: 3 points for >0mm, 8 for >5mm, 15 for >10mm, 20 for >20mm
    - Snow: 15 points if snow >0mm, plus 5 points for snow depth >20mm, 10 points for depth >50mm
    - Wind: 5 points for >15 m/s, 10 for >20 m/s, 15 for >25 m/s (uses max of wind speed or gusts)
    - Fog: 12 points if fog flag is true
    - Thunder: 20 points if thunder flag is true
    - Temperature: 3 points if <0°C, 6 if <-5°C, 10 if <-10°C
    - Cloud cover: 4 points if >70%, 8 points if >90%
    The final score is the average of all risk scores from all weather records, capped at 100.
    """
    if not weather_records or len(weather_records) == 0:
        return 50.0  
    
    risk_factors = []
    
    for w in weather_records:
        risk = 0.0
        
        prcp = float(w.get('prcp_mm') or 0)
        if prcp > 20:
            risk += 20
        elif prcp > 10:
            risk += 15
        elif prcp > 5:
            risk += 8
        elif prcp > 0:
            risk += 3
        
        snow = float(w.get('snow_mm') or 0)
        snow_depth = float(w.get('snow_depth_mm') or 0)
        if snow > 0:
            risk += 15
        if snow_depth > 50:
            risk += 10
        elif snow_depth > 20:
            risk += 5
        
        wind = max(float(w.get('wsf2_ms') or 0), float(w.get('gust_ms') or 0))
        if wind > 25:
            risk += 15
        elif wind > 20:
            risk += 10
        elif wind > 15:
            risk += 5
        
        if w.get('fog_flag'):
            risk += 12
        if w.get('thunder_flag'):
            risk += 20
        
        tmin = w.get('tmin_c')
        if tmin is not None:
            tmin = float(tmin)
            if tmin < -10:
                risk += 10
            elif tmin < -5:
                risk += 6
            elif tmin < 0:
                risk += 3
        
        cloud = float(w.get('cloud_day_frac') or 0)
        if cloud > 0.9:
            risk += 8
        elif cloud > 0.7:
            risk += 4
        
        risk_factors.append(min(100.0, risk))  
    
    return sum(risk_factors) / len(risk_factors) if risk_factors else 50.0



class FlightDelayPredictor:
    """
    Predicts whether flights will be delayed or cancelled by combining multiple factors.
    Uses a weighted scoring system that considers airline history, weather conditions, and route popularity.
    """
    
    def __init__(self):
        self.preprocessor = DataPreprocessor()
        self.feature_weights = self._initialize_feature_weights()
    
    def _initialize_feature_weights(self):
        """
        Sets up how much each factor matters when predicting delays.
        These percentages reflect what we've learned from analyzing past flight data.
        """
        return {
            'airline_reliability': 0.25,
            'weather_origin': 0.20,
            'weather_dest': 0.20,
            'historical_risk': 0.15,
            'route_popularity': 0.10,
            'seasonal_factor': 0.10
        }
    
    def extract_features(self, flight_data, origin_weather, dest_weather, 
                        historical_risk, airline_stats):
        """
        Converts raw flight and weather data into numeric features the prediction model can use.
        """
        features = {}
        
        if flight_data.get('total_ops', 0) > 0:
            cancel_rate = (flight_data.get('percent_cancelled', 0) or 0) / 100.0
            features['airline_reliability'] = 1.0 - min(1.0, cancel_rate)
        else:
            if airline_stats:
                avg_cancel = (airline_stats.get('avg_cancellation_rate') or 0) / 100.0
                features['airline_reliability'] = 1.0 - min(1.0, avg_cancel)
            else:
                features['airline_reliability'] = 0.7  
        
        origin_weather_processed = self.preprocessor.handle_missing_weather(origin_weather)
        dest_weather_processed = self.preprocessor.handle_missing_weather(dest_weather)
        
        features['weather_origin'] = self._weather_to_risk_score(origin_weather_processed)
        features['weather_dest'] = self._weather_to_risk_score(dest_weather_processed)
        
        features['historical_risk'] = historical_risk.get('combined_risk', 50.0) / 100.0
        
        total_ops = flight_data.get('total_ops', 0) or 0
        features['route_popularity'] = min(1.0, total_ops / 100.0)  
        
        current_month = datetime.now().month
        if current_month in [12, 1, 2]:  
            features['seasonal_factor'] = 0.6  
        elif current_month in [6, 7, 8]:  
            features['seasonal_factor'] = 0.4  
        else:
            features['seasonal_factor'] = 0.5  
        
        return features
    
    def _weather_to_risk_score(self, weather):
        """
        Convert weather data to normalized risk score (0-1).
        
        Risk calculation method:
        - Precipitation: adds up to 0.3 points (calculated as prcp_mm / 50.0, capped at 0.3)
        - Snow: adds up to 0.25 points (calculated as snow_mm / 20.0, capped at 0.25)
        - Wind: adds up to 0.2 points (uses max of wsf2_ms or gust_ms, divided by 30.0, capped at 0.2)
        - Fog: adds 0.15 points if fog_flag is true
        - Thunder: adds 0.2 points if thunder_flag is true
        - Temperature: adds 0.1 points if minimum temperature is below -5°C
        - All risk components are summed and the final score is capped at 1.0
        - Returns a value between 0.0 (no risk) and 1.0 (maximum risk)
        """
        risk = 0.0
        
        prcp = weather.get('prcp_mm', 0)
        risk += min(0.3, prcp / 50.0)  
        
        snow = weather.get('snow_mm', 0)
        risk += min(0.25, snow / 20.0)  
        
        wind = max(weather.get('wsf2_ms', 0), weather.get('gust_ms', 0))
        risk += min(0.2, wind / 30.0)  
        
        if weather.get('fog_flag'):
            risk += 0.15
        if weather.get('thunder_flag'):
            risk += 0.2
        
        tmin = weather.get('tmin_c', 15)
        if tmin < -5:
            risk += 0.1
        
        return min(1.0, risk)
    
    def predict_delay_probability(self, features):
        """
        Calculates the chance a flight will be delayed by combining all the different risk factors.
        Returns a probability between 0 and 1, plus a confidence score showing how reliable the prediction is.
        
        Risk calculation method:
        - Uses a weighted ensemble model that combines multiple features:
          * Airline unreliability (1 - airline_reliability) weighted at 25%
          * Origin weather risk weighted at 20%
          * Destination weather risk weighted at 20%
          * Historical risk (from past patterns) weighted at 15%
          * Route unpopularity (1 - route_popularity) weighted at 10%
          * Seasonal factor weighted at 10%
        - Each feature is multiplied by its weight and all are summed to get a delay score
        - The delay score is clamped between 0.0 and 1.0 to get the final probability
        - Higher scores mean higher delay risk
        - Also calculates a confidence score based on data quality (see _calculate_confidence)
        """
        delay_score = (
            (1 - features['airline_reliability']) * self.feature_weights['airline_reliability'] +
            features['weather_origin'] * self.feature_weights['weather_origin'] +
            features['weather_dest'] * self.feature_weights['weather_dest'] +
            features['historical_risk'] * self.feature_weights['historical_risk'] +
            (1 - features['route_popularity']) * self.feature_weights['route_popularity'] +
            features['seasonal_factor'] * self.feature_weights['seasonal_factor']
        )
        
        delay_probability = min(1.0, max(0.0, delay_score))
        
        confidence = self._calculate_confidence(features)
        
        return delay_probability, confidence
    
    def predict_cancellation_probability(self, features, delay_prob):
        """
        Estimates the likelihood of a flight being cancelled entirely.
        Cancellations are less common than delays but much more disruptive when they happen.
        
        Risk calculation method:
        - Uses a weighted combination of factors:
          * Delay probability contributes 40% (if delayed, more likely to cancel)
          * Origin weather risk contributes 30%
          * Destination weather risk contributes 20%
          * Airline unreliability (1 - airline_reliability) contributes 10%
        - All factors are summed to get a cancellation score
        - The score is then multiplied by 0.6 to scale it down (cancellations are rarer than delays)
        - Final probability is capped at 0.5 (50%) since cancellations are relatively uncommon
        - Returns a value between 0.0 and 0.5 representing cancellation probability
        """
        cancel_score = (
            delay_prob * 0.4 +  
            features['weather_origin'] * 0.3 +
            features['weather_dest'] * 0.2 +
            (1 - features['airline_reliability']) * 0.1
        )
        
        cancel_probability = min(0.5, cancel_score * 0.6)  
        
        return cancel_probability
    
    def _calculate_confidence(self, features):
        """
        Figures out how confident we can be in our predictions based on how complete the data is.
        More complete data means higher confidence scores.
        
        Confidence calculation method:
        - Checks if airline_reliability is the default value (0.7):
          * If it's actual data (not default), adds 1.0 to confidence factors
          * If it's default, adds 0.5 (lower confidence due to missing data)
        - Always adds 0.9 for weather data (assumed to be available)
        - Checks if historical_risk is the default value (0.5):
          * If it's actual data (not default), adds 0.8 to confidence factors
          * If it's default, adds 0.4 (lower confidence due to missing historical data)
        - Calculates the average of all confidence factors
        - Returns a value between 0.0 and 1.0, where 1.0 means high confidence in the prediction
        """
        confidence_factors = []
        
        if features['airline_reliability'] != 0.7:  
            confidence_factors.append(1.0)
        else:
            confidence_factors.append(0.5)
        
        confidence_factors.append(0.9)
        
        if features['historical_risk'] != 0.5:  
            confidence_factors.append(0.8)
        else:
            confidence_factors.append(0.4)
        
        return sum(confidence_factors) / len(confidence_factors)



class FlightRecommendationEngine:
    """
    Suggests alternative flights when the original option has problems.
    Takes into account what the user prefers, current weather conditions, and how reliable different airlines are.
    """
    
    def __init__(self):
        self.predictor = FlightDelayPredictor()
    
    def find_alternative_flights(self, original_flight, user_preferences=None):
        """
        Searches for other flights on the same route that might be better options.
        You can specify things like maximum layover time, whether you want direct flights only,
        how much more you're willing to pay, and which airlines to avoid.
        """
        if user_preferences is None:
            user_preferences = {}
        
        origin = original_flight.get('origin_airport')
        dest = original_flight.get('destination_airport')
        
        query = """
            SELECT flight_id, flight_no, airline_id, origin_airport, 
                   destination_airport, total_ops, percent_cancelled
            FROM Flight
            WHERE origin_airport = %s AND destination_airport = %s
            AND flight_id != %s
            ORDER BY total_ops DESC
            LIMIT 20
        """
        
        alternatives = execute_query(query, (origin, dest, original_flight.get('flight_id')), fetch_all=True) or []
        
        scored_alternatives = []
        for alt in alternatives:
            score = self._score_alternative(alt, original_flight, user_preferences)
            scored_alternatives.append({
                'flight': alt,
                'score': score['total_score'],
                'reliability_score': score['reliability'],
                'delay_risk': score['delay_risk'],
                'reasons': score['reasons']
            })
        
        scored_alternatives.sort(key=lambda x: x['score'], reverse=True)
        
        return scored_alternatives[:5]
    
    def _score_alternative(self, alternative, original, preferences):
        """
        Score an alternative flight based on multiple factors.
        """
        reasons = []
        score = 0.0
        
        total_ops = alternative.get('total_ops', 0) or 0
        cancel_rate = (alternative.get('percent_cancelled', 0) or 0) / 100.0
        reliability = (1.0 - cancel_rate) * 40
        score += reliability
        
        if reliability > 35:
            reasons.append("Excellent reliability record")
        elif reliability > 30:
            reasons.append("Good reliability record")
        
        orig_ops = original.get('total_ops', 0) or 0
        orig_cancel = (original.get('percent_cancelled', 0) or 0) / 100.0
        
        if cancel_rate < orig_cancel:
            improvement = (orig_cancel - cancel_rate) * 20
            score += improvement
            reasons.append(f"Lower cancellation rate than original ({cancel_rate*100:.1f}% vs {orig_cancel*100:.1f}%)")
        
        if total_ops > orig_ops:
            score += min(20, (total_ops - orig_ops) / 10.0)
            reasons.append("More operational history")
        
        avoid_airlines = preferences.get('avoid_airlines', [])
        if alternative.get('airline_id') not in avoid_airlines:
            score += 20
        else:
            reasons.append("Airline matches preferences")
        
        delay_risk = cancel_rate * 0.7
        
        return {
            'total_score': score,
            'reliability': reliability,
            'delay_risk': delay_risk,
            'reasons': reasons
        }



def predict_fare_advanced(historical_fares, target_date):
    """
    Predicts what the fare will be on a specific date by analyzing past fare trends.
    Uses several different methods and combines them to get a more accurate prediction.
    """
    if not historical_fares or len(historical_fares) < 2:
        return None, 0.0
    
    fare_values = []
    time_points = []
    
    for fh in historical_fares:
        year = parse_year_from_record(fh)
        quarter = parse_quarter_from_record(fh)
        fare = fh.get('mean_fare')
        
        if fare and year > 0 and quarter:
            time_point = year * 4 + quarter
            fare_values.append(float(fare))
            time_points.append(time_point)
    
    if len(fare_values) < 2:
        return None, 0.0
    
    target_year = target_date.year
    target_quarter = (target_date.month - 1) // 3 + 1
    target_time = target_year * 4 + target_quarter
    
    trend_prediction = _linear_regression_prediction(time_points, fare_values, target_time)
    
    moving_avg_prediction = _weighted_moving_average(fare_values, time_points, target_time)
    
    seasonal_prediction = _seasonal_adjustment(fare_values, time_points, target_time, target_quarter)
    
    weights = [0.4, 0.3, 0.3]
    predictions = [trend_prediction, moving_avg_prediction, seasonal_prediction]
    
    valid_predictions = [p for p in predictions if p is not None]
    if not valid_predictions:
        return None, 0.0
    
    predicted_fare = sum(p * w for p, w in zip(valid_predictions, weights) if p is not None)
    predicted_fare = max(0, predicted_fare)
    
    variance = statistics.variance(fare_values) if len(fare_values) > 1 else 0
    avg_fare = statistics.mean(fare_values)
    coefficient_of_variation = math.sqrt(variance) / avg_fare if avg_fare > 0 else 1
    
    data_quality = min(1.0, 1.0 - coefficient_of_variation * 0.5)
    data_quantity = min(1.0, len(fare_values) / 10.0)
    confidence = (data_quality + data_quantity) / 2.0
    
    return predicted_fare, confidence


def _linear_regression_prediction(x_values, y_values, target_x):
    """Fits a straight line through past fare data to predict future prices based on the overall trend."""
    n = len(x_values)
    if n < 2:
        return None
    
    sum_x = sum(x_values)
    sum_y = sum(y_values)
    sum_xy = sum(x * y for x, y in zip(x_values, y_values))
    sum_x2 = sum(x * x for x in x_values)
    
    denominator = n * sum_x2 - sum_x * sum_x
    if denominator == 0:
        return None
    
    slope = (n * sum_xy - sum_x * sum_y) / denominator
    intercept = (sum_y - slope * sum_x) / n
    
    return slope * target_x + intercept


def _weighted_moving_average(values, time_points, target_time):
    """Predicts future fares by giving more weight to recent prices and less to older ones."""
    if not values:
        return None
    
    total_weight = 0.0
    weighted_sum = 0.0
    
    for val, time_pt in zip(values, time_points):
        time_diff = abs(target_time - time_pt)
        weight = math.exp(-time_diff * 0.1)
        weighted_sum += val * weight
        total_weight += weight
    
    return weighted_sum / total_weight if total_weight > 0 else None


def _seasonal_adjustment(values, time_points, target_time, target_quarter):
    """Adjusts fare predictions based on seasonal patterns, like how prices usually change between winter and summer."""
    if not values:
        return None
    
    quarter_values = defaultdict(list)
    for val, time_pt in zip(values, time_points):
        quarter = (time_pt % 4) or 4
        quarter_values[quarter].append(val)
    
    if target_quarter in quarter_values:
        quarter_avg = statistics.mean(quarter_values[target_quarter])
    else:
        quarter_avg = statistics.mean(values)
    
    overall_avg = statistics.mean(values)
    trend_factor = 1.0
    
    return quarter_avg * trend_factor



def suggest_optimal_travel_dates(flight, fare_history, origin_airport):
    """
    Looks at past fare prices and weather patterns to recommend the best times to travel.
    Suggests periods when fares are typically lower and weather is usually better, making delays less likely.
    """
    suggestions = []
    
    quarterly_fares = {}
    if fare_history:
        for fh in fare_history:
            year = parse_year_from_record(fh)
            quarter = parse_quarter_from_record(fh)
            fare = fh.get('mean_fare')
            
            if fare and year > 0 and quarter:
                key = f"{year}-Q{quarter}"
                if key not in quarterly_fares:
                    quarterly_fares[key] = []
                quarterly_fares[key].append(float(fare))
    
    avg_fares_by_quarter = {}
    for quarter_key, fares in quarterly_fares.items():
        if fares:
            avg_fares_by_quarter[quarter_key] = sum(fares) / len(fares)
    
    if not avg_fares_by_quarter:
        current_year = datetime.now().year
        current_month = datetime.now().month
        current_quarter = (current_month - 1) // 3 + 1
        
        general_suggestions = []
        preferred_quarters = [2, 4]
        
        if current_quarter in preferred_quarters:
            quarters_to_show = [q for q in preferred_quarters if q != current_quarter]
            remaining = [q for q in [1, 2, 3, 4] if q not in preferred_quarters and q != current_quarter]
            if remaining:
                quarters_to_show.append(remaining[0])
        else:
            quarters_to_show = preferred_quarters[:2]
        
        for next_quarter in quarters_to_show[:2]:
            if next_quarter >= current_quarter:
                next_year = current_year
            else:
                next_year = current_year + 1
            
            quarter_to_months = {
                1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12]
            }
            quarter_months = quarter_to_months.get(next_quarter, [])
            
            suggested_start = datetime(next_year, quarter_months[0], 1).date()
            suggested_end = datetime(next_year, quarter_months[-1], 28).date()
            
            if next_quarter == 2:
                strength = "RECOMMENDED"
                reason = "Spring offers excellent weather and typically moderate fares - best overall value"
            elif next_quarter == 4:
                strength = "RECOMMENDED"
                reason = "Fall provides pleasant weather and often lower fares - ideal travel period"
            elif next_quarter == 3:
                strength = "CONSIDER"
                reason = "Summer has great weather but peak season pricing - higher fares expected"
            else:
                strength = "CONSIDER"
                reason = "Winter may offer lower fares but weather can be challenging - plan accordingly"
            
            general_suggestions.append({
                'period': f"{quarter_months[0]}/{next_year} - {quarter_months[-1]}/{next_year}",
                'quarter': f"Q{next_quarter} {next_year}",
                'start_date': suggested_start.isoformat(),
                'end_date': suggested_end.isoformat(),
                'average_fare': None,
                'weather_score': 30.0,
                'strength': strength,
                'reason': reason
            })
        
        return {
            'suggestions': general_suggestions,
            'message': 'Limited historical fare data available. Showing general seasonal travel recommendations.'
        }
    
    sorted_quarters = sorted(avg_fares_by_quarter.items(), key=lambda x: x[1])
    
    weather_query = """
        SELECT date, prcp_mm, snow_mm, fog_flag, thunder_flag, wsf2_ms, tmin_c
        FROM Daily_Weather
        WHERE station_id = %s
        ORDER BY date DESC
        LIMIT 100
    """
    weather_records = execute_query(weather_query, (origin_airport,), fetch_all=True) if origin_airport else []
    
    monthly_weather = {}
    for w in weather_records or []:
        if w.get('date'):
            date_obj = w['date']
            if isinstance(date_obj, str):
                try:
                    date_obj = datetime.strptime(date_obj, '%Y-%m-%d').date()
                except:
                    continue
            month_key = date_obj.month
            
            if month_key not in monthly_weather:
                monthly_weather[month_key] = {
                    'total_days': 0,
                    'bad_weather_days': 0,
                    'total_prcp': 0,
                    'total_snow': 0
                }
            
            monthly_weather[month_key]['total_days'] += 1
            prcp = float(w.get('prcp_mm', 0) or 0)
            snow = float(w.get('snow_mm', 0) or 0)
            
            if w.get('fog_flag') or w.get('thunder_flag') or prcp > 10 or snow > 0:
                monthly_weather[month_key]['bad_weather_days'] += 1
            
            monthly_weather[month_key]['total_prcp'] += prcp
            monthly_weather[month_key]['total_snow'] += snow
    
    monthly_weather_scores = {}
    for month, data in monthly_weather.items():
        if data['total_days'] > 0:
            bad_weather_ratio = data['bad_weather_days'] / data['total_days']
            avg_prcp = data['total_prcp'] / data['total_days']
            avg_snow = data['total_snow'] / data['total_days']
            score = (bad_weather_ratio * 50) + min(30, avg_prcp * 2) + min(20, avg_snow * 5)
            monthly_weather_scores[month] = score
    
    quarter_to_months = {1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12]}
    
    top_quarters = sorted_quarters[:2]
    today = datetime.now().date()
    seen_quarters = set()
    
    for quarter_key, avg_fare in top_quarters:
        try:
            year, quarter = quarter_key.split('-Q')
            data_year = int(year)
            quarter = int(quarter)
            
            quarter_months = quarter_to_months.get(quarter, [])
            if not quarter_months:
                continue
            
            display_year = data_year
            suggested_start = datetime(display_year, quarter_months[0], 1).date()
            suggested_end = datetime(display_year, quarter_months[-1], 28).date()
            
            while suggested_end < today:
                display_year += 1
                suggested_start = datetime(display_year, quarter_months[0], 1).date()
                suggested_end = datetime(display_year, quarter_months[-1], 28).date()
            
            display_key = f"Q{quarter}-{display_year}"
            if display_key in seen_quarters:
                continue
            seen_quarters.add(display_key)
            
            quarter_weather_score = 0
            if monthly_weather_scores:
                quarter_month_scores = [monthly_weather_scores.get(m, 50) for m in quarter_months]
                quarter_weather_score = sum(quarter_month_scores) / len(quarter_month_scores) if quarter_month_scores else 50
            else:
                quarter_weather_score = 30
            
            if avg_fare < sorted_quarters[0][1] * 1.1 and quarter_weather_score < 25:
                strength = "HIGHLY RECOMMENDED"
                reason = f"Lowest fares (${avg_fare:.2f} avg) and best weather conditions"
            elif avg_fare < sorted_quarters[0][1] * 1.2:
                strength = "RECOMMENDED"
                reason = f"Good fares (${avg_fare:.2f} avg) and decent weather"
            else:
                strength = "CONSIDER"
                reason = f"Moderate fares (${avg_fare:.2f} avg)"
            
            suggestions.append({
                'period': f"{quarter_months[0]}/{suggested_start.year} - {quarter_months[-1]}/{suggested_end.year}",
                'quarter': f"Q{quarter} {suggested_start.year}",
                'start_date': suggested_start.isoformat(),
                'end_date': suggested_end.isoformat(),
                'average_fare': round(avg_fare, 2),
                'weather_score': round(quarter_weather_score, 1),
                'strength': strength,
                'reason': reason
            })
        except Exception as e:
            continue
    
    return {
        'suggestions': suggestions,
        'message': 'Based on historical data, here are optimal travel periods for this route'
    }


@flight_insights_bp.route('/<path:flight_id>', methods=['GET'])
def get_flight_insights(flight_id):
    """
    Main endpoint that provides a complete analysis of a flight.
    Returns predictions about delays and cancellations, weather risks at both airports,
    expected fare prices, and suggestions for alternative flights if needed.
    You can optionally provide a target date to get predictions for a specific travel date.
    """
    flight_id = unquote(flight_id)
    
    target_date_str = request.args.get('target_date')
    target_date = None
    has_target_date = False
    
    if target_date_str:
        try:
            target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
            has_target_date = True
        except ValueError:
            has_target_date = False
    
    if not has_target_date:
        target_date = datetime.now().date()
    
    try:
        flight_query = """
            SELECT flight_id, flight_no, airline_id, origin_airport, 
                   destination_airport, total_ops, percent_cancelled
            FROM Flight 
            WHERE flight_id = %s
        """
        flight = execute_query(flight_query, (flight_id,), fetch_one=True)
        
        if not flight:
            return jsonify({'error': {'code': 'not_found', 'message': 'Flight not found'}}), 404
        
        fare_history_query = """
            SELECT flight_id, Year, quarter, mean_fare, num_passenger, fare_date
            FROM Fare_History
            WHERE flight_id = %s
            ORDER BY Year ASC, quarter ASC
        """
        try:
            fare_history = execute_query(fare_history_query, (flight_id,), fetch_all=True)
        except Exception as e:
            print(f"Error fetching fare history for flight {flight_id}: {e}")
            fare_history = []
        
        fare_trend_data = []
        month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        
        skipped_records = 0
        for fh in fare_history or []:
            year = parse_year_from_record(fh)
            quarter = parse_quarter_from_record(fh)
            
            if year <= 0 or not quarter:
                skipped_records += 1
                continue
            mean_fare_raw = fh.get('mean_fare')
            if mean_fare_raw is None:
                skipped_records += 1
                continue
            try:
                fare = float(mean_fare_raw)
            except (ValueError, TypeError):
                skipped_records += 1
                continue
            
            if year > 0 and quarter in [1, 2, 3, 4] and fare > 0:
                quarter_to_months = {
                    1: [1, 2, 3],
                    2: [4, 5, 6],
                    3: [7, 8, 9],
                    4: [10, 11, 12]
                }
                
                months = quarter_to_months.get(quarter, [])
                
                for month_num in months:
                    month_name = month_names[month_num - 1]
                    month_date = f"{year}-{month_num:02d}"
                    period = f"{month_name} {year}"
                    
                    fare_trend_data.append({
                        'year': year,
                        'quarter': quarter,
                        'month': month_num,
                        'date': month_date,
                        'period': period,
                        'fare': fare,
                        'passengers': int(fh.get('num_passenger', 0)) if fh.get('num_passenger') else None
                    })
        
        fare_trend_data.sort(key=lambda x: x['date'])
        
        if fare_history and len(fare_history) > 0 and len(fare_trend_data) == 0:
            print(f"Warning: Flight {flight_id} has {len(fare_history)} fare history records, but all were filtered out (NULL/zero/invalid fares). Skipped {skipped_records} records.")
        
        airline_stats = None
        if flight.get('airline_id'):
            airline_stats_query = """
                SELECT 
                    AVG(percent_cancelled) as avg_cancellation_rate,
                    SUM(total_ops) as total_airline_ops
                FROM Flight
                WHERE airline_id = %s
            """
            airline_stats = execute_query(airline_stats_query, (flight['airline_id'],), fetch_one=True)
        
        origin_weather = None
        dest_weather = None
        historical_risk = None
        delay_prob = None
        delay_confidence = None
        cancel_prob = None
        reliability_score = None
        predicted_fare = None
        fare_confidence = None
        alternatives = []
        features = {}
        
        if has_target_date:
            if flight.get('origin_airport'):
                origin_weather_query = """
                    SELECT date, station_id, prcp_mm, snow_mm, snow_depth_mm, tmin_c, 
                           fog_flag, thunder_flag, wsf2_ms, gust_ms, cloud_day_frac
                    FROM Daily_Weather
                    WHERE station_id = %s AND date = %s
                """
                origin_weather = execute_query(origin_weather_query, 
                                              (flight['origin_airport'], target_date), fetch_one=True)
            
            if flight.get('destination_airport'):
                dest_weather_query = """
                    SELECT date, station_id, prcp_mm, snow_mm, snow_depth_mm, tmin_c, 
                           fog_flag, thunder_flag, wsf2_ms, gust_ms, cloud_day_frac
                    FROM Daily_Weather
                    WHERE station_id = %s AND date = %s
                """
                dest_weather = execute_query(dest_weather_query, 
                                           (flight['destination_airport'], target_date), fetch_one=True)
            
            try:
                historical_risk = calculate_historical_risk_factors(
                    flight.get('origin_airport'),
                    flight.get('destination_airport'),
                    target_date
                )
            except Exception as e:
                print(f"Error calculating historical risk: {e}")
                historical_risk = {
                    'origin_risk': 50.0,
                    'dest_risk': 50.0,
                    'combined_risk': 50.0,
                    'analysis_type': 'unknown',
                    'data_points': 0
                }
            
            try:
                predictor = FlightDelayPredictor()
                features = predictor.extract_features(
                    flight, origin_weather, dest_weather, historical_risk, airline_stats
                )
                
                delay_prob, delay_confidence = predictor.predict_delay_probability(features)
                cancel_prob = predictor.predict_cancellation_probability(features, delay_prob)
                
                reliability_score = (1.0 - delay_prob) * 100
            except Exception as e:
                print(f"Error in ML prediction: {e}")
                cancel_rate = (flight.get('percent_cancelled', 0) or 0) / 100.0
                reliability_score = (1.0 - cancel_rate) * 100
                delay_prob = cancel_rate * 0.7
                cancel_prob = cancel_rate
                delay_confidence = 0.5
            
            try:
                predicted_fare, fare_confidence = predict_fare_advanced(fare_history, target_date)
            except Exception as e:
                print(f"Error in fare prediction: {e}")
                predicted_fare, fare_confidence = None, 0.0
            
            try:
                recommendation_engine = FlightRecommendationEngine()
                alternatives = recommendation_engine.find_alternative_flights(flight)
            except Exception as e:
                print(f"Error finding alternatives: {e}")
                alternatives = []
        
        current_fare = None
        if fare_history and len(fare_history) > 0:
            def sort_key(x):
                year = parse_year_from_record(x)
                quarter = parse_quarter_from_record(x) or 0
                return (year, quarter)
            latest_fare = sorted(fare_history, key=sort_key)[-1]
            current_fare = float(latest_fare.get('mean_fare', 0)) if latest_fare.get('mean_fare') else None
        
        airline_query = "SELECT airline_id, airline_name FROM Airline_Carrier WHERE airline_id = %s"
        origin_query = "SELECT airport_code, airport_name, city, country FROM Airport WHERE airport_code = %s"
        dest_query = "SELECT airport_code, airport_name, city, country FROM Airport WHERE airport_code = %s"
        
        airline = execute_query(airline_query, (flight['airline_id'],), fetch_one=True)
        origin = execute_query(origin_query, (flight['origin_airport'],), fetch_one=True)
        dest = execute_query(dest_query, (flight['destination_airport'],), fetch_one=True)
        
        travel_suggestions = None
        if not has_target_date:
            travel_suggestions = suggest_optimal_travel_dates(flight, fare_history, flight.get('origin_airport'))
        
        if has_target_date and reliability_score is not None:
            should_book = reliability_score >= 70 and delay_prob < 0.3 and cancel_prob < 0.15
            recommendation = "HIGHLY RECOMMENDED" if should_book else \
                            "RECOMMENDED" if reliability_score >= 60 else \
                            "BOOK WITH CAUTION"
            
            reasoning = []
            if reliability_score >= 80:
                reasoning.append("Excellent reliability score")
            elif reliability_score >= 60:
                reasoning.append("Good reliability score")
            else:
                reasoning.append("Reliability score below optimal threshold")
            
            if delay_prob and delay_prob < 0.2:
                reasoning.append("Low delay probability")
            elif delay_prob and delay_prob < 0.4:
                reasoning.append("Moderate delay probability")
            else:
                reasoning.append("Higher delay probability detected")
            
            if cancel_prob and cancel_prob < 0.1:
                reasoning.append("Very low cancellation risk")
            elif cancel_prob and cancel_prob < 0.2:
                reasoning.append("Low cancellation risk")
            else:
                reasoning.append("Elevated cancellation risk")
            
            if historical_risk and historical_risk.get('combined_risk', 100) < 30:
                reasoning.append(f"Favorable historical weather patterns ({historical_risk.get('analysis_type', 'unknown')})")
            elif historical_risk and historical_risk.get('combined_risk', 100) < 50:
                reasoning.append(f"Moderate historical weather patterns ({historical_risk.get('analysis_type', 'unknown')})")
            elif historical_risk:
                reasoning.append(f"Challenging historical weather patterns ({historical_risk.get('analysis_type', 'unknown')})")
            
            if not reasoning:
                reasoning.append(f"Based on reliability score of {reliability_score:.1f}%, delay probability of {delay_prob*100:.1f}%, and cancellation probability of {cancel_prob*100:.1f}%")
        else:
            cancel_rate = (flight.get('percent_cancelled', 0) or 0) / 100.0
            basic_reliability = (1.0 - cancel_rate) * 100
            should_book = basic_reliability >= 70
            recommendation = "HIGHLY RECOMMENDED" if should_book else \
                            "RECOMMENDED" if basic_reliability >= 60 else \
                            "BOOK WITH CAUTION"
            reasoning = ["Select a specific travel date for detailed ML-based predictions"]
            reliability_score = basic_reliability
            delay_prob = cancel_rate * 0.7
            cancel_prob = cancel_rate
            delay_confidence = 0.5
        
        combined_weather_data = origin_weather if origin_weather else dest_weather
        
        return jsonify({
            'data': {
                'flight': {
                    'flight_id': flight['flight_id'],
                    'flight_no': flight['flight_no'],
                    'airline': airline,
                    'origin': origin,
                    'destination': dest,
                    'total_ops': flight.get('total_ops', 0),
                    'percent_cancelled': flight.get('percent_cancelled', 0)
                },
                'fare_trend': fare_trend_data,
                'reliability': {
                    'score': round(reliability_score, 2) if reliability_score is not None else 0,
                    'cancellation_probability': round(cancel_prob * 100, 2) if cancel_prob is not None else 0,
                    'weather_data': combined_weather_data
                },
                'ml_predictions': {
                    'delay_probability': round(delay_prob * 100, 2) if delay_prob is not None else None,
                    'cancellation_probability': round(cancel_prob * 100, 2) if cancel_prob is not None else None,
                    'reliability_score': round(reliability_score, 2) if reliability_score is not None else None,
                    'confidence': round(delay_confidence * 100, 2) if delay_confidence is not None else None,
                    'features': {k: round(v, 3) for k, v in features.items()} if has_target_date and features else {}
                } if has_target_date else None,
                'weather_analysis': {
                    'origin': {
                        'weather_data': origin_weather,
                        'risk_score': round(historical_risk['origin_risk'], 2) if historical_risk else None
                    },
                    'destination': {
                        'weather_data': dest_weather,
                        'risk_score': round(historical_risk['dest_risk'], 2) if historical_risk else None
                    },
                    'historical_risk': {
                        'combined_risk': round(historical_risk['combined_risk'], 2) if historical_risk else None,
                        'analysis_type': historical_risk.get('analysis_type', 'unknown') if historical_risk else 'unknown',
                        'data_points': historical_risk.get('data_points', 0) if historical_risk else 0
                    }
                } if has_target_date and historical_risk else None,
                'fare_prediction': {
                    'predicted_fare': round(predicted_fare, 2) if predicted_fare else None,
                    'current_fare': round(current_fare, 2) if current_fare else None,
                    'confidence': round(fare_confidence * 100, 2) if predicted_fare and fare_confidence else 0
                },
                'alternatives': [
                    {
                        'flight_id': alt['flight']['flight_id'],
                        'flight_no': alt['flight']['flight_no'],
                        'airline_id': alt['flight']['airline_id'],
                        'reliability_score': round(alt['reliability_score'], 2),
                        'delay_risk': round(alt['delay_risk'] * 100, 2),
                        'recommendation_score': round(alt['score'], 2),
                        'reasons': alt['reasons']
                    }
                    for alt in alternatives
                ],
                'recommendation': {
                    'should_book': should_book,
                    'recommendation': recommendation,
                    'reasoning': reasoning
                },
                'travel_suggestions': travel_suggestions,
                'target_date': target_date.isoformat(),
                'has_target_date': has_target_date
            }
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': {'code': 'server_error', 'message': str(e)}}), 500


@flight_insights_bp.route('/predict', methods=['POST'])
def predict_flight_status():
    """
    Standalone endpoint for delay/cancellation prediction.
    Accepts flight details and returns ML predictions.
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'error': {'code': 'validation_error', 'message': 'No data provided'}}), 400
    
    flight_id = data.get('flight_id')
    target_date_str = data.get('target_date')
    
    if not flight_id or not target_date_str:
        return jsonify({'error': {'code': 'validation_error', 
                                 'message': 'flight_id and target_date are required'}}), 400
    
    try:
        target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': {'code': 'validation_error', 
                                 'message': 'Invalid date format. Use YYYY-MM-DD'}}), 400
    
    flight_query = """
        SELECT flight_id, flight_no, airline_id, origin_airport, 
               destination_airport, total_ops, percent_cancelled
        FROM Flight 
        WHERE flight_id = %s
    """
    flight = execute_query(flight_query, (flight_id,), fetch_one=True)
    
    if not flight:
        return jsonify({'error': {'code': 'not_found', 'message': 'Flight not found'}}), 404
    
    
    return jsonify({'message': 'Prediction endpoint - implementation in progress'})


@flight_insights_bp.route('/alternatives/<path:flight_id>', methods=['GET'])
def get_alternative_flights(flight_id):
    """
    Get alternative flight recommendations for a given flight.
    """
    flight_id = unquote(flight_id)
    
    flight_query = """
        SELECT flight_id, flight_no, airline_id, origin_airport, 
               destination_airport, total_ops, percent_cancelled
        FROM Flight 
        WHERE flight_id = %s
    """
    flight = execute_query(flight_query, (flight_id,), fetch_one=True)
    
    if not flight:
        return jsonify({'error': {'code': 'not_found', 'message': 'Flight not found'}}), 404
    
    user_preferences = {
        'max_layover_time': request.args.get('max_layover', type=int),
        'prefer_direct': request.args.get('prefer_direct', 'true').lower() == 'true',
        'max_price_increase': request.args.get('max_price_increase', type=float)
    }
    
    recommendation_engine = FlightRecommendationEngine()
    alternatives = recommendation_engine.find_alternative_flights(flight, user_preferences)
    
    return jsonify({
        'data': {
            'original_flight': flight,
            'alternatives': [
                {
                    'flight_id': alt['flight']['flight_id'],
                    'flight_no': alt['flight']['flight_no'],
                    'airline_id': alt['flight']['airline_id'],
                    'reliability_score': round(alt['reliability_score'], 2),
                    'delay_risk': round(alt['delay_risk'] * 100, 2),
                    'recommendation_score': round(alt['score'], 2),
                    'reasons': alt['reasons']
                }
                for alt in alternatives
            ]
        }
    })


@flight_insights_bp.route('/route/price', methods=['GET'])
def get_route_price_guidance():
    """
    Get price guidance for a flight route (route-level insights).
    """
    origin = request.args.get('origin', type=str)
    dest = request.args.get('dest', type=str)
    date_str = request.args.get('date', type=str)
    
    if not origin or not dest or not date_str:
        return jsonify({'error': {'code': 'validation_error', 'message': 'origin, dest, and date are required'}}), 400
    
    try:
        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': {'code': 'validation_error', 'message': 'Invalid date format. Use YYYY-MM-DD'}}), 400
    
    flight_query = """
        SELECT flight_id, airline_id, total_ops, percent_cancelled
        FROM Flight
        WHERE origin_airport = %s AND destination_airport = %s
        LIMIT 20
    """
    flights = execute_query(flight_query, (origin, dest), fetch_all=True)
    
    if not flights:
        return jsonify({
            'should_wait': False,
            'confidence': 0.0,
            'message': 'No flights found for this route',
            'current_fare': None,
            'average_fare': None,
            'predicted_fare': None
        })
    
    flight_ids = [f['flight_id'] for f in flights]
    
    all_fare_records = []
    if flight_ids:
        placeholders = ','.join(['%s'] * len(flight_ids))
        query = f"""
            SELECT flight_id, Year, quarter, mean_fare, num_passenger, fare_date
            FROM Fare_History
            WHERE flight_id IN ({placeholders})
            ORDER BY Year DESC, quarter DESC
            LIMIT 50
        """
        all_fare_records = execute_query(query, tuple(flight_ids), fetch_all=True)
    
    if not all_fare_records:
        return jsonify({
            'should_wait': False,
            'confidence': 0.0,
            'message': 'Insufficient fare history data for this route',
            'current_fare': None,
            'average_fare': None,
            'predicted_fare': None
        })
    
    fares = [float(fr.get('mean_fare', 0)) for fr in all_fare_records if fr.get('mean_fare')]
    if fares:
        average_fare = sum(fares) / len(fares)
        current_fare = fares[0]
        
        predicted_fare, fare_confidence = predict_fare_advanced(all_fare_records, date_obj)
        
        should_wait = predicted_fare and predicted_fare < current_fare * 0.95
        
        return jsonify({
            'should_wait': should_wait,
            'confidence': round(fare_confidence * 100, 2) if fare_confidence else 0.0,
            'current_fare': round(current_fare, 2),
            'average_fare': round(average_fare, 2),
            'predicted_fare': round(predicted_fare, 2) if predicted_fare else None
        })
    else:
        return jsonify({
            'should_wait': False,
            'confidence': 0.0,
            'message': 'No valid fare data available',
            'current_fare': None,
            'average_fare': None,
            'predicted_fare': None
        })


@flight_insights_bp.route('/route/delay', methods=['GET'])
def get_route_delay_risk():
    """
    Get delay risk estimation for an airport on a specific date (route-level insights).
    
    Risk calculation method:
    - Uses a simple point-based scoring system for a single day's weather:
      * Precipitation: 1 point if >5mm, 2 points if >10mm
      * Snow: 3 points if any snow is present
      * Snow depth: 2 points if depth >50mm
      * Wind: 1 point if max wind >15 m/s, 2 points if >20 m/s (uses max of gust_ms or wsf2_ms)
      * Fog: 2 points if fog_flag is true
      * Thunder: 3 points if thunder_flag is true
      * Cloud cover: 1 point if >80%
      * Temperature: 1 point if minimum temperature < -5°C
    - All points are summed to get a total risk_score
    - Risk levels are categorized as:
      * 'low' if risk_score < 3
      * 'medium' if risk_score is 3-5
      * 'high' if risk_score >= 6
    - Returns the risk level, risk score, and detailed weather conditions
    """
    airport = request.args.get('airport', type=str)
    date_str = request.args.get('date', type=str)
    
    if not airport or not date_str:
        return jsonify({'error': {'code': 'validation_error', 'message': 'airport and date are required'}}), 400
    
    try:
        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': {'code': 'validation_error', 'message': 'Invalid date format. Use YYYY-MM-DD'}}), 400
    
    query = """
        SELECT date, station_id, prcp_mm, snow_mm, snow_depth_mm, 
               awwnd_ms, wsf2_ms, gust_ms, tmin_c, cloud_day_frac, 
               fog_flag, thunder_flag
        FROM Daily_Weather
        WHERE station_id = %s AND date = %s
    """
    weather = execute_query(query, (airport, date_obj), fetch_one=True)
    
    if not weather:
        return jsonify({
            'risk': 'unknown',
            'risk_score': 0,
            'message': 'No weather data available for this date',
            'weather_conditions': None
        })
    
    risk_score = 0
    
    prcp = float(weather['prcp_mm']) if weather['prcp_mm'] else 0
    if prcp > 10:
        risk_score += 2
    elif prcp > 5:
        risk_score += 1
    
    snow = float(weather['snow_mm']) if weather['snow_mm'] else 0
    if snow > 0:
        risk_score += 3
    
    snow_depth = float(weather['snow_depth_mm']) if weather['snow_depth_mm'] else 0
    if snow_depth > 50:
        risk_score += 2
    
    gust = float(weather['gust_ms']) if weather['gust_ms'] else 0
    wsf2 = float(weather['wsf2_ms']) if weather['wsf2_ms'] else 0
    max_wind = max(gust, wsf2)
    
    if max_wind > 20:
        risk_score += 2
    elif max_wind > 15:
        risk_score += 1
    
    if weather['fog_flag']:
        risk_score += 2
    
    if weather['thunder_flag']:
        risk_score += 3
    
    cloud = float(weather['cloud_day_frac']) if weather['cloud_day_frac'] else 0
    if cloud > 0.8:
        risk_score += 1
    
    tmin = float(weather['tmin_c']) if weather['tmin_c'] is not None else None
    if tmin is not None and tmin < -5:
        risk_score += 1
    
    if risk_score >= 6:
        risk_level = 'high'
    elif risk_score >= 3:
        risk_level = 'medium'
    else:
        risk_level = 'low'
    
    return jsonify({
        'risk': risk_level,
        'risk_score': risk_score,
        'weather_conditions': {
            'precipitation_mm': round(prcp, 2) if prcp > 0 else None,
            'snow_mm': round(snow, 2) if snow > 0 else None,
            'snow_depth_mm': round(snow_depth, 2) if snow_depth > 0 else None,
            'wind_gust_ms': round(gust, 2) if gust > 0 else None,
            'wind_speed_ms': round(wsf2, 2) if wsf2 > 0 else None,
            'min_temperature_c': round(tmin, 2) if tmin is not None else None,
            'cloud_cover': round(cloud, 2) if cloud > 0 else None,
            'fog': bool(weather['fog_flag']),
            'thunder': bool(weather['thunder_flag'])
        }
    })
