import express from 'express';
import * as bodyParser from 'body-parser';
import {IUpgradeMessage} from '../lib/upgrade-message';
import UpgradeService from '../lib/upgrade-service';

const app = express();

app.use(bodyParser.json());

app.post('/upgrade', async (req: any, res: any) => {
    const upgradeArr: Array<IUpgradeMessage> = req.body;
    const upgradeService = new UpgradeService(upgradeArr);
    await upgradeService.upgradeDeployment();
});

app.listen(5008);
