require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Home Route
app.get("/", (req, res) => {
  res.send("IndiaMART API Server Running...");
});

// Get Leads
app.get("/leads", async (req, res) => {
  try {
    const response = await axios.get(
      "https://mapi.indiamart.com/wservce/buyerLead/",
      {
        params: {
          glusr_crm_key: process.env.INDIAMART_API_KEY,
        },
      }
    );

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.log("Lead Fetch Error:", error.message);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
