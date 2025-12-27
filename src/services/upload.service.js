const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require('../config/s3');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const { BadRequestError } = require('../utils/errors');
const { ErrorCode } = require('../utils/errorCodes');

class UploadService {
  async uploadAvatar(file, userId) {
    if (!file) {
      throw new BadRequestError(ErrorCode.NO_FILE_UPLOADED);
    }

    // Resize and optimize image
    const optimizedBuffer = await sharp(file.buffer)
      .resize(400, 400, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    const filename = `avatars/${userId}/${uuidv4()}.jpg`;
    const bucketName = process.env.AWS_S3_BUCKET;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: filename,
      Body: optimizedBuffer,
      ContentType: 'image/jpeg',
      // Note: R2 doesn't support ACLs, use bucket-level public access instead
    });

    await s3Client.send(command);

    // Return the public URL
    const baseUrl = process.env.AWS_S3_PUBLIC_URL || `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`;
    return `${baseUrl}/${filename}`;
  }

  async deleteAvatar(avatarUrl) {
    if (!avatarUrl) return;

    try {
      // Extract key from URL
      const url = new URL(avatarUrl);
      const key = url.pathname.substring(1); // Remove leading slash

      const command = new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
      });

      await s3Client.send(command);
    } catch (error) {
      console.error('Error deleting avatar from S3:', error);
    }
  }
}

module.exports = new UploadService();
