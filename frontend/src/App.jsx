import { useEffect, useState } from "react";

function App() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLeads = async () => {
    try {
      setLoading(true);

      const response = await fetch("http://localhost:5000/leads");
      const data = await response.json();

      console.log(data);

      if (data.success) {
        setLeads(data.data);
      }
    } catch (error) {
      console.log("Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  return (
    <div
      style={{
        padding: "20px",
        fontFamily: "Arial",
      }}
    >
      <h1>IndiaMART Leads</h1>

      <button
        onClick={fetchLeads}
        style={{
          padding: "10px 20px",
          cursor: "pointer",
          marginBottom: "20px",
        }}
      >
        Refresh Leads
      </button>

      {loading && <p>Loading...</p>}

      {!loading && leads.length === 0 && <p>No Leads Found</p>}

      {!loading &&
        leads.length > 0 &&
        leads.map((lead, index) => (
          <div
            key={index}
            style={{
              border: "1px solid #ccc",
              padding: "15px",
              marginBottom: "10px",
              borderRadius: "10px",
            }}
          >
            <h3>{lead.SENDERNAME}</h3>

            <p>
              <b>Product:</b> {lead.SUBJECT}
            </p>

            <p>
              <b>Mobile:</b> {lead.SENDER_MOBILE}
            </p>

            <p>
              <b>City:</b> {lead.GLUSR_USR_CITY}
            </p>

            <p>
              <b>Message:</b> {lead.ENQ_MESSAGE}
            </p>
          </div>
        ))}
    </div>
  );
}

export default App;
