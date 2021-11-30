import express from "express";

const app = express();

app.all('/upgrade', async (req: any, res: any) => {
    //Upgrade code
});

app.listen(5008);
