const User = require("../models/User");
const bcrypt = require("bcryptjs");

// REGISTER
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};