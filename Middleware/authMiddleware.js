import { asyncHandler } from "../Utils/asyncHandler.js";
import { ApiError } from "../Utils/apiErrors.js";
import jwt from "jsonwebtoken";
import { User } from "../Models/user.models.js";
import { Admin } from "../Models/admin.models.js";

export const verifyJWT = asyncHandler(async (req, _, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  console.log("Token received in verifyJWT:", token);
  if (!token) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    console.log("ACCESS_TOKEN_SECRET:", process.env.ACCESS_TOKEN_SECRET);
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    console.log("Decoded Token:", decodedToken);

    const model = decodedToken.role === "admin" ? Admin : User;
    const user = await model.findById(decodedToken._id).select("-password -refreshToken");

    if (!user) {
      console.log(`No ${model.modelName} found for ID: ${decodedToken._id}`);
      throw new ApiError(401, "Invalid access token");
    }

    req.user = user;
    console.log("req.user set:", req.user);
    next();
  } catch (error) {
    console.error("JWT verification error:", error.message);
    throw new ApiError(401, error?.message || "Invalid access token");
  }
});




// export const verifyJWT = asyncHandler(async(req, _, next) => {
//     try {
//         const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")
        
//         // console.log(token);
//         if (!token) {
//             throw new ApiError(401, "Unauthorized request")
//         }
    
//         const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    
//         const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
    
//         if (!user) {
            
//             throw new ApiError(401, "Invalid Access Token")
//         }
    
//         req.user = user;
//         next()
//     } catch (error) {
//         throw new ApiError(401, error?.message || "Invalid access token")
//     }
    
// })