# music_streaming_app.py - COMPLETE FLASK BACKEND

import os
import logging
from datetime import datetime, timedelta, date
from functools import wraps
from flask import Flask, jsonify, request, send_from_directory, make_response
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS, cross_origin
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, get_jwt_identity
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import func

# ================= CONFIG =================
UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {"mp3", "wav", "ogg", "m4a", "flac"}

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Config:
    DB_USER = 'root'
    DB_PASSWORD = 'kushal123'
    DB_HOST = 'localhost'
    DB_PORT = '3306'
    DB_NAME = 'music_app'
    SQLALCHEMY_DATABASE_URI = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = "streammusic-secret"
    JWT_SECRET_KEY = "streammusic-jwt"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=1)

db = SQLAlchemy()

# ================= MODELS =================
class User(db.Model):
    __tablename__ = "UserAccount"
    user_id = db.Column("UserID", db.Integer, primary_key=True)
    username = db.Column("Username", db.String(100), unique=True)
    email = db.Column("Email", db.String(100), unique=True)
    password = db.Column("Password", db.String(255))
    created_at = db.Column("CreatedAt", db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {"user_id": self.user_id, "username": self.username, "email": self.email}

class Artist(db.Model):
    __tablename__ = "Artist"
    artist_id = db.Column("ArtistID", db.Integer, primary_key=True)
    name = db.Column("Name", db.String(100))
    genre = db.Column("Genre", db.String(100))

class Track(db.Model):
    __tablename__ = "Track"
    track_id = db.Column("TrackID", db.Integer, primary_key=True)
    title = db.Column("Title", db.String(150))
    artist_id = db.Column("ArtistID", db.Integer, db.ForeignKey("Artist.ArtistID"))
    album_title = db.Column("AlbumTitle", db.String(150))
    file_path = db.Column("FilePath", db.String(255))
    duration = db.Column("Duration", db.Time)
    release_date = db.Column("ReleaseDate", db.Date, default=date.today)

    artist = db.relationship("Artist", backref="tracks")

    def to_dict(self, user_id=None):
        likes_count = Like.query.filter_by(track_id=self.track_id).count()
        is_liked_by_user = (
            Like.query.filter_by(track_id=self.track_id, user_id=user_id).first() is not None
            if user_id else False
        )
        return {
            "track_id": self.track_id,
            "title": self.title,
            "artist_name": self.artist.name if self.artist else "Unknown Artist",
            "album_title": self.album_title,
            "duration": str(self.duration or "00:00:00"),
            "release_date": str(self.release_date),
            "file_path": self.file_path,
            "likes_count": likes_count,
            "is_liked_by_user": is_liked_by_user,
        }

class Like(db.Model):
    __tablename__ = "Likes"
    user_id = db.Column("UserID", db.Integer, db.ForeignKey("UserAccount.UserID"), primary_key=True)
    track_id = db.Column("TrackID", db.Integer, db.ForeignKey("Track.TrackID"), primary_key=True)
    liked_at = db.Column("LikedAt", db.DateTime, default=datetime.utcnow)

# ================= HELPER FUNCTIONS =================
def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def token_required(f):
    @wraps(f)
    @jwt_required()
    def decorated(*args, **kwargs):
        uid = get_jwt_identity()
        return f(uid, *args, **kwargs)
    return decorated

# ================= APP FACTORY =================
def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    JWTManager(app)

    with app.app_context():
        db.create_all()

    @app.before_request
    def preflight():
        if request.method == "OPTIONS":
            return make_response("ok", 200)

    # ============== AUTH =================
    @app.route("/api/auth/register", methods=["POST"])
    def register():
        try:
            data = request.get_json()
            username = data.get("username")
            email = data.get("email")
            password = data.get("password")

            if not username or not email or not password:
                return jsonify({"error": "Missing required fields"}), 400

            if User.query.filter_by(email=email).first():
                return jsonify({"error": "Email already exists"}), 400

            if User.query.filter_by(username=username).first():
                return jsonify({"error": "Username already exists"}), 400

            hashed = generate_password_hash(password)
            new_user = User(username=username, email=email, password=hashed)
            db.session.add(new_user)
            db.session.commit()

            token = create_access_token(identity=new_user.user_id)
            logger.info(f"✅ User registered: {username}")
            return jsonify({"message": "Registered successfully", "user": new_user.to_dict(), "token": token}), 201
        except Exception as e:
            db.session.rollback()
            logger.error(f"❌ Register error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route("/api/auth/login", methods=["POST"])
    def login():
        try:
            data = request.get_json()
            email = data.get("email")
            password = data.get("password")

            if not email or not password:
                return jsonify({"error": "Missing email or password"}), 400

            user = User.query.filter_by(email=email).first()
            if not user or not check_password_hash(user.password, password):
                return jsonify({"error": "Invalid credentials"}), 401

            token = create_access_token(identity=user.user_id)
            logger.info(f"✅ User logged in: {user.username}")
            return jsonify({"message": "Login successful", "user": user.to_dict(), "token": token}), 200
        except Exception as e:
            logger.error(f"❌ Login error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route("/api/auth/user", methods=["GET"])
    @jwt_required()
    def get_user():
        try:
            user_id = get_jwt_identity()
            user = User.query.get(user_id)
            if not user:
                return jsonify({"error": "User not found"}), 404
            return jsonify(user.to_dict()), 200
        except Exception as e:
            logger.error(f"❌ Get user error: {e}")
            return jsonify({"error": str(e)}), 500

    # ============== UPLOAD TRACK =================
    @app.route("/api/tracks/upload", methods=["POST"])
    @jwt_required()
    def upload_track():
        try:
            user_id = get_jwt_identity()
            if "file" not in request.files:
                return jsonify({"error": "No file uploaded"}), 400

            file = request.files["file"]
            if not allowed_file(file.filename):
                return jsonify({"error": "Invalid file type"}), 400

            filename = secure_filename(file.filename)
            filename = f"{datetime.now().timestamp()}_{filename}"
            save_path = os.path.join(UPLOAD_FOLDER, filename)
            file.save(save_path)

            title = request.form.get("title")
            artist_name = request.form.get("artist_name", "Unknown Artist")
            album_title = request.form.get("album_title", "")
            duration = request.form.get("duration", "00:03:30")

            artist = Artist.query.filter_by(name=artist_name).first()
            if not artist:
                artist = Artist(name=artist_name, genre="Unknown")
                db.session.add(artist)
                db.session.commit()

            new_track = Track(
                title=title,
                artist_id=artist.artist_id,
                album_title=album_title,
                duration=datetime.strptime(duration, "%H:%M:%S").time(),
                file_path=filename
            )
            db.session.add(new_track)
            db.session.commit()

            logger.info(f"✅ Track uploaded: {title}")
            return jsonify({"message": "Track uploaded", "track": new_track.to_dict(user_id)}), 201
        except Exception as e:
            db.session.rollback()
            logger.error(f"❌ Upload error: {e}")
            return jsonify({"error": str(e)}), 500

    # ============== STREAM TRACK =================
    @app.route("/api/tracks/<int:track_id>/stream", methods=["GET"])
    def stream_track(track_id):
        try:
            track = Track.query.get(track_id)
            if not track or not track.file_path:
                return jsonify({"error": "Track not found"}), 404
            return send_from_directory(UPLOAD_FOLDER, track.file_path, as_attachment=False)
        except Exception as e:
            logger.error(f"❌ Stream error: {e}")
            return jsonify({"error": str(e)}), 500

    # ============== GET TRACKS =================
    @app.route("/api/tracks", methods=["GET"])
    @jwt_required(optional=True)
    def get_all_tracks():
        try:
            user_id = get_jwt_identity()
            page = request.args.get("page", 1, type=int)
            limit = request.args.get("limit", 50, type=int)
            
            tracks_query = Track.query.paginate(page=page, per_page=limit, error_out=False)
            logger.info(f"✅ Fetched tracks: {tracks_query.total}")
            return jsonify({
                "tracks": [t.to_dict(user_id) for t in tracks_query.items],
                "total": tracks_query.total,
                "pages": tracks_query.pages,
                "current_page": page
            }), 200
        except Exception as e:
            logger.error(f"❌ Get tracks error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route("/api/tracks/<int:track_id>", methods=["GET"])
    @jwt_required(optional=True)
    def get_track(track_id):
        try:
            user_id = get_jwt_identity()
            track = Track.query.get(track_id)
            if not track:
                return jsonify({"error": "Track not found"}), 404
            return jsonify(track.to_dict(user_id)), 200
        except Exception as e:
            logger.error(f"❌ Get track error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route("/api/tracks/popular", methods=["GET"])
    @jwt_required(optional=True)
    def get_popular_tracks():
        try:
            user_id = get_jwt_identity()
            limit = request.args.get("limit", 10, type=int)
            
            popular = (
                db.session.query(Track)
                .outerjoin(Like)
                .group_by(Track.track_id)
                .order_by(func.count(Like.track_id).desc())
                .limit(limit)
                .all()
            )
            logger.info(f"✅ Fetched popular tracks: {len(popular)}")
            return jsonify({"tracks": [t.to_dict(user_id) for t in popular]}), 200
        except Exception as e:
            logger.error(f"❌ Popular tracks error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route("/api/tracks/user/<int:uid>/likes", methods=["GET"])
    def get_user_likes(uid):
        try:
            likes = db.session.query(Like, Track).join(Track).filter(Like.user_id == uid).all()
            liked_tracks = [track.to_dict(uid) for _, track in likes]
            logger.info(f"✅ User {uid} liked tracks: {len(liked_tracks)}")
            return jsonify({"liked_tracks": liked_tracks, "total_likes": len(liked_tracks)}), 200
        except Exception as e:
            logger.error(f"❌ Get likes error: {e}")
            return jsonify({"error": str(e)}), 500

    # ============== LIKE / UNLIKE =================
    @app.route("/api/tracks/<int:track_id>/like", methods=["POST"])
    @jwt_required()
    def like_track(track_id):
        try:
            user_id = get_jwt_identity()
            track = Track.query.get(track_id)
            if not track:
                return jsonify({"error": "Track not found"}), 404

            existing = Like.query.filter_by(user_id=user_id, track_id=track_id).first()
            if existing:
                return jsonify({"error": "Already liked"}), 409

            new_like = Like(user_id=user_id, track_id=track_id)
            db.session.add(new_like)
            db.session.commit()

            likes_count = Like.query.filter_by(track_id=track_id).count()
            logger.info(f"✅ Track {track_id} liked by user {user_id}")
            return jsonify({"message": "Liked", "is_liked_by_user": True, "likes_count": likes_count, "track": track.to_dict(user_id)}), 201
        except Exception as e:
            db.session.rollback()
            logger.error(f"❌ Like error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route("/api/tracks/<int:track_id>/like", methods=["DELETE"])
    @jwt_required()
    def unlike_track(track_id):
        try:
            user_id = get_jwt_identity()
            like = Like.query.filter_by(user_id=user_id, track_id=track_id).first()
            if not like:
                return jsonify({"error": "Not liked"}), 404

            db.session.delete(like)
            db.session.commit()

            track = Track.query.get(track_id)
            likes_count = Like.query.filter_by(track_id=track_id).count()
            logger.info(f"✅ Track {track_id} unliked by user {user_id}")
            return jsonify({"message": "Unliked", "is_liked_by_user": False, "likes_count": likes_count, "track": track.to_dict(user_id)}), 200
        except Exception as e:
            db.session.rollback()
            logger.error(f"❌ Unlike error: {e}")
            return jsonify({"error": str(e)}), 500

    # ============== DELETE TRACK =================
    @app.route("/api/tracks/<int:track_id>", methods=["DELETE"])
    @jwt_required()
    def delete_track(track_id):
        try:
            user_id = get_jwt_identity()
            track = Track.query.get(track_id)
            
            if not track:
                return jsonify({"error": "Track not found"}), 404

            # Delete file from uploads folder
            if track.file_path:
                file_path = os.path.join(UPLOAD_FOLDER, track.file_path)
                if os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                        logger.info(f"🗑️ File deleted: {track.file_path}")
                    except Exception as e:
                        logger.warning(f"⚠️ Failed to delete file: {e}")

            # Delete from database
            db.session.delete(track)
            db.session.commit()

            logger.info(f"✅ Track {track_id} deleted by user {user_id}")
            return jsonify({"message": "Track deleted successfully"}), 200
        except Exception as e:
            db.session.rollback()
            logger.error(f"❌ Delete error: {e}")
            return jsonify({"error": str(e)}), 500

    # ============== HEALTH CHECK =================
    @app.route("/api/health", methods=["GET"])
    def health():
        try:
            users_count = User.query.count()
            tracks_count = Track.query.count()
            artists_count = Artist.query.count()
            logger.info(f"✅ Health check - Users: {users_count}, Tracks: {tracks_count}, Artists: {artists_count}")
            return jsonify({
                "status": "healthy",
                "users": users_count,
                "tracks": tracks_count,
                "artists": artists_count,
                "database": "connected"
            }), 200
        except Exception as e:
            logger.error(f"❌ Health check error: {e}")
            return jsonify({"status": "error", "message": str(e)}), 500

    return app

# ================= RUN SERVER =================
if __name__ == "__main__":
    app = create_app()
    logger.info("🎵 StreamMusic backend running at http://localhost:5000")
    app.run(debug=True, host="0.0.0.0", port=5000)