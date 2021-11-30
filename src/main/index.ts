import express from 'express';
import * as bodyParser from 'body-parser';
import {IUpgradeMessage} from '../lib/upgrade-message';
import UpgradeService from '../lib/upgrade-service';
import Environment from '../lib/env-manager';
import cors from 'cors';

const app = express();

// please add a limit to body parser, so we don't end up parsing endless json
app.use(bodyParser.json());
app.use(cors());

// can this be on GET / ?
app.get('/upgrade', (req, res) => {
    // Please use res.json() to make sure your response body has the correct content type
    res.status(200).send({
        message: 'Upgrade service working.'
    });
});

app.post('/upgrade', async (req: any, res: any) => {
    console.log(`Post request received`);
    console.log(req.body);

    try {
        // what happens when the request body does not perfectly match the type?
        // does the user get any useful information about what they should change?
        const upgradeArr: Array<IUpgradeMessage> = req.body;
        const upgradeService = new UpgradeService(upgradeArr);
        const upgradeResponse = await upgradeService.upgradeDeployment();
        // please always use strict equality
        if(upgradeResponse.upgradeResult == UpgradeResult.Success) {
            // please return here and remove the else block
            // also, please use res.json. I think status 200 is sent automatically.
            res.status(200).send({
                message: `Successfuly upgraded ${upgradeResponse.upgradeCount} containers`
            });
        } else {
            // we should log this event
            res.status(500).send({
                message: upgradeResponse.message
            });
        }
    } catch (err: any) {
        // please use res.json
        // also, we should be logging this error, so we can see the complete stack trace.
        res.status(500).send({
            message: `Error: ${err}`
        });
    }
});

app.get('/server-status',async (req: any, res: any) => {
    const upgradeService = new UpgradeService();
    const isDeploymentsReady = await upgradeService.isDeploymentReadyForUpgrades();
    if (isDeploymentsReady.ready) {
        // please return here and remove the else block. Also please use res.json.
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
