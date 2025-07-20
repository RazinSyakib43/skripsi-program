const express = require("express");
const router = express.Router();

const db = require('../../config/db');
const redis = require('../../config/redis');

router.get("/all", async (req, res) => {
    let client;
    try {
        // cek di redis ada gak
        const fishAllCache = await redis.get('fish:all');

        if (fishAllCache) {
            const JSONparse = JSON.parse(fishAllCache);
            return res.status(200).json({
                message: "Success - All fish (Redis Cache)",
                data: JSONparse,
            });
        } else {
            client = await db.connect();

            const querySelect = await client.query(`SELECT f.id AS id_fish, f.name, f.price, s.location, f.photo_url FROM fish f JOIN seller s ON f.id_seller = s.id`);

            if (querySelect.rows.length === 0) {
                return res.status(404).json({
                    message: "No fish found",
                });
            }
            return res.status(200).json({
                message: "Success - All fish (PostgreSQL)",
                data: querySelect.rows,
            });
        }
    } catch (err) {
        // console.error("Error fetching all fish:", err);
        return res.status(500).json({
            message: "Get All Fish - Internal Server Error",
            error: err.message,
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// get all fish (cache hit)
router.get("/all-cachehit", async (req, res) => {
    try {
        // cek di redis ada gak
        const fishAllCache = await redis.get('fish:all');

        if (!fishAllCache) {
            return res.status(404).json({
                message: "No all fish cache found",
            });
        }

        const JSONparse = JSON.parse(fishAllCache);
        return res.status(200).json({
            message: "Success - All fish 2 (Redis Cache)",
            data: JSONparse,
        });
    } catch (err) {
        // console.error("Error fetching all fish:", err);
        return res.status(500).json({
            message: "Internal Server Error",
            error: err.message,
        });
    }
});

router.get("/cari/", async (req, res) => {
    let client;
    const fishName = req.query.namaIkan;

    if (!fishName) {
        return res.status(400).json({
            message: "Search Fish - Missing fish name",
        });
    }

    try {
        // cek di redis ada gak
        const searchDataRedis = await redis.get(`fish:search:${fishName}`);

        if (searchDataRedis) {
            const JSONparse = JSON.parse(searchDataRedis);
            return res.status(200).json({
                message: "Success - Search fish (Redis Cache)",
                data: JSONparse,
            });
        } else {
            // baru konek ke postgres jika cache miss
            client = await db.connect();

            const querySelect = await client.query(`SELECT f.id AS id_fish, f.name, f.price, s.location, f.photo_url FROM fish f JOIN seller s ON f.id_seller = s.id WHERE f.name ILIKE $1`, [`%${fishName}%`]);

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
        }
    } catch (err) {
        // console.error("Error searching for fish:", err);
        return res.status(500).json({
            message: "Search Fish - Internal Server Error",
            error: err.message,
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// search fish by name (cache hit)
router.get("/cari-cachehit/", async (req, res) => {
    const fishName = req.query.namaIkan;

    if (!fishName) {
        return res.status(400).json({
            message: "Search Fish (cache hit) - Missing fish name",
        });
    }

    try {
        // cek di redis ada gak
        const searchDataRedis = await redis.get(`fish:search:${fishName}`);

        if (!searchDataRedis) {
            return res.status(404).json({
                fishNameKeyword: fishName,
                message: "No search fish cache found",
            });
        }

        const JSONparse = JSON.parse(searchDataRedis);
        return res.status(200).json({
            message: "Success - Search fish 2 (Redis Cache)",
            data: JSONparse,
        });
    } catch (err) {
        // console.error("Error searching for fish:", err);
        return res.status(500).json({
            message: "Internal Server Error",
            error: err.message,
        });
    }
});


router.get("/detail/:id", async (req, res) => {
    let client;
    const fishId = req.params.id;

    if (!fishId) {
        return res.status(400).json({
            message: "Detail Fish - Missing fish ID",
        });
    }

    try {
        // cek di redis ada gak
        let fishDetailCache = await redis.get(`fish:detail:${fishId}`);

        if (fishDetailCache) {
            const JSONparse = JSON.parse(fishDetailCache);
            const weightDetailDB = await db.query(
                `SELECT weight FROM weight WHERE id = $1`,
                [JSONparse.id_weight]
            );

            JSONparse.weight = weightDetailDB.rows[0].weight;

            return res.status(200).json({
                message: `Success - Detail fish (Redis Cache)`,
                data: JSONparse,
            });
        } else {
            client = await db.connect();

            const querySelect = await client.query(`SELECT f.id AS id_fish, f.name, f.description, f.price, s.location, s.name AS seller_name, f.photo_url, f.id_weight AS id_weight,w.weight FROM fish f JOIN seller s ON f.id_seller = s.id JOIN weight w ON f.id_weight = w.id WHERE f.id = $1`, [fishId]);

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
        }
    } catch (err) {
        // console.error("Error fetching fish details:", err);
        return res.status(500).json({
            message: "Detail Fish - Internal Server Error",
            error: err.message,
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// get detail fish (cache hit)
router.get("/detail-cachehit/:id", async (req, res) => {
    const fishId = req.params.id;

    if (!fishId) {
        return res.status(400).json({
            message: "Detail Fish (cache hit) - Missing fish ID",
        });
    }

    try {
        // cek di redis ada gak
        let fishDetailCache = await redis.get(`fish:detail:${fishId}`);

        if (!fishDetailCache) {
            return res.status(404).json({
                fishId: fishId,
                message: "No fish detail cache found",
            });
        }

        const JSONparse = JSON.parse(fishDetailCache);
        const weightDetailDB = await db.query(`SELECT weight FROM weight WHERE id = $1`, [JSONparse.id_weight]);

        JSONparse.weight = weightDetailDB.rows[0].weight;

        return res.status(200).json({
            message: `Success - Detail fish 2 (Redis Cache)`,
            data: JSONparse,
        });
    } catch (err) {
        // console.error("Error fetching fish details:", err);
        return res.status(500).json({
            message: "Internal Server Error",
            error: err.message,
        });
    }
});

module.exports = router;