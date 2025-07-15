const express = require("express");
const router = express.Router();

const db = require('../../config/db');
const redis = require('../../config/redis');

// get all orders (cache-aside)
router.get("/all", async (req, res) => {
    let client;
    try {
        const consumerID = req.user.id;

        // Cek di Redis apakah ada cache untuk pesanan
        const ordersAllCache = await redis.get(`orders:all:${consumerID}`);

        if (ordersAllCache) {
            return res.status(200).json({
                message: "Success - All orders (Redis Cache)",
                data: JSON.parse(ordersAllCache),
            });
        } else {
            client = await db.connect();
            const query = `
            SELECT
                o.id AS id_ordering,
                o.date,
                o.status AS delivery_status,
                JSON_AGG(
                    JSONB_BUILD_OBJECT(
                        'id_fish', f.id,
                        'name', f.name,
                        'price', f.price,
                        'weight', dor.weight,
                        'total_price', dor.weight * f.price,
                        'seller_name', s.name,
                        'location', s.location
                    )
                ) AS fishes
            FROM ordering o
            INNER JOIN detail_ordering dor ON o.id = dor.id_ordering
            INNER JOIN fish f ON dor.id_fish = f.id
            INNER JOIN seller s ON f.id_seller = s.id
            WHERE dor.id_consumer = $1
            GROUP BY o.id, o.date, o.status;`;

            const result = await client.query(query, [consumerID]);
            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "No orders consumer found",
                });
            }

            // Simpan hasil query ke Redis dengan tipe data string
            await redis.set(`orders:all:${consumerID}`, JSON.stringify(result.rows));

            return res.status(200).json({
                message: "Success - All orders (PostgreSQL)",
                data: result.rows,
            });
        }
    } catch (err) {
        // console.error("Error fetching orders:", err);
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

        // Cek di Redis apakah ada cache untuk pesanan
        const ordersAllCache = await redis.get(`orders:all:${consumerID}`);

        if (!ordersAllCache) {
            return res.status(404).json({
                message: "No orders (consumer) cache found",
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

router.post('/create', async (req, res) => {
    let client;
    try {
        client = await db.connect();

        const consumerID = req.user.id;
        const { date, notes, status, kurir, alamat, invoice_url, latitude, longitude } = req.body;

        const query = `
        INSERT INTO ordering (id_consumer, date, notes, status, kurir, alamat, invoice_url, latitude, longitude)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id AS id_ordering`;

        const result = await client.query(query, [
            consumerID, date, notes, status, kurir, alamat, invoice_url, latitude, longitude
        ]);

        return res.status(201).json({
            id_ordering: result.rows[0].id_ordering,
            message: "Order created successfully",
        });
    } catch (err) {
        // console.error("Error creating order:", err);
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

router.post('/create/detail', async (req, res) => {
    let client;
    try {        
        const consumerID = req.user.id;
        const orderingID = req.body.idOrdering;

        client = await db.connect();

        const queryCheckOrdering = `
            SELECT id FROM ordering
            WHERE id = $1 AND status = 'PENDING'`;
        const resultCheckOrdering = await client.query(queryCheckOrdering, [orderingID]);

        const queryGetCart = `
            SELECT * FROM cart 
            WHERE id_consumer = $1`;
        const resultGetCart = await client.query(queryGetCart, [consumerID]);
        if (resultGetCart.rows.length === 0) {
            return res.status(404).json({
                message: "Cart is empty",
            });
        }

        if (resultCheckOrdering.rowCount === 0) {
            return res.status(404).json({
                message: "No pending order with this ID found",
            });
        } else {
            // mulai transaksi
            await client.query('BEGIN');

            const cartItems = resultGetCart.rows;

            const queryInsertDetailOrdering = `
                INSERT INTO detail_ordering (id_consumer, id_ordering, id_fish, weight)
                VALUES ($1, $2, $3, $4)`;

            for (const item of cartItems) {
                await client.query(queryInsertDetailOrdering, [consumerID, orderingID, item.id_fish, item.weight]);
            }
            // Menghapus item dari keranjang setelah order dibuat
            const queryClearCart = `DELETE FROM cart WHERE id_consumer = $1`;
            await client.query(queryClearCart, [consumerID]);

            // Mengurangi weight dari fish yang dipesan
            const queryUpdateFishWeight = `
            UPDATE weight
                SET weight = weight - $1
                FROM fish
                WHERE weight.id = fish.id_weight AND fish.id = $2`;

            for (const item of cartItems) {
                await client.query(queryUpdateFishWeight, [item.weight, item.id_fish]);
            }

            // commit alias menyimpan perubahan ke database
            await client.query('COMMIT');

            // Hapus cache Redis untuk semua order
            await redis.del(`orders:all:${consumerID}`);

            // Hapus cache Redis untuk keranjang
            await redis.del(`cart:all:${consumerID}`);

            return res.status(201).json({
                id_ordering: consumerID,
                message: "Order details created successfully",
            });
        }
    } catch (err) {
        // rollback alias membatalkan transaksi jika ada error
        if (client) {
            await client.query('ROLLBACK');
        }
        // console.error("Error creating order details:", err);
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