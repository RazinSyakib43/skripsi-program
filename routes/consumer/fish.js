const express = require("express");
const router = express.Router();

const db = require('../../config/db');
const redis = require('../../config/redis');

// get all fish (cache-aside)
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
            // baru konek ke postgres jika cache miss
            client = await db.connect();

            const query = `
            SELECT 
                f.id AS id_fish, 
                f.name, 
                f.price, 
                s.location, 
                f.photo_url 
            FROM fish f 
            JOIN seller s 
            ON f.id_seller = s.id`;

            const result = await client.query(query);
            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "No fish found",
                });
            }

            // simpan hasil query ke Redis dengan tipe data string
            await redis.set('fish:all', JSON.stringify(result.rows));

            return res.status(200).json({
                message: "Success - All fish (PostgreSQL)",
                data: result.rows,
            });
        }
    } catch (err) {
        // console.error("Error fetching all fish:", err);
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

// get all fish (cache hit)
router.get("/all-cachehit", async (req, res) => {
    try {
        // cek di redis ada gak
        const fishAllCache = await redis.get('fish:all');

        if (!fishAllCache) {
            return res.status(404).json({
                message: "No all fish data cache found",
            });
        }

        const JSONparse = JSON.parse(fishAllCache);
        return res.status(200).json({
            message: "Success - All fish (Redis Cache)",
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

// search fish by name (cache-aside)
router.get("/cari/", async (req, res) => {
    let client;
    const fishName = req.query.namaIkan;
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

            const query = `
            SELECT 
                f.id AS id_fish,
                f.name, f.price,
                s.location,
                f.photo_url
            FROM fish f
            JOIN seller s
            ON f.id_seller = s.id
            WHERE f.name
            ILIKE $1`;

            const result = await client.query(query, [`%${fishName}%`]);
            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "Fish not found",
                });
            }

            // simpan hasil query ke Redis dengan tipe data string
            await redis.set(`fish:search:${fishName}`, JSON.stringify(result.rows));

            return res.status(200).json({
                message: "Success - Search fish (PostgreSQL)",
                data: result.rows,
            });
        }
    }
    catch (err) {
        // console.error("Error searching for fish:", err);
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

// search fish by name (cache hit)
router.get("/cari-cachehit/", async (req, res) => {
    const fishName = req.query.namaIkan;
    try {
        // cek di redis ada gak
        const searchDataRedis = await redis.get(`fish:search:${fishName}`);

        if (!searchDataRedis) {
            return res.status(404).json({
                message: "No search data cache found",
            });
        }

        const JSONparse = JSON.parse(searchDataRedis);
        return res.status(200).json({
            message: "Success - Search fish (Redis Cache)",
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

//  get detail fish (cache-aside)
router.get("/detail/:id", async (req, res) => {
    let client;
    const fishId = req.params.id;
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
                message: `Success - Detail fish ${fishId} (Redis Cache)`,
                data: JSONparse,
            });
        } else if (!fishDetailCache) {
            client = await db.connect();

            const query = `
                SELECT 
                    f.id AS id_fish, 
                    f.name, 
                    f.description,
                    f.price, 
                    s.location, 
                    s.name AS seller_name,
                    f.photo_url,
                    f.id_weight AS id_weight,
                    w.weight
                FROM fish f
                JOIN seller s ON f.id_seller = s.id
                JOIN weight w ON f.id_weight = w.id
                WHERE f.id = $1`;

            const result = await client.query(query, [fishId]);
            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "Fish not found",
                });
            }

            // simpan hasil query ke Redis dengan tipe data string
            await redis.set(`fish:detail:${fishId}`, JSON.stringify(result.rows[0]));

            return res.status(200).json({
                message: `Success - Detail fish ${fishId} (PostgreSQL)`,
                data: result.rows[0],
            });
        }
    } catch (err) {
        // console.error("Error fetching fish details:", err);
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

// get detail fish (cache hit)
router.get("/detail-cachehit/:id", async (req, res) => {
    const fishId = req.params.id;
    try {
        // cek di redis ada gak
        let fishDetailCache = await redis.get(`fish:detail:${fishId}`);

        if (!fishDetailCache) {
            return res.status(404).json({
                message: "No fish detail cache found",
            });
        }

        const JSONparse = JSON.parse(fishDetailCache);
        const weightDetailDB = await db.query(
            `SELECT weight FROM weight WHERE id = $1`,
            [JSONparse.id_weight]
        );

        JSONparse.weight = weightDetailDB.rows[0].weight;

        return res.status(200).json({
            message: `Success - Detail fish ${fishId} (Redis Cache)`,
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