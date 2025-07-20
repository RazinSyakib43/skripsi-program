const express = require("express");
const router = express.Router();

const db = require('../../config/db');
const redis = require('../../config/redis');

// get all orders (cache-aside)
router.get("/all", async (req, res) => {
    let client;
    const sellerID = req.user.id;

    try {
        // // Cek di Redis apakah ada cache untuk pesanan masuk dari consumer
        const ordersAllCache = await redis.get(`orders:seller:all:${sellerID}`);

        if (ordersAllCache) {
            return res.status(200).json({
                message: "Success - All orders (Redis Cache)",
                data: JSON.parse(ordersAllCache),
            });
        } else {
            client = await db.connect();

            const querySelect = await client.query(`SELECT o.id AS id_ordering, o.date, c.name AS consumer_name, c.address AS consumer_address, o.status AS delivery_status, sum(dor.weight * f.price) AS total_price, t.status AS transaction_status, JSON_AGG(JSONB_BUILD_OBJECT('id_fish', f.id, 'name', f.name, 'price', f.price, 'weight', dor.weight, 'total_price', dor.weight * f.price)) AS fishes FROM ordering o INNER JOIN detail_ordering dor ON o.id = dor.id_ordering INNER JOIN fish f ON dor.id_fish = f.id INNER JOIN consumer c ON dor.id_consumer = c.id INNER JOIN transaction t ON t.id_ordering = o.id WHERE f.id_seller = $1 AND t.status = 'PAID' GROUP BY o.id, o.date, c.name, c.address, o.status, t.status`, [sellerID]);
            if (querySelect.rows.length === 0) {
                return res.status(404).json({
                    sellerID: sellerID,
                    message: "No orders found",
                });
            }

            // Simpan hasil query ke Redis
            await redis.set(`orders:seller:all:${sellerID}`, JSON.stringify(querySelect.rows));

            return res.status(200).json({
                message: "Success - All orders seller (PostgreSQL)",
                data: querySelect.rows,
            });
        }
    } catch (err) {
        // console.error("Error fetching orders:", err);
        return res.status(500).json({
            message: "Get All Orders (Seller) - Internal Server Error",
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
    const sellerID = req.user.id;

    try {
        // // Cek di Redis apakah ada cache untuk pesanan masuk dari consumer
        const ordersAllCache = await redis.get(`orders:seller:all:${sellerID}`);

        if (!ordersAllCache) {
            return res.status(404).json({
                sellerID: sellerID,
                message: "No orders (seller) cache found",
            });
        }

        const JSONparse = JSON.parse(ordersAllCache);

        return res.status(200).json({
            message: "Success - All orders 2 (Redis Cache)",
            data: JSONparse,
        });
    } catch (err) {
        // console.error("Error fetching orders:", err);
        return res.status(500).json({
            message: "Internal Server Error",
            error: err.message,
        });
    }
});

module.exports = router;