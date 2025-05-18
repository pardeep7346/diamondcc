import { asyncHandler } from "../Utils/asyncHandler.js";
import { ApiError } from "../Utils/apiErrors.js";
import { User } from "../Models/user.models.js";
import {Admin} from "../Models/admin.models.js"
import { ApiResponse } from "../Utils/apiResponse.js";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import path from 'path';
import fs from 'fs'


const generateAccessAndRefereshTokens = async (userId, model) => {
  try {
    const user = await model.findById(userId);
    if (!user) {
      throw new ApiError(404, `${model.modelName} not found`);
    }
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      `Something went wrong while generating refresh and access token for ${model.modelName}`
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {

  const { fullName, email, course, phoneNumber, password } = req.body;
  //console.log("email: ", email);

  if (
    [fullName, email, course, password].some(
      (field) => field?.trim() === ""
    )
  ) {
    throw new ApiError(400, "All fields are required");
  }
  const existedUser = await User.findOne({ email });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }
  //console.log(req.files);

  const user = await User.create({
    fullName,
    email,
    course,
    phoneNumber,
    password,
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered Successfully"));
});

const fetchUsers = asyncHandler(
  async (req, res) => {
    try {
      const users = await User.find();
    
      res.status(200).json({
        success: true,
        data: users
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching users"
      });
    }
  }
)

const registerAdmin = async (req, res) => {
  try {
    const { fullName, email, password, phoneNumber } = req.body;

    // Validate required fields
    if (!fullName || !email || !password || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: "Admin with this email already exists"
      });
    }

    // Create new admin
    const newAdmin = await Admin.create({
      fullName,
      email: email.toLowerCase(),
      password,
      phoneNumber,
      role: "admin"
    });


    const adminWithoutPassword = await Admin.findById(newAdmin._id).select("-password");

    return res.status(201).json({
      success: true,
      message: "Admin registered successfully",
      data: adminWithoutPassword
    });

  } catch (error) {
    console.error("Admin registration error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error during admin registration"
    });
  }
};

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  // Check User collection
  let user = await User.findOne({ email });
  let model = User;
  let role = "user";

  // If not found, check Admin collection
  if (!user) {
    user = await Admin.findOne({ email });
    model = Admin;
    role = "admin";
  }

  // If no user found in either collection
  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  // Verify password
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  // Generate tokens
  const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
    user._id,
    model
  );

  // Fetch user/admin without sensitive fields
  const loggedInUser = await model
    .findById(user._id)
    .select("-password -refreshToken");

  // Cookie options
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Secure in production
  };

  // Return response with role
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
          role, // Include role for frontend redirection
        },
        "Logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  const model = req.user.role === "admin" ? Admin : User;

  
  const updatedUser = await model.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1, // Remove refreshToken field
      },
    },
    {
      new: true,
    }
  );

  if (!updatedUser) {
    throw new ApiError(404, `${model.modelName} not found`);
  }

  // Cookie options
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Secure only in production
  };

  // Clear cookies and return response
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
      new ApiResponse(
        200,
        { role: req.user.role },
        `${model.modelName} logged out successfully`
      )
    );
});

const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Delete the user
    await User.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message
    });
  }
});


const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefereshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const SendEmail = asyncHandler( async (req, res) => {
  const { name, email, message } = req.body;

  // Server-side validation
  if (!name || !email || !message) {
    return res.status(400).json({ error: "All fields are required." });
  }
  if (!email.includes("@")) {
    return res.status(400).json({ error: "Invalid email address." });
  }
  if (message.length < 5) {
    return res.status(400).json({ error: "Message must be at least 5 characters long." });
  }
 
  // Configure email transport (using Gmail as an example)
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "gagadeep7346@gmail.com",
      pass: "oulu bdxi ffjo hsui",    
    },
  });

  // Email options
  const mailOptions = {
    from: email,
    to: "gagadeep7346@gmail.com", // Your email
    subject: `Contact Form Submission from ${name}`,
    html: `
    <h3>New Contact Form Submission</h3>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Message:</strong></p>
    <p>${message}</p>
  `
  };

  // Send email
  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Thank you for your message! We'll get back to you soon." });
  } catch (error) {
    console.error('Error sending email:', {
      message: error.message,
      code: error.code,
      response: error.response,
      command: error.command,
    });

    // Handle specific nodemailer errors
    if (error.code === 'EAUTH') {
      return res.status(500).json({ error: 'Email authentication failed. Please try again later.' });
    } else if (error.code === 'ECONNECTION') {
      return res.status(500).json({ error: 'Failed to connect to email server. Please try again later.' });
    } else if (error.code === 'EENVELOPE') {
      return res.status(500).json({ error: 'Invalid email address configuration.' });
    } else {
      return res.status(500).json({ error: 'Failed to send email. Please try again later.' });
    }
  }
});

const listPDFs = asyncHandler(async (req, res) => {
  const pdfDir = path.join(process.cwd(), 'pdfs');
  fs.readdir(pdfDir, (err, files) => {
    if (err) {
      throw new ApiError(500, 'Error reading PDF directory');
    }
    const pdfFiles = files.filter((file) => file.endsWith('.pdf'));
    res.json({ success: true, data: pdfFiles });
  });
});

const viewPDF = asyncHandler(async (req, res) => {
  const { filename } = req.params;
  if (!filename.match(/^[a-zA-Z0-9_-]+\.pdf$/)) {
    throw new ApiError(400, 'Invalid PDF filename');
  }

  const pdfPath = path.join(process.cwd(), 'pdfs', filename);
  if (!fs.existsSync(pdfPath)) {
    throw new ApiError(404, 'PDF not found');
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="' + filename + '"');
  res.setHeader('Cache-Control', 'no-cache');

  const stream = fs.createReadStream(pdfPath);
  stream.pipe(res);
});

const downloadPDF = asyncHandler(async (req, res) => {
  const { filename } = req.params;
  if (!filename.match(/^[a-zA-Z0-9_-]+\.pdf$/)) {
    throw new ApiError(400, 'Invalid PDF filename');
  }

  const pdfPath = path.join(process.cwd(), 'pdfs', filename);
  if (!fs.existsSync(pdfPath)) {
    throw new ApiError(404, 'PDF not found');
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
  res.setHeader('Cache-Control', 'no-cache');

  const stream = fs.createReadStream(pdfPath);
  stream.pipe(res);
});


export {
  registerUser,
  loginUser,
  logoutUser,
  deleteUser,
  refreshAccessToken,
  fetchUsers,
  SendEmail,
  registerAdmin,
  listPDFs,
  viewPDF,
  downloadPDF
};
