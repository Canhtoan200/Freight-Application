const express = require("express");
const router = require("./src/router/user.routes.js");
const dotenv = require("dotenv");
const app = express();
const PORT = 8080;
dotenv.config();

app.use("/", router);
app.listen(PORT, ()=>{
    console.log(`Server đang lắng nghe http://localhost:${PORT}`);
})