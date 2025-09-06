// Import what we need (necessary modules)
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const axios = require('axios');
const User = require('./models/user.model');
const Post = require('./models/post.model'); 

//initialize the app
const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// database connection process
let db;
mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 })
    .then(() => {
        console.log('MongoDB connected successfully.');
        db = mongoose.connection;
        // ensures that this worsks only when the database is connected
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
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
        if(err) return res.redirect('/dashboard');
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

app.get('/auth/google', (req, res) => {
  const oauth2Client = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&response_type=code&scope=profile email`;
  res.redirect(oauth2Client);
});

app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, code, redirect_uri: process.env.GOOGLE_REDIRECT_URI, grant_type: 'authorization_code',
    });
    const { access_token } = tokenResponse.data;
    const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const profile = userInfoResponse.data;
    let user = await User.findOne({ googleId: profile.id });
    if (!user) {
      user = await User.create({ googleId: profile.id, displayName: profile.name, email: profile.email, profilePictureUrl: profile.picture });
    }
    req.session.user = user;
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error during Google OAuth callback:', error.response ? error.response.data : error.message);
    res.redirect('/');
  }
});


// Home dashboard that shows all posts
app.get('/dashboard', isLoggedIn, async (req, res) => {
    try {
        const posts = await Post.find()
            .populate('author', 'displayName profilePictureUrl')
            .populate('comments.author', 'displayName profilePictureUrl')
            .sort({ createdAt: -1 });
        res.render('dashboard', { user: req.session.user, posts: posts });
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.send("Error fetching posts. Please check the console.");
    }
});

// query windows kinda thing to make new posts
app.get('/posts/new', isLoggedIn, (req, res) => {
    res.render('new-post', { user: req.session.user });
});

// makes new posts
app.post('/posts', isLoggedIn, async (req, res) => {
    try {
        const { title, content } = req.body;
        const newPost = new Post({
            title,
            content,
            author: req.session.user._id
        });
        await newPost.save();
        res.redirect('/dashboard');
    } catch (error) {
        console.error("Error creating post:", error);
        res.render('new-post', { user: req.session.user, error: "Failed to create post. Please try again." });
    }
});

//takes care of editing posts
app.get('/posts/:id/edit', isLoggedIn, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post.author.equals(req.session.user._id)) {
            return res.redirect('/dashboard');
        }
        res.render('edit-post', { user: req.session.user, post });
    } catch (error) {
        console.error("Error fetching post for edit:", error);
        res.redirect('/dashboard');
    }
});

//this one takes care of updating the posts
app.post('/posts/:id/update', isLoggedIn, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post.author.equals(req.session.user._id)) {
            return res.redirect('/dashboard');
        }
        await Post.findByIdAndUpdate(req.params.id, { title: req.body.title, content: req.body.content });
        res.redirect('/dashboard');
    } catch (error) {
        console.error("Error updating post:", error);
        res.redirect('/dashboard');
    }
});

//this part deals with post deletion
app.post('/posts/:id/delete', isLoggedIn, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post.author.equals(req.session.user._id)) {
            return res.redirect('/dashboard');
        }
        await Post.findByIdAndDelete(req.params.id);
        res.redirect('/dashboard');
    } catch (error) {
        console.error("Error deleting post:", error);
        res.redirect('/dashboard');
    }
});

// this part takes care of the likes system
app.post('/posts/:id/like', isLoggedIn, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        const userId = req.session.user._id;

        if (!post.likes) {
            post.likes = [];
        }

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

