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
                message: upgradeResponse.message
            });
        }
    } catch (err: any) {
        res.status(500).send({
            message: `Error: ${err}`
        });
    }
});

app.get('/server-status',async (req: any, res: any) => {
    const upgradeService = new UpgradeService();
    const isDeploymentsReady = await upgradeService.isDeploymentReadyForUpgrades();
    if (isDeploymentsReady.ready) {
        res.status(200).send({
            ready: isDeploymentsReady.ready,
            message: `Deployment is ready for upgrades`
        });
    } else {
        res.status(200).send({
            ready: isDeploymentsReady.ready,
            message: `Deployment is not ready for upgrades. Image: ${isDeploymentsReady.imageNotReady} is in State: ${isDeploymentsReady.state}`
        });
    }
});

const port = Environment.getUpgradeServicePort();
app.listen(port);
