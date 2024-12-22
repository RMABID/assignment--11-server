const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.SERVER_USER}:${process.env.SERVER_USER_PASS}@cluster0.ygtr7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    const historicalCollection = client
      .db("artifactsDB")
      .collection("artifactsData");
    const likeCollection = client.db("artifactsDB").collection("like");

    app.get("/historical", async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) {
        query.email = email;
      }
      const result = await historicalCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/historical/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await historicalCollection.findOne(query);
      res.send(result);
    });

    app.post("/historical", async (req, res) => {
      const newArtifacts = req.body;
      const result = await historicalCollection.insertOne(newArtifacts);
      res.send(result);
    });

    app.delete("/historical/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await historicalCollection.deleteOne(query);
      res.send(result);
    });

    app.put("/historical/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateData = req.body;
      const options = { upsert: true };
      const updated = {
        $set: updateData,
      };
      const result = await historicalCollection.updateOne(
        query,
        updated,
        options
      );
      res.send(result);
    });

    //Like collection data with user

    app.get("/historical-like", async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) {
        query.email = email;
      }
      const result = await likeCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/historical-like", async (req, res) => {
      const likeData = req.body;

      // 1. like data add
      const query = { email: likeData?.email, like_id: likeData?.like_id };
      const alreadyLike = await likeCollection.findOne(query);
      if (alreadyLike) {
        return res.status(400).send("You Have already like on this post!!");
      }
      // 2. user like data
      const result = await likeCollection.insertOne(likeData);
      // 3. like data count

      const filter = { _id: new ObjectId(likeData?.like_id) };

      const updatedCountLike = {
        $inc: { like_count: 1 },
      };
      await historicalCollection.updateOne(filter, updatedCountLike);

      res.send(result);
    });

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
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
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
