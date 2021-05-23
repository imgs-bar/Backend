import {Endpoint, S3} from 'aws-sdk';
import DomainModel from '../models/DomainModel';
import {User} from '../models/UserModel';
import CounterModel from '../models/CounterModel';
import Axios, {Method} from 'axios';
import FileModel from '../models/FileModel';

/**
 * The aws-S3 session.
 */
const s3 = new S3({
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_KEY,
  endpoint: process.env.S3_ENDPOINT,
  s3ForcePathStyle: true, // needed with minio?
  signatureVersion: 'v4',
});
// const s3 = new S3({
//     credentials: {
//         secretAccessKey: process.env.S3_SECRET_KEY,
//         accessKeyId: process.env.S3_ACCESS_KEY_ID,
//     },
//     endpoint: process.env.S3_ENDPOINT,
// });

async function updateStorage() {
  try {
    const storageUsedfiles = await FileModel.aggregate([
      {$group: {_id: null, storageUsed: {$sum: '$rawSize'}}},
    ]);
    const storageUsed = storageUsedfiles[0].storageUsed;
    await CounterModel.findByIdAndUpdate('counter', {
      storageUsed: storageUsed,
    });
    setTimeout(async () => {
      await this.updateStorage();
    }, 300000);
  } catch (err) {
    new Error(err);
  }
}

/**
 * Wipe a user's files.
 * @param {user} user The user's files to wipe.
 * @param {string} dir The directory to delete.
 */
async function wipeFiles(user: User, dir = `${user._id}/`) {
  let count = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const params = {
      Bucket: process.env.S3_BUCKET,
      Prefix: dir,
    };

    params.Prefix = `${user._id}/`;

    const objects = await s3.listObjectsV2(params).promise();

    if (objects.Contents.length !== 0) {
      const deleteParams = {
        Bucket: process.env.S3_BUCKET,
        Delete: {
          Objects: [],
        },
      };

      for (const {Key} of objects.Contents) {
        deleteParams.Delete.Objects.push({Key});
      }

      const deleted = await s3.deleteObjects(deleteParams).promise();
      count += (deleted.Deleted as AWS.S3.DeletedObjects).length;
    }

    if (!objects.IsTruncated) return count;
  }
}

export {s3, wipeFiles, updateStorage};
