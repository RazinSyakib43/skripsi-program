const jwt = require('jsonwebtoken');
const dbreplica = require('../config/dbreplica');

const SECRET_KEY = '77719d1f20ad7752933c6c00c1d18218b3fa3257612378920e93ae1b336ed51e';

async function authorize(req, res, next) {
    let clientReplica;
    try {
        let bearerToken = req.headers.authorization;

        if (bearerToken && bearerToken.startsWith('Bearer ')) {
            bearerToken = bearerToken.slice(7, bearerToken.length);
        } else {
            return res.status(401).send({
                code: 401,
                bearerToken: bearerToken,
                status: "Unauthorized",
                message: "Invalid or missing token. Please login first or register if you don't have an account"
            });
        }

        // console.log("bearerToken", bearerToken);

        const tokenPayload = jwt.verify(bearerToken, SECRET_KEY);
        // console.log("tokenPayload", tokenPayload);

        clientReplica = await dbreplica.connect();

        const tableRole = [tokenPayload.role];
        // console.log("tableRole", tableRole);
        const queryText = `SELECT id FROM ${tableRole} WHERE id = $1`;
        // console.log("queryText", queryText);
        const { rows } = await clientReplica.query(queryText, [tokenPayload.id]);
        // console.log("rows", rows);

        if (rows.length === 0) {
            return res.status(401).send({
                code: 401,
                bearerToken: bearerToken,
                status: "Unauthorized",
                message: "User not found"
            });
        }

        req.user = {
            id: rows[0].id
        };

        next();

    } catch (err) {
        // console.error("Database query error:", err);
        return res.status(500).send({
            code: 500,
            status: "Authorization - Internal Server Error",
            message: err.message
        });
    } finally {
        if (clientReplica) {
            clientReplica.release();
        }
    }
}

module.exports = authorize;