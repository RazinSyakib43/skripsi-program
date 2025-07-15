const express = require("express");
const router = express.Router();

const db = require('../../config/db');
const redis = require('../../config/redis');

// get all orders (cache-aside)
router.get("/all", async (req, res) => {
    let client;
    try {
        const consumerID = req.user.id;
        // Cek di Redis apakah ada cache untuk transaksi
        const transactionsCache = await redis.get(`transactions:all:${consumerID}`);

        if (transactionsCache) {
            return res.status(200).json({
                message: "Success - All transactions (Redis Cache)",
                data: JSON.parse(transactionsCache),
            });
        } else {
            client = await db.connect();
            const query = `
            SELECT
                t.id AS id_transaction,
                t.status AS transaction_status,
                t.dates_transaction,
                t.dates_payed,
                o.id AS id_ordering,
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'id_fish', dor.id_fish,
                        'fish_name', f.name,
                        'fish_price', f.price,
                        'seller_name', s.name,
                        'subtotal_price', dor.weight * f.price
                )) AS fish_details
                FROM transaction t
                INNER JOIN ordering o ON t.id_ordering = o.id
                INNER JOIN detail_ordering dor ON o.id = dor.id_ordering
                INNER JOIN fish f ON dor.id_fish = f.id
                INNER JOIN seller s ON f.id_seller = s.id
                WHERE t.id_consumer = $1
                GROUP BY t.id, t.status, t.dates_transaction, t.dates_payed, o.id`;

            const result = await client.query(query, [consumerID]);
            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "No transactions found",
                });
            }

            // Simpan hasil query ke Redis dengan tipe data string
            await redis.set(`transactions:all:${consumerID}`, JSON.stringify(result.rows));

            return res.status(200).json({
                message: "Success - All transactions (PostgreSQL)",
                data: result.rows,
            });
        }
    } catch (err) {
        // console.error("Error fetching transactions:", err);
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

// get all orders (cache hit)
router.get("/all-cachehit", async (req, res) => {
    try {
        const consumerID = req.user.id;
        // Cek di Redis apakah ada cache untuk transaksi
        const transactionsCache = await redis.get(`transactions:all:${consumerID}`);

        if (!transactionsCache) {
            return res.status(404).json({
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
    try {
        const consumerID = req.user.id;
        const { id_external, idOrdering, created, paid_at, status } = req.body;

        client = await db.connect();
        const query = `
        INSERT INTO transaction (id_external, id_consumer, dates_transaction, dates_payed, id_ordering, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id AS transaction_id`;

        const values = [id_external, consumerID, created, paid_at, idOrdering, status];
        const result = await client.query(query, values);
        if (result.rows.length === 0) {
            return res.status(400).json({
                message: "Failed to create transaction",
            });
        }

        // Hapus cache Redis untuk semua transaksi milik consumer id tersebut
        await redis.del(`transactions:all:${consumerID}`);

        return res.status(201).json({
            message: "Transaction created successfully",
            transaction_id: result.rows[0].transaction_id,
        });
    } catch (err) {
        // console.error("Error creating transaction:", err);
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

router.put("/update/:id", async (req, res) => {
    try {
        const transactionID = req.params.id;
        const { status } = req.body;

        client = await db.connect();
        const query = `
            UPDATE transaction SET status = $1 WHERE id = $2
                RETURNING id_consumer`;

        const result = await client.query(query, [status, transactionID]);
        if (result.rowCount === 0) {
            return res.status(404).json({
                message: "Transaction not found",
            });
        }

        // dapatkan id_consumer yang data transaksinya diupdate
        const consumerID = result.rows[0].id_consumer;
        // Hapus cache Redis untuk semua transaksi milik consumer id tersebut
        await redis.del(`transactions:all:${consumerID}`);

        return res.status(200).json({
            message: "Transaction updated successfully",
        });
    } catch (err) {
        // console.error("Error updating transaction:", err);
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