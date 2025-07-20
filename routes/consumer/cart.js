const express = require("express");
const router = express.Router();

const db = require('../../config/db');
const redis = require('../../config/redis');

router.get("/", async (req, res) => {
    let client;

    const consumerID = req.user.id;

    try {
        const cartAllCache = await redis.get(`cart:all:${consumerID}`);

        if (cartAllCache) {
            const JSONparse = JSON.parse(cartAllCache);
            return res.status(200).json({
                message: "Success - All cart items (Redis Cache)",
                data: JSONparse,
            });
        } else {
            // baru konek ke postgres jika cache miss
            client = await db.connect();

            const querySelect = await client.query(`SELECT c.id AS id_cart, c.notes, c.weight, f.id AS id_fish, f.name, f.price, s.name AS seller_name,s.location, f.photo_url FROM cart c JOIN fish f ON c.id_fish = f.id JOIN seller s ON f.id_seller = s.id WHERE c.id_consumer = $1`, [consumerID]);
            if (querySelect.rows.length === 0) {
                return res.status(404).json({
                    consumerID: consumerID,
                    message: "Cart is empty",
                });
            }

            await redis.set(`cart:all:${consumerID}`, JSON.stringify(result.rows));

            return res.status(200).json({
                message: "Success - All cart items (PostgreSQL)",
                data: querySelect.rows,
            });
        }
    } catch (err) {
        // console.error("Error fetching cart:", err);
        return res.status(500).json({
            message: "Get All Cart - Internal Server Error",
            error: err.message,
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

router.get("/cachehit", async (req, res) => {
    const consumerID = req.user.id;

    try {
        const cartAllCache = await redis.get(`cart:all:${consumerID}`);

        if (!cartAllCache) {
            return res.status(404).json({
                consumerID: consumerID,
                message: "No cart cache found",
            });
        }

        const JSONparse = JSON.parse(cartAllCache);
        return res.status(200).json({
            message: "Success - All cart items 2 (Redis Cache)",
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

    const { id_fish, notes, weight } = req.body;
    const consumerID = req.user.id;

    if (!id_fish) {
        return res.status(400).json({
            message: "Add to Cart - Missing id_fish field",
        });
    }

    if (!notes) {
        return res.status(400).json({
            message: "Add to Cart - Missing notes field",
        });
    }

    if (!weight) {
        return res.status(400).json({
            message: "Add to Cart - Missing weight field",
        });
    }

    try {
        client = await db.connect();

        // Check jika item sudah ada di keranjangs
        // pakai 1 karena gak butuh datanya, cuma cek datanya ada atau gk
        const checkQuery = await client.query(`SELECT 1 FROM cart WHERE id_fish = $1 AND id_consumer = $2`, [id_fish, consumerID]);

        if (checkQuery.rows.length > 0) {
            // Update notes dan weight jika item keranjang sudah ada sebelumnya

            const queryUpdate = await client.query(`UPDATE cart SET notes = $1, weight = weight + $2 WHERE id_fish = $3 AND id_consumer = $4 RETURNING id`, [notes, weight, id_fish, consumerID]);
            if (queryUpdate.rowCount === 0) {
                return res.status(404).json({
                    message: "Cart item not found for update",
                });
            }

            // Hapus cache Redis untuk keranjang semua item
            await redis.del(`cart:all:${consumerID}`);

            return res.status(200).json({
                id_cart: checkQuery.rows[0].id,
                message: "Cart updated successfully",
            });
        } else {
            // Insert item baru ke keranjang jika belum ada
            const queryInsert = await client.query(`INSERT INTO cart (notes, weight, id_fish, id_consumer) VALUES ($1, $2, $3, $4)`, [notes, weight, id_fish, consumerID]);
            if (queryInsert.rowCount === 0) {
                return res.status(400).json({
                    id_fish: id_fish,
                    notes: notes,
                    weight: weight,
                    consumerID: consumerID,
                    message: "Failed to add item to cart",
                });
            }
            return res.status(201).json({
                message: "Item added to cart successfully",
            });
        }
    } catch (err) {
        // console.error("Error adding to cart:", err);
        return res.status(500).json({
            message: "Add to Cart - Internal Server Error",
            error: err.message,
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

module.exports = router;