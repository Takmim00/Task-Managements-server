require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");

const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const port = process.env.PORT || 5000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["*"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket"],
});

app.use(cors());
app.use(express.json());

module.exports = app;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@taskmanagement.lc85r.mongodb.net/?retryWrites=true&w=majority&appName=taskManagement`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db("taskManagement");
    const userCollection = db.collection("users");
    const messagesCollection = db.collection("messages");

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
        timestamp: new Date(),
      });

      res.send({ success: true, message: "User added successfully.", result });
    });

    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.get("/tasks", async (req, res) => {
      const result = await messagesCollection.find().sort({ order: 1 }).toArray();
      res.send(result);
    });
    

    app.get("/messages/:category", async (req, res) => {
      const { category } = req.params;
      const messages = await messagesCollection
        .find({ category })
        .sort({ timestamp: 1 })
        .toArray();
      res.send(messages);
    });

    io.on("connection", (socket) => {
      // console.log(`User Connected: ${socket.id}`);
      socket.on("join_category", async (category) => {
        socket.join(category);
        // console.log(`User with ID: ${socket.id} joined category: ${category}`);
        const messages = await messagesCollection
          .find({ category })
          .sort({ timestamp: 1 })
          .toArray();
        socket.emit("previous_messages", messages);
      });

      socket.on("send_task", async (data) => {
        const { category, title } = data;

        const newMessage = {
          category,
          title,
          timestamp: new Date(),
        };

        const result = await messagesCollection.insertOne(newMessage);

        const insertedTask = {
          _id: result.insertedId,
          ...newMessage,
        };
        socket.to(category).emit("receive_task", insertedTask);
      });


      socket.on("reorder_tasks", async ({ category, tasks }) => {
        for (let i = 0; i < tasks.length; i++) {
          await messagesCollection.updateOne(
            { _id: new ObjectId(tasks[i]._id) },
            { $set: { order: i } }
          );
        }
        io.emit("update_tasks", { category, tasks });
      });
    
    
    });
    app.post("/tasks", async (req, res) => {
      try {
        const task = {
          category: req.body.category,
          title: req.body.title,
          timestamp: new Date(),
        };

        const result = await messagesCollection.insertOne(task);
        task._id = result.insertedId;

        res.json(task);
      } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
      }
    });
   

    app.delete("/tasks/:id", async (req, res) => {
      const { id } = req.params;
    
      try {
        const filter = { _id: new ObjectId(id) };
        const result = await messagesCollection.deleteOne(filter);
    
        if (result.deletedCount > 0) {
          io.emit("delete_task", id); 
          res.send({ success: true, message: "Task deleted successfully" });
        } else {
          res.status(404).send({ success: false, message: "Task not found" });
        }
      } catch (error) {
        console.error("Error deleting task:", error);
        res.status(500).send({ success: false, message: "Internal Server Error" });
      }
    });
    

    app.put("/tasks/:id", async (req, res) => {
      const id = req.params.id;
      const updatedMessage = req.body;

      try {
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: updatedMessage };

        const result = await messagesCollection.updateOne(filter, updateDoc);

        if (result.modifiedCount > 0) {
          const updatedTask = await messagesCollection.findOne(filter);
          io.emit("edit_task", updatedTask);
          res.send(updatedTask);
        } else {
          res
            .status(404)
            .send({ message: "Message not found or no changes made." });
        }
      } catch (error) {
        console.error("Error updating message:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    console.log("Connected to MongoDB!");
  } finally {
    // Do not close client to maintain connection
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Task management is running");
});

server.listen(port, () => {
  console.log(`Task is running on port ${port}`);
});
