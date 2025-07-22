const express = require("express");
const router = express.Router();

const dbutama = require('../../config/dbutama');
const dbreplica = require('../../config/dbreplica');

router.get("/all", async (req, res) => {
    let clientReplica;
    const consumerID = req.user.id;

    try {
        clientReplica = await dbreplica.connect();
        const querySelect = await clientReplica.query(`SELECT o.id AS id_ordering, o.date, o.status AS delivery_status, JSON_AGG(JSONB_BUILD_OBJECT( 'id_fish', f.id, 'name', f.name, 'price', f.price, 'weight', dor.weight, 'total_price', dor.weight * f.price, 'seller_name', s.name, 'location', s.location)) AS fishes FROM ordering o INNER JOIN detail_ordering dor ON o.id = dor.id_ordering INNER JOIN fish f ON dor.id_fish = f.id INNER JOIN seller s ON f.id_seller = s.id WHERE dor.id_consumer = $1 GROUP BY o.id, o.date, o.status;`, [consumerID]);

        if (querySelect.rows.length === 0) {
            return res.status(404).json({
                consumerID: consumerID,
                message: "No orders consumer found",
            });
        }
        return res.status(200).json({
            message: "Success - All orders consumer (PostgreSQL)",
            data: querySelect.rows,
        });
    } catch (err) {
        // console.error("Error fetching orders:", err);
        return res.status(500).json({
            message: "Get All Orders (Consumer) - Internal Server Error",
            error: err.message,
        });
    } finally {
        if (clientReplica) {
            clientReplica.release();
        }
    }
});

router.post('/create', async (req, res) => {
    let clientUtama;

    const consumerID = req.user.id;
    const { notes, kurir, alamat, invoice_url, latitude, longitude } = req.body;

    if (!notes) {
        return res.status(400).json({
            message: "Create Order - Missing notes field",
        });
    }

    if (!kurir) {
        return res.status(400).json({
            message: "Create Order - Missing kurir field",
        });
    }

    if (!alamat) {
        return res.status(400).json({
            message: "Create Order - Missing alamat field",
        });
    }

    if (!latitude || !longitude) {
        return res.status(400).json({
            message: "Create Order - Missing latitude or longitude field",
        });
    }

    try {
        clientUtama = await dbutama.connect();

        const queryInsert = await clientUtama.query(`INSERT INTO ordering (id_consumer, notes, kurir, alamat, invoice_url, latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id AS id_ordering`, [consumerID, notes, kurir, alamat, invoice_url, latitude, longitude]);
        if (queryInsert.rows.length === 0) {
            return res.status(400).json({
                notes: notes,
                kurir: kurir,
                alamat: alamat,
                latitude: latitude,
                longitude: longitude,
                consumerID: consumerID,
                message: "Failed to create order",
            });
        }

        return res.status(201).json({
            id_ordering: queryInsert.rows[0].id_ordering,
            consumerID: consumerID,
            message: "Order created successfully",
        });
    } catch (err) {
        // console.error("Error creating order:", err);
        return res.status(500).json({
            message: "Create Order - Internal Server Error",
            error: err.message,
        });
    } finally {
        if (clientUtama) {
            clientUtama.release();
        }
    }
});

router.post('/create/detail', async (req, res) => {
    let clientUtama;
    let clientReplica;

    const consumerID = req.user.id;
    const orderingID = req.body.idOrdering;

    if (!orderingID) {
        return res.status(400).json({
            message: "Create Order Detail - Missing idOrdering field",
        });
    }

    try {
        clientReplica = await dbreplica.connect();

        const queryCheckOrdering = await clientReplica.query(`SELECT id FROM ordering WHERE id = $1 AND status = 'PENDING'`, [orderingID]);

        if (queryCheckOrdering.rowCount === 0) {
            return res.status(404).json({
                idOrdering: orderingID,
                message: "No pending order with this ID found",
            });
        }

        const queryGetCart = await clientReplica.query(`SELECT id_fish, weight FROM cart WHERE id_consumer = $1`, [consumerID]);

        if (queryGetCart.rows.length === 0) {
            return res.status(404).json({
                consumerID: consumerID,
                message: "Cart is empty",
            });
        }

        clientUtama = await dbutama.connect();

        // mulai transaksi
        await clientUtama.query('BEGIN');

        const cartItems = queryGetCart.rows;

        // Menambahkan detail order baru dan mengurangi weight dari fish yang dipesan
        for (const item of cartItems) {
            await clientUtama.query(`INSERT INTO detail_ordering (id_consumer, id_ordering, id_fish, weight) VALUES ($1, $2, $3, $4)`, [consumerID, orderingID, item.id_fish, item.weight]);
            await clientUtama.query(`UPDATE weight SET weight = weight - $1 FROM fish WHERE weight.id = fish.id_weight AND fish.id = $2`, [item.weight, item.id_fish]);
        }

        // Menghapus item dari keranjang setelah order dibuat
        await clientUtama.query(`DELETE FROM cart WHERE id_consumer = $1`, [consumerID]);

        // commit alias menyimpan perubahan ke database
        await clientUtama.query('COMMIT');

        return res.status(201).json({
            id_ordering: orderingID,
            consumerID: consumerID,
            message: "Order details created successfully",
        });
    } catch (err) {
        // rollback alias membatalkan transaksi jika ada error
        if (clientUtama) {
            await clientUtama.query('ROLLBACK');
        }
        // console.error("Error creating order details:", err);
        return res.status(500).json({
            message: "Create Order Detail - Internal Server Error",
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