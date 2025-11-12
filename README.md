🎵 StreamMusic – Full Stack Music Streaming Web App

A full-featured music streaming platform built with React.js, Flask (Python), and MySQL, enabling users to upload, stream, and manage their favorite songs with a beautiful modern UI.

👨‍💻 Developers

Kushal Nayak

Abhay H Bhargav

📝 Overview

StreamMusic is a full-stack web application that brings the power of personalized music streaming to the browser.
It provides users with secure authentication, audio uploads, playlists, and a responsive player — all built on a scalable backend and modern frontend stack.

✨ Features

🔐 User Authentication: Secure login/register using JWT tokens

🎧 Music Upload & Streaming: Upload .mp3 files and stream instantly

❤️ Like/Unlike Tracks: Interactive like system synced with MySQL

📁 Dynamic Playlists: Create, view, and manage your own playlists

💳 Subscription Plans: Tiered plans displayed dynamically

🎨 Modern Responsive UI: Beautiful design using custom CSS

🗄️ MySQL Database Integration: Persistent user and track data

🎛️ Full Audio Player: Play, pause, seek, and volume control

⚙️ Admin & API Friendly: Simple REST endpoints for management

🧰 Tech Stack
Layer	Technologies
Frontend	React.js, HTML5, CSS3, JavaScript (ES6+)
Backend	Python Flask, Flask-JWT, Werkzeug
Database	MySQL
Storage	Local file uploads (/uploads)
Version Control	Git, GitHub

🗂️ Project Structure
music_streaming_app/
│
├── backend/
│   ├── music_streaming_app.py     # Flask backend API
│   ├── models/                    # Database models
│   ├── static/uploads/            # Music files storage
│   ├── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.js                # Main React app logic
│   │   ├── components/           # Player, Login, Library, etc.
│   │   ├── styles/               # Modern CSS styling
│   ├── package.json
│
└── README.md

⚙️ Installation
🖥️ Prerequisites

Make sure you have installed:
Node.js
 (v16+ recommended)
Python
 (3.8+)
MySQL

🧩 Backend Setup
cd backend
pip install -r requirements.txt
Start your MySQL server, then open the MySQL shell and create a database:

CREATE DATABASE music_app;
USE music_app;
SHOW TABLES;
Then, run the Flask backend:
python music_streaming_app.py

✅ Backend will start on http://localhost:5000

💻 Frontend Setup
cd frontend
npm install
npm start


✅ Frontend will start on http://localhost:3000

🔗 API Endpoints
Method	Endpoint	Description
POST	/api/auth/register	Register new user
POST	/api/auth/login	Login and get JWT token
GET	/api/tracks	Get all tracks
POST	/api/tracks/upload	Upload new track
DELETE	/api/tracks/:id	Delete track
POST	/api/tracks/:id/like	Like track
DELETE	/api/tracks/:id/like	Unlike track
GET	/api/playlists	Get user playlists
POST	/api/playlists	Create playlist

🧮 MySQL Commands (For Demo)

To view users:
SELECT UserID, Username, Email FROM UserAccount;

To view uploaded tracks:
SELECT TrackID, Title, ArtistName, FilePath FROM Track;

To view likes:
SELECT * FROM TrackLikes;
To view subscription plans:

SELECT * FROM SubscriptionPlan;
