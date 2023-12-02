//* Import necessary models
import Comments from "../models/commentModel.js";
import Posts from "../models/postModel.js";
import Users from "../models/userModel.js";

//* Function to create a new post
export const createPost = async (req, res, next) => {
  try {
    const { userId } = req.body.user;
    const { description, image } = req.body;

    //* Check if the description is provided
    if (!description) {
      next("You must provide a description");
      return;
    }

    //* Create a new post in the database
    const post = await Posts.create({
      userId,
      description,
      image,
    });

    res.status(200).json({
      success: true,
      message: "Post created successfully",
      data: post,
    });
  } catch (error) {
    console.log(error);
    res.status(404).json({ message: error.message });
  }
};

//* Function to get posts based on search criteria
export const getPosts = async (req, res, next) => {
  try {
    const { userId } = req.body.user;
    const { search } = req.body;

    //* Find the user and their friends
    const user = await Users.findById(userId);
    const friends = user?.friends?.toString().split(",") ?? [];
    friends.push(userId);

    //* Define a query for searching posts
    const searchPostQuery = {
      $or: [
        {
          description: { $regex: search, $options: "i" },
        },
      ],
    };

    //* Query the database to get posts based on search criteria
    const posts = await Posts.find(search ? searchPostQuery : {})
      .populate({
        path: "userId",
        select: "firstName lastName location profileUrl -password",
      })
      .sort({ _id: -1 });

    //* Filter posts based on friends
    const friendsPosts = posts?.filter((post) => {
      return friends.includes(post?.userId?._id.toString());
    });

    const otherPosts = posts?.filter(
      (post) => !friends.includes(post?.userId?._id.toString())
    );

    let postsRes = null;

    //* Order posts based on friends and others
    if (friendsPosts?.length > 0) {
      postsRes = search ? friendsPosts : [...friendsPosts, ...otherPosts];
    } else {
      postsRes = posts;
    }

    res.status(200).json({
      success: true,
      message: "Successfully",
      data: postsRes,
    });
  } catch (error) {
    console.log(error);
    res.status(404).json({ message: error.message });
  }
};

//* Function to get a specific post
export const getPost = async (req, res, next) => {
  try {
    const { id } = req.params;

    //* Find a specific post by ID and populate user details
    const post = await Posts.findById(id).populate({
      path: "userId",
      select: "firstName lastName location profileUrl -password",
    });

    res.status(200).json({
      success: true,
      message: "Successfully",
      data: post,
    });
  } catch (error) {
    console.log(error);
    res.status(404).json({ message: error.message });
  }
};

//* Function to get posts for a specific user
export const getUserPost = async (req, res, next) => {
  try {
    const { id } = req.params;

    //* Find posts for a specific user by their ID and populate user details
    const post = await Posts.find({ userId: id })
      .populate({
        path: "userId",
        select: "firstName lastName location profileUrl -password",
      })
      .sort({ _id: -1 });

    res.status(200).json({
      success: true,
      message: "Successfully",
      data: post,
    });
  } catch (error) {
    console.log(error);
    res.status(404).json({ message: error.message });
  }
};

//* Function to get comments for a specific post
export const getComments = async (req, res, next) => {
  try {
    const { postId } = req.params;

    //* Find comments for a specific post and populate user details
    const postComments = await Comments.find({ postId })
      .populate({
        path: "userId",
        select: "firstName lastName location profileUrl -password",
      })
      .populate({
        path: "replies.userId",
        select: "firstName lastName location profileUrl -password",
      })
      .sort({ _id: -1 });

    res.status(200).json({
      success: true,
      message: "Successfully",
      data: postComments,
    });
  } catch (error) {
    console.log(error);
    res.status(404).json({ message: error.message });
  }
};

//* Function to like or unlike a post
export const likePost = async (req, res, next) => {
  try {
    const { userId } = req.body.user;
    const { id } = req.params;

    //* Find the post by ID
    const post = await Posts.findById(id);

    //* Check if the user has already liked the post
    const index = post.likes.findIndex((pid) => pid === String(userId));

    //* Toggle the like status
    if (index === -1) {
      post.likes.push(userId);
    } else {
      post.likes = post.likes.filter((pid) => pid !== String(userId));
    }

    //* Update the post in the database
    const newPost = await Posts.findByIdAndUpdate(id, post, {
      new: true,
    });

    res.status(200).json({
      success: true,
      message: "Successfully",
      data: newPost,
    });
  } catch (error) {
    console.log(error);
    res.status(404).json({ message: error.message });
  }
};

//* Function to like or unlike a comment on a post
export const likePostComment = async (req, res, next) => {
  const { userId } = req.body.user;
  const { id, rid } = req.params;

  try {
    //* Check if the request is for a comment or a reply
    if (rid === undefined || rid === null || rid === `false`) {
      //* Find the comment by ID
      const comment = await Comments.findById(id);

      //* Check if the user has already liked the comment
      const index = comment.likes.findIndex((el) => el === String(userId));

      //* Toggle the like status
      if (index === -1) {
        comment.likes.push(userId);
      } else {
        comment.likes = comment.likes.filter((i) => i !== String(userId));
      }

      //* Update the comment in the database
      const updated = await Comments.findByIdAndUpdate(id, comment, {
        new: true,
      });

      res.status(201).json(updated);
    } else {
      //* Find the comment and reply by IDs
      const replyComments = await Comments.findOne(
        { _id: id },
        {
          replies: {
            $elemMatch: {
              _id: rid,
            },
          },
        }
      );

      //* Check if the user has already liked the reply
      const index = replyComments?.replies[0]?.likes.findIndex(
        (i) => i === String(userId)
      );

      //* Toggle the like status
      if (index === -1) {
        replyComments.replies[0].likes.push(userId);
      } else {
        replyComments.replies[0].likes = replyComments.replies[0]?.likes.filter(
          (i) => i !== String(userId)
        );
      }

      //* Update the reply in the comment in the database
      const query = { _id: id, "replies._id": rid };

      const updated = {
        $set: {
          "replies.$.likes": replyComments.replies[0].likes,
        },
      };

      const result = await Comments.updateOne(query, updated, { new: true });

      res.status(201).json(result);
    }
  } catch (error) {
    console.log(error);
    res.status(404).json({ message: error.message });
  }
};

//* Function to add a comment to a post
export const commentPost = async (req, res, next) => {
  try {
    const { comment, from } = req.body;
    const { userId } = req.body.user;
    const { id } = req.params;

    //* Check if the comment is provided
    if (comment === null) {
      return res.status(404).json({ message: "Comment is required." });
    }

    //* Create a new comment
    const newComment = new Comments({ comment, from, userId, postId: id });

    //* Save the new comment
    await newComment.save();

    //* Update the post with the new comment ID
    const post = await Posts.findById(id);

    post.comments.push(newComment._id);

    const updatedPost = await Posts.findByIdAndUpdate(id, post, {
      new: true,
    });

    res.status(201).json(newComment);
  } catch (error) {
    console.log(error);
    res.status(404).json({ message: error.message });
  }
};

//* Function to add a reply to a comment on a post
export const replyPostComment = async (req, res, next) => {
  const { userId } = req.body.user;
  const { comment, replyAt, from } = req.body;
  const { id } = req.params;

  //* Check if the comment is provided
  if (comment === null) {
    return res.status(404).json({ message: "Comment is required." });
  }

  try {
    //* Find the comment by ID
    const commentInfo = await Comments.findById(id);

    //* Add a new reply to the comment
    commentInfo.replies.push({
      comment,
      replyAt,
      from,
      userId,
      created_At: Date.now(),
    });

    //* Save the changes
    commentInfo.save();

    res.status(200).json(commentInfo);
  } catch (error) {
    console.log(error);
    res.status(404).json({ message: error.message });
  }
};

//* Function to delete a post
export const deletePost = async (req, res, next) => {
  try {
    const { id } = req.params;

    //* Delete a post by ID
    await Posts.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Deleted successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(404).json({ message: error.message });
  }
};
