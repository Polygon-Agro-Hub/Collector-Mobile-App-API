const express = require("express");
const router = express.Router();
router.post("/update-officer-status", (req, res) => {
  const userId = req.user.id;

  if (!global.io) {
    return res
      .status(500)
      .json({ message: "WebSocket server not initialized" });
  }

  global.io.emit("officer_status_update", { empId, status });
  res.status(200).json({ message: "Officer status updated successfully" });
});

module.exports = router;
