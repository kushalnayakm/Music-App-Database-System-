// App.js - COMPLETE VERSION WITH ALL DATABASE FEATURES
import React, { useState, useEffect, useContext, createContext, useRef } from 'react';

// ============== CONTEXTS ==============
const AuthContext = createContext();
const PlayerContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (token) await fetchUser();
      else setLoading(false);
    };
    checkAuth();
  }, [token]);

  const fetchUser = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/auth/user', {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      }
    } catch (e) {
      console.error('Fetch user error:', e);
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('token', data.token);
        return { success: true };
      }
      return { success: false, message: data.error };
    } catch (e) {
      return { success: false, message: 'Network error' };
    }
  };

  const register = async (username, email, password) => {
    try {
      const res = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('token', data.token);
        return { success: true };
      }
      return { success: false, message: data.error };
    } catch (e) {
      return { success: false, message: 'Network error' };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0e27', color: '#fff' }}>
        <div style={{ fontSize: '1.2rem' }}>⏳ Loading...</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const PlayerProvider = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);
  const blobUrlRef = useRef(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.addEventListener('timeupdate', () => {
        if (audioRef.current.duration) {
          const prog = (audioRef.current.currentTime / audioRef.current.duration) * 100;
          setProgress(prog);
        }
      });
      audioRef.current.addEventListener('loadedmetadata', () => {
        setDuration(audioRef.current.duration);
      });
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
        setProgress(0);
      });
    }
  }, []);

  const play = async (track) => {
    try {
      const streamUrl = `http://localhost:5000/api/tracks/${track.track_id}/stream`;

      // Revoke any previous blob URL
      if (blobUrlRef.current) {
        try { URL.revokeObjectURL(blobUrlRef.current); } catch (e) {}
        blobUrlRef.current = null;
      }

      // Try fetching the audio as a blob first (works around some streaming/CORS issues)
      try {
        const resp = await fetch(streamUrl, { method: 'GET' });
        if (resp.ok) {
          const contentType = resp.headers.get('content-type') || '';
          // Only treat as audio when content-type looks like audio or octet-stream
          if (contentType.startsWith('audio/') || contentType === 'application/octet-stream') {
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            blobUrlRef.current = url;
            if (audioRef.current.src !== url) {
              audioRef.current.src = url;
              audioRef.current.load();
            }
            await audioRef.current.play();
            setCurrentTrack(track);
            setIsPlaying(true);
            return;
          }
        }
      } catch (e) {
        console.warn('Blob fetch failed, falling back to stream URL:', e);
      }

      // Fallback: use stream URL directly
      if (audioRef.current.src !== streamUrl) {
        audioRef.current.src = streamUrl;
        audioRef.current.load();
      }
      await audioRef.current.play();
      setCurrentTrack(track);
      setIsPlaying(true);
    } catch (error) {
      console.error('Play error:', error);
      alert('Unable to play this track. Make sure the file exists.');
    }
  };

  const pause = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
  };

  const seek = (percent) => {
    if (audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = (percent / 100) * audioRef.current.duration;
      setProgress(percent);
    }
  };

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  return (
    <PlayerContext.Provider value={{ currentTrack, isPlaying, play, pause, volume, setVolume, progress, duration, seek }}>
      {children}
    </PlayerContext.Provider>
  );
};

// ============== PLAYER COMPONENT ==============
const Player = () => {
  const { currentTrack, isPlaying, pause, play, volume, setVolume, progress, duration, seek } = useContext(PlayerContext);

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentTrack) {
    return (
      <div style={styles.player}>
        <div style={styles.playerContent}>
          <p style={styles.noTrackMessage}>🎵 Select a track to play</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.player}>
      <div style={styles.progressBarContainer} onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const percent = ((e.clientX - rect.left) / rect.width) * 100;
        seek(percent);
      }}>
        <div style={{ ...styles.progressBar, width: `${progress}%` }}></div>
      </div>
      <div style={styles.playerContent}>
        <div style={styles.playerInfo}>
          <h3 style={styles.playerTitle}>{currentTrack.title}</h3>
          <p style={styles.playerSubtitle}>
            {currentTrack.artist_name} {currentTrack.album_title && `• ${currentTrack.album_title}`}
          </p>
          <p style={styles.playerTime}>
            {formatTime((progress / 100) * duration)} / {formatTime(duration)}
          </p>
        </div>
        <div style={styles.playerControls}>
          <button onClick={() => (isPlaying ? pause() : play(currentTrack))} style={styles.playPauseBtn} title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? '⏸' : '▶'}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🔊</span>
          <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} style={styles.volumeSlider} />
        </div>
      </div>
    </div>
  );
};

// ============== UPLOAD MUSIC ==============
const UploadMusic = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [albumTitle, setAlbumTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const { token } = useContext(AuthContext);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!title) {
        const name = selectedFile.name.replace(/\.[^/.]+$/, '');
        setTitle(name);
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !title) {
      setError('Please select a file and enter a title');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('artist_name', artistName || 'Unknown Artist');
      if (albumTitle) formData.append('album_title', albumTitle);
      formData.append('duration', '00:03:30');

      const response = await fetch('http://localhost:5000/api/tracks/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setFile(null);
        setTitle('');
        setArtistName('');
        setAlbumTitle('');
        alert('✅ Track uploaded successfully!');
        if (onUploadSuccess) onUploadSuccess(data.track);
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError('Network error. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={styles.uploadContainer}>
      <h3 style={styles.uploadTitle}>⬆️ Upload Your Music</h3>
      {error && <div style={styles.errorMsg}>{error}</div>}
      <form onSubmit={handleUpload} style={styles.uploadForm}>
        <div style={styles.fileInputWrapper}>
          <input type="file" accept=".mp3,.wav,.ogg,.m4a,.flac" onChange={handleFileChange} style={styles.fileInput} id="file-upload" />
          <label htmlFor="file-upload" style={styles.fileLabel}>
            {file ? `📁 ${file.name}` : '📁 Choose Music File'}
          </label>
        </div>
        <input type="text" placeholder="Track Title *" value={title} onChange={(e) => setTitle(e.target.value)} style={styles.input} required />
        <input type="text" placeholder="Artist Name" value={artistName} onChange={(e) => setArtistName(e.target.value)} style={styles.input} />
        <input type="text" placeholder="Album Title (optional)" value={albumTitle} onChange={(e) => setAlbumTitle(e.target.value)} style={styles.input} />
        <button type="submit" disabled={uploading || !file || !title} style={{ ...styles.uploadBtn, opacity: uploading || !file || !title ? 0.5 : 1, cursor: uploading || !file || !title ? 'not-allowed' : 'pointer' }}>
          {uploading ? '⏳ Uploading...' : '⬆️ Upload Track'}
        </button>
      </form>
    </div>
  );
};

// ============== TRACK CARD ==============
const TrackCard = ({ track, onPlay, onLikeToggle, onDelete }) => {
  const [isLiked, setIsLiked] = useState(track.is_liked_by_user || false);
  const [likesCount, setLikesCount] = useState(track.likes_count || 0);
  const [isLoading, setIsLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { currentTrack, isPlaying } = useContext(PlayerContext);
  const isCurrentTrack = currentTrack?.track_id === track.track_id;

  useEffect(() => {
    setIsLiked(track.is_liked_by_user || false);
    setLikesCount(track.likes_count || 0);
  }, [track.is_liked_by_user, track.likes_count]);

  const handleLike = async (e) => {
    e.stopPropagation();
    if (isLoading) return;
    setIsLoading(true);
    try {
      const result = await onLikeToggle(track.track_id, isLiked);
      if (result.success) {
        setIsLiked(result.is_liked_by_user);
        setLikesCount(result.likes_count);
      }
    } catch (error) {
      console.error('Like error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = async (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (!window.confirm(`Delete "${track.title}"? This will remove it from the database.`)) return;
    try {
      if (typeof onLikeToggle !== 'function') {
        // no-op: parent will handle delete via onDelete prop
      }
      if (typeof onDelete === 'function') {
        await onDelete(track.track_id);
      }
    } catch (err) {
      console.error('Delete failed', err);
      alert('Failed to delete track');
    }
  };

  return (
    <div style={{ ...styles.trackCard, border: isCurrentTrack ? '2px solid #8a2be2' : '1px solid rgba(138, 43, 226, 0.3)', boxShadow: isCurrentTrack ? '0 0 20px rgba(138, 43, 226, 0.5)' : '0 2px 10px rgba(0, 0, 0, 0.1)' }}>
      <div style={styles.trackInfo}>
        {isCurrentTrack && isPlaying && <div style={styles.nowPlayingIndicator}>🎵 Now Playing</div>}
        <h3 style={styles.trackTitle}>{track.title}</h3>
        <p style={styles.trackArtist}>{track.artist_name}</p>
        {track.album_title && <p style={styles.trackAlbum}>{track.album_title}</p>}
        <p style={styles.trackDuration}>{track.duration || '00:00:00'}</p>
      </div>
      <div style={styles.trackActions}>
        <div style={{ position: 'relative' }}>
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} title="Options" style={styles.dotsBtn}>⋯</button>
          {menuOpen && (
            <div style={styles.menuDropdown} onClick={(e) => e.stopPropagation()}>
              <button style={styles.menuItem} onClick={handleDeleteClick}>Delete</button>
            </div>
          )}
        </div>
        <button onClick={() => onPlay(track)} style={{ ...styles.playBtn, background: isCurrentTrack && isPlaying ? 'linear-gradient(135deg, #ff1744, #f50057)' : 'linear-gradient(135deg, #8a2be2, #4b0082)' }} title={isCurrentTrack && isPlaying ? 'Playing' : 'Play'}>
          {isCurrentTrack && isPlaying ? '🔊' : '▶'}
        </button>
        <button onClick={handleLike} style={isLiked ? styles.likedBtn : styles.likeBtn} disabled={isLoading} title={isLiked ? 'Unlike' : 'Like'}>
          {isLoading ? '...' : `${isLiked ? '❤️' : '🤍'} ${likesCount}`}
        </button>
      </div>
    </div>
  );
};

// ============== HOME PAGE ==============
const Home = () => {
  const [popularTracks, setPopularTracks] = useState([]);
  const [allTracks, setAllTracks] = useState([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedView, setSelectedView] = useState('tracks'); // 'tracks' or 'artists'
  const { user, token } = useContext(AuthContext);
  const { play } = useContext(PlayerContext);

  useEffect(() => {
    loadData();
  }, [user, token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } : { 'Accept': 'application/json' };

  const plansRes = await fetch('http://localhost:5000/api/subscription_plans', { headers });
  const popularRes = await fetch('http://localhost:5000/api/tracks/popular?limit=10', { headers });
  const allRes = await fetch('http://localhost:5000/api/tracks?page=1&limit=50', { headers });
  const artistsRes = await fetch('http://localhost:5000/api/artists', { headers });

      // handle popular
      if (popularRes.ok) {
        const popularData = await popularRes.json();
        setPopularTracks(popularData.tracks || []);
      } else {
        const txt = await popularRes.text();
        console.error('Failed to load popular tracks:', popularRes.status, txt);
        setPopularTracks([]);
      }

      // handle subscription plans
      if (plansRes && plansRes.ok) {
        try {
          const plansData = await plansRes.json();
          setSubscriptionPlans(plansData.subscription_plans || []);
        } catch (e) {
          console.error('Failed to parse subscription plans JSON:', e);
          setSubscriptionPlans([]);
        }
      } else if (plansRes) {
        const txt = await plansRes.text();
        console.error('Failed to load subscription plans:', plansRes.status, txt);
        setSubscriptionPlans([]);
      }

      // handle all tracks
      if (allRes.ok) {
        const allData = await allRes.json();
        setAllTracks(allData.tracks || []);
      } else {
        const txt = await allRes.text();
        console.error('Failed to load all tracks:', allRes.status, txt);
        setAllTracks([]);
      }

      // handle artists
      if (artistsRes.ok) {
        const artistsData = await artistsRes.json();
        setArtists(artistsData.artists || []);
      } else {
        const txt = await artistsRes.text();
        console.error('Failed to load artists:', artistsRes.status, txt);
        setArtists([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLikeToggle = async (trackId, currentlyLiked) => {
    if (!token) {
      alert('Please login to like tracks');
      return { success: false };
    }

    try {
      const method = currentlyLiked ? 'DELETE' : 'POST';
      const response = await fetch(`http://localhost:5000/api/tracks/${trackId}/like`, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to update like status');
        return { success: false };
      }

      const data = await response.json();
      const updateTrack = (track) => {
        if (track.track_id === trackId) {
          return { ...track, is_liked_by_user: data.is_liked_by_user, likes_count: data.likes_count };
        }
        return track;
      };

      setPopularTracks(prev => prev.map(updateTrack));
      setAllTracks(prev => prev.map(updateTrack));

      return { success: true, is_liked_by_user: data.is_liked_by_user, likes_count: data.likes_count };
    } catch (error) {
      console.error('Like operation failed:', error);
      return { success: false };
    }
  };

  const handleUploadSuccess = (newTrack) => {
    setAllTracks(prev => [newTrack, ...prev]);
    setShowUpload(false);
    loadData();
  };

  const handleDeleteTrack = async (trackId) => {
    if (!token) {
      alert('Please login to delete tracks');
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/api/tracks/${trackId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'Failed to delete track');
        return;
      }
      // remove from state
      setAllTracks(prev => prev.filter(t => t.track_id !== trackId));
      setPopularTracks(prev => prev.filter(t => t.track_id !== trackId));
      alert('Track deleted');
    } catch (e) {
      console.error('Delete failed', e);
      alert('Network error when deleting track');
    }
  };

  if (loading) {
    return (
      <div style={styles.pageContent}>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContent}>
      {user && (
        <div style={styles.uploadSection}>
          <button onClick={() => setShowUpload(!showUpload)} style={styles.toggleUploadBtn}>
            {showUpload ? '✖️ Close Upload' : '⬆️ Upload Your Music'}
          </button>
          {showUpload && <UploadMusic onUploadSuccess={handleUploadSuccess} />}
        </div>
      )}

      {/* Subscription plans panel */}
      {subscriptionPlans && subscriptionPlans.length > 0 && (
        <section style={{ ...styles.section, marginBottom: '2rem' }}>
          <h2 style={styles.sectionTitle}>💳 Subscription Plans</h2>
          <div style={styles.plansGrid}>
            {subscriptionPlans.map((plan) => (
              <div key={plan.subscription_plan_id} style={styles.planCard}>
                <h3 style={styles.planName}>{plan.name} <span style={{ fontWeight: 400, fontSize: '0.95rem', color: '#ddd' }}>— ${Number(plan.price).toFixed(2)}</span></h3>
                <p style={styles.planDesc}>{plan.description}</p>
                <div style={{ marginTop: 12 }}>
                  <button style={styles.subscribeBtn} onClick={() => alert(`${plan.name} selected (id=${plan.subscription_plan_id})`)}>Choose</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={styles.viewSelector}>
        <button onClick={() => setSelectedView('tracks')} style={selectedView === 'tracks' ? styles.viewBtnActive : styles.viewBtn}>
          🎵 Tracks
        </button>
        <button onClick={() => setSelectedView('artists')} style={selectedView === 'artists' ? styles.viewBtnActive : styles.viewBtn}>
          🎤 Artists
        </button>
      </div>

      {selectedView === 'tracks' ? (
        <>
          {popularTracks.length > 0 && (
            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>🔥 Popular Tracks</h2>
              <div style={styles.tracksGrid}>
                {popularTracks.map((track) => (
                  <TrackCard key={track.track_id} track={track} onPlay={play} onLikeToggle={handleLikeToggle} onDelete={handleDeleteTrack} />
                ))}
              </div>
            </section>
          )}

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>🎵 All Tracks</h2>
            {allTracks.length === 0 ? (
              <div style={styles.emptyState}>
                <p style={{ fontSize: '3rem' }}>🎵</p>
                <p style={{ fontSize: '1.2rem' }}>No tracks available yet</p>
                <p style={{ color: '#888', marginTop: '0.5rem' }}>Upload your first track to get started!</p>
              </div>
            ) : (
              <div style={styles.tracksGrid}>
                {allTracks.map((track) => (
                  <TrackCard key={track.track_id} track={track} onPlay={play} onLikeToggle={handleLikeToggle} onDelete={handleDeleteTrack} />
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>🎤 All Artists</h2>
          {artists.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={{ fontSize: '3rem' }}>🎤</p>
              <p style={{ fontSize: '1.2rem' }}>No artists available yet</p>
            </div>
          ) : (
            <div style={styles.artistsGrid}>
              {artists.map((artist) => (
                <div key={artist.artist_id} style={styles.artistCard}>
                  <div style={styles.artistIcon}>🎤</div>
                  <h3 style={styles.artistName}>{artist.name}</h3>
                  <p style={styles.artistGenre}>{artist.genre || 'Unknown Genre'}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

// ============== LIBRARY PAGE (WITH PLAYLISTS) ==============
const Library = ({ onNavigate }) => {
  const [playlists, setPlaylists] = useState([]);
  const [likedTracks, setLikedTracks] = useState([]);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [selectedTab, setSelectedTab] = useState('playlists'); // 'playlists' or 'liked'
  const { user, token } = useContext(AuthContext);
  const { play } = useContext(PlayerContext);

  useEffect(() => {
    if (user) {
      loadLibrary();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadLibrary = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [playlistsRes, likedRes] = await Promise.all([
        fetch(`http://localhost:5000/api/playlists/user/${user.user_id}`, { headers }),
        fetch(`http://localhost:5000/api/tracks/user/${user.user_id}/likes`, { headers })
      ]);
      let playlistsData = { playlists: [] };
      let likedData = {};

      if (playlistsRes.ok) {
        try {
          playlistsData = await playlistsRes.json();
        } catch (e) {
          console.error('Failed to parse playlists JSON:', e, await playlistsRes.text());
        }
      } else {
        const txt = await playlistsRes.text();
        console.error('Failed to load playlists:', playlistsRes.status, txt);
      }

      if (likedRes.ok) {
        try {
          likedData = await likedRes.json();
        } catch (e) {
          console.error('Failed to parse liked tracks JSON:', e, await likedRes.text());
        }
      } else {
        const txt = await likedRes.text();
        console.error('Failed to load liked tracks:', likedRes.status, txt);
      }

      // Accept multiple possible keys from the backend for liked tracks
      const likedTracksList = likedData.liked_tracks || likedData.tracks || likedData.liked || [];

      setPlaylists(playlistsData.playlists || []);
      setLikedTracks(likedTracksList || []);
    } catch (error) {
      console.error('Error loading library:', error);
      setError('Failed to load library');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaylist = async (e) => {
    e.preventDefault();
    if (!newPlaylistTitle.trim()) {
      setError('Please enter a playlist title');
      return;
    }

    setCreating(true);
    setError('');

    try {
      console.log('Creating playlist:', { title: newPlaylistTitle.trim() });
      
      const response = await fetch('http://localhost:5000/api/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: newPlaylistTitle.trim() })
      });

      const data = await response.json();
      console.log('Playlist creation response:', { status: response.status, data });

      if (response.ok) {
        setPlaylists(prev => [...prev, data.playlist]);
        setNewPlaylistTitle('');
        setError('');
        alert('✅ Playlist created successfully!');
      } else {
        setError(data.error || 'Failed to create playlist');
      }
    } catch (error) {
      console.error('Error creating playlist:', error);
      setError('Network error. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleLikeToggle = async (trackId, currentlyLiked) => {
    try {
      const method = currentlyLiked ? 'DELETE' : 'POST';
      const response = await fetch(`http://localhost:5000/api/tracks/${trackId}/like`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        loadLibrary(); // Reload to update liked tracks
        return { success: true };
      }
      return { success: false };
    } catch (error) {
      return { success: false };
    }
  };

  if (!user) {
    return (
      <div style={styles.pageContent}>
        <div style={styles.emptyState}>
          <h2>Please log in</h2>
          <button onClick={() => onNavigate('login')} style={styles.submitBtn}>Go to Login</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContent}>
      <h2 style={styles.sectionTitle}>📚 Your Library</h2>

      <div style={styles.viewSelector}>
        <button onClick={() => setSelectedTab('playlists')} style={selectedTab === 'playlists' ? styles.viewBtnActive : styles.viewBtn}>
          📁 Playlists ({playlists.length})
        </button>
        <button onClick={() => setSelectedTab('liked')} style={selectedTab === 'liked' ? styles.viewBtnActive : styles.viewBtn}>
          ❤️ Liked Songs ({likedTracks.length})
        </button>
      </div>

      {error && <div style={styles.errorMsg}>{error}</div>}

      {selectedTab === 'playlists' ? (
        <>
          <form onSubmit={handleCreatePlaylist} style={styles.createPlaylistForm}>
            <input
              type="text"
              placeholder="Enter playlist name..."
              value={newPlaylistTitle}
              onChange={(e) => setNewPlaylistTitle(e.target.value)}
              style={styles.playlistInput}
              disabled={creating || loading}
              maxLength={150}
            />
            <button type="submit" style={{ ...styles.createPlaylistBtn, opacity: creating || loading || !newPlaylistTitle.trim() ? 0.5 : 1, cursor: creating || loading || !newPlaylistTitle.trim() ? 'not-allowed' : 'pointer' }} disabled={creating || loading || !newPlaylistTitle.trim()}>
              {creating ? '⏳ Creating...' : '➕ Create Playlist'}
            </button>
          </form>

          {loading ? (
            <div style={styles.loadingContainer}>
              <div style={styles.loadingSpinner}></div>
              <p>Loading playlists...</p>
            </div>
          ) : playlists.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={{ fontSize: '3rem' }}>📁</p>
              <p style={{ fontSize: '1.2rem' }}>No playlists yet</p>
              <p style={{ color: '#888', marginTop: '0.5rem' }}>Create your first playlist above!</p>
            </div>
          ) : (
            <div style={styles.playlistsGrid}>
              {playlists.map((playlist) => (
                <div key={playlist.playlist_id} style={styles.playlistCard}>
                  <div style={styles.playlistIcon}>📁</div>
                  <h3 style={styles.playlistTitle}>{playlist.title}</h3>
                  <p style={styles.playlistInfo}>{playlist.track_count || 0} {playlist.track_count === 1 ? 'track' : 'tracks'}</p>
                  <p style={styles.playlistDate}>Created: {new Date(playlist.creation_date).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {loading ? (
            <div style={styles.loadingContainer}>
              <div style={styles.loadingSpinner}></div>
              <p>Loading liked songs...</p>
            </div>
          ) : likedTracks.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={{ fontSize: '3rem' }}>❤️</p>
              <p style={{ fontSize: '1.2rem' }}>No liked songs yet</p>
              <p style={{ color: '#888', marginTop: '0.5rem' }}>Start liking songs to see them here!</p>
            </div>
          ) : (
            <div style={styles.tracksGrid}>
              {likedTracks.map((track) => (
                <TrackCard key={track.track_id} track={track} onPlay={play} onLikeToggle={handleLikeToggle} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ============== LOGIN & REGISTER (SAME AS BEFORE) ==============
const Login = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    if (result.success) {
      onNavigate('home');
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  return (
    <div style={styles.authContainer}>
      <div style={styles.authBox}>
        <h2 style={{ textAlign: 'center', marginBottom: '2rem', fontSize: '2rem' }}>🎵 Login to StreamMusic</h2>
        {error && <div style={styles.errorMsg}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} required />
          <button type="submit" disabled={loading} style={styles.submitBtn}>{loading ? 'Logging in...' : 'Login'}</button>
        </form>
        <p style={styles.switchAuth}>Don't have an account? <button onClick={() => onNavigate('register')} style={styles.switchBtn}>Register</button></p>
      </div>
    </div>
  );
};

const Register = ({ onNavigate }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await register(username, email, password);
    if (result.success) {
      onNavigate('home');
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  return (
    <div style={styles.authContainer}>
      <div style={styles.authBox}>
        <h2 style={{ textAlign: 'center', marginBottom: '2rem', fontSize: '2rem' }}>🎵 Join StreamMusic</h2>
        {error && <div style={styles.errorMsg}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} style={styles.input} required />
          <input type="text" placeholder="Email (just add @)" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} required />
          <input type="password" placeholder="Password (min 3 chars)" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} required minLength={3} />
          <button type="submit" disabled={loading} style={styles.submitBtn}>{loading ? 'Registering...' : 'Register'}</button>
        </form>
        <p style={styles.switchAuth}>Already have an account? <button onClick={() => onNavigate('login')} style={styles.switchBtn}>Login</button></p>
      </div>
    </div>
  );
};

// ============== NAVBAR & SIDEBAR (SAME AS BEFORE) ==============
const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  return (
    <nav style={styles.navbar}>
      <div style={styles.navContent}>
        <h1 style={styles.logo}>🎵 StreamMusic</h1>
        {user && (
          <div style={styles.navRight}>
            <span style={styles.username}>Hi, {user.username}</span>
            <button onClick={logout} style={styles.logoutBtn}>Logout</button>
          </div>
        )}
      </div>
    </nav>
  );
};

const Sidebar = ({ onNavigate, currentPage }) => {
  return (
    <aside style={styles.sidebar}>
      <div style={styles.sidebarContent}>
        <button onClick={() => onNavigate('home')} style={currentPage === 'home' ? { ...styles.sidebarBtn, ...styles.activeBtn } : styles.sidebarBtn}>🏠 Home</button>
        <button onClick={() => onNavigate('library')} style={currentPage === 'library' ? { ...styles.sidebarBtn, ...styles.activeBtn } : styles.sidebarBtn}>📚 Library</button>
      </div>
    </aside>
  );
};

// ============== MAIN APP ==============
const AppContent = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const { user } = useContext(AuthContext);

  const navigate = (page) => setCurrentPage(page);

  useEffect(() => {
    if (!user && currentPage !== 'register') {
      setCurrentPage('login');
    }
  }, [user, currentPage]);

  const renderPage = () => {
    if (!user) {
      return currentPage === 'register' ? <Register onNavigate={navigate} /> : <Login onNavigate={navigate} />;
    }
    switch (currentPage) {
      case 'home': return <Home />;
      case 'library': return <Library onNavigate={navigate} />;
      default: return <Home />;
    }
  };

  return (
    <div style={styles.container}>
      <Navbar />
      <div style={styles.main}>
        {user && <Sidebar onNavigate={navigate} currentPage={currentPage} />}
        <div style={styles.content}>{renderPage()}</div>
      </div>
      {user && <Player />}
    </div>
  );
};

// ============== STYLES (SAME FULL-SCREEN CSS) ==============
const styles = {
  container: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', margin: 0, padding: 0, backgroundColor: '#0a0e27', color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', overflow: 'hidden' },
  navbar: { background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.3) 0%, rgba(75, 0, 130, 0.3) 100%)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(138, 43, 226, 0.3)', padding: '1rem 2rem', zIndex: 100, flexShrink: 0 },
  navContent: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '100%' },
  logo: { fontSize: '1.8rem', margin: 0, fontWeight: 'bold', background: 'linear-gradient(135deg, #8a2be2, #4b0082)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  navRight: { display: 'flex', gap: '1.5rem', alignItems: 'center' },
  username: { fontSize: '1rem', opacity: 0.9 },
  logoutBtn: { background: 'linear-gradient(135deg, #8a2be2, #4b0082)', border: 'none', color: '#fff', padding: '0.6rem 1.5rem', borderRadius: '25px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem', transition: 'all 0.2s' },
  main: { display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' },
  sidebar: { width: '250px', background: 'rgba(20, 20, 40, 0.95)', borderRight: '1px solid rgba(138, 43, 226, 0.3)', padding: '2rem 0', overflowY: 'auto', flexShrink: 0 },
  sidebarContent: { display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0 1rem' },
  sidebarBtn: { background: 'transparent', border: 'none', color: '#fff', padding: '1rem 1.5rem', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', borderLeft: '3px solid transparent', fontSize: '1.05rem', borderRadius: '8px' },
  activeBtn: { borderLeft: '3px solid #8a2be2', background: 'rgba(138, 43, 226, 0.25)' },
  content: { flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative', height: '100%' },
  pageContent: { padding: '2.5rem 3rem', paddingBottom: '120px', minHeight: '100%' },
  uploadSection: { marginBottom: '3rem' },
  toggleUploadBtn: { background: 'linear-gradient(135deg, #8a2be2, #4b0082)', border: 'none', color: '#fff', padding: '1.2rem 2.5rem', borderRadius: '30px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold', transition: 'all 0.3s ease', marginBottom: '1.5rem', boxShadow: '0 4px 15px rgba(138, 43, 226, 0.4)' },
  uploadContainer: { background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.2) 0%, rgba(75, 0, 130, 0.2) 100%)', backdropFilter: 'blur(10px)', border: '1px solid rgba(138, 43, 226, 0.4)', borderRadius: '15px', padding: '2.5rem', marginTop: '1.5rem', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)' },
  uploadTitle: { fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '2rem', background: 'linear-gradient(135deg, #8a2be2, #4b0082)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  uploadForm: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  fileInputWrapper: { position: 'relative' },
  fileInput: { display: 'none' },
  fileLabel: { display: 'block', width: '100%', padding: '1.5rem', background: 'rgba(138, 43, 226, 0.3)', border: '2px dashed rgba(138, 43, 226, 0.6)', borderRadius: '12px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s ease', fontSize: '1.05rem' },
  uploadBtn: { padding: '1.2rem', background: 'linear-gradient(135deg, #8a2be2, #4b0082)', border: 'none', color: '#fff', borderRadius: '10px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold', transition: 'all 0.3s ease' },
  viewSelector: { display: 'flex', gap: '1rem', marginBottom: '2rem' },
  viewBtn: { background: 'rgba(138, 43, 226, 0.2)', border: '1px solid rgba(138, 43, 226, 0.4)', color: '#fff', padding: '0.8rem 1.5rem', borderRadius: '10px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', transition: 'all 0.3s ease' },
  viewBtnActive: { background: 'linear-gradient(135deg, #8a2be2, #4b0082)', border: '1px solid #8a2be2', color: '#fff', padding: '0.8rem 1.5rem', borderRadius: '10px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(138, 43, 226, 0.4)' },
  section: { marginBottom: '4rem' },
  sectionTitle: { fontSize: '2.2rem', fontWeight: 'bold', marginBottom: '2rem', background: 'linear-gradient(135deg, #8a2be2, #4b0082)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  tracksGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '2rem', marginTop: '1.5rem' },
  artistsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '2rem', marginTop: '1.5rem' },
  artistCard: { background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.15) 0%, rgba(75, 0, 130, 0.15) 100%)', backdropFilter: 'blur(10px)', border: '1px solid rgba(138, 43, 226, 0.3)', borderRadius: '15px', padding: '2rem', textAlign: 'center', transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)' },
  artistIcon: { fontSize: '4rem', marginBottom: '1rem' },
  artistName: { fontSize: '1.5rem', fontWeight: 'bold', margin: '0 0 0.5rem 0' },
  artistGenre: { fontSize: '1rem', opacity: 0.7, margin: 0 },
  trackCard: { background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.15) 0%, rgba(75, 0, 130, 0.15) 100%)', backdropFilter: 'blur(10px)', border: '1px solid rgba(138, 43, 226, 0.3)', borderRadius: '15px', padding: '1.5rem', transition: 'all 0.3s ease', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)' },
  trackInfo: { flex: 1 },
  nowPlayingIndicator: { color: '#8a2be2', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.5rem', animation: 'pulse 2s infinite' },
  trackTitle: { margin: '0 0 0.5rem 0', fontSize: '1.15rem', fontWeight: 'bold' },
  trackArtist: { margin: '0', fontSize: '0.95rem', opacity: 0.85 },
  trackAlbum: { margin: '0.3rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 },
  trackDuration: { margin: '0.4rem 0 0 0', fontSize: '0.85rem', opacity: 0.75 },
  trackActions: { display: 'flex', gap: '0.75rem', marginLeft: '1.5rem' },
  playBtn: { background: 'linear-gradient(135deg, #8a2be2, #4b0082)', border: 'none', color: '#fff', width: '50px', height: '50px', borderRadius: '50%', cursor: 'pointer', fontSize: '1.2rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  likeBtn: { background: 'rgba(138, 43, 226, 0.3)', border: '1px solid rgba(138, 43, 226, 0.5)', color: '#fff', padding: '0.6rem 1rem', borderRadius: '25px', cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.2s', minWidth: '70px' },
  likedBtn: { background: 'linear-gradient(135deg, #ff1744, #f50057)', border: '1px solid #ff4444', color: '#fff', padding: '0.6rem 1rem', borderRadius: '25px', cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.2s', minWidth: '70px', boxShadow: '0 0 20px rgba(255, 23, 68, 0.5)' },
  playlistsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem', padding: '1rem 0' },
  playlistCard: { background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.15) 0%, rgba(75, 0, 130, 0.15) 100%)', backdropFilter: 'blur(10px)', border: '1px solid rgba(138, 43, 226, 0.3)', borderRadius: '15px', padding: '2rem', transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)', textAlign: 'center' },
  playlistIcon: { fontSize: '3rem', marginBottom: '1rem' },
  playlistTitle: { fontSize: '1.3rem', fontWeight: 'bold', margin: '0 0 0.5rem 0' },
  playlistInfo: { fontSize: '0.95rem', color: '#aaa', margin: '0 0 0.3rem 0' },
  playlistDate: { fontSize: '0.8rem', color: '#888', margin: 0 },
  createPlaylistForm: { display: 'flex', gap: '1rem', marginBottom: '2rem' },
  playlistInput: { flex: 1, padding: '1rem', fontSize: '1rem', color: '#fff', background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(138, 43, 226, 0.3)', borderRadius: '8px' },
  createPlaylistBtn: { padding: '0 2rem', fontSize: '1rem', color: '#fff', background: 'linear-gradient(135deg, #8a2be2, #4b0082)', border: 'none', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.3s ease', fontWeight: 'bold' },
  player: { position: 'fixed', bottom: 0, left: 0, right: 0, background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.4) 0%, rgba(75, 0, 130, 0.4) 100%)', backdropFilter: 'blur(15px)', borderTop: '1px solid rgba(138, 43, 226, 0.4)', padding: '1.5rem 2.5rem 0', height: '95px', zIndex: 99, boxShadow: '0 -4px 30px rgba(0, 0, 0, 0.3)' },
  playerContent: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '100%' },
  playerInfo: { flex: 1, maxWidth: '40%' },
  playerTitle: { margin: '0 0 0.4rem 0', color: '#fff', fontSize: '1.2rem', fontWeight: 'bold' },
  playerSubtitle: { margin: 0, opacity: 0.75, fontSize: '0.95rem', color: '#ccc' },
  playerTime: { fontSize: '0.8rem', color: '#aaa', marginTop: '0.4rem' },
  noTrackMessage: { color: '#888', margin: 0, fontSize: '1rem' },
  playerControls: { display: 'flex', gap: '1.5rem', flex: 1, justifyContent: 'center' },
  playPauseBtn: { background: 'linear-gradient(135deg, #8a2be2, #4b0082)', border: 'none', color: '#fff', width: '60px', height: '60px', borderRadius: '50%', cursor: 'pointer', fontSize: '1.5rem', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(138, 43, 226, 0.4)' },
  progressBarContainer: { width: '100%', height: '5px', backgroundColor: 'rgba(255, 255, 255, 0.15)', position: 'absolute', bottom: 0, left: 0, cursor: 'pointer' },
  progressBar: { height: '100%', background: 'linear-gradient(90deg, #8a2be2, #4b0082)', transition: 'width 0.1s linear' },
  volumeSlider: { width: '120px' },
  authContainer: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0a0e27 0%, #1a0e3f 100%)', padding: '2rem' },
  authBox: { background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.2) 0%, rgba(75, 0, 130, 0.2) 100%)', backdropFilter: 'blur(10px)', border: '1px solid rgba(138, 43, 226, 0.4)', borderRadius: '25px', padding: '4rem 3rem', width: '100%', maxWidth: '500px', boxShadow: '0 15px 50px rgba(138, 43, 226, 0.3)' },
  input: { width: '100%', padding: '1rem', marginBottom: '1.5rem', background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(138, 43, 226, 0.4)', borderRadius: '12px', color: '#fff', fontSize: '1.05rem', boxSizing: 'border-box' },
  submitBtn: { width: '100%', padding: '1.2rem', background: 'linear-gradient(135deg, #8a2be2, #4b0082)', border: 'none', color: '#fff', borderRadius: '12px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(138, 43, 226, 0.4)' },
  errorMsg: { background: 'rgba(255, 0, 0, 0.25)', border: '1px solid rgba(255, 0, 0, 0.5)', color: '#ff6b6b', padding: '1rem', borderRadius: '10px', marginBottom: '1.5rem' },
  switchAuth: { textAlign: 'center', marginTop: '1.5rem', fontSize: '1rem' },
  switchBtn: { background: 'none', border: 'none', color: '#8a2be2', cursor: 'pointer', fontSize: '1rem', textDecoration: 'underline', fontWeight: 'bold' },
  loadingContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem' },
  loadingSpinner: { width: '50px', height: '50px', border: '4px solid rgba(138, 43, 226, 0.2)', borderTop: '4px solid #8a2be2', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '1.5rem' },
  emptyState: { textAlign: 'center', padding: '5rem 2rem', color: '#aaa' },
  plansGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginTop: '1rem' },
  planCard: { background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.12) 0%, rgba(75, 0, 130, 0.12) 100%)', backdropFilter: 'blur(6px)', border: '1px solid rgba(138, 43, 226, 0.2)', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' },
  planName: { margin: '0 0 0.5rem 0', fontSize: '1.15rem', fontWeight: '700' },
  planDesc: { margin: 0, color: '#ddd', opacity: 0.95, fontSize: '0.95rem' },
  subscribeBtn: { marginTop: '0.5rem', padding: '0.6rem 1rem', background: 'linear-gradient(135deg, #8a2be2, #4b0082)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer' },
  dotsBtn: { background: 'transparent', border: 'none', color: '#fff', fontSize: '1.4rem', cursor: 'pointer', padding: '0.2rem 0.6rem', borderRadius: '6px' },
  menuDropdown: { position: 'absolute', right: 0, top: '36px', background: 'rgba(20,20,40,0.95)', border: '1px solid rgba(138,43,226,0.2)', borderRadius: '8px', padding: '0.25rem', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 200 },
  menuItem: { background: 'transparent', border: 'none', color: '#fff', padding: '0.6rem 1rem', display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer' },
};

const styleSheet = document.createElement('style');
styleSheet.textContent = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #root { height: 100%; width: 100%; overflow: hidden; margin: 0; padding: 0; }
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  input:focus { outline: none; border-color: #8a2be2; box-shadow: 0 0 15px rgba(138, 43, 226, 0.4); }
  button:hover:not(:disabled) { transform: scale(1.05); box-shadow: 0 6px 20px rgba(138, 43, 226, 0.5); }
  button:active:not(:disabled) { transform: scale(0.98); }
  ::-webkit-scrollbar { width: 12px; }
  ::-webkit-scrollbar-track { background: rgba(20, 20, 40, 0.5); }
  ::-webkit-scrollbar-thumb { background: rgba(138, 43, 226, 0.5); border-radius: 6px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(138, 43, 226, 0.7); }
`;
document.head.appendChild(styleSheet);

export default function App() {
  return (
    <AuthProvider>
      <PlayerProvider>
        <AppContent />
      </PlayerProvider>
    </AuthProvider>
  );
}
