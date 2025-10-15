const mongoose = require('mongoose');
const User = require('./models/User');

const verifyUser = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect('mongodb://127.0.0.1:27017/fileapp', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Find the user regardless of verification status
    const user = await User.findOne({ 
      email: 'test@example.com'
    });
    
    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('Current user status:', {
      email: user.email,
      verified: user.verified,
      verificationToken: user.verificationToken ? 'exists' : 'none'
    });

    // Update user verification status directly
    const updateResult = await User.updateOne(
      { _id: user._id },
      { 
        $set: { verified: true },
        $unset: { 
          verificationToken: 1,
          verificationExpires: 1
        }
      }
    );

    console.log('Update result:', updateResult);
    console.log('✅ User verified successfully!');
    console.log('You can now try logging in.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
};

// Run the verification
verifyUser();