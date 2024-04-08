import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { hashString } from "./CreateJwt.js";
import Verification from "../models/emailVerification.js";
import PasswordReset from "../models/passwordReset.js";

dotenv.config("./env");

//* Destructure environment variables
const { AUTH_EMAIL, AUTH_PASSWORD, APP_URL } = process.env;

//* Create a Nodemailer transporter with Outlook SMTP settings
let transporter = nodemailer.createTransport({
  // service: "gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: AUTH_EMAIL,
    pass: AUTH_PASSWORD,
  },
});

//* Function to send email for account verification
export const sendVerificationEmail = async (user, res) => {
  //* Destructure user object
  const { _id, email, lastName } = user;

  //* Generate a unique token for email verification
  const token = _id + uuidv4();

  //* Create a verification link
  const link = `http://localhost:8000/users/verify/${_id}/${token}`;

  //* Mail options for the verification email
  const mailOptions = {
    from: AUTH_EMAIL,
    to: email,
    subject: "Email Verification",
    html: `<div style='font-family: Arial, sans-serif; font-size: 20px; color: #333; background-color: #f7f7f7; padding: 20px; border-radius: 5px;'>
    <h3 style="color: rgb(8, 56, 188)">Please verify your email address</h3>
    <hr>
    <h4>Hi ${lastName},</h4>
    <p>
        Please verify your email address so we can know that it's really you.
        <br>
    <p>This link <b>expires in 1 hour</b></p>
    <br>
    <a href=${link} style="color: #fff; padding: 14px; text-decoration: none; background-color: #000;  border-radius: 8px; font-size: 18px;">Verify Email Address</a>
    </p>
    <div style="margin-top: 20px;">
        <h5>Best Regards</h5>
        <h5>SocialUtopia Team</h5>
    </div>
</div>`,
  };

  try {
    //* Hash the token before storing it in the database
    const hashedToken = await hashString(token);

    //* Create a new record in the Verification model
    const newVerifiedEmail = await Verification.create({
      userId: _id,
      token: hashedToken,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });

    //* If the record is created successfully, send the verification email
    if (newVerifiedEmail) {
      transporter
        .sendMail(mailOptions)
        .then(() => {
          res.status(201).send({
            success: "PENDING",
            message:
              "Verification email has been sent to your account. Check your email for further instructions.",
          });
        })
        .catch((err) => {
          console.log(err);
          res.status(404).json({ message: "Something went wrong" });
        });
    }
  } catch (error) {
    console.log(error);
    res.status(404).json({ message: "Something went wrong" });
  }
};

//* Function to send email for password reset
export const resetPasswordLink = async (user, res) => {
  //* Destructure user object
  const { _id, email } = user;

  //* Generate a unique token for password reset
  const token = _id + uuidv4();
  //* Create a password reset link
  const link = APP_URL + "users/reset-password/" + _id + "/" + token;

  //* Mail options for the password reset email
  const mailOptions = {
    from: AUTH_EMAIL,
    to: email,
    subject: "Password Reset",
    html: `<p style="font-family: Arial, sans-serif; font-size: 16px; color: #333; background-color: #f7f7f7; padding: 20px; border-radius: 5px;">
         Password reset link. Please click the link below to reset password.
        <br>
        <p style="font-size: 18px;"><b>This link expires in 10 minutes</b></p>
         <br>
        <a href=${link} style="color: #fff; padding: 10px; text-decoration: none; background-color: #000;  border-radius: 8px; font-size: 18px; ">Reset Password</a>.
    </p>`,
  };

  try {
    //* Hash the token before storing it in the database
    const hashedToken = await hashString(token);

    //* Create a new record in the PasswordReset model
    const resetEmail = await PasswordReset.create({
      userId: _id,
      email: email,
      token: hashedToken,
      createdAt: Date.now(),
      expiresAt: Date.now() + 600000,
    });

    //* If the record is created successfully, send the password reset email
    if (resetEmail) {
      transporter
        .sendMail(mailOptions)
        .then(() => {
          res.status(201).send({
            success: "PENDING",
            message: "Reset Password Link has been sent to your account.",
          });
        })
        .catch((err) => {
          console.log(err);
          res.status(404).json({ message: "Something went wrong" });
        });
    }
  } catch (error) {
    console.log(error);
    res.status(404).json({ message: "Something went wrong" });
  }
};
