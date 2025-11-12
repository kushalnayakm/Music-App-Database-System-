import React, { useState, useEffect, useContext, createContext, useRef } from 'react';

const AuthContext = createContext();
const PlayerContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  const login = async (email, password) => {
    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) { setUser(data.user); setToken(data.token); return { success: true }; }
      return { success: false, message: data.error };
    } catch (e) { return { success: false, message: 'Network error' }; }
  };

export default AppContent;
      });
      const data = await res.json();
      if (res.ok) { setUser(data.user); setToken(data.token); return { success: true }; }
      return { success: false, message: data.error };
    } catch (e) { return { success: false, message: 'Network error' }; }
  };

  const logout = () => { setUser(null); setToken(null); };

  return <AuthContext.Provider value={{ user, token, login, register, logout }}>{children}</AuthContext.Provider>;
};

export const PlayerProvider = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);

  const play = (t) => { setCurrentTrack(t); setIsPlaying(true); };
  const pause = () => setIsPlaying(false);

  return <PlayerContext.Provider value={{ currentTrack, isPlaying, play, pause, volume, setVolume }}>{children}</PlayerContext.Provider>;
};

const Player = () => {
  const { currentTrack, isPlaying, pause, play, volume, setVolume } = useContext(PlayerContext);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current; audio.volume = volume;
    if (currentTrack && currentTrack.stream_url) {
      if (audio.src !== currentTrack.stream_url) audio.src = currentTrack.stream_url;
      if (isPlaying) audio.play().catch(()=>{}); else audio.pause();
    } else audio.pause();
  }, [currentTrack, isPlaying, volume]);

  if (!currentTrack) return <div style={{padding:12}}>No track selected</div>;

  return (
    <div style={{padding:12,borderTop:'1px solid #ddd'}}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div>
          <strong>{currentTrack.title}</strong>
          <div style={{fontSize:12}}>{currentTrack.artist_name}</div>
        </div>
        <div>
          <button onClick={() => isPlaying ? pause() : play(currentTrack)}>{isPlaying ? 'Pause' : 'Play'}</button>
        </div>
        <div>
          <input type="range" min="0" max="1" step="0.01" value={volume} onChange={e=>setVolume(parseFloat(e.target.value))} />
        </div>
      </div>
    </div>
  );
};

const Home = () => {
  const [tracks,setTracks] = useState([]);
  const { token } = useContext(AuthContext);
  const { play } = useContext(PlayerContext);

  useEffect(()=>{ (async()=>{ try{ const r=await fetch('http://localhost:5000/api/tracks?page=1&limit=50'); const d=await r.json(); setTracks(d.tracks||[]); }catch(e){console.error(e);} })(); },[]);

  const handleLike = async (id) => {
    if (!token) return alert('Login');
    try{ const res=await fetch(`http://localhost:5000/api/tracks/${id}/like`,{ method:'POST', headers:{ 'Content-Type':'application/json','Authorization':`Bearer ${token}` } }); if(!res.ok){ const d=await res.json().catch(()=>({})); alert(d.error||'Failed'); return; } const d=await res.json(); console.log('liked',d); }catch(e){console.error(e);alert('Network');}
  };

  return (
    <div style={{padding:16}}>
      <h2>Tracks</h2>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:12}}>
        {tracks.map(t=> (
          <div key={t.track_id} style={{padding:12,border:'1px solid #ddd',borderRadius:8,display:'flex',justifyContent:'space-between'}}>
            <div>
              <strong>{t.title}</strong>
              <div style={{fontSize:12}}>{t.artist_name}</div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              <button onClick={()=>play(t)}>Play</button>
              <button onClick={()=>handleLike(t.track_id)}>♥ {t.likes_count||0}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Library = () => {
  const { token, user } = useContext(AuthContext);
  const [title,setTitle] = useState('');
  const [playlists,setPlaylists] = useState([]);

  useEffect(()=>{ if(!user) return; (async()=>{ try{ const r=await fetch(`http://localhost:5000/api/playlists/user/${user.user_id}`); const d=await r.json(); setPlaylists(d.playlists||[]); }catch(e){console.error(e);} })(); },[user]);

  const create = async (e) => { e.preventDefault(); if(!title.trim()) return; try{ const res=await fetch('http://localhost:5000/api/playlists',{ method:'POST', headers:{ 'Content-Type':'application/json','Authorization':`Bearer ${token}` }, body: JSON.stringify({ title: title.trim() }) }); const d=await res.json(); if(!res.ok) return alert(d.error||'Failed'); setTitle(''); setPlaylists(prev=>[...(prev||[]), d.playlist]); alert('Created'); }catch(e){console.error(e);alert('Network');} };

  if(!user) return <div style={{padding:16}}>Login to manage playlists</div>;

  return (
    <div style={{padding:16}}>
      <h2>Your Playlists</h2>
      <form onSubmit={create} style={{display:'flex',gap:8}}>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Playlist name" />
        <button type="submit">Create</button>
      </form>
      <div style={{marginTop:12}}>
        {playlists.length === 0 ? 'No playlists' : (
          <ul>{playlists.map(p=> <li key={p.playlist_id}>{p.title} ({p.track_count})</li>)}</ul>
        )}
      </div>
    </div>
  );
};

const Login = ({ onSuccess }) => {
  const { login } = useContext(AuthContext);
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const submit = async (e) => { e.preventDefault(); const r = await login(email,password); if(r.success) onSuccess(); else alert(r.message); };
  return (
    <div style={{padding:16}}>
      <h2>Login</h2>
      <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:8}}>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" />
        <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password" />
        <button type="submit">Login</button>
      </form>
    </div>
  );
};

const AppContent = () => {
  const { user } = useContext(AuthContext);
  const [page,setPage] = useState(user? 'home':'login');
  useEffect(()=>{ if(user) setPage('home'); },[user]);
  return (
    <div>
      <header style={{padding:12,background:'#0a0e27',color:'#fff'}}>
        <div>🎵 StreamMusic</div>
      </header>
      <div style={{display:'flex'}}>
        <nav style={{width:200,padding:12}}>
          <button onClick={()=>setPage('home')}>Home</button>
          <button onClick={()=>setPage('library')}>Library</button>
        </nav>
        <main style={{flex:1}}>
          {page === 'login' && <Login onSuccess={()=>setPage('home')} />}
          {page === 'home' && <Home />}
          {page === 'library' && <Library />}
        </main>
      </div>
      <footer><Player /></footer>
    </div>
  );
};

export default AppContent;

We created file. Now update index.js to import from './App.clean' instead of './App'. Use apply_patch to update index.js. We must change import line. Let's patch index.js. We'll replace the import line and exported names likely still match. Use Update File modifying import. Provide context. We'll replace 