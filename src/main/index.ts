import express from 'express';
import * as bodyParser from 'body-parser';
import {IUpgradeMessage} from '../lib/upgrade-message';
import UpgradeService from '../lib/upgrade-service';
import Environment from '../lib/env-manager';
import cors from 'cors';

const app = express();

app.use(bodyParser.json());
app.use(cors());

app.get('/upgrade', (req, res) => {
    res.status(200).send({
        message: 'Upgrade service working.'
    });
});

app.post('/upgrade', async (req: any, res: any) => {
    console.log(`Post request received`);
    console.log(req.body);

    try {
        const upgradeArr: Array<IUpgradeMessage> = req.body;
        const upgradeService = new UpgradeService(upgradeArr);
        const upgradeResponse = await upgradeService.upgradeDeployment();
        if(upgradeResponse.upgradeResult == UpgradeResult.Success) {
            res.status(200).send({
                message: `Successfuly upgraded ${upgradeResponse.upgradeCount} containers`
            });
        } else {
            res.status(500).send({
                message: `Upgrade failed.`
            });
        }
    } catch (err: any) {
        res.status(500).send({
            message: `Error: ${err}`
        });
    }
});

const port = Environment.getUpgradeServicePort();
app.listen(port);
