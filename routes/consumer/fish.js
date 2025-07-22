const express = require("express");
const router = express.Router();

const dbreplica = require('../../config/dbreplica');

router.get("/all", async (req, res) => {
    let clientReplica;
    try {
        clientReplica = await dbreplica.connect();

        const querySelect = await clientReplica.query(`SELECT f.id AS id_fish, f.name, f.price, s.location, f.photo_url FROM fish f JOIN seller s ON f.id_seller = s.id`);

        if (querySelect.rows.length === 0) {
            return res.status(404).json({
                message: "No fish found",
            });
        }
        return res.status(200).json({
            message: "Success - All fish (PostgreSQL)",
            data: querySelect.rows,
        });
    } catch (err) {
        // console.error("Error fetching all fish:", err);
        return res.status(500).json({
            message: "Get All Fish - Internal Server Error",
            error: err.message,
        });
    } finally {
        if (clientReplica) {
            clientReplica.release();
        }
    }
});

router.get("/cari/", async (req, res) => {
    let clientReplica;
    const fishName = req.query.namaIkan;

    if (!fishName) {
        return res.status(400).json({
            message: "Search Fish - Missing fish name",
        });
    }

    try {
        clientReplica = await dbreplica.connect();

        const querySelect = await clientReplica.query(`SELECT f.id AS id_fish, f.name, f.price, s.location, f.photo_url FROM fish f JOIN seller s ON f.id_seller = s.id WHERE f.name ILIKE $1`, [`%${fishName}%`]);

        if (querySelect.rows.length === 0) {
            return res.status(404).json({
                fishNameKeyword: fishName,
                message: "Fish not found",
            });
        }
        return res.status(200).json({
            message: "Success - Search fish (PostgreSQL)",
            data: querySelect.rows,
        });
    } catch (err) {
        // console.error("Error searching for fish:", err);
        return res.status(500).json({
            message: "Search Fish - Internal Server Error",
            error: err.message,
        });
    } finally {
        if (clientReplica) {
            clientReplica.release();
        }
    }
});

router.get("/detail/:id", async (req, res) => {
    let clientReplica;
    const fishId = req.params.id;

    if (!fishId) {
        return res.status(400).json({
            message: "Detail Fish - Missing fish ID",
        });
    }

    try {
        clientReplica = await dbreplica.connect();

        const querySelect = await clientReplica.query(`SELECT f.id AS id_fish, f.name, f.description, f.price, s.location, s.name AS seller_name, f.photo_url, f.id_weight AS id_weight,w.weight FROM fish f JOIN seller s ON f.id_seller = s.id JOIN weight w ON f.id_weight = w.id WHERE f.id = $1`, [fishId]);

        if (querySelect.rows.length === 0) {
            return res.status(404).json({
                fishId: fishId,
                message: "Fish not found",
            });
        }
        return res.status(200).json({
            message: `Success - Detail fish (PostgreSQL)`,
            data: querySelect.rows[0],
        });
    } catch (err) {
        // console.error("Error fetching fish details:", err);
        return res.status(500).json({
            message: "Detail Fish - Internal Server Error",
            error: err.message,
        });
    } finally {
        if (clientReplica) {
            clientReplica.release();
        }
    }
});

module.exports = router;