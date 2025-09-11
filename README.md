# GAuth2BlogDemo

A blog platform built with Node.js, Express, and MongoDB, featuring user authentication using a custom Google OAuth 2.0 implementation.

## Live Demo

The project is deployed on Render and is accessible at the following link:

[https://gauth2-0blogdemo.onrender.com](https://gauth2-0blogdemo.onrender.com/)

## Features

- **User Authentication**: Secure sign-in and session management using Google OAuth 2.0.
- **Post Management**: Authenticated users can create, edit, and delete their own blog posts.
- **Interactive System**: Users can like posts and add comments to engage with content.
- **User Profiles**: A dedicated profile page for each user displaying their post count and total likes received.

## Folder Structure

```
/
|-- models/
|   |-- post.model.js
|   |-- user.model.js
|-- views/
|   |-- dashboard.ejs       
|   |-- edit-post.ejs       
|   |-- index.ejs           
|   |-- new-post.ejs        
|   |-- profile.ejs         
|-- .gitignore
|-- package.json
|-- server.js             
|-- README.md

```

## Environment Setup

To run this project locally, create a `.env` file in the root directory and add the following variables:

```
MONGO_URI=<your mongodb connection string>
GOOGLE_CLIENT_ID=<your gauth client id>
GOOGLE_CLIENT_SECRET=<your gauth client secret>
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
SESSION_SECRET=<type up some random key>
PORT=3000

```

### Obtaining Google OAuth Credentials

1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project.
3. Go to **APIs & Services > Credentials**.
4. Click **Create Credentials > OAuth client ID**.
5. Select **Web application** as the application type.
6. Add `http://localhost:3000/auth/google/callback` to the **Authorized redirect URIs**.
7. Click **Create** and copy your Client ID and Client Secret into the `.env` file.

## Installation and Running Locally

1. Clone the repository:
    
    ```
    git clone <your-repository-url>
    
    ```
    
2. Navigate to the project directory:
    
    ```
    cd GOAuth2BlogDemo
    
    ```
    
3. Install the required dependencies:
    
    ```
    npm install
    
    ```
    
4. Start the development server:
    
    ```
    npm start
    
    ```
    
    The application will be available at `http://localhost:3000`.
    

## Deployment

This project is configured for deployment on Render.

1. Fork this repository to your own GitHub account.
2. Create a new **Web Service** on [Render](https://render.com/) and connect your repository.
3. In the Render dashboard, go to the **Environment** tab.
4. Add all the necessary environment variables from your `.env` file.
5. Update the `GOOGLE_REDIRECT_URI` variable to your public Render URL ( `https://your-app-name.onrender.com/auth/google/callback`).
6. Add this new URI to your **Authorized redirect URIs** list in the Google Cloud Console.
7. Render will automatically build and deploy the application when you push to the main branch.
