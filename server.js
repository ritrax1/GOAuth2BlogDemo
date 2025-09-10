require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const axios = require('axios');
const User = require('./models/user.model');
const Post = require('./models/post.model');

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 })
    .then(() => {
        console.log('MongoDB connected successfully.');
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('MongoDB Connection Failed:', err.message);
        process.exit(1);
    });

const isLoggedIn = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/');
  }
};

app.get('/', (req, res) => {
  res.render('index', { user: req.session.user });
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if(err) {
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

app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  try {
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
    
    const profilePictureUrl = profile.picture;

    let user = await User.findOne({ googleId: profile.id });
    if (!user) {
      user = await User.create({ 
        googleId: profile.id, 
        displayName: profile.name, 
        email: profile.email, 
        profilePictureUrl: profilePictureUrl 
      });
    } else {
      user.profilePictureUrl = profilePictureUrl;
      user.displayName = profile.name;
      await user.save();
    }

    req.session.user = user;
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error during Google OAuth callback:', error.response ? error.response.data : error.message);
    res.redirect('/');
  }
});

app.get('/dashboard', isLoggedIn, async (req, res) => {
    try {
        const posts = await Post.find()
            .populate('author', 'displayName profilePictureUrl')
            .populate('comments.author', 'displayName profilePictureUrl')
            .sort({ createdAt: -1 });
        res.render('dashboard', { user: req.session.user, posts: posts });
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).send("Error fetching posts.");
    }
});

app.get('/posts/new', isLoggedIn, (req, res) => {
    res.render('new-post', { user: req.session.user });
});

app.post('/posts', isLoggedIn, async (req, res) => {
    try {
        const { title, content } = req.body;
        await Post.create({
            title,
            content,
            author: req.session.user._id
        });
        res.redirect('/dashboard');
    } catch (error) {
        console.error("Error creating post:", error);
        res.status(500).send("Failed to create post.");
    }
});

app.get('/posts/:id/edit', isLoggedIn, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post || !post.author.equals(req.session.user._id)) {
            return res.redirect('/dashboard');
        }
        res.render('edit-post', { user: req.session.user, post });
    } catch (error) {
        console.error("Error fetching post for edit:", error);
        res.redirect('/dashboard');
    }
});

app.post('/posts/:id/update', isLoggedIn, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post || !post.author.equals(req.session.user._id)) {
            return res.redirect('/dashboard');
        }
        await Post.findByIdAndUpdate(req.params.id, { title: req.body.title, content: req.body.content });
        res.redirect('/dashboard');
    } catch (error) {
        console.error("Error updating post:", error);
        res.redirect('/dashboard');
    }
});

app.post('/posts/:id/delete', isLoggedIn, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post || !post.author.equals(req.session.user._id)) {
            return res.redirect('/dashboard');
        }
        await Post.findByIdAndDelete(req.params.id);
        res.redirect('/dashboard');
    } catch (error) {
        console.error("Error deleting post:", error);
        res.redirect('/dashboard');
    }
});

app.post('/posts/:id/like', isLoggedIn, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        const userId = req.session.user._id;
        const likeIndex = post.likes.indexOf(userId);

        if (likeIndex > -1) {
            post.likes.splice(likeIndex, 1);
        } else {
            post.likes.push(userId);
        }
        await post.save();

        res.redirect('/dashboard');
    } catch (error) {
        console.error("Error liking/unliking post:", error);
        res.redirect('/dashboard');
    }
});

app.post('/posts/:id/comments', isLoggedIn, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        post.comments.push({
            text: req.body.comment,
            author: req.session.user._id
        });
        await post.save();
        res.redirect('/dashboard');
    } catch (error) {
        console.error("Error adding comment:", error);
        res.redirect('/dashboard');
    }
});