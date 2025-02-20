require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@taskmanagement.lc85r.mongodb.net/?retryWrites=true&w=majority&appName=taskManagement`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("taskManagement");
    const userCollection = db.collection("users");

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };

      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ success: false, message: "User already exists." });
      }

      const result = await userCollection.insertOne({
        name: user.name,
        email: user.email,
        photo: user.photo,
        role: user.role,
        timestamp: new Date(),
      });

      res.send({ success: true, message: "User added successfully.", result });
    });
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("task management is running");
});

app.listen(port, () => {
  console.log(`Task is running on port ${port}`);
});
