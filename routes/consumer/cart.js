const express = require("express");
const router = express.Router();

const dbutama = require('../../config/dbutama');
const dbreplica = require('../../config/dbreplica');

router.get("/", async (req, res) => {
    let clientReplica;

    const consumerID = req.user.id;

    try {
        clientReplica = await dbreplica.connect();

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
        const result = await clientReplica.query(query, [consumerID]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Cart is empty",
            });
        }
        return res.status(200).json({
            message: "Success - All cart items (PostgreSQL)",
            data: result.rows,
        });
    } catch (err) {
        // console.error("Error fetching cart:", err);
        return res.status(500).json({
            message: "Internal Server Error",
            error: err.message,
        });
    } finally {
        if (clientReplica) {
            clientReplica.release();
        }
    }
});

router.post("/add", async (req, res) => {
    let clientUtama;
    let clientReplica;

    const { id_fish, notes, weight } = req.body;
    const consumerID = req.user.id;

    if (!id_fish || !notes || !weight) {
        return res.status(400).json({
            message: "Add Cart - Missing required fields",
        });
    }

    try {
        clientReplica = await dbreplica.connect();

        // Check jika item sudah ada di keranjangs
        // pakai 1 karena gak butuh datanya, cuma cek datanya ada atau gk
        const checkQuery = `
            SELECT 1 FROM cart 
            WHERE id_fish = $1 AND id_consumer = $2
        `;
        const checkResult = await clientReplica.query(checkQuery, [id_fish, consumerID]);

        clientUtama = await dbutama.connect();
        if (checkResult.rows.length > 0) {
            // Update notes dan weight jika item keranjang sudah ada sebelumnya
            const updateQuery = `
                UPDATE cart 
                    SET notes = $1, weight = weight + $2 
                    WHERE id_fish = $3 AND id_consumer = $4
            `;
            await clientUtama.query(updateQuery, [notes, weight, id_fish, consumerID]);
            return res.status(200).json({
                message: "Cart updated successfully",
            });
        } else {
            // Insert item baru ke keranjang jika belum ada
            const insertQuery = `
                INSERT INTO cart (notes, weight, id_fish, id_consumer) 
                VALUES ($1, $2, $3, $4)
            `;
            await clientUtama.query(insertQuery, [notes, weight, id_fish, consumerID]);
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
        if (clientUtama) {
            clientUtama.release();
        }
        if (clientReplica) {
            clientReplica.release();
        }
    }
});

module.exports = router;