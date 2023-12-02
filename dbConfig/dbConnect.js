import mongoose from "mongoose";


const dbConnection = async () => {
  try {
    const connect = await mongoose.connect(process.env.MONGODB_URL, {
      useUnifiedtopology: true,
      useNewUrlParser: true,
    });

    console.log(`MongoDB Connect: ${connect.connection.host}`);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

export default dbConnection;