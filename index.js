const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "https://historical-artifacts.web.app",
    "https://historical-artifacts.firebaseapp.com",
  ],
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cookieParser());
app.use(cors(corsOptions));
app.use(express.json());

const uri = `mongodb+srv://${process.env.SERVER_USER}:${process.env.SERVER_USER_PASS}@cluster0.ygtr7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//verifyToken

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  } else {
    jwt.verify(token, process.env.SECRET_KEY, (error, decoded) => {
      if (error) {
        return res.status(401).send({ message: "unauthorized access" });
      } else {
        req.user = decoded;
      }
    });
  }

  next();
};

async function run() {
  try {
    const historicalCollection = client
      .db("artifactsDB")
      .collection("artifactsData");
    const likeCollection = client.db("artifactsDB").collection("like");

    // jwt create

    app.post("/jwt", async (req, res) => {
      const email = req.body;

      const token = jwt.sign(email, process.env.SECRET_KEY, {
        expiresIn: "5h",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ message: true });
    });

    app.get("/logout", async (req, res) => {
      res
        .clearCookie("token", {
          maxAge: 0,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ message: true });
    });

    // all history data collection find

    app.get("/all-historical-data", async (req, res) => {
      const search = req.query.search;
      const filter = req.query.filter;
      let query = {};
      if (search) {
        query = {
          artifact_name: { $regex: search, $options: "i" },
        };
      }
      if (filter) {
        query = {
          artifact_type: filter,
        };
      }
      const result = await historicalCollection.find(query).toArray();
      res.send(result);
    });

    // app.get("/all-artifact", async (req, res) => {
    //   const filter = req.query.filter;
    //   let query = {};
    //   if (filter) {
    //     query = {
    //       artifact_type: filter,
    //     };
    //   }
    //   const result = await historicalCollection.find(query).toArray();
    //   res.send(result);
    // });

    app.get("/highest-like-history", async (req, res) => {
      const result = await historicalCollection
        .find({})
        .sort({ like_count: -1 })
        .limit(8)
        .toArray();
      res.send(result);
    });

    app.get("/historical", verifyToken, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.user?.email;

      if (decodedEmail !== email) {
        return res.status(401).send({ message: "unauthorized access" });
      }

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

    // update Status

    app.patch("/like-update/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const filter = { _id: new ObjectId(id) };
      const statusUpdate = {
        $set: { status },
      };

      const result = await historicalCollection.updateOne(filter, statusUpdate);
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
      if (!likeData?.email || !likeData?.like_id) {
        return res.status(400).send({ message: "Invalid request data." });
      }

      const query = { email: likeData?.email, like_id: likeData?.like_id };
      const alreadyLike = await likeCollection.findOne(query);
      const filter = { _id: new ObjectId(likeData?.like_id) };

      if (alreadyLike) {
        // return res.status(400).send("You Have already like on this post!!");
        await likeCollection.deleteOne(query);
        await historicalCollection.updateOne(filter, {
          $inc: { like_count: -1 },
        });
        return res.send({ message: "Like removed", like: false });
      } else {
        await likeCollection.insertOne(likeData);
        await historicalCollection.updateOne(filter, {
          $inc: { like_count: 1 },
        });
        return res.json({ message: "Like added", like: true });
      }
    });
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
  // console.log(`Example app listening on port ${port}`);
});
