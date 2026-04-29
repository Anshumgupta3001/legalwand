const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = () => process.env.AWS_S3_BUCKET;
const EXPIRY  = () => parseInt(process.env.AWS_S3_PRESIGNED_URL_EXPIRY, 10) || 3600;

/* Upload buffer to S3 — returns the key (never a public URL) */
const uploadToS3 = async (buffer, key, mimetype) => {
  await s3.send(new PutObjectCommand({
    Bucket:      BUCKET(),
    Key:         key,
    Body:        buffer,
    ContentType: mimetype,
  }));
  return key;
};

/* Generate a temporary pre-signed GET URL for a private object */
const getPresignedUrl = async (key) => {
  const command = new GetObjectCommand({ Bucket: BUCKET(), Key: key });
  return getSignedUrl(s3, command, { expiresIn: EXPIRY() });
};

module.exports = { uploadToS3, getPresignedUrl };
