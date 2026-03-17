import { useState } from "react";

export default function FareDropReport() {
  const [result1, setResult1] = useState([]);
  const [result2, setResult2] = useState([]);
  const [active, setActive] = useState("set1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function fetchReport() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        "http://127.0.0.1:5001/api/users/fareDrop-report",
        { method: "GET" }
      );

      const data = await res.json();

      setResult1(data.result1 || []);
      setResult2(data.result2 || []);

    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  }

  function FareDropTable({ rows }) {
    if (!rows || rows.length === 0) {
      return <p>No Records Found.</p>;
    }

    return (
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Airline</th>
              <th>Flight</th>
              <th>Origin</th>
              <th>Dest</th>
              <th>Fare Date</th>
              <th>Prev Fare</th>
              <th>New Fare</th>
              <th>% Change</th>
              <th>Users</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.airline_name}</td>
                <td>{r.flight_no}</td>
                <td>{r.origin}</td>
                <td>{r.dest}</td>
                <td>{r.fare_date}</td>
                <td>${r.prev_fare}</td>
                <td>${r.new_fare}</td>
                <td>{r.pct_change_pct}%</td>
                <td>{r.users_tracking}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function WeatherCancellationTable({ rows }) {
    if (!rows || rows.length === 0) {
      return <p>No Records Found.</p>;
    }

    return (
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Airline</th>
              <th>Avg Cancel Rate (%)</th>
              <th>Avg Fare ($)</th>
              <th>Bad Weather Ratio</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.airline_name}</td>
                <td>{r.avg_cancel_rate}%</td>
                <td>${r.avg_fare}</td>
                <td>{r.bad_weather_ratio}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="page-wrapper">

      <div className="card">
        <h2 className="title">Flight Analytics</h2>
        <p className="subtitle">
          Fare changes and airline performance analysis
        </p>

        <button className="primary-btn" onClick={fetchReport}>
          Load Reports
        </button>

        {loading && <p>Loading...</p>}
        {error && <p className="error">Error: {error}</p>}
      </div>

      {(result1.length > 0 || result2.length > 0) && (
        <div className="card">
          <div className="toggle-btns">
            <button
              className={active === "set1" ? "toggle active" : "toggle"}
              onClick={() => setActive("set1")}
            >
              Price Drop Alerts
            </button>
            <button
              className={active === "set2" ? "toggle active" : "toggle"}
              onClick={() => setActive("set2")}
            >
              Weather & Cancellations
            </button>
          </div>

          {active === "set1" && (
            <>
              <h3 className="section-title">Price Drop Alerts</h3>
              <p className="description">
                Significant fare reductions (≥10%) for tracked flights
              </p>
              <FareDropTable rows={result1} />
            </>
          )}

          {active === "set2" && (
            <>
              <h3 className="section-title">Airline Weather & Cancellation Analysis</h3>
              <p className="description">
                Last 90 days - sorted by bad weather exposure and cancellation rates
              </p>
              <WeatherCancellationTable rows={result2} />
            </>
          )}
        </div>
      )}

      <style>{`
        .page-wrapper {
          padding: 30px;
          max-width: 1200px;
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
          margin-bottom: 25px;
          color: #555;
        }
        .description {
          color: #666;
          font-size: 14px;
          margin-bottom: 15px;
          font-style: italic;
        }
        .primary-btn {
          background: #007bff;
          border: none;
          padding: 12px 18px;
          color: white;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          width: 100%;
        }
        .primary-btn:hover {
          background: #0056cc;
        }
        .toggle-btns {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }
        .toggle {
          flex: 1;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #007bff;
          cursor: pointer;
          background: white;
          color: #007bff;
          font-weight: bold;
        }
        .toggle.active {
          background: #007bff;
          color: white;
        }
        .table-wrapper {
          overflow-x: auto;
          margin-top: 20px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th {
          background: #f8f9fa;
          padding: 10px;
          border-bottom: 2px solid #ddd;
          text-align: left;
          font-weight: 600;
        }
        td {
          padding: 10px;
          border-bottom: 1px solid #eee;
        }
        .section-title {
          margin-bottom: 10px;
          font-size: 20px;
          border-left: 4px solid #007bff;
          padding-left: 8px;
          color: #333;
        }
        .error {
          color: red;
          margin-top: 10px;
        }
      `}</style>
    </div>
  );
}