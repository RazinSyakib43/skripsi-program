const express = require("express");
const router = express.Router();

const dbutama = require('../../config/dbutama');

router.put("/:id", async (req, res) => {
    let clientUtama;

    const transactionID = req.params.id;

    try {
        clientUtama = await dbutama.connect();

        const paid_at = new Date().toISOString();

        const queryUpdate = await clientUtama.query(`UPDATE transaction SET status = $1, dates_payed = $2 WHERE id = $3 RETURNING id_ordering, id_consumer`, ['PAID', paid_at, transactionID]);
        if (queryUpdate.rowCount === 0) {
            return res.status(404).json({
                transactionID: transactionID,
                message: "Transaction not found",
            });
        }

        return res.status(200).json({
            transactionID: transactionID,
            idOrdering: queryUpdate.rows[0].id_ordering,
            consumerID: queryUpdate.rows[0].id_consumer,
            message: "Transaction updated successfully",
        });
    } catch (err) {
        // console.error("Error updating transaction:", err);
        return res.status(500).json({
            message: "Update Transaction - Internal Server Error",
            error: err.message,
        });
    } finally {
        if (clientUtama) {
            clientUtama.release();
        }
    }
});

module.exports = router;