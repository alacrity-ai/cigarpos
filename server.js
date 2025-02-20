const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json()); // Allow parsing JSON requests

// Connect to SQLite database
const db = new sqlite3.Database("database.sqlite", sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error("Error connecting to the database:", err.message);
  } else {
    console.log("Connected to SQLite database.");
  }
});

// GET Customers (with optional name filtering)
app.get("/customers", (req, res) => {
  const searchName = req.query.name ? `%${req.query.name}%` : "%"; // Wildcard search

  const query = `
    SELECT 
      json_extract(value, '$.name') AS customer_name, 
      json_extract(value, '$.email') AS email
    FROM json_each((SELECT data FROM data WHERE key = 'wpos_customers'))
    WHERE customer_name LIKE ?;
  `;

  db.all(query, [searchName], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const customers = rows
      .filter(row => row.customer_name !== null)
      .map(row => ({
        name: row.customer_name,
        email: row.email || "N/A"
      }));

    res.json({ customers });
  });
});

// POST New Customer
app.post("/customer", (req, res) => {
  const { email, name, phone = "", mobile = "", address = "", suburb = "", postcode = "", state = "", country = "", notes = "" } = req.body;

  if (!email || !name) {
    return res.status(400).json({ error: "Email and name are required." });
  }

  // Fetch existing customers JSON
  db.get("SELECT data FROM data WHERE key = 'wpos_customers'", [], (err, row) => {
    if (err) {
      return res.status(500).json({ error: "Failed to fetch customers" });
    }

    let customers = JSON.parse(row.data);
    const newId = Object.keys(customers).length + 1; // Auto-increment ID

    customers[newId] = {
      id: String(newId),
      email,
      name,
      phone,
      mobile,
      address,
      suburb,
      postcode,
      state,
      country,
      notes,
      googleid: "",
      pass: "",
      token: "",
      activated: "0",
      disabled: "0",
      lastlogin: null,
      dt: new Date().toISOString(), // Timestamp for creation
      points: "0",
      dob: "",
      updated_at: new Date().toISOString(),
      houseacclimit: "0",
      ishousepay: "0",
      housesaleborrow: "0",
      promotion_subscribed: "0",
      totalsales: "0",
      contacts: []
    };

    // Update the database with the new customer
    db.run(
      "UPDATE data SET data = ? WHERE key = 'wpos_customers'",
      [JSON.stringify(customers)],
      function (updateErr) {
        if (updateErr) {
          return res.status(500).json({ error: "Failed to add customer" });
        }
        res.status(201).json({ message: "Customer added successfully", customer: customers[newId] });
      }
    );
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
