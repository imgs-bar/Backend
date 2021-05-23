import {Request, Response, Router} from 'express';
import DomainModel from '../models/DomainModel';
import UserModel from '../models/UserModel';
import AdminAuthMiddleware from '../middlewares/AdminAuthMiddleware';
import FileModel from '../models/FileModel';
import CounterModel from '../models/CounterModel';
import {formatFilesize} from '../utils/FormatUtil';

const router = Router();

router.get('/', AdminAuthMiddleware, async (req: Request, res: Response) => {
  const users = await UserModel.estimatedDocumentCount();
  const blacklists = await UserModel.count({
    'blacklisted.status': true,
  });
  const domains = await DomainModel.estimatedDocumentCount();
  const premium = UserModel.count({
    premium: true,
  });
  const totalFiles = await FileModel.estimatedDocumentCount();

  const {storageUsed} = await CounterModel.findById('counter');

  return res.status(200).json({
    users,
    blacklists,
    domains,
    premium,
    totalFiles,
    storageUsed: formatFilesize(storageUsed),
  });
});

export default router;
