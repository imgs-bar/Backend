import {Request, Response, Router} from 'express';
import {upload} from '../utils/MulterUtil';
import {s3, wipeFiles} from '../utils/S3Util';
import {formatEmbed, formatFakeUrl, formatFilesize} from '../utils/FormatUtil';
import {generateInvisibleId, generateString, generateRandomEmojis} from '../utils/GenerateUtil';
import {DocumentType} from '@typegoose/typegoose';
import {PassThrough} from 'stream';
import UploadMiddleware from '../middlewares/UploadMiddleware';
import FileModel, {File} from '../models/FileModel';
import UserModel, {User} from '../models/UserModel';
import InvisibleUrlModel from '../models/InvisibleUrlModel';
import EmojiUrlModel from '../models/EmojiUrlModel';
import ValidationMiddleware from '../middlewares/ValidationMiddleware';
import DeletionSchema from '../schemas/DeletionSchema';
import ConfigSchema from '../schemas/ConfigSchema';
import AuthMiddleware from '../middlewares/AuthMiddleware';
import Archiver from 'archiver';
import {extname} from 'path';
import CounterModel from '../models/CounterModel';
import AdminAuthMiddleware from '../middlewares/AdminAuthMiddleware';
import {sendFileArchive} from '../utils/MailUtil';

const rateLimit = require('express-rate-limit');

const router = Router();
const fileLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 3,
});

router.post(
  '/',
  fileLimiter,
  UploadMiddleware,
  upload.single('file'),
  async (req: Request, res: Response) => {
    let {
      file,
      // eslint-disable-next-line prefer-const
      user,
    }: {
      file: Express.Multer.File | DocumentType<File>;
      user: User;
    } = req;

    if (!file)
      return res.status(400).json({
        success: false,
        error: 'provide a file',
      });

    if ((file.size > 52428800 && !user.premium) || file.size > 104857600)
      return res.sendStatus(413).json({
        success: false,
        error: `your file is too large, your upload limit is: ${
          user.premium ? '100' : '50'
        } MB`,
      });

    const {
      domain,
      randomDomain,
      embed,
      showLink,
      invisibleUrl,
      emojiUrl,
      fakeUrl,
      longUrl,
    } = user.settings;

    let baseUrl = req.headers.domain
      ? req.headers.domain
      : `${
          domain.subdomain && domain.subdomain !== ''
            ? `${domain.subdomain}.`
            : ''
        }${domain.name}`;

    if (
      req.headers.randomdomain
        ? req.headers.randomdomain === 'true'
        : randomDomain.enabled
    )
      baseUrl =
        randomDomain.domains.length > 0
          ? randomDomain.domains[
              Math.floor(Math.random() * randomDomain.domains.length)
            ]
          : baseUrl;

    const fileWithSameHash = await FileModel.findOne({
      hash: file.hash,
      'uploader.uuid': user._id,
    });
    if (fileWithSameHash) {
      fileWithSameHash.embed = formatEmbed(embed, user, fileWithSameHash);
      await fileWithSameHash.save();
      return res.status(200).json({
        success: true,
        imageUrl: `https://${baseUrl}/${fileWithSameHash.filename}`,
        deletionUrl: `https://imgs.bar/api/files/delete?key=${fileWithSameHash.deletionKey}`,
      });
    }

    let imageUrl = `https://${baseUrl}/${file.filename}`;

    const deletionKey = generateString(40);
    const deletionUrl = `https://imgs.bar/api/files/delete?key=${deletionKey}`;
    const timestamp = new Date();

    file = new FileModel({
      filename: file.filename,
      key: file.key,
      timestamp,
      mimetype: file.mimetype,
      domain: baseUrl,
      size: formatFilesize(file.size),
      rawSize: file.size,
      hash: file.hash,
      deletionKey,
      embed,
      showLink,
      uploader: {
        uuid: user._id,
        username: user.username,
      },
    });

    file.embed = formatEmbed(embed, user, file);

    await file.save();

    if (
      req.headers.invisibleurl
        ? req.headers.invisibleurl === 'true'
        : invisibleUrl
    ) {
      const invisibleUrlId = longUrl
        ? generateInvisibleId(50)
        : generateInvisibleId(25);

      await InvisibleUrlModel.create({
        _id: invisibleUrlId,
        filename: file.filename,
        uploader: user._id,
      });

      imageUrl = `https://${baseUrl}/${invisibleUrlId}`;
    }
    if (
      req.headers.emojiurl
        ? req.headers.emojiurl === 'true'
        : emojiUrl
    ) {
      const emojiUrlId = emojiUrl
        ? generateRandomEmojis(25)
        : generateRandomEmojis(10);

      await EmojiUrlModel.create({
        _id: emojiUrlId,
        filename: file.filename,
        uploader: user._id,
      });

      imageUrl = `https://${baseUrl}/${emojiUrlId}`;
    }
    if (fakeUrl && fakeUrl.enabled) {
      imageUrl =
        (isValidHttpUrl(formatFakeUrl(fakeUrl.url, user, file))
          ? '<' + formatFakeUrl(fakeUrl.url, user, file) + '>'
          : formatFakeUrl(fakeUrl.url, user, file)) +
        '||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​|| ' +
        imageUrl;
    }
    await UserModel.findByIdAndUpdate(user._id, {
      $inc: {
        uploads: +1,
      },
    });
    return res.status(200).json({
      success: true,
      imageUrl,
      deletionUrl,
    });
  }
);

function isValidHttpUrl(string: string) {
  let url;

  try {
    // eslint-disable-next-line node/no-unsupported-features/node-builtins
    url = new URL(string);
  } catch (_) {
    return false;
  }

  return url.protocol === 'http:' || url.protocol === 'https:';
}

router.get(
  '/delete',
  ValidationMiddleware(DeletionSchema, 'query'),
  async (req: Request, res: Response) => {
    const deletionKey = req.query.key as string;
    const file = await FileModel.findOne({deletionKey});

    if (!file)
      return res.status(404).json({
        success: false,
        error: 'invalid deletion key',
      });

    const user = await UserModel.findById(file.uploader.uuid);

    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: file.key,
    };

    try {
      await s3.deleteObject(params).promise();

      if (user.uploads > 0)
        await UserModel.findByIdAndUpdate(user._id, {
          $inc: {
            uploads: -1,
          },
        });

      await file.remove();

      res.status(200).json({
        success: true,
        message: 'deleted file successfully',
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
);

router.delete('/:id', AuthMiddleware, async (req: Request, res: Response) => {
  const {id} = req.params;
  const {user} = req;

  const file = await FileModel.findOne({filename: id});

  if (!file)
    return res.status(404).json({
      success: false,
      error: 'invalid file',
    });
  if (user._id !== file.uploader.uuid)
    return res.status(404).json({
      success: false,
      error: 'not your file',
    });

  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: file.key,
  };

  try {
    await s3.deleteObject(params).promise();

    if (user.uploads > 0)
      await UserModel.findByIdAndUpdate(user._id, {
        $inc: {
          uploads: -1,
        },
      });

    await file.remove();

    res.status(200).json({
      success: true,
      message: 'deleted file successfully',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

router.post('/wipe', AuthMiddleware, async (req: Request, res: Response) => {
  const {user} = req;

  try {
    const count = await wipeFiles(user);

    await FileModel.deleteMany({
      'uploader.uuid': user._id,
    });

    await InvisibleUrlModel.deleteMany({
      uploader: user._id,
    });

    await EmojiUrlModel.deleteMany({
      uploader: user._id,
    });

    await UserModel.findByIdAndUpdate(user._id, {
      uploads: 0,
    });

    res.status(200).json({
      success: true,
      message: `wiped ${count} files successfully`,
      count,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

router.get(
  '/config',
  ValidationMiddleware(ConfigSchema, 'query'),
  async (req: Request, res: Response) => {
    const key = req.query.key as string;
    const user = await UserModel.findOne({key});

    if (!user)
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
      });

    const config = {
      Name: 'imgs.bar file uploader',
      DestinationType: 'ImageUploader, FileUploader',
      RequestType: 'POST',
      RequestURL: 'https://api.imgs.bar/files',
      FileFormName: 'file',
      Body: 'MultipartFormData',
      Headers: {
        key,
      },
      URL: '$json:imageUrl$',
      DeletionURL: '$json:deletionUrl$',
      ErrorMessage: '$json:error$',
    };

    res.set('Content-Disposition', 'attachment; filename=imgs.bar.sxcu');
    res.send(Buffer.from(JSON.stringify(config, null, 2), 'utf8'));
  }
);

function writeStream(key: string) {
  const passThrough = new PassThrough();

  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: passThrough,
    ACL: 'public-read',
  };

  return {
    passThrough,
    uploaded: s3.upload(params, err => {
      throw new Error(err);
    }),
  };
}

router.get('/archive', AuthMiddleware, async (req: Request, res: Response) => {
  const {user} = req;

  if (user.uploads <= 0)
    return res.status(400).json({
      success: false,
      error: "you haven't uploaded any files",
    });

  try {
    const now = Date.now();
    const difference =
      user.lastFileArchive && now - user.lastFileArchive.getTime();
    const duration = 43200000 - difference;

    if (user.lastFileArchive && duration > 0) {
      const hours = Math.floor(duration / 1000 / 60 / 60);
      const minutes = Math.floor((duration / 1000 / 60 / 60 - hours) * 60);
      const timeLeft = `${hours} hours and ${minutes} minutes`;

      res.status(400).json({
        success: false,
        error: `you cannot create a file archive for another ${timeLeft}`,
      });

      return;
    }

    const params = {
      Bucket: process.env.S3_BUCKET,
      Prefix: `${user._id}/`,
    };

    const objects = await s3.listObjectsV2(params).promise();
    const streams = objects.Contents.map(object => {
      return {
        stream: s3
          .getObject({Bucket: process.env.S3_BUCKET, Key: object.Key})
          .createReadStream(),
        object: object,
      };
    });

    const {passThrough, uploaded} = writeStream(
      `${user._id}/${generateString(5)}.zip`
    );

    await new Promise((resolve, reject) => {
      const archive = Archiver('zip');

      archive.on('error', err => {
        throw new Error(err.message);
      });

      passThrough.on('close', resolve);
      passThrough.on('end', resolve);
      passThrough.on('error', reject);

      archive.pipe(passThrough);

      let i = 1;

      streams.forEach(ctx => {
        if (
          !ctx.object.Key.endsWith('/') &&
          extname(ctx.object.Key) !== '.zip'
        ) {
          archive.append(ctx.stream, {
            name: i.toString() + extname(ctx.object.Key),
          });

          i++;
        }
      });

      archive.finalize();
    }).catch(err => {
      throw new Error(err);
    });

    const {Key} = await uploaded.promise();
    const Location = `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${Key}`;

    await sendFileArchive(
      user,
      s3.getObject({Bucket: process.env.S3_BUCKET, Key}).createReadStream()
    );

    await UserModel.findByIdAndUpdate(user._id, {
      lastFileArchive: new Date(),
    });

    res.status(200).json({
      success: true,
      message: 'sent archive to your email successfully',
      directLink: Location,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;
