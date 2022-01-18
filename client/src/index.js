import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { Canvas } from '@react-three/fiber';
import { useAuth } from './useAuth';
import { useNetwork } from './useNetwork';
import { World } from './world';
import { CAMERA_Z_DISTANCE_FROM_PLAYER } from './contants';
import { useIsMobile } from './useIsMobile';
import './styles.css';

const App = () => {
  const [worldData, setWorldData] = useState();
  const { authToken, login, logout, userId } = useAuth();
  const { socketClient, isServerAuthed } = useNetwork();
  const isMobile = useIsMobile();

  // get world data from server
  useEffect(() => {
    if (authToken) {
      fetch(`${process.env.REACT_APP_SERVER_URL}/world`, {
        headers: {
          'auth-token': authToken,
        },
      })
        .then((res) => res.json())
        .then((data) => setWorldData(data.worldData))
        .catch((err) => console.log(err));
    }
  }, [authToken]);

  return (
    <>
      <div id="auth-container">
        {authToken && !isServerAuthed && <div id="loading-message">Loading please wait...</div>}
        {!authToken && (
          <div id="buttons">
            <div
              style={{
                backgroundColor: authToken ? 'green' : 'red',
              }}
            >
              Firebase authenticated? {authToken ? 'true' : 'false'}
            </div>
            <button onClick={login} disabled={authToken}>
              Login to Firebase
            </button>
            <button onClick={logout} disabled={authToken === null || !authToken}>
              Logout of Firebase
            </button>
            <div
              style={{
                backgroundColor: isServerAuthed ? 'green' : 'red',
              }}
            >
              Server authenticated? {isServerAuthed ? 'true' : 'false'}
            </div>
          </div>
        )}
      </div>
      {/* see styles.css for canvas-container styling  */}

      <div id="canvas-container">
        <Canvas shadows orthographic camera={{ zoom: CAMERA_Z_DISTANCE_FROM_PLAYER / 2, position: [0, CAMERA_Z_DISTANCE_FROM_PLAYER, CAMERA_Z_DISTANCE_FROM_PLAYER] }}>
          {worldData && <World worldData={worldData} userId={userId} socketClient={socketClient} />}
        </Canvas>
      </div>
      <div style={{ position: 'absolute' }}>
        ping <span id="ping">0</span>ms
      </div>
      {isMobile && <div id="joystick"></div>}
    </>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));
