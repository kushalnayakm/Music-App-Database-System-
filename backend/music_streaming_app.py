# music_streaming_app.py
# COMPLETE FLASK BACKEND - PASTE THIS AS ONE FILE

import os, json, logging, re
from datetime import datetime, timedelta, time, date
from functools import wraps

from flask import Flask, request, jsonify, send_from_directory, make_response
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from sqlalchemy import func, desc

# ============== CONFIGURATION ==============
class Config:
    DB_USER = 'root'
    DB_PASSWORD = 'kushal123'
    DB_HOST = 'localhost'
    DB_PORT = '3306'
    DB_NAME = 'music_app'
    SQLALCHEMY_DATABASE_URI = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = 'secret'
    JWT_SECRET_KEY = 'jwt-secret'
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)

# ============== LOGGING ==============
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============== DATABASE ==============
db = SQLAlchemy()

def check_database():
    """Helper function to check database connection and content."""
    try:
        # Test connection using text()
        from sqlalchemy import text
        db.session.execute(text('SELECT 1'))
        logger.info("✅ Database connection test successful")
        
        # Get table counts
        track_count = db.session.query(func.count(Track.track_id)).scalar()
        artist_count = db.session.query(func.count(Artist.artist_id)).scalar()
        album_count = db.session.query(func.count(Album.album_id)).scalar()
        
        logger.info(f"Database content - Tracks: {track_count}, Artists: {artist_count}, Albums: {album_count}")
        
        if track_count == 0:
            sample_query = "INSERT INTO Track (Title, ArtistID, Duration) VALUES ('Sample Track', 1, '00:03:30')"
            logger.info(f"To add a sample track, you can use: {sample_query}")
            
        return True
    except Exception as e:
        logger.error(f"Database check failed: {e}")
        return False

# ============== MODELS ==============
class SubscriptionPlan(db.Model):
    __tablename__ = 'SubscriptionPlan'
    subscription_plan_id = db.Column('SubscriptionPlanID', db.Integer, primary_key=True)
    name = db.Column('Name', db.String(50))
    price = db.Column('Price', db.Float)
    description = db.Column('Description', db.Text)
    
    def to_dict(self):
        return {
            'subscription_plan_id': self.subscription_plan_id,
            'name': self.name,
            'price': self.price,
            'description': self.description
        }

class User(db.Model):
    __tablename__ = 'UserAccount'
    user_id = db.Column('UserID', db.Integer, primary_key=True)
    username = db.Column('Username', db.String(50), unique=True)
    email = db.Column('Email', db.String(100), unique=True)
    password = db.Column('Password', db.String(255))
    subscription_plan_id = db.Column('SubscriptionPlanID', db.Integer, db.ForeignKey('SubscriptionPlan.SubscriptionPlanID'))
    created_at = db.Column('CreatedAt', db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'user_id': self.user_id,
            'username': self.username,
            'email': self.email,
            'subscription_plan_id': self.subscription_plan_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Artist(db.Model):
    __tablename__ = 'Artist'
    artist_id = db.Column('ArtistID', db.Integer, primary_key=True)
    name = db.Column('Name', db.String(100))
    genre = db.Column('Genre', db.String(50))
    
    def to_dict(self):
        return {
            'artist_id': self.artist_id,
            'name': self.name,
            'genre': self.genre
        }

class Album(db.Model):
    __tablename__ = 'Album'
    album_id = db.Column('AlbumID', db.Integer, primary_key=True)
    title = db.Column('Title', db.String(150))
    artist_id = db.Column('ArtistID', db.Integer, db.ForeignKey('Artist.ArtistID'))
    release_date = db.Column('ReleaseDate', db.Date)
    artist = db.relationship('Artist')
    
    def to_dict(self):
        return {
            'album_id': self.album_id,
            'title': self.title,
            'artist_id': self.artist_id,
            'artist_name': self.artist.name if self.artist else 'Unknown',
            'release_date': self.release_date.isoformat() if self.release_date else None
        }

class Track(db.Model):
    __tablename__ = 'Track'
    track_id = db.Column('TrackID', db.Integer, primary_key=True)
    title = db.Column('Title', db.String(150))
    artist_id = db.Column('ArtistID', db.Integer, db.ForeignKey('Artist.ArtistID'))
    album_id = db.Column('AlbumID', db.Integer, db.ForeignKey('Album.AlbumID'))
    # store uploaded filename (nullable)
    file_path = db.Column('FilePath', db.String(255), nullable=True)
    duration = db.Column('Duration', db.Time)
    release_date = db.Column('ReleaseDate', db.Date)
    artist = db.relationship('Artist')
    album = db.relationship('Album')
    
    def duration_seconds(self):
        if self.duration:
            return self.duration.hour * 3600 + self.duration.minute * 60 + self.duration.second
        return 0
    
    def to_dict(self, user_id=None):
        likes_count = db.session.query(func.count(Like.track_id)).filter(Like.track_id == self.track_id).scalar() or 0
        is_liked = False
        if user_id:
            is_liked = db.session.query(Like).filter(Like.user_id == user_id, Like.track_id == self.track_id).first() is not None
        
        return {
            'track_id': self.track_id,
            'title': self.title,
            'artist_id': self.artist_id,
            'artist_name': self.artist.name if self.artist else 'Unknown',
            'album_id': self.album_id,
            'album_title': self.album.title if self.album else None,
            'duration': str(self.duration) if self.duration else '00:00:00',
            'duration_seconds': self.duration_seconds(),
            'release_date': self.release_date.isoformat() if self.release_date else None,
            'likes_count': likes_count,
            'is_liked_by_user': is_liked
            ,
            'file_path': getattr(self, 'file_path', None)
        }

class Like(db.Model):
    __tablename__ = 'Likes'
    user_id = db.Column('UserID', db.Integer, db.ForeignKey('UserAccount.UserID'), primary_key=True)
    track_id = db.Column('TrackID', db.Integer, db.ForeignKey('Track.TrackID'), primary_key=True)
    liked_at = db.Column('LikedAt', db.DateTime, default=datetime.utcnow)

class Playlist(db.Model):
    __tablename__ = 'Playlist'
    playlist_id = db.Column('PlaylistID', db.Integer, primary_key=True)
    user_id = db.Column('UserID', db.Integer, db.ForeignKey('UserAccount.UserID'))
    title = db.Column('Title', db.String(150))
    creation_date = db.Column('CreationDate', db.Date)
    parent_playlist_id = db.Column('ParentPlaylistID', db.Integer)
    
    def to_dict(self, include_tracks=False, user_id=None):
        track_count = db.session.query(func.count(TrackPlaylist.track_id)).filter(TrackPlaylist.playlist_id == self.playlist_id).scalar() or 0
        data = {
            'playlist_id': self.playlist_id,
            'user_id': self.user_id,
            'title': self.title,
            'creation_date': self.creation_date.isoformat() if self.creation_date else None,
            'track_count': track_count
        }
        if include_tracks:
            tracks_raw = db.session.query(TrackPlaylist, Track).join(Track).filter(TrackPlaylist.playlist_id == self.playlist_id).order_by(TrackPlaylist.order_num).all()
            data['tracks'] = [track.to_dict(user_id) for _, track in tracks_raw]
        return data

class TrackPlaylist(db.Model):
    __tablename__ = 'TrackPlaylist'
    playlist_id = db.Column('PlaylistID', db.Integer, db.ForeignKey('Playlist.PlaylistID'), primary_key=True)
    track_id = db.Column('TrackID', db.Integer, db.ForeignKey('Track.TrackID'), primary_key=True)
    order_num = db.Column('OrderNum', db.Integer)
    track = db.relationship('Track')

class Payment(db.Model):
    __tablename__ = 'Payment'
    payment_id = db.Column('PaymentID', db.Integer, primary_key=True)
    user_id = db.Column('UserID', db.Integer, db.ForeignKey('UserAccount.UserID'))
    amount = db.Column('Amount', db.Float)
    date = db.Column('Date', db.DateTime, default=datetime.utcnow)
    method = db.Column('Method', db.String(50))
    
    def to_dict(self):
        return {
            'payment_id': self.payment_id,
            'user_id': self.user_id,
            'amount': self.amount,
            'date': self.date.isoformat() if self.date else None,
            'method': self.method
        }

# ============== HELPERS ==============
def validate_email(email):
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password(password):
    return len(password) >= 8 and any(c.isupper() for c in password) and any(c.isdigit() for c in password)

# ============== CREATE APP ==============
def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    JWTManager(app)
    db.init_app(app)
    
    with app.app_context():
        check_database()  # Check database connection and content on startup
    
    @app.before_request
    def preflight():
        if request.method == "OPTIONS":
            return make_response("ok", 200)
    
    def token_required(f):
        @wraps(f)
        @jwt_required()
        def decorated(*args, **kwargs):
            uid = get_jwt_identity()
            return f(uid, *args, **kwargs)
        return decorated
    
    # ============== AUTH ROUTES ==============
    @app.route('/api/auth/register', methods=['POST'])
    def register():
        try:
            data = request.get_json()
            if not data.get('username') or not data.get('email') or not data.get('password'):
                return jsonify({'error': 'Missing fields'}), 400
            
            if not validate_email(data['email']):
                return jsonify({'error': 'Invalid email format'}), 400
            
            if not validate_password(data['password']):
                return jsonify({'error': 'Password must be at least 8 characters with uppercase and digit'}), 400
            
            if User.query.filter_by(username=data['username']).first():
                return jsonify({'error': 'Username exists'}), 409
            if User.query.filter_by(email=data['email']).first():
                return jsonify({'error': 'Email exists'}), 409
            
            user = User(
                username=data['username'],
                email=data['email'],
                password=generate_password_hash(data['password']),
                subscription_plan_id=1
            )
            db.session.add(user)
            db.session.commit()
            token = create_access_token(identity=str(user.user_id))
            logger.info(f"✅ Registered: {user.username}")
            return jsonify({
                'message': 'Registered',
                'user': user.to_dict(),
                'token': token
            }), 201
        except Exception as e:
            db.session.rollback()
            logger.error(f"Register error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/auth/login', methods=['POST'])
    def login():
        try:
            data = request.get_json()
            if not data.get('email') or not data.get('password'):
                return jsonify({'error': 'Missing email or password'}), 400
            user = User.query.filter_by(email=data['email']).first()
            if not user or not check_password_hash(user.password, data['password']):
                return jsonify({'error': 'Invalid credentials'}), 401
            token = create_access_token(identity=str(user.user_id))
            logger.info(f"✅ Logged in: {user.username}")
            return jsonify({
                'message': 'Login successful',
                'user': user.to_dict(),
                'token': token
            }), 200
        except Exception as e:
            logger.error(f"Login error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/auth/user', methods=['GET'])
    @jwt_required()
    def get_user():
        uid = get_jwt_identity()
        user = User.query.get(uid)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        return jsonify(user.to_dict()), 200

    # ============== TRACKS ROUTES ==============
    @app.route('/api/tracks', methods=['GET'])
    @jwt_required(optional=True)
    def get_tracks():
        try:
            user_id = get_jwt_identity()
            try:
                page = max(1, request.args.get('page', 1, type=int))
                limit = min(max(1, request.args.get('limit', 50, type=int)), 100)
            except (TypeError, ValueError) as e:
                logger.error(f"Invalid pagination parameters: {e}")
                return jsonify({
                    'error': 'Invalid page or limit parameter',
                    'tracks': [],
                    'total': 0,
                    'pages': 0,
                    'current_page': 1
                }), 400
            
            logger.info(f"Fetching tracks - Page: {page}, Limit: {limit}, User: {user_id}")
            
            try:
                # Use a simple query first to test database connection
                from sqlalchemy import text
                db.session.execute(text('SELECT 1')).scalar()
            except Exception as e:
                logger.error(f"Database connection error: {e}")
                return jsonify({
                    'error': 'Database connection error',
                    'tracks': [],
                    'total': 0,
                    'pages': 0,
                    'current_page': page
                }), 500
            
            try:
                base_query = Track.query
                
                # Get total count with error handling
                try:
                    total_tracks = base_query.count()
                    logger.info(f"Total tracks in database: {total_tracks}")
                except Exception as e:
                    logger.error(f"Error counting tracks: {e}")
                    return jsonify({'error': 'Error counting tracks'}), 500
                
                if total_tracks == 0:
                    logger.warning("No tracks found in database")
                    return jsonify({
                        'tracks': [],
                        'total': 0,
                        'pages': 0,
                        'current_page': page,
                        'message': 'No tracks available'
                    }), 200
                
                # Calculate pagination
                total_pages = (total_tracks + limit - 1) // limit
                page = min(page, total_pages)  # Ensure page doesn't exceed total pages
                
                # Get paginated results
                offset = (page - 1) * limit
                tracks = base_query.offset(offset).limit(limit).all()
                
                # Convert to response format with error handling for each track
                track_list = []
                for track in tracks:
                    try:
                        track_data = track.to_dict(user_id)
                        track_list.append(track_data)
                    except Exception as e:
                        logger.error(f"Error converting track {track.track_id}: {e}")
                        continue
                
                logger.info(f"✅ Returning {len(track_list)} tracks (Page {page}/{total_pages})")
                return jsonify({
                    'tracks': track_list,
                    'total': total_tracks,
                    'pages': total_pages,
                    'current_page': page
                }), 200
            except Exception as e:
                logger.error(f"Error querying tracks: {e}")
                return jsonify({'error': 'Error retrieving tracks'}), 500
        except Exception as e:
            logger.error(f"Unexpected error in get_tracks: {e}")
            return jsonify({'error': 'Internal server error'}), 500
        except Exception as e:
            logger.error(f"Get tracks error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/tracks/<int:tid>', methods=['GET'])
    @jwt_required(optional=True)
    def get_track(tid):
        user_id = get_jwt_identity()
        track = Track.query.get(tid)
        if not track:
            return jsonify({'error': 'Track not found'}), 404
        return jsonify(track.to_dict(user_id)), 200

    @app.route('/api/tracks/popular', methods=['GET'])
    @jwt_required(optional=True)
    def popular():
        try:
            user_id = get_jwt_identity()
            limit = request.args.get('limit', 10, type=int)
            popular_tracks = db.session.query(Track).join(Like, Track.track_id == Like.track_id, isouter=True).group_by(Track.track_id).order_by(desc(func.count(Like.track_id))).limit(limit).all()
            logger.info(f"✅ Popular: {len(popular_tracks)}")
            return jsonify({'tracks': [t.to_dict(user_id) for t in popular_tracks]}), 200
        except Exception as e:
            logger.error(f"Popular error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/tracks/<int:tid>/like', methods=['POST'])
    @token_required
    def like(user_id, tid):
        try:
            track = Track.query.get(tid)
            if not track:
                return jsonify({'error': 'Track not found'}), 404
            existing = Like.query.filter_by(user_id=user_id, track_id=tid).first()
            if existing:
                return jsonify({'error': 'Already liked'}), 409
            like = Like(user_id=user_id, track_id=tid)
            db.session.add(like)
            db.session.commit()
            likes_count = len(db.session.query(Like).filter(Like.track_id == tid).all())
            logger.info(f"✅ Liked: track {tid} by user {user_id}")
            return jsonify({
                'message': 'Liked',
                'likes_count': likes_count,
                'is_liked_by_user': True,
                'track': track.to_dict(user_id)
            }), 201
        except Exception as e:
            db.session.rollback()
            logger.error(f"Like error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/tracks/<int:tid>/like', methods=['DELETE'])
    @token_required
    def unlike(user_id, tid):
        try:
            like = Like.query.filter_by(user_id=user_id, track_id=tid).first()
            if not like:
                return jsonify({'error': 'Not liked'}), 404
            db.session.delete(like)
            db.session.commit()
            track = Track.query.get(tid)
            likes_count = len(db.session.query(Like).filter(Like.track_id == tid).all())
            logger.info(f"✅ Unliked: track {tid} by user {user_id}")
            return jsonify({
                'message': 'Unliked',
                'likes_count': likes_count,
                'is_liked_by_user': False,
                'track': track.to_dict(user_id)
            }), 200
        except Exception as e:
            db.session.rollback()
            logger.error(f"Unlike error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/tracks/upload', methods=['POST', 'OPTIONS'])
    @token_required
    def upload_track(user_id):
        # Support preflight
        if request.method == 'OPTIONS':
            return jsonify({}), 200

        try:
            # Ensure upload directory exists
            uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads')
            os.makedirs(uploads_dir, exist_ok=True)

            if 'file' not in request.files:
                logger.error('Upload error: No file part')
                return jsonify({'error': 'No file provided'}), 400

            file = request.files['file']
            if file.filename == '':
                logger.error('Upload error: Empty filename')
                return jsonify({'error': 'No selected file'}), 400

            filename = secure_filename(file.filename)
            save_path = os.path.join(uploads_dir, filename)
            # Avoid overwriting: append timestamp if file exists
            if os.path.exists(save_path):
                name, ext = os.path.splitext(filename)
                filename = f"{name}_{int(datetime.utcnow().timestamp())}{ext}"
                save_path = os.path.join(uploads_dir, filename)

            file.save(save_path)
            logger.info(f"✅ File saved: {save_path}")

            # Read form fields
            title = (request.form.get('title') or filename).strip()
            artist_name = (request.form.get('artist_name') or '').strip() or None
            album_title = (request.form.get('album_title') or '').strip() or None
            duration_str = (request.form.get('duration') or '').strip() or None

            # Find or create artist
            artist_id = None
            if artist_name:
                artist = Artist.query.filter(func.lower(Artist.name) == artist_name.lower()).first()
                if not artist:
                    artist = Artist(name=artist_name)
                    db.session.add(artist)
                    db.session.flush()
                artist_id = artist.artist_id

            # Find or create album
            album_id = None
            if album_title:
                # If we have an artist, try to associate
                alb_query = Album.query.filter(Album.title == album_title)
                if artist_id:
                    alb_query = alb_query.filter(Album.artist_id == artist_id)
                album = alb_query.first()
                if not album:
                    album = Album(title=album_title, artist_id=artist_id)
                    db.session.add(album)
                    db.session.flush()
                album_id = album.album_id

            # Parse duration string into time (if provided)
            duration_val = None
            if duration_str:
                try:
                    dt = datetime.strptime(duration_str, '%H:%M:%S')
                    duration_val = dt.time()
                except Exception:
                    try:
                        # Try mm:ss
                        dt = datetime.strptime(duration_str, '%M:%S')
                        duration_val = dt.time()
                    except Exception:
                        duration_val = None

            # Create Track entry
            # Ensure DB has the FilePath column (best-effort): if commit fails due to missing column, try to add it and retry
            new_track = Track(
                title=title,
                artist_id=artist_id,
                album_id=album_id,
                duration=duration_val,
                release_date=date.today(),
                file_path=filename
            )
            db.session.add(new_track)
            try:
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                logger.warning(f"Upload commit failed, attempting to add FilePath column: {e}")
                try:
                    # Try to add column to Track table (MySQL)
                    db.engine.execute("ALTER TABLE `Track` ADD COLUMN `FilePath` VARCHAR(255) NULL")
                except Exception as e2:
                    logger.error(f"Failed to add FilePath column: {e2}")
                # retry
                db.session.add(new_track)
                db.session.commit()

            logger.info(f"✅ Track created: {new_track.track_id} - {title} (uploaded by user {user_id})")

            # Optionally, you could store the file-path metadata in another table or a new column.
            return jsonify({'message': 'Uploaded', 'track': new_track.to_dict(user_id)}), 201
        except Exception as e:
            db.session.rollback()
            logger.error(f"Upload error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/tracks/user/<int:uid>/likes', methods=['GET'])
    def user_likes(uid):
        try:
            user = User.query.get(uid)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            likes = db.session.query(Like, Track).join(Track).filter(Like.user_id == uid).all()
            liked_tracks = [track.to_dict(uid) for _, track in likes]
            logger.info(f"✅ User {uid} likes: {len(liked_tracks)}")
            return jsonify({
                'user_id': uid,
                'username': user.username,
                'liked_tracks': liked_tracks,
                'total_likes': len(liked_tracks)
            }), 200
        except Exception as e:
            logger.error(f"User likes error: {e}")
            return jsonify({'error': str(e)}), 500

    # ============== PLAYLISTS ROUTES ==============
    @app.route('/api/playlists/user/<int:uid>', methods=['GET'])
    def user_playlists(uid):
        try:
            playlists = Playlist.query.filter_by(user_id=uid).all()
            logger.info(f"✅ User {uid} playlists: {len(playlists)}")
            return jsonify({'playlists': [p.to_dict() for p in playlists]}), 200
        except Exception as e:
            logger.error(f"User playlists error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/playlists', methods=['POST', 'OPTIONS'])
    @token_required
    def create_playlist(user_id):
        if request.method == 'OPTIONS':
            return jsonify({}), 200
            
        try:
            # Log request details for debugging
            logger.info(f"Create playlist request - Headers: {dict(request.headers)}")
            logger.info(f"Create playlist request - Raw body: {request.get_data(as_text=True)}")
            
            if not request.is_json:
                logger.error("Create playlist error: Content-Type is not application/json")
                return jsonify({'error': 'Content-Type must be application/json'}), 422
                
            user = User.query.get(user_id)
            if not user:
                logger.error(f"Create playlist error: User {user_id} not found")
                return jsonify({'error': 'User not found'}), 401
                
            data = request.get_json(silent=True) or {}
            logger.info(f"Create playlist parsed data: {data}")
            
            title = (data.get('title') or '').strip()
            if not title:
                logger.error("Create playlist error: Missing title")
                return jsonify({'error': 'Title required'}), 400
                
            if len(title) > 150:
                logger.error(f"Create playlist error: Title too long ({len(title)} chars)")
                return jsonify({'error': 'Title too long'}), 400
                
            playlist = Playlist(user_id=user_id, title=title, creation_date=date.today())
            db.session.add(playlist)
            db.session.commit()
            
            logger.info(f"✅ Playlist created: {title} by user {user_id}")
            return jsonify({'message': 'Created', 'playlist': playlist.to_dict()}), 201
        except Exception as e:
            db.session.rollback()
            logger.error(f"Create playlist error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/playlists/<int:pid>', methods=['GET'])
    @jwt_required(optional=True)
    def get_playlist(pid):
        try:
            user_id = get_jwt_identity()
            playlist = Playlist.query.get(pid)
            if not playlist:
                return jsonify({'error': 'Playlist not found'}), 404
            return jsonify(playlist.to_dict(include_tracks=True, user_id=user_id)), 200
        except Exception as e:
            logger.error(f"Get playlist error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/playlists/<int:pid>/tracks', methods=['POST'])
    @token_required
    def add_to_playlist(user_id, pid):
        try:
            playlist = Playlist.query.get(pid)
            if not playlist or playlist.user_id != user_id:
                return jsonify({'error': 'Playlist not found or unauthorized'}), 404
            data = request.get_json(silent=True) or {}
            tid = data.get('track_id')
            if not tid:
                return jsonify({'error': 'Track ID required'}), 400
            track = Track.query.get(tid)
            if not track:
                return jsonify({'error': 'Track not found'}), 404
            existing = TrackPlaylist.query.filter_by(playlist_id=pid, track_id=tid).first()
            if existing:
                return jsonify({'error': 'Already in playlist'}), 409
            max_order = db.session.query(func.max(TrackPlaylist.order_num)).filter_by(playlist_id=pid).scalar() or 0
            tp = TrackPlaylist(playlist_id=pid, track_id=tid, order_num=max_order + 1)
            db.session.add(tp)
            db.session.commit()
            logger.info(f"✅ Track {tid} added to playlist {pid}")
            return jsonify({
                'message': 'Added',
                'playlist': playlist.to_dict(include_tracks=True, user_id=user_id)
            }), 201
        except Exception as e:
            db.session.rollback()
            logger.error(f"Add to playlist error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/playlists/<int:pid>/tracks/<int:tid>', methods=['DELETE'])
    @token_required
    def remove_from_playlist(user_id, pid, tid):
        try:
            playlist = Playlist.query.get(pid)
            if not playlist or playlist.user_id != user_id:
                return jsonify({'error': 'Playlist not found or unauthorized'}), 404
            tp = TrackPlaylist.query.filter_by(playlist_id=pid, track_id=tid).first()
            if not tp:
                return jsonify({'error': 'Not in playlist'}), 404
            db.session.delete(tp)
            db.session.commit()
            logger.info(f"✅ Track {tid} removed from playlist {pid}")
            return jsonify({
                'message': 'Removed',
                'playlist': playlist.to_dict(include_tracks=True, user_id=user_id)
            }), 200
        except Exception as e:
            db.session.rollback()
            logger.error(f"Remove error: {e}")
            return jsonify({'error': str(e)}), 500

    # ============== ARTISTS ROUTES ==============
    @app.route('/api/artists', methods=['GET'])
    def artists():
        try:
            page = request.args.get('page', 1, type=int)
            limit = request.args.get('limit', 50, type=int)
            artists_query = Artist.query.paginate(page=page, per_page=limit, error_out=False)
            logger.info(f"✅ Artists: {artists_query.total}")
            return jsonify({
                'artists': [a.to_dict() for a in artists_query.items],
                'total': artists_query.total,
                'pages': artists_query.pages,
                'current_page': page
            }), 200
        except Exception as e:
            logger.error(f"Artists error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/artists/<int:aid>', methods=['GET'])
    @jwt_required(optional=True)
    def artist(aid):
        try:
            user_id = get_jwt_identity()
            artist_obj = Artist.query.get(aid)
            if not artist_obj:
                return jsonify({'error': 'Artist not found'}), 404
            tracks = Track.query.filter_by(artist_id=aid).all()
            albums = Album.query.filter_by(artist_id=aid).all()
            return jsonify({
                'artist': artist_obj.to_dict(),
                'tracks': [t.to_dict(user_id) for t in tracks],
                'albums': [a.to_dict() for a in albums]
            }), 200
        except Exception as e:
            logger.error(f"Artist error: {e}")
            return jsonify({'error': str(e)}), 500

    # ============== SUBSCRIPTION PLANS ==============
    @app.route('/api/subscription_plans', methods=['GET'])
    def subscription_plans():
        """Return available subscription plans."""
        try:
            plans = SubscriptionPlan.query.order_by(SubscriptionPlan.subscription_plan_id).all()
            logger.info(f"✅ Subscription plans: {len(plans)}")
            return jsonify({'subscription_plans': [p.to_dict() for p in plans]}), 200
        except Exception as e:
            logger.error(f"Subscription plans error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/tracks/<int:tid>/stream', methods=['GET'])
    def stream_track(tid):
        try:
            track = Track.query.get(tid)
            if not track:
                return jsonify({'error': 'Track not found'}), 404

            uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads')

            # Prefer stored file_path if present
            candidate = None
            if getattr(track, 'file_path', None):
                p = os.path.join(uploads_dir, track.file_path)
                if os.path.exists(p):
                    candidate = track.file_path

            # Fallback: try to find a file that matches the track title or id
            if not candidate and os.path.isdir(uploads_dir):
                # first pass: look for track id in filename
                for fname in os.listdir(uploads_dir):
                    if str(tid) in fname:
                        candidate = fname
                        break

                # second pass: normalize and compare title and filename
                if not candidate:
                    def normalize_text(s):
                        if not s: return ''
                        return ''.join(c.lower() for c in s if c.isalnum())

                    title_norm = normalize_text(track.title or '')
                    for fname in os.listdir(uploads_dir):
                        fname_norm = normalize_text(fname)
                        if title_norm and title_norm in fname_norm:
                            candidate = fname
                            break

            if not candidate:
                logger.error(f"Stream error: file for track {tid} not found in uploads")
                return jsonify({'error': 'Audio file not found'}), 404

            logger.info(f"✅ Streaming file for track {tid}: {candidate}")
            return send_from_directory(uploads_dir, candidate, as_attachment=False)
        except Exception as e:
            logger.error(f"Stream error: {e}")
            return jsonify({'error': str(e)}), 500

    # ============== HEALTH CHECK ==============
    @app.route('/api/health', methods=['GET'])
    def health():
        try:
            tracks_count = Track.query.count()
            artists_count = Artist.query.count()
            users_count = User.query.count()
            logger.info(f"✅ Health - Tracks: {tracks_count}, Artists: {artists_count}, Users: {users_count}")
            return jsonify({
                'status': 'healthy',
                'tracks': tracks_count,
                'artists': artists_count,
                'users': users_count,
                'database': 'connected'
            }), 200
        except Exception as e:
            logger.error(f"Health error: {e}")
            return jsonify({'status': 'error', 'message': str(e)}), 500

    return app

if __name__ == '__main__':
    app = create_app()
    logger.info("🎵 StreamMusic Backend starting on http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)