const bcrypt = require('bcryptjs');

const salt = 10;

async function encryptPassword(password) {
    try {
        const hashedPassword = await bcrypt.hash(password, salt);
        return hashedPassword;
    } catch (err) {
        throw new Error('Error encrypting password');
    }
}

async function checkPassword(encryptedPassword, password) {
    try {
        // console.log("Encrypted password:", encryptedPassword);
        // console.log("Plain password:", password);

        const isMatch = await bcrypt.compare(password, encryptedPassword);
        return isMatch;
    } catch (err) {
        throw new Error('Error comparing passwords');
    }
}

module.exports = {
    encryptPassword,
    checkPassword
};