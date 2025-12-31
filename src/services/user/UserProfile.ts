import { s3Client, PutObjectCommand } from "../AWSS3";

const updateProfilePic = async ({
  id,
  file,
  role,
}: {
  id: string;
  file: { data: any };
  role: "ASTROLOGER" | "USER";
}) => {
  const fileKey = `${id}/profile_pic.jpg`;
  const bucketParams = {
    Bucket: process.env.AWS_S3_BUCKET_NAME_USER_PUBLIC,
    Key: fileKey,
    Body: file.data,
  };
  if (role == "ASTROLOGER") {
    bucketParams.Bucket = process.env.AWS_S3_BUCKET_ASTROLOGER_PUBLIC;
  }
  try {
    const s3Response = await s3Client.send(new PutObjectCommand(bucketParams));
    console.log("update s3 res: ", s3Response);
    return fileKey;
  } catch (err) {
    console.log("Error uploading profile pic.", err);
    throw {
      statusCode: 500,
      code: "FILE_UPLOAD_FAILED",
      message:
        "Error to upload profile pic for user :" +
        id +
        ". err: " +
        JSON.stringify(err),
    };
  }
};

export { updateProfilePic };
