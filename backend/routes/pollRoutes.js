import express from "express";
import Poll from "../models/poll.js";

const router = express.Router();

// 1. GET ALL POLLS (Sorted by newest first)
router.get("/", async (req, res) => {
  try {
    const polls = await Poll.find().sort({ createdAt: -1 });
    res.status(200).json(polls);
  } catch (error) {
    console.error("Database Fetch Error:", error);
    res.status(500).json({ message: error.message });
  }
});

// 2. GET A SINGLE POLL BY ID (For individual shareable links)
router.get("/:id", async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) return res.status(404).json({ message: "Poll not found" });
    res.status(200).json(poll);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 3. CREATE A NEW POLL
router.post("/", async (req, res) => {
  try {
    const { question, options, durationMinutes } = req.body;

    if (!options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ message: "Polls require at least 2 options!" });
    }

    // Calculate Expiration Date if timer set
    let expiresAt = null;
    if (durationMinutes && durationMinutes > 0) {
      expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
    }

    // Format options as text options
    const formattedOptions = options.map((optText) => ({
      text: typeof optText === "string" ? optText : optText.text,
      votes: 0
    }));

    const newPoll = new Poll({
      question,
      options: formattedOptions,
      expiresAt
    });

    await newPoll.save();
    res.status(201).json(newPoll);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 4. VOTE ON A POLL (With Timer & Vote-Swapping logic)
router.patch("/:id/vote", async (req, res) => {
  try {
    const { optionId } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    const poll = await Poll.findById(req.params.id);
    if (!poll) return res.status(404).json({ message: "Poll not found" });

    // CHECK IF EXPIRED
    if (poll.expiresAt && new Date() > new Date(poll.expiresAt)) {
      return res.status(400).json({ message: "This poll has expired!" });
    }

    const existingVote = poll.votedUsers.find((user) => user.ip === clientIP);

    if (existingVote) {
      if (existingVote.optionId.toString() === optionId) {
        return res.status(400).json({ message: "You already selected this option!" });
      }

      // Swap Vote
      const oldOption = poll.options.id(existingVote.optionId);
      if (oldOption && oldOption.votes > 0) oldOption.votes -= 1;

      const newOption = poll.options.id(optionId);
      if (newOption) newOption.votes += 1;

      existingVote.optionId = optionId;
    } else {
      const targetOption = poll.options.id(optionId);
      if (targetOption) {
        targetOption.votes += 1;
        poll.totalVotes += 1;
        poll.votedUsers.push({ ip: clientIP, optionId });
      }
    }

    await poll.save();
    res.status(200).json(poll);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 5. DELETE A POLL
router.delete("/:id", async (req, res) => {
  try {
    const deletedPoll = await Poll.findByIdAndDelete(req.params.id);
    if (!deletedPoll) {
      return res.status(404).json({ message: "Poll not found" });
    }
    res.status(200).json({ message: "Poll deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;