const express = require("express");
const router = express.Router();
const Note = require("../models/Note");
const User = require("../models/User");
const authMiddleware = require("../middlewares/authMiddleware");

router.post("/notes", authMiddleware, async (req, res) => {
  console.log(req.body);
  try {
    const { title, content, tags, collaboratorEmails, canEdit } = req.body;

    let updatedCollaboratorEmails = Array.isArray(collaboratorEmails)
      ? [...collaboratorEmails]
      : [];
    // Fetch the owner's email
    const ownerUser = await User.findById(req.userId);
    if (ownerUser && !updatedCollaboratorEmails.includes(ownerUser.email)) {
      updatedCollaboratorEmails.push(ownerUser.email);
    }

    const users = await User.find({
      email: { $in: updatedCollaboratorEmails },
    });

    // Always include owner in collaborators
    let collaboratorIds = users.map((user) => user._id);
    if (!collaboratorIds.some((id) => id.equals(req.userId))) {
      collaboratorIds.push(req.userId);
    }

    // Always include owner in permissions with canEdit: true
    let permissions = users.map((user) => ({
      user: user._id,
      canEdit: user._id.equals(req.userId) ? true : canEdit,
    }));
    if (!permissions.some((p) => p.user.equals(req.userId))) {
      permissions.push({ user: req.userId, canEdit: true });
    }

    const note = new Note({
      title,
      content,
      tags,
      collaborators: collaboratorIds,
      permissions,
      owner: req.userId,
      versionHistory: ["Initial draft"],
    });

    await note.save();
    res.status(201).json({ success: true, note });
  } catch (err) {
    console.error("Error saving note:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete("/notes/:id", authMiddleware, async (req, res) => {
  try {
    const note = await Note.findOneAndDelete({
      _id: req.params.id,
      owner: req.userId,
    });
    if (!note)
      return res.status(404).json({ error: "Note not found or unauthorized" });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error deleting note:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/notes/:id", authMiddleware, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ error: "Note not found" });

    // --- Ensure owner is in collaborators and permissions before permission check ---
    const { title, content, tags, collaboratorEmails, canEdit } = req.body;

    let updatedCollaboratorEmails = Array.isArray(collaboratorEmails)
      ? [...collaboratorEmails]
      : [];
    // Fetch the owner's email
    const ownerUser = await User.findById(req.userId);
    if (ownerUser && !updatedCollaboratorEmails.includes(ownerUser.email)) {
      updatedCollaboratorEmails.push(ownerUser.email);
    }

    const users = await User.find({
      email: { $in: updatedCollaboratorEmails },
    });

    // Always include owner in collaborators
    let collaboratorIds = users.map((user) => user._id);
    if (!collaboratorIds.some((id) => id.equals(req.userId))) {
      collaboratorIds.push(req.userId);
    }

    // Always include owner in permissions with canEdit: true
    let permissions = users.map((user) => ({
      user: user._id,
      canEdit: user._id.equals(req.userId) ? true : canEdit,
    }));
    if (!permissions.some((p) => p.user.equals(req.userId))) {
      permissions.push({ user: req.userId, canEdit: true });
    }

    // --- No permission check ---
    note.collaborators = collaboratorIds;
    note.permissions = permissions;
    note.title = title;
    note.content = content;
    note.tags = tags;
    note.versionHistory.push(content);

    await note.save();

    res.status(200).json({ success: true, note });
  } catch (err) {
    console.error("Error updating note:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Create a new note
router.post("/editor", authMiddleware, async (req, res) => {
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
router.post("/editor/:id", authMiddleware, async (req, res) => {
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

module.exports = router;
