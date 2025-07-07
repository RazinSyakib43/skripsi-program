const express = require("express");

// middleware
const authorization = require("./middleware/authorization");

// consumer
const authConsumerRouter = require("./routes/consumer/auth");
const fishConsumerRouter = require("./routes/consumer/fish");
const cartConsumerRouter = require("./routes/consumer/cart");
const orderConsumerRouter = require("./routes/consumer/order");

// seller
const authSellerRouter = require("./routes/seller/auth");
const orderSellerRouter = require("./routes/seller/order");

// transaction
const transactionRouter = require("./routes/transaction/transaction");

const port = 3000;

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// auth routes
app.use("/auth/consumer", authConsumerRouter);
app.use("/auth/seller", authSellerRouter);

// consumer routes
app.use("/consumer/fish", fishConsumerRouter);
app.use("/consumer/cart", authorization, cartConsumerRouter);
app.use("/consumer/order", authorization, orderConsumerRouter);

// transaction routes
app.use("/transaction", authorization, transactionRouter);

// seller routes
app.use("/seller/order", authorization, orderSellerRouter);

server.listen(port, () => {
  // console.log(`Server is running on port ${port}`);
});

module.exports = app;