require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const axios = require('axios');
const User = require('./models/user.model');
const Post = require('./models/post.model');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

 app.use((req, res, next) => {
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

 app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

 const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000
        });
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection Failed:', error.message);
        process.exit(1);
    }
};

connectDB();

 const isLoggedIn = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/');
    }
};

 const handleAsync = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

 app.get('/', (req, res) => {
    res.render('index', { user: req.session.user });
});

 app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Session destruction error:", err);
            return res.redirect('/dashboard');
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

 app.get('/auth/google', (req, res) => {
    const oauth2ClientUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&response_type=code&scope=profile email`;
    res.redirect(oauth2ClientUrl);
});

 app.get('/auth/google/callback', handleAsync(async (req, res) => {
    const { code } = req.query;

    if (!code) {
        console.error('No authorization code received');
        return res.redirect('/');
    }

    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
    });

    const { access_token } = tokenResponse.data;
    const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
    });

    const profile = userInfoResponse.data;

    let user = await User.findOne({ googleId: profile.id });
    if (!user) {
        user = await User.create({
            googleId: profile.id,
            displayName: profile.name,
            email: profile.email,
            profilePictureUrl: profile.picture
        });
    } else {
         user.profilePictureUrl = profile.picture;
        user.displayName = profile.name;
        user.email = profile.email;
        await user.save();
    }

    req.session.user = user;
    res.redirect('/dashboard');
}));

 app.get('/profile', isLoggedIn, handleAsync(async (req, res) => {
    const userId = req.session.user._id;

     const userPostsCount = await Post.countDocuments({ author: userId });

     const userPosts = await Post.find({ author: userId });
    const totalLikes = userPosts.reduce((sum, post) => sum + (post.likes ? post.likes.length : 0), 0);

    res.render('profile', {
        user: req.session.user,
        postsCount: userPostsCount,
        totalLikes: totalLikes
    });
}));

 app.get('/dashboard', isLoggedIn, handleAsync(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find()
        .populate('author', 'displayName profilePictureUrl')
        .populate('comments.author', 'displayName profilePictureUrl')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    res.render('dashboard', {
        user: req.session.user,
        posts: posts,
        currentPage: page
    });
}));

 app.get('/posts/new', isLoggedIn, (req, res) => {
    res.render('new-post', { user: req.session.user });
});

 app.post('/posts', isLoggedIn, handleAsync(async (req, res) => {
    const { title, content } = req.body;

    if (!title?.trim() || !content?.trim()) {
        return res.status(400).send("Title and content are required.");
    }

    await Post.create({
        title: title.trim(),
        content: content.trim(),
        author: req.session.user._id
    });

    res.redirect('/dashboard');
}));

 app.get('/posts/:id/edit', isLoggedIn, handleAsync(async (req, res) => {
    const post = await Post.findById(req.params.id);

    if (!post) {
        return res.status(404).send("Post not found.");
    }

    if (!post.author.equals(req.session.user._id)) {
        return res.status(403).send("You can only edit your own posts.");
    }

    res.render('edit-post', { user: req.session.user, post });
}));

 app.post('/posts/:id/update', isLoggedIn, handleAsync(async (req, res) => {
    const { title, content } = req.body;

    if (!title?.trim() || !content?.trim()) {
        return res.status(400).send("Title and content are required.");
    }

    const post = await Post.findById(req.params.id);

    if (!post || !post.author.equals(req.session.user._id)) {
        return res.redirect('/dashboard');
    }

    await Post.findByIdAndUpdate(req.params.id, {
        title: title.trim(),
        content: content.trim()
    });

    res.redirect('/dashboard');
}));

 app.post('/posts/:id/delete', isLoggedIn, handleAsync(async (req, res) => {
    const post = await Post.findById(req.params.id);

    if (!post || !post.author.equals(req.session.user._id)) {
        return res.redirect('/dashboard');
    }

    await Post.findByIdAndDelete(req.params.id);
    res.redirect('/dashboard');
}));

 app.post('/api/posts/:id/like', isLoggedIn, handleAsync(async (req, res) => {
    const post = await Post.findById(req.params.id);

    if (!post) {
        return res.status(404).json({ error: 'Post not found' });
    }

    const userId = req.session.user._id;
    const likeIndex = post.likes.indexOf(userId);
    let liked = false;

    if (likeIndex > -1) {
        post.likes.splice(likeIndex, 1);
    } else {
        post.likes.push(userId);
        liked = true;
    }

    await post.save();

    res.json({
        liked: liked,
        likeCount: post.likes.length
    });
}));

 app.post('/posts/:id/like', isLoggedIn, handleAsync(async (req, res) => {
    const post = await Post.findById(req.params.id);

    if (!post) {
        return res.redirect('/dashboard');
    }

    const userId = req.session.user._id;
    const likeIndex = post.likes.indexOf(userId);

    if (likeIndex > -1) {
        post.likes.splice(likeIndex, 1);
    } else {
        post.likes.push(userId);
    }

    await post.save();
    res.redirect('/dashboard');
}));

 app.post('/posts/:id/comments', isLoggedIn, handleAsync(async (req, res) => {
    const { comment } = req.body;

    if (!comment?.trim()) {
        return res.redirect('/dashboard');
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
        return res.redirect('/dashboard');
    }

    post.comments.push({
        text: comment.trim(),
        author: req.session.user._id
    });

    await post.save();
    res.redirect('/dashboard');
}));

 app.use((error, req, res, next) => {
    console.error('Error:', error);

    if (error.name === 'ValidationError') {
        return res.status(400).send('Validation Error: ' + error.message);
    }

    if (error.name === 'CastError') {
        return res.status(400).send('Invalid ID format');
    }

    res.status(500).send('Something went wrong. Please try again.');
});


app.use('*', (req, res) => {
    res.status(404).send('Page not found');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down');
    mongoose.connection.close(() => {
        console.log('MongoDB connection closed');
        process.exit(0);
    });
});
