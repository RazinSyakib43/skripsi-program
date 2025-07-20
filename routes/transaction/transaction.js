const express = require("express");
const router = express.Router();

const db = require('../../config/db');
const redis = require('../../config/redis');

// get all orders (cache-aside)
router.get("/all", async (req, res) => {
    let client;
    const consumerID = req.user.id;

    try {
        // Cek di Redis apakah ada cache untuk transaksi
        const transactionsCache = await redis.get(`transactions:all:${consumerID}`);

        if (transactionsCache) {
            return res.status(200).json({
                message: "Success - All transactions (Redis Cache)",
                data: JSON.parse(transactionsCache),
            });
        } else {
            client = await db.connect();

            const querySelect = await client.query(`SELECT t.id AS id_transaction, t.status AS transaction_status, t.dates_transaction, t.dates_payed, o.id AS id_ordering, JSON_AGG(JSON_BUILD_OBJECT('id_fish', dor.id_fish, 'fish_name', f.name, 'fish_price', f.price, 'seller_name', s.name, 'subtotal_price', dor.weight * f.price)) AS fish_details FROM transaction t INNER JOIN ordering o ON t.id_ordering = o.id INNER JOIN detail_ordering dor ON o.id = dor.id_ordering INNER JOIN fish f ON dor.id_fish = f.id INNER JOIN seller s ON f.id_seller = s.id WHERE t.id_consumer = $1 GROUP BY t.id, t.status, t.dates_transaction, t.dates_payed, o.id`, [consumerID]);

            if (querySelect.rows.length === 0) {
                return res.status(404).json({
                    consumerID: consumerID,
                    message: "No transactions found",
                });
            }

            // Simpan hasil query ke Redis dengan tipe data string
            await redis.set(`transactions:all:${consumerID}`, JSON.stringify(result.rows));

            return res.status(200).json({
                message: "Success - All transactions (PostgreSQL)",
                data: querySelect.rows,
            });
        }
    } catch (err) {
        // console.error("Error fetching transactions:", err);
        return res.status(500).json({
            message: "Get All Transactions - Internal Server Error",
            error: err.message,
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// get all orders (cache hit)
router.get("/all-cachehit", async (req, res) => {
    const consumerID = req.user.id;

    try {
        // Cek di Redis apakah ada cache untuk transaksi
        const transactionsCache = await redis.get(`transactions:all:${consumerID}`);

        if (!transactionsCache) {
            return res.status(404).json({
                consumerID: consumerID,
                message: "No transactions cache found",
            });
        }

        const JSONparse = JSON.parse(transactionsCache);
        return res.status(200).json({
            message: "Success - All transactions 2 (Redis Cache)",
            data: JSONparse,
        });
    } catch (err) {
        // console.error("Error fetching transactions:", err);
        return res.status(500).json({
            message: "Internal Server Error",
            error: err.message,
        });
    }
});

router.post("/create", async (req, res) => {
    let client;

    const consumerID = req.user.id;
    const { id_external, idOrdering } = req.body;

    if (!id_external) {
        return res.status(400).json({
            message: "Create transaction - Missing id_external field",
        });
    }

    if (!idOrdering) {
        return res.status(400).json({
            message: "Create transaction - Missing idOrdering field",
        });
    }

    if (isNaN(idOrdering)) {
        return res.status(400).json({
            message: "Invalid idOrdering value. It should be a valid number.",
        });
    }

    try {
        client = await db.connect();

        const queryCheckOrdering = await client.query(`SELECT id FROM ordering WHERE id = $1 AND status = 'PENDING'`, [idOrdering]);

        if (queryCheckOrdering.rowCount === 0) {
            return res.status(404).json({
                idOrdering: idOrdering,
                message: "No pending order with this ID found",
            });
        }

        const created = new Date().toISOString();

        const queryInsert = await client.query(`INSERT INTO transaction (id_external, id_consumer, dates_transaction, id_ordering) VALUES ($1, $2, $3, $4) RETURNING id AS transaction_id`, [id_external, consumerID, created, idOrdering]);
        if (queryInsert.rows.length === 0) {
            return res.status(400).json({
                id_external: id_external,
                idOrdering: idOrdering,
                consumerID: consumerID,
                message: "Failed to create transaction",
            });
        }

        // Hapus cache Redis untuk semua transaksi milik consumer id tersebut
        await redis.del(`transactions:all:${consumerID}`);

        return res.status(201).json({
            message: "Transaction created successfully",
            transaction_id: queryInsert.rows[0].transaction_id,
        });
    } catch (err) {
        // console.error("Error creating transaction:", err);
        return res.status(500).json({
            message: "Create Transaction - Internal Server Error",
            error: err.message,
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

module.exports = router;