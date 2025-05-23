import mongoose from "mongoose";


const connectDB = async () => {
    try {
         await mongoose.connect(`${process.env.MONGODB_URI}${process.env.DB_NAME}`)
        console.log(`\n MongoDB connected !! `);
    } catch (error) {
        console.log("MONGODB connection FAILED ", error);
        process.exit(1)
    }
}

export default connectDB