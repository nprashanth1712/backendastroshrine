import { createTransport } from "nodemailer";
import { ZOHO_MAIL_ADDRESS, ZOHO_MAIL_PASS } from "../../constants/Config";

let transporter = createTransport({
    service: "smtppro.zoho.in",
    host: "smtppro.zoho.in",
    secure: true,
    port: 465,
    auth: {
        user: ZOHO_MAIL_ADDRESS,
        pass: ZOHO_MAIL_PASS,
    },
});

export const initializeMail = async ({
    email,
    mailData,
    attachments,
}: {
    email: string;
    mailData: string;
    attachments: any;
}) => {
     try {
          
          attachments = Object.keys(attachments).map((key) => attachments[key]);
          console.log(attachments)
          attachments = attachments.map((file: any)=>{
               return { filename: file.name, content: file.data };
          });
          for (const [placeholder, value] of Object.entries(mailData)) {
               const regex = new RegExp('{{${placeholder)}}', 'g');
               // modifiedData = 
          }
          const mailOptions = {
               from: "support@astroshrine.com",
               to: email,
               subject: "testting email",
               attachments: attachments,
               html: mailData,
          };
          transporter.sendMail(mailOptions);
    } catch (error) {
          console.log(error);
          throw { statusCode: 400, code: "MAIL_SEND_FAILED", message: error };
    }
};
