/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import express from 'express';
import * as bodyParser from 'body-parser';
import {IUpgradeMessage} from '../lib/upgrade-message';
import UpgradeService from '../lib/upgrade-service';
import Environment from '../lib/env-manager';
import {UpgradeResult} from '../lib/upgrade-result';
import cors from 'cors';

const app = express();

app.use(bodyParser.json({limit: '1mb', type: 'application/json'}));
app.use(cors());

app.get('/', (req, res) => {
    res.status(200).json({
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
        if(upgradeResponse.upgradeResult === UpgradeResult.Success) {
            res.status(200).json({
                message: `Successfuly upgraded ${upgradeResponse.upgradeCount} containers`
            });
        }

        console.error('Error during upgrade.', upgradeResponse.message);
        res.status(500).json({
            message: upgradeResponse.message
        });
    } catch (err: any) {
        console.error('Error during upgrade', err);
        res.status(500).json({
            message: `Error: ${err}`
        });
    }
});

app.get('/server-status',async (req: any, res: any) => {
    const upgradeService = new UpgradeService();
    const isDeploymentsReady = await upgradeService.isDeploymentReadyForUpgrades();
    if (isDeploymentsReady.ready) {
        res.status(200).json({
            ready: isDeploymentsReady.ready,
            message: `Deployment is ready for upgrades`
        });
    }

    res.status(200).json({
        ready: isDeploymentsReady.ready,
        message: `Deployment is not ready for upgrades.
            Not Ready: ${JSON.stringify(isDeploymentsReady.podsNotReady)}`
    });
});

const port = Environment.getUpgradeServicePort();
console.log(`Listening on port ${port}`);

app.listen(port);
