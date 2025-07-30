// const User = require('../models/user');
// const jwt = require('jsonwebtoken');

// exports.register = async (req, res) => {
//     const { username, password, role } = req.body;

//     try {
//         const newUser = new User({ username, password, role });
//         await newUser.save();
//         res.status(201).json({ message: 'User registered successfully' });
//     } catch (error) {
//         res.status(500).json({ message: 'Error registering user', error });
//     }
// };

// exports.login = async (req, res) => {
//     const { username, password } = req.body;

//     try {
//         const user = await User.findOne({ username });
//         if (!user || !(await user.comparePassword(password))) {
//             return res.status(401).json({ message: 'Invalid credentials' });
//         }

//         const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
//         res.status(200).json({ token, user: { id: user._id, username: user.username, role: user.role } });
//     } catch (error) {
//         res.status(500).json({ message: 'Error logging in', error });
//     }
// };


// // Remove (kick out) a user - only for administrators
// exports.removeUser = async (req, res) => {
//     // Only admins can kick users
//     if (req.user.role !== 'administrator') {
//         return res.status(403).json({ message: 'Access denied' });
//     }

//     const { userId } = req.params;
//     try {
//         const user = await User.findById(userId);
//         if (!user) {
//             return res.status(404).json({ message: 'User not found' });
//         }
//         if (user.role === 'administrator') {
//             return res.status(403).json({ message: 'Cannot remove another administrator' });
//         }
//         await User.findByIdAndDelete(userId);
//         res.status(200).json({ message: 'User removed successfully' });
//     } catch (error) {
//         res.status(500).json({ message: 'Error removing user', error });
//     }
// };
// exports.getUser = async (req, res) => {
//     try {
//         const user = await User.findById(req.userId).select('-password');
//         if (!user) {
//             return res.status(404).json({ message: 'User not found' });
//         }
//         res.status(200).json(user);
//     } catch (error) {
//         res.status(500).json({ message: 'Error fetching user', error });
//     }
// };