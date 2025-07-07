const jwt = require("jsonwebtoken");

const SECRET_KEY = '77719d1f20ad7752933c6c00c1d18218b3fa3257612378920e93ae1b336ed51e';

async function generateToken(id, role) {
    const result = await jwt.sign({ id, role }, SECRET_KEY, { expiresIn: '365d' });
    return result;
}

module.exports = {
    generateToken
};