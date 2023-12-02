import Verification from "../models/emailVerification.js";
import Users from "../models/userModel.js";
import { compareString, createJWT, hashString } from "../utils/CreateJwt.js";
import PasswordReset from "../models/passwordReset.js";
import { resetPasswordLink } from "../utils/sendEmail.js";
import FriendRequest from "../models/friendRequest.js";

//* Function to handle email verification
export const verifyEmail = async (req, res) => {
  const { userId, token } = req.params;

  try {
    //* Find the verification record in the database
    const result = await Verification.findOne({ userId });

    if (result) {
      const { expiresAt, token: hashedToken } = result;

      //* Check if the verification token has expired
      if (expiresAt < Date.now()) {
        //* If expired, delete user and verification records
        Verification.findOneAndDelete({ userId })
          .then(() => {
            Users.findOneAndDelete({ _id: userId })
              .then(() => {
                const message = "Verification token has expired.";
                res.redirect(`/users/verified?status=error&message=${message}`);
              })
              .catch((err) => {
                res.redirect(`/users/verified?status=error&message=`);
              });
          })
          .catch((error) => {
            console.log(error);
            res.redirect(`/users/verified?message=`);
          });
      } else {
        //* If token is valid, compare it with the hashed token
        compareString(token, hashedToken)
          .then((isMatch) => {
            if (isMatch) {
              //* If match, update user's verified status and delete verification record
              Users.findOneAndUpdate({ _id: userId }, { verified: true })
                .then(() => {
                  Verification.findOneAndDelete({ userId }).then(() => {
                    const message = "Email verified successfully";
                    res.redirect(`/users/verified?status=success&message=${message}`);
                  });
                })
                .catch((err) => {
                  console.log(err);
                  const message = "Verification failed or link is invalid";
                  res.redirect(`/users/verified?status=error&message=${message}`);
                });
            } else {
              //* If token doesn't match, invalid token
              const message = "Verification failed or link is invalid";
              res.redirect(`/users/verified?status=error&message=${message}`);
            }
          })
          .catch((err) => {
            console.log(err);
            res.redirect(`/users/verified?message=`);
          });
      }
    } else {
      //* If no verification record found
      const message = "Invalid verification link. Try again later.";
      res.redirect(`/users/verified?status=error&message=${message}`);
    }
  } catch (error) {
    console.log(err);
    res.redirect(`/users/verified?message=`);
  }
};

//* Function to request a password reset
export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    //* Find the user with the provided email
    const user = await Users.findOne({ email });

    if (!user) {
      //* If user not found, return an error response
      return res.status(404).json({
        status: "FAILED",
        message: "Email address not found.",
      });
    }

    //* Check for an existing password reset request
    const existingRequest = await PasswordReset.findOne({ email });

    if (existingRequest) {
      if (existingRequest.expiresAt > Date.now()) {
        //* If an existing request is still valid, return a response
        return res.status(201).json({
          status: "PENDING",
          message: "Reset password link has already been sent to your email.",
        });
      }
      //* If the existing request has expired, delete it
      await PasswordReset.findOneAndDelete({ email });
    }

    //* Send a new password reset link
    await resetPasswordLink(user, res);
  } catch (error) {
    console.log(error);
    res.status(404).json({ message: error.message });
  }
};

//* Function to handle password reset
export const resetPassword = async (req, res) => {
  const { userId, token } = req.params;

  try {
    //* Find the user by ID
    const user = await Users.findById(userId);

    if (!user) {
      const message = "Invalid password reset link. Try again";
      res.redirect(`/users/resetpassword?status=error&message=${message}`);
    }

    //* Find the password reset record
    const resetPassword = await PasswordReset.findOne({ userId });

    if (!resetPassword) {
      const message = "Invalid password reset link. Try again";
      return res.redirect(`/users/resetpassword?status=error&message=${message}`);
    }

    const { expiresAt, token: resetToken } = resetPassword;

    if (expiresAt < Date.now()) {
      //* If the reset link has expired, return an error response
      const message = "Reset Password link has expired. Please try again";
      res.redirect(`/users/resetpassword?status=error&message=${message}`);
    } else {
      //* If the reset link is still valid, compare the provided token with the stored token
      const isMatch = await compareString(token, resetToken);

      if (!isMatch) {
        //* If tokens don't match, return an error response
        const message = "Invalid reset password link. Please try again";
        res.redirect(`/users/resetpassword?status=error&message=${message}`);
      } else {
        //* If tokens match, redirect to the password reset page
        res.redirect(`/users/resetpassword?type=reset&id=${userId}`);
      }
    }
  } catch (error) {
    console.log(error);
    res.status(404).json({ message: error.message });
  }
};

//* Function to change the user's password
export const changePassword = async (req, res, next) => {
  try {
    const { userId, password } = req.body;

    //* Hash the new password
    const hashedpassword = await hashString(password);

    //* Update the user's password in the database
    const user = await Users.findByIdAndUpdate(
      { _id: userId },
      { password: hashedpassword }
    );

    if (user) {
      //* If the password is updated successfully, delete the password reset link...
      await PasswordReset.findOneAndDelete({ userId });

      res.status(200).json({
        ok: true,
      });
    }
  } catch (error) {
    console.log(error);
    res.status(404).json({ message: error.message });
  }
};

//* Function to get user details
export const getUser = async (req, res, next) => {
  try {
    const { userId } = req.body.user;
    const { id } = req.params;

    //* Find the user by ID and populate the friends field
    const user = await Users.findById(id ?? userId).populate({
      path: "friends",
      select: "-password",
    });

    if (!user) {
      //* If user not found, return a response
      return res.status(200).send({
        message: "User Not Found",
        success: false,
      });
    }

    //* Hide the password field in the response
    user.password = undefined;

    res.status(200).json({
      success: true,
      user: user,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "authentication error",
      success: false,
      error: error.message,
    });
  }
};

//* Function to update user details
export const updateUser = async (req, res, next) => {
  try {
    const { firstName, lastName, location, profileUrl, profession } = req.body;

    //* Check if at least one field is provided
    if (!(firstName || lastName || contact || profession || location)) {
      next("Please provide all required fields");
      return;
    }

    const { userId } = req.body.user;

    //* Create an object with updated user details
    const updateUser = {
      firstName,
      lastName,
      location,
      profileUrl,
      profession,
      _id: userId,
    };

    //* Update the user in the database
    const user = await Users.findByIdAndUpdate(userId, updateUser, {
      new: true,
    });

    //* Populate the friends field in the response
    await user.populate({ path: "friends", select: "-password" });

    //* Create a new JWT token
    const token = createJWT(user?._id);

    //* Hide the password field in the response
    user.password = undefined;

    res.status(200).json({
      sucess: true,
      message: "User updated successfully",
      user,
      token,
    });
  } catch (error) {
    console.log(error);
    res.status(404).json({ message: error.message });
  }
};

//* Function to send a friend request
export const friendRequest = async (req, res, next) => {
  try {
    const { userId } = req.body.user;

    const { requestTo } = req.body;

    //* Check if a friend request already exists
    const requestExist = await FriendRequest.findOne({
      requestFrom: userId,
      requestTo,
    });

    if (requestExist) {
      next("Friend Request already sent.");
      return;
    }

    //* Check if the reverse friend request already exists
    const accountExist = await FriendRequest.findOne({
      requestFrom: requestTo,
      requestTo: userId,
    });

    if (accountExist) {
      next("Friend Request already sent.");
      return;
    }

    //* Create a new friend request
    const newRes = await FriendRequest.create({
      requestTo,
      requestFrom: userId,
    });

    res.status(201).json({
      success: true,
      message: "Friend Request sent successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "auth error",
      success: false,
      error: error.message,
    });
  }
};

//* Function to get pending friend requests
export const getFriendRequest = async (req, res) => {
  try {
    const { userId } = req.body.user;

    //* Find pending friend requests for the user
    const request = await FriendRequest.find({
      requestTo: userId,
      requestStatus: "Pending",
    })
      .populate({
        path: "requestFrom",
        select: "firstName lastName profileUrl profession -password",
      })
      .limit(10)
      .sort({
        _id: -1,
      });

    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "auth error",
      success: false,
      error: error.message,
    });
  }
};

//* Function to accept or reject a friend request
export const acceptRequest = async (req, res, next) => {
  try {
    const id = req.body.user.userId;

    const { rid, status } = req.body;

    //* Find the friend request by ID
    const requestExist = await FriendRequest.findById(rid);

    if (!requestExist) {
      next("No Friend Request Found.");
      return;
    }

    //* Update the status of the friend request
    const newResquest = await FriendRequest.findByIdAndUpdate(
      { _id: rid },
      { requestStatus: status }
    );

    if (status === "Accepted") {
      //* If the request is accepted, update the friends list for both users
      const user = await Users.findById(id);

      user.friends.push(newResquest?.requestFrom);

      await user.save();

      const friend = await Users.findById(newResquest?.requestFrom);

      friend.friends.push(newResquest?.requestTo);

      await friend.save();
    }

    res.status(201).json({
      success: true,
      message: "Friend Request " + status,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "auth error",
      success: false,
      error: error.message,
    });
  }
};

//* Function to record profile views
export const profileViews = async (req, res, next) => {
  try {
    const { userId } = req.body.user;
    const { id } = req.body;

    //* Find the user whose profile is viewed
    const user = await Users.findById(id);

    // Check if the viewer is the same as the user whose profile is being viewed
    if (userId === id) {
      return res.status(400).json({
        success: false,
        message: "You cannot view your own profile.",
      });
    }

    //* Add the viewer's ID to the views array
    user.views.push(userId);

    //* Save the changes
    await user.save();

    res.status(201).json({
      success: true,
      message: "Successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "auth error",
      success: false,
      error: error.message,
    });
  }
};

//* Function to get suggested friends for the user
export const suggestedFriends = async (req, res) => {
  try {
    const { userId } = req.body.user;

    //* Define a query to find suggested friends (users who are not the current user's friends)
    let queryObject = {};

    queryObject._id = { $ne: userId };

    queryObject.friends = { $nin: userId };

    //* Query the database to find suggested friends
    let queryResult = Users.find(queryObject)
      .limit(15)
      .select("firstName lastName profileUrl profession -password");

    const suggestedFriends = await queryResult;

    res.status(200).json({
      success: true,
      data: suggestedFriends,
    });
  } catch (error) {
    console.log(error);
    res.status(404).json({ message: error.message });
  }
};
