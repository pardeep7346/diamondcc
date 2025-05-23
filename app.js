import express from "express";
import cors from 'cors'
import cookieParser from "cookie-parser" 

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN, 
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}))

app.use(express.json({limit:"16kb"}))
app.use(express.urlencoded({extended:true, limit:"16kb"}))
app.use(express.static("public"))
app.use(cookieParser())
 


// routes
 
import userRouter from './Routes/user.routes.js'
import adminRouter from './Routes/admin.routes.js'
app.use("/users", userRouter); 
app.use("/admin", adminRouter)

export{app}