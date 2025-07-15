const express = require("express");
const router = express.Router();

const dbutama = require('../../config/dbutama');

const { generateToken } = require("../../utils/token");
const { checkPassword } = require("../../utils/encrypt");

// login
router.post("/login", async (req, res) => {
    let client;
    try {
        client = await dbutama.connect();

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required",
            });
        }

        const query = await client.query(
            `SELECT * FROM consumer WHERE email = $1`,
            [email]
        );
        const selectedUser = query.rows[0];
        // console.log(selectedUser);
        if (!selectedUser) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        const isPasswordMatch = await checkPassword(selectedUser.password, password);
        if (!isPasswordMatch) {
            return res.status(401).json({
                message: "Invalid password",
            });
        }

        const token = await generateToken(selectedUser.id, selectedUser.role);
        res.status(200).json({
            message: "Login successful",
            token: token,
        });

    } catch (err) {
        // console.error(err);
        return res.status(500).json({
            message: "Internal Server Error",
            error: err.message,
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});


module.exports = router;
