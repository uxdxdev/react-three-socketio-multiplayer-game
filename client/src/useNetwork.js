import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './useAuth';

const events = {
  CONNECTED: 'connected',
  CONNECTION_ERROR: 'connect_error',
};

export const useNetwork = () => {
  const [socketClient, setSocketClient] = useState(null);
  const [isServerAuthed, setIsServerAuthed] = useState(false);

  const { authToken, userId } = useAuth();

  // connect to the websocket server and store socket connection
  useEffect(() => {
    if (!socketClient && authToken) {
      const newSocket = io(`${process.env.REACT_APP_SERVER_URL}`, {
        // send auth token to authenticate with server
        auth: {
          userId,
          token: authToken,
        },
      });
      setSocketClient(newSocket);
    }
    // close the socket connection when this component unmounts
    return () => socketClient && socketClient.disconnect();
  }, [authToken, userId, socketClient]);

  // store client id when connected
  useEffect(() => {
    if (socketClient) {
      socketClient.on(events.CONNECTED, (clientId) => {
        setIsServerAuthed(!!clientId);
      });
    }
  }, [socketClient]);

  // catch any errors when connecting to websocket server
  useEffect(() => {
    if (socketClient) {
      socketClient.on(events.CONNECTION_ERROR, (err) => {
        console.log('test', err);

        setIsServerAuthed(false);
      });
    }
  }, [socketClient]);

  return {
    userId,
    socketClient,
    isServerAuthed,
  };
};
