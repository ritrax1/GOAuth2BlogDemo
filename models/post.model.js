const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const commentSchema = new Schema({
    text: { type: String, required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const postSchema = new Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    likes: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    comments: [commentSchema] 
}, { timestamps: true });

const Post = mongoose.model('Post', postSchema);

module.exports = Post;