const express = require("express");
const router = express.Router();

const db = require('../../config/db');
const redis = require('../../config/redis');

router.get("/", async (req, res) => {
    let client;
    try {
        const consumerID = req.user.id;

        const cartAllCache = await redis.get(`cart:all:${consumerID}`);

        if (cartAllCache) {
            const JSONparse = JSON.parse(cartAllCache);
            return res.status(200).json({
                length: JSONparse.length,
                message: "Success - All cart items (Redis Cache)",
                data: JSONparse,
            });
        } else {
            // baru konek ke postgres jika cache miss
            client = await db.connect();

            const query = `
            SELECT 
                c.id AS id_cart, 
                c.notes, 
                c.weight, 
                f.id AS id_fish, 
                f.name, 
                f.price, 
                s.name AS seller_name,
                s.location, 
                f.photo_url
            FROM cart c
            JOIN fish f ON c.id_fish = f.id
            JOIN seller s ON f.id_seller = s.id
            WHERE c.id_consumer = $1
        `;
            const result = await client.query(query, [consumerID]);
            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "Cart is empty",
                });
            }

            await redis.set(`cart:all:${consumerID}`, JSON.stringify(result.rows));

            return res.status(200).json({
                length: result.rows.length,
                message: "Success - All cart items (PostgreSQL)",
                data: result.rows,
            });
        }
    } catch (err) {
        // console.error("Error fetching cart:", err);
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

router.get("/cachehit", async (req, res) => {
    try {
        const consumerID = req.user.id;

        const cartAllCache = await redis.get(`cart:all:${consumerID}`);

        if (!cartAllCache) {
            return res.status(404).json({
                message: "No cart data cache found",
            });
        }

        const JSONparse = JSON.parse(cartAllCache);
        return res.status(200).json({
            length: JSONparse.length,
            message: "Success - All cart items (Redis Cache)",
            data: JSONparse,
        });
    } catch (err) {
        // console.error("Error fetching cart:", err);
        return res.status(500).json({
            message: "Internal Server Error",
            error: err.message,
        });
    }
});

router.post("/add", async (req, res) => {
    let client;
    try {
        const { id_fish, notes, weight } = req.body;
        const consumerID = req.user.id;

        client = await db.connect();

        // Check jika item sudah ada di keranjangs
        // pakai 1 karena gak butuh datanya, cuma cek datanya ada atau gk
        const checkQuery = `
            SELECT 1 FROM cart 
            WHERE id_fish = $1 AND id_consumer = $2
        `;
        const checkResult = await client.query(checkQuery, [id_fish, consumerID]);

        if (checkResult.rows.length > 0) {
            // Update notes dan weight jika item keranjang sudah ada sebelumnya
            const updateQuery = `
                UPDATE cart 
                SET notes = $1, weight = weight + $2 
                WHERE id_fish = $3 AND id_consumer = $4
            `;
            await client.query(updateQuery, [notes, weight, id_fish, consumerID]);

            // Hapus cache Redis untuk keranjang semua item
            await redis.del(`cart:all:${consumerID}`);

            return res.status(200).json({
                message: "Cart updated successfully",
            });
        } else {
            // Insert item baru ke keranjang jika belum ada
            const insertQuery = `
                INSERT INTO cart (notes, weight, id_fish, id_consumer) 
                VALUES ($1, $2, $3, $4)
            `;
            await client.query(insertQuery, [notes, weight, id_fish, consumerID]);
            return res.status(201).json({
                message: "Item added to cart successfully",
            });
        }
    } catch (err) {
        // console.error("Error adding to cart:", err);
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