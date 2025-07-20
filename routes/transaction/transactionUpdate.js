const express = require("express");
const router = express.Router();

const db = require('../../config/db');

router.put("/:id", async (req, res) => {
    let client;

    const transactionID = req.params.id;

    try {
        client = await db.connect();

        const paid_at = new Date().toISOString();

        const queryUpdate = await client.query(`UPDATE transaction SET status = $1, dates_payed = $2 WHERE id = $3 RETURNING id_consumer`, ['PAID', paid_at, transactionID]);
        if (queryUpdate.rowCount === 0) {
            return res.status(404).json({
                transactionID: transactionID,
                message: "Transaction not found",
            });
        }

        return res.status(200).json({
            message: "Transaction updated successfully",
        });
    } catch (err) {
        // console.error("Error updating transaction:", err);
        return res.status(500).json({
            message: "Update Transaction - Internal Server Error",
            error: err.message,
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

module.exports = router;