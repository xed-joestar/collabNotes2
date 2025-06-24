const express = require("express");
const app = express();
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Note = require("./models/Note");
const User = require("./models/User");
const cors = require("cors");
const { Server } = require("socket.io");
const http = require("http");
const server = http.createServer(app); // create HTTP server
const io = new Server(server); // attach socket.io to the server
const cookieParser = require("cookie-parser");
const authMiddleware = require("./middlewares/authMiddleware");
const url = "https://collabnotes2.onrender.com";
// const url="http://localhost:3000";
app.use(cookieParser());
app.use(
  cors({
    origin: "https://collabnotes2.onrender.com",
    credentials: true, // allow cookies to be sent
  })
);
dotenv.config();
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

mongoose
  .connect(
    process.env.MONGO_URI ||
      "mongodb+srv://tcollegewala30:fOcy87YhffoTWgnJ@cluster0.qqtdpgf.mongodb.net/collabNotes"
  )
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

const authRoutes = require("./routes/authRoute");
const noteRoutes = require("./routes/noteRoute");
const tagsRoutes = require("./routes/tagsRoute");
// app.use((req, res, next) => {
//   console.log(`[${req.method}] ${req.originalUrl}`);
//   next();
// });

app.use(authRoutes);
app.use("/api", noteRoutes);
app.use(tagsRoutes);

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/dashboard", authMiddleware, async (req, res) => {
  const notes = await Note.find({ owner: req.userId }).lean();
  res.render("dashboard", { notes });
});
app.get("/shared", authMiddleware, async (req, res) => {
  const notes = await Note.find({
    collaborators: req.userId,
  }).lean();

  res.render("dashboard", { notes });
});
app.get("/editor", authMiddleware, (req, res) => {
  res.render("editor");
});

app.get("/editor/:id", authMiddleware, async (req, res) => {
  const note = await Note.findOne({
    _id: req.params.id,
    owner: req.userId,
  }).lean();
  if (!note) return res.redirect("/404");

  res.render("editor", { note }); // send note data to the editor
});

app.get("/404", (req, res) => {
  res.render("404");
});
app.get("/login", (req, res) => {
  res.render("login");
});
app.get("/register", (req, res) => {
  res.render("register");
});
app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/");
});

// Create a new note
app.post("/editor", authMiddleware, async (req, res) => {
  try {
    const { title, content, tags } = req.body;
    const note = new Note({
      title,
      content,
      tags: tags ? tags.split(",").map((t) => t.trim()) : [],
      owner: req.userId,
      collaborators: [req.userId],
      permissions: [{ user: req.userId, canEdit: true }],
      versionHistory: [content],
    });
    await note.save();
    res.redirect("/dashboard");
  } catch (err) {
    res.status(500).send("Error creating note");
  }
});

// Update an existing note
app.post("/editor/:id", authMiddleware, async (req, res) => {
  try {
    const { title, content, tags } = req.body;
    const note = await Note.findOne({ _id: req.params.id, owner: req.userId });
    if (!note) return res.redirect("/404");
    note.title = title;
    note.content = content;
    note.tags = tags ? tags.split(",").map((t) => t.trim()) : [];
    note.versionHistory.push(content);
    await note.save();
    res.redirect("/dashboard");
  } catch (err) {
    res.status(500).send("Error updating note");
  }
});

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("join-note", (noteId) => {
    socket.join(noteId);
    console.log(`User joined note room: ${noteId}`);
  });

  socket.on("send-changes", ({ noteId, content }) => {
    socket.to(noteId).emit("receive-changes", content); // broadcast to other clients
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

server.listen(process.env.PORT || 3000);
