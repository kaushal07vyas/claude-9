import { useState } from "react";

export default function TestTransaction() {
  const [form, setForm] = useState({
    station_id: "",
    date: "",
    prcp_mm: "",
    tmin_c: "",
    fog_flag: "",
    thunder_flag: "",
    flight_id: "",
    flight_no: "",
    airline_id: "",
    origin_airport: "",
    destination_airport: "",
    total_ops: "",
    percent_cancelled: "",
    fare_date: "",
    mean_fare: "",
    num_passenger: ""
  });

  const [result, setResult] = useState(null);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      const res = await fetch(
        "http://127.0.0.1:5001/api/test/run-weather-flight-transaction",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );

      const data = await res.json();
      setResult(data);

    } catch (err) {
      setResult({ error: err.message });
    }
  }

  return (
    <div className="page-wrapper">

      <div className="card">

        <h2 className="title">Weather + Flight Details</h2>
        <p className="subtitle">Run a combined weather + flight + fare transaction</p>

        <form onSubmit={handleSubmit}>

          {/* DAILY WEATHER */}
          <h3 className="section-title">Daily Weather</h3>
          <div className="grid">
            <input name="station_id" placeholder="Station ID *" required onChange={handleChange} />
            <input name="date" type="date" onChange={handleChange} />
            <input name="prcp_mm" placeholder="Precipitation (mm)" onChange={handleChange} />
            <input name="tmin_c" placeholder="Min Temp (°C)" onChange={handleChange} />
            <input name="fog_flag" placeholder="Fog Flag (0/1)" onChange={handleChange} />
            <input name="thunder_flag" placeholder="Thunder Flag (0/1)" onChange={handleChange} />
          </div>

          {/* FLIGHT */}
          <h3 className="section-title">Flight</h3>
          <div className="grid">
            <input name="flight_id" placeholder="Flight ID *" required onChange={handleChange} />
            <input name="flight_no" placeholder="Flight Number *" required onChange={handleChange} />
            <input name="airline_id" placeholder="Airline ID" onChange={handleChange} />
            <input name="origin_airport" placeholder="Origin Airport" onChange={handleChange} />
            <input name="destination_airport" placeholder="Destination Airport" onChange={handleChange} />
            <input name="total_ops" placeholder="Total Ops" onChange={handleChange} />
            <input name="percent_cancelled" placeholder="Percent Cancelled" onChange={handleChange} />
          </div>

          {/* FARE HISTORY */}
          <h3 className="section-title">Fare History</h3>
          <div className="grid">
            <input name="fare_date" type="date" onChange={handleChange} />
            <input name="mean_fare" placeholder="Mean Fare" onChange={handleChange} />
            <input name="num_passenger" placeholder="Number of Passengers" onChange={handleChange} />
          </div>

          <button type="submit" className="primary-btn">Submit</button>
        </form>

      </div>

      {result && (
        <div className="card result-card">
          <h3>Response</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}

      {/* INLINE CSS */}
      <style>{`
        .page-wrapper {
          padding: 30px;
          max-width: 900px;
          margin: 0 auto;
        }
        .card {
          background: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          margin-bottom: 25px;
        }
        .title {
          font-size: 26px;
          color: #007bff;
          text-align: center;
          margin-bottom: 10px;
        }
        .subtitle {
          text-align: center;
          margin-bottom: 30px;
          color: #555;
        }
        .section-title {
          margin-top: 25px;
          margin-bottom: 10px;
          color: #333;
          font-size: 20px;
          border-left: 4px solid #007bff;
          padding-left: 8px;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-bottom: 20px;
        }
        input {
          padding: 10px;
          border-radius: 6px;
          border: 1px solid #ccc;
        }
        .primary-btn {
          background: #007bff;
          border: none;
          padding: 12px 18px;
          color: white;
          border-radius: 8px;
          margin-top: 10px;
          font-size: 16px;
          cursor: pointer;
          display: block;
          width: 100%;
        }
        .primary-btn:hover {
          background: #0056cc;
        }
        .result-card pre {
          background: #f7f7f7;
          padding: 15px;
          border-radius: 6px;
          max-height: 300px;
          overflow: auto;
        }
      `}</style>
    </div>
  );
}
