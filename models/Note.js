const mongoose = require("mongoose");
const user = require("./User");

const noteSchema = new mongoose.Schema(
  {
    title: String,
    content: String,
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    collaborators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    permissions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        canEdit: { type: Boolean, default: false },
      },
    ],
    tags: [String],
    versionHistory: [String],
  },
  { timestamps: true }
);

// ✅ Custom validation to ensure permissions.user exists in collaborators[]
noteSchema.pre("validate", function (next) {
  // Ensure collaborators and permissions are arrays
  const collaboratorIds = Array.isArray(this.collaborators)
    ? this.collaborators.filter((id) => id != null).map((id) => id.toString())
    : [];

  if (!Array.isArray(this.permissions)) return next();

  for (let perm of this.permissions) {
    if (!perm || !perm.user) continue; // skip if permission or user is undefined/null
    if (!collaboratorIds.includes(perm.user.toString())) {
      return next(
        new Error(`User ${perm.user} in permissions must be a collaborator.`)
      );
    }
  }

  next();
});

module.exports = mongoose.model("Note", noteSchema);
